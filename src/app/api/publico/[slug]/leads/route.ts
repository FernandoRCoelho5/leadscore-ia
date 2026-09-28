import { NextResponse } from "next/server";

import { db } from "@/db";
import { env } from "@/env";
import { ErroProibido, ErroValidacao } from "@/lib/erros";
import { comTratamentoDeErros } from "@/server/http/responder";
import { agendarAnalise } from "@/server/http/agendarAnalise";
import { obterIp } from "@/server/seguranca/ip";
import { limitadorNoBanco } from "@/server/seguranca/limitador";
import { captarLead } from "@/server/services/captacao";

/** O formulário tem poucos campos: 16 KB sobram com folga (a mensagem tem até 2.000 caracteres). */
const TAMANHO_MAXIMO_DO_CORPO = 16 * 1024;

/**
 * Recebe o formulário público de captação (D-028). É pública (sem login), então:
 * - só aceita JSON: outro site não consegue enviar um formulário HTML comum
 *   para cá, e um `fetch` com JSON de outra origem é barrado pelo navegador
 *   (não respondemos ao CORS);
 * - recusa origens estranhas quando o navegador informa a origem;
 * - limita o tamanho do corpo antes de ler;
 * - o resto (anti-spam, limites por IP e por formulário, validação) fica no serviço.
 *
 * A resposta de sucesso não devolve o id do lead nem diz se o envio foi
 * descartado como robô.
 */
export const POST = comTratamentoDeErros<RouteContext<"/api/publico/[slug]/leads">>(
  async (request, { params }) => {
    const origem = request.headers.get("origin");
    if (origem !== null && !env.ORIGENS_CONFIAVEIS.includes(origem)) {
      throw new ErroProibido("Origem não permitida.");
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new ErroValidacao([], "Envie os dados do formulário em JSON.");
    }
    const tamanhoInformado = Number(request.headers.get("content-length") ?? "0");
    if (tamanhoInformado > TAMANHO_MAXIMO_DO_CORPO) {
      throw new ErroValidacao([], "Os dados enviados são grandes demais.");
    }
    const texto = await request.text();
    if (texto.length > TAMANHO_MAXIMO_DO_CORPO) {
      throw new ErroValidacao([], "Os dados enviados são grandes demais.");
    }
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      throw new ErroValidacao([], "Os dados enviados não estão em JSON válido.");
    }

    const { slug } = await params;
    await captarLead(
      db,
      { slug, corpo, ip: obterIp(request.headers) },
      { limitador: limitadorNoBanco(db), agendarAnalise },
    );
    return NextResponse.json({ recebido: true }, { status: 201 });
  },
);
