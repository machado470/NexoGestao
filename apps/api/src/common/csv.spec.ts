import { csvCell, csvRow } from './csv'

describe('CSV exports', () => {
  it('preserves embedded quotes, commas and newlines inside one quoted field', () => {
    expect(csvRow(['Cliente "VIP", filial\nSul', 'mail@example.test', 10])).toBe('"Cliente ""VIP"", filial\nSul","mail@example.test",10')
  })
  it.each(['=1+1', '+SUM(1)', '-1+1', '@SUM(1)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1'])('neutralizes spreadsheet text %p', text => {
    expect(csvCell(text)).toBe('"\'' + text + '"')
  })
  it('does not change legitimate text, numeric signs or empty fields', () => {
    expect(csvRow(['Maria', -10, null, undefined])).toBe('"Maria",-10,"",""')
  })
})
