import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { CheckCircle, Crown, Copy, QrCode, Ticket, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

export default function Pricing() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState({ free_limit: 5, premium_limit: 100, premium_price_brl: 5 });
  const [pix, setPix] = useState(null);
  const [showPix, setShowPix] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [txId, setTxId] = useState("");
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pixDone, setPixDone] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    api.get("/config").then(({ data }) => setCfg(data));
    api.get("/payments/pix-info").then(({ data }) => setPix(data)).catch(() => {});
  }, []);

  const requireAuth = () => {
    if (!user) { navigate("/login"); return false; }
    return true;
  };

  const openPix = () => { if (requireAuth()) setShowPix(true); };
  const openCode = () => { if (requireAuth()) setShowCode(true); };

  const copyKey = async () => {
    if (!pix?.pix_key) return;
    try { await navigator.clipboard.writeText(pix.pix_key); toast.success("Chave PIX copiada!"); }
    catch { toast.error("Não foi possível copiar."); }
  };

  const copyBrcode = async () => {
    if (!pix?.brcode) return;
    try { await navigator.clipboard.writeText(pix.brcode); toast.success("Código Copia e Cola copiado!"); }
    catch { toast.error("Não foi possível copiar."); }
  };

  const submitPix = async (e) => {
    e.preventDefault();
    if (txId.trim().length < 4) return toast.error("Informe o ID da transação PIX.");
    setSubmitting(true);
    try {
      await api.post("/payments/pix-submit", { transaction_id: txId.trim(), comprovante: obs.trim() });
      setPixDone(true);
      toast.success("Comprovante enviado! O admin irá aprovar em breve.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erro ao enviar comprovante");
    } finally { setSubmitting(false); }
  };

  const redeem = async (e) => {
    e.preventDefault();
    setRedeeming(true);
    try {
      await api.post("/codes/redeem", { code: code.trim() });
      toast.success("Premium ativado! Bem-vindo 🎉");
      setShowCode(false); setCode("");
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Código inválido");
    } finally { setRedeeming(false); }
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
          per={`/ ${pix?.days || 30} dias`}
          features={[
            `${cfg.premium_limit} roteiros por mês`,
            "Prompts para imagens/vídeos",
            "Todos os estilos e tons",
            "Histórico completo",
            "Suporte prioritário",
          ]}
          cta={
            user?.plan === "premium" ? (
              <Button disabled className="w-full rounded-full bg-primary/50 text-primary-foreground" size="lg" data-testid="premium-active">
                Plano ativo
              </Button>
            ) : (
              <div className="space-y-2">
                <Button onClick={openPix} size="lg"
                  className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary"
                  data-testid="cta-pix">
                  <QrCode weight="duotone" size={18} className="mr-2" /> Pagar com PIX
                </Button>
                <Button onClick={openCode} variant="outline" size="lg"
                  className="w-full rounded-full border-white/15 hover:bg-white/5"
                  data-testid="cta-code">
                  <Ticket weight="duotone" size={18} className="mr-2" /> Já tenho um código
                </Button>
              </div>
            )
          }
        />
      </div>

      <p className="text-center text-xs text-zinc-500 mt-10">
        Pagamentos via PIX manual — sem taxas, sem intermediários. Após confirmação, você recebe um código de ativação por WhatsApp/email.
      </p>

      {/* Dialog PIX */}
      <Dialog open={showPix} onOpenChange={(v) => { if (!v) { setShowPix(false); setPixDone(false); setTxId(""); setObs(""); } }}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10" data-testid="pix-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <QrCode weight="duotone" className="text-primary" /> Pagamento via PIX
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Envie <b className="text-primary">R$ {cfg.premium_price_brl.toFixed(2).replace(".", ",")}</b> para a chave abaixo e cole o ID da transação para confirmarmos.
            </DialogDescription>
          </DialogHeader>

          {!pixDone ? (
            <div className="space-y-4">
              {pix?.brcode && (
                <div className="rounded-xl border border-white/10 bg-white p-4 flex justify-center" data-testid="pix-qrcode">
                  <QRCodeSVG value={pix.brcode} size={200} level="M" includeMargin={false} />
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2">
                <Row label="Tipo" value={pix?.pix_key_type || "-"} />
                <Row label="Titular" value={pix?.holder_name || "-"} />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest">Chave PIX</div>
                    <div className="font-mono text-white text-base truncate" data-testid="pix-key">{pix?.pix_key || "…"}</div>
                  </div>
                  <Button size="sm" onClick={copyKey} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" data-testid="copy-pix-btn">
                    <Copy size={14} className="mr-1" /> Copiar
                  </Button>
                </div>
                <Row label="Valor" value={`R$ ${cfg.premium_price_brl.toFixed(2).replace(".", ",")}`} />
                {pix?.brcode && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-zinc-500 uppercase tracking-widest">Copia e Cola</div>
                      <Button size="sm" variant="outline" onClick={copyBrcode} className="rounded-full border-white/15 hover:bg-white/5 h-7" data-testid="copy-brcode-btn">
                        <Copy size={12} className="mr-1" /> Copiar código
                      </Button>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-500 font-mono break-all leading-relaxed">{pix.brcode}</p>
                  </div>
                )}
              </div>

              <form onSubmit={submitPix} className="space-y-3" data-testid="pix-form">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">ID da transação PIX</Label>
                  <Input
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    placeholder="Ex.: E12345678202508301500..."
                    className="mt-2 bg-zinc-900 border-white/10"
                    data-testid="pix-txid-input"
                    required
                  />
                  <p className="mt-1 text-xs text-zinc-500">O ID (E2E ID) aparece no comprovante do seu banco.</p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">Observação (opcional)</Label>
                  <Textarea
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Alguma informação extra para o admin?"
                    className="mt-2 bg-zinc-900 border-white/10"
                    rows={2}
                    data-testid="pix-obs-input"
                  />
                </div>
                <Button type="submit" disabled={submitting} size="lg"
                  className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  data-testid="pix-submit-btn">
                  {submitting ? "Enviando..." : "Enviar comprovante"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="text-center py-6" data-testid="pix-success">
              <CheckCircle weight="fill" size={56} className="text-primary mx-auto" />
              <h3 className="mt-4 font-display text-xl font-bold">Recebemos seu envio!</h3>
              <p className="mt-2 text-sm text-zinc-400">
                O admin irá conferir e enviar um <b className="text-primary">código de ativação</b> por WhatsApp/email.
                Ao receber, clique em <b>"Já tenho um código"</b> na tela de planos para liberar o Premium.
              </p>
              <Button onClick={() => { setShowPix(false); setPixDone(false); setTxId(""); setObs(""); }}
                className="mt-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Code */}
      <Dialog open={showCode} onOpenChange={setShowCode}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10" data-testid="code-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Ticket weight="duotone" className="text-primary" /> Ativar Premium
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Cole o código que você recebeu para liberar o Premium por {pix?.days || 30} dias.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={redeem} className="space-y-3" data-testid="code-form">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROTEIRA-XXXXXXXX"
              className="bg-zinc-900 border-white/10 font-mono text-center text-lg tracking-widest py-6"
              data-testid="code-input"
              required
            />
            <Button type="submit" disabled={redeeming} size="lg"
              className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              data-testid="code-submit-btn">
              {redeeming ? "Ativando..." : (<>Ativar Premium <ArrowRight weight="bold" className="ml-2" /></>)}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-zinc-500">{label}</span>
    <span className="text-white">{value}</span>
  </div>
);

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
