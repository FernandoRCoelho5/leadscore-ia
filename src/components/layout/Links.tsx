"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition, type MouseEvent, type ReactNode } from "react";

/** Fecha o popover (menu do celular ou da conta) em que o link está, ao navegar. */
function fecharPopover(evento: MouseEvent<HTMLAnchorElement>) {
  evento.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
}

export function LinkQueFechaPopover({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} onClick={fecharPopover} className={className}>
      {children}
    </Link>
  );
}

/** Barra do item ativo, à esquerda. */
function Indicador() {
  return (
    <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r bg-primaria" />
  );
}

/**
 * Item do menu lateral. O item da página atual é marcado com aria-current e
 * destacado por cor, peso da fonte e uma barra (não só pela cor).
 *
 * No menu do computador, a barra desliza do item antigo para o novo ao
 * navegar: é o mesmo elemento nomeado nas duas telas (`<ViewTransition name>`)
 * e o navegador anima a posição. Só um menu pode ter o nome por vez; o da
 * gaveta do celular usa a barra parada.
 *
 * Com o menu recolhido, o texto vira uma dica ao lado do ícone (`.rotulo-do-menu`).
 */
export function LinkDoMenu({
  href,
  icone,
  indicadorAnimado = false,
  children,
}: {
  href: string;
  icone: ReactNode;
  indicadorAnimado?: boolean;
  children: ReactNode;
}) {
  const caminho = usePathname();
  const ativo = caminho === href || caminho.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={fecharPopover}
      aria-current={ativo ? "page" : undefined}
      className={`relative flex h-controle items-center gap-3 rounded-md px-3 text-sm transition-colors group-data-[recolhido=true]/menu:justify-center group-data-[recolhido=true]/menu:px-0 [&>svg]:size-5 [&>svg]:shrink-0 ${
        ativo
          ? "bg-superficie-2 font-semibold text-marca-texto"
          : "text-texto-suave hover:bg-superficie-2 hover:text-texto"
      }`}
    >
      {ativo &&
        (indicadorAnimado ? (
          <ViewTransition name="indicador-do-menu" share="deslizar" default="none">
            <Indicador />
          </ViewTransition>
        ) : (
          <Indicador />
        ))}
      {icone}
      <span className="rotulo-do-menu">{children}</span>
    </Link>
  );
}
