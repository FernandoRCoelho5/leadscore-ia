/**
 * Domínios das contas de demonstração e de teste (.example, reservado pela
 * RFC 2606) e das contas anonimizadas (D-012). Qualquer outro é de gente real.
 */
export const SUFIXOS_DE_CONTAS_FICTICIAS = [".example", "@anonimizado.invalid"] as const;

/**
 * Por que o seed de demonstração não deve rodar neste banco, ou `null` se
 * pode. Produção começa vazia e só recebe dados reais (D-031): contas de
 * demonstração, com senha conhecida pela equipe, não entram lá.
 */
export function motivoParaRecusarSeed({
  ambiente,
  contasReais,
}: {
  ambiente: string | undefined;
  contasReais: number;
}): string | null {
  if (ambiente === "production") {
    return "VERCEL_ENV=production: o seed de demonstração não roda em produção.";
  }
  if (contasReais > 0) {
    return (
      `o banco tem ${contasReais} conta(s) com e-mail real (fora do domínio .example) e ` +
      "parece ser de produção. O seed só roda nos bancos de desenvolvimento e de testes."
    );
  }
  return null;
}
