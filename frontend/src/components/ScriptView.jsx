import React from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Copy, FloppyDisk, Play } from "@phosphor-icons/react";

const copy = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  } catch { toast.error("Não foi possível copiar."); }
};

const buildFullText = (r) => {
  const cenas = (r.cenas || []).map(c =>
    `CENA ${c.numero}\nNarração: ${c.narracao}\nMostrar: ${c.mostrar}\nPrompt: ${c.prompt_imagem}`
  ).join("\n\n");
  return `TÍTULO: ${r.titulo}\n\nHOOK\n${r.hook}\n\nROTEIRO\n${r.roteiro_completo}\n\n${cenas}\n\nDESCRIÇÃO\n${r.descricao}\n\nHASHTAGS\n${(r.hashtags||[]).join(" ")}\n\nCTA\n${r.cta}`;
};

export default function ScriptView({ script, onSaved }) {
  const r = script.result || script;
  const fullText = buildFullText(r);

  return (
    <div className="mt-10" data-testid="script-result">
      <div className="rounded-3xl gradient-border p-[2px]">
        <div className="rounded-3xl bg-zinc-950 p-8 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-black tracking-tighter">{r.titulo}</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(r.roteiro_completo, "Roteiro")} className="border-white/15 rounded-full" data-testid="copy-script-btn">
                <Copy size={14} className="mr-1" /> Copiar roteiro
              </Button>
              <Button size="sm" onClick={() => copy(fullText, "Tudo")} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-semibold" data-testid="copy-all-btn">
                <Copy size={14} className="mr-1" /> Copiar tudo
              </Button>
            </div>
          </div>

          <Section title="Hook" testid="section-hook">
            <p className="text-lg leading-relaxed">{r.hook}</p>
          </Section>

          <Section title="Roteiro completo" testid="section-roteiro">
            <p className="whitespace-pre-line leading-relaxed text-zinc-300">{r.roteiro_completo}</p>
          </Section>

          <Section title="Cenas" testid="section-cenas">
            <div className="space-y-4">
              {(r.cenas || []).map((c, i) => (
                <div key={i} className="rounded-xl border border-white/10 p-5" data-testid={`cena-${c.numero}`}>
                  <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                    <Play weight="fill" size={14} /> CENA {c.numero}
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="text-zinc-500">Narração:</span> {c.narracao}</p>
                    <p><span className="text-zinc-500">Mostrar:</span> {c.mostrar}</p>
                    <p className="text-zinc-400 italic"><span className="text-zinc-500 not-italic">Prompt imagem:</span> {c.prompt_imagem}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <Section title="Descrição" testid="section-descricao">
              <p className="text-zinc-300">{r.descricao}</p>
            </Section>
            <Section title="CTA final" testid="section-cta">
              <p className="text-zinc-300">{r.cta}</p>
            </Section>
          </div>

          <Section title="Hashtags" testid="section-hashtags">
            <div className="flex flex-wrap gap-2">
              {(r.hashtags || []).map((t, i) => (
                <span key={i} className="text-sm px-3 py-1 rounded-full bg-white/5 border border-white/10">{t}</span>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children, testid }) => (
  <div className="mt-8 first:mt-0" data-testid={testid}>
    <div className="text-primary text-xs uppercase tracking-[0.2em] font-semibold mb-3">{title}</div>
    {children}
  </div>
);
