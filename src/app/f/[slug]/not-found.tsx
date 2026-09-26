import { SearchX } from "lucide-react";

import { env } from "@/env";

import { MolduraDoFormulario } from "./MolduraDoFormulario";

/** Endereço de formulário inexistente, ou de empresa bloqueada ou excluída. */
export default function FormularioNaoEncontrado() {
  return (
    <MolduraDoFormulario urlDaBrasa={env.URL_DO_APP}>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <SearchX aria-hidden="true" className="size-12 text-texto-suave" />
        <h1 className="text-xl font-semibold text-texto">Formulário não encontrado</h1>
        <p className="max-w-sm text-texto-suave">
          O endereço pode estar incompleto ou o formulário foi desativado. Confira o link com a
          empresa que o divulgou.
        </p>
      </div>
    </MolduraDoFormulario>
  );
}
