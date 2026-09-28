import { NextResponse } from "next/server";

import { comTratamentoDeErros } from "@/server/http/responder";

/**
 * Verificação de saúde usada pelo monitoramento e pelos testes E2E.
 * Não expõe versão, dependências nem dados do ambiente.
 */
export const GET = comTratamentoDeErros(async () => NextResponse.json({ status: "ok" }));
