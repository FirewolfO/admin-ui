import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearSession, getAccessToken, refreshPlatformAccessToken } from '@/api/client'

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
  baseURL: import.meta.env.VITE_GATEWAY_ADMIN_API_BASE_URL || '/api/gateway-admin/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const original = error.config as RetryConfig | undefined
    if (error.response?.status === 401 && original && !original._retry) {
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

export async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  return (await promise).data.data
}

export function apiMessage(error: unknown, fallback = '请求失败，请稍后重试') {
  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) return error.response?.data?.message || fallback
  return error instanceof Error ? error.message : fallback
}
