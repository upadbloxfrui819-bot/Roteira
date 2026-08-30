# Roteira — SaaS de geração de roteiros com IA

**Roteira** é uma ferramenta para criadores de TikTok, YouTube Shorts e Instagram Reels gerarem roteiros de vídeos curtos completos (hook, cenas, narração, prompts para IA de imagem, título, descrição, hashtags, CTA) usando IA de última geração — em português do Brasil.

## Stack
- **Frontend:** React 19 + Tailwind + shadcn/ui + Framer Motion + Phosphor Icons
- **Backend:** FastAPI + Motor (MongoDB async)
- **IA:** OpenAI GPT-5.6 (via Emergent LLM Key universal)
- **Auth:** Emergent Google OAuth + JWT para admin
- **Pagamentos:** Stripe (via Emergent Payments Sandbox)

---

## ✅ O que já está funcionando
- Landing page completa (Hero, Como funciona, Benefícios, Exemplos, FAQ, CTA final)
- Login Google (Emergent-managed OAuth) + Login administrador (email/senha)
- Geração real de roteiros via GPT-5.6 (retorna JSON estruturado)
- Histórico de roteiros com abrir / copiar / excluir
- Limite mensal por plano (5 grátis / 100 Premium) e bloqueio no backend
- Dashboard com uso do mês, plano atual e roteiros recentes
- Página de preços com checkout Stripe
- Painel admin (usuários, receita, roteiros, assinantes premium)
- Design dark neon-yellow responsivo mobile/desktop

## ⚠️ O que depende de configuração externa
| Item | Status | Ação |
|------|--------|------|
| Chave IA (`EMERGENT_LLM_KEY`) | Pré-injetada, funciona | Nenhuma. Para trocar, edite `backend/.env` |
| Stripe test | Pré-injetada (`sk_test_emergent`) | Nenhuma para testar |
| Stripe produção (recorrência real) | Precisa reivindicar sandbox no painel Emergent | Peça ao agente: "reivindicar minha sandbox Stripe" para gerar o link `onboarding_url` |
| Webhook Stripe | Configurado em `/api/webhook/stripe` | Se rodar em servidor próprio, configurar no dashboard Stripe |
| Email (recuperação de senha) | Não implementado (Google Auth não precisa) | — |

---

## 🚀 Rodar localmente

### Pré-requisitos
- Node 18+, Yarn
- Python 3.11+
- MongoDB rodando localmente (`mongodb://localhost:27017`)

### Backend
```bash
cd backend
cp .env.example .env    # ajuste as chaves
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```
Frontend em `http://localhost:3000`, backend em `http://localhost:8001`. O frontend usa `REACT_APP_BACKEND_URL` (em `frontend/.env`).

---

## 🔐 Variáveis de ambiente (backend/.env)

| Variável | Descrição |
|----------|-----------|
| `MONGO_URL` | String de conexão MongoDB |
| `DB_NAME` | Nome do banco |
| `CORS_ORIGINS` | Origens permitidas (use `*` em dev) |
| `EMERGENT_LLM_KEY` | Chave universal Emergent (OpenAI / Anthropic / Gemini) |
| `LLM_PROVIDER` | `openai` (padrão) |
| `LLM_MODEL` | `gpt-5.6-luna` (padrão). Outras: `gpt-5.6-terra`, `claude-sonnet-5`, `gemini-3.1-pro-preview` |
| `STRIPE_API_KEY` | Chave Stripe (test: `sk_test_emergent` já pré-injetada) |
| `STRIPE_WEBHOOK_SECRET` | Secret do webhook Stripe (opcional em dev) |
| `ADMIN_EMAIL` | Email admin (padrão `admin@roteira.com`) |
| `ADMIN_PASSWORD` | Senha admin |
| `JWT_SECRET` | Segredo para assinar JWT do admin |
| `FREE_MONTHLY_LIMIT` | Limite grátis (padrão 5) |
| `PREMIUM_MONTHLY_LIMIT` | Limite premium (padrão 100) |
| `PREMIUM_PRICE_BRL` | Preço mensal em BRL (padrão 5) |

---

## 🧑‍💼 Acesso Admin
1. Vá para `/login`
2. Clique em **Acesso administrador**
3. Login: `admin@roteira.com` / senha configurada em `.env`
4. Você será redirecionado para `/admin`

## 💳 Testar pagamento Stripe (sandbox)
- Cartão: `4242 4242 4242 4242`
- Validade: qualquer futura
- CVC: qualquer

## 🛠 Alterar preço e limites
Edite `backend/.env`:
```
FREE_MONTHLY_LIMIT=5
PREMIUM_MONTHLY_LIMIT=100
PREMIUM_PRICE_BRL=5
```
Reinicie o backend. Não precisa mexer em código.

---

## 📦 Deploy
Este projeto está pronto para deploy na plataforma Emergent — basta clicar em **Deploy** no dashboard. Para deploy em outros ambientes:

1. Suba `MongoDB` (Atlas ou self-hosted) e defina `MONGO_URL`
2. Configure variáveis de ambiente do backend (ver acima)
3. `frontend/.env` → `REACT_APP_BACKEND_URL=https://seu-backend-publico.com`
4. Build do frontend: `cd frontend && yarn build`
5. Sirva `frontend/build` estático + backend FastAPI atrás do mesmo domínio, roteando `/api/*` para o backend
6. Para Stripe em produção: reivindique sua sandbox pelo painel Emergent (peça ao agente o link `onboarding_url`) — após KYC, as chaves virarão automaticamente `sk_live_*` no próximo deploy.

---

## 🇧🇷 Interface 100% em português brasileiro.
