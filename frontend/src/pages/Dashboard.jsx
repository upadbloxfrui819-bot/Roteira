import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Sparkle, Plus, Clock, Crown, ArrowRight } from "@phosphor-icons/react";

export default function Dashboard() {
  const { user, usage, refresh } = useAuth();
  const [scripts, setScripts] = useState([]);

  useEffect(() => {
    refresh();
    api.get("/scripts").then(({ data }) => setScripts(data.scripts || []));
  }, []); // eslint-disable-line

  if (!user || !usage) return null;
  const pct = Math.min(100, (usage.used / usage.limit) * 100);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs tracking-[0.2em] uppercase text-primary">Dashboard</span>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-2">
            Olá, {user.name?.split(" ")[0]}
          </h1>
        </div>
        <Link to="/generate" data-testid="dash-new-script">
          <Button size="lg" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary">
            <Plus size={18} weight="bold" className="mr-2" /> Gerar novo roteiro
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10">
        <div className="rounded-2xl bg-zinc-900/60 border border-white/10 p-6 md:col-span-2" data-testid="usage-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Uso do mês</span>
            <span className="text-xs text-zinc-500">{usage.month}</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="font-display text-5xl font-black">{usage.used}<span className="text-zinc-600 text-3xl">/{usage.limit}</span></div>
            <div className="text-right text-sm text-zinc-400">Restam <b className="text-primary">{usage.remaining}</b> roteiros</div>
          </div>
          <Progress value={pct} className="mt-4 bg-white/5 h-2" />
          <p className="mt-3 text-sm text-zinc-500">Você usou {usage.used} de {usage.limit} roteiros este mês.</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-white/10 p-6" data-testid="plan-card">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Plano atual</div>
          <div className="font-display text-3xl font-black mt-3 flex items-center gap-2">
            {user.plan === "premium" ? <><Crown weight="fill" className="text-primary" /> Premium</> : "Grátis"}
          </div>
          {user.plan !== "premium" && (
            <Link to="/pricing" className="mt-4 inline-block" data-testid="upgrade-cta">
              <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 rounded-full">
                Fazer upgrade <ArrowRight size={14} className="ml-1" />
              </Button>
            </Link>
          )}
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-white/10 p-6" data-testid="scripts-count-card">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Roteiros salvos</div>
          <div className="font-display text-4xl font-black mt-3">{scripts.length}</div>
          <div className="text-sm text-zinc-500 mt-1">no total</div>
        </div>
      </div>

      <div className="mt-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Clock weight="duotone" className="text-primary" /> Meus roteiros</h2>
          <Link to="/history" className="text-sm text-primary hover:underline" data-testid="see-all-scripts">Ver todos →</Link>
        </div>
        {scripts.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-16 text-center" data-testid="empty-scripts">
            <Sparkle size={40} weight="duotone" className="text-primary mx-auto" />
            <p className="mt-4 text-zinc-400">Você ainda não gerou nenhum roteiro.</p>
            <Link to="/generate" className="inline-block mt-6">
              <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                Criar meu primeiro roteiro
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {scripts.slice(0, 6).map(s => (
              <Link to={`/history?open=${s.id}`} key={s.id}
                className="rounded-2xl bg-zinc-900/60 border border-white/10 p-6 hover:border-primary/40 transition-colors block"
                data-testid={`script-card-${s.id}`}>
                <div className="text-xs uppercase tracking-widest text-zinc-500 flex justify-between">
                  <span>{s.request?.plataforma}</span><span>{s.request?.duracao}</span>
                </div>
                <h3 className="mt-3 font-display font-bold text-lg line-clamp-2">{s.result?.titulo || s.request?.tema}</h3>
                <p className="text-zinc-400 text-sm mt-2 line-clamp-2">{s.result?.hook}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
