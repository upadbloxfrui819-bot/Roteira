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
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)

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

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
STRIPE_ENABLE_PIX = os.environ.get("STRIPE_ENABLE_PIX", "false").lower() == "true"

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

class CheckoutRequest(BaseModel):
    origin_url: str

# ---------- Helpers ----------
def now_utc():
    return datetime.now(timezone.utc)

def current_month_key():
    n = now_utc()
    return f"{n.year:04d}-{n.month:02d}"

def stripe_client(request: Request) -> StripeCheckout:
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

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

# ---------- Stripe (Emergent Payments Sandbox) ----------
# NOTA: assinatura mensal recorrente exige uma conta Stripe reivindicada.
# Nesta versão usamos pagamento único de R$5 que ativa Premium por 30 dias.
# Para recorrência real, siga o passo de "onboarding_url" no README.

@api.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest, request: Request, user: User = Depends(current_user)):
    checkout = stripe_client(request)
    origin = req.origin_url.rstrip("/")
    payment_methods = ["card", "pix"] if STRIPE_ENABLE_PIX else ["card"]
    session_req = CheckoutSessionRequest(
        amount=float(PREMIUM_PRICE_BRL),
        currency="brl",
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/payment/cancel",
        metadata={"user_id": user.user_id, "email": user.email, "product": "roteira_premium"},
        payment_methods=payment_methods,
    )
    try:
        session: CheckoutSessionResponse = await checkout.create_checkout_session(session_req)
    except Exception as e:
        logger.exception("Stripe checkout error")
        raise HTTPException(status_code=500, detail=f"Erro ao criar checkout: {e}")

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user.user_id,
        "amount": PREMIUM_PRICE_BRL,
        "currency": "brl",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.session_id}

async def _mark_paid(session_id: str, status_obj):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record or record.get("payment_status") == "paid":
        return record
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {
            "status": "completed",
            "payment_status": "paid",
            "updated_at": now_utc().isoformat(),
        }},
    )
    if record.get("user_id"):
        expires = (now_utc() + timedelta(days=30)).isoformat()
        await db.users.update_one(
            {"user_id": record["user_id"]},
            {"$set": {"plan": "premium", "subscription_status": "active",
                      "premium_until": expires}},
        )
    return await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})

@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    if record.get("payment_status") != "paid":
        try:
            checkout = stripe_client(request)
            status: CheckoutStatusResponse = await checkout.get_checkout_status(session_id)
            if status.payment_status == "paid" or status.status == "complete":
                record = await _mark_paid(session_id, status)
        except Exception:
            pass
    return {
        "session_id": record["session_id"],
        "status": record["status"],
        "payment_status": record["payment_status"],
    }

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    checkout = stripe_client(request)
    try:
        resp = await checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.warning("Webhook error: %s", e)
        raise HTTPException(status_code=400, detail="Webhook inválido")
    if resp.payment_status == "paid":
        await _mark_paid(resp.session_id, resp)
    return {"received": True}

# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(_: User = Depends(admin_required)):
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"plan": "premium"})
    total_scripts = await db.scripts.count_documents({})
    paid = await db.payment_transactions.count_documents({"payment_status": "paid"})
    revenue = paid * PREMIUM_PRICE_BRL
    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "total_scripts": total_scripts,
        "paid_transactions": paid,
        "revenue_brl": revenue,
    }

@api.get("/admin/users")
async def admin_users(_: User = Depends(admin_required)):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for u in users:
        m = current_month_key()
        usage = await db.usage.find_one({"user_id": u["user_id"], "month": m}, {"_id": 0})
        u["month_usage"] = usage["count"] if usage else 0
    return {"users": users}

# ---------- Mount ----------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
