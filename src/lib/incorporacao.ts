/** Formulário público no site do cliente (D-028): endereço e código do iframe. */

/** Altura sugerida: cabe o formulário inteiro no celular, com a mensagem de erro aberta. */
export const ALTURA_DO_IFRAME = 1100;

export function enderecoDoFormulario(urlDoApp: string, slug: string): string {
  return `${urlDoApp.replace(/\/+$/, "")}/f/${slug}`;
}

/** Escapa o texto para ir dentro de um atributo HTML entre aspas duplas. */
function escaparAtributo(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Código para colar no site: o `title` descreve o iframe para leitores de tela. */
export function codigoDeIncorporacao(endereco: string, nomeDaEmpresa: string): string {
  return [
    `<iframe src="${escaparAtributo(endereco)}"`,
    `  title="Fale com ${escaparAtributo(nomeDaEmpresa)}"`,
    `  width="100%" height="${ALTURA_DO_IFRAME}" loading="lazy"`,
    `  style="border:0;max-width:640px"></iframe>`,
  ].join("\n");
}
