import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { TokenResponse } from '@permission/types'

export const API_BASE_URL = import.meta.env.VITE_PERMISSION_API_BASE_URL || '/api/permission/v1'
const accessTokenKey = 'admin_ui_access_token'
const refreshTokenKey = 'admin_ui_refresh_token'
const sessionKey = 'admin_ui_session'

interface ApiEnvelope<T> {
  code: string
  message: string
  data: T
  requestId: string
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string> | null = null

export async function refreshPlatformAccessToken(): Promise<string> {
  refreshPromise ||= refreshAccessToken().finally(() => { refreshPromise = null })
  return refreshPromise
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('登录已过期')
  const response = await axios.post<ApiEnvelope<TokenResponse>>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
  const session = response.data.data
  saveSession(session)
  return session.accessToken
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const original = error.config as RetryConfig | undefined
    const isAuthEndpoint = original?.url?.includes('/auth/oauth/') || original?.url?.includes('/auth/refresh')
    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        original.headers.Authorization = `Bearer ${await refreshPlatformAccessToken()}`
        return api(original)
      } catch {
        clearSession()
        window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      }
    }
    return Promise.reject(error)
  },
)

export function saveSession(session: TokenResponse) {
  sessionStorage.setItem(accessTokenKey, session.accessToken)
  sessionStorage.setItem(refreshTokenKey, session.refreshToken)
  sessionStorage.setItem(sessionKey, JSON.stringify({ user: session.user, permissions: session.permissions, expiresAt: session.expiresAt }))
}

export function loadSession() {
  const value = sessionStorage.getItem(sessionKey)
  if (!value) return null
  try {
    return JSON.parse(value) as Pick<TokenResponse, 'user' | 'permissions' | 'expiresAt'>
  } catch {
    clearSession()
    return null
  }
}

export function getAccessToken() {
  return sessionStorage.getItem(accessTokenKey) || ''
}

export function getRefreshToken() {
  return sessionStorage.getItem(refreshTokenKey) || ''
}

export function clearSession() {
  sessionStorage.removeItem(accessTokenKey)
  sessionStorage.removeItem(refreshTokenKey)
  sessionStorage.removeItem(sessionKey)
}

export function apiMessage(error: unknown, fallback = '请求失败，请稍后重试') {
  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) return error.response?.data?.message || fallback
  return error instanceof Error ? error.message : fallback
}

export async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  return (await promise).data.data
}
