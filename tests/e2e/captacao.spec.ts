import { Pool } from "@neondatabase/serverless";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";

/**
 * Formulário público de captação com banco real (D-028). Roda só com
 * E2E_COM_BANCO=1 (no CI, na branch "e2e" do Neon). Cada teste cria a própria
 * empresa e só insere dados, com e-mails do domínio reservado .example.
 */

config({ path: ".env.local", quiet: true });

test.skip(!process.env.E2E_COM_BANCO, "Defina E2E_COM_BANCO=1 para rodar os testes com banco.");

/** O servidor descarta envios feitos menos de 3 s depois de abrir a página (anti-robô). */
const TEMPO_DE_UMA_PESSOA_MS = 3_200;

function unico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** IP fictício (faixa de documentação 203.0.113.0/24): cada teste tem o próprio limite. */
function ipFicticio() {
  return `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
}

async function consultar<Linha extends Record<string, unknown>>(
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

async function criarEmpresa(): Promise<{ slug: string; nome: string }> {
  const slug = unico("captacao");
  const nome = `Agência E2E ${slug.slice(-6)}`;
  await consultar(
    `INSERT INTO empresas (id, nome, slug, descricao, cliente_ideal)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
    [
      nome,
      slug,
      "Agência que cria sites e lojas virtuais para empresas B2B.",
      "Indústrias de 20 a 300 funcionários no Sul Fluminense.",
    ],
  );
  return { slug, nome };
}

/** Abre a página como um navegador faria e devolve o carimbo assinado do formulário. */
async function carimboDaPagina(request: APIRequestContext, slug: string): Promise<string> {
  const html = await (await request.get(`/f/${slug}`)).text();
  const carimbo = html.match(/name="carimbo" value="([^"]+)"/)?.[1];
  if (!carimbo) {
    throw new Error("a página não trouxe o carimbo");
  }
  return carimbo;
}

function envio(email: string, carimbo: string) {
  return {
    nome: "Pessoa de Teste",
    email,
    telefone: "",
    empresaNome: "Metalúrgica Teste",
    segmento: "Indústria",
    mensagem: "Queremos um site novo com catálogo de produtos. Podem enviar uma proposta?",
    consentimento: "sim",
    carimbo,
    website: "",
  };
}

test("o visitante envia o formulário, vê a confirmação e o lead é analisado", async ({ page }) => {
  const { slug, nome } = await criarEmpresa();
  const email = `${unico("lead")}@teste.brasa.example`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ipFicticio() });

  await page.goto(`/f/${slug}`);
  await expect(page.getByRole("heading", { name: `Fale com ${nome}` })).toBeVisible();
  await page.getByLabel("Seu nome").fill("Pessoa de Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Segmento da sua empresa").selectOption("Indústria");
  await page
    .getByLabel("Como podemos ajudar?")
    .fill("Somos uma indústria com 80 funcionários e queremos um site novo este mês.");
  await page.getByLabel(/Concordo que/).check();
  await page.waitForTimeout(TEMPO_DE_UMA_PESSOA_MS);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  // O formulário dá lugar à confirmação, que recebe o foco.
  await expect(page.getByRole("heading", { name: "Mensagem enviada" })).toBeFocused();
  await expect(page.getByText(email)).toBeVisible();

  const [lead] = await consultar<{
    consentimento_versao_texto: string;
    tamanho_do_hash: number;
    origem: string;
  }>(
    `SELECT consentimento_versao_texto, length(ip_hash) AS tamanho_do_hash, origem
       FROM leads WHERE email = $1`,
    [email],
  );
  expect(lead).toEqual({
    consentimento_versao_texto: "v1",
    tamanho_do_hash: 64,
    origem: "formulario",
  });

  // A análise roda depois da resposta (after()); no CI, com o motor simulado.
  await expect
    .poll(
      async () =>
        (
          await consultar<{ status_analise: string }>(
            "SELECT status_analise FROM leads WHERE email = $1",
            [email],
          )
        )[0]?.status_analise,
      { timeout: 15_000 },
    )
    .toBe("concluida");
});

test("o sexto envio do mesmo IP em 10 minutos recebe 429", async ({ request }) => {
  const { slug } = await criarEmpresa();
  const carimbo = await carimboDaPagina(request, slug);
  await new Promise((resolver) => setTimeout(resolver, TEMPO_DE_UMA_PESSOA_MS));
  const ip = ipFicticio();

  const status: number[] = [];
  let ultima;
  for (let i = 0; i < 6; i += 1) {
    ultima = await request.post(`/api/publico/${slug}/leads`, {
      headers: { "x-forwarded-for": ip },
      data: envio(`${unico("limite")}@teste.brasa.example`, carimbo),
    });
    status.push(ultima.status());
  }

  expect(status).toEqual([201, 201, 201, 201, 201, 429]);
  expect(Number(ultima?.headers()["retry-after"])).toBeGreaterThan(0);
});

test("robôs recebem 'sucesso', mas nada é gravado", async ({ request }) => {
  const { slug } = await criarEmpresa();
  const carimbo = await carimboDaPagina(request, slug);
  const rapido = `${unico("rapido")}@teste.brasa.example`;
  const armadilha = `${unico("armadilha")}@teste.brasa.example`;

  // Envio imediato, sem o tempo de uma pessoa preencher.
  const respostaRapida = await request.post(`/api/publico/${slug}/leads`, {
    headers: { "x-forwarded-for": ipFicticio() },
    data: envio(rapido, carimbo),
  });
  await new Promise((resolver) => setTimeout(resolver, TEMPO_DE_UMA_PESSOA_MS));
  // Campo-armadilha preenchido.
  const respostaArmadilha = await request.post(`/api/publico/${slug}/leads`, {
    headers: { "x-forwarded-for": ipFicticio() },
    data: { ...envio(armadilha, carimbo), website: "https://spam.example" },
  });

  expect(respostaRapida.status()).toBe(201);
  expect(respostaArmadilha.status()).toBe(201);
  const gravados = await consultar("SELECT id FROM leads WHERE email IN ($1, $2)", [
    rapido,
    armadilha,
  ]);
  expect(gravados).toEqual([]);
});
