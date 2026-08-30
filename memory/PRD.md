# Roteira — PRD

## Problem Statement (Original)
SaaS chamado Roteira para geração de roteiros de vídeos curtos (TikTok/Reels/Shorts) com IA, em pt-BR. Login Google, plano free (5/mês) vs Premium R$5/mês (100/mês) via Stripe, admin panel, histórico, landing page completa.

## Personas
- **Criador iniciante:** quer virar viral, trava no roteiro
- **Criador profissional:** produz alto volume, precisa 100+ roteiros/mês
- **Admin:** monitora usuários, receita, roteiros gerados

## Core Requirements (Static)
- IA real (não mock) — GPT-5.6 via Emergent LLM Key
- Auth Google + admin credenciado
- Limite backend (não frontend-only)
- Stripe recorrente (sandbox: pagamento único ativa 30d premium)
- Admin protegido

## Implementado (2026-02)
- Landing responsiva dark/neon (Unbounded + Manrope), hero + marquee + como funciona + benefícios + exemplos + FAQ + CTA
- Auth: Emergent Google OAuth + JWT admin (`admin@roteira.com` / `Luc@s1103445`)
- Gerador com 6 campos + IA GPT-5.6-luna → JSON estruturado (hook, cenas, narração, prompts imagem, título, descrição, hashtags, CTA)
- Persistência scripts + usage por mês em MongoDB
- Dashboard usuário: uso, plano, atalho gerador, últimos roteiros
- História: listar/abrir/copiar/excluir
- Pricing R$5/mês com Stripe Checkout (via emergentintegrations sandbox)
- Admin: stats + tabela de usuários
- README + `.env.example` completos

## Prioritized Backlog (P1/P2)
- **P1 Stripe subscription real** — reivindicar sandbox (`onboarding_url`) para recorrência nativa
- **P1 Streaming da IA** — melhorar UX com tokens em tempo real via SSE
- **P2 Compartilhamento público** de roteiros
- **P2 Regenerar apenas 1 cena**
- **P2 Export PDF/Notion**
- **P2 A/B de hooks**
