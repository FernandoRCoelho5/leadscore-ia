CREATE TABLE "contas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"id_no_provedor" varchar(255) NOT NULL,
	"provedor" varchar(40) NOT NULL,
	"senha" text,
	"token_de_acesso" text,
	"token_de_atualizacao" text,
	"token_de_id" text,
	"token_de_acesso_expira_em" timestamp with time zone,
	"token_de_atualizacao_expira_em" timestamp with time zone,
	"escopo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "limites_taxa_auth" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chave" varchar(255) NOT NULL,
	"contador" integer NOT NULL,
	"ultimo_pedido" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"endereco_ip" varchar(64),
	"agente_usuario" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verificacoes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identificador" varchar(255) NOT NULL,
	"valor" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contas" ADD CONSTRAINT "contas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contas_provedor_unico" ON "contas" USING btree ("provedor","id_no_provedor");--> statement-breakpoint
CREATE INDEX "contas_usuario_idx" ON "contas" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "limites_taxa_auth_chave_unica" ON "limites_taxa_auth" USING btree ("chave");--> statement-breakpoint
CREATE UNIQUE INDEX "sessoes_token_unico" ON "sessoes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "verificacoes_identificador_idx" ON "verificacoes" USING btree ("identificador");