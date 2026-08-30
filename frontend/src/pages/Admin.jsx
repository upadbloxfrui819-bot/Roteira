import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import {
  Users, CurrencyCircleDollar, FileText, Crown, Eye,
  QrCode, Ticket, CheckCircle, XCircle, Copy, Plus, Clock, Bell, BellSlash
} from "@phosphor-icons/react";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pix, setPix] = useState([]);
  const [codes, setCodes] = useState([]);
  const [tab, setTab] = useState("pix");
  const [approving, setApproving] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createQty, setCreateQty] = useState(1);
  const [createDays, setCreateDays] = useState(30);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("roteira_admin_sound") !== "0");
  const lastPendingRef = useRef(null);

  // "Sino" via Web Audio API — sem arquivos externos
  const ringBell = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const notes = [880, 1320, 1760];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.4);
      });
      setTimeout(() => ctx.close?.(), 1500);
    } catch {}
  };

  const load = async (isPoll = false) => {
    const [s, u, p, c] = await Promise.all([
      api.get("/admin/stats"), api.get("/admin/users"),
      api.get("/admin/pix"), api.get("/admin/codes"),
    ]);
    setStats(s.data); setUsers(u.data.users || []);
    setPix(p.data.payments || []); setCodes(c.data.codes || []);

    // Detecta novos PIX pendentes e toca o sino
    const currentPending = s.data.pending_pix || 0;
    if (isPoll && lastPendingRef.current !== null && currentPending > lastPendingRef.current) {
      if (soundEnabled) ringBell();
      toast.info(`🔔 Novo PIX pendente! (${currentPending} no total)`);
    }
    lastPendingRef.current = currentPending;
  };
  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 20000);
    return () => clearInterval(id);
  }, [soundEnabled]); // eslint-disable-line

  const toggleSound = () => {
    setSoundEnabled(v => {
      const n = !v;
      localStorage.setItem("roteira_admin_sound", n ? "1" : "0");
      toast.success(n ? "Sino ativado" : "Sino silenciado");
      if (n) ringBell();
      return n;
    });
  };

  const approve = async (id) => {
    setApproving(id);
    try {
      const { data } = await api.post("/admin/pix/approve", { payment_id: id, days: 30 });
      toast.success(`Aprovado! Código: ${data.code}`);
      try { await navigator.clipboard.writeText(data.code); toast.info("Código copiado — mande pro usuário."); } catch {}
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erro ao aprovar");
    } finally { setApproving(null); }
  };

  const reject = async (id) => {
    if (!window.confirm("Rejeitar este pagamento?")) return;
    await api.post("/admin/pix/reject", { payment_id: id });
    toast.success("Pagamento rejeitado.");
    load();
  };

  const copyCode = async (code) => {
    try { await navigator.clipboard.writeText(code); toast.success("Código copiado!"); } catch {}
  };

  const createCodes = async () => {
    try {
      const { data } = await api.post("/admin/codes/create", {
        quantity: Math.max(1, Math.min(50, Number(createQty) || 1)),
        days: Math.max(1, Number(createDays) || 30),
      });
      toast.success(`${data.codes.length} código(s) gerado(s)`);
      setShowCreate(false);
      load();
    } catch (err) { toast.error("Erro ao gerar códigos"); }
  };

  if (!stats) return <div className="p-24 text-center text-zinc-400" data-testid="admin-loading">Carregando…</div>;

  const statCards = [
    { icon: Eye, label: "Visitas hoje", value: stats.visits_today, testid: "stat-visits-today" },
    { icon: Eye, label: "Visitas 7 dias", value: stats.visits_week, testid: "stat-visits-week" },
    { icon: Eye, label: "Visitas totais", value: stats.visits_total, testid: "stat-visits-total" },
    { icon: Users, label: "Usuários", value: stats.total_users, testid: "stat-users" },
    { icon: Crown, label: "Premium", value: stats.premium_users, testid: "stat-premium" },
    { icon: FileText, label: "Roteiros", value: stats.total_scripts, testid: "stat-scripts" },
    { icon: Clock, label: "PIX pendentes", value: stats.pending_pix, testid: "stat-pending-pix" },
    { icon: CurrencyCircleDollar, label: "Receita (R$)", value: stats.revenue_brl.toFixed(2), testid: "stat-revenue" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="admin-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <span className="text-xs tracking-[0.2em] uppercase text-primary">Admin</span>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-2">Painel Roteira</h1>
        </div>
        <Button
          onClick={toggleSound}
          variant="outline"
          className="rounded-full border-white/15 hover:bg-white/5"
          data-testid="toggle-sound-btn"
        >
          {soundEnabled ? (<><Bell weight="fill" size={16} className="mr-2 text-primary" /> Sino ativo</>)
                        : (<><BellSlash size={16} className="mr-2" /> Sino silenciado</>)}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-zinc-900/60 border border-white/10 p-6" data-testid={c.testid}>
            <c.icon size={24} weight="duotone" className="text-primary" />
            <div className="mt-4 text-xs uppercase tracking-widest text-zinc-500">{c.label}</div>
            <div className="font-display text-3xl font-black mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-2 border-b border-white/10">
        {[
          { k: "pix", l: "Pagamentos PIX", icon: QrCode, badge: stats.pending_pix },
          { k: "codes", l: "Códigos de ativação", icon: Ticket },
          { k: "users", l: "Usuários", icon: Users },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            data-testid={`tab-${t.k}`}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 transition-colors duration-200 ${
              tab === t.k ? "border-primary text-white" : "border-transparent text-zinc-500 hover:text-white"
            }`}
          >
            <t.icon size={16} weight="duotone" /> {t.l}
            {t.badge > 0 && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-semibold">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "pix" && (
        <div className="mt-6" data-testid="pix-panel">
          {pix.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-500">Nenhum pagamento PIX enviado ainda.</div>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-widest">
                  <tr>
                    <th className="text-left p-4">Usuário</th>
                    <th className="text-left p-4">ID Transação</th>
                    <th className="text-left p-4">Observação</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Código</th>
                    <th className="text-left p-4">Data</th>
                    <th className="text-left p-4">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pix.map(p => (
                    <tr key={p.id} className="border-t border-white/5" data-testid={`pix-row-${p.id}`}>
                      <td className="p-4">
                        <div className="text-white">{p.user_name}</div>
                        <div className="text-xs text-zinc-500">{p.user_email}</div>
                      </td>
                      <td className="p-4 font-mono text-xs text-zinc-300 max-w-[220px] truncate">{p.transaction_id}</td>
                      <td className="p-4 text-zinc-400 text-xs max-w-[200px] truncate">{p.comprovante || "—"}</td>
                      <td className="p-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="p-4">
                        {p.activation_code ? (
                          <button onClick={() => copyCode(p.activation_code)} className="flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                            {p.activation_code} <Copy size={12} />
                          </button>
                        ) : "—"}
                      </td>
                      <td className="p-4 text-zinc-500 text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-4">
                        {p.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => approve(p.id)} disabled={approving === p.id}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-8"
                              data-testid={`approve-${p.id}`}>
                              <CheckCircle size={14} className="mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => reject(p.id)}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-full h-8"
                              data-testid={`reject-${p.id}`}>
                              <XCircle size={14} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "codes" && (
        <div className="mt-6" data-testid="codes-panel">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-zinc-400">Códigos manuais e códigos gerados automaticamente ao aprovar PIX.</p>
            <Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" data-testid="create-codes-btn">
              <Plus size={16} className="mr-1" /> Gerar códigos
            </Button>
          </div>
          {codes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-zinc-500">Nenhum código gerado ainda.</div>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-widest">
                  <tr>
                    <th className="text-left p-4">Código</th>
                    <th className="text-left p-4">Dias</th>
                    <th className="text-left p-4">Origem</th>
                    <th className="text-left p-4">Usado por</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map(c => (
                    <tr key={c.code} className="border-t border-white/5">
                      <td className="p-4">
                        <button onClick={() => copyCode(c.code)} className="font-mono text-primary hover:underline flex items-center gap-1">
                          {c.code} <Copy size={12} />
                        </button>
                      </td>
                      <td className="p-4">{c.days}</td>
                      <td className="p-4 text-xs text-zinc-400">{c.source === "pix_approval" ? "PIX aprovado" : "Manual"}</td>
                      <td className="p-4 text-xs text-zinc-400">{c.redeemed_email || "—"}</td>
                      <td className="p-4">
                        <StatusBadge status={c.redeemed_by ? "redeemed" : "available"} />
                      </td>
                      <td className="p-4 text-zinc-500 text-xs">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="mt-6" data-testid="users-panel">
          <div className="rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]" data-testid="users-table">
              <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-widest">
                <tr>
                  <th className="text-left p-4">Nome</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Plano</th>
                  <th className="text-left p-4">Uso mês</th>
                  <th className="text-left p-4">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-4 text-white">{u.name}</td>
                    <td className="p-4 text-zinc-400">{u.email}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${u.plan === "premium" ? "bg-primary/20 text-primary" : "bg-white/5 text-zinc-400"}`}>{u.plan}</span>
                    </td>
                    <td className="p-4 text-zinc-400">{u.month_usage || 0}</td>
                    <td className="p-4 text-zinc-500">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-zinc-500">Nenhum usuário ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Gerar códigos de ativação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">Quantidade</Label>
              <Input type="number" min={1} max={50} value={createQty} onChange={(e) => setCreateQty(e.target.value)}
                className="mt-2 bg-zinc-900 border-white/10" data-testid="create-qty" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">Dias de Premium</Label>
              <Input type="number" min={1} value={createDays} onChange={(e) => setCreateDays(e.target.value)}
                className="mt-2 bg-zinc-900 border-white/10" data-testid="create-days" />
            </div>
            <Button onClick={createCodes} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" data-testid="create-submit">
              Gerar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const StatusBadge = ({ status }) => {
  const map = {
    pending: { bg: "bg-yellow-500/10 text-yellow-400", label: "Pendente" },
    approved: { bg: "bg-primary/20 text-primary", label: "Aprovado" },
    rejected: { bg: "bg-red-500/10 text-red-400", label: "Rejeitado" },
    available: { bg: "bg-emerald-500/10 text-emerald-400", label: "Disponível" },
    redeemed: { bg: "bg-zinc-500/10 text-zinc-400", label: "Usado" },
  };
  const s = map[status] || { bg: "bg-white/5 text-zinc-400", label: status };
  return <span className={`text-xs px-2 py-1 rounded-full ${s.bg}`}>{s.label}</span>;
};
