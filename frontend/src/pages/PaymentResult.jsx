import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { CheckCircle, XCircle, Sparkle } from "@phosphor-icons/react";

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("checking");
  const { refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const sid = params.get("session_id");
    if (!sid) { setStatus("failed"); return; }
    let tries = 0;
    const poll = async () => {
      tries++;
      try {
        const { data } = await api.get(`/payments/status/${sid}`);
        if (data.payment_status === "paid") { setStatus("paid"); await refresh(); return; }
        if (data.payment_status === "expired" || data.payment_status === "failed") { setStatus("failed"); return; }
        if (tries < 15) setTimeout(poll, 2000); else setStatus("pending");
      } catch { if (tries < 15) setTimeout(poll, 2000); else setStatus("failed"); }
    };
    poll();
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen flex items-center justify-center px-6" data-testid="payment-success-page">
      <div className="text-center max-w-lg">
        {status === "checking" && (
          <>
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-zinc-400">Confirmando pagamento...</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle weight="fill" size={72} className="text-primary mx-auto" />
            <h1 className="font-display text-4xl font-black mt-6">Bem-vindo ao Premium!</h1>
            <p className="mt-4 text-zinc-400">Seu plano foi ativado. Agora você pode gerar até 100 roteiros por mês.</p>
            <Button onClick={() => navigate("/generate")} className="mt-8 rounded-full bg-primary text-primary-foreground font-semibold px-8" size="lg" data-testid="go-generate">
              <Sparkle weight="fill" className="mr-2" /> Criar roteiro agora
            </Button>
          </>
        )}
        {status === "pending" && (
          <>
            <p className="text-zinc-400">Pagamento ainda em processamento. Atualize esta página em alguns segundos.</p>
            <Link to="/dashboard"><Button className="mt-4">Ir para dashboard</Button></Link>
          </>
        )}
        {status === "failed" && (
          <>
            <XCircle weight="fill" size={72} className="text-red-500 mx-auto" />
            <h1 className="font-display text-3xl font-black mt-6">Não conseguimos confirmar</h1>
            <p className="mt-4 text-zinc-400">Se o valor foi debitado, avise nosso suporte.</p>
            <Link to="/pricing"><Button className="mt-8 rounded-full bg-primary text-primary-foreground" size="lg">Tentar novamente</Button></Link>
          </>
        )}
      </div>
    </div>
  );
}

export function PaymentCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" data-testid="payment-cancel-page">
      <div className="text-center max-w-lg">
        <XCircle weight="fill" size={72} className="text-zinc-500 mx-auto" />
        <h1 className="font-display text-4xl font-black mt-6">Pagamento cancelado</h1>
        <p className="mt-4 text-zinc-400">Você pode tentar novamente quando quiser.</p>
        <Link to="/pricing"><Button className="mt-8 rounded-full bg-primary text-primary-foreground font-semibold" size="lg">Voltar aos planos</Button></Link>
      </div>
    </div>
  );
}
