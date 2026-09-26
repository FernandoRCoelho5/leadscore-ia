import { AreaDeTexto, CampoTexto } from "@/components/ui/Campo";

type ValoresDoPerfil = {
  descricao?: string | null;
  produtosServicos?: string | null;
  clienteIdeal?: string | null;
  ticketMedioCentavos?: number | null;
  regioesAtendidas?: string | null;
};

/**
 * Campos do perfil do negócio (onboarding e configurações). É o contexto que a
 * IA usa para pontuar cada lead: quanto mais específico, melhor a nota.
 */
export function CamposDoPerfilDoNegocio({
  erros,
  valores = {},
}: {
  erros: Record<string, string>;
  valores?: ValoresDoPerfil;
}) {
  return (
    <>
      <AreaDeTexto
        id="descricao"
        rotulo="O que a sua empresa faz"
        required
        maxLength={1000}
        defaultValue={valores.descricao ?? ""}
        ajuda="Em poucas frases, como você explicaria para um cliente novo."
        erro={erros.descricao}
      />
      <AreaDeTexto
        id="clienteIdeal"
        rotulo="Cliente ideal"
        required
        maxLength={1000}
        defaultValue={valores.clienteIdeal ?? ""}
        ajuda="Porte, segmento, região e quem decide a compra. Ex.: indústrias de 10 a 200 funcionários no Sul Fluminense."
        erro={erros.clienteIdeal}
      />
      <AreaDeTexto
        id="produtosServicos"
        rotulo="Produtos e serviços"
        opcional
        rows={3}
        maxLength={1000}
        defaultValue={valores.produtosServicos ?? ""}
        erro={erros.produtosServicos}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto
          id="ticketMedioReais"
          rotulo="Ticket médio (R$)"
          opcional
          inputMode="numeric"
          defaultValue={
            valores.ticketMedioCentavos != null ? String(valores.ticketMedioCentavos / 100) : ""
          }
          ajuda="Valor médio de uma venda, em reais."
          erro={erros.ticketMedioReais}
        />
        <CampoTexto
          id="regioesAtendidas"
          rotulo="Regiões atendidas"
          opcional
          maxLength={500}
          defaultValue={valores.regioesAtendidas ?? ""}
          erro={erros.regioesAtendidas}
        />
      </div>
    </>
  );
}
