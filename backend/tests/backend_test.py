"""Backend tests — Roteira auth/CORS cross-origin (Netlify) bug fix validation."""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
EXT_ORIGIN = "https://roteira.netlify.app"


@pytest.fixture(scope="session")
def creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*-\s*Email:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*-\s*Senha:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("credentials not found")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(client, creds):
    r = client.post(f"{BASE_URL}/api/auth/admin-login", json=creds,
                    headers={"Origin": EXT_ORIGIN})
    if r.status_code != 200:
        pytest.fail(f"admin-login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("session_token")
    if not tok:
        pytest.fail("no session_token in admin-login body")
    return tok


# --- Health / public ---
class TestPublic:
    def test_root(self, client):
        r = client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_config(self, client):
        r = client.get(f"{BASE_URL}/api/config")
        assert r.status_code == 200
        d = r.json()
        assert "free_limit" in d and "premium_limit" in d

    def test_public_stats(self, client):
        r = client.get(f"{BASE_URL}/api/public/stats")
        assert r.status_code == 200
        assert isinstance(r.json()["scripts_this_week"], int)


# --- CORS preflight from external origin ---
class TestCORS:
    @pytest.mark.parametrize("path,method", [
        ("/api/auth/session", "POST"),
        ("/api/auth/admin-login", "POST"),
        ("/api/auth/me", "GET"),
    ])
    def test_preflight(self, client, path, method):
        r = requests.options(f"{BASE_URL}{path}", headers={
            "Origin": EXT_ORIGIN,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type,authorization",
        })
        print(f"PREFLIGHT {path} -> {r.status_code} headers={dict(r.headers)}")
        assert r.status_code in (200, 204), r.text[:300]
        acao = r.headers.get("access-control-allow-origin")
        assert acao in ("*", EXT_ORIGIN), f"ACAO={acao}"
        allow_methods = (r.headers.get("access-control-allow-methods") or "").upper()
        assert method in allow_methods or "*" in allow_methods
        allow_headers = (r.headers.get("access-control-allow-headers") or "").lower()
        assert "authorization" in allow_headers or "*" in allow_headers

    def test_actual_request_cors_header(self, client):
        r = client.get(f"{BASE_URL}/api/config", headers={"Origin": EXT_ORIGIN})
        assert r.status_code == 200
        acao = r.headers.get("access-control-allow-origin")
        assert acao in ("*", EXT_ORIGIN), f"ACAO={acao}"
        # If ACAO is "*", allow-credentials must NOT be true (browser rejects)
        if acao == "*":
            assert r.headers.get("access-control-allow-credentials") != "true", \
                "Invalid combo: ACAO='*' with Allow-Credentials=true"


# --- Auth: Bearer end-to-end without cookies ---
class TestAuth:
    def test_admin_login_returns_token_in_body(self, client, creds):
        r = requests.post(f"{BASE_URL}/api/auth/admin-login", json=creds,
                          headers={"Origin": EXT_ORIGIN})
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("session_token"), str) and len(d["session_token"]) > 0
        assert d["user"]["email"] == creds["email"]
        assert d["user"]["role"] == "admin"
        assert "_id" not in d["user"]

    def test_admin_login_bad_password(self, client, creds):
        r = requests.post(f"{BASE_URL}/api/auth/admin-login",
                          json={"email": creds["email"], "password": "wrong"},
                          headers={"Origin": EXT_ORIGIN})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_me_with_bearer_no_cookie(self, admin_token):
        # fresh session => no cookies at all, cross-origin
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}",
            "Origin": EXT_ORIGIN,
        })
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert "usage" in d and "remaining" in d["usage"]

    def test_me_without_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Origin": EXT_ORIGIN})
        assert r.status_code == 401

    def test_me_with_invalid_bearer_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer notatoken",
                                  "Origin": EXT_ORIGIN})
        assert r.status_code == 401

    def test_session_missing_session_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={},
                          headers={"Origin": EXT_ORIGIN})
        assert r.status_code == 400
        assert "session_id" in str(r.json())

    def test_session_invalid_session_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/session",
                          json={"session_id": "fake-session-id"},
                          headers={"Origin": EXT_ORIGIN})
        assert r.status_code == 401, r.text[:300]


# --- Protected endpoints via Bearer ---
class TestProtected:
    def test_usage(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/usage",
                         headers={"Authorization": f"Bearer {admin_token}",
                                  "Origin": EXT_ORIGIN})
        assert r.status_code == 200
        assert r.json()["plan"] == "premium"

    def test_referrals_me(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/referrals/me",
                         headers={"Authorization": f"Bearer {admin_token}",
                                  "Origin": EXT_ORIGIN})
        assert r.status_code == 200
        d = r.json()
        assert len(d["code"]) > 0
        assert d["share_url"].startswith(EXT_ORIGIN)

    def test_admin_stats(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats",
                         headers={"Authorization": f"Bearer {admin_token}",
                                  "Origin": EXT_ORIGIN})
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), dict)

    def test_admin_stats_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers={"Origin": EXT_ORIGIN})
        assert r.status_code in (401, 403)

    def test_scripts_list(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/scripts",
                         headers={"Authorization": f"Bearer {admin_token}",
                                  "Origin": EXT_ORIGIN})
        assert r.status_code == 200
        body = r.json()
        items = body if isinstance(body, list) else body.get("items", body.get("scripts"))
        assert items is not None
        for it in (items or [])[:5]:
            assert "_id" not in it


# --- Netlify SPA config files ---
class TestNetlifyConfig:
    def test_redirects_file(self):
        p = Path("/app/frontend/public/_redirects")
        assert p.exists()
        c = p.read_text()
        assert "/index.html" in c and "200" in c

    def test_netlify_toml(self):
        p = Path("/app/frontend/netlify.toml")
        assert p.exists()
        c = p.read_text()
        assert "redirects" in c and "/index.html" in c


# --- Frontend source checks relevant to the bug ---
class TestFrontendSource:
    def test_axios_without_credentials(self):
        c = Path("/app/frontend/src/lib/api.js").read_text()
        assert "withCredentials: false" in c
        assert "process.env.REACT_APP_BACKEND_URL" in c
        assert "Bearer" in c

    def test_login_uses_window_origin(self):
        c = Path("/app/frontend/src/pages/Login.jsx").read_text()
        assert 'window.location.origin + "/dashboard"' in c
        assert "auth.emergentagent.com" in c
