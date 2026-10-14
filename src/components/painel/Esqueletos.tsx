import type { ReactNode } from "react";

import {
  Carregando,
  Esqueleto,
  EsqueletoDeIndicadores,
  EsqueletoDeLista,
} from "@/components/ui/Esqueleto";
import { EsqueletoQueSai } from "@/components/ui/Revelacao";

/**
 * Esqueletos das telas do painel (`loading.tsx`). Cada um repete a forma da
 * tela que vai chegar (título, filtros, lista, cartões), para nada pular de
 * lugar quando os dados aparecem.
 */

function Tela({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <EsqueletoQueSai>
      <Carregando rotulo={rotulo}>{children}</Carregando>
    </EsqueletoQueSai>
  );
}

function Titulo({ comDescricao = true }: { comDescricao?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <Esqueleto className="h-8 w-48" />
      {comDescricao && <Esqueleto className="h-4 w-64 max-w-full" />}
    </div>
  );
}

function CartaoVazio({ className = "", linhas = 3 }: { className?: string; linhas?: number }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5 sm:p-6 ${className}`}
    >
      <Esqueleto className="h-5 w-40" />
      {Array.from({ length: linhas }, (_, indice) => (
        <Esqueleto key={indice} className="h-4 w-full" />
      ))}
    </div>
  );
}

function Filtros() {
  return <Esqueleto className="mb-4 h-14 w-full rounded-lg sm:h-24" />;
}

/** Listas com filtros: leads, empresas, usuários e auditoria. */
export function EsqueletoDeListaComFiltros({ rotulo }: { rotulo: string }) {
  return (
    <Tela rotulo={rotulo}>
      <Titulo />
      <Filtros />
      <EsqueletoDeLista linhas={6} />
    </Tela>
  );
}

export function EsqueletoDaVisaoGeral() {
  return (
    <Tela rotulo="Carregando a visão geral">
      <Titulo />
      <div className="flex flex-col gap-6">
        <EsqueletoDeIndicadores />
        <div className="grid gap-6 lg:grid-cols-2">
          <CartaoVazio linhas={4} />
          <CartaoVazio linhas={4} />
        </div>
        <CartaoVazio linhas={3} />
      </div>
    </Tela>
  );
}

export function EsqueletoDoLead() {
  return (
    <Tela rotulo="Carregando o lead">
      <Esqueleto className="mb-4 h-5 w-40" />
      <div className="mb-6 flex items-center gap-3">
        <Esqueleto className="h-8 w-56 max-w-full" />
        <Esqueleto className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5 sm:p-6">
            <Esqueleto className="h-5 w-32" />
            <div className="flex items-center gap-4">
              <Esqueleto className="h-10 w-24" />
              <Esqueleto className="h-3 flex-1 rounded-full" />
            </div>
            <Esqueleto className="h-4 w-full" />
            <Esqueleto className="h-4 w-4/5" />
          </div>
          <CartaoVazio linhas={2} />
        </div>
        <div className="flex flex-col gap-6">
          <CartaoVazio linhas={5} />
          <CartaoVazio linhas={2} />
        </div>
      </div>
    </Tela>
  );
}

/** Telas de formulário em cartões: empresa e perfil. */
export function EsqueletoDeFormularios({ rotulo }: { rotulo: string }) {
  return (
    <Tela rotulo={rotulo}>
      <Titulo />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <CartaoVazio linhas={4} />
          <CartaoVazio linhas={3} />
        </div>
        <CartaoVazio linhas={3} />
      </div>
    </Tela>
  );
}

export function EsqueletoDosMembros() {
  return (
    <Tela rotulo="Carregando os membros">
      <Titulo />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EsqueletoDeLista linhas={4} />
        </div>
        <CartaoVazio linhas={3} />
      </div>
    </Tela>
  );
}

/** Reserva genérica para qualquer outra tela do painel. */
export function EsqueletoDoPainel() {
  return (
    <Tela rotulo="Carregando">
      <Titulo />
      <EsqueletoDeLista />
    </Tela>
  );
}
