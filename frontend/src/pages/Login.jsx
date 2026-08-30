import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Sparkle, GoogleLogo, ShieldCheck } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    // Preserva o código de indicação (se houver) no localStorage para aplicar após o callback
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) localStorage.setItem("roteira_ref", ref.toUpperCase());
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/admin-login", { email, password });
      if (data.session_token) localStorage.setItem("roteira_token", data.session_token);
      await refresh();
      toast.success("Bem-vindo, administrador!");
      navigate("/admin");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-24" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Sparkle weight="fill" size={22} className="text-primary-foreground" />
          </span>
          <span className="font-display text-2xl font-bold tracking-tighter">Roteira</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8">
          <h1 className="font-display text-2xl font-bold text-center mb-2">Entrar no Roteira</h1>
          <p className="text-zinc-400 text-sm text-center mb-8">Use sua conta Google. Rápido, seguro e sem senha.</p>

          <Button
            onClick={handleGoogle}
            size="lg"
            className="w-full rounded-full bg-white text-black hover:bg-zinc-200 font-semibold"
            data-testid="google-login-btn"
          >
            <GoogleLogo weight="bold" size={20} className="mr-3" /> Continuar com Google
          </Button>

          <div className="mt-6 text-xs text-center text-zinc-500">
            Ao continuar você aceita nossos termos de uso.
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowAdmin(v => !v)}
              className="text-xs text-zinc-500 hover:text-primary transition-colors flex items-center gap-2 mx-auto"
              data-testid="toggle-admin-login"
            >
              <ShieldCheck size={14} /> {showAdmin ? "Esconder acesso admin" : "Acesso administrador"}
            </button>

            {showAdmin && (
              <form onSubmit={handleAdmin} className="mt-4 space-y-3" data-testid="admin-login-form">
                <div>
                  <Label htmlFor="admin-email" className="text-xs">Email</Label>
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
                  <Label htmlFor="admin-password" className="text-xs">Senha</Label>
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
                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" data-testid="admin-login-submit">
                  {loading ? "Entrando..." : "Entrar como admin"}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-zinc-500 hover:text-white" data-testid="back-home">← Voltar para o início</Link>
        </div>
      </div>
    </div>
  );
}
