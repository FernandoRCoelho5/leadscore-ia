@AGENTS.md

# LeadScore IA

## Contexto
App Next.js (App Router, TypeScript) que capta leads, analisa com Claude API
e salva no Neon Postgres via Drizzle ORM.

## Regras
- TypeScript estrito, sem `any`.
- Acesso ao banco só via Drizzle, schema em `src/db/schema.ts`.
- Segredos só em variáveis de ambiente; nunca commitar `.env*`.
- Rotas de API em `src/app/api/`.
- A resposta da IA deve ser JSON validado com Zod antes de salvar.
- Commits pequenos, em português: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
- Antes de concluir uma tarefa: rodar `npm run build` e `npm run lint`.
- Modelo da IA no produto: `claude-haiku-4-5-20251001`.
- Variáveis de ambiente ficam em `.env.local`; o `drizzle.config.ts` deve carregá-lo com dotenv.
- Nunca apagar tabela no banco de dados
- Não deletar registros no banco de dados
- Sempre subir uma atualização no git repositorio remoto
- sempre utilizar skill /ui-ux-pro-max no layout da aplicação e analisar a melhor usabilidade do usuário
- para funcionalidades do painel administrativo perfils suporte, cliente e admin utilizar RBAC 
- toda entrega de funcionalidade deve ser analisado o OWASP Top 10 para proteção do código 
- analisar melhores práticas de arquitetura de software 
- toda as vezes que for desenvolver uma tela ou funcionalidade pensar em escalabilidade da aplicação ou dos dados
- quando criar formulários de crud pensar em filtro, paginação e exportação de dados.
- No layout colocar Menu sempre lateral esquerdo 
- Utilizar menu topo com avatar e o submenu para alterar o perfil (nome, foto e senha) e sair da aplicação

## Comandos
- dev: `npm run dev`
- migrations: `npx drizzle-kit generate`, revisar o SQL gerado (sem `DROP`/`TRUNCATE`) e aplicar com `npx drizzle-kit migrate`. Não usar `drizzle-kit push`.