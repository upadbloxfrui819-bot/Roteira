import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Users, CurrencyCircleDollar, FileText, Crown } from "@phosphor-icons/react";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, u] = await Promise.all([api.get("/admin/stats"), api.get("/admin/users")]);
        setStats(s.data);
        setUsers(u.data.users || []);
      } catch {}
    })();
  }, []);

  if (!stats) return <div className="p-24 text-center text-zinc-400" data-testid="admin-loading">Carregando…</div>;

  const cards = [
    { icon: Users, label: "Usuários totais", value: stats.total_users, testid: "stat-users" },
    { icon: Crown, label: "Assinantes Premium", value: stats.premium_users, testid: "stat-premium" },
    { icon: FileText, label: "Roteiros gerados", value: stats.total_scripts, testid: "stat-scripts" },
    { icon: CurrencyCircleDollar, label: "Receita (R$)", value: stats.revenue_brl.toFixed(2), testid: "stat-revenue" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="admin-page">
      <span className="text-xs tracking-[0.2em] uppercase text-primary">Admin</span>
      <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-2">Painel Roteira</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-zinc-900/60 border border-white/10 p-6" data-testid={c.testid}>
            <c.icon size={24} weight="duotone" className="text-primary" />
            <div className="mt-4 text-xs uppercase tracking-widest text-zinc-500">{c.label}</div>
            <div className="font-display text-3xl font-black mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <h2 className="font-display text-2xl font-bold mb-4">Usuários</h2>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm" data-testid="users-table">
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
              {users.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-zinc-500">Nenhum usuário ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
