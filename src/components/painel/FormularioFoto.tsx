"use client";

import { Camera, CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";

import { enviarFotoAcao, removerFotoAcao } from "@/app/(painel)/perfil/acoes";
import { Alerta, Avatar } from "@/components/ui/Avisos";
import { Botao, classesDeBotao } from "@/components/ui/Botao";
import {
  BYTES_DA_ASSINATURA,
  FOTO_LADO_MAXIMO,
  MENSAGEM_DO_PROBLEMA,
  TIPOS_DE_FOTO,
  tipoRealDaImagem,
} from "@/lib/validacao/foto";

/** Maior arquivo aceito ANTES do ajuste no navegador (fotos de celular têm de 3 a 8 MB). */
const ORIGINAL_MAXIMO = 20 * 1024 * 1024;
const ID_CONFIRMACAO = "confirmar-remocao-da-foto";

/**
 * Reduz a foto para no máximo 512 px e a regrava (WebP, ou JPEG se o navegador
 * não gerar WebP). Além de deixar o envio leve, a regravação descarta os
 * metadados do arquivo original, como a localização (GPS) da câmera.
 */
async function prepararFoto(original: File): Promise<File> {
  const imagem = await createImageBitmap(original);
  const escala = Math.min(1, FOTO_LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext("2d");
  if (!contexto) {
    throw new Error("Canvas indisponível");
  }
  contexto.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();

  const gerar = (tipo: string) =>
    new Promise<Blob | null>((resolver) => tela.toBlob(resolver, tipo, 0.85));
  let resultado = await gerar("image/webp");
  if (resultado?.type !== "image/webp") {
    // JPEG não tem transparência: pinta um fundo branco atrás da imagem.
    contexto.globalCompositeOperation = "destination-over";
    contexto.fillStyle = "white";
    contexto.fillRect(0, 0, largura, altura);
    resultado = await gerar("image/jpeg");
  }
  if (!resultado) {
    throw new Error("Falha ao gerar a imagem");
  }
  const extensao = resultado.type === "image/webp" ? "webp" : "jpg";
  return new File([resultado], `foto.${extensao}`, { type: resultado.type });
}

/** Conferência rápida no navegador, pelos bytes; a que vale é a do servidor. */
async function problemaNoArquivo(arquivo: File): Promise<string | null> {
  if (arquivo.size > ORIGINAL_MAXIMO) {
    return "Escolha uma imagem de até 20 MB.";
  }
  const inicio = new Uint8Array(await arquivo.slice(0, BYTES_DA_ASSINATURA).arrayBuffer());
  return tipoRealDaImagem(inicio) ? null : MENSAGEM_DO_PROBLEMA.tipo;
}

/**
 * Foto do perfil: escolher já envia (com prévia imediata no avatar); remover
 * pede confirmação. Erros aparecem abaixo dos botões e são anunciados.
 */
export function FormularioFoto({ nome, fotoUrl }: { nome: string; fotoUrl: string | null }) {
  const refEntrada = useRef<HTMLInputElement>(null);
  const refConfirmacao = useRef<HTMLDivElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Libera a memória da prévia quando ela sai da tela.
  useEffect(() => {
    if (!previa) {
      return;
    }
    return () => URL.revokeObjectURL(previa);
  }, [previa]);

  async function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const entrada = evento.currentTarget;
    const original = entrada.files?.[0];
    // Limpa a escolha, para que escolher o mesmo arquivo de novo funcione.
    entrada.value = "";
    setErro(null);
    setAviso(null);
    if (!original) {
      return;
    }

    const problema = await problemaNoArquivo(original);
    if (problema) {
      setErro(problema);
      return;
    }
    let foto: File;
    try {
      foto = await prepararFoto(original);
    } catch {
      setErro("Não conseguimos abrir esta imagem. Tente outra.");
      return;
    }

    setPrevia(URL.createObjectURL(foto));
    const dados = new FormData();
    dados.set("foto", foto);
    iniciar(async () => {
      const resultado = await enviarFotoAcao(dados);
      setPrevia(null);
      if (resultado.ok) {
        setAviso("Foto atualizada.");
      } else {
        setErro(resultado.erro.detalhes?.[0]?.mensagem ?? resultado.erro.mensagem);
      }
    });
  }

  function remover() {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await removerFotoAcao();
      refConfirmacao.current?.hidePopover();
      if (resultado.ok) {
        setAviso("Foto removida.");
        // O botão "Remover foto" some: o foco volta para a escolha de arquivo.
        refEntrada.current?.focus();
      } else {
        setErro(resultado.erro.mensagem);
      }
    });
  }

  return (
    <div className="mb-5 flex items-start gap-4" aria-busy={pendente || undefined}>
      <div className="relative shrink-0">
        <Avatar nome={nome} fotoUrl={previa ?? fotoUrl} tamanho="lg" />
        {pendente && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-superficie/70 text-texto">
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="text-sm">
          <p className="font-medium">Foto</p>
          <p id="foto-ajuda" className="text-texto-suave">
            JPEG, PNG ou WebP. Antes do envio, reduzimos a imagem para até {FOTO_LADO_MAXIMO} px e
            removemos dados como a localização.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={refEntrada}
            id="foto"
            type="file"
            accept={TIPOS_DE_FOTO.join(",")}
            disabled={pendente}
            onChange={aoEscolher}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "foto-ajuda foto-erro" : "foto-ajuda"}
            className="peer sr-only"
          />
          <label
            htmlFor="foto"
            className={`${classesDeBotao("contorno")} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foco peer-disabled:cursor-not-allowed peer-disabled:opacity-60`}
          >
            <Camera aria-hidden="true" className="size-4" />
            {fotoUrl ? "Trocar foto" : "Escolher foto"}
          </label>
          {fotoUrl && (
            <button
              type="button"
              popoverTarget={ID_CONFIRMACAO}
              disabled={pendente}
              className={classesDeBotao("fantasma")}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remover foto
            </button>
          )}
        </div>

        {pendente && (
          <p role="status" className="text-sm text-texto-suave">
            Salvando a foto…
          </p>
        )}
        {erro && (
          <p id="foto-erro" role="alert" className="flex items-start gap-1.5 text-sm text-erro">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
        {aviso && <Alerta tipo="sucesso">{aviso}</Alerta>}
      </div>

      <div
        ref={refConfirmacao}
        id={ID_CONFIRMACAO}
        popover="auto"
        role="dialog"
        aria-labelledby="titulo-remover-foto"
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-borda bg-superficie p-5 text-texto shadow-lg backdrop:bg-carvao-950/50"
      >
        <p id="titulo-remover-foto" className="font-semibold">
          Remover a sua foto?
        </p>
        <p className="mt-1 text-sm text-texto-suave">
          As suas iniciais voltam a aparecer no lugar dela. Você pode enviar outra quando quiser.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            popoverTarget={ID_CONFIRMACAO}
            popoverTargetAction="hide"
            className={classesDeBotao("contorno")}
          >
            Cancelar
          </button>
          <Botao variante="destrutivo" onClick={remover} carregando={pendente}>
            Remover foto
          </Botao>
        </div>
      </div>
    </div>
  );
}
