"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

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

/**
 * Item do menu lateral. O item da página atual é marcado com aria-current e
 * destacado por cor, peso da fonte e uma barra (não só pela cor).
 */
export function LinkDoMenu({
  href,
  icone,
  children,
}: {
  href: string;
  icone: ReactNode;
  children: ReactNode;
}) {
  const caminho = usePathname();
  const ativo = caminho === href || caminho.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={fecharPopover}
      aria-current={ativo ? "page" : undefined}
      className={`relative flex h-controle items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 [&>svg]:size-5 [&>svg]:shrink-0 ${
        ativo
          ? "bg-superficie-2 font-semibold text-marca-texto before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-primaria"
          : "text-texto-suave hover:bg-superficie-2 hover:text-texto"
      }`}
    >
      {icone}
      {children}
    </Link>
  );
}
