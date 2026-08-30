import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowRight } from "@phosphor-icons/react";

export default function Landing() {
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

        <div className="mt-12">
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
      </div>
    </div>
  );
}
