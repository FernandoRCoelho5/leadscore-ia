import "server-only";

import { env } from "@/env";
import { logger } from "@/lib/logger";

/**
 * Envio de e-mails transacionais (redefinição de senha, convites...).
 *
 * Adaptador (D-011): com RESEND_API_KEY, envia pela API do Resend; sem a
 * chave, em desenvolvimento, mostra o e-mail no terminal (para testar o fluxo
 * sem serviço externo). Em produção sem a chave, recusa com erro claro.
 */
export type Email = {
  para: string;
  assunto: string;
  texto: string;
};

export async function enviarEmail(email: Email): Promise<void> {
  if (env.RESEND_API_KEY) {
    await enviarPeloResend(email, env.RESEND_API_KEY);
    return;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("Envio de e-mail não configurado (RESEND_API_KEY ausente).");
  }
  // Somente em desenvolvimento: o conteúdo (com o link) aparece no terminal.
  // eslint-disable-next-line no-console -- é o próprio "envio" do e-mail em desenvolvimento.
  console.info(
    `\n---------- E-mail (desenvolvimento) ----------\nPara: ${email.para}\nAssunto: ${email.assunto}\n\n${email.texto}\n----------------------------------------------\n`,
  );
}

async function enviarPeloResend(email: Email, chave: string): Promise<void> {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_REMETENTE,
      to: [email.para],
      subject: email.assunto,
      text: email.texto,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resposta.ok) {
    // Não registra o corpo do e-mail (pode conter links com token).
    logger.error("Falha ao enviar e-mail pelo Resend", { status: resposta.status });
    throw new Error("Não foi possível enviar o e-mail.");
  }
}
