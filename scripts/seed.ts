import "./carregarEnv";

import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { db, encerrarBanco } from "../src/db";
import { env } from "../src/env";
import {
  analises,
  empresas,
  leads,
  usuarios,
  type Classificacao,
  type StatusLead,
} from "../src/db/schema";
import { auth } from "../src/server/auth/auth";
import { consumirAnalise } from "../src/server/repositories/usoMensal";
import { criarVinculo } from "../src/server/repositories/usuarios";

/**
 * Seed de demonstração:
 * - Norte Digital (agência B2B, slug "demo"): leads quentes, mornos, frios e
 *   um pendente, com duas pessoas na empresa (para a tela Membros);
 * - Horizonte Contábil (slug "demo-contabil"): outra empresa, com outra
 *   pessoa, para mostrar que um cliente não vê os dados do outro;
 * - um usuário de cada perfil da equipe Brasa (admin e suporte).
 *
 * Regras: só INSERE dados, nunca apaga nem altera. Empresa ou usuário que já
 * existe é mantido como está (pode rodar quantas vezes quiser). As análises
 * são marcadas como mock (não vieram da Claude API).
 *
 * Uso: npm run seed
 */

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

const LEADS_DA_AGENCIA: LeadDeDemonstracao[] = [
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

const LEADS_DA_CONTABILIDADE: LeadDeDemonstracao[] = [
  {
    nome: "Sílvia Prado",
    email: "silvia@pradoalimentos.example",
    empresaNome: "Prado Alimentos",
    segmento: "Indústria",
    mensagem:
      "Somos uma indústria de alimentos com 60 funcionários e vamos sair do Simples Nacional no ano que vem. Precisamos de planejamento tributário e da contabilidade completa a partir de janeiro.",
    status: "em_contato",
    diasAtras: 1,
    analise: {
      score: 90,
      classificacao: "quente",
      justificativa:
        "Indústria de médio porte, exatamente o perfil atendido, com mudança de regime tributário e data de início definida.",
      respostaSugerida:
        "Olá, Sílvia! A saída do Simples é o momento certo para um planejamento tributário. Podemos marcar uma reunião esta semana para simular os regimes com os números da Prado Alimentos?",
    },
  },
  {
    nome: "Gustavo Reis",
    email: "gustavo@reislogistica.example",
    empresaNome: "Reis Logística",
    segmento: "Logística",
    mensagem:
      "Estamos insatisfeitos com o escritório atual e queremos trocar de contabilidade. Temos 35 funcionários.",
    status: "novo",
    diasAtras: 2,
    analise: {
      score: 79,
      classificacao: "quente",
      justificativa:
        "Empresa B2B dentro do porte ideal, com intenção clara de troca; falta só o prazo.",
      respostaSugerida:
        "Olá, Gustavo! Cuidamos de toda a transição do escritório anterior, sem interromper a folha nem as obrigações. Posso te ligar amanhã para entender o que não está funcionando hoje?",
    },
  },
  {
    nome: "Helena Duarte",
    email: "helena@duartedesign.example",
    empresaNome: "Duarte Design",
    segmento: "Serviços",
    mensagem: "Sou MEI e queria saber quanto custa para abrir uma empresa. Ainda estou pensando.",
    status: "novo",
    diasAtras: 3,
    analise: {
      score: 38,
      classificacao: "frio",
      justificativa:
        "Microempreendedora em fase de pesquisa, abaixo do porte atendido e sem prazo.",
      respostaSugerida:
        "Olá, Helena! Obrigado pelo contato. Para quem está começando, o próprio portal do Empreendedor ajuda bastante. Quando a empresa crescer, será um prazer conversar!",
    },
  },
  {
    nome: "Otávio Mendes",
    email: "otavio@mendesauto.example",
    empresaNome: "Mendes Autopeças",
    segmento: "Comércio",
    mensagem: "Temos 3 lojas e queremos organizar o fiscal e o estoque. Podem mandar uma proposta?",
    status: "novo",
    diasAtras: 0,
  },
];

type EmpresaDeDemonstracao = {
  slug: string;
  nome: string;
  descricao: string;
  produtosServicos: string;
  clienteIdeal: string;
  ticketMedioCentavos: number;
  regioesAtendidas: string;
  leads: LeadDeDemonstracao[];
};

const EMPRESAS: EmpresaDeDemonstracao[] = [
  {
    slug: "demo",
    nome: "Norte Digital (demonstração)",
    descricao:
      "Agência de marketing digital especializada em pequenas e médias empresas B2B: sites institucionais, tráfego pago e automação de vendas.",
    produtosServicos:
      "Criação de sites e landing pages; gestão de tráfego pago (Google e Meta Ads); SEO; automação de marketing e integração com CRM.",
    clienteIdeal:
      "Indústrias, distribuidoras e empresas de serviços B2B com 10 a 200 funcionários que querem gerar mais oportunidades comerciais pela internet.",
    ticketMedioCentavos: 450_000,
    regioesAtendidas:
      "Sul Fluminense, Rio de Janeiro e Vale do Paraíba, com atendimento remoto em todo o Brasil.",
    leads: LEADS_DA_AGENCIA,
  },
  {
    slug: "demo-contabil",
    nome: "Horizonte Contábil (demonstração)",
    descricao:
      "Escritório de contabilidade para empresas de médio porte: fiscal, folha de pagamento e planejamento tributário.",
    produtosServicos:
      "Contabilidade completa; departamento pessoal; planejamento tributário; abertura e transição de empresas.",
    clienteIdeal:
      "Indústrias, comércios e prestadores de serviço com 20 a 300 funcionários, fora do Simples Nacional ou prestes a sair dele.",
    ticketMedioCentavos: 250_000,
    regioesAtendidas: "Sul Fluminense e Vale do Paraíba.",
    leads: LEADS_DA_CONTABILIDADE,
  },
];

/** Cria a empresa com os leads (se ainda não existir) e devolve o id dela. */
async function semearEmpresa(definicao: EmpresaDeDemonstracao): Promise<string> {
  const { slug, leads: leadsDaEmpresa, ...perfil } = definicao;
  const [existente] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(and(eq(empresas.slug, slug), isNull(empresas.deletedAt)))
    .limit(1);
  if (existente) {
    console.log(`A empresa de demonstração "${slug}" já existe: empresa e leads mantidos.`);
    return existente.id;
  }

  const agora = Date.now();
  const resumo = await db.transaction(async (tx) => {
    const [empresa] = await tx
      .insert(empresas)
      .values({ slug, ...perfil })
      .returning();
    if (!empresa) {
      throw new Error("O banco não devolveu a empresa de demonstração.");
    }

    let comAnalise = 0;
    for (const [indice, dados] of leadsDaEmpresa.entries()) {
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

    return { id: empresa.id, empresa: empresa.nome, leads: leadsDaEmpresa.length, comAnalise };
  });

  console.log(
    `Empresa "${resumo.empresa}" (slug "${slug}") criada com ${resumo.leads} leads, ` +
      `${resumo.comAnalise} com análise de demonstração.`,
  );
  return resumo.id;
}

type UsuarioDeDemonstracao = {
  email: string;
  nome: string;
  papel: "admin" | "suporte" | "cliente";
  /** Slug da empresa da qual o cliente é membro. */
  empresa?: string;
};

const USUARIOS: UsuarioDeDemonstracao[] = [
  { email: "admin@demo.brasa.example", nome: "Ana Admin", papel: "admin" },
  { email: "suporte@demo.brasa.example", nome: "Sérgio Suporte", papel: "suporte" },
  {
    email: "cliente@demo.brasa.example",
    nome: "Carlos Cliente",
    papel: "cliente",
    empresa: "demo",
  },
  { email: "vendas@demo.brasa.example", nome: "Marina Vendas", papel: "cliente", empresa: "demo" },
  {
    email: "contabil@demo.brasa.example",
    nome: "Bruna Contábil",
    papel: "cliente",
    empresa: "demo-contabil",
  },
];

/**
 * Cria os usuários (se ainda não existirem). As contas passam pela API do
 * Better Auth (hash da senha e auditoria). Sem SEED_SENHA_DEMO, as senhas são
 * aleatórias e aparecem só uma vez no terminal: nunca ficam no código.
 */
async function semearUsuarios(empresasPorSlug: Map<string, string>): Promise<void> {
  // Senha única opcional (SEED_SENHA_DEMO no .env.local); sem ela, uma aleatória por usuário.
  const senhaDefinida = process.env.SEED_SENHA_DEMO?.trim() || undefined;
  if (senhaDefinida !== undefined && senhaDefinida.length < 10) {
    throw new Error("SEED_SENHA_DEMO precisa ter pelo menos 10 caracteres.");
  }
  const criados: { email: string; papel: string; senha: string }[] = [];

  for (const dados of USUARIOS) {
    const [existente] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, dados.email))
      .limit(1);
    if (existente) {
      console.log(`Usuário ${dados.email} já existe: mantido.`);
      continue;
    }

    const senha = senhaDefinida ?? randomBytes(12).toString("base64url");
    const { user } = await auth.api.signUpEmail({
      body: { name: dados.nome, email: dados.email, password: senha },
    });

    if (dados.papel === "cliente") {
      const empresaId = dados.empresa ? empresasPorSlug.get(dados.empresa) : undefined;
      if (!empresaId) {
        throw new Error(`Empresa de demonstração "${dados.empresa ?? "?"}" não encontrada.`);
      }
      await criarVinculo(db, user.id, empresaId);
    } else {
      await db
        .update(usuarios)
        .set({ papelPlataforma: dados.papel })
        .where(eq(usuarios.id, user.id));
    }
    criados.push({ email: dados.email, papel: dados.papel, senha });
  }

  if (criados.length > 0) {
    console.log("\nUsuários de demonstração criados (anote: as senhas não aparecem de novo):");
    for (const { email, papel, senha } of criados) {
      // Com SEED_SENHA_DEMO, a senha não é exibida: está no próprio .env.local.
      const exibida = senhaDefinida ? "a definida em SEED_SENHA_DEMO (.env.local)" : senha;
      console.log(`  ${papel.padEnd(8)} ${email}  senha: ${exibida}`);
    }
    console.log("");
  }
}

async function principal(): Promise<void> {
  const empresasPorSlug = new Map<string, string>();
  for (const definicao of EMPRESAS) {
    empresasPorSlug.set(definicao.slug, await semearEmpresa(definicao));
  }
  await semearUsuarios(empresasPorSlug);

  // Só o nome do banco (parte final da URL), nunca a URL com credenciais.
  const banco = new URL(env.DATABASE_URL).pathname.slice(1);
  console.log(`Seed concluído no banco "${banco}".`);
}

principal()
  .catch((erro: unknown) => {
    console.error("Falha no seed:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => encerrarBanco());
