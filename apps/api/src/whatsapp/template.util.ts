export function renderTemplate(template: string, context: Record<string, unknown>) {
  const missingVariables: string[] = []
  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, variable) => {
    const value = variable.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key]
      }
      return undefined
    }, context)
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
