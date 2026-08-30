import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { CheckCircle, Crown, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Pricing() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState({ free_limit: 5, premium_limit: 100, premium_price_brl: 5 });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/config").then(({ data }) => setCfg(data));
  }, []);

  const checkout = async () => {
    if (!user) { navigate("/login"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/payments/checkout", { origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Falha ao criar checkout");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-24" data-testid="pricing-page">
      <div className="text-center">
        <span className="text-xs tracking-[0.2em] uppercase text-primary">Planos</span>
        <h1 className="font-display text-5xl md:text-6xl font-black tracking-tighter mt-4">Escolha o seu plano.</h1>
        <p className="mt-4 text-zinc-400 text-lg">Comece grátis. Faça upgrade quando quiser mais.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-16">
        <PlanCard
          testid="free-plan"
          title="Grátis"
          price="R$0"
          per="/mês"
          features={[
            `${cfg.free_limit} roteiros por mês`,
            "Gerador de roteiros",
            "Títulos e hashtags",
            "Histórico básico",
          ]}
          cta={
            <Link to={user ? "/generate" : "/login"} className="block">
              <Button variant="outline" className="w-full rounded-full border-white/15" size="lg" data-testid="cta-free">
                Começar agora
              </Button>
            </Link>
          }
        />

        <PlanCard
          testid="premium-plan"
          highlight
          title={<><Crown weight="fill" className="text-primary" /> Premium</>}
          price={`R$${cfg.premium_price_brl}`}
          per="/mês"
          features={[
            `${cfg.premium_limit} roteiros por mês`,
            "Prompts para imagens/vídeos",
            "Todos os estilos e tons",
            "Histórico completo",
            "Recursos premium",
          ]}
          cta={
            user?.plan === "premium" ? (
              <Button disabled className="w-full rounded-full bg-primary/50 text-primary-foreground" size="lg" data-testid="premium-active">
                Plano ativo
              </Button>
            ) : (
              <Button onClick={checkout} disabled={loading}
                className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary"
                size="lg" data-testid="cta-premium">
                {loading ? "Redirecionando..." : "Começar agora"}
              </Button>
            )
          }
        />
      </div>

      <p className="text-center text-xs text-zinc-500 mt-10">Pagamento processado com segurança pelo Stripe. Cancele quando quiser.</p>
    </div>
  );
}

const PlanCard = ({ title, price, per, features, cta, highlight, testid }) => (
  <div
    data-testid={testid}
    className={`rounded-3xl p-8 md:p-10 ${highlight ? "gradient-border" : "bg-zinc-900/60 border border-white/10"}`}
  >
    <div className={highlight ? "rounded-3xl bg-zinc-950 p-8 md:p-10 -m-8 md:-m-10" : ""}>
      <div className="font-display text-2xl font-bold flex items-center gap-2">{title}</div>
      <div className="mt-4 flex items-end gap-1">
        <span className="font-display text-6xl font-black tracking-tighter">{price}</span>
        <span className="text-zinc-500 pb-2">{per}</span>
      </div>
      <ul className="mt-8 space-y-3 text-zinc-300">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2"><CheckCircle weight="fill" className="text-primary mt-1 shrink-0" size={18} />{f}</li>
        ))}
      </ul>
      <div className="mt-10">{cta}</div>
    </div>
  </div>
);
