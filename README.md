# Consigna Mais

Simulador educacional de empréstimo consignado: uma interface em português consulta dois bancos fictícios por HTTP, interpreta contratos diferentes e apresenta os resultados individualmente.

**Todos os dados e critérios são fictícios. Não há contratação, persistência de dados pessoais ou integração com bancos reais.**

## Executar sem Docker

Pré-requisito: **Node.js 24 LTS**, com npm. Se usa nvm: `nvm use`.

```bash
npm ci
npm run dev
```

Abra **http://localhost:5173**. O comando inicia a interface, a API (4000) e os bancos simulados (4001). Use **Usar dados de exemplo** e **Comparar condições**. Para encerrar, pressione Ctrl+C. As portas precisam estar livres. Não é necessário criar `.env`.

## Executar com Docker

Pré-requisito: Docker com Compose e o serviço do Docker em execução.

```bash
docker compose up --build
```

Abra **http://localhost:8080**. Os serviços internos só ficam disponíveis na rede do Compose; apenas a interface expõe uma porta. O frontend usa um proxy para a API, evitando configurações de CORS. O Compose aguarda a saúde dos serviços antes de iniciar seus dependentes.

```bash
docker compose down
```

A primeira execução baixa dependências e imagens, portanto exige internet. Depois da instalação, a lógica funciona localmente. A fonte visual usa Google Fonts com fontes locais de fallback caso esteja offline.

## Deploy na Vercel

Importe este repositório como **um único projeto**, usando a branch de produção `main` e **Root Directory na raiz do repositório** (não `apps/web`). O arquivo `vercel.json` configura Vite, instalação `npm ci`, build `npm run build` e saída `apps/web/dist`. Selecione **Node.js 24.x** nas configurações do projeto.

O frontend é estático e `/api/*` é atendido por uma função Node.js que reutiliza a API Express e os mocks em `/api/mock-banks`. A função não abre uma porta. Os adaptadores continuam consultando os dois bancos por HTTP, agora no endereço do próprio deployment. Não é necessário publicar três projetos nem executar Docker na Vercel.

Por padrão, não configure `BANK_BASE_URL`: a aplicação usa `https://<VERCEL_URL>/api/mock-banks`, com a variável de sistema fornecida pela Vercel. As variáveis `BANK_A_MODE`, `BANK_B_MODE` e `BANK_TIMEOUT_MS` continuam opcionais. Para demonstrar falhas, use um deployment de Preview e restaure os modos para `normal` antes da avaliação.

Se o Preview estiver protegido, crie um segredo em **Settings → Deployment Protection → Protection Bypass for Automation**, selecionando-o para preencher `VERCEL_AUTOMATION_BYPASS_SECRET`, e faça um novo deploy. O servidor envia esse segredo nas consultas internas apenas quando o destino é a origem do próprio deployment. Ele não é enviado ao frontend, incluído nos logs ou encaminhado para um `BANK_BASE_URL` externo. Consulte a [documentação de previews protegidos](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

Após publicar, confira `/api/health`, o preenchimento por exemplo e a simulação. Verifique também que o avaliador consegue abrir a URL de produção sem entrar na sua conta. A conferência da URL pública depende do deploy realizado pelo autor.

## Arquitetura e decisões

```text
Navegador (React)
    │ POST /api/simulations
    ▼
API Express → valida entrada → consulta bancos em paralelo
    ├── adaptador Aurora ──HTTP──→ /bank-a/simulate
    └── adaptador Horizonte ─HTTP→ /bank-b/simulate
    │ valida e normaliza respostas
    ▼
Resultados: aprovado / reprovado / indisponível
```

| Módulo               | Responsabilidade                                                             |
| -------------------- | ---------------------------------------------------------------------------- |
| `apps/web`           | Formulário, validação para feedback imediato e exibição dos resultados       |
| `apps/api`           | Validação de entrada, coordenação, timeout, adaptação e tratamento de falhas |
| `apps/bank-mocks`    | Dois endpoints HTTP determinísticos com contratos diferentes                 |
| `packages/contracts` | Schemas Zod e tipos compartilhados entre frontend e backend                  |

- TypeScript com modo estrito; Zod valida entrada e dados recebidos por HTTP em tempo de execução.
- O Banco Aurora responde com um booleano e valores em centavos. O Horizonte usa decisões textuais e valores em reais. Os adaptadores validam e convertem ambos para o mesmo modelo.
- Chamadas paralelas, com cancelamento após **3 segundos por banco**, inclusive se o corpo da resposta travar. Falha de rede, erro HTTP ou contrato inválido afeta somente o respectivo resultado.
- Reprovação é uma decisão do simulador. Indisponibilidade é uma falha técnica; a aplicação não confunde as duas.
- CPF e CNPJ são strings, com normalização e validação de dígitos verificadores. CNPJ aceita letras nas primeiras 12 posições conforme o [algoritmo da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj). Isso valida a estrutura, não comprova identidade ou cadastro.
- Valores da API são inteiros em centavos. A apresentação usa reais em pt-BR. Identificadores com zero inicial são preservados.
- Sem banco de dados ou autenticação: a jornada solicitada é uma consulta imediata. Os dados ficam apenas em memória durante o processamento e no formulário aberto.
- Logs estruturados registram identificador da consulta, banco, status e duração. Não registram CPF, CNPJ, nome, e-mail, salário ou payloads externos.
- Docker é opcional. npm workspaces mantém a instalação e os comandos centralizados, sem adicionar ferramentas de monorepo.

## API

`POST /api/simulations`, com `Content-Type: application/json`:

```json
{
  "name": "Marina Exemplo",
  "email": "marina@example.com",
  "cpf": "52998224725",
  "employerCnpj": "11222333000181",
  "salaryCents": 500000,
  "amountCents": 1500000,
  "installments": 24
}
```

Prazos aceitos: 12, 24 e 36 meses. Os valores devem ser inteiros em centavos e limitados a R$ 1 milhão nesta demonstração. O salário deve ser positivo; o empréstimo mínimo é **R$ 100,00**, evitando parcelas arredondadas para zero. Esse limite é uma escolha da demonstração.

A resposta contém `requestId` e dois `results`, cada um com `bankId`, `bankName`, `status` e `message`. Um resultado `approved` também contém `offer` com `installmentCents`, `installments`, `monthlyRatePercent` e `totalCents`. Os demais estados são `rejected` e `unavailable`.

| HTTP | Significado                                                                      |
| ---- | -------------------------------------------------------------------------------- |
| 200  | Consulta processada, inclusive com indisponibilidade parcial ou total dos bancos |
| 400  | Entrada inválida; `errors` identifica os campos, ou JSON malformado              |
| 413  | Corpo excede 16 KB                                                               |
| 500  | Falha interna inesperada, sem exposição de stack trace                           |

`GET /api/health` verifica se a API está ativa. O estado de saúde dos bancos é consultado separadamente em `/health` no serviço de mocks.

## Condições financeiras ilustrativas

| Banco fictício | Taxa mensal | Limite ilustrativo da parcela |
| -------------- | ----------: | ----------------------------: |
| Aurora         |        1,8% |      25% do salário informado |
| Horizonte      |        2,2% |      30% do salário informado |

Os mocks usam a fórmula Price `P × i / (1 − (1 + i)^−n)`, onde P é o principal, i a taxa mensal decimal e n o prazo. A parcela é arredondada ao centavo; o total é a parcela arredondada multiplicada pelo prazo. Pode haver diferença de centavos em relação a uma tabela de amortização com ajuste na última parcela.

Esses percentuais são regras inventadas para demonstrar decisões diferentes. Não representam margem legal, política bancária, CET ou oferta comercial. Não consideramos IOF, tarifas, seguros, contratos existentes ou elegibilidade real do empregador.

## Cenários reproduzíveis

Com os exemplos padrão (R$ 15 mil em 24 meses):

| Salário mensal | Aurora    | Horizonte |
| -------------- | --------- | --------- |
| R$ 5.000       | Aprovado  | Aprovado  |
| R$ 2.800       | Reprovado | Aprovado  |
| R$ 1.000       | Reprovado | Reprovado |

Para falhas técnicas, pare a execução anterior e configure os mocks. Valores aceitos para `BANK_A_MODE` e `BANK_B_MODE`: `normal`, `error` (HTTP 503), `timeout` (10 segundos), `malformed` (JSON fora do contrato).

macOS/Linux:

```bash
BANK_B_MODE=timeout npm run dev
BANK_B_MODE=malformed npm run dev
BANK_A_MODE=error BANK_B_MODE=error npm run dev
```

Execute uma linha por vez. Para voltar ao padrão, reinicie com `npm run dev` sem essas variáveis.

PowerShell:

```powershell
$env:BANK_B_MODE="timeout"
npm run dev
# Depois de encerrar:
Remove-Item Env:BANK_B_MODE
```

Com Docker, copie `.env.example` para `.env`, altere os modos e execute `docker compose up --build` novamente. O Compose carrega `.env`; o fluxo npm usa variáveis do shell, sem leitura automática desse arquivo.

Configuração da API: `API_PORT` (4000), `BANK_BASE_URL` (http://localhost:4001), `BANK_TIMEOUT_MS` (3000; máximo 30000). Mocks: `MOCK_PORT` (4001). Vite: `API_PROXY_TARGET` (http://localhost:4000). Se alterar portas, ajuste os endereços correspondentes.

## Qualidade

```bash
npm run check  # lint, TypeScript, testes e builds
npm test       # suíte de testes
```

Os testes de integração sobem os bancos em portas efêmeras e fazem chamadas HTTP reais. Cobrem adaptação de contratos/unidades monetárias, validação, decisões divergentes, paralelismo, timeout, falha parcial e total, resposta malformada e ausência de dados pessoais nos logs. Os testes de regras cobrem dígitos verificadores, entradas inválidas e cálculo/arredondamento das parcelas.

O GitHub Actions executa a mesma verificação em Node 24 a cada push e pull request. Consulte [o roteiro de revisão](docs/roteiro.md) para a verificação manual e preparação da apresentação.

O [registro de validação](docs/validacao.md) descreve as verificações realizadas, evidências de smartphone/desktop e limites da revisão.

A suíte também verifica a entrada serverless, as chamadas HTTP entre rotas do mesmo deployment e o isolamento do segredo de Preview. A interface adapta formulário e resultados para uma coluna em smartphones, usa campos de 16 px para evitar zoom automático no iOS e mantém controles de toque com pelo menos 44 px.

## Propostas implementadas

### 1. Resultados independentes e espera limitada

- **Problema:** um serviço de terceiro pode falhar ou ficar lento.
- **Proposta:** chamadas paralelas, timeout cancelável e normalização independente.
- **Por quê:** uma falha não apaga uma proposta válida; a espera é limitada e a mensagem descreve o que ocorreu.

### 2. Demonstração e testes reproduzíveis

- **Problema:** resultados aleatórios dificultam diagnosticar e demonstrar falhas.
- **Proposta:** regras determinísticas, modos de falha configuráveis e testes HTTP.
- **Por quê:** avaliador e desenvolvedor conseguem reproduzir os comportamentos sem depender de bancos reais.

### 3. Clareza no formulário e privacidade

- **Problema:** formulários extensos e mensagens genéricas dificultam concluir a consulta; dados pessoais não precisam ser armazenados.
- **Proposta:** campos em etapas visuais, exemplo fictício, validações por campo, estados com texto e ícone, ausência de persistência e logs restritos.
- **Por quê:** facilita testar e compreender os resultados, reduzindo exposição desnecessária de informações.

### 4. Execução reproduzível

- **Problema:** diferenças de ambiente dificultam executar uma avaliação.
- **Proposta:** lockfile, versão de Node documentada, um comando npm para os serviços e Docker Compose opcional.
- **Por quê:** o avaliador escolhe o fluxo mais conveniente e consegue iniciar o conjunto de serviços.

## Planejado para uma semana adicional — em ordem de prioridade

1. **Métricas por banco.** Problema: logs isolados dificultam identificar degradação ao longo do tempo. Proposta: agregar latência, erros e timeouts por instituição. Por quê: orientar diagnóstico e decisões operacionais.
2. **Tentativas controladas.** Problema: falhas transitórias podem impedir obter uma proposta. Proposta: uma nova tentativa apenas para erros transitórios, com backoff e limite global de espera; validar idempotência antes de integrar serviços reais. Por quê: aumentar a disponibilidade sem sobrecarregar os bancos ou prolongar a espera indefinidamente.
3. **Comparação ordenada.** Problema: o cliente precisa comparar manualmente as condições. Proposta: ordenar propostas aprovadas pelo total, mantendo prazo e condições visíveis. Por quê: facilitar a comparação sem sugerir equivalência entre ofertas com condições diferentes.

## Limitações conscientes

Sem histórico, login, contratação ou consulta cadastral. A API devolve os resultados consolidados; não há streaming. O deployment público é uma demonstração com dados fictícios, sem proteção de aplicação contra abuso. Antes de usar dados reais, seriam necessárias revisão de segurança, políticas de dados e controles operacionais. A interface não apresenta a taxa fictícia como CET. Não há nova tentativa automática nesta versão. Inicializações de funções na Vercel podem aumentar a latência; consultas que ultrapassam o timeout aparecem como indisponíveis.

O desenvolvimento usa assistência de IA, com decisões, comportamento e testes documentados para revisão e compreensão do autor.
