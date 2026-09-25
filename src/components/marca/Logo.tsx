import { CAMINHO_CHAMA, CAMINHO_NOME, HORIZONTAL } from "./caminhos";

type PropsDoLogo = {
  /** "horizontal" (chama + nome) ou "simbolo" (só a chama). */
  variante?: "horizontal" | "simbolo";
  /**
   * Use `decorativo` quando o nome "Brasa" já estiver escrito ao lado: o logo
   * fica oculto para leitores de tela e o nome não é lido duas vezes.
   */
  decorativo?: boolean;
  /** Tamanho via classes (ex.: "h-8 w-auto"). */
  className?: string;
};

/**
 * Logotipo Brasa como SVG embutido: nítido em qualquer tamanho e sem
 * requisição extra. A chama usa sempre o laranja da marca; o nome usa a cor do
 * texto em volta (`currentColor`): carvão no tema claro e creme no escuro.
 */
export function Logo({ variante = "horizontal", decorativo = false, className }: PropsDoLogo) {
  const acessibilidade = decorativo
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": "Brasa" } as const);

  if (variante === "simbolo") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...acessibilidade}>
        <path className="fill-brasa-500" fillRule="evenodd" d={CAMINHO_CHAMA} />
      </svg>
    );
  }

  return (
    <svg viewBox={HORIZONTAL.viewBox} className={className} {...acessibilidade}>
      <path
        className="fill-brasa-500"
        fillRule="evenodd"
        transform={HORIZONTAL.transformChama}
        d={CAMINHO_CHAMA}
      />
      <path fill="currentColor" transform={HORIZONTAL.transformNome} d={CAMINHO_NOME} />
    </svg>
  );
}
