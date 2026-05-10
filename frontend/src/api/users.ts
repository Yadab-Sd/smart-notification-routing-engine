import { apiClient } from './client'
import type { User, UserPreferences } from '@/types'

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId: string): Promise<User> => {
  const response = await apiClient.get<User>(`/v1/users/${userId}`)
  return response.data
}

/**
 * Update user preferences
 */
export const updateUserPreferences = async (
  userId: string,
  preferences: UserPreferences
): Promise<void> => {
  await apiClient.put(`/v1/users/${userId}/preferences`, preferences)
}
