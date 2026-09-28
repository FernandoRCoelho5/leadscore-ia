# Registro de decisões

Decisões de produto e de arquitetura do LeadScore IA, com contexto, decisão,
alternativas consideradas e consequências. A descrição técnica completa está em
[arquitetura.md](arquitetura.md).

Formato de cada registro: **Contexto** (o problema), **Decisão** (o que foi
escolhido), **Alternativas** (o que foi descartado e por quê) e
**Consequências** (o que muda a partir daqui).

---

## Decisões de produto (Etapa 0, 24/09/2026)

| Tema | Decisão |
|---|---|
| Público-alvo inicial | Empresas de serviços B2B: agências, consultorias, software houses e contabilidades. |
| Escopo da entrega acadêmica (06/10/2026) | Etapas 1 a 7 obrigatórias; a meta é concluir as 9 etapas, incluindo o deploy na Vercel. |
| Perfis | `admin` e `suporte` pertencem à equipe dona do SaaS e enxergam todas as empresas; `cliente` é o usuário da empresa contratante e só enxerga a própria. |
| Criação de conta | Cadastro aberto, seguido de onboarding da empresa e do perfil do negócio. |
| Usuário × empresa | O banco aceita vários vínculos (N:N); a interface trabalha com uma empresa ativa. |
| "Alterar perfil" no menu do avatar | Editar os próprios dados: nome, foto e senha. |
| Análise do lead | Em segundo plano; o lead não espera a IA. |
| Limite de análises | Limite mensal por empresa, configurável pelo `admin`. |
| Chave da Anthropic | Ainda sem créditos; desenvolvimento em modo mock, testes reais ao final. |
| Nome e identidade visual | A definir até a Etapa 4. |

---

## D-001 · Monólito modular em camadas

**Contexto.** O produto começa pequeno, com prazo curto, mas será vendido e
precisa crescer sem reescrita. O código também precisa ser explicável numa
arguição.

**Decisão.** Uma única aplicação Next.js organizada em camadas: interface
(`src/app`), serviços com as regras de negócio (`src/server/services`),
repositórios de acesso a dados (`src/server/repositories`) e adaptadores para
serviços externos (`src/lib/*`). Nenhuma regra de negócio fica em componentes
ou rotas. Serviços externos são acessados por interfaces com implementações
trocáveis (IA real ou mock, e-mail pelo console ou pelo Resend, rate limit no
Postgres ou no Redis). O código de servidor importa `server-only`.

**Alternativas.** Microsserviços ou backend separado: mais infraestrutura,
latência e custo, sem benefício no volume atual. Código "tudo na rota": mais
rápido no início, mas difícil de testar e de proteger.

**Consequências.** Regras testáveis sem HTTP; troca de fornecedor sem mexer em
regra de negócio. Exige disciplina para não pular camadas.

## D-002 · Multiempresa com banco compartilhado e `empresa_id`

**Contexto.** Várias empresas usam o mesmo sistema e uma nunca pode ver dados
da outra.

**Decisão.** Um banco e um schema compartilhados, com `empresa_id` em todas as
tabelas de dados de clientes. Toda função de repositório exige `empresaId` como
parâmetro e filtra `deleted_at IS NULL`. Testes de integração tentam acessar
dados de outra empresa e devem falhar.

**Alternativas.** Um banco ou schema por empresa: isolamento físico, mas
migrations e custo multiplicados. Row-Level Security do Postgres: defesa extra
valiosa, porém complexa com o driver HTTP do Neon; fica como evolução.

**Consequências.** Isolamento depende da camada de repositório estar correta,
por isso ela é coberta por testes específicos.

## D-003 · Convenções do modelo de dados

**Contexto.** O produto guardará dados de clientes; nada pode ser apagado e as
consultas precisam escalar.

**Decisão.** Chave primária UUID v7 gerada pela aplicação; `created_at`,
`updated_at` e `deleted_at` em todas as tabelas; exclusão lógica; chaves
estrangeiras com `ON DELETE RESTRICT` e nunca `CASCADE`; unicidade entre
registros ativos com índices parciais; nomes em português e `snake_case`.
A análise mais recente é copiada no lead (`score_atual`, `classificacao_atual`)
para listar e filtrar sem JOIN; o histórico completo fica em `analises`, que
nunca é atualizada.

**Alternativas.** Chave serial: expõe a quantidade de registros e facilita
adivinhar IDs (IDOR). UUID v4: aleatório, piora a localidade dos índices em
tabelas grandes. Exclusão física: proibida pelas regras do projeto.

**Consequências.** Toda consulta precisa lembrar do filtro `deleted_at`, que
fica centralizado nos repositórios.

## D-004 · Papéis e permissões definidos em código

**Contexto.** São três papéis fixos (`admin`, `suporte`, `cliente`) e o controle
de acesso precisa ser confiável e auditável.

**Decisão.** A matriz de permissões fica em `src/server/auth/permissoes.ts`,
tipada e versionada no Git. Os serviços chamam `autorizar(sessao, acao, recurso)`
antes de qualquer operação; a interface usa a mesma matriz apenas para esconder
itens. O papel de plataforma fica em `usuarios.papel_plataforma` e o papel na
empresa em `membros_empresa.papel`. O `suporte` é somente leitura. A matriz
completa está em [arquitetura.md](arquitetura.md#4-matriz-de-permissões-rbac).

**Alternativas.** Tabelas de perfis e permissões no banco: flexível, mas só
compensa se clientes precisarem criar papéis próprios.

**Consequências.** Mudar uma permissão exige deploy. Cada combinação
papel × ação é coberta por teste unitário.

## D-005 · Autenticação com Better Auth, só para autenticar

**Contexto.** Cadastro aberto, login com e-mail e senha, troca e redefinição de
senha, com os dados no nosso banco.

**Decisão.** Usar a biblioteca Better Auth (licença MIT, sem custo) com o
adaptador do Drizzle, restrita à autenticação: cadastro, login, sessão em cookie
httpOnly, troca e redefinição de senha. Multiempresa, convites e RBAC são código
nosso. Os plugins de organização e de admin **não** são usados, porque
gerenciam membros e convites com as próprias regras de exclusão, que não
conhecem o nosso `deleted_at`.

**Alternativas.**

| Opção | Por que não |
|---|---|
| Neon Auth (Better Auth gerenciado) | Em beta; preço após o lançamento ainda não publicado; maior dependência da Neon. |
| Clerk | Grátis até 50 mil usuários/mês, mas recursos B2B são add-ons pagos, os dados ficam nos EUA (transferência internacional pela LGPD) e os usuários ficam fora do nosso banco. |
| Auth.js v5 | Desde setembro de 2025 só recebe correções de segurança; a própria equipe recomenda Better Auth para projetos novos. |

**Consequências.** Nós construímos as telas de autenticação e o envio de
e-mails (D-011). Controle total sobre dados e regras.

## D-006 · Exceção à exclusão física: `sessoes` e `verificacoes`

**Contexto.** A regra do projeto proíbe exclusão física de registros. Toda
solução de autenticação que guarda sessões no banco apaga fisicamente a sessão
no logout ou na expiração, e apaga o token de verificação depois de usado.

**Decisão.** Exceção **autorizada explicitamente pelo responsável em
24/09/2026**, restrita às tabelas técnicas `sessoes` e `verificacoes`, que não
contêm dados de negócio. Logins e logouts ficam registrados na tabela
`auditoria`. Todas as demais tabelas seguem a exclusão lógica.

**Alternativas.** Transformar essas exclusões em exclusão lógica dentro da
biblioteca: exigiria alterar o caminho de validação de sessão, com risco de uma
sessão encerrada continuar válida. Clerk: evitaria o conflito guardando as
sessões fora do nosso banco, com as desvantagens descritas em D-005.

**Consequências.** A exceção fica documentada aqui e não se estende a nenhuma
outra tabela.

## D-007 · Análise da IA em segundo plano com `after()`

**Contexto.** A análise leva alguns segundos e pode falhar; o lead não deve
esperar nem perder o envio por causa disso.

**Decisão.** O formulário grava o lead com `status_analise = pendente`, responde
imediatamente e agenda a análise com `after()`, função nativa do Next.js que
roda depois que a resposta é enviada. Falhas deixam o lead como `falhou`, com
botão de reanálise no painel.

**Alternativas.** Análise síncrona: o lead espera e uma falha da IA atrapalha a
captação. Fila externa (Inngest, QStash): mais robusta, mas é serviço novo com
custo; fica como evolução.

**Consequências.** Se a função for interrompida, o lead fica pendente e precisa
de reanálise manual. Uma fila ou rotina agendada resolve isso no futuro.

## D-008 · Limite mensal de análises por empresa

**Contexto.** Cada análise tem custo na API da Anthropic e o formulário é
público; sem limite, spam vira prejuízo. O limite também prepara planos pagos.

**Decisão.** `empresas.limite_analises_mes` (padrão 100, editável pelo `admin`)
e a tabela `uso_mensal`. Um único `UPDATE ... WHERE analises < limite RETURNING`
confere e consome o limite atomicamente, sem condição de corrida. Esgotado o
limite, o lead é salvo com `status_analise = limite_atingido`.

**Alternativas.** Contar as linhas de `analises` a cada envio: mais lento e
sujeito a corrida. Sem limite: risco financeiro.

**Consequências.** A tabela `uso_mensal` também registra tokens, servindo de
base para cobrança.

## D-009 · Rate limiting e anti-spam no formulário público

**Contexto.** O formulário é público e cada envio pode gerar custo de IA.

**Decisão.** Três camadas sem serviço novo:

1. Contador no Postgres (`limites_taxa`) com atualização atômica. Limites
   iniciais: 5 envios a cada 10 minutos por IP em cada formulário e 300 por
   hora por formulário (ajustáveis na Etapa 6).
2. Campo-armadilha invisível e tempo mínimo de preenchimento.
3. Limite mensal de análises (D-008).

O rate limit fica atrás da interface `RateLimiter`. O Cloudflare Turnstile fica
preparado e desligado por variável de ambiente.

**Alternativas.** Upstash Redis (grátis até 500 mil comandos/mês): mais rápido,
mas é conta e segredo novos; adotável sem mudar regras. Turnstile ligado desde
já: script externo e ajuste de CSP sem necessidade comprovada.

**Consequências.** Uma escrita a mais no banco por envio. O IP nunca é gravado
puro: só um hash (HMAC) com segredo.

## D-010 · Migrations versionadas, sem `drizzle-kit push`

**Contexto.** O banco terá dados de clientes e nenhuma tabela pode ser apagada.

**Decisão.** `drizzle-kit generate` para gerar o SQL, revisão manual (qualquer
`DROP`, `TRUNCATE` ou operação destrutiva interrompe o processo e vai para o
responsável) e `drizzle-kit migrate` para aplicar.

**Alternativas.** `drizzle-kit push`: aplica direto, sem SQL revisável, e pode
propor exclusões.

**Consequências.** O histórico de migrations fica versionado em `/drizzle`.

## D-011 · Serviços externos: Resend e Vercel Blob

**Contexto.** Redefinição de senha e verificação de e-mail exigem envio de
e-mails; a foto do perfil exige armazenamento de arquivos.

**Decisão.**

- **E-mail:** Resend (grátis até 3.000 e-mails/mês, 100 por dia), atrás de um
  adaptador. Em desenvolvimento, o link é impresso no terminal. Em produção,
  requer domínio próprio verificado.
- **Arquivos:** Vercel Blob (no plano Hobby, grátis até 1 GB, sem cobrança de
  excedente) para a foto do perfil, com limite de tamanho e validação do tipo
  real do arquivo. Sem foto, o avatar mostra as iniciais.

**Alternativas.** Foto no Postgres (bytea): simples, mas pesa no banco e no
backup. SendGrid ou Postmark: equivalentes, sem vantagem no volume atual.

**Consequências.** Duas contas e dois segredos novos, adotados nas Etapas 4 e 9.

## D-012 · LGPD por anonimização

**Contexto.** Pedidos de eliminação de dados pela LGPD precisam ser atendidos
sem exclusão física.

**Decisão.**

- **Lead:** `nome` vira "Titular anonimizado"; `email`, `telefone`,
  `empresa_nome` e `ip_hash` ficam nulos; `mensagem` vira "[removido a pedido do
  titular]"; `justificativa` e `resposta_sugerida` de todas as análises dele
  viram "[removido]". Mantêm-se segmento, status, score, classificação e datas,
  para estatística. Grava `anonimizado_em` e um registro de auditoria sem dados
  pessoais. É irreversível e exige confirmação digitada.
- **Usuário:** `nome` vira "Usuário removido"; o e-mail vira
  `removido+<id>@anonimizado.invalid` (mantém a unicidade); a foto é
  desvinculada; o login é bloqueado, as sessões são revogadas e os vínculos
  recebem `deleted_at`.

**Alternativas.** Exclusão física: proibida pelas regras do projeto. Apenas
marcar como excluído: não atende a LGPD, porque os dados pessoais continuariam
guardados.

**Consequências.** CSVs exportados antes da anonimização ficam fora do alcance
do sistema; a política de privacidade informará isso.

## D-013 · Estratégia de testes

**Contexto.** Isolamento entre empresas, permissões e o motor de IA precisam de
garantia automática.

**Decisão.**

| Tipo | Ferramenta | Cobertura |
|---|---|---|
| Unitário | Vitest | Schemas Zod, matriz RBAC completa, motor de IA com o SDK simulado (JSON inválido, erros 429/529, timeout, sucesso), CSV, UUID v7 |
| Integração | Vitest + PGlite (Postgres em memória, descartado a cada execução) | Repositórios e serviços: isolamento entre empresas, `deleted_at`, paginação, limite mensal atômico, anonimização |
| E2E | Playwright | Cadastro, onboarding, formulário público, análise (mock), painel e restrições por perfil, na branch `e2e` do Neon; cada execução cria dados com identificador único e só insere |
| CI | GitHub Actions | Lint, tipos, testes, build e `npm audit` em todo PR; E2E em job separado |

Meta de cobertura: 80% em serviços, RBAC e IA.

**Alternativas.** Testes de integração numa branch do Neon: exigiriam segredo
no CI e limpeza de dados (exclusão), que as regras proíbem. Postgres em Docker:
exige Docker instalado na máquina de desenvolvimento.

**Consequências.** O PGlite é Postgres real compilado para WebAssembly, mas
pode diferir do Neon em extensões; os testes E2E cobrem essa diferença.

## D-014 · Escalabilidade

**Contexto.** O número de empresas, usuários e leads vai crescer.

**Decisão.**

- Índices parciais (`WHERE deleted_at IS NULL`) nas colunas de filtro e
  ordenação, e índice GIN com `pg_trgm` para a busca textual (lista completa em
  [arquitetura.md](arquitetura.md#índices-planejados)).
- Paginação no servidor com no máximo 100 itens por página (offset). Se uma
  empresa passar de cerca de 100 mil leads, a paginação migra para cursor.
- Exportação CSV em streaming, em lotes de 1.000 registros por cursor, com teto
  de linhas; nada é carregado inteiro na memória.
- Indicadores calculados no SQL (`GROUP BY`), nunca em memória; cache por
  empresa só se as medições mostrarem necessidade.
- Aplicação e banco na mesma região (São Paulo), com pooling de conexões.

**Alternativas.** Paginação por cursor desde o início: escala melhor, mas não
permite "ir para a página N", útil ao vendedor. Carregar e filtrar em memória:
proibido pelas regras do projeto.

**Consequências.** A tabela `auditoria` pode precisar de particionamento por mês
no futuro.

## D-015 · Infraestrutura e custos

**Contexto.** Deploy na Vercel e banco no Neon, com usuários no Brasil.

**Decisão.** Vercel na região `gru1` e Neon na `sa-east-1`, ambas em São Paulo.
Branches do Neon: `main` (produção), desenvolvimento e `e2e`.

**Consequências.** O plano Hobby da Vercel não permite uso comercial: serve para
a entrega acadêmica, mas a venda exige o plano Pro (US$ 20 por mês por membro).
O checklist de produção fica na Etapa 9.

## D-016 · Content Security Policy com nonce

**Contexto.** A CSP é a principal defesa do navegador contra XSS: diz de onde
scripts e estilos podem vir. O Next.js injeta scripts inline, então uma CSP
restritiva precisa de um mecanismo para autorizá-los.

**Decisão.** O `src/proxy.ts` gera um nonce aleatório a cada requisição e monta a
CSP; o Next.js aplica o nonce nos próprios scripts. Em produção:
`script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src-elem 'self' 'nonce-…'`,
`style-src-attr 'unsafe-inline'`, `img-src`/`font-src`/`connect-src 'self'`,
`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
`frame-ancestors 'none'` e `upgrade-insecure-requests` (só em HTTPS). O layout
raiz chama `connection()` para que toda página seja renderizada por requisição.
Os demais cabeçalhos (HSTS, nosniff, Referrer-Policy, Permissions-Policy,
X-Frame-Options, COOP) ficam no `next.config.ts`, e a API responde com
`Cache-Control: no-store`.

Atributos `style="..."` são liberados (`style-src-attr`) porque o `next/image` e
as bibliotecas de gráfico os usam. Eles não executam código, e vazar dados por
CSS exigiria carregar recursos externos, que `img-src`, `font-src` e
`connect-src 'self'` bloqueiam. Tags `<style>` e scripts continuam exigindo o nonce.

**Alternativas.** CSP sem nonce com `'unsafe-inline'`: anula a proteção contra
XSS. Hashes (Subresource Integrity, experimental no Next.js): permitiria páginas
estáticas, mas ainda é experimental. Hashes específicos com `'unsafe-hashes'`
para os estilos: quebraria a cada estilo dinâmico de bibliotecas.

**Consequências.** Nenhuma página é gerada estaticamente no build, o que é
aceitável porque o painel já é dinâmico por usuário. Scripts de terceiros (ex.:
Turnstile) exigirão incluir o domínio na CSP. Na Etapa 6, `frame-ancestors`
será aberto apenas para `/f/[slug]`. Um teste E2E falha se qualquer violação de
CSP aparecer no console.

## D-017 · Formato único de erro e requestId

**Contexto.** Rotas e Server Actions precisam responder erros de forma
previsível para a interface, sem vazar detalhes internos (pilha, SQL, nomes de
tabelas).

**Decisão.** Serviços lançam erros de domínio (`src/lib/erros.ts`: validação,
não autenticado, proibido, não encontrado, conflito, limite excedido).
`comTratamentoDeErros()` (Route Handlers) e `executarAcao()` (Server Actions)
convertem qualquer erro em
`{ erro: { codigo, mensagem, detalhes?, requestId } }`. Erros inesperados viram
`INTERNO` com mensagem genérica; o detalhe vai para o log estruturado em JSON,
que oculta senhas, tokens e dados pessoais. O `requestId` volta no cabeçalho
`x-request-id` e liga a resposta à linha do log. Recursos de outra empresa
respondem 404, e não 403, para não revelar que existem.

**Alternativas.** Deixar cada rota tratar os próprios erros: formatos
divergentes e risco de vazar `error.message` do banco. Usar a página de erro
padrão do Next.js na API: responde HTML em vez de JSON.

**Consequências.** Nenhuma rota precisa de `try/catch` próprio. Rotas de API
inexistentes também respondem 404 no mesmo formato.

## D-018 · Cadeia de suprimentos (dependências e CI)

**Contexto.** Dependências e automações de CI são uma porta de entrada comum
para ataques (OWASP A06 e A08).

**Decisão.**

- O CI roda em todo PR: formatação, lint, tipos, testes com cobertura mínima de
  80%, build, E2E e `npm audit` (falha em vulnerabilidade alta ou crítica).
- As actions do GitHub são fixadas pelo SHA do commit; o workflow tem só
  permissão de leitura e não guarda credenciais do checkout.
- `npm ci` instala exatamente o que está no `package-lock.json`.
- O npm 11 bloqueia scripts de instalação não aprovados. O script do
  `unrs-resolver` (dependência do ESLint) **não** foi aprovado: ele só baixa um
  binário alternativo, e o binário nativo já vem instalado.
- O Dependabot abre PRs semanais de atualização.

**Alternativas.** Actions por tag (`@v7`): mais simples, mas a tag pode ser
movida para código malicioso.

**Consequências.** Atualizar uma action exige atualizar o SHA (o Dependabot faz
isso automaticamente).

---

## Fontes consultadas (24/09/2026)

- [Preços do Clerk](https://clerk.com/pricing)
- [Auth.js agora faz parte do Better Auth](https://better-auth.com/blog/authjs-joins-better-auth)
- [Neon Auth (Better Auth gerenciado)](https://neon.com/docs/auth/overview)
- [Preços do Upstash Redis](https://upstash.com/docs/redis/overall/pricing)
- [Preços do Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Preços do Resend](https://resend.com/docs/knowledge-base/what-is-resend-pricing)
