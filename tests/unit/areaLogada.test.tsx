import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LinkDoMenu } from "@/components/layout/Links";
import { MenuLateral } from "@/components/layout/MenuLateral";
import { EsqueletoDoLead, EsqueletoDeListaComFiltros } from "@/components/painel/Esqueletos";
import { FiltrosRecolhiveis } from "@/components/painel/FiltrosRecolhiveis";
import { BlocoDeIndicador } from "@/components/painel/Indicadores";
import { QuentesSemResposta } from "@/components/painel/QuentesSemResposta";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { ProvedorDeToasts } from "@/components/ui/Toasts";
import { COOKIE_DO_MENU, lerMenuRecolhido, VALOR_RECOLHIDO } from "@/lib/menu";

/** Área logada (Etapa 4 da reformulação): menu, esqueletos, filtros e indicadores. */

// O `ViewTransition` vem no React canary que o Next embute; o React estável
// dos testes ainda não o tem. Aqui ele só repassa o conteúdo, como num
// navegador sem suporte.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ViewTransition: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/leads/123" }));

describe("cookie do menu lateral", () => {
  it("só 'recolhido' recolhe; qualquer outro valor (ou nenhum) deixa aberto", () => {
    expect(COOKIE_DO_MENU).toBe("menu");
    expect(lerMenuRecolhido(VALOR_RECOLHIDO)).toBe(true);
    expect(lerMenuRecolhido(undefined)).toBe(false);
    expect(lerMenuRecolhido("RECOLHIDO")).toBe(false);
    expect(lerMenuRecolhido("<script>")).toBe(false);
  });
});

describe("MenuLateral", () => {
  it("chega do servidor já no estado salvo, com o botão dizendo o que vai fazer", () => {
    const recolhido = renderToStaticMarkup(
      <MenuLateral recolhidoInicial>
        <nav />
      </MenuLateral>,
    );
    const aberto = renderToStaticMarkup(
      <MenuLateral recolhidoInicial={false}>
        <nav />
      </MenuLateral>,
    );

    expect(recolhido).toContain('data-recolhido="true"');
    expect(recolhido).toContain("Expandir menu");
    expect(aberto).toContain('data-recolhido="false"');
    expect(aberto).toContain("Recolher menu");
  });
});

describe("LinkDoMenu", () => {
  it("o texto fica no link (nome acessível) e vira dica com o menu recolhido", () => {
    const ativo = renderToStaticMarkup(
      <LinkDoMenu href="/leads" icone={<svg aria-hidden="true" />} indicadorAnimado>
        Leads
      </LinkDoMenu>,
    );
    const outro = renderToStaticMarkup(
      <LinkDoMenu href="/membros" icone={<svg aria-hidden="true" />}>
        Membros
      </LinkDoMenu>,
    );

    expect(ativo).toContain('<span class="rotulo-do-menu">Leads</span>');
    // Dentro de /leads/123, "Leads" é a página atual e tem a barra (não só a cor).
    expect(ativo).toContain('aria-current="page"');
    expect(ativo).toContain("bg-primaria");
    expect(outro).not.toContain("aria-current");
    expect(outro).not.toContain("bg-primaria");
  });
});

describe("esqueletos do painel", () => {
  it("anunciam a espera aos leitores de tela, sem títulos falsos", () => {
    const lista = renderToStaticMarkup(<EsqueletoDeListaComFiltros rotulo="Carregando os leads" />);
    const lead = renderToStaticMarkup(<EsqueletoDoLead />);

    for (const html of [lista, lead]) {
      expect(html).toContain('role="status" aria-busy="true"');
      expect(html).not.toMatch(/<h[1-6]/);
    }
    expect(lista).toContain('<span class="sr-only">Carregando os leads</span>');
    expect(lead).toContain('<span class="sr-only">Carregando o lead</span>');
  });
});

describe("FiltrosRecolhiveis", () => {
  it("no celular, começa recolhido sem filtro e aberto com filtro aplicado", () => {
    const sem = renderToStaticMarkup(
      <FiltrosRecolhiveis temFiltro={false}>
        <form />
      </FiltrosRecolhiveis>,
    );
    const com = renderToStaticMarkup(
      <FiltrosRecolhiveis temFiltro>
        <form />
      </FiltrosRecolhiveis>,
    );

    expect(sem).toContain('aria-expanded="false"');
    expect(sem).toContain('class="hidden md:mt-0 md:block md:animate-none"');
    // Ao carregar já filtrado, os filtros aparecem sem animação.
    expect(com).not.toContain("animate-entrar");
    expect(com).toContain('aria-expanded="true"');
    expect(com).toContain("com filtros");
    // Do tablet para cima, o botão some e os filtros ficam sempre à vista.
    expect(sem).toContain("md:hidden");
  });
});

describe("BlocoDeIndicador", () => {
  it("números contam ao aparecer; textos como '3 / 100' aparecem direto", () => {
    const numero = renderToStaticMarkup(
      <dl>
        <BlocoDeIndicador rotulo="Leads" valor={12} ordem={2} />
      </dl>,
    );
    const texto = renderToStaticMarkup(
      <dl>
        <BlocoDeIndicador rotulo="Análises" valor="3 / 100" />
      </dl>,
    );

    expect(numero).toContain("numero-animado");
    expect(numero).toContain("--i:2");
    expect(texto).toContain("3 / 100");
    expect(texto).not.toContain("numero-animado");
  });
});

describe("BotaoCopiar", () => {
  it("funciona dentro do provedor de toasts (todo o painel tem um)", () => {
    const html = renderToStaticMarkup(
      <ProvedorDeToasts>
        <BotaoCopiar texto="Olá!" rotulo="Copiar resposta" confirmacao="Resposta copiada." />
      </ProvedorDeToasts>,
    );

    expect(html).toContain("Copiar resposta");
  });
});

describe("QuentesSemResposta", () => {
  it("leva à lista já filtrada e concorda em número", () => {
    const um = renderToStaticMarkup(<QuentesSemResposta quantidade={1} />);
    const varios = renderToStaticMarkup(<QuentesSemResposta quantidade={3} />);

    expect(um).toContain("1 lead quente esperando resposta");
    expect(um).toContain("Ele ainda está");
    expect(varios).toContain("3 leads quentes esperando resposta");
    expect(varios).toContain('href="/leads?classificacao=quente&amp;status=novo"');
    // O brilho que respira marca o que é urgente.
    expect(varios).toContain("animate-respirar");
  });
});
