import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Import relativo: o drizzle-kit lê este arquivo fora do Next.js e não conhece o alias "@/".
import { uuidv7 } from "../lib/uuid";

/**
 * Schema do banco (fonte única da verdade para tabelas, tipos e migrations).
 *
 * Convenções (docs/decisoes.md, D-003):
 * - chave primária UUID v7 gerada pela aplicação;
 * - created_at, updated_at e deleted_at em todas as tabelas (exclusão lógica);
 * - chaves estrangeiras com ON DELETE RESTRICT, nunca CASCADE;
 * - unicidade entre registros ativos com índices parciais (WHERE deleted_at IS NULL).
 *
 * Exceção autorizada (D-006): nas tabelas técnicas da autenticação `sessoes` e
 * `verificacoes`, o Better Auth apaga fisicamente sessões encerradas e tokens
 * usados. Elas não guardam dados de negócio.
 */

// ---------------------------------------------------------------------------
// Colunas comuns
// ---------------------------------------------------------------------------

const chavePrimaria = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

const colunasDeTempo = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** Condição dos índices parciais: só registros não excluídos. */
const naoExcluido = sql`deleted_at IS NULL`;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const statusEmpresaEnum = pgEnum("status_empresa", ["ativa", "bloqueada"]);
export const papelPlataformaEnum = pgEnum("papel_plataforma", ["admin", "suporte"]);
export const papelEmpresaEnum = pgEnum("papel_empresa", ["cliente"]);
export const origemLeadEnum = pgEnum("origem_lead", ["formulario", "manual"]);
export const statusLeadEnum = pgEnum("status_lead", ["novo", "em_contato", "ganho", "perdido"]);
export const statusAnaliseEnum = pgEnum("status_analise", [
  "pendente",
  "processando",
  "concluida",
  "falhou",
  "limite_atingido",
]);
export const classificacaoEnum = pgEnum("classificacao", ["quente", "morno", "frio"]);

// ---------------------------------------------------------------------------
// Empresas (clientes do SaaS) e usuários
// ---------------------------------------------------------------------------

export const empresas = pgTable(
  "empresas",
  {
    id: chavePrimaria(),
    nome: varchar("nome", { length: 120 }).notNull(),
    /** Endereço do formulário público: /f/[slug]. */
    slug: varchar("slug", { length: 60 }).notNull(),
    status: statusEmpresaEnum("status").notNull().default("ativa"),
    limiteAnalisesMes: integer("limite_analises_mes").notNull().default(100),
    // Perfil do negócio: contexto que a IA usa para pontuar os leads.
    descricao: text("descricao"),
    produtosServicos: text("produtos_servicos"),
    clienteIdeal: text("cliente_ideal"),
    ticketMedioCentavos: bigint("ticket_medio_centavos", { mode: "number" }),
    regioesAtendidas: text("regioes_atendidas"),
    /** Sobe a cada edição do perfil; cada análise guarda a versão usada. */
    perfilVersao: integer("perfil_versao").notNull().default(1),
    ...colunasDeTempo(),
  },
  (t) => [
    uniqueIndex("empresas_slug_unico").on(t.slug).where(naoExcluido),
    check("empresas_limite_nao_negativo", sql`${t.limiteAnalisesMes} >= 0`),
  ],
);

export const usuarios = pgTable(
  "usuarios",
  {
    id: chavePrimaria(),
    nome: varchar("nome", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    emailVerificado: boolean("email_verificado").notNull().default(false),
    imagemUrl: text("imagem_url"),
    /** admin e suporte são da equipe do SaaS; nulo para usuários de empresas clientes. */
    papelPlataforma: papelPlataformaEnum("papel_plataforma"),
    bloqueadoEm: timestamp("bloqueado_em", { withTimezone: true }),
    ...colunasDeTempo(),
  },
  // Único sem ser parcial: na anonimização o e-mail vira um valor único (D-012).
  (t) => [uniqueIndex("usuarios_email_unico").on(sql`lower(${t.email})`)],
);

/** Vínculo N:N entre usuários e empresas. */
export const membrosEmpresa = pgTable(
  "membros_empresa",
  {
    id: chavePrimaria(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    papel: papelEmpresaEnum("papel").notNull().default("cliente"),
    ...colunasDeTempo(),
  },
  (t) => [
    uniqueIndex("membros_empresa_vinculo_unico").on(t.usuarioId, t.empresaId).where(naoExcluido),
    index("membros_empresa_empresa_idx").on(t.empresaId).where(naoExcluido),
  ],
);

export const convites = pgTable(
  "convites",
  {
    id: chavePrimaria(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 254 }).notNull(),
    /** Só o hash (SHA-256) do token; o token em si vai apenas no link. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    papel: papelEmpresaEnum("papel").notNull().default("cliente"),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    aceitoEm: timestamp("aceito_em", { withTimezone: true }),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    ...colunasDeTempo(),
  },
  (t) => [
    uniqueIndex("convites_token_hash_unico").on(t.tokenHash),
    index("convites_empresa_idx").on(t.empresaId, t.createdAt.desc()).where(naoExcluido),
  ],
);

// ---------------------------------------------------------------------------
// Leads e análises
// ---------------------------------------------------------------------------

export const leads = pgTable(
  "leads",
  {
    id: chavePrimaria(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    nome: varchar("nome", { length: 120 }).notNull(),
    // Contato pode ficar nulo após a anonimização (LGPD, D-012).
    email: varchar("email", { length: 254 }),
    telefone: varchar("telefone", { length: 30 }),
    empresaNome: varchar("empresa_nome", { length: 160 }),
    segmento: varchar("segmento", { length: 80 }),
    mensagem: text("mensagem"),
    origem: origemLeadEnum("origem").notNull().default("formulario"),
    status: statusLeadEnum("status").notNull().default("novo"),
    consentimentoLgpd: boolean("consentimento_lgpd").notNull(),
    consentimentoEm: timestamp("consentimento_em", { withTimezone: true }),
    consentimentoVersaoTexto: varchar("consentimento_versao_texto", { length: 20 }),
    /** HMAC do IP de quem enviou; nunca o IP em si. */
    ipHash: varchar("ip_hash", { length: 64 }),
    statusAnalise: statusAnaliseEnum("status_analise").notNull().default("pendente"),
    // Cópia da análise mais recente: listar e filtrar sem JOIN com o histórico.
    scoreAtual: smallint("score_atual"),
    classificacaoAtual: classificacaoEnum("classificacao_atual"),
    anonimizadoEm: timestamp("anonimizado_em", { withTimezone: true }),
    ...colunasDeTempo(),
  },
  (t) => [
    index("leads_empresa_criado_idx").on(t.empresaId, t.createdAt.desc()).where(naoExcluido),
    index("leads_empresa_classificacao_idx")
      .on(t.empresaId, t.classificacaoAtual, t.createdAt.desc())
      .where(naoExcluido),
    index("leads_empresa_status_idx")
      .on(t.empresaId, t.status, t.createdAt.desc())
      .where(naoExcluido),
    // Busca por trecho (ILIKE '%termo%') com trigramas (extensão pg_trgm).
    index("leads_nome_trgm_idx").using("gin", t.nome.op("gin_trgm_ops")),
    index("leads_email_trgm_idx").using("gin", t.email.op("gin_trgm_ops")),
    index("leads_empresa_nome_trgm_idx").using("gin", t.empresaNome.op("gin_trgm_ops")),
    check("leads_score_atual_faixa", sql`${t.scoreAtual} BETWEEN 0 AND 100`),
  ],
);

/** Histórico de análises: nunca é atualizado; cada reanálise é uma nova linha. */
export const analises = pgTable(
  "analises",
  {
    id: chavePrimaria(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "restrict" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    score: smallint("score").notNull(),
    classificacao: classificacaoEnum("classificacao").notNull(),
    justificativa: text("justificativa").notNull(),
    respostaSugerida: text("resposta_sugerida").notNull(),
    modelo: varchar("modelo", { length: 80 }).notNull(),
    promptVersion: varchar("prompt_version", { length: 20 }).notNull(),
    perfilVersao: integer("perfil_versao").notNull(),
    tokensEntrada: integer("tokens_entrada").notNull().default(0),
    tokensSaida: integer("tokens_saida").notNull().default(0),
    tempoRespostaMs: integer("tempo_resposta_ms").notNull(),
    tentativas: smallint("tentativas").notNull().default(1),
    /** true quando gerada pelo modo mock (sem a Claude API). */
    mock: boolean("mock").notNull().default(false),
    /** Nulo quando automática (envio do formulário). */
    solicitadaPor: uuid("solicitada_por").references(() => usuarios.id, { onDelete: "restrict" }),
    ...colunasDeTempo(),
  },
  (t) => [
    index("analises_lead_idx").on(t.leadId, t.createdAt.desc()).where(naoExcluido),
    index("analises_empresa_idx").on(t.empresaId, t.createdAt.desc()).where(naoExcluido),
    check("analises_score_faixa", sql`${t.score} BETWEEN 0 AND 100`),
  ],
);

// ---------------------------------------------------------------------------
// Consumo, auditoria e rate limiting
// ---------------------------------------------------------------------------

/** Análises e tokens consumidos por empresa em cada mês (base do limite e da cobrança). */
export const usoMensal = pgTable(
  "uso_mensal",
  {
    id: chavePrimaria(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    /** Primeiro dia do mês de referência. */
    competencia: date("competencia", { mode: "string" }).notNull(),
    analises: integer("analises").notNull().default(0),
    tokensEntrada: bigint("tokens_entrada", { mode: "number" }).notNull().default(0),
    tokensSaida: bigint("tokens_saida", { mode: "number" }).notNull().default(0),
    ...colunasDeTempo(),
  },
  // Índice único completo (não parcial): é o alvo do INSERT ... ON CONFLICT.
  (t) => [uniqueIndex("uso_mensal_empresa_competencia_unico").on(t.empresaId, t.competencia)],
);

/** Ações sensíveis. Só recebe inserções; `detalhes` nunca contém dados pessoais. */
export const auditoria = pgTable(
  "auditoria",
  {
    id: chavePrimaria(),
    /** Nulo em ações do sistema ou de visitantes (ex.: formulário público). */
    atorId: uuid("ator_id").references(() => usuarios.id, { onDelete: "restrict" }),
    /** Nulo em eventos da plataforma (ex.: alteração de papel de um admin). */
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "restrict" }),
    acao: varchar("acao", { length: 60 }).notNull(),
    recursoTipo: varchar("recurso_tipo", { length: 40 }).notNull(),
    recursoId: uuid("recurso_id"),
    detalhes: jsonb("detalhes").$type<Record<string, unknown>>().notNull().default({}),
    ipHash: varchar("ip_hash", { length: 64 }),
    ...colunasDeTempo(),
  },
  (t) => [
    index("auditoria_empresa_idx").on(t.empresaId, t.createdAt.desc()),
    index("auditoria_criado_idx").on(t.createdAt.desc()),
  ],
);

/** Contadores do rate limiting (Etapa 6). A linha é reaproveitada: nada é apagado. */
export const limitesTaxa = pgTable(
  "limites_taxa",
  {
    id: chavePrimaria(),
    /** Hash de IP + rota; nunca o IP em si. */
    chave: varchar("chave", { length: 128 }).notNull(),
    janelaInicio: timestamp("janela_inicio", { withTimezone: true }).notNull(),
    contador: integer("contador").notNull().default(0),
    ...colunasDeTempo(),
  },
  (t) => [uniqueIndex("limites_taxa_chave_unica").on(t.chave)],
);

// ---------------------------------------------------------------------------
// Autenticação (Better Auth). Colunas exigidas pela biblioteca, com nomes em
// português; o mapeamento fica em src/server/auth/auth.ts.
// ---------------------------------------------------------------------------

/** Sessões de login. Apagadas pela biblioteca no logout e ao expirar (D-006). */
export const sessoes = pgTable(
  "sessoes",
  {
    id: chavePrimaria(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    /** Valor do cookie de sessão (a biblioteca o assina antes de enviar ao navegador). */
    token: varchar("token", { length: 255 }).notNull(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    enderecoIp: varchar("endereco_ip", { length: 64 }),
    agenteUsuario: text("agente_usuario"),
    ...colunasDeTempo(),
  },
  (t) => [
    uniqueIndex("sessoes_token_unico").on(t.token),
    index("sessoes_usuario_idx").on(t.usuarioId),
  ],
);

/** Formas de login do usuário. Na conta "credential", `senha` guarda só o hash (scrypt). */
export const contas = pgTable(
  "contas",
  {
    id: chavePrimaria(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    idNoProvedor: varchar("id_no_provedor", { length: 255 }).notNull(),
    provedor: varchar("provedor", { length: 40 }).notNull(),
    senha: text("senha"),
    // Usados só com login social (OAuth), hoje desligado.
    tokenDeAcesso: text("token_de_acesso"),
    tokenDeAtualizacao: text("token_de_atualizacao"),
    tokenDeId: text("token_de_id"),
    tokenDeAcessoExpiraEm: timestamp("token_de_acesso_expira_em", { withTimezone: true }),
    tokenDeAtualizacaoExpiraEm: timestamp("token_de_atualizacao_expira_em", {
      withTimezone: true,
    }),
    escopo: text("escopo"),
    ...colunasDeTempo(),
  },
  (t) => [
    uniqueIndex("contas_provedor_unico").on(t.provedor, t.idNoProvedor),
    index("contas_usuario_idx").on(t.usuarioId),
  ],
);

/** Tokens de curta duração (ex.: redefinição de senha). Apagados após o uso (D-006). */
export const verificacoes = pgTable(
  "verificacoes",
  {
    id: chavePrimaria(),
    identificador: varchar("identificador", { length: 255 }).notNull(),
    valor: text("valor").notNull(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    ...colunasDeTempo(),
  },
  (t) => [index("verificacoes_identificador_idx").on(t.identificador)],
);

/** Limite de tentativas nas rotas de login (rate limit do Better Auth). */
export const limitesTaxaAuth = pgTable(
  "limites_taxa_auth",
  {
    id: chavePrimaria(),
    chave: varchar("chave", { length: 255 }).notNull(),
    contador: integer("contador").notNull(),
    /** Horário do último pedido, em milissegundos (formato exigido pela biblioteca). */
    ultimoPedido: bigint("ultimo_pedido", { mode: "number" }).notNull(),
    ...colunasDeTempo(),
  },
  (t) => [uniqueIndex("limites_taxa_auth_chave_unica").on(t.chave)],
);

// ---------------------------------------------------------------------------
// Tipos derivados do schema (usados em toda a aplicação, sem `any`)
// ---------------------------------------------------------------------------

export type Empresa = typeof empresas.$inferSelect;
export type NovaEmpresa = typeof empresas.$inferInsert;
export type Usuario = typeof usuarios.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NovoLead = typeof leads.$inferInsert;
export type Analise = typeof analises.$inferSelect;
export type NovaAnalise = typeof analises.$inferInsert;
export type UsoMensal = typeof usoMensal.$inferSelect;
export type EventoDeAuditoria = typeof auditoria.$inferInsert;

export type StatusLead = (typeof statusLeadEnum.enumValues)[number];
export type StatusAnalise = (typeof statusAnaliseEnum.enumValues)[number];
export type Classificacao = (typeof classificacaoEnum.enumValues)[number];
