export interface AuthUser {
  email: string
  sub: string
  token: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignUpData {
  email: string
  password: string
}
