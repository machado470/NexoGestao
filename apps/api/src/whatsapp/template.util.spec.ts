import { renderTemplate } from './template.util'

describe('renderTemplate', () => {
  it('renderiza contexto aninhado', () => {
    const result = renderTemplate('Olá {{customer.name}}, cobrança {{charge.amount}} vence {{charge.dueDate}}', {
      customer: { name: 'Ana' },
      charge: { amount: 'R$ 120,00', dueDate: '2026-05-01' },
    })
    expect(result.content).toContain('Ana')
    expect(result.content).toContain('R$ 120,00')
    expect(result.missingVariables).toEqual([])
  })
})
