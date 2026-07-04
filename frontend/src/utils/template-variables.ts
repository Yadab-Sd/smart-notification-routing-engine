import type { NotificationTemplate } from '@/types'

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

export const templateVariableNames = (template?: NotificationTemplate): string[] => {
  if (!template) return []

  const names = new Set<string>(template.variables || [])
  const content = `${template.subject || ''}\n${template.body || ''}`
  let match: RegExpExecArray | null

  while ((match = TEMPLATE_VARIABLE_PATTERN.exec(content)) !== null) {
    names.add(match[1])
  }

  return Array.from(names).sort()
}

export const compactTemplateVariables = (values: Record<string, string>): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0)
  )
}
