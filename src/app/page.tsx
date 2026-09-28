import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { Logo } from "@/components/marca/Logo";

/**
 * Página inicial provisória: apresenta a marca até existir a área logada
 * (Etapa 4). Sem links para telas que ainda não existem.
 */
export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center sm:px-6">
      <Logo className="h-10 w-auto sm:h-12" />

      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-3xl leading-tight font-bold text-balance sm:text-4xl">
          Seus leads mais quentes, primeiro.
        </h1>
        <p className="text-lg text-pretty text-texto-suave">
          A Brasa analisa cada contato com inteligência artificial e mostra com quem falar primeiro
          e o que dizer.
        </p>
      </div>

      <ul
        aria-label="Como a Brasa classifica os leads"
        className="flex flex-wrap justify-center gap-2"
      >
        <li>
          <BadgeClassificacao classificacao="quente" />
        </li>
        <li>
          <BadgeClassificacao classificacao="morno" />
        </li>
        <li>
          <BadgeClassificacao classificacao="frio" />
        </li>
      </ul>

      <p className="text-sm text-texto-suave">Painel em construção.</p>
    </main>
  );
}
