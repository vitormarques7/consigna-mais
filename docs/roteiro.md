# Roteiro de revisão e apresentação

## Verificação manual

1. Inicie pelo README e abra a interface em larguras de 320, 390, 430, 768 e 1440 px. Confira cabeçalho, campos, resultados e rodapé sem rolagem horizontal. Em smartphone, campos devem ter fonte de 16 px e controles de toque de pelo menos 44 px.
2. Envie o formulário vazio: verifique erros por campo, sem iniciar consultas.
3. Clique em **Usar dados de exemplo** e envie: confira duas aprovações, parcelas, taxas e total.
4. Durante o envio, verifique que os campos e o botão ficam bloqueados. Após concluir, confirme que podem ser editados novamente.
5. Altere o salário para R$ 2.800: Aurora reprova e Horizonte aprova. Com R$ 1.000, ambos reprovam.
6. Configure `BANK_B_MODE=timeout`: o resultado do Aurora deve permanecer disponível, e Horizonte deve aparecer indisponível em cerca de 3 segundos.
7. Repita com `malformed` e `error`; teste também ambos com `error`.
8. Pare a API e tente enviar. A interface deve explicar a falha e preservar os dados.
9. Navegue por teclado: links, botão de exemplo, campos, prazo e envio. Os focos devem ser visíveis; erros são associados aos campos.
10. Execute `npm run check`. Revise os logs: apenas requestId, bankId, status e durationMs.
11. Execute também por Docker e abra localhost:8080. Ao finalizar, use `docker compose down`.
12. Informe empréstimo de R$ 99,99: confira a mensagem de mínimo R$ 100,00 e o foco no campo. Repita com valor monetário inválido e CPF inválido.
13. Após o deploy na Vercel, confira `/api/health` e uma simulação na URL de produção. Em Preview protegido, configure o segredo de automação conforme o README e confira as chamadas internas. Acesse a produção também em janela anônima e em smartphone.

## Apresentação de cinco minutos

- **Problema e jornada:** solicitar uma simulação e compreender respostas de bancos diferentes.
- **Demonstração:** exemplo com aprovação; exemplo com decisões divergentes; falha parcial.
- **Arquitetura:** a UI conversa com a API; adaptadores conhecem contratos externos; o serviço coordena as chamadas.
- **Qualidade:** validação no servidor, timeout com cancelamento, tipos discriminados e testes HTTP.
- **Decisões:** dados efêmeros dispensam banco de dados; Docker é opcional; políticas financeiras são fictícias.
- **Próximo passo:** métricas por banco para observar qualidade das integrações.

## Perguntas que você deve conseguir responder

- Por que validar o JSON do banco se o código já usa TypeScript?
- Qual a diferença entre reprovação e indisponibilidade?
- Por que valores monetários trafegam em centavos?
- Como o adaptador do Horizonte converte reais para centavos?
- Como um banco lento é cancelado sem perder o resultado do outro?
- Como adicionar um terceiro banco e quais testes/contratos precisariam ser atualizados?
- Por que o exemplo não usa persistência, login ou retries?
- O que mudaria antes de conectar bancos reais ou expor a aplicação publicamente?
- Como a mesma API funciona em três processos locais e em uma função na Vercel?
- Por que as chamadas internas de um Preview protegido precisam do segredo de automação?

Os testes e a execução devem sustentar cada afirmação do README. Registre explicitamente qualquer verificação que não pôde ser realizada no ambiente utilizado.
