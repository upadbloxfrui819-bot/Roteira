"""Resend email helper — degrada silenciosamente sem chave configurada."""
import os
import asyncio
import logging

logger = logging.getLogger("roteira.email")

try:
    import resend  # type: ignore
except Exception:
    resend = None

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")


def is_configured() -> bool:
    return bool(RESEND_API_KEY and resend is not None)


async def send_email(*, to: str, subject: str, html: str) -> dict:
    """Envia email via Resend. Retorna dict com {sent: bool, id?: str, error?: str}."""
    if not is_configured():
        logger.info("Email SKIPPED (Resend não configurado): to=%s subject=%s", to, subject)
        return {"sent": False, "error": "resend_not_configured"}
    try:
        resend.api_key = RESEND_API_KEY
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"sent": True, "id": result.get("id") if isinstance(result, dict) else None}
    except Exception as e:
        logger.warning("Email FAILED to %s: %s", to, e)
        return {"sent": False, "error": str(e)}


# ---------- Templates ----------
BASE_STYLE = """
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#fff;margin:0;padding:32px;}
  .card{max-width:560px;margin:auto;background:#141420;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:32px;}
  .brand{font-weight:800;font-size:22px;color:#7C3AED;letter-spacing:-.02em;}
  .code{display:inline-block;background:#0a0a0f;border:1px solid rgba(124,58,237,.4);color:#7C3AED;font-family:monospace;font-size:22px;padding:14px 22px;border-radius:12px;letter-spacing:2px;margin:14px 0;}
  .btn{display:inline-block;background:#7C3AED;color:#fff !important;text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:600;margin-top:16px;}
  p{line-height:1.6;color:#c4c4d0;}
  small{color:#71717a;}
</style>
"""

def render_activation_email(name: str, code: str, days: int, redeem_url: str) -> str:
    return f"""
    <!DOCTYPE html><html><head>{BASE_STYLE}</head><body>
      <div class="card">
        <div class="brand">Roteira</div>
        <h2 style="margin-top:24px">Seu código Premium chegou 🎉</h2>
        <p>Olá {name}, seu pagamento PIX foi aprovado! Aqui está seu código de ativação:</p>
        <div class="code">{code}</div>
        <p>Vale <b>{days} dias</b> de Roteira Premium. Cole este código na página de planos ou clique no botão abaixo:</p>
        <a href="{redeem_url}" class="btn">Ativar Premium agora</a>
        <p style="margin-top:32px"><small>Se você não pediu este código, pode ignorar este email.</small></p>
      </div>
    </body></html>
    """

def render_admin_pix_alert(payment: dict) -> str:
    return f"""
    <!DOCTYPE html><html><head>{BASE_STYLE}</head><body>
      <div class="card">
        <div class="brand">Roteira · Admin</div>
        <h2 style="margin-top:24px">🔔 Novo PIX pendente</h2>
        <p>Você tem um novo comprovante PIX aguardando aprovação:</p>
        <ul style="line-height:1.9">
          <li><b>Usuário:</b> {payment.get('user_name')} ({payment.get('user_email')})</li>
          <li><b>ID transação:</b> <code style="font-size:12px">{payment.get('transaction_id')}</code></li>
          <li><b>Observação:</b> {payment.get('comprovante') or '—'}</li>
          <li><b>Valor:</b> R$ {payment.get('amount', 5):.2f}</li>
        </ul>
        <a href="{payment.get('admin_url', '#')}" class="btn">Abrir painel admin</a>
      </div>
    </body></html>
    """
