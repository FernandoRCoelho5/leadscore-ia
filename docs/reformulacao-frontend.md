# Reformulação do front-end (Brasa viva)

Resumo da reformulação visual da Brasa, feita em seis etapas entre 13 e 14 de
outubro de 2026. Serve para explicar o que mudou, por que mudou e como a
qualidade é garantida. Os detalhes de cada escolha estão nas decisões
(`docs/decisoes.md`, D-033 a D-041) e as regras visuais, em
`docs/identidade-visual.md`.

**Escopo:** só front-end. Regras de negócio, banco, rotas de API,
autenticação e o motor de IA não mudaram, com três exceções aprovadas uma a
uma: uma contagem nova só de leitura na visão geral (D-036), uma conferência
de existência do lead antes do esqueleto (D-038) e o lead que volta para
"Novo" (D-041).

## 1. O conceito

O lead "em brasa" é o que deve ser atendido primeiro. A interface leva essa
ideia para todo lado:

- **Escala térmica como linguagem.** Gelo, âmbar e brasa marcam a
  classificação (frio, morno, quente), sempre com ícone e palavra, nunca só
  com a cor. O termômetro da nota da IA vai do gelo à brasa.
- **Calor só no que é urgente.** O brilho que respira e a chama viva
  aparecem apenas em destaques (o lead quente aberto, os quentes esperando
  resposta), nunca em listas, para não disputarem atenção.
- **Movimento de duas intensidades:** expressivo nas páginas públicas
  (faíscas na abertura da landing, confirmação do formulário) e sutil na área
  logada (números que contam, barras que enchem, entrada em sequência).

## 2. O que mudou, etapa por etapa

| Etapa | PR | O que entregou |
|---|---|---|
| 0. Diagnóstico | (relatório) | Mapa das telas, capturas, problemas por prioridade e o Lighthouse inicial |
| 1. Direção | #24 | Direção "Brasa viva" (D-033) e o sistema de movimento em tokens, só com CSS e View Transitions, sem biblioteca (D-034) |
| 2. Fundação | #28 | Tokens finais, componentes base (`Cartao`, `Tabela`, `Esqueleto`, `NumeroAnimado`, `Abas`, `Toasts`), termômetro da nota e o catálogo `/admin/componentes` (D-035) |
| 3. Páginas públicas | #29 | Landing nova, telas de acesso com o painel da marca, onboarding em três passos, confirmação do formulário com faíscas, erros e política com a identidade |
| 4. Área logada | #32 | Menu recolhível com indicador que desliza, esqueletos em todas as telas, visão geral com os quentes sem resposta (D-036, D-037), toasts, revelação da análise e 404 que continua 404 (D-038) |
| 5. Polimento | #33 | axe-core nos testes (D-039), navegação só por teclado testada, Zod fora do primeiro carregamento (D-040), lead que volta para "Novo" (D-041), diálogos e véu padronizados |

## 3. Decisões que valem explicar na arguição

- **Por que sem biblioteca de animação (D-034)?** CSS e a View Transitions
  API (do próprio navegador, via `<ViewTransition>` do React) fazem tudo o
  que o conceito pede, sem peso no download. Só `transform` e `opacity` são
  animados, porque o navegador faz isso sem recalcular o layout.
- **Por que os números contam só com CSS?** O `NumeroAnimado` usa
  `@property` e um contador de CSS: funciona em Server Components, não manda
  JavaScript e, com movimento reduzido, mostra o valor final direto.
- **Por que últimos 30 dias (D-036)?** Com o mês do calendário, a tela zerava
  no dia 1. As análises da IA continuam no mês, porque é nele que o limite do
  plano zera.
- **Por que um `layout.tsx` com a permissão antes do esqueleto (D-038)?** Com
  o esqueleto, o Next começa a mandar a página com status 200 antes de ela
  rodar. Para quem não pode ver, o 404 precisa sair antes disso. A página
  confere tudo de novo: o layout só garante o status.
- **Por que o Zod sob demanda (D-040)?** Ele era um terço do JavaScript das
  páginas com formulário. Agora é baixado no primeiro uso do formulário, e o
  formulário público, a página mais importante para quem chega pelo anúncio,
  passou de 90 para 97 no Lighthouse do celular.
- **O que ficou de fora de propósito:** o nome do lead "viajando" da lista até
  o título. O efeito exige o detalhe pronto no clique, e o esqueleto aparece
  antes dos dados.

## 4. Como a qualidade é garantida

| Requisito | Como é conferido |
|---|---|
| Contraste (WCAG 2.1 AA) | 28 pares de tokens no teste unitário e o axe-core em todas as telas montadas, nos dois temas |
| Leitores de tela | Verificador próprio nos E2E (rótulos, nomes, títulos, regiões) e o axe (ARIA) |
| Teclado | `tests/e2e/teclado.spec.ts`: cada fluxo com Tab, Enter e Esc, e o anel de foco visível em toda parada |
| Movimento reduzido | Todas as animações param; conferido em todas as telas (nenhuma animação rodando, nenhum quadro no canvas) |
| Responsividade | Telas conferidas de 320 a 1366 px, sem rolagem lateral |
| Segurança (OWASP) | CSP sem `unsafe-eval` e sem violações (teste novo nos formulários), 404 para quem não pode ver, cookie do menu validado ao ler |
| Funcionalidades | 599 testes unitários e de integração e os E2E com banco no CI |

## 5. Lighthouse: Etapa 0 e agora

Mediana de 3 rodadas, build de produção local, Lighthouse 12.8.2 (o mesmo
método nas duas medições).

| Página (celular) | Desempenho antes | Agora | Boas práticas antes | Agora |
|---|---|---|---|---|
| Início (landing nova) | 95 | 96 | 100 | 100 |
| Login | 93 | 96 | 96 | 100 |
| Formulário público | 90 | 97 | 96 | 100 |
| Visão geral | 96 | 94 | 100 | 100 |
| Leads | 96 | 96 | 100 | 100 |
| Detalhe do lead | 92 | 95 | 100 | 100 |

No computador, 100 nas três categorias em todas as páginas (antes, 96 em
boas práticas no login e no formulário). Acessibilidade: 100 em todas, antes e
agora. O bloqueio do carregamento (TBT) no celular caiu em cinco das seis
páginas (no formulário, de 243 para 64 ms); na visão geral, subiu de 61 para
87 ms.

## 6. Pendências

- **LCP do celular acima de 2,5 s no Lighthouse** (de 2,7 a 3,0 s,
  simulado). O LCP real medido na mesma rodada fica entre 0,24 e 0,62 s. A
  simulação soma ao LCP o JavaScript pedido no início, e o React e o Next
  sozinhos somam cerca de 108 KB que não dá para tirar.
- **Visão geral (96 para 94).** Desde os esqueletos, o conteúdo chega quando
  a consulta ao banco termina. Medido daqui até o Neon remoto, o tempo varia
  de uma rodada para outra. É tempo de servidor, fora do escopo de front-end:
  vale medir na Vercel, perto do banco.
- **Lista de empresas da administração** continua com "Leads no mês" (mês do
  calendário), porque acompanha o consumo do plano; a visão geral usa os
  últimos 30 dias (D-036).
- **Fora desta reformulação:** os PRs do Dependabot abertos (#27, #30 e #31)
  e as vulnerabilidades só de desenvolvimento já aceitas na D-032.
