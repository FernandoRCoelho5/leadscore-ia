import { useId, type ReactNode } from "react";

export type TemaDaAmostra = "claro" | "escuro";

/**
 * Uma seção do catálogo com o mesmo conteúdo nos dois temas, lado a lado
 * (`data-tema` vale num trecho da página). O conteúdo é uma função do tema
 * para que ids de campos não se repitam entre os dois lados.
 */
export function Amostra({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: (tema: TemaDaAmostra) => ReactNode;
}) {
  const idDoTitulo = useId();
  return (
    <section aria-labelledby={idDoTitulo} className="flex flex-col gap-3">
      <div>
        <h2 id={idDoTitulo} className="text-xl font-semibold">
          {titulo}
        </h2>
        {descricao && <p className="mt-1 max-w-3xl text-sm text-texto-suave">{descricao}</p>}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {(["claro", "escuro"] as const).map((tema) => (
          <div
            key={tema}
            data-tema={tema}
            className="flex min-w-0 flex-col gap-4 rounded-xl border border-borda p-5"
          >
            <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
              Tema {tema}
            </p>
            {children(tema)}
          </div>
        ))}
      </div>
    </section>
  );
}
