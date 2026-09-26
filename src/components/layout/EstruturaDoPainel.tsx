import {
  Building2,
  ChevronDown,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  ScrollText,
  Settings,
  Sun,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { definirEmpresaAtivaAcao, definirTemaAcao, sairAcao } from "@/app/acoes";
import { Logo } from "@/components/marca/Logo";
import { Avatar } from "@/components/ui/Avisos";
import { COOKIE_DO_TEMA, lerTema, type Tema } from "@/lib/tema";
import { pode, type Acao, type Papel } from "@/server/auth/permissoes";
import type { Sessao } from "@/server/auth/sessao";

import { LinkDoMenu, LinkQueFechaPopover } from "./Links";

/**
 * Estrutura da área logada: menu lateral à esquerda (fixo no desktop, em
 * gaveta no celular) e menu superior com o avatar. Os itens do menu seguem a
 * matriz de permissões: cada perfil vê só o que pode usar.
 */

type ItemDoMenu = {
  rotulo: string;
  href: string;
  icone: ReactNode;
  acao: Acao;
  /** Itens que atuam sobre a empresa ativa (ex.: leads). */
  daEmpresa?: boolean;
};

const GRUPOS: { titulo?: string; itens: ItemDoMenu[] }[] = [
  {
    itens: [
      {
        rotulo: "Visão geral",
        href: "/painel",
        icone: <LayoutDashboard aria-hidden="true" />,
        acao: "painel:ver",
      },
      {
        rotulo: "Leads",
        href: "/leads",
        icone: <Inbox aria-hidden="true" />,
        acao: "leads:ver",
        daEmpresa: true,
      },
      {
        rotulo: "Empresa",
        href: "/configuracoes",
        icone: <Settings aria-hidden="true" />,
        acao: "empresa:editar",
        daEmpresa: true,
      },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      {
        rotulo: "Empresas",
        href: "/admin/empresas",
        icone: <Building2 aria-hidden="true" />,
        acao: "empresas:listar",
      },
      {
        rotulo: "Usuários",
        href: "/admin/usuarios",
        icone: <UsersRound aria-hidden="true" />,
        acao: "usuarios:listar",
      },
      {
        rotulo: "Auditoria",
        href: "/admin/auditoria",
        icone: <ScrollText aria-hidden="true" />,
        acao: "auditoria:ver",
      },
    ],
  },
];

const ROTULO_DO_PAPEL: Record<Papel, string> = {
  admin: "Admin · equipe Brasa",
  suporte: "Suporte · equipe Brasa",
  cliente: "Cliente",
};

function itensVisiveis(sessao: Sessao) {
  const empresaId = sessao.empresaAtiva?.empresaId;
  return GRUPOS.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) =>
      item.daEmpresa
        ? empresaId !== undefined && pode(sessao.ator, item.acao, empresaId)
        : pode(sessao.ator, item.acao),
    ),
  })).filter((grupo) => grupo.itens.length > 0);
}

function MenuDeNavegacao({ sessao, emGaveta = false }: { sessao: Sessao; emGaveta?: boolean }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <LinkQueFechaPopover href="/painel" className="rounded-md">
          <span className="sr-only">Brasa, visão geral</span>
          <Logo decorativo className="h-7 w-auto" />
        </LinkQueFechaPopover>
        {emGaveta && (
          <button
            type="button"
            popoverTarget="menu-movel"
            popoverTargetAction="hide"
            aria-label="Fechar menu"
            className="-mr-2 flex size-controle cursor-pointer items-center justify-center rounded-md hover:bg-superficie-2"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        {itensVisiveis(sessao).map((grupo) => (
          <div key={grupo.titulo ?? "principal"} className="flex flex-col gap-1">
            {grupo.titulo && (
              <h2 className="px-3 pb-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">
                {grupo.titulo}
              </h2>
            )}
            <ul className="flex flex-col gap-1">
              {grupo.itens.map((item) => (
                <li key={item.href}>
                  <LinkDoMenu href={item.href} icone={item.icone}>
                    {item.rotulo}
                  </LinkDoMenu>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

const TEMAS: { valor: Tema; rotulo: string; icone: ReactNode }[] = [
  { valor: "claro", rotulo: "Claro", icone: <Sun aria-hidden="true" className="size-4" /> },
  { valor: "escuro", rotulo: "Escuro", icone: <Moon aria-hidden="true" className="size-4" /> },
  { valor: "sistema", rotulo: "Sistema", icone: <Monitor aria-hidden="true" className="size-4" /> },
];

const ITEM =
  "flex h-controle w-full cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-superficie-2 [&>svg]:size-4 [&>svg]:text-texto-suave";

async function MenuDaConta({ sessao }: { sessao: Sessao }) {
  const temaAtual = lerTema((await cookies()).get(COOKIE_DO_TEMA)?.value);
  const { nome, email } = sessao.usuario;
  const primeiroNome = nome.split(" ")[0] ?? nome;

  return (
    <>
      <button
        type="button"
        popoverTarget="menu-da-conta"
        className="flex cursor-pointer items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-superficie-2"
      >
        <Avatar nome={nome} />
        <span className="hidden text-sm font-medium sm:inline">{primeiroNome}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-texto-suave" />
        <span className="sr-only">Abrir o menu da conta</span>
      </button>

      <div
        id="menu-da-conta"
        popover="auto"
        className="fixed inset-auto top-18 right-4 m-0 w-72 rounded-lg border border-borda bg-superficie p-2 text-texto shadow-lg"
      >
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar nome={nome} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{nome}</p>
            <p className="truncate text-sm text-texto-suave">{email}</p>
          </div>
        </div>
        <p className="px-2 pb-2 text-xs text-texto-suave">
          {ROTULO_DO_PAPEL[sessao.papel]}
          {sessao.empresaAtiva ? ` · ${sessao.empresaAtiva.nome}` : ""}
        </p>
        <hr className="my-1 border-borda" />

        <LinkQueFechaPopover href="/perfil" className={ITEM}>
          <UserRound aria-hidden="true" />
          Alterar perfil
        </LinkQueFechaPopover>

        <form action={definirTemaAcao} className="px-2 py-2">
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-texto-suave">Tema</legend>
            <div className="grid grid-cols-3 gap-1">
              {TEMAS.map((tema) => (
                <button
                  key={tema.valor}
                  type="submit"
                  name="tema"
                  value={tema.valor}
                  aria-pressed={temaAtual === tema.valor}
                  className="flex cursor-pointer flex-col items-center gap-1 rounded-md px-2 py-2 text-xs hover:bg-superficie-2 aria-pressed:bg-superficie-2 aria-pressed:font-semibold aria-pressed:text-marca-texto"
                >
                  {tema.icone}
                  {tema.rotulo}
                </button>
              ))}
            </div>
          </fieldset>
        </form>

        <hr className="my-1 border-borda" />
        <form action={sairAcao}>
          <button type="submit" className={ITEM}>
            <LogOut aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </>
  );
}

/** Nome da empresa ativa; com mais de uma, permite trocar. */
function EmpresaAtiva({ sessao }: { sessao: Sessao }) {
  if (sessao.vinculos.length > 1 && sessao.empresaAtiva) {
    return (
      <form action={definirEmpresaAtivaAcao} className="flex items-center gap-2">
        <label htmlFor="empresa-ativa" className="sr-only">
          Empresa
        </label>
        <select
          id="empresa-ativa"
          name="empresaId"
          defaultValue={sessao.empresaAtiva.empresaId}
          className="h-controle max-w-48 rounded-md border border-borda-campo bg-superficie px-2 text-sm"
        >
          {sessao.vinculos.map((vinculo) => (
            <option key={vinculo.empresaId} value={vinculo.empresaId}>
              {vinculo.nome}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-controle cursor-pointer rounded-md px-3 text-sm font-medium hover:bg-superficie-2"
        >
          Trocar
        </button>
      </form>
    );
  }
  return (
    <p className="truncate text-sm font-semibold">
      {sessao.empresaAtiva?.nome ?? "Administração da plataforma"}
    </p>
  );
}

export function EstruturaDoPainel({ sessao, children }: { sessao: Sessao; children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <a
        href="#conteudo"
        className="sr-only rounded-md bg-superficie px-4 py-2 text-sm font-semibold text-texto shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borda bg-superficie lg:flex">
        <MenuDeNavegacao sessao={sessao} />
      </aside>

      {/* Menu em gaveta no celular (popover nativo: fecha com Esc ou tocando fora). */}
      <div
        id="menu-movel"
        popover="auto"
        aria-label="Menu"
        className="inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] flex-col border-0 border-r border-borda bg-superficie p-0 text-texto backdrop:bg-carvao-950/50 [&:popover-open]:flex"
      >
        <MenuDeNavegacao sessao={sessao} emGaveta />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-borda bg-superficie px-4 sm:px-6">
          <button
            type="button"
            popoverTarget="menu-movel"
            aria-label="Abrir menu"
            className="-ml-2 flex size-controle cursor-pointer items-center justify-center rounded-md hover:bg-superficie-2 lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <Link href="/painel" className="rounded-md lg:hidden">
            <span className="sr-only">Brasa, visão geral</span>
            <Logo variante="simbolo" decorativo className="size-7" />
          </Link>
          <div className="min-w-0">
            <EmpresaAtiva sessao={sessao} />
          </div>
          <div className="ml-auto">
            <MenuDaConta sessao={sessao} />
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
