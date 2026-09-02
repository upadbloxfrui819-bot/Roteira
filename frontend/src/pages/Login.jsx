import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ShieldCheck } from "@phosphor-icons/react";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

const GOOGLE_SCRIPT_ID = "google-identity-services";

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const googleButtonRef = useRef(null);

  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    if (ref) {
      localStorage.setItem("roteira_ref", ref.toUpperCase());
    }
  }, []);

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error("REACT_APP_GOOGLE_CLIENT_ID não configurado.");
      toast.error("Login Google ainda não foi configurado.");
      return;
    }

    let cancelled = false;

    const handleCredentialResponse = async (response) => {
      if (!response?.credential) {
        toast.error("Não foi possível receber o login do Google.");
        return;
      }

      setLoading(true);

      try {
        const referralCode =
          localStorage.getItem("roteira_ref") || undefined;

        const { data } = await api.post("/auth/session", {
          credential: response.credential,
          referral_code: referralCode,
        });

        if (data?.session_token) {
          localStorage.setItem("roteira_token", data.session_token);
        }

        localStorage.removeItem("roteira_ref");

        await refresh();

        toast.success("Login realizado com sucesso!");
        navigate("/dashboard", { replace: true });
      } catch (err) {
        console.error("Erro no login Google:", err);
        toast.error(
          err?.response?.data?.detail ||
            "Não foi possível entrar com o Google."
        );
      } finally {
        setLoading(false);
      }
    };

    const initializeGoogle = () => {
      if (
        cancelled ||
        !window.google?.accounts?.id ||
        !googleButtonRef.current
      ) {
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        googleButtonRef.current.innerHTML = "";

        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "pill",
            logo_alignment: "left",
            width: 380,
          }
        );

        setGoogleReady(true);
      } catch (err) {
        console.error("Erro ao iniciar Google Identity Services:", err);
        toast.error("Não foi possível carregar o login do Google.");
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", initializeGoogle);

    return () => {
      cancelled = true;
      script?.removeEventListener("load", initializeGoogle);
    };
  }, [navigate, refresh]);

  const handleAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post("/auth/admin-login", {
        email,
        password,
      });

      if (data.session_token) {
        localStorage.setItem("roteira_token", data.session_token);
      }

      await refresh();

      toast.success("Bem-vindo, administrador!");
      navigate("/admin");
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Credenciais inválidas"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-24"
      data-testid="login-page"
    >
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Logo size={56} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8">
          <h1 className="font-display text-2xl font-bold text-center mb-2">
            Entrar no Roteira
          </h1>

          <p className="text-zinc-400 text-sm text-center mb-8">
            Use sua conta Google. Rápido, seguro e sem senha.
          </p>

          <div className="w-full flex justify-center min-h-[44px]">
            <div
              ref={googleButtonRef}
              data-testid="google-login-btn"
              className={loading ? "pointer-events-none opacity-60" : ""}
            />
          </div>

          {!googleReady && (
            <p className="mt-3 text-xs text-center text-zinc-500">
              {loading
                ? "Entrando..."
                : "Carregando login do Google..."}
            </p>
          )}

          <div className="mt-6 text-xs text-center text-zinc-500">
            Ao continuar você aceita nossos termos de uso.
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowAdmin((v) => !v)}
              className="text-xs text-zinc-500 hover:text-primary transition-colors flex items-center gap-2 mx-auto"
              data-testid="toggle-admin-login"
            >
              <ShieldCheck size={14} />
              {showAdmin
                ? "Esconder acesso admin"
                : "Acesso administrador"}
            </button>

            {showAdmin && (
              <form
                onSubmit={handleAdmin}
                className="mt-4 space-y-3"
                data-testid="admin-login-form"
              >
                <div>
                  <Label
                    htmlFor="admin-email"
                    className="text-xs"
                  >
                    Email
                  </Label>

                  <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-zinc-950 border-white/10"
                    data-testid="admin-email-input"
                    required
                  />
                </div>

                <div>
                  <Label
                    htmlFor="admin-password"
                    className="text-xs"
                  >
                    Senha
                  </Label>

                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-950 border-white/10"
                    data-testid="admin-password-input"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="admin-login-submit"
                >
                  {loading ? "Entrando..." : "Entrar como admin"}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-sm text-zinc-500 hover:text-white"
            data-testid="back-home"
          >
            ← Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
