/**
 * E-mail com o nome escondido ("f•••••@empresa.com.br"). A página do convite
 * mostra para qual e-mail ele vale sem expor o endereço inteiro a quem
 * recebeu o link repassado.
 */
export function mascararEmail(email: string): string {
  const [nome = "", dominio = ""] = email.split("@");
  if (!nome || !dominio) {
    return "•••";
  }
  return `${nome[0]}${"•".repeat(Math.min(Math.max(nome.length - 1, 3), 8))}@${dominio}`;
}
