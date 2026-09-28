import "./carregarEnv";

import { and, eq, isNull } from "drizzle-orm";

import { db, encerrarBanco } from "../src/db";
import { env } from "../src/env";
import { analises, empresas, leads, type Classificacao, type StatusLead } from "../src/db/schema";
import { consumirAnalise } from "../src/server/repositories/usoMensal";

/**
 * Seed básico: uma empresa de demonstração (agência B2B) com leads quentes,
 * mornos, frios e um pendente, para desenvolver e apresentar o painel.
 *
 * Regras: só INSERE dados, nunca apaga nem altera. Se a empresa de
 * demonstração já existir, não faz nada (pode rodar quantas vezes quiser).
 * As análises são marcadas como mock (não vieram da Claude API).
 *
 * Uso: npm run seed
 */

const SLUG_DEMO = "demo";
const DIA_EM_MS = 24 * 60 * 60 * 1000;

type LeadDeDemonstracao = {
  nome: string;
  email: string | null;
  empresaNome: string | null;
  segmento: string;
  mensagem: string;
  status: StatusLead;
  diasAtras: number;
  analise?: {
    score: number;
    classificacao: Classificacao;
    justificativa: string;
    respostaSugerida: string;
  };
};

const LEADS: LeadDeDemonstracao[] = [
  {
    nome: "Rafael Monteiro",
    email: "rafael@metalurgicamonteiro.example",
    empresaNome: "Metalúrgica Monteiro",
    segmento: "Indústria",
    mensagem:
      "Somos uma metalúrgica com 80 funcionários em Volta Redonda. Precisamos de um site novo e de campanhas no Google para captar distribuidores ainda neste trimestre. O orçamento já está aprovado.",
    status: "em_contato",
    diasAtras: 2,
    analise: {
      score: 92,
      classificacao: "quente",
      justificativa:
        "Indústria de médio porte, exatamente o cliente ideal; necessidade clara (site e Google Ads), prazo curto e orçamento aprovado.",
      respostaSugerida:
        "Olá, Rafael! Obrigado pelo contato. Atendemos várias indústrias do Sul Fluminense com site e Google Ads voltados à captação de distribuidores. Podemos marcar uma conversa de 30 minutos amanhã para entender suas metas do trimestre?",
    },
  },
  {
    nome: "Juliana Castro",
    email: "juliana@valesul.example",
    empresaNome: "Distribuidora Vale Sul",
    segmento: "Distribuição",
    mensagem:
      "Queremos automatizar o funil de vendas e integrar o site ao nosso CRM. Temos 3 vendedores e precisamos começar em outubro.",
    status: "novo",
    diasAtras: 1,
    analise: {
      score: 88,
      classificacao: "quente",
      justificativa:
        "Distribuidora B2B com equipe comercial; pede automação e integração com CRM, serviços centrais da agência, com data de início definida.",
      respostaSugerida:
        "Olá, Juliana! Automação de funil integrada ao CRM é uma das nossas especialidades. Consigo te apresentar um plano de implantação para começar em outubro. Qual o melhor horário para uma conversa esta semana?",
    },
  },
  {
    nome: "Eduardo Lima",
    email: "eduardo@limaassociados.example",
    empresaNome: "Lima & Associados Contabilidade",
    segmento: "Serviços contábeis",
    mensagem:
      "Escritório com 25 colaboradores; queremos atrair empresas de médio porte como clientes. Buscamos SEO e tráfego pago com urgência.",
    status: "ganho",
    diasAtras: 12,
    analise: {
      score: 81,
      classificacao: "quente",
      justificativa:
        "Empresa de serviços B2B dentro do porte ideal, com urgência declarada e interesse em SEO e tráfego pago.",
      respostaSugerida:
        "Olá, Eduardo! Temos cases com escritórios contábeis que passaram a atrair empresas de médio porte com SEO e anúncios. Posso te enviar uma proposta até sexta-feira?",
    },
  },
  {
    nome: "Patrícia Nogueira",
    email: "patricia@translogbm.example",
    empresaNome: "TransLog Barra Mansa",
    segmento: "Logística",
    mensagem:
      "Precisamos de uma landing page e anúncios para um novo serviço de armazenagem. Prazo de 30 dias.",
    status: "novo",
    diasAtras: 3,
    analise: {
      score: 76,
      classificacao: "quente",
      justificativa:
        "Empresa B2B da região atendida, com escopo definido (landing page e anúncios) e prazo de 30 dias; porte ainda não informado.",
      respostaSugerida:
        "Olá, Patrícia! Conseguimos entregar a landing page e colocar os anúncios no ar dentro do seu prazo de 30 dias. Pode me contar um pouco mais sobre o novo serviço de armazenagem?",
    },
  },
  {
    nome: "Bruno Tavares",
    email: "bruno@odontovida.example",
    empresaNome: "Clínica OdontoVida",
    segmento: "Saúde",
    mensagem: "Gostaríamos de entender quanto custa um site novo. Ainda estamos avaliando.",
    status: "novo",
    diasAtras: 5,
    analise: {
      score: 64,
      classificacao: "morno",
      justificativa:
        "Há necessidade de site, mas a clínica atende pessoas físicas (fora do foco B2B) e ainda está em fase de avaliação.",
      respostaSugerida:
        "Olá, Bruno! Posso te enviar faixas de investimento para sites de clínicas e alguns exemplos do nosso trabalho. Vocês já têm algum prazo em mente?",
    },
  },
  {
    nome: "Camila Rocha",
    email: "camila@pixelsoftware.example",
    empresaNome: "Software House Pixel",
    segmento: "Tecnologia",
    mensagem: "Estamos pesquisando agências para o próximo ano, sem data definida.",
    status: "novo",
    diasAtras: 7,
    analise: {
      score: 58,
      classificacao: "morno",
      justificativa:
        "Perfil B2B aderente, mas sem necessidade específica nem prazo; contato em fase inicial de pesquisa.",
      respostaSugerida:
        "Olá, Camila! Que bom que estão nos considerando. Posso te mandar nosso portfólio com projetos para empresas de tecnologia e retomamos quando vocês definirem o planejamento do próximo ano?",
    },
  },
  {
    nome: "Marcos Vieira",
    email: "marcos@construtoravieira.example",
    empresaNome: "Construtora Vieira",
    segmento: "Construção civil",
    mensagem: "Vi o anúncio de vocês. Vocês fazem gestão de redes sociais?",
    status: "em_contato",
    diasAtras: 9,
    analise: {
      score: 52,
      classificacao: "morno",
      justificativa:
        "Empresa com porte provável dentro do perfil, mas o pedido (redes sociais) não é o serviço principal da agência.",
      respostaSugerida:
        "Olá, Marcos! Nosso foco é site, tráfego pago e automação de vendas, que costumam gerar mais oportunidades para construtoras do que as redes sociais sozinhas. Quer que eu te explique como funcionaria no seu caso?",
    },
  },
  {
    nome: "Fernanda Alves",
    email: "fernanda@alvesrh.example",
    empresaNome: "Alves Consultoria RH",
    segmento: "Consultoria",
    mensagem:
      "Somos uma consultoria pequena (4 pessoas) e queremos melhorar o site. O orçamento é limitado.",
    status: "novo",
    diasAtras: 4,
    analise: {
      score: 47,
      classificacao: "morno",
      justificativa:
        "Serviço B2B, mas abaixo do porte ideal e com orçamento limitado, o que dificulta atingir o ticket médio.",
      respostaSugerida:
        "Olá, Fernanda! Temos um pacote enxuto de reformulação de site pensado para consultorias menores. Posso te enviar os detalhes?",
    },
  },
  {
    nome: "Lucas Martins",
    email: "lucas.fotos@exemplo.example",
    empresaNome: null,
    segmento: "Pessoa física",
    mensagem: "Quero um site para o meu portfólio pessoal de fotografia.",
    status: "perdido",
    diasAtras: 15,
    analise: {
      score: 28,
      classificacao: "frio",
      justificativa:
        "Pessoa física com projeto pessoal, fora do público B2B e muito abaixo do ticket médio.",
      respostaSugerida:
        "Olá, Lucas! Obrigado pelo contato. Nosso trabalho é voltado a empresas, então talvez uma plataforma de portfólio pronta atenda melhor ao seu projeto. Sucesso com as fotos!",
    },
  },
  {
    nome: "Ana Beatriz Souza",
    email: "anabeatriz@universidade.example",
    empresaNome: null,
    segmento: "Estudante",
    mensagem:
      "Estou fazendo um trabalho da faculdade sobre marketing digital. Vocês podem me mandar materiais?",
    status: "novo",
    diasAtras: 6,
    analise: {
      score: 18,
      classificacao: "frio",
      justificativa: "Pedido acadêmico, sem intenção de compra.",
      respostaSugerida:
        "Olá, Ana Beatriz! Que legal o tema do seu trabalho. Temos alguns artigos no nosso blog que podem ajudar. Boa sorte!",
    },
  },
  {
    nome: "Oferta Especial",
    email: "vendas@listas.example",
    empresaNome: "Marketing Express",
    segmento: "Outros",
    mensagem: "Vendemos listas de e-mails com 1 milhão de contatos. Chame no WhatsApp.",
    status: "perdido",
    diasAtras: 10,
    analise: {
      score: 5,
      classificacao: "frio",
      justificativa:
        "Mensagem promocional (spam) oferecendo listas de e-mail; não é um potencial cliente.",
      respostaSugerida: "Não responder: mensagem promocional.",
    },
  },
  {
    nome: "Roberto Farias",
    email: "roberto@fariasengenharia.example",
    empresaNome: "Farias Engenharia",
    segmento: "Engenharia",
    mensagem: "Gostaria de um orçamento para site e Google Ads.",
    status: "novo",
    diasAtras: 0,
  },
];

async function principal(): Promise<void> {
  const [existente] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(and(eq(empresas.slug, SLUG_DEMO), isNull(empresas.deletedAt)))
    .limit(1);
  if (existente) {
    console.log(`A empresa de demonstração "${SLUG_DEMO}" já existe. Nada foi inserido.`);
    return;
  }

  const agora = Date.now();
  const resumo = await db.transaction(async (tx) => {
    const [empresa] = await tx
      .insert(empresas)
      .values({
        nome: "Norte Digital (demonstração)",
        slug: SLUG_DEMO,
        descricao:
          "Agência de marketing digital especializada em pequenas e médias empresas B2B: sites institucionais, tráfego pago e automação de vendas.",
        produtosServicos:
          "Criação de sites e landing pages; gestão de tráfego pago (Google e Meta Ads); SEO; automação de marketing e integração com CRM.",
        clienteIdeal:
          "Indústrias, distribuidoras e empresas de serviços B2B com 10 a 200 funcionários que querem gerar mais oportunidades comerciais pela internet.",
        ticketMedioCentavos: 450_000,
        regioesAtendidas:
          "Sul Fluminense, Rio de Janeiro e Vale do Paraíba, com atendimento remoto em todo o Brasil.",
      })
      .returning();
    if (!empresa) {
      throw new Error("O banco não devolveu a empresa de demonstração.");
    }

    let comAnalise = 0;
    for (const [indice, dados] of LEADS.entries()) {
      const criadoEm = new Date(agora - dados.diasAtras * DIA_EM_MS - indice * 60_000);
      const [lead] = await tx
        .insert(leads)
        .values({
          empresaId: empresa.id,
          nome: dados.nome,
          email: dados.email,
          telefone: `(24) 90000-${String(indice + 1).padStart(4, "0")}`,
          empresaNome: dados.empresaNome,
          segmento: dados.segmento,
          mensagem: dados.mensagem,
          status: dados.status,
          consentimentoLgpd: true,
          consentimentoEm: criadoEm,
          consentimentoVersaoTexto: "v1",
          statusAnalise: dados.analise ? "concluida" : "pendente",
          scoreAtual: dados.analise?.score ?? null,
          classificacaoAtual: dados.analise?.classificacao ?? null,
          createdAt: criadoEm,
          updatedAt: criadoEm,
        })
        .returning({ id: leads.id });
      if (!lead || !dados.analise) {
        continue;
      }

      const analisadoEm = new Date(criadoEm.getTime() + 5_000);
      await tx.insert(analises).values({
        leadId: lead.id,
        empresaId: empresa.id,
        ...dados.analise,
        modelo: "seed-demonstracao",
        promptVersion: "seed",
        perfilVersao: 1,
        tempoRespostaMs: 1500,
        mock: true,
        createdAt: analisadoEm,
        updatedAt: analisadoEm,
      });
      await consumirAnalise(tx, empresa.id, empresa.limiteAnalisesMes);
      comAnalise += 1;
    }

    return { empresa: empresa.nome, leads: LEADS.length, comAnalise };
  });

  // Só o nome do banco (parte final da URL), nunca a URL com credenciais.
  const banco = new URL(env.DATABASE_URL).pathname.slice(1);
  console.log(
    `Seed aplicado no banco "${banco}": empresa "${resumo.empresa}" (slug "${SLUG_DEMO}"), ` +
      `${resumo.leads} leads, ${resumo.comAnalise} com análise de demonstração.`,
  );
}

principal()
  .catch((erro: unknown) => {
    console.error("Falha no seed:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => encerrarBanco());
