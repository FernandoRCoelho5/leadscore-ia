"use client";

import { useEffect, useRef } from "react";

type Faisca = {
  x: number;
  y: number;
  v: number;
  r: number;
  fase: number;
  alfa: number;
  cor: string;
};

/** Brasa-500 e âmbar-400, as cores das faíscas (decorativas, sem texto). */
const CORES = ["255, 90, 31", "255, 176, 32"];

/**
 * Faíscas subindo da base da abertura da landing (D-034): canvas próprio,
 * sem biblioteca. Decorativo (`aria-hidden`), começa depois que a página
 * fica ociosa (não disputa o LCP), anima a ~30 quadros por segundo e pausa
 * fora da tela, com a aba oculta ou com movimento reduzido. Em telas
 * estreitas (celular) não anima: desenha as faíscas uma vez, paradas, para
 * não gastar a CPU nem a bateria.
 */
export function Faiscas() {
  const refCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = refCanvas.current;
    const contexto = canvas?.getContext("2d");
    if (!canvas || !contexto) {
      return;
    }
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    const estreito = window.matchMedia("(max-width: 767px)");
    let largura = 0;
    let altura = 0;
    let faiscas: Faisca[] = [];
    let quadro = 0;
    let ultimo = 0;
    let visivel = true;

    const nova = (espalhar: boolean): Faisca => ({
      x: Math.random() * largura,
      y: espalhar ? Math.random() * altura : altura + 10,
      v: 0.25 + Math.random() * 0.7,
      r: 0.7 + Math.random() * 1.8,
      fase: Math.random() * Math.PI * 2,
      alfa: 0.35 + Math.random() * 0.55,
      cor: CORES[Math.random() < 0.7 ? 0 : 1] ?? "255, 90, 31",
    });

    function medir() {
      if (!canvas || !contexto) {
        return;
      }
      const densidade = Math.min(2, window.devicePixelRatio || 1);
      largura = canvas.clientWidth;
      altura = canvas.clientHeight;
      canvas.width = largura * densidade;
      canvas.height = altura * densidade;
      contexto.setTransform(densidade, 0, 0, densidade, 0, 0);
      faiscas = Array.from({ length: largura < 640 ? 18 : 54 }, () => nova(true));
    }

    function desenhar(fator: number) {
      if (!contexto) {
        return;
      }
      contexto.clearRect(0, 0, largura, altura);
      for (const f of faiscas) {
        const vida = Math.max(0, Math.min(1, f.y / altura));
        contexto.beginPath();
        contexto.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        contexto.fillStyle = `rgba(${f.cor}, ${(f.alfa * vida * fator).toFixed(3)})`;
        contexto.fill();
      }
    }

    function animar(agora: number) {
      quadro = requestAnimationFrame(animar);
      // ~30 quadros por segundo bastam para faíscas lentas (metade do trabalho).
      if (agora - ultimo < 32) {
        return;
      }
      ultimo = agora;
      for (const f of faiscas) {
        f.y -= f.v * 2;
        f.fase += 0.04;
        f.x += Math.sin(f.fase) * 0.7;
        if (f.y < -10) {
          Object.assign(f, nova(false));
        }
      }
      desenhar(1);
    }

    function ligar() {
      cancelAnimationFrame(quadro);
      if (visivel && !reduzido.matches && !estreito.matches && !document.hidden) {
        quadro = requestAnimationFrame(animar);
      } else {
        desenhar(0.6);
      }
    }

    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada?.isIntersecting ?? false;
      ligar();
    });
    const aoRedimensionar = () => {
      medir();
      ligar();
    };

    // Depois do conteúdo: a página fica pronta e só então as faíscas aparecem.
    const iniciar = () => {
      medir();
      observador.observe(canvas);
      document.addEventListener("visibilitychange", ligar);
      reduzido.addEventListener("change", ligar);
      estreito.addEventListener("change", ligar);
      window.addEventListener("resize", aoRedimensionar);
      ligar();
    };
    // Safari antigo não tem requestIdleCallback.
    const temOcioso = typeof window.requestIdleCallback === "function";
    const espera = temOcioso
      ? window.requestIdleCallback(iniciar, { timeout: 1500 })
      : window.setTimeout(iniciar, 600);

    return () => {
      if (temOcioso) {
        window.cancelIdleCallback(espera);
      } else {
        window.clearTimeout(espera);
      }
      cancelAnimationFrame(quadro);
      observador.disconnect();
      document.removeEventListener("visibilitychange", ligar);
      reduzido.removeEventListener("change", ligar);
      estreito.removeEventListener("change", ligar);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, []);

  return (
    <canvas
      ref={refCanvas}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
    />
  );
}
