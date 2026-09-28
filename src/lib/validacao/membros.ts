import { z } from "zod";

import { esquemaEmail } from "./auth";

/** Convite para entrar na empresa (D-030): só o e-mail de quem vai entrar. */
export const esquemaConvite = z.object({ email: esquemaEmail });

export type DadosDoConvite = z.infer<typeof esquemaConvite>;

/** Dias de validade do link de convite. */
export const DIAS_DE_VALIDADE_DO_CONVITE = 7;
