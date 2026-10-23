# Entenda o Consigna Mais

Este guia serve para estudar o código e explicar a solução com suas palavras. O README é a visão da entrega; aqui estão o raciocínio, os conceitos e exemplos concretos. Não memorize respostas sem conseguir localizar o comportamento no código.

## 1. A explicação em um minuto

“O Consigna Mais recebe dados fictícios de uma solicitação e consulta dois bancos simulados por HTTP. Cada banco usa uma regra e um formato de resposta. A API valida essas respostas, converte para um formato comum e devolve um resultado por instituição. Se um banco falha, o outro continua aparecendo. A interface mostra as condições e diferencia reprovação de indisponibilidade. Não há contratação nem armazenamento de histórico.”

Essa é a responsabilidade principal. O layout, o Docker e o deploy ajudam a demonstrá-la, mas o desafio avalia especialmente a integração com os terceiros.

## 2. Percorra uma solicitação no código

Leia nesta ordem, acompanhando o botão **Comparar condições**:

1. [`App.tsx`](../apps/web/src/App.tsx): guarda campos e resultados com `useState`. No envio, converte salário e valor para centavos, valida a entrada e chama `POST /api/simulations`. Bloqueia os campos durante a consulta e valida o JSON recebido antes de renderizar.
2. [`contracts/src/index.ts`](../packages/contracts/src/index.ts): define os schemas Zod de entrada e saída e os tipos derivados deles. É o acordo de dados usado entre os módulos.
3. [`api/src/app.ts`](../apps/api/src/app.ts): valida novamente a entrada no servidor, cria um identificador da consulta e inicia as consultas aos bancos. Cada chamada trata a própria falha. Ao final, devolve a lista consolidada.
4. [`api/src/banks.ts`](../apps/api/src/banks.ts): conhece o contrato de cada banco, envia HTTP, verifica a resposta e a transforma em `BankResult`.
5. [`bank-mocks/src/app.ts`](../apps/bank-mocks/src/app.ts): representa os terceiros fictícios. Calcula a parcela e decide a aprovação conforme a regra de cada banco. Os modos de erro permitem simular indisponibilidade e mudança de contrato.
6. [`ResultCard.tsx`](../apps/web/src/ResultCard.tsx): apresenta um resultado já normalizado. Não calcula juros nem decide se alguém deve ser aprovado.

Fluxo: formulário → API → dois adaptadores → dois endpoints simulados → adaptadores → API → cartões.

## 3. API, HTTP e JSON

Uma **API** é uma interface que permite a um programa usar funcionalidades de outro. Neste projeto ela é exposta por HTTP. Um **endpoint** é a combinação de endereço e operação: por exemplo, `POST /api/simulations`.

O navegador usa `fetch` para enviar uma requisição. `POST` leva os dados no corpo; `Content-Type: application/json` informa seu formato. JSON é a representação textual de objetos e listas que trafega entre os programas. `await response.json()` interpreta o texto recebido; ele ainda precisa ser validado.

**HTTP 400** significa entrada inválida: os bancos nem precisam ser consultados. **HTTP 200** significa que a API processou a consulta; os resultados ainda podem ser reprovados ou indisponíveis. O status HTTP da nossa API e a decisão bancária são informações diferentes. Um erro HTTP 503 vindo do mock vira `unavailable`, não `rejected`.

## 4. Contrato e adaptador, na prática

**Contrato** é o formato e o significado dos dados combinados entre sistemas. Dois campos chamados “valor” podem estar em unidades diferentes; por isso não basta copiar o JSON.

Com R$ 15.000 em 24 meses, o Aurora devolve aproximadamente:

```json
{
  "approved": true,
  "terms": {
    "installmentCents": 77521,
    "installments": 24,
    "monthlyRatePercent": 1.8,
    "totalCents": 1860504
  }
}
```

O Horizonte usa outro contrato:

```json
{
  "decision": "ACCEPTED",
  "proposal": {
    "payment": 811.15,
    "months": 24,
    "rate": 2.2,
    "total": 19467.6
  }
}
```

O **adaptador** traduz esse formato externo para o formato da aplicação. No Horizonte, `ACCEPTED` vira `approved`, `months` vira `installments`, e `payment` em reais vira `installmentCents` em centavos. A UI passa a trabalhar sempre com `status`, `message` e, quando aprovado, `offer`.

Não existe uma classe de adaptador para cada banco: a interface `BankAdapter` descreve uma capacidade (`simulate`) e funções criam os objetos necessários. A separação é de responsabilidade, sem exigir uma hierarquia de classes.

## 5. Por que TypeScript não substitui Zod?

TypeScript verifica tipos durante o desenvolvimento. Depois da compilação, os tipos não conferem automaticamente o conteúdo de uma resposta HTTP. Um terceiro pode devolver JSON diferente do esperado, mesmo que nosso código esteja tipado.

Zod valida os valores em tempo de execução. `safeParse` devolve sucesso ou erros, útil para os campos do formulário. `parse` devolve dados válidos ou lança um erro; no adaptador, esse erro é convertido em indisponibilidade pelo coordenador.

Validar também no servidor é necessário porque qualquer cliente pode chamar a API diretamente e ignorar a interface. Compartilhar o schema evita manter duas listas de regras divergentes. Validar CPF e CNPJ só confere estrutura e dígitos verificadores; não prova identidade, existência cadastral ou vínculo com empregador.

## 6. Aprovado, reprovado e indisponível

`BankResult` é uma **união discriminada**: o campo `status` indica qual formato está presente. Só `approved` possui `offer`; isso permite ao TypeScript exigir a verificação do status antes de acessar uma parcela.

- `approved`: o mock aceitou a solicitação e enviou condições válidas.
- `rejected`: o mock respondeu e sua regra fictícia recusou a parcela.
- `unavailable`: houve falha técnica, timeout ou resposta fora do contrato. Não é uma decisão sobre o solicitante.

A API não deve transformar uma falha de comunicação em reprovação. Essa distinção evita uma mensagem enganosa para o cliente e facilita reproduzir os casos na apresentação.

## 7. Concorrência, Promise.all e timeout

`banks.map(...)` inicia uma operação assíncrona por banco e `Promise.all` espera pelos resultados. As requisições de rede ficam em andamento ao mesmo tempo: isso é concorrência de I/O, sem precisar criar threads ou processos para calcular em paralelo.

Se um banco leva 1 segundo e outro 2 segundos, a espera tende a ficar próxima de 2 segundos mais a sobrecarga, em vez da soma de 3. Isso é uma ilustração, não uma garantia de latência.

Normalmente uma rejeição faria `Promise.all` rejeitar. Aqui existe `try/catch` **dentro de cada chamada**: ela sempre termina com um `BankResult`, inclusive `unavailable`. Assim uma falha não elimina a proposta do outro banco. `Promise.allSettled` também seria possível; optamos pelo tratamento por banco para já produzir o modelo usado pela UI.

`AbortSignal.timeout(3000)` cancela a espera de cada `fetch`, incluindo a leitura do corpo. O sinal interrompe nosso cliente; não garante que o servidor de terceiro tenha parado de processar a requisição. O mock limpa seu temporizador quando a conexão fecha. O navegador tem um limite maior, de 10 segundos, para cobrir a chamada completa à API.

## 8. Regras financeiras fictícias

O cálculo Price usa principal, taxa mensal e prazo para obter uma parcela constante. A parcela é arredondada ao centavo e o total apresentado é parcela × quantidade de meses. Não calculamos IOF, tarifas, seguros ou CET.

Com R$ 15.000 em 24 meses e salário de R$ 2.800:

| Banco     | Parcela   | Limite fictício da parcela | Decisão   |
| --------- | --------- | -------------------------- | --------- |
| Aurora    | R$ 775,21 | 25% × R$ 2.800 = R$ 700    | Reprovado |
| Horizonte | R$ 811,15 | 30% × R$ 2.800 = R$ 840    | Aprovado  |

A taxa menor do Aurora não obriga sua aprovação: os limites de comprometimento são diferentes. Esses percentuais foram inventados para demonstrar respostas divergentes e não representam regras legais ou políticas reais.

Salário, valor e prazo influenciam essa decisão. Nome, e-mail, CPF e CNPJ são campos exigidos/validados na jornada, sem consulta a cadastros. Não alegue análise de risco, score ou elegibilidade real.

Os valores trafegam como inteiros em centavos: R$ 775,21 vira `77521`. Isso evita somar parcelas monetárias como decimais binários no contrato. A fórmula de juros ainda usa números de ponto flutuante e arredondamento; não substitui uma biblioteca financeira para produção.

## 9. Monorepo, processos e deploy

**Monorepo** significa manter os módulos no mesmo repositório. **Workspace** é um pacote que o npm instala e conecta nesse repositório. Não é sinônimo de microsserviço, container ou servidor independente.

- `apps/web`: apresentação e interação.
- `apps/api`: coordenação e integração.
- `apps/bank-mocks`: serviços fictícios para demonstrar o consumo HTTP.
- `packages/contracts`: biblioteca, sem processo ou porta própria.

Localmente, `npm run dev` compila os contratos e inicia os três processos. O Vite encaminha `/api` à API; a API chama a porta dos mocks. Docker Compose executa o mesmo desenho em containers. Container é um processo com ambiente isolado; Compose descreve como iniciar e conectar esse conjunto. Ambos são opcionais para o avaliador.

Na Vercel, os arquivos do frontend são servidos estaticamente. [`api/index.ts`](../api/index.ts) exporta o Express composto por [`deploy/vercel.ts`](../deploy/vercel.ts), e a plataforma recebe as requisições. “Serverless” significa que a plataforma gerencia a execução e a escala; continua existindo código de servidor. Não iniciamos um servidor local extra com `listen` nesse ponto de entrada.

Os mocks continuam sendo consultados por HTTP, mesmo quando montados na mesma função. São terceiros **simulados**, mantidos juntos para simplificar o deploy. Em uma integração real, os destinos seriam os serviços dos bancos, com contratos e credenciais próprios.

O domínio público e o endereço gerado de um deployment podem ter proteções diferentes. Por isso a página pode abrir normalmente e as chamadas internas serem bloqueadas. O segredo de automação da Vercel autentica apenas essas chamadas ao mesmo deployment. Ele é configurado na plataforma, não no Git; se for revogado ou substituído, é necessário refazer o deploy. Não é uma credencial de banco real.

## 10. O que ficou simples e o que tem custo

Não precisamos de banco de dados porque não existe requisito de histórico. Não precisamos de login porque a demonstração não mantém contas ou contratos. Também não criamos filas, cache, microsserviços separados na nuvem ou camadas de repositório sem dados persistidos.

A parte com maior custo é o HTTP entre API e mocks: exige processos locais, endereços, cancelamento e autenticação na hospedagem. Para um formulário que só calculasse uma parcela, seria dispensável. Aqui ela demonstra o foco do desafio: depender de terceiros e interpretar respostas e falhas.

O formulário permanece em um componente principal e o cartão de banco foi separado porque é repetido. A maior parte do tamanho da UI é marcação visual. Não houve necessidade de uma biblioteca global de estado ou um motor genérico de formulários.

Limites importantes: não há rate limit na aplicação; erros técnicos de bancos recebem o mesmo estado `unavailable` sem classificação detalhada; os contratos de entrada são compartilhados com os mocks; a resposta exige exatamente dois resultados; a imagem Docker da API inclui dependências de desenvolvimento. São escolhas de escopo, não evidência de uma arquitetura pronta para bancos reais.

Para adicionar um terceiro banco, ajuste a lista de adaptadores, implemente/teste seu contrato e revise a restrição de dois resultados em `simulationResponseSchema`, os mocks e os textos que dizem “dois bancos”. A UI já percorre a lista com `map`, mas isso sozinho não torna todo o produto extensível.

## 11. Como provar e apresentar

Execute `npm run check`: ESLint procura problemas estáticos de código; TypeScript verifica tipos; Vitest executa os testes; o build prepara os artefatos. Os testes HTTP verificam também a ligação entre os adaptadores e os mocks, não apenas funções isoladas. Nenhuma suíte prova ausência de todos os defeitos ou valida um comportamento bancário real.

Demonstre três casos: exemplo padrão com duas aprovações; salário de R$ 2.800 com decisões diferentes; `BANK_B_MODE=timeout` localmente para preservar Aurora e indicar indisponibilidade do Horizonte. Mostre onde cada comportamento está implementado antes de afirmar que o entende.

Os logs da aplicação registram `requestId`, banco, status e duração. `requestId` é um identificador aleatório para relacionar as duas consultas, sem usar CPF como identificador de rastreio. A aplicação não registra os dados pessoais do formulário nem mantém histórico. Isso não dispensa políticas e revisão de segurança antes de aceitar dados reais em produção.

Se perguntarem sobre melhorias, justifique primeiro observar latência e falhas por banco; depois, avaliar uma tentativa adicional controlada para erros transitórios. Não prometa retries irrestritos: podem duplicar operações, aumentar carga e prolongar a espera. As prioridades e o formato Problema/Proposta/Por quê estão no README.

## 12. Checklist de compreensão

Antes de entregar, tente responder sem ler e depois confira o código:

1. Qual é a diferença entre a API do Consigna Mais e as APIs dos bancos fictícios?
2. Qual campo mostra se existe uma oferta? Quem decide a aprovação?
3. Por que validar a mesma entrada no frontend e no servidor?
4. Onde o Horizonte converte reais para centavos?
5. Por que uma falha não derruba toda a lista de resultados?
6. Qual é o efeito real do timeout? O que ele não garante?
7. Por que o banco com a taxa maior pode aprovar e o outro reprovar?
8. Por que há quatro workspaces, três processos locais e uma função na Vercel?
9. Por que a autenticação interna foi necessária mesmo com a página pública?
10. O que mudaria para um terceiro banco ou para guardar histórico?

Se alguma resposta não estiver clara, volte à seção correspondente e acompanhe uma requisição de ponta a ponta. O objetivo é conseguir explicar as escolhas e seus limites, sem depender de nomes de padrões.
