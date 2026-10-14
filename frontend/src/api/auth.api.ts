import { requestJson } from './http.client'

export interface User {
  id: number
  email: string
  is_admin: boolean
}

export interface Credentials {
  email: string
  password: string
}

interface TokenResponse {
  access_token: string
  token_type: string
}

export function register(credentials: Credentials, signal?: AbortSignal): Promise<User> {
  return requestJson('/auth/register', {
    method: 'POST', body: JSON.stringify(credentials), signal,
  })
}

export function login(credentials: Credentials, signal?: AbortSignal): Promise<TokenResponse> {
  return requestJson('/auth/login', {
    method: 'POST', body: JSON.stringify(credentials), signal,
  })
}

export function getProfile(token: string, signal?: AbortSignal): Promise<User> {
  return requestJson('/auth/me', { token, signal })
}
