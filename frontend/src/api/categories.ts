import { apiClient } from './client'
import type { CategoryListResponse, NotificationCategory } from '@/types'

export const listCategories = async (): Promise<CategoryListResponse> => {
  const response = await apiClient.get<CategoryListResponse>('/v1/categories')
  return response.data
}

export const createCategory = async (category: NotificationCategory): Promise<NotificationCategory> => {
  const response = await apiClient.post<NotificationCategory>('/v1/categories', category)
  return response.data
}

export const updateCategory = async (
  categoryId: string,
  category: NotificationCategory
): Promise<NotificationCategory> => {
  const response = await apiClient.put<NotificationCategory>(
    `/v1/categories/${encodeURIComponent(categoryId)}`,
    category
  )
  return response.data
}

export const deleteCategory = async (categoryId: string): Promise<void> => {
  await apiClient.delete(`/v1/categories/${encodeURIComponent(categoryId)}`)
}
