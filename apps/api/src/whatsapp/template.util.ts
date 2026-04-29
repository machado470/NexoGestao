export function renderTemplate(template: string, context: Record<string, unknown>) {
  const missingVariables: string[] = []
  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, variable) => {
    const value = context?.[variable]
    if (value === undefined || value === null) {
      missingVariables.push(variable)
      return ''
    }
    return String(value)
  })

  return {
    content: rendered,
    missingVariables,
  }
}
