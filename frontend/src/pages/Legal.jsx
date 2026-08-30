import React from "react";
import { Link } from "react-router-dom";

const Section = ({ children }) => (
  <section className="mt-8 space-y-3 text-zinc-300 leading-relaxed">{children}</section>
);

const H2 = ({ children }) => (
  <h2 className="font-display text-2xl font-bold mt-10 text-white">{children}</h2>
);

export function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16" data-testid="terms-page">
      <span className="text-xs tracking-[0.2em] uppercase text-primary">Legal</span>
      <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-2">Termos de Uso</h1>
      <p className="text-sm text-zinc-500 mt-3">Última atualização: 30 de agosto de 2026</p>

      <Section>
        <p>
          Bem-vindo ao <b>Roteira</b>. Ao criar uma conta ou usar nossos serviços, você concorda com
          estes termos. Leia com atenção — é curto e direto.
        </p>
      </Section>

      <H2>1. O que é o Roteira</H2>
      <Section>
        <p>
          Roteira é uma ferramenta online que usa inteligência artificial para gerar roteiros de
          vídeos curtos (TikTok, Reels, Shorts). Os textos são gerados sob demanda e você é
          responsável pelo uso que faz deles.
        </p>
      </Section>

      <H2>2. Sua conta</H2>
      <Section>
        <p>
          O acesso é feito via login com Google. Você é responsável por manter sua conta segura e
          pelo conteúdo que gerar. Contas usadas para spam, fraude ou conteúdo ilegal serão
          encerradas sem aviso.
        </p>
      </Section>

      <H2>3. Planos e pagamentos</H2>
      <Section>
        <p>
          Oferecemos um plano <b>Grátis</b> com limite mensal e um plano <b>Premium</b> pago via PIX
          por 30 dias. O código de ativação enviado após a aprovação do PIX é pessoal e intransferível.
          Não há reembolso após a ativação do Premium.
        </p>
      </Section>

      <H2>4. Conteúdo gerado por IA</H2>
      <Section>
        <p>
          Os roteiros gerados são sugestões criativas. Você deve revisar antes de publicar. Não
          garantimos que o conteúdo esteja livre de erros, semelhanças com terceiros ou que
          performe em plataformas de vídeo.
        </p>
      </Section>

      <H2>5. Propriedade</H2>
      <Section>
        <p>
          Você mantém a propriedade dos roteiros gerados na sua conta. O Roteira mantém os direitos
          sobre a plataforma, o código, o design e as marcas.
        </p>
      </Section>

      <H2>6. Limitação de responsabilidade</H2>
      <Section>
        <p>
          O serviço é fornecido "como está". Não somos responsáveis por perdas, resultados ou
          impactos que decorram do uso dos roteiros gerados.
        </p>
      </Section>

      <H2>7. Mudanças</H2>
      <Section>
        <p>
          Podemos atualizar estes termos. Continuar usando o serviço após mudanças significa que
          você aceita a nova versão.
        </p>
      </Section>

      <H2>8. Contato</H2>
      <Section>
        <p>Dúvidas? Fale conosco pelo email do administrador cadastrado no site.</p>
      </Section>

      <div className="mt-16 text-center">
        <Link to="/" className="text-primary hover:underline text-sm" data-testid="terms-back">← Voltar ao início</Link>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16" data-testid="privacy-page">
      <span className="text-xs tracking-[0.2em] uppercase text-primary">Legal</span>
      <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter mt-2">Política de Privacidade</h1>
      <p className="text-sm text-zinc-500 mt-3">Última atualização: 30 de agosto de 2026</p>

      <Section>
        <p>
          Sua privacidade importa. Esta política explica de forma direta o que coletamos, por que
          e o que você pode fazer.
        </p>
      </Section>

      <H2>1. Dados que coletamos</H2>
      <Section>
        <ul className="list-disc list-inside space-y-1">
          <li><b>Conta:</b> nome, email e foto do seu Google.</li>
          <li><b>Uso:</b> roteiros gerados, filtros escolhidos, data e quantidade de uso.</li>
          <li><b>Pagamento:</b> ID da transação PIX e observação que você enviar.</li>
          <li><b>Técnicos:</b> visitas anônimas ao site (contador agregado).</li>
        </ul>
      </Section>

      <H2>2. Como usamos</H2>
      <Section>
        <p>
          Usamos os dados para operar o serviço, aplicar limites de plano, aprovar pagamentos e
          melhorar a plataforma. Não vendemos seus dados.
        </p>
      </Section>

      <H2>3. Compartilhamento</H2>
      <Section>
        <p>
          Compartilhamos apenas com fornecedores técnicos essenciais: provedor de IA (OpenAI via
          Emergent), autenticação Google e, opcionalmente, envio de emails (Resend). Cada um trata
          apenas o mínimo necessário.
        </p>
      </Section>

      <H2>4. Cookies</H2>
      <Section>
        <p>
          Usamos apenas cookies essenciais para manter você logado. Não usamos cookies de
          rastreamento nem publicidade.
        </p>
      </Section>

      <H2>5. Seus direitos</H2>
      <Section>
        <p>
          Você pode pedir a exclusão da sua conta e de todos os seus roteiros a qualquer momento.
          É só entrar em contato pelo email do administrador.
        </p>
      </Section>

      <H2>6. Segurança</H2>
      <Section>
        <p>
          Usamos HTTPS, senhas em variável de ambiente e proteção por rota. Nenhum sistema é 100%
          seguro — se identificarmos um incidente, avisaremos usuários afetados.
        </p>
      </Section>

      <H2>7. Contato</H2>
      <Section>
        <p>Dúvidas de privacidade? Envie um email para o administrador do site.</p>
      </Section>

      <div className="mt-16 text-center">
        <Link to="/" className="text-primary hover:underline text-sm" data-testid="privacy-back">← Voltar ao início</Link>
      </div>
    </div>
  );
}
