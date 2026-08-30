import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const sessionId = match[1];

    (async () => {
      try {
        const ref = localStorage.getItem("roteira_ref");
        const payload = { session_id: sessionId };
        if (ref) payload.referral_code = ref;
        const { data } = await api.post("/auth/session", payload);
        if (ref) localStorage.removeItem("roteira_ref");
        if (data.session_token) localStorage.setItem("roteira_token", data.session_token);
        window.history.replaceState({}, "", "/dashboard");
        await refresh();
        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [location, navigate, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="auth-callback">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-zinc-400">Autenticando...</p>
      </div>
    </div>
  );
}
