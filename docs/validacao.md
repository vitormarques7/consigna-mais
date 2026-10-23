# Validação da entrega

Revisão realizada em 23/10/2026, com dados fictícios.

## Verificações automatizadas

- `npm run check`: lint, TypeScript, **55 testes** e builds aprovados em Node 24.
- A mesma suíte passou em Docker e em uma cópia local fora da pasta sincronizada do macOS.
- `npm ci`: instalação pelo lockfile concluída; auditoria sem vulnerabilidades conhecidas na execução.
- `vercel build`: concluído com a CLI oficial 65.2.0, em cópia temporária com configuração local, sem autenticação ou publicação. Gerou frontend estático e função `nodejs24.x`.
- A entrada serverless foi exercitada pelos testes com requisições HTTP reais aos mocks montados no mesmo servidor. Cobertura de configuração inclui previews protegidos e não encaminhamento do segredo para outra origem.

## Interface e execução

- Fluxo por `npm run dev` e por Docker Compose conferidos no navegador.
- Larguras emuladas de **320, 390, 430, 768 e 1440 px** sem rolagem horizontal; formulário em uma coluna nos smartphones.
- Nos smartphones, campos com fonte de 16 px e controles de pelo menos 44 px de altura.
- Conferidos formulário vazio, CPF inválido, valor monetário inválido e empréstimo abaixo de R$ 100, com mensagem em português e foco no primeiro erro.
- Conferidos duas aprovações, decisões divergentes, duas reprovações, indisponibilidade parcial e total.
- Durante a consulta, campos e envio ficam bloqueados; após a conclusão, o foco vai para os resultados.
- Com a API parada, a espera termina com mensagem de erro, campos preservados e possibilidade de nova tentativa.
- Navegação por teclado entre campos conferida. As condições normais dos mocks foram restauradas após os testes.

Evidências: [smartphone](screenshots/smartphone.png) e [desktop](screenshots/desktop.png).

## Verificação em produção na Vercel

- Aplicação publicada em [consigna-mais.vercel.app](https://consigna-mais.vercel.app), com a branch `main`.
- A primeira execução revelou bloqueio das chamadas internas pela proteção do endereço gerado do deployment. Foi configurado, com autorização do autor, o segredo de automação somente no servidor; a proteção não foi desativada. Nenhum valor de credencial foi incluído no código ou nesta documentação.
- Após novo deploy, a jornada navegador → API → dois mocks HTTP → API → cartões foi conferida na URL pública.
- Com salário de R$ 5.000, os dois bancos aprovaram; as parcelas foram R$ 775,21 e R$ 811,15. Com R$ 2.800, Aurora reprovou e Horizonte aprovou, conforme as regras documentadas.
- Os logs da aplicação confirmaram aprovação dos dois bancos e registraram apenas identificador da consulta, banco, status e duração.
- Evidência: [resultados em produção](screenshots/producao.png). A conferência não exigiu login do visitante na URL pública.

## Revisão da arquitetura e da documentação

Foram conferidas a separação entre interface, coordenação, adaptação e mocks; as configurações npm/Docker/Vercel; os contratos; e os testes. Não foi encontrada necessidade de acrescentar camadas. O custo de manter mocks via HTTP foi explicitado porque atende ao objetivo central do desafio. O README foi confrontado com o enunciado e passou a incluir uma matriz de atendimento, justificativas e custos das decisões. O guia de estudo explica o fluxo, os conceitos e as limitações com exemplos reais do código.

## Limites da verificação

As telas foram conferidas com emulação de viewport, sem teste em aparelho físico. Os limites da conta e todos os modos de falha em deployments de Preview não foram exercitados na nuvem; os cenários de falha foram conferidos localmente e pelos testes HTTP. A revisão pública não equivale a teste de carga nem auditoria de segurança. O emulador `vercel dev` exigiu autenticação; não foi usado para substituir essa conferência. O build oficial e os testes da função passaram sem acesso à conta.

O diretório original em `Documents` apresentou arquivos descarregados para a nuvem e leituras incompletas. A validação local foi repetida numa cópia em `/private/tmp`, além do Docker, para eliminar essa interferência do sistema de arquivos. Após o autor mover o repositório para `Downloads`, os 55 testes, lint, TypeScript e build também passaram no checkout definitivo.
