/** Quote text per RFC 4180 and prevent spreadsheet formula interpretation of user-controlled cells. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (typeof value === 'number') return String(value)
  let text = value == null ? '' : String(value)
  if (/^[\t\r\n]|^\s*[=+@-]/u.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}

export function csvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(',')
}
