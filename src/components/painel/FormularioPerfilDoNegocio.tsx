"use client";

import { salvarPerfilDoNegocioAcao } from "@/app/(painel)/configuracoes/acoes";
import { Alerta, ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { useFormulario } from "@/components/ui/useFormulario";
import { esquemaPerfilDoNegocio } from "@/lib/validacao/empresa";

import { CamposDoPerfilDoNegocio } from "./CamposDoPerfilDoNegocio";

type Valores = Parameters<typeof CamposDoPerfilDoNegocio>[0]["valores"];

export function FormularioPerfilDoNegocio({ valores }: { valores: Valores }) {
  const { aoEnviar, erros, erroGeral, pendente, sucesso, refResumo } = useFormulario({
    esquema: esquemaPerfilDoNegocio,
    enviar: (_dados, brutos) => salvarPerfilDoNegocioAcao(brutos),
  });

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      <CamposDoPerfilDoNegocio erros={erros} valores={valores} />
      {/* A confirmação fica junto do botão: em formulário longo, é onde a pessoa está olhando. */}
      <div className="flex flex-col gap-3">
        {sucesso && (
          <Alerta tipo="sucesso">
            Perfil salvo. As próximas análises já usam essas informações.
          </Alerta>
        )}
        <div>
          <Botao type="submit" carregando={pendente}>
            Salvar perfil
          </Botao>
        </div>
      </div>
    </form>
  );
}
