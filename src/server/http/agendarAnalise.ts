import "server-only";

import { after } from "next/server";

import { db } from "@/db";
import { logger } from "@/lib/logger";
import { obterMotor } from "@/server/ia";
import { analisarLead } from "@/server/services/analise";

/**
 * Agenda a análise para depois que a resposta for enviada (D-007): quem
 * preenche o formulário público não espera a IA. Usado pela captação (Etapa 6).
 * Um erro aqui nunca chega ao visitante; fica no log e o lead pode ser
 * reanalisado pelo painel.
 */
export function agendarAnalise(empresaId: string, leadId: string): void {
  after(async () => {
    try {
      await analisarLead(db, obterMotor(), empresaId, leadId);
    } catch (erro) {
      logger.error("Falha ao analisar lead em segundo plano", { leadId, empresaId, erro });
    }
  });
}
