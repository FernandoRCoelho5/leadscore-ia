CREATE TYPE "public"."classificacao" AS ENUM('quente', 'morno', 'frio');--> statement-breakpoint
CREATE TYPE "public"."origem_lead" AS ENUM('formulario', 'manual');--> statement-breakpoint
CREATE TYPE "public"."papel_empresa" AS ENUM('cliente');--> statement-breakpoint
CREATE TYPE "public"."papel_plataforma" AS ENUM('admin', 'suporte');--> statement-breakpoint
CREATE TYPE "public"."status_analise" AS ENUM('pendente', 'processando', 'concluida', 'falhou', 'limite_atingido');--> statement-breakpoint
CREATE TYPE "public"."status_empresa" AS ENUM('ativa', 'bloqueada');--> statement-breakpoint
CREATE TYPE "public"."status_lead" AS ENUM('novo', 'em_contato', 'ganho', 'perdido');--> statement-breakpoint
CREATE TABLE "analises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lead_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"classificacao" "classificacao" NOT NULL,
	"justificativa" text NOT NULL,
	"resposta_sugerida" text NOT NULL,
	"modelo" varchar(80) NOT NULL,
	"prompt_version" varchar(20) NOT NULL,
	"perfil_versao" integer NOT NULL,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_saida" integer DEFAULT 0 NOT NULL,
	"tempo_resposta_ms" integer NOT NULL,
	"tentativas" smallint DEFAULT 1 NOT NULL,
	"mock" boolean DEFAULT false NOT NULL,
	"solicitada_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "analises_score_faixa" CHECK ("analises"."score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ator_id" uuid,
	"empresa_id" uuid,
	"acao" varchar(60) NOT NULL,
	"recurso_tipo" varchar(40) NOT NULL,
	"recurso_id" uuid,
	"detalhes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "convites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"papel" "papel_empresa" DEFAULT 'cliente' NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"aceito_em" timestamp with time zone,
	"criado_por" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" varchar(120) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"status" "status_empresa" DEFAULT 'ativa' NOT NULL,
	"limite_analises_mes" integer DEFAULT 100 NOT NULL,
	"descricao" text,
	"produtos_servicos" text,
	"cliente_ideal" text,
	"ticket_medio_centavos" bigint,
	"regioes_atendidas" text,
	"perfil_versao" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "empresas_limite_nao_negativo" CHECK ("empresas"."limite_analises_mes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" varchar(254),
	"telefone" varchar(30),
	"empresa_nome" varchar(160),
	"segmento" varchar(80),
	"mensagem" text,
	"origem" "origem_lead" DEFAULT 'formulario' NOT NULL,
	"status" "status_lead" DEFAULT 'novo' NOT NULL,
	"consentimento_lgpd" boolean NOT NULL,
	"consentimento_em" timestamp with time zone,
	"consentimento_versao_texto" varchar(20),
	"ip_hash" varchar(64),
	"status_analise" "status_analise" DEFAULT 'pendente' NOT NULL,
	"score_atual" smallint,
	"classificacao_atual" "classificacao",
	"anonimizado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "leads_score_atual_faixa" CHECK ("leads"."score_atual" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "limites_taxa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chave" varchar(128) NOT NULL,
	"janela_inicio" timestamp with time zone NOT NULL,
	"contador" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "membros_empresa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"papel" "papel_empresa" DEFAULT 'cliente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "uso_mensal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"empresa_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"analises" integer DEFAULT 0 NOT NULL,
	"tokens_entrada" bigint DEFAULT 0 NOT NULL,
	"tokens_saida" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"email_verificado" boolean DEFAULT false NOT NULL,
	"imagem_url" text,
	"papel_plataforma" "papel_plataforma",
	"bloqueado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "analises" ADD CONSTRAINT "analises_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analises" ADD CONSTRAINT "analises_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analises" ADD CONSTRAINT "analises_solicitada_por_usuarios_id_fk" FOREIGN KEY ("solicitada_por") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_ator_id_usuarios_id_fk" FOREIGN KEY ("ator_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convites" ADD CONSTRAINT "convites_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convites" ADD CONSTRAINT "convites_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros_empresa" ADD CONSTRAINT "membros_empresa_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membros_empresa" ADD CONSTRAINT "membros_empresa_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uso_mensal" ADD CONSTRAINT "uso_mensal_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analises_lead_idx" ON "analises" USING btree ("lead_id","created_at" DESC NULLS LAST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "analises_empresa_idx" ON "analises" USING btree ("empresa_id","created_at" DESC NULLS LAST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "auditoria_empresa_idx" ON "auditoria" USING btree ("empresa_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_criado_idx" ON "auditoria" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "convites_token_hash_unico" ON "convites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "convites_empresa_idx" ON "convites" USING btree ("empresa_id","created_at" DESC NULLS LAST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "empresas_slug_unico" ON "empresas" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "leads_empresa_criado_idx" ON "leads" USING btree ("empresa_id","created_at" DESC NULLS LAST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "leads_empresa_classificacao_idx" ON "leads" USING btree ("empresa_id","classificacao_atual","created_at" DESC NULLS LAST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "leads_empresa_status_idx" ON "leads" USING btree ("empresa_id","status","created_at" DESC NULLS LAST) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "leads_nome_trgm_idx" ON "leads" USING gin ("nome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_email_trgm_idx" ON "leads" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_empresa_nome_trgm_idx" ON "leads" USING gin ("empresa_nome" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "limites_taxa_chave_unica" ON "limites_taxa" USING btree ("chave");--> statement-breakpoint
CREATE UNIQUE INDEX "membros_empresa_vinculo_unico" ON "membros_empresa" USING btree ("usuario_id","empresa_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "membros_empresa_empresa_idx" ON "membros_empresa" USING btree ("empresa_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uso_mensal_empresa_competencia_unico" ON "uso_mensal" USING btree ("empresa_id","competencia");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_unico" ON "usuarios" USING btree (lower("email"));