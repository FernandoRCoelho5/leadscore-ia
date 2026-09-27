# Implantação na Vercel

Guia para colocar a Brasa em produção e manter os deploys seguintes. As
decisões por trás de cada passo estão na [D-031](decisoes.md) (e, para os
ambientes, na D-026).

## Como o deploy funciona

| Ambiente | Quando acontece | Banco (branch do Neon) | Endereço |
|---|---|---|---|
| Produção | Merge na `main` | `production` | `BETTER_AUTH_URL` |
| Preview | Push em qualquer outra branch (e cada PR) | `preview` (só schema) | Gerado pela Vercel, atrás do login da Vercel |

O `vercel.json` define o comando de build:

```
npm run db:implantar && npm run build
```

1. `db:implantar` aplica as migrations pendentes no banco daquele ambiente,
   numa transação e com trava. Na primeira vez, registra as migrations que o
   banco já tiver (cópias "schema only").
2. Só depois roda o `next build`. Se a migration falhar, nada é alterado no
   banco, o build para e o deploy anterior continua no ar.

As migrations do projeto só acrescentam (sem `DROP`). Por isso, voltar para
um deploy anterior é seguro: o código antigo funciona com o banco novo.

## Antes do primeiro deploy de produção (uma vez)

### 1. Projeto na Vercel

Em **Settings** do projeto:

- **Functions → Fluid compute:** ligado (é o padrão em projetos novos). A
  análise da IA pode levar até 120 s; sem o Fluid compute, o plano Hobby
  limita as funções a 60 s.
- **Build and Deployment:** não sobrescreva o *Build Command*; ele vem do
  `vercel.json`. A versão do Node vem do `package.json` (24.x).
- **Deployment Protection:** *Vercel Authentication* ligada para os previews.
- **Storage:** o Blob store `brasa` conectado ao projeto (cria o
  `BLOB_STORE_ID` sozinho).

A região das funções (`gru1`, São Paulo) já está no `vercel.json`.

### 2. Variáveis de ambiente

Em **Settings → Environment Variables**, cada variável no ambiente certo.
Segredos diferentes em cada ambiente: uma sessão de um não vale no outro.

| Variável | Production | Preview |
|---|---|---|
| `DATABASE_URL` | Branch `production`, conexão **com pooling** | Branch `preview`, com pooling |
| `BETTER_AUTH_SECRET` | Novo (`openssl rand -base64 32`) | Outro, diferente do de produção |
| `BETTER_AUTH_URL` | `https://` + domínio de produção | **Não definir** (o app usa o endereço do deploy) |
| `IA_MODO` | `mock` até testar os créditos; depois `real` | `mock` |
| `ANTHROPIC_API_KEY` | Chave própria da Vercel (não a do `.env.local`) | Não definir |
| `RESEND_API_KEY` | Chave do Resend | Opcional |
| `EMAIL_REMETENTE` | Remetente verificado no Resend | Opcional |
| `PRIVACIDADE_RESPONSAVEL` | Quem responde pelos dados (ex.: `Equipe Brasa (projeto acadêmico FAETERJ Barra Mansa)`) | Opcional |
| `PRIVACIDADE_CONTATO` | **Obrigatório:** e-mail para os pedidos dos titulares | Opcional |

- Sem `PRIVACIDADE_CONTATO`, o build de produção para com uma mensagem
  clara: a política de privacidade precisa de um canal de contato (LGPD).
- A connection string sai do Neon em **Connect**, com a branch escolhida e
  a opção de pooling.
- Mudar uma variável só vale no próximo deploy: use **Redeploy**.

### 3. Anthropic

- Crie uma chave só para a produção e defina um **limite de gasto mensal** no
  Console. No limite padrão de 100 análises por empresa, o custo estimado é de
  US$ 0,40 por empresa por mês (D-027).
- Antes de trocar `IA_MODO` para `real`, rode localmente
  `npm run ia:avaliar -- --confirmar` e confira as notas.

### 4. E-mail (Resend)

Sem domínio próprio verificado, o Resend só entrega para o e-mail do dono da
conta. Na prática:

- **Convites:** funcionam pelo link na tela (copiar e mandar por WhatsApp,
  por exemplo). O e-mail é só um extra.
- **Recuperação de senha:** só chega ao e-mail do dono da conta do Resend.

Para vender o produto, verifique um domínio próprio no Resend (registros SPF
e DKIM) e use um remetente desse domínio.

## Ordem dos merges

Os PRs das etapas são encadeados: cada um parte do anterior. Mescle em ordem
(#1 na `main`, depois #2 e assim por diante) com **Delete branch** ligado: o
GitHub passa a base do PR seguinte para a `main` sozinho. Sem apagar a
branch, edite a base do próximo PR para `main` antes de mesclar.

Cada merge na `main` gera um deploy de produção.

## Depois do primeiro deploy de produção

1. **Log do build** (Deployments → o deploy → Build Logs): deve aparecer
   `Banco de production: ... aplicada(s), 4 no total.`
2. **Saúde:** `https://<domínio>/api/saude` responde `{"status":"ok"}`.
3. **Páginas públicas:** a página inicial, `/politica-de-privacidade` (com o
   contato) e `/robots.txt` (liberando `/` e bloqueando as áreas logadas).
4. **Primeiro admin:** crie a conta da equipe pelo cadastro do app e promova
   essa conta. No PowerShell, com a URL da branch `production`:

   ```powershell
   $env:DATABASE_URL="<URL da branch production>"; npm run admin:promover -- pessoa@empresa.com.br
   Remove-Item Env:DATABASE_URL
   ```

   O comando mostra o host do banco antes de agir e só funciona enquanto não
   houver admin ativo. Os próximos admins são promovidos pela tela Usuários.
   A segunda linha tira a URL de produção da sessão do terminal.
5. **Fluxo completo:** com uma conta de cliente, cadastre a empresa, envie um
   lead pelo formulário `/f/<endereço>` e confira a análise no painel.
6. **Cabeçalhos de segurança:** `curl -I https://<domínio>` deve mostrar
   `content-security-policy`, `strict-transport-security` e
   `x-frame-options`.

A produção começa vazia: o `npm run seed` recusa bancos de produção
(`VERCEL_ENV=production` ou contas com e-mail real).

## No dia a dia

- **Nova migration:** siga o fluxo do README (gerar, revisar o SQL, aplicar
  no banco de desenvolvimento). No deploy, ela chega sozinha aos bancos
  `preview` e `production`.
- **Voltar um deploy:** Deployments → deploy anterior → **Instant Rollback**.
  O banco não volta, e não precisa (as migrations só acrescentam).
- **Erros:** Logs do projeto na Vercel. O app registra em JSON; filtre por
  `"nivel":"error"`. Nenhum log leva dados pessoais nem segredos.
- **Monitoramento:** um monitor de disponibilidade pode consultar
  `/api/saude` a cada poucos minutos.
- **Backup:** o Neon restaura o banco num momento anterior (*point-in-time
  restore*). A janela depende do plano; confira no painel do Neon.

## Custos e planos

- **Vercel Hobby:** gratuito, mas não permite uso comercial. Serve para a
  entrega acadêmica; a venda exige o plano Pro (US$ 20 por mês por membro).
- **Neon, Resend e Anthropic:** os planos gratuitos do Neon e do Resend
  atendem a demonstração. A Anthropic cobra por uso (ver acima).

## Pendências para a versão comercial

- Domínio próprio (app e e-mail).
- Revisão jurídica da política de privacidade e termos de uso.
- Marco Civil da Internet (art. 15): uma empresa formal, com fins
  econômicos, precisa guardar os registros de acesso (IP, data e hora) por
  6 meses. Hoje o IP fica só na sessão ativa, e a auditoria guarda um código
  derivado dele.
- Exclusão da conta pela própria pessoa (hoje, por pedido ao contato de
  privacidade, com anonimização).
- Fila ou rotina que retome análises interrompidas (D-007); hoje a reanálise
  é manual.
