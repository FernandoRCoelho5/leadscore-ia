# Brasa

**Seus leads mais quentes, primeiro.**

A Brasa é um SaaS de qualificação de leads para pequenas e médias empresas de
serviços B2B. Cada contato que chega pelo formulário da empresa é analisado
pela Claude (Anthropic). Ele recebe uma nota de 0 a 100, a classificação
(quente, morno ou frio), a justificativa e uma resposta sugerida. O painel
mostra com quem falar primeiro.

O produto se chamava LeadScore IA. O repositório e os nomes técnicos continuam
`leadscore-ia`.

## O que o sistema faz

- **Formulário público** (`/f/[slug]`), que pode ir num iframe do site do
  cliente. Tem consentimento da LGPD e proteção contra spam: campo-armadilha,
  carimbo assinado e limites por IP.
- **Análise com IA em segundo plano.** O lead não espera a IA responder. A
  saída é validada com Zod, e cada empresa tem um limite mensal de análises.
- **Painel do cliente:**
  - leads com busca, filtros, ordenação, paginação e exportação CSV;
  - detalhe do lead com andamento, reanálise, exclusão lógica e anonimização
    (LGPD);
  - visão geral do mês;
  - membros da empresa, com convite por link;
  - perfil do negócio.
- **Administração da equipe Brasa:**
  - empresas: bloqueio, limite de análises e acesso auditado aos dados do
    cliente;
  - usuários: perfil de acesso e bloqueio;
  - auditoria, com filtros e CSV.
- **Perfis (RBAC):** `admin` e `suporte` são a equipe Brasa (o suporte só lê);
  `cliente` acessa só as empresas das quais é membro. A matriz completa está
  em [docs/arquitetura.md](docs/arquitetura.md#4-matriz-de-permissões-rbac).

## Tecnologias

| Camada | Escolha |
|---|---|
| Aplicação | Next.js 16 (App Router), React 19, TypeScript estrito |
| Interface | Tailwind CSS 4, tokens da identidade Brasa, ícones `lucide-react` |
| Banco | Neon Postgres (São Paulo), Drizzle ORM, migrations versionadas |
| Autenticação | Better Auth (e-mail e senha, sessões no banco) |
| IA | Claude API, modelo `claude-haiku-4-5-20251001`, com modo simulado (mock) |
| Arquivos | Vercel Blob privado (fotos de perfil) |
| Testes | Vitest + PGlite (Postgres em memória) e Playwright |
| Deploy | Vercel (região `gru1`) |

## Como rodar localmente

Pré-requisitos: Node.js 24 (versão em `.nvmrc`) e um banco no Neon, de
preferência uma branch só para desenvolvimento.

```bash
npm ci
cp .env.example .env.local     # preencha os valores (veja abaixo)
npm run db:verificar           # confere a conexão (somente leitura)
npm run db:migrar              # aplica as migrations
npm run seed                   # dados de demonstração (opcional)
npm run dev                    # http://localhost:3000
```

### Variáveis de ambiente

Os valores ficam só no `.env.local`, que nunca vai para o Git. O modelo
comentado é o [.env.example](.env.example).

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Conexão com pooling da branch do Neon |
| `BETTER_AUTH_SECRET` | sim | Segredo das sessões (32+ caracteres: `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | sim, fora dos previews | Endereço público do app |
| `IA_MODO` | não (`mock`) | `mock` simula a IA sem custo; `real` usa a Claude API |
| `ANTHROPIC_API_KEY` | com `IA_MODO=real` | Chave da Claude API |
| `RESEND_API_KEY`, `EMAIL_REMETENTE` | não | E-mails de senha e de convite; sem a chave, em desenvolvimento o e-mail aparece no terminal |
| `BLOB_READ_WRITE_TOKEN` | não | Fotos de perfil; sem ele, o envio de foto fica indisponível |
| `SEED_SENHA_DEMO` | não | Senha dos usuários de demonstração do seed |

### Dados de demonstração

O `npm run seed` só insere dados e pode rodar várias vezes. O que já existe é
mantido. Ele cria:

| Conta | Perfil | Empresa |
|---|---|---|
| `admin@demo.brasa.example` | admin | (equipe Brasa) |
| `suporte@demo.brasa.example` | suporte | (equipe Brasa) |
| `cliente@demo.brasa.example` | cliente | Norte Digital (12 leads) |
| `vendas@demo.brasa.example` | cliente | Norte Digital |
| `contabil@demo.brasa.example` | cliente | Horizonte Contábil (4 leads) |

A senha é a de `SEED_SENHA_DEMO`. Sem ela, o seed mostra uma senha aleatória
por usuário uma única vez no terminal. O formulário público da demonstração
fica em `/f/demo`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run verificar` | Tudo o que o CI confere: formatação, lint, tipos, testes com cobertura e build |
| `npm test` | Testes unitários e de integração (Vitest + PGlite, sem banco externo) |
| `npm run test:e2e` | Testes de ponta a ponta (Playwright, no build de produção) |
| `npm run db:verificar` | Confere a conexão e as migrations aplicadas (somente leitura) |
| `npm run db:gerar` / `npm run db:migrar` | Gera a migration a partir do schema / aplica as pendentes |
| `npm run seed` | Dados de demonstração |
| `npm run ia:avaliar` | Avalia o motor de IA com leads de exemplo (mock; `--confirmar` usa a API real) |

### Migrations

Fluxo obrigatório:

1. Altere o schema em `src/db/schema.ts`.
2. Rode `npm run db:gerar`.
3. **Revise o SQL gerado** em `drizzle/`: não pode ter `DROP` nem `TRUNCATE`.
4. Rode `npm run db:migrar`.

Não use `drizzle-kit push`. Nenhuma tabela ou registro é apagado: exclusão é
lógica (`deleted_at`), e a LGPD é atendida por anonimização.

### Testes

- **Unitários e de integração** (`tests/unit`, `tests/integracao`): rodam num
  Postgres em memória (PGlite) com as mesmas migrations do Neon. Cobrem
  permissões, isolamento entre empresas, anonimização, limites e o motor de IA
  com o SDK simulado. Também conferem, pelo `EXPLAIN`, se as consultas do
  painel usam os índices com milhares de leads.
- **E2E** (`tests/e2e`): rodam no build de produção. Os que precisam de banco
  só rodam com `E2E_COM_BANCO=1`; no CI, usam a branch `e2e` do Neon, que é
  preparada por `npm run db:preparar-e2e`. Cada teste cria os próprios dados,
  com e-mails `.example`. Incluem uma verificação de acessibilidade de todas
  as telas, no computador e no celular.

## Estrutura

```
src/
  app/          rotas (páginas, Server Actions e rotas de API em app/api)
  components/   interface (ui, layout, leads, painel, admin, membros, marca)
  server/       código só do servidor: services (regras + RBAC + auditoria),
                repositories (Drizzle), auth, ia, seguranca, http
  lib/          validações Zod e utilitários compartilhados
  db/           schema do Drizzle
drizzle/        migrations versionadas
tests/          unit, integracao, e2e
docs/           arquitetura, decisões (D-001...), identidade visual
```

## Documentação

- [Arquitetura](docs/arquitetura.md): camadas, modelo de dados, RBAC e fluxos.
- [Registro de decisões](docs/decisoes.md): cada escolha, com as alternativas
  descartadas.
- [Identidade visual](docs/identidade-visual.md): tokens, cores, logo e
  componentes.

## Segurança e privacidade

- Segredos só em variáveis de ambiente.
- CSP com nonce e cabeçalhos de segurança.
- Rate limiting no banco.
- IP guardado só como HMAC.
- A IA não recebe nome, e-mail nem telefone do lead.
- Ações sensíveis vão para a auditoria, sem dados pessoais.
- Cada entrega passa por uma análise do OWASP Top 10, registrada no pull
  request da etapa.

---

Projeto acadêmico da FAETERJ Barra Mansa (2026).
