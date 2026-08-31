"""Roteira - SaaS de geração de roteiros para vídeos curtos."""
import os
import uuid
import json
import logging
import re
import jwt
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Cookie, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import httpx

from emergentintegrations.llm.chat import LlmChat, UserMessage
from pix_brcode import build_pix_payload
from emailer import send_email, render_activation_email, render_admin_pix_alert, is_configured as email_configured

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("roteira")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-5.6-luna")
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
JWT_SECRET = os.environ["JWT_SECRET"]
FREE_LIMIT = int(os.environ.get("FREE_MONTHLY_LIMIT", "5"))
PREMIUM_LIMIT = int(os.environ.get("PREMIUM_MONTHLY_LIMIT", "100"))
PREMIUM_PRICE_BRL = float(os.environ.get("PREMIUM_PRICE_BRL", "5"))
PREMIUM_DAYS = int(os.environ.get("PREMIUM_DAYS", "30"))

PIX_KEY = os.environ.get("PIX_KEY", "")
PIX_KEY_TYPE = os.environ.get("PIX_KEY_TYPE", "Celular")
PIX_HOLDER_NAME = os.environ.get("PIX_HOLDER_NAME", "Roteira")
PIX_CITY = os.environ.get("PIX_CITY", "RECIFE")
ADMIN_NOTIFY_EMAIL = os.environ.get("ADMIN_NOTIFY_EMAIL", os.environ.get("ADMIN_EMAIL", ""))
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Roteira API")
api = APIRouter(prefix="/api")

# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    plan: str = "free"  # free | premium
    subscription_status: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    role: str = "user"
    referral_code: Optional[str] = None
    bonus_credits: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScriptRequest(BaseModel):
    tema: str
    plataforma: str
    duracao: str
    nicho: str
    estilo: str
    tom: str

class Cena(BaseModel):
    numero: int
    narracao: str
    mostrar: str
    prompt_imagem: str

class ScriptResult(BaseModel):
    hook: str
    cenas: List[Cena]
    roteiro_completo: str
    titulo: str
    descricao: str
    hashtags: List[str]
    cta: str

class ScriptDoc(BaseModel):
    id: str
    user_id: str
    request: dict
    result: dict
    created_at: datetime

class CodeRedeemBody(BaseModel):
    code: str

# ---------- Helpers ----------
def now_utc():
    return datetime.now(timezone.utc)

def current_month_key():
    n = now_utc()
    return f"{n.year:04d}-{n.month:02d}"

# ---------- Auth ----------
async def current_user(
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> User:
    token = session_token
    if not token and authorization:
        if authorization.lower().startswith("bearer "):
            token = authorization[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")

    # Try admin JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") == "admin":
            udoc = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
            if udoc:
                return User(**udoc)
    except jwt.PyJWTError:
        pass

    # Google session
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Sessão expirada")
    udoc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not udoc:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return User(**udoc)

async def admin_required(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a admin")
    return user

# ---------- Startup ----------
@app.on_event("startup")
async def on_startup():
    # Seed admin user
    await db.users.update_one(
        {"email": ADMIN_EMAIL},
        {"$setOnInsert": {
            "user_id": f"admin_{uuid.uuid4().hex[:12]}",
            "email": ADMIN_EMAIL,
            "name": "Administrador",
            "picture": None,
            "plan": "premium",
            "role": "admin",
            "created_at": now_utc().isoformat(),
        }},
        upsert=True,
    )
    await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"role": "admin", "plan": "premium"}})
    logger.info("Admin usuário garantido: %s", ADMIN_EMAIL)

# ---------- Public ----------
@api.get("/")
async def root():
    return {"app": "Roteira", "status": "ok"}

@api.get("/config")
async def public_config():
    return {
        "free_limit": FREE_LIMIT,
        "premium_limit": PREMIUM_LIMIT,
        "premium_price_brl": PREMIUM_PRICE_BRL,
    }

@api.get("/public/stats")
async def public_stats():
    """Contador social — roteiros criados esta semana."""
    week_ago = (now_utc() - timedelta(days=7)).isoformat()
    real = await db.scripts.count_documents({"created_at": {"$gte": week_ago}})
    # Baseline para prova social nos primeiros dias
    baseline = int(os.environ.get("SOCIAL_BASELINE", "12400"))
    return {"scripts_this_week": real + baseline}

# ---------- Referral ----------
async def ensure_referral_code(user: User) -> str:
    if user.referral_code:
        return user.referral_code
    code = uuid.uuid4().hex[:6].upper()
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"referral_code": code}})
    return code

@api.get("/referrals/me")
async def referrals_me(request: Request, user: User = Depends(current_user)):
    code = await ensure_referral_code(user)
    count = await db.referrals.count_documents({"referrer_user_id": user.user_id})
    origin = str(request.base_url).rstrip("/")
    # Preferir origin do frontend enviado via header
    origin_hdr = request.headers.get("origin") or origin
    return {
        "code": code,
        "share_url": f"{origin_hdr}/login?ref={code}",
        "successful_invites": count,
        "bonus_credits": int(user.bonus_credits or 0),
        "reward_per_invite": 3,
    }

# ---------- Auth Endpoints ----------
@api.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    ref_code = (body.get("referral_code") or "").strip().upper() or None
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id obrigatório")
    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=15,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Falha ao validar sessão Google")
    data = r.json()
    email = data["email"]
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data["session_token"]

    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    is_new = False
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        is_new = True
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email == ADMIN_EMAIL else "user"
        plan = "premium" if role == "admin" else "free"
        my_code = uuid.uuid4().hex[:6].upper()
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "plan": plan, "role": role,
            "referral_code": my_code, "bonus_credits": 0,
            "created_at": now_utc().isoformat(),
        })

    # Apply referral bonus if the new user came in through a referral code
    if is_new and ref_code:
        referrer = await db.users.find_one({"referral_code": ref_code}, {"_id": 0})
        if referrer and referrer["user_id"] != user_id:
            already = await db.referrals.find_one({"referred_user_id": user_id})
            if not already:
                await db.referrals.insert_one({
                    "referrer_user_id": referrer["user_id"],
                    "referred_user_id": user_id,
                    "referral_code": ref_code,
                    "credited": 3,
                    "created_at": now_utc().isoformat(),
                })
                await db.users.update_one(
                    {"user_id": referrer["user_id"]},
                    {"$inc": {"bonus_credits": 3}},
                )
    # Save session (7 days)
    expires = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires.isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60,
    )
    udoc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": udoc, "session_token": session_token}

@api.post("/auth/admin-login")
async def admin_login(request: Request, response: Response):
    body = await request.json()
    if body.get("email") != ADMIN_EMAIL or body.get("password") != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = jwt.encode(
        {"role": "admin", "email": ADMIN_EMAIL, "exp": (now_utc() + timedelta(days=7)).timestamp()},
        JWT_SECRET, algorithm="HS256",
    )
    response.set_cookie(
        key="session_token", value=token,
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60,
    )
    udoc = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    return {"user": udoc, "session_token": token}

@api.get("/auth/me")
async def auth_me(user: User = Depends(current_user)):
    usage = await get_usage_data(user)
    return {"user": user.model_dump(), "usage": usage}

@api.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(default=None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------- Usage ----------
async def get_usage_data(user: User):
    month = current_month_key()
    doc = await db.usage.find_one({"user_id": user.user_id, "month": month}, {"_id": 0})
    used = doc["count"] if doc else 0
    plan_limit = PREMIUM_LIMIT if user.plan == "premium" else FREE_LIMIT
    bonus = int(user.bonus_credits or 0)
    total = plan_limit + bonus
    return {
        "month": month,
        "used": used,
        "limit": plan_limit,
        "bonus": bonus,
        "total": total,
        "remaining": max(0, total - used),
        "plan": user.plan,
    }

@api.get("/usage")
async def usage_endpoint(user: User = Depends(current_user)):
    return await get_usage_data(user)

# ---------- LLM Script Generation ----------
def build_prompt(req: ScriptRequest) -> str:
    return f"""Você é um roteirista viral especializado em vídeos curtos para {req.plataforma}.
Gere um roteiro em português do Brasil com os seguintes parâmetros:

- Tema: {req.tema}
- Plataforma: {req.plataforma}
- Duração alvo: {req.duracao}
- Nicho: {req.nicho}
- Estilo: {req.estilo}
- Tom: {req.tom}

Responda APENAS com um JSON válido (sem markdown, sem cercas de código), seguindo EXATAMENTE este esquema:

{{
  "hook": "Frase de abertura de 1-3 segundos, extremamente forte, que prende atenção.",
  "cenas": [
    {{
      "numero": 1,
      "narracao": "Texto exato de narração ou fala nessa cena (curto e impactante).",
      "mostrar": "O que aparece na tela nesta cena (visual, ação, corte).",
      "prompt_imagem": "Prompt em inglês descritivo para gerar imagem/vídeo dessa cena com IA (cinematográfico, estilo visual, iluminação)."
    }}
  ],
  "roteiro_completo": "Texto contínuo do roteiro, unindo todas as cenas de forma natural, pronto para gravar.",
  "titulo": "Título chamativo com no máximo 80 caracteres.",
  "descricao": "Descrição curta e otimizada com 1-3 linhas.",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "cta": "Chamada final para engajamento (curta, direta)."
}}

Regras:
- Adapte o número de cenas à duração ({req.duracao}). Ex.: 15s=3-4 cenas, 30s=5-6, 60s=7-9, 90s=10-12.
- Português brasileiro natural, sem clichês.
- O hook deve ser irresistível.
- Retorne SOMENTE o JSON, nada mais.
"""

def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    # Grab first {..} block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end+1]
    return json.loads(text)

@api.post("/scripts/generate")
async def generate_script(req: ScriptRequest, user: User = Depends(current_user)):
    usage = await get_usage_data(user)
    if usage["remaining"] <= 0:
        raise HTTPException(
            status_code=402,
            detail=f"Limite mensal atingido ({usage['used']}/{usage['limit']}). Faça upgrade para Premium.",
        )
    prompt = build_prompt(req)
    session_id = f"gen_{uuid.uuid4().hex[:12]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message="Você é um roteirista viral. Responda somente com JSON válido no formato solicitado.",
    ).with_model(LLM_PROVIDER, LLM_MODEL)
    try:
        raw = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"Erro na IA: {e}")
    try:
        result = extract_json(raw if isinstance(raw, str) else str(raw))
    except Exception:
        logger.error("JSON parse fail: %s", raw)
        raise HTTPException(status_code=502, detail="A IA retornou resposta inválida. Tente novamente.")

    # Save
    script_id = f"scr_{uuid.uuid4().hex[:16]}"
    doc = {
        "id": script_id,
        "user_id": user.user_id,
        "request": req.model_dump(),
        "result": result,
        "created_at": now_utc().isoformat(),
    }
    await db.scripts.insert_one(doc)
    # Increment usage
    month = current_month_key()
    await db.usage.update_one(
        {"user_id": user.user_id, "month": month},
        {"$inc": {"count": 1}, "$setOnInsert": {"user_id": user.user_id, "month": month}},
        upsert=True,
    )
    doc.pop("_id", None)
    return {"script": doc, "usage": await get_usage_data(user)}

@api.get("/scripts")
async def list_scripts(user: User = Depends(current_user)):
    docs = await db.scripts.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"scripts": docs}

@api.get("/scripts/{sid}")
async def get_script(sid: str, user: User = Depends(current_user)):
    doc = await db.scripts.find_one({"id": sid, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Roteiro não encontrado")
    return doc

@api.delete("/scripts/{sid}")
async def delete_script(sid: str, user: User = Depends(current_user)):
    r = await db.scripts.delete_one({"id": sid, "user_id": user.user_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Roteiro não encontrado")
    return {"ok": True}

# ---------- PIX manual + Códigos de ativação ----------

class PixSubmitBody(BaseModel):
    transaction_id: str
    comprovante: Optional[str] = None  # texto livre / observação

def _activate_premium(user_id: str, days: int = None):
    exp = (now_utc() + timedelta(days=days or PREMIUM_DAYS)).isoformat()
    return db.users.update_one(
        {"user_id": user_id},
        {"$set": {"plan": "premium", "subscription_status": "active", "premium_until": exp}},
    )

def _new_activation_code() -> str:
    return "ROTEIRA-" + uuid.uuid4().hex[:8].upper()

@api.get("/payments/pix-info")
async def pix_info():
    brcode = ""
    if PIX_KEY:
        try:
            brcode = build_pix_payload(
                key=PIX_KEY,
                amount=float(PREMIUM_PRICE_BRL),
                merchant_name=PIX_HOLDER_NAME,
                merchant_city=PIX_CITY,
                txid="ROTEIRA",
                key_type=PIX_KEY_TYPE,
            )
        except Exception as e:
            logger.warning("pix brcode error: %s", e)
    return {
        "price_brl": PREMIUM_PRICE_BRL,
        "days": PREMIUM_DAYS,
        "pix_key": PIX_KEY,
        "pix_key_type": PIX_KEY_TYPE,
        "holder_name": PIX_HOLDER_NAME,
        "city": PIX_CITY,
        "brcode": brcode,
    }

@api.post("/payments/pix-submit")
async def pix_submit(body: PixSubmitBody, user: User = Depends(current_user)):
    tid = body.transaction_id.strip()
    if len(tid) < 4:
        raise HTTPException(status_code=400, detail="ID da transação muito curto")
    doc = {
        "id": f"pix_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "user_email": user.email,
        "user_name": user.name,
        "transaction_id": tid,
        "comprovante": body.comprovante or "",
        "status": "pending",
        "amount": PREMIUM_PRICE_BRL,
        "activation_code": None,
        "created_at": now_utc().isoformat(),
    }
    await db.pix_payments.insert_one(doc)
    doc.pop("_id", None)

    # Notifica admin por email (não bloqueia — degrada silenciosamente sem chave)
    if ADMIN_NOTIFY_EMAIL:
        try:
            html = render_admin_pix_alert({
                **doc,
                "admin_url": f"{APP_PUBLIC_URL}/admin" if APP_PUBLIC_URL else "/admin",
            })
            await send_email(to=ADMIN_NOTIFY_EMAIL, subject="🔔 Novo PIX pendente — Roteira", html=html)
        except Exception as e:
            logger.warning("admin alert email failed: %s", e)

    return {"payment": doc}

@api.get("/payments/pix-my")
async def pix_my(user: User = Depends(current_user)):
    docs = await db.pix_payments.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"payments": docs}

@api.post("/codes/redeem")
async def redeem_code(body: CodeRedeemBody, user: User = Depends(current_user)):
    code = body.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Código obrigatório")
    doc = await db.activation_codes.find_one({"code": code}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Código inválido")
    if doc.get("redeemed_by"):
        raise HTTPException(status_code=409, detail="Este código já foi utilizado")
    days = int(doc.get("days") or PREMIUM_DAYS)
    await db.activation_codes.update_one(
        {"code": code, "redeemed_by": None},
        {"$set": {"redeemed_by": user.user_id, "redeemed_email": user.email,
                  "redeemed_at": now_utc().isoformat()}},
    )
    await _activate_premium(user.user_id, days=days)
    return {"ok": True, "days": days, "plan": "premium"}

# ---------- Visits (contador simples) ----------
def _day_key():
    n = now_utc()
    return f"{n.year:04d}-{n.month:02d}-{n.day:02d}"

@api.post("/track/visit")
async def track_visit():
    day = _day_key()
    await db.visits.update_one({"day": day}, {"$inc": {"count": 1},
                                              "$setOnInsert": {"day": day}},
                               upsert=True)
    return {"ok": True}

# ---------- Admin ----------
class AdminCreateCodeBody(BaseModel):
    days: int = 30
    quantity: int = 1
    note: Optional[str] = None

class AdminApproveBody(BaseModel):
    payment_id: str
    days: int = 30

@api.get("/admin/stats")
async def admin_stats(_: User = Depends(admin_required)):
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"plan": "premium"})
    total_scripts = await db.scripts.count_documents({})
    paid = await db.pix_payments.count_documents({"status": "approved"})
    redeemed = await db.activation_codes.count_documents({"redeemed_by": {"$ne": None}})
    revenue = paid * PREMIUM_PRICE_BRL
    pending_pix = await db.pix_payments.count_documents({"status": "pending"})
    # Visits
    today = _day_key()
    today_doc = await db.visits.find_one({"day": today}, {"_id": 0})
    visits_today = today_doc["count"] if today_doc else 0
    week_ago = (now_utc() - timedelta(days=7)).strftime("%Y-%m-%d")
    week_docs = await db.visits.find({"day": {"$gte": week_ago}}, {"_id": 0}).to_list(30)
    visits_week = sum(d.get("count", 0) for d in week_docs)
    all_docs = await db.visits.find({}, {"_id": 0}).to_list(1000)
    visits_total = sum(d.get("count", 0) for d in all_docs)
    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "total_scripts": total_scripts,
        "paid_transactions": paid,
        "redeemed_codes": redeemed,
        "pending_pix": pending_pix,
        "revenue_brl": revenue,
        "visits_today": visits_today,
        "visits_week": visits_week,
        "visits_total": visits_total,
    }

@api.get("/admin/users")
async def admin_users(_: User = Depends(admin_required)):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    m = current_month_key()
    usage_docs = await db.usage.find({"month": m}, {"_id": 0}).to_list(2000)
    usage_by_user = {u["user_id"]: u.get("count", 0) for u in usage_docs}
    for u in users:
        u["month_usage"] = usage_by_user.get(u["user_id"], 0)
    return {"users": users}

@api.get("/admin/pix")
async def admin_pix_list(status: Optional[str] = None, _: User = Depends(admin_required)):
    q = {}
    if status:
        q["status"] = status
    docs = await db.pix_payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"payments": docs}

@api.post("/admin/pix/approve")
async def admin_pix_approve(body: AdminApproveBody, _: User = Depends(admin_required)):
    p = await db.pix_payments.find_one({"id": body.payment_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if p.get("status") == "approved":
        return {"ok": True, "payment": p}
    code = _new_activation_code()
    await db.activation_codes.insert_one({
        "code": code,
        "days": int(body.days or PREMIUM_DAYS),
        "created_by": "admin",
        "source": "pix_approval",
        "pix_payment_id": p["id"],
        "redeemed_by": None,
        "redeemed_email": None,
        "redeemed_at": None,
        "created_at": now_utc().isoformat(),
    })
    await db.pix_payments.update_one(
        {"id": body.payment_id},
        {"$set": {"status": "approved", "activation_code": code,
                  "approved_at": now_utc().isoformat(),
                  "days": int(body.days or PREMIUM_DAYS)}},
    )
    p = await db.pix_payments.find_one({"id": body.payment_id}, {"_id": 0})

    # Envia código por email ao usuário (se Resend configurado)
    try:
        pub_origin = APP_PUBLIC_URL or ""
        redeem_url = f"{pub_origin}/pricing" if pub_origin else "/pricing"
        html = render_activation_email(
            name=p.get("user_name") or "criador",
            code=code,
            days=int(body.days or PREMIUM_DAYS),
            redeem_url=redeem_url,
        )
        await send_email(to=p["user_email"], subject="🎉 Seu código Premium do Roteira", html=html)
    except Exception as e:
        logger.warning("activation email failed: %s", e)

    return {"ok": True, "payment": p, "code": code}

@api.post("/admin/pix/reject")
async def admin_pix_reject(body: AdminApproveBody, _: User = Depends(admin_required)):
    r = await db.pix_payments.update_one(
        {"id": body.payment_id},
        {"$set": {"status": "rejected", "rejected_at": now_utc().isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    return {"ok": True}

@api.get("/admin/codes")
async def admin_codes_list(_: User = Depends(admin_required)):
    docs = await db.activation_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"codes": docs}

@api.post("/admin/codes/create")
async def admin_codes_create(body: AdminCreateCodeBody, _: User = Depends(admin_required)):
    qty = max(1, min(int(body.quantity or 1), 50))
    created = []
    for _i in range(qty):
        code = _new_activation_code()
        await db.activation_codes.insert_one({
            "code": code,
            "days": int(body.days or PREMIUM_DAYS),
            "created_by": "admin",
            "source": "manual",
            "note": body.note or "",
            "redeemed_by": None,
            "redeemed_email": None,
            "redeemed_at": None,
            "created_at": now_utc().isoformat(),
        })
        created.append(code)
    return {"codes": created}

# ---------- Mount ----------
app.include_router(api)

# CORS: quando allow_credentials=True, o navegador REJEITA "*".
# Precisamos ecoar o Origin de volta — allow_origin_regex faz isso e não pode
# coexistir com allow_origins=["*"]. Suporta lista via CORS_ORIGINS (comma-sep).
_cors_env = os.environ.get("CORS_ORIGINS", "*").strip()
if _cors_env == "*" or not _cors_env:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=".*",
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
else:
    origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

@app.on_event("shutdown")
async def shutdown():
    client.close()
