/** Ambientes da Vercel que têm banco próprio e recebem migrations no build (D-026, D-031). */
const AMBIENTES_COM_BANCO = ["production", "preview"] as const;

export type AmbienteComBanco = (typeof AMBIENTES_COM_BANCO)[number];

/**
 * O ambiente cujo banco deve receber as migrations neste build, ou `null` fora
 * de um build da Vercel (máquina local, CI): ali as migrations seguem o fluxo
 * revisado de sempre (`db:gerar`, revisão do SQL e `db:migrar`).
 */
export function ambienteQueMigra(
  variaveis: Readonly<Record<string, string | undefined>>,
): AmbienteComBanco | null {
  if (variaveis.VERCEL !== "1") {
    return null;
  }
  return AMBIENTES_COM_BANCO.find((ambiente) => ambiente === variaveis.VERCEL_ENV) ?? null;
}
