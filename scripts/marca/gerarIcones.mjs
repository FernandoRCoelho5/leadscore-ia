/**
 * Gera os ícones do app (convenções do Next.js em src/app/) a partir dos SVGs
 * aprovados da marca em public/marca/. Rode de novo se o logotipo mudar.
 *
 * - icon.svg: favicon moderno (chama ampliada para ler bem em 16px).
 * - apple-icon.png: 180 × 180, quadrado cheio e opaco (o iOS arredonda os cantos).
 * - favicon.ico: 16, 32 e 48 px num só arquivo, para navegadores antigos.
 *
 * Uso: npm run marca:icones
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const favicon = readFileSync("public/marca/brasa-favicon.svg", "utf8");
// Ícone da Apple sem cantos arredondados e sem transparência.
const appleSvg = readFileSync("public/marca/brasa-app.svg", "utf8").replace(
  /rx="[\d.]+"/,
  'rx="0"',
);

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

/** Rasteriza um SVG em PNG do tamanho pedido (fundo transparente fora do desenho). */
async function paraPng(svg, tamanho) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho });
  const dados = Buffer.from(svg).toString("base64");
  await pagina.setContent(
    `<html><body style="margin:0"><img src="data:image/svg+xml;base64,${dados}" width="${tamanho}" height="${tamanho}" style="display:block"></body></html>`,
  );
  await pagina.locator("img").evaluate((img) => img.decode());
  return pagina.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: tamanho, height: tamanho },
  });
}

/** Monta um .ico com imagens PNG embutidas (formato aceito por todos os navegadores atuais). */
function montarIco(imagens) {
  const cabecalho = Buffer.alloc(6 + imagens.length * 16);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // tipo: ícone
  cabecalho.writeUInt16LE(imagens.length, 4);
  let deslocamento = cabecalho.length;
  imagens.forEach(({ tamanho, png }, i) => {
    const entrada = 6 + i * 16;
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, entrada); // largura
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, entrada + 1); // altura
    cabecalho.writeUInt8(0, entrada + 2); // paleta
    cabecalho.writeUInt8(0, entrada + 3); // reservado
    cabecalho.writeUInt16LE(1, entrada + 4); // planos
    cabecalho.writeUInt16LE(32, entrada + 6); // bits por pixel
    cabecalho.writeUInt32LE(png.length, entrada + 8);
    cabecalho.writeUInt32LE(deslocamento, entrada + 12);
    deslocamento += png.length;
  });
  return Buffer.concat([cabecalho, ...imagens.map(({ png }) => png)]);
}

try {
  copyFileSync("public/marca/brasa-favicon.svg", "src/app/icon.svg");
  writeFileSync("src/app/apple-icon.png", await paraPng(appleSvg, 180));

  const tamanhos = [16, 32, 48];
  const imagens = [];
  for (const tamanho of tamanhos) {
    imagens.push({ tamanho, png: await paraPng(favicon, tamanho) });
  }
  writeFileSync("src/app/favicon.ico", montarIco(imagens));

  console.log(
    "Ícones gerados: src/app/icon.svg, src/app/apple-icon.png (180px) e src/app/favicon.ico (16/32/48px).",
  );
} finally {
  await navegador.close();
}
