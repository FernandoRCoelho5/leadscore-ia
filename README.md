# Brasa

**Seus leads mais quentes, primeiro.**

A Brasa é um SaaS de qualificação de leads para pequenas e médias empresas de
serviços B2B. Cada contato que chega pelo formulário da empresa é analisado
pela Claude (Anthropic). Ele recebe uma nota de 0 a 100, a classificação
(quente, morno ou frio), a justificativa e uma resposta sugerida. O painel
mostra com quem falar primeiro.

O produto se chamava LeadScore IA. O repositório e os nomes técnicos continuam
`leadscore-ia`.

| | |
|---|---|
| **Aplicação no ar** | <https://leadscore-ia.vercel.app> |
| **Repositório** | <https://github.com/FernandoRCoelho5/leadscore-ia> |
| **Instituição** | FAETERJ Barra Mansa, 2026 |
| **Disciplina** | Programação para Dispositivos Móveis e Inteligência Artificial |
| **Autores** | Fernando Ramos Coelho (Turma 304) e Ryan Benedito (Turma 304) |

## Como avaliar o projeto

O caminho mais curto para ver o sistema funcionando, com a IA real:

1. Acesse <https://leadscore-ia.vercel.app/cadastro> e crie uma conta.
2. No passo seguinte, descreva uma empresa fictícia: o que ela faz e o
   cliente ideal. É com isso que a IA dá a nota.
3. Abra o formulário público da empresa: `https://leadscore-ia.vercel.app/f/<endereço escolhido>`.
   Envie dois ou três contatos diferentes, por exemplo um cliente com
   orçamento e prazo e um pedido de estágio.
4. Volte ao painel em **Leads**. Em poucos segundos cada lead aparece com nota,
   classificação, justificativa e resposta sugerida.
5. No detalhe do lead, experimente mudar o andamento, analisar de novo,
   exportar CSV e, no menu do avatar, alterar nome, foto e senha.

Em 05/10/2026 esse roteiro foi executado em produção: um lead de indústria
com orçamento aprovado recebeu 92 (quente), uma clínica sem prazo recebeu 45
(morno) e um pedido de estágio recebeu 5 (frio). As quatro análises custaram
cerca de US$ 0,02.

As telas de administração (empresas, usuários e auditoria) exigem o perfil
`admin` ou `suporte`, que não pode ser obtido pelo cadastro. Para vê-las,
rode o projeto localmente com os dados de demonstração (seção
[Dados de demonstração](#dados-de-demonstração)).

## Como a IA funciona

O motor fica em `src/server/ia/` e as decisões estão em
[D-027](docs/decisoes.md#d-027--motor-de-ia-saída-estruturada-dados-mínimos-e-custo-controlado).

1. O visitante envia o formulário. O lead é gravado e a resposta volta na
   hora; a análise roda depois, com `after()` do Next.js.
2. O prompt leva o perfil do negócio (o que a empresa faz, cliente ideal,
   ticket médio, regiões) e, do lead, só empresa, segmento, mensagem e origem.
   **Nome, e-mail e telefone não vão para a IA** (minimização da LGPD).
3. O modelo `claude-haiku-4-5-20251001` (temperatura 0) devolve JSON com
   **saída estruturada**: nota de 0 a 100, justificativa e resposta sugerida.
4. Antes de salvar, o JSON é validado de novo com **Zod**
   (`src/server/ia/schema.ts`). Se vier fora do formato, há nova tentativa.
5. A classificação é calculada pelo app, não pela IA: 70 ou mais é quente,
   40 a 69 é morno, abaixo de 40 é frio.

Outros cuidados:

- **Prompt injection:** o texto do visitante vai delimitado e é tratado como
  dado. A IA não tem ferramentas nem acesso ao banco: o pior caso é uma nota
  errada.
- **Custo:** limite mensal de análises por empresa (100 por padrão), consumido
  de forma atômica. Cada análise custa menos de meio centavo de dólar.
- **Sem créditos ou em testes:** `IA_MODO=mock` usa um motor simulado com o
  mesmo contrato (`MotorDeAnalise`), sem custo e sem rede.
- **Avaliação:** `npm run ia:avaliar` roda 12 leads fictícios com a
  classificação esperada, incluindo spam e uma tentativa de prompt injection.

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
| Deploy | Vercel (região `gru1`), com as migrations aplicadas no build ([guia](docs/implantacao.md)) |

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
| `PRIVACIDADE_RESPONSAVEL`, `PRIVACIDADE_CONTATO` | o contato, em produção | Quem responde pelos dados e o e-mail dos titulares, na política de privacidade |
| `SEED_SENHA_DEMO` | não | Senha dos usuários de demonstração do seed |

### Dados de demonstração

O `npm run seed` só insere dados e pode rodar várias vezes. O que já existe é
mantido. Ele recusa bancos de produção (`VERCEL_ENV=production` ou contas com
e-mail real). Ele cria:

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
| `npm run db:implantar` | Aplica as migrations no build da Vercel (só em `production` e `preview`) |
| `npm run admin:promover -- <e-mail>` | Promove a primeira conta de admin da plataforma |
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
- [Implantação](docs/implantacao.md): variáveis por ambiente, primeiro
  admin, verificação depois do deploy e rollback.

## Qualidade

Números de 05/10/2026, na branch `main`:

- **543 testes** unitários e de integração em 34 arquivos, todos passando.
- **Cobertura de 89,5%** das linhas.
- **56 testes E2E** no CI (Playwright), incluindo acessibilidade em
  1024, 768 e 390 px de largura.
- O CI do GitHub roda formatação, lint, tipos, testes com cobertura, build e
  E2E com banco em cada pull request; o Dependabot acompanha as dependências.

## Histórico de desenvolvimento

O projeto foi feito em etapas, cada uma num pull request revisado pela dupla
e com uma análise do OWASP Top 10:

| Etapa | Entrega | PR |
|---|---|---|
| 1 | Arquitetura e registro de decisões | #1 |
| 2 | Fundação: Next.js, TypeScript estrito, CI, cabeçalhos de segurança | #2 |
| 3 | Banco de dados (Drizzle + Neon), repositórios e seed | #3 |
| — | Identidade visual Brasa (cores, logo, tokens) | #4 |
| 4 | Autenticação, RBAC, layout da área logada e foto de perfil | #5 |
| 5 | Motor de IA com a Claude API | #6 |
| 6 | Formulário público de captação, anti-spam e LGPD | #7 |
| 7 | Painel do cliente e administração da equipe Brasa | #8 |
| 8 | Qualidade, membros, convites, perfis de acesso e E2E | #9 |
| 9 | Implantação na Vercel e primeiro admin | #10, #11 |

As 31 decisões técnicas (D-001 a D-031), com as alternativas descartadas,
estão em [docs/decisoes.md](docs/decisoes.md).

## Segurança e privacidade

- Segredos só em variáveis de ambiente.
- CSP com nonce e cabeçalhos de segurança.
- Rate limiting no banco.
- IP guardado só como HMAC.
- A IA não recebe nome, e-mail nem telefone do lead.
- Ações sensíveis vão para a auditoria, sem dados pessoais.
- [Política de privacidade](src/app/politica-de-privacidade/page.tsx) pública
  em `/politica-de-privacidade`.
- Cada entrega passa por uma análise do OWASP Top 10, registrada no pull
  request da etapa.

---

Projeto acadêmico da FAETERJ Barra Mansa (2026), disciplina de Programação
para Dispositivos Móveis e Inteligência Artificial. Autores: Fernando Ramos
Coelho e Ryan Benedito (Turma 304).
