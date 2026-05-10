import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'
import { ENV } from '@/config/env'
import type { AuthUser, LoginCredentials, SignUpData } from '@/types'

// Create Cognito User Pool only if not in demo mode
const userPool = ENV.DEMO_MODE
  ? null
  : new CognitoUserPool({
      UserPoolId: ENV.COGNITO_USER_POOL_ID,
      ClientId: ENV.COGNITO_CLIENT_ID,
    })

/**
 * Sign in with email and password
 */
export const signIn = (credentials: LoginCredentials): Promise<AuthUser> => {
  // Demo mode: Accept any login
  if (ENV.DEMO_MODE) {
    return new Promise((resolve) => {
      const authUser: AuthUser = {
        email: credentials.email,
        sub: 'demo-user-123',
        token: 'demo-token-' + Date.now(),
      }

      // Store token and user data
      localStorage.setItem('auth_token', authUser.token)
      localStorage.setItem('auth_user', JSON.stringify(authUser))

      // Simulate network delay
      setTimeout(() => resolve(authUser), 500)
    })
  }

  // Production mode: Use Cognito
  if (!userPool) {
    return Promise.reject(
      new Error('Cognito not configured. Please set environment variables.')
    )
  }

  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: credentials.email,
      Pool: userPool,
    })

    const authDetails = new AuthenticationDetails({
      Username: credentials.email,
      Password: credentials.password,
    })

    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        const token = result.getIdToken().getJwtToken()
        const payload = result.getIdToken().decodePayload()

        const authUser: AuthUser = {
          email: payload.email,
          sub: payload.sub,
          token,
        }

        // Store token and user data
        localStorage.setItem('auth_token', token)
        localStorage.setItem('auth_user', JSON.stringify(authUser))

        resolve(authUser)
      },
      onFailure: (err) => {
        reject(err)
      },
    })
  })
}

/**
 * Sign up with email and password
 */
export const signUp = (data: SignUpData): Promise<void> => {
  // Demo mode: Accept any signup
  if (ENV.DEMO_MODE) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 500)
    })
  }

  if (!userPool) {
    return Promise.reject(
      new Error('Cognito not configured. Please set environment variables.')
    )
  }

  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({
        Name: 'email',
        Value: data.email,
      }),
    ]

    userPool.signUp(
      data.email,
      data.password,
      attributeList,
      [],
      (err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      }
    )
  })
}

/**
 * Sign out current user
 */
export const signOut = (): void => {
  if (userPool) {
    const user = userPool.getCurrentUser()
    if (user) {
      user.signOut()
    }
  }
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): AuthUser | null => {
  const userStr = localStorage.getItem('auth_user')
  if (!userStr) return null

  try {
    return JSON.parse(userStr) as AuthUser
  } catch {
    return null
  }
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('auth_token')
  return !!token
}
