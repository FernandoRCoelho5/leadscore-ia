import { Pool } from "@neondatabase/serverless";
import type { Browser, Page } from "@playwright/test";
import { config } from "dotenv";

/**
 * Auxiliares dos testes E2E com banco: contas e empresas únicas por teste,
 * sempre com e-mails do domínio reservado .example. Só inserem e alteram os
 * próprios dados; nada é apagado.
 */

config({ path: ".env.local", quiet: true });

export const SENHA = "uma senha longa de teste";

export function unico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function emailUnico(prefixo: string) {
  return `${unico(prefixo)}@teste.brasa.example`;
}

/** IP fictício (faixa de documentação 203.0.113.0/24) para o limitador de tentativas. */
export function ipFicticio() {
  return `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
}

export async function consultar<Linha extends Record<string, unknown>>(
  sql: string,
  parametros: unknown[],
): Promise<Linha[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<Linha>(sql, parametros);
    return rows;
  } finally {
    await pool.end();
  }
}

export async function novaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": ipFicticio() },
  });
  return contexto.newPage();
}

export async function cadastrar(page: Page, nome: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail de trabalho").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/onboarding");
}

/** Cadastra um cliente com empresa e devolve o id e o nome da empresa e o e-mail da pessoa. */
export async function clienteComEmpresa(
  page: Page,
  pessoa = "Paula Painel",
): Promise<{ empresaId: string; nome: string; email: string }> {
  const email = emailUnico("painel");
  const nome = `Agência Painel ${unico("e2e").slice(-10)}`;
  await cadastrar(page, pessoa, email);
  await page.getByLabel("Nome da empresa").fill(nome);
  await page.getByLabel("O que a sua empresa faz").fill("Criamos sites e lojas virtuais B2B.");
  await page.getByLabel("Cliente ideal").fill("Indústrias de médio porte do Sul Fluminense.");
  await page.getByRole("button", { name: "Criar empresa e ir para o painel" }).click();
  await page.waitForURL("**/painel");

  const [linha] = await consultar<{ id: string }>(
    `SELECT e.id FROM empresas e
       JOIN membros_empresa m ON m.empresa_id = e.id
       JOIN usuarios u ON u.id = m.usuario_id
      WHERE u.email = $1`,
    [email],
  );
  if (!linha) {
    throw new Error("empresa do cliente não encontrada");
  }
  return { empresaId: linha.id, nome, email };
}

/**
 * Verificação automática de acessibilidade, sem dependência externa: os erros
 * mais comuns que um leitor de tela ou a navegação por teclado encontram.
 * Olha só o que está visível (diálogos fechados e o menu do celular ficam de
 * fora). Devolve a lista de problemas; vazia = passou.
 */
export async function problemasDeAcessibilidade(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problemas: string[] = [];
    const visivel = (elemento: Element) =>
      elemento.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
    const descrever = (elemento: Element) =>
      `<${elemento.tagName.toLowerCase()}${elemento.id ? `#${elemento.id}` : ""}> "${(elemento.textContent ?? "").trim().slice(0, 40)}"`;
    const textoDosIds = (ids: string) =>
      ids
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
    const nomeAcessivel = (elemento: Element): string => {
      const rotuladoPor = elemento.getAttribute("aria-labelledby");
      if (rotuladoPor) {
        return textoDosIds(rotuladoPor);
      }
      const rotulo = elemento.getAttribute("aria-label")?.trim();
      if (rotulo) {
        return rotulo;
      }
      const texto = (elemento.textContent ?? "").trim();
      if (texto) {
        return texto;
      }
      const imagem = elemento.querySelector("img[alt]");
      return imagem?.getAttribute("alt")?.trim() || elemento.getAttribute("title")?.trim() || "";
    };

    if (!document.documentElement.lang) {
      problemas.push("<html> sem o atributo lang");
    }

    const vistos = new Map<string, number>();
    for (const elemento of document.querySelectorAll("[id]")) {
      vistos.set(elemento.id, (vistos.get(elemento.id) ?? 0) + 1);
    }
    for (const [id, vezes] of vistos) {
      if (vezes > 1) {
        problemas.push(`id repetido: "${id}" (${vezes} vezes)`);
      }
    }

    const principais = [...document.querySelectorAll("main")].filter(visivel);
    if (principais.length !== 1) {
      problemas.push(`${principais.length} elementos <main> visíveis (deve haver 1)`);
    }

    const campos = document.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:not([type=hidden]), select, textarea");
    for (const campo of campos) {
      if (!visivel(campo)) {
        continue;
      }
      const temRotulo =
        (campo.labels?.length ?? 0) > 0 ||
        Boolean(campo.getAttribute("aria-label")?.trim()) ||
        Boolean(campo.getAttribute("aria-labelledby"));
      if (!temRotulo) {
        problemas.push(`campo sem rótulo: ${descrever(campo)}`);
      }
    }

    for (const elemento of document.querySelectorAll("a[href], button, [role=button]")) {
      if (visivel(elemento) && !nomeAcessivel(elemento)) {
        problemas.push(`botão ou link sem nome acessível: ${elemento.outerHTML.slice(0, 80)}`);
      }
    }

    for (const imagem of document.querySelectorAll("img")) {
      if (visivel(imagem) && !imagem.hasAttribute("alt")) {
        problemas.push(`imagem sem alt: ${imagem.getAttribute("src") ?? ""}`);
      }
    }

    const titulos = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(visivel);
    const niveis = titulos.map((titulo) => Number(titulo.tagName[1]));
    const h1 = niveis.filter((nivel) => nivel === 1).length;
    if (h1 !== 1) {
      problemas.push(`${h1} títulos <h1> visíveis (deve haver 1)`);
    }
    titulos.forEach((titulo, indice) => {
      const nivel = niveis[indice] ?? 1;
      const anterior = niveis[indice - 1];
      if (anterior !== undefined && nivel > anterior + 1) {
        problemas.push(`título pula de h${anterior} para h${nivel}: ${descrever(titulo)}`);
      }
    });

    // Reflow (WCAG 1.4.10): nada de rolagem lateral, nem texto vazando de um diálogo.
    const raiz = document.documentElement;
    if (raiz.scrollWidth > raiz.clientWidth + 1) {
      // Aponta os elementos mais externos que passam da borda (os culpados).
      const passaDaBorda = (elemento: Element | null) =>
        elemento !== null && elemento.getBoundingClientRect().right > raiz.clientWidth + 1;
      const culpados = [...document.body.querySelectorAll("*")]
        .filter((elemento) => visivel(elemento) && passaDaBorda(elemento))
        .filter((elemento) => !passaDaBorda(elemento.parentElement))
        .slice(0, 3)
        .map(
          (elemento) => `${descrever(elemento)} [${elemento.className.toString().slice(0, 60)}]`,
        );
      problemas.push(
        `rolagem lateral: página com ${raiz.scrollWidth}px em ${raiz.clientWidth}px (${culpados.join("; ")})`,
      );
    }
    for (const dialogo of document.querySelectorAll("dialog[open]")) {
      if (dialogo.scrollWidth > dialogo.clientWidth + 1) {
        problemas.push(`conteúdo mais largo que o diálogo: ${descrever(dialogo)}`);
      }
    }

    return problemas;
  });
}
