# Consigna Mais

Simulador educacional de empréstimo consignado: uma interface em português consulta duas APIs bancárias simuladas por HTTP, interpreta contratos diferentes e apresenta os resultados individualmente.

**Todos os dados e critérios são fictícios. Não há contratação, persistência de dados pessoais ou integração com bancos reais. Os nomes Bradesco e Banco Santander são usados apenas para ilustrar a simulação, sem vínculo com essas instituições.**

**Demonstração:** [consigna-mais.vercel.app](https://consigna-mais.vercel.app). Para testar, clique em **Usar dados de exemplo** e depois em **Comparar condições**.

## Atendimento ao desafio

| Pedido do desafio                               | Onde está atendido                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Nome, e-mail, CPF, salário e CNPJ do empregador | Formulário e validação compartilhada; também solicitamos valor e prazo                 |
| Pelo menos dois bancos simulados                | Bradesco e Banco Santander, consultados por HTTP com contratos diferentes              |
| Interpretar e consolidar respostas              | Adaptadores da API convertem decisões e unidades monetárias para um modelo comum       |
| Resultado individual compreensível              | Cartão por banco: aprovado com condições, reprovado com motivo ou indisponível         |
| Instruções de execução                          | Fluxos npm e Docker opcional abaixo; Node 24 e portas documentados                     |
| Decisões técnicas e limitações                  | Seções de arquitetura, justificativas e limitações conscientes                         |
| Propostas implementadas e planejadas            | Problema, Proposta e Por quê; próximas melhorias em ordem de prioridade                |
| Uso consciente de IA                            | Assistência declarada; decisões, exemplos e testes para revisão e compreensão do autor |

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

## Arquitetura e decisões

```text
Navegador (React)
    │ POST /api/simulations
    ▼
API Express → valida entrada → consulta bancos em paralelo
    ├── adaptador Bradesco ─────────HTTP──→ /bank-a/simulate
    └── adaptador Banco Santander ──HTTP──→ /bank-b/simulate
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
- O mock do Bradesco responde com um booleano e valores em centavos. O mock do Banco Santander usa decisões textuais e valores em reais. Os adaptadores validam e convertem ambos para o mesmo modelo.
- Chamadas paralelas, com cancelamento após **3 segundos por banco**, inclusive se o corpo da resposta travar. Falha de rede, erro HTTP ou contrato inválido afeta somente o respectivo resultado.
- Reprovação é uma decisão do simulador. Indisponibilidade é uma falha técnica; a aplicação não confunde as duas.
- CPF e CNPJ são strings, com normalização e validação de dígitos verificadores. CNPJ aceita letras nas primeiras 12 posições conforme o [algoritmo da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj). Isso valida a estrutura, não comprova identidade ou cadastro.
- Valores da API são inteiros em centavos. A apresentação usa reais em pt-BR. Identificadores com zero inicial são preservados.
- Sem banco de dados ou autenticação: a jornada solicitada é uma consulta imediata. Os dados ficam apenas em memória durante o processamento e no formulário aberto.
- Logs estruturados registram identificador da consulta, banco, status e duração. Não registram CPF, CNPJ, nome, e-mail, salário ou payloads externos.
- Docker é opcional. npm workspaces mantém a instalação e os comandos centralizados, sem adicionar ferramentas de monorepo.

## Por que essa arquitetura?

É uma aplicação modular em um único repositório. Há quatro workspaces, mas isso não significa quatro serviços publicados: `contracts` é uma biblioteca compartilhada. Localmente existem três processos para demonstrar a comunicação HTTP; na Vercel, a API e os mocks usam a mesma função, e o frontend é estático.

| Decisão                        | Justificativa                                                                                                   | Custo ou limite assumido                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| React + Vite                   | Uma única tela com estado de formulário e resultados; build direto, sem necessidade de renderização no servidor | O formulário depende de JavaScript no navegador                                                                 |
| Express + funções pequenas     | Um endpoint principal, middleware JSON e erros; pouca configuração para expor e testar HTTP                     | Não adicionamos camadas de controller/repository sem responsabilidades próprias                                 |
| Mocks acessados por HTTP       | O foco do desafio é consumir terceiros; exercita rede, timeout e contratos, além do cálculo                     | Há chamadas extras e possível inicialização de funções na nuvem                                                 |
| Adaptadores por contrato       | A interface recebe um formato estável mesmo quando os bancos respondem de modos diferentes                      | Mudanças no contrato externo exigem ajustar e testar o respectivo adaptador                                     |
| TypeScript + Zod compartilhado | TypeScript ajuda durante o desenvolvimento; Zod valida dados que chegam em tempo de execução                    | O pacote compartilhado precisa ser compilado; após alterá-lo durante o desenvolvimento, reinicie `npm run dev`  |
| npm workspaces                 | Centraliza instalação, lockfile e comandos de módulos que evoluem juntos                                        | Há mais de um pacote, sem adicionar Nx, Turborepo ou uma ferramenta própria                                     |
| Sem banco de dados e sem login | O requisito é uma consulta imediata, sem histórico ou contratação                                               | Recarregar a página descarta o formulário e os resultados                                                       |
| Valores em centavos            | Transporte, comparação de parcelas e total usam inteiros; a UI converte para reais                              | A fórmula ilustrativa de juros ainda usa `number` e arredondamento; não é um motor financeiro de produção       |
| Docker opcional                | Reproduz o conjunto de serviços sem exigir sua instalação pelo avaliador                                        | Mantemos dois modos de execução; a imagem da API prioriza simplicidade e inclui dependências de desenvolvimento |

A revisão não identificou necessidade de introduzir novas camadas ou serviços. A separação com maior custo é a dos mocks via HTTP, mantida porque demonstra justamente a habilidade avaliada. A interface cuida da interação; os mocks decidem a aprovação fictícia; a API valida, consulta, adapta e consolida. Nome, e-mail e documentos não influenciam a decisão dos mocks: são coletados e validados para atender à entrada solicitada, sem consulta cadastral.

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

| Banco simulado  | Taxa mensal | Limite ilustrativo da parcela |
| --------------- | ----------: | ----------------------------: |
| Bradesco        |        1,8% |      25% do salário informado |
| Banco Santander |        2,2% |      30% do salário informado |

Os mocks usam a fórmula Price `P × i / (1 − (1 + i)^−n)`, onde P é o principal, i a taxa mensal decimal e n o prazo. A parcela é arredondada ao centavo; o total é a parcela arredondada multiplicada pelo prazo. Pode haver diferença de centavos em relação a uma tabela de amortização com ajuste na última parcela.

Esses percentuais são regras inventadas para demonstrar decisões diferentes. Não representam margem legal, política bancária, CET ou oferta comercial. Não consideramos IOF, tarifas, seguros, contratos existentes ou elegibilidade real do empregador.

## Cenários reproduzíveis

Com os exemplos padrão (R$ 15 mil em 24 meses):

| Salário mensal | Bradesco  | Banco Santander |
| -------------- | --------- | --------------- |
| R$ 5.000       | Aprovado  | Aprovado        |
| R$ 2.800       | Reprovado | Aprovado        |
| R$ 1.000       | Reprovado | Reprovado       |

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

O GitHub Actions executa a mesma verificação em Node 24 a cada push e pull request. A revisão manual incluiu larguras de 320, 390, 430, 768 e 1440 px, navegação por teclado, validação do formulário, aprovações, reprovações e falhas parcial e total. A validação responsiva usou emulação de viewport; não substitui testes em aparelhos físicos.

A suíte também verifica a entrada serverless, as chamadas HTTP entre rotas do mesmo deployment e o isolamento do segredo de automação. A interface adapta formulário e resultados para uma coluna em smartphones, usa campos de 16 px para evitar zoom automático no iOS e mantém controles de toque com pelo menos 44 px.

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
