import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Sparkle, Copy, ArrowClockwise, FloppyDisk, CheckCircle, Crown } from "@phosphor-icons/react";
import ScriptView from "../components/ScriptView";

const PLATAFORMAS = ["TikTok", "YouTube Shorts", "Instagram Reels"];
const DURACOES = ["15s", "30s", "60s", "90s"];
const NICHOS = ["curiosidades", "terror", "histórias", "games", "animais", "dinheiro", "tecnologia", "personalizado"];
const ESTILOS = ["suspense", "viral", "engraçado", "educativo", "emocional", "storytelling"];
const TONS = ["sério", "casual", "intenso", "misterioso"];

export default function Generate() {
  const navigate = useNavigate();
  const { usage, refresh } = useAuth();
  const [form, setForm] = useState({
    tema: "", plataforma: "TikTok", duracao: "30s", nicho: "curiosidades", estilo: "viral", tom: "casual",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [limitReached, setLimitReached] = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const generate = async () => {
    if (!form.tema.trim()) return toast.error("Informe o tema do vídeo.");
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/scripts/generate", form);
      setResult(data.script);
      await refresh();
      toast.success("Roteiro gerado!");
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.detail || "Erro ao gerar roteiro";
      if (status === 402) { setLimitReached(true); toast.error(msg); }
      else toast.error(msg);
    } finally { setLoading(false); }
  };

  if (limitReached) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center" data-testid="limit-reached-page">
        <Crown weight="fill" size={64} className="text-primary mx-auto" />
        <h1 className="font-display text-4xl font-black tracking-tighter mt-6">Limite atingido</h1>
        <p className="mt-4 text-zinc-400 text-lg">Você usou todos os seus roteiros gratuitos deste mês. Passe para o Premium e crie até 100 roteiros mensais.</p>
        <div className="mt-10 flex gap-4 justify-center">
          <Link to="/pricing"><Button size="lg" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary px-8" data-testid="upgrade-from-limit">Ver planos Premium</Button></Link>
          <Button size="lg" variant="outline" onClick={() => setLimitReached(false)} className="border-white/15 rounded-full">Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12" data-testid="generate-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="text-xs tracking-[0.2em] uppercase text-primary">Gerador</span>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-2">Criar roteiro</h1>
        </div>
        {usage && (
          <div className="text-sm text-zinc-400" data-testid="usage-inline">
            <span className="text-white font-semibold">{usage.used}</span> / {usage.limit} usados este mês
          </div>
        )}
      </div>

      <div className="mt-10 rounded-3xl bg-zinc-900/60 border border-white/10 p-6 md:p-10">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Tema do vídeo</Label>
            <Input
              placeholder="Ex.: 3 curiosidades sobre o Egito que a escola nunca te contou"
              value={form.tema}
              onChange={(e) => set("tema")(e.target.value)}
              className="mt-2 bg-zinc-950 border-white/10 focus:border-primary text-base py-6"
              data-testid="tema-input"
            />
          </div>
          <FieldSelect label="Plataforma" value={form.plataforma} onValueChange={set("plataforma")} options={PLATAFORMAS} testid="plataforma-select" />
          <FieldSelect label="Duração" value={form.duracao} onValueChange={set("duracao")} options={DURACOES} testid="duracao-select" />
          <FieldSelect label="Nicho" value={form.nicho} onValueChange={set("nicho")} options={NICHOS} testid="nicho-select" />
          <FieldSelect label="Estilo" value={form.estilo} onValueChange={set("estilo")} options={ESTILOS} testid="estilo-select" />
          <FieldSelect label="Tom" value={form.tom} onValueChange={set("tom")} options={TONS} testid="tom-select" />
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button
            onClick={generate}
            disabled={loading}
            size="lg"
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary px-8"
            data-testid="generate-script-button"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" /> Gerando…</>
            ) : (
              <><Sparkle weight="fill" size={18} className="mr-2" /> Gerar roteiro</>
            )}
          </Button>
          {result && (
            <Button variant="outline" onClick={generate} disabled={loading} className="rounded-full border-white/15" data-testid="regenerate-btn">
              <ArrowClockwise className="mr-2" /> Gerar novamente
            </Button>
          )}
        </div>
      </div>

      {loading && <SkeletonResult />}
      {result && <ScriptView script={result} onSaved={() => toast.success("Roteiro já está salvo em Meus Roteiros")} />}
    </div>
  );
}

const FieldSelect = ({ label, value, onValueChange, options, testid }) => (
  <div>
    <Label className="text-xs uppercase tracking-widest text-zinc-500">{label}</Label>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="mt-2 bg-zinc-950 border-white/10 focus:border-primary py-6" data-testid={testid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-white/10">
        {options.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

const SkeletonResult = () => (
  <div className="mt-10 rounded-3xl gradient-border p-6" data-testid="loading-skeleton">
    <div className="rounded-2xl bg-zinc-950 p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-32 bg-zinc-800 rounded" />
        <div className="h-8 w-3/4 bg-zinc-800 rounded" />
        <div className="h-4 w-full bg-zinc-800 rounded" />
        <div className="h-4 w-5/6 bg-zinc-800 rounded" />
      </div>
    </div>
  </div>
);
