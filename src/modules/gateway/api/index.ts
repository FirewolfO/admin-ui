import { api, unwrap } from '@gateway/api/client'
import type {
  CredentialInput,
  CredentialListParams,
  CredentialUpdateInput,
  GatewayRoute,
  GeneratedCredential,
  ListParams,
  Overview,
  PageResult,
  RouteInput,
  RouteAudience,
  RouteListParams,
  ServiceInput,
  ServiceCredential,
  UpstreamService,
} from '@gateway/types'

export const overviewApi = {
  get: (audience: RouteAudience) => unwrap<Overview>(api.get('/overview', { params: { audience } })),
}

export const servicesApi = {
  list: (params: ListParams = {}) => unwrap<PageResult<UpstreamService>>(api.get('/services', { params })),
  get: (id: number) => unwrap<UpstreamService>(api.get(`/services/${id}`)),
  create: (input: ServiceInput) => unwrap<UpstreamService>(api.post('/services', input)),
  update: (id: number, input: ServiceInput) => unwrap<UpstreamService>(api.put(`/services/${id}`, input)),
  remove: (id: number) => unwrap<{ deleted: boolean }>(api.delete(`/services/${id}`)),
}

export const routesApi = {
  list: (params: RouteListParams = {}) => unwrap<PageResult<GatewayRoute>>(api.get('/routes', { params })),
  get: (id: number) => unwrap<GatewayRoute>(api.get(`/routes/${id}`)),
  create: (input: RouteInput) => unwrap<GatewayRoute>(api.post('/routes', input)),
  update: (id: number, input: RouteInput) => unwrap<GatewayRoute>(api.put(`/routes/${id}`, input)),
  remove: (id: number) => unwrap<{ deleted: boolean }>(api.delete(`/routes/${id}`)),
}

export const credentialsApi = {
  list: (params: CredentialListParams = {}) => unwrap<PageResult<ServiceCredential>>(api.get('/credentials', { params })),
  get: (id: number) => unwrap<ServiceCredential>(api.get(`/credentials/${id}`)),
  create: (input: CredentialInput) => unwrap<GeneratedCredential>(api.post('/credentials', input)),
  update: (id: number, input: CredentialUpdateInput) => unwrap<ServiceCredential>(api.put(`/credentials/${id}`, input)),
  remove: (id: number) => unwrap<{ deleted: boolean }>(api.delete(`/credentials/${id}`)),
}
