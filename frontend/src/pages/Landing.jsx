import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowRight, Users } from "@phosphor-icons/react";
import { api } from "../lib/api";

const formatK = (n) => {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
};

export default function Landing() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/public/stats").then(({ data }) => setStats(data)).catch(() => {});
    // Contabiliza visita (apenas uma vez por sessão)
    if (!sessionStorage.getItem("roteira_visited")) {
      api.post("/track/visit").catch(() => {});
      sessionStorage.setItem("roteira_visited", "1");
    }
  }, []);

  return (
    <div
      className="grid-bg min-h-[calc(100vh-73px)] flex items-center justify-center px-6"
      data-testid="landing-page"
    >
      <div className="max-w-3xl w-full text-center">
        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-[1.05] text-white"
          data-testid="landing-headline"
        >
          Crie roteiros que <span className="text-primary">prendem atenção.</span>
        </h1>

        <p
          className="mt-6 text-base md:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed"
          data-testid="landing-subheadline"
        >
          Transforme qualquer ideia em um roteiro pronto para TikTok, Reels e Shorts.
        </p>

        <div
          className="mt-10 mx-auto max-w-lg text-left rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4"
          data-testid="landing-preview"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-primary font-semibold">
            Prévia do roteiro
          </div>
          <p className="mt-2 text-white leading-relaxed text-sm md:text-base">
            "Você nunca vai olhar para o seu celular do mesmo jeito depois disso…"
          </p>
          <p className="mt-1 text-zinc-500 leading-relaxed text-sm md:text-base">
            Cena 1 — Close no celular vibrando. Narração: "Olha o que a IA descobriu…"
          </p>
        </div>

        <div className="mt-10">
          <Link to="/login" data-testid="landing-cta">
            <Button
              size="lg"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 py-6 text-base glow-primary"
            >
              Criar meu roteiro
              <ArrowRight size={18} weight="bold" className="ml-2" />
            </Button>
          </Link>
        </div>

        {stats && (
          <div
            className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-500"
            data-testid="social-counter"
          >
            <Users weight="duotone" size={16} className="text-primary" />
            <span>
              <span className="text-white font-semibold">{formatK(stats.scripts_this_week)}</span> roteiros criados esta semana
            </span>
          </div>
        )}

        <div className="mt-16 flex items-center justify-center gap-6 text-xs text-zinc-600">
          <Link to="/termos" className="hover:text-white transition-colors" data-testid="footer-terms">Termos</Link>
          <span className="text-zinc-800">·</span>
          <Link to="/privacidade" className="hover:text-white transition-colors" data-testid="footer-privacy">Privacidade</Link>
          <span className="text-zinc-800">·</span>
          <Link to="/pricing" className="hover:text-white transition-colors" data-testid="footer-pricing">Preços</Link>
        </div>
      </div>
    </div>
  );
}
