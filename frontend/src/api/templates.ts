import { apiClient } from './client'
import type { NotificationTemplate, TemplateListResponse } from '@/types'

export const listTemplates = async (): Promise<TemplateListResponse> => {
  const response = await apiClient.get<TemplateListResponse>('/v1/templates')
  return response.data
}

export const createTemplate = async (payload: NotificationTemplate): Promise<NotificationTemplate> => {
  const response = await apiClient.post<NotificationTemplate>('/v1/templates', payload)
  return response.data
}

export const updateTemplate = async (
  templateId: string,
  payload: NotificationTemplate
): Promise<NotificationTemplate> => {
  const response = await apiClient.put<NotificationTemplate>(`/v1/templates/${encodeURIComponent(templateId)}`, payload)
  return response.data
}

export const deleteTemplate = async (templateId: string): Promise<void> => {
  await apiClient.delete(`/v1/templates/${encodeURIComponent(templateId)}`)
}
