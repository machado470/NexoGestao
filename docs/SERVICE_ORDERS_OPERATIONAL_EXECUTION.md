# Ordens de Serviço como execução operacional

A página de Ordens de Serviço do NexoGestão deve ser lida como o centro real de execução da operação, não como um cadastro. A tela organiza a carteira para responder rapidamente: qual serviço precisa andar, quem é responsável, qual prazo está em risco, qual O.S. está concluída sem cobrança e qual ação existente deve ser executada agora.

## Papel no fluxo de receita

O.S. é a ponte operacional entre cliente, agenda e financeiro. Quando a execução é concluída, ela deve virar cobrança rastreável sempre que houver valor e contrato existente para geração de cobrança. Por isso, a tela destaca O.S. concluídas sem cobrança como alerta de receita não capturada.

## Dados e limites preservados

- A página usa as fontes já existentes de O.S., clientes, agendamentos, pessoas, cobranças e Timeline.
- Nenhuma rota, contrato de API, Prisma ou regra multi-tenant foi alterada.
- WhatsAppPage não foi modificada; a O.S. apenas navega para o fluxo já existente quando há cliente e O.S. válidos.
- A tela não inventa automação: iniciar, concluir, gerar cobrança, editar, abrir detalhe, abrir cliente, financeiro, Timeline e WhatsApp são ações conectadas a fluxos existentes.
- Atraso só é exibido quando há prazo retornado. Sem prazo vira estado explícito, não atraso inferido.
- Responsável e cobrança só são exibidos quando retornados pelas fontes carregadas; ausências são mostradas como ausência de dado operacional.

## Estrutura atual da tela

1. Header operacional compacto com volume, atrasos, O.S. sem cobrança e O.S. paradas sem prazo.
2. Próxima melhor ação compacta, orientativa e acionada por botões existentes.
3. Alertas compactos para atrasadas, paradas sem prazo, sem responsável e concluídas sem cobrança.
4. Cards compactos de saúde da execução.
5. Lista operacional com número, cliente, serviço, status, responsável, prazo, atraso e valor quando disponível.
6. Detalhe de O.S. com execução, comunicação/navegação, histórico e financeiro.
7. Fallback honesto quando a Timeline oficial não retorna eventos: datas reais da O.S. podem ser exibidas como contexto, sem substituir a Timeline oficial.
