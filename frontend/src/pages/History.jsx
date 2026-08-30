import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ScriptView from "../components/ScriptView";
import { toast } from "sonner";
import { Trash, Eye, Sparkle } from "@phosphor-icons/react";

export default function History() {
  const [scripts, setScripts] = useState([]);
  const [open, setOpen] = useState(null);
  const [params] = useSearchParams();

  const load = async () => {
    const { data } = await api.get("/scripts");
    setScripts(data.scripts || []);
    const id = params.get("open");
    if (id) {
      const s = data.scripts.find(x => x.id === id);
      if (s) setOpen(s);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const del = async (id) => {
    if (!window.confirm("Excluir este roteiro?")) return;
    await api.delete(`/scripts/${id}`);
    toast.success("Roteiro excluído.");
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="history-page">
      <span className="text-xs tracking-[0.2em] uppercase text-primary">Histórico</span>
      <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-2">Meus roteiros</h1>

      {scripts.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-white/10 p-16 text-center" data-testid="empty-history">
          <Sparkle size={40} weight="duotone" className="text-primary mx-auto" />
          <p className="mt-4 text-zinc-400">Nenhum roteiro por aqui ainda.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {scripts.map(s => (
            <div key={s.id} className="rounded-2xl bg-zinc-900/60 border border-white/10 p-6 flex flex-col" data-testid={`history-${s.id}`}>
              <div className="text-xs uppercase tracking-widest text-zinc-500 flex justify-between">
                <span>{s.request?.plataforma}</span><span>{s.request?.duracao}</span>
              </div>
              <h3 className="mt-3 font-display font-bold text-lg line-clamp-2">{s.result?.titulo}</h3>
              <p className="text-zinc-400 text-sm mt-2 line-clamp-3 flex-1">{s.result?.hook}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setOpen(s)} className="border-white/15 rounded-full flex-1" data-testid={`open-${s.id}`}>
                  <Eye size={14} className="mr-1" /> Abrir
                </Button>
                <Button size="sm" variant="outline" onClick={() => del(s.id)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-full" data-testid={`delete-${s.id}`}>
                  <Trash size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Roteiro</DialogTitle>
          </DialogHeader>
          {open && <ScriptView script={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
