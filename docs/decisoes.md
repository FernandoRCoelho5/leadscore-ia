# Registro de decisões

Decisões de produto e de arquitetura da Brasa (antes LeadScore IA), com contexto, decisão,
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
O Blob foi adotado na Etapa 4 como store **privado**; detalhes em D-024.

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
Branches do Neon: `production` (a principal, exclusiva da Vercel),
desenvolvimento e `e2e` (D-025).

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

## D-019 · Driver do banco e repositórios com a conexão por parâmetro

**Contexto.** Algumas operações precisam ser atômicas (gravar a análise e
atualizar a cópia no lead; criar a empresa e o vínculo do usuário), e os
repositórios precisam ser testados sem tocar no banco real.

**Decisão.** Em produção, o `Pool` do `@neondatabase/serverless` (WebSocket),
que suporta transações (`db.transaction`). O Node 24 já tem `WebSocket` nativo,
sem dependência extra. Os repositórios recebem a conexão como primeiro
parâmetro, com o tipo comum `BancoDeDados`; nos testes, recebem um PGlite com as
mesmas migrations. Em desenvolvimento, o pool fica no `globalThis` para não
abrir um novo a cada recarga do Next.js. IDs malformados respondem "não
encontrado" em vez de erro do banco.

**Alternativas.** Driver HTTP do Neon (`neon()`): um pouco mais rápido por
consulta, mas sem transações interativas (só lotes). Repositórios importando a
conexão global: mais simples, porém impossíveis de testar sem banco real.

**Consequências.** Toda função de repositório tem a forma
`funcao(db, empresaId, ...)`, o que também deixa explícito o escopo da empresa.

## D-020 · Regras de dados verificadas pelo ESLint

**Contexto.** As regras "não apagar registros" e "não montar SQL com texto
concatenado" dependiam só de disciplina.

**Decisão.** O ESLint acusa erro em `db.delete`, `tx.delete` (exclusão física)
e `sql.raw` (SQL sem escape) em `src/` e `scripts/`. Consultas usam o query
builder do Drizzle ou o template `sql` (valores sempre parametrizados). Buscas
com `ILIKE` escapam os curingas `%` e `_` digitados pelo usuário.

**Alternativas.** Revisão manual de código: sujeita a esquecimento.

**Consequências.** O CI reprova um PR que tente excluir fisicamente ou usar
`sql.raw`. Se algum dia for indispensável, a exceção precisa ser explícita e
justificada no código.

## D-021 · Vulnerabilidade moderada aceita no drizzle-kit

**Contexto.** O `npm audit` aponta uma vulnerabilidade moderada no `esbuild`
0.18, usado internamente pelo `drizzle-kit` (GHSA-67mh-4wv8-2f99). A falha
afeta apenas o servidor de desenvolvimento do esbuild (`esbuild serve`).

**Decisão.** Aceitar o risco: o `drizzle-kit` usa o esbuild só para ler
arquivos TypeScript, nunca como servidor; é dependência de desenvolvimento e
não vai para produção. A correção sugerida pelo npm rebaixaria o `drizzle-kit`
para uma versão muito antiga. O CI continua falhando em vulnerabilidades altas
ou críticas.

**Consequências.** Reavaliar quando o `drizzle-kit` 1.0 estável sair.

## D-022 · Identidade visual Brasa no código

**Contexto.** O produto passou a se chamar Brasa (antes LeadScore IA), com
paleta, tipografia e logotipo próprios (`docs/identidade-visual.md`). A
identidade precisa ser aplicada de forma consistente, acessível e fácil de
manter, nos temas claro e escuro.

**Decisão.**

- **Tokens em duas camadas no Tailwind v4:** escalas da marca no `@theme` e
  tokens semânticos (`fundo`, `texto`, `primaria`, `quente-fundo`...) no
  `@theme inline`, que mudam de valor por tema. A paleta padrão do Tailwind foi
  removida: só as cores da marca existem.
- **Tema por cookie, aplicado no servidor** (`data-tema` no `<html>`): claro
  (padrão), escuro ou sistema. Sem "piscada" e sem script inline, que a CSP
  bloquearia.
- **Contraste verificado por teste automatizado:** 28 pares nos dois temas; o
  CI reprova mudanças de cor que quebrem a WCAG AA.
- **Logotipo em SVG** com o nome em curvas; componente `Logo` embutido.
  Ícones do app gerados pelo script `npm run marca:icones`.
- **Ícones de interface:** `lucide-react` (MIT), uma só família.
- **Nomes técnicos preservados:** o repositório, o pacote e os identificadores
  do código continuam `leadscore-ia`.

**Alternativas.** Tema pela preferência do sistema, só com CSS: não permite
escolha manual. Tema escolhido com JavaScript no navegador: causa "piscada" na
carga e exige script inline. Manter a paleta padrão do Tailwind: facilita usar
cores fora da marca por engano.

**Consequências.** Componentes usam só tokens semânticos; trocar uma cor da
marca é uma alteração num lugar só, validada pelo teste de contraste. Nenhuma
página é estática (já era assim por causa da CSP com nonce, D-016).

## D-023 · Autenticação, sessão e RBAC na prática

**Contexto.** A Etapa 4 implementou o que D-004, D-005 e D-006 definiram, e
algumas escolhas de implementação precisam ficar registradas para a revisão e
a arguição.

**Decisão.**

- **Onde cada coisa acontece.** Cadastro, login e senha usam o cliente do
  Better Auth, que chama as rotas `/api/auth/*`. Elas têm o limite de
  tentativas da biblioteca, guardado no banco: 5 logins por minuto por IP e
  5 cadastros a cada 10 minutos. O limite vale para várias instâncias
  serverless. As demais ações (perfil, empresa, tema, sair) são Server
  Actions.
- **Sessão validada a cada requisição.** O cookie é assinado com o
  `BETTER_AUTH_SECRET`, é `httpOnly`, `SameSite=Lax` e `Secure` em produção,
  e vale 7 dias, renovado a cada dia de uso. Além disso, o usuário é relido do
  banco a cada requisição: um bloqueio ou uma exclusão derruba a sessão na
  hora. O `proxy.ts` só faz uma checagem rápida do cookie; a proteção real
  está no servidor (`exigirSessao`, `exigirPermissao` e `autorizar`).
- **RBAC.** Página sem permissão responde 404, e empresa fora do escopo
  também responde 404; nos dois casos não se revela que o recurso existe. As
  ações usam a empresa ativa lida da sessão, nunca um ID vindo do navegador
  (proteção contra IDOR). A empresa ativa fica num cookie `httpOnly` e é
  sempre conferida contra os vínculos do usuário.
- **Dados de autenticação.**
  - Senha com scrypt.
  - Tokens OAuth cifrados com AES-256-GCM (hoje não usados).
  - Tokens de verificação guardados só como hash.
  - O token de sessão no banco não basta para forjar o cookie, porque o
    cookie é assinado.
  - IP e navegador ficam na tabela de sessões. A base legal é o legítimo
    interesse (segurança e limite de tentativas), com retenção de no máximo
    7 dias, porque a sessão é apagada no logout ou ao expirar. Isso entra na
    política de privacidade (Etapa 9).
- **Rotas da biblioteca desligadas:** atualizar usuário, excluir usuário e
  trocar e-mail. Essas operações passam pelos nossos serviços.
- **Menus sem JavaScript próprio.** O menu do celular e o menu da conta usam o
  atributo `popover` do HTML, e as ações (tema, sair) são formulários com
  Server Actions.
- **Risco aceito: enumeração de e-mail no cadastro.** A mensagem "já existe
  uma conta com este e-mail" é o comportamento esperado por quem se cadastra.
  O "esqueci a senha" não revela se o e-mail existe, e o limite de cadastros
  por IP dificulta a varredura.

**Alternativas.** Login por Server Action: chamadas internas não passam pelo
limite de tentativas da biblioteca. Sessão sem reler o usuário: um bloqueio
só valeria quando a sessão expirasse. Bibliotecas de componentes para os
menus: mais uma dependência para algo que o HTML já faz.

**Consequências.** Cada requisição autenticada faz uma consulta a mais
(usuário e vínculos), feita uma única vez por requisição graças ao `cache` do
React. Os testes E2E variam o IP fictício (`x-forwarded-for`) para não esbarrar
no limite de tentativas; um teste específico confirma que a sexta tentativa
seguida é recusada com 429.

## D-024 · Foto de perfil no Vercel Blob privado

**Contexto.** O "Alterar perfil" inclui a foto (D-011). A foto é um dado
pessoal (LGPD): num store público, qualquer pessoa com o endereço a veria, sem
como revogar. Um arquivo enviado também pode ser perigoso: HTML ou SVG com a
extensão `.png`, ou uma foto com a localização (GPS) da câmera nos metadados.

**Decisão.**

- **Store privado** (`brasa`, região `gru1`): nenhuma foto tem endereço
  público. A rota `GET /api/usuarios/[id]/foto` confere a sessão e a
  permissão ao lado da leitura do arquivo, como recomenda a documentação da
  Vercel. Sem sessão, responde 401. Sem permissão, sem foto ou com usuário
  inexistente, responde 404 nos três casos, para não revelar quem existe.
- **Quem vê a foto:** a própria pessoa, admin e suporte, e colegas de uma
  empresa em comum (`podeVerPerfil`).
- **Validação no servidor:** até 2 MB e só JPEG, PNG ou WebP, identificados
  pelos primeiros bytes do arquivo (a assinatura), nunca pela extensão nem
  pelo tipo que o navegador informa. O navegador faz a mesma conferência para
  responder na hora.
- **No navegador:** a foto é reduzida para até 512 px e regravada em WebP (ou
  JPEG). A regravação descarta os metadados, como a localização, e o envio
  fica com poucos KB.
- **Resposta da rota:** o tipo é o que o próprio app gravou (pela extensão do
  caminho), com `nosniff`, `Content-Security-Policy: default-src 'none';
  sandbox` e sem cache (`no-store`, como toda a `/api`).
- **Caminho:** `{ambiente}/usuarios/{usuarioId}/{uuid}.{ext}`, em que o
  ambiente é o `VERCEL_ENV` (`production`, `preview`) ou `local`. O banco
  guarda o caminho em `usuarios.imagem_url`. Só um caminho nesse formato, na
  pasta do próprio usuário e do ambiente atual, é lido ou apagado. Assim, a
  branch de desenvolvimento (cópia da produção) nunca lê nem apaga fotos de
  produção, e um valor estranho no banco (URL externa, `../`) é ignorado.
- **Troca:** grava o arquivo novo, aponta o banco para ele numa transação
  (linha travada com `FOR UPDATE`, com auditoria) e só então apaga o antigo.
  Se o banco falhar, o arquivo novo é apagado. Remover a foto apaga o arquivo
  (minimização, LGPD). O arquivo não é um registro do banco, então a regra de
  exclusão lógica não se aplica a ele.
- **Limite:** 10 trocas por hora por usuário, contadas na auditoria, contra
  abuso e custo.
- **Envio por Server Action:** o limite de corpo das actions passou de 1 MB
  para 2,5 MB (foto de até 2 MB mais os bytes do multipart).
- **Credencial do Blob:** localmente, `BLOB_READ_WRITE_TOKEN`; na Vercel, o
  SDK usa OIDC com o `BLOB_STORE_ID` (token de curta duração, renovado
  sozinho). Sem nenhum dos dois, o envio responde "indisponível" (503) e o
  avatar mostra as iniciais.

**Alternativas.** Store público com nome aleatório: mais barato de servir, mas
a foto ficaria acessível a quem tivesse o link, sem como revogar. Envio direto
do navegador para o Blob (client upload): economiza tráfego da função, mas
exige uma rota de token e um webhook; com fotos de poucos KB, não compensa.
Redimensionar no servidor com `sharp`: dependência nativa a mais, que
precisaria de aprovação; o ajuste no navegador resolve o caso comum.

**Consequências.** Cada exibição da foto passa por uma função (leitura do Blob
mais transferência); com fotos de poucos KB, o custo é baixo. O servidor não
decodifica a imagem: um arquivo com assinatura válida e conteúdo inválido é
guardado, mas nunca é executado (tipo fixo, `nosniff` e `sandbox`). Quem enviar
direto para a action, sem passar pela tela, pode mandar uma imagem com
metadados; ela só é vista por quem já tem permissão.

## D-025 · Branch `e2e` do Neon e preparação das migrations

**Contexto.** A branch principal do Neon se chama `production` e é exclusiva
da Vercel. Os testes E2E do CI usam a branch `e2e`, criada como "schema only"
a partir de `production`. Ela tem as tabelas, mas não os dados, nem os
registros de `drizzle.__drizzle_migrations`. O `drizzle-kit migrate` acharia
que nada foi aplicado e falharia com "já existe" logo na primeira migration.
Apagar e recriar as tabelas é proibido pelas regras do projeto.

**Decisão.** O script `npm run db:preparar-e2e` roda no CI antes dos E2E (e só
com `E2E_COM_BANCO=1`):

- se a tabela de controle está vazia, confere no catálogo do Postgres os
  objetos que cada migration cria (tabelas, índices, tipos, extensões,
  restrições e colunas) e registra as migrations já presentes (a "linha de
  base"), com o mesmo hash e a mesma data que o Drizzle gravaria;
- aplica as migrations mais novas, do mesmo jeito que o migrator do Drizzle;
- faz tudo numa transação com trava (`pg_advisory_xact_lock`), então duas
  execuções do CI ao mesmo tempo esperam a vez;
- para sem alterar nada se o banco estiver inconsistente (migration pela
  metade, fora de ordem ou impossível de conferir).

A branch `e2e` não tem exclusão automática. Os testes só inserem dados, com
e-mails únicos do domínio reservado `.example`.

**Alternativas.** Recriar a branch a cada execução pela API do Neon: exigiria
no CI uma chave com poder de apagar branches. Branch `e2e` com dados: levaria
dados de produção (LGPD) para o ambiente de testes. `drizzle-kit push`:
proibido (D-010).

**Consequências.** Depois da primeira execução, a tabela de controle fica
preenchida e o CI só aplica as migrations novas de cada PR. O
`drizzle-kit migrate` continua funcionando na branch. Uma migration futura que
só altere dados (sem criar objetos) não pode ser conferida por esse método;
isso só importa numa nova cópia "schema only", e o script avisa em vez de
adivinhar.

---

## Fontes consultadas (24/09/2026)

- [Preços do Clerk](https://clerk.com/pricing)
- [Auth.js agora faz parte do Better Auth](https://better-auth.com/blog/authjs-joins-better-auth)
- [Neon Auth (Better Auth gerenciado)](https://neon.com/docs/auth/overview)
- [Preços do Upstash Redis](https://upstash.com/docs/redis/overall/pricing)
- [Preços do Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Preços do Resend](https://resend.com/docs/knowledge-base/what-is-resend-pricing)
- [Vercel Blob: armazenamento privado](https://vercel.com/docs/vercel-blob/private-storage) (consultada em 26/09/2026, D-024)
