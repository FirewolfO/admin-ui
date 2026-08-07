export type ResourceStatus = 'enabled' | 'disabled'
export type RouteAudience = 'inner' | 'open'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'

export interface UpstreamService {
  id: number
  code: string
  audience: RouteAudience
  name: string
  baseUrl: string
  description: string
  status: ResourceStatus
  timeoutMs: number
  routeCount: number
  createdAt: string
  updatedAt: string
}

export interface ServiceInput {
  code: string
  audience: RouteAudience
  name: string
  baseUrl: string
  description: string
  status: ResourceStatus
  timeoutMs: number
}

export interface GatewayRoute {
  id: number
  serviceId: number
  serviceCode: string
  serviceName: string
  name: string
  path: string
  upstreamPath: string
  methods: HttpMethod[]
  audience: RouteAudience
  programmingAccessEnabled: boolean
  forwardBrowserCredentials: boolean
  anonymousAccessEnabled: boolean
  authorizedServiceIds: number[]
  status: ResourceStatus
  priority: number
  timeoutMs: number
  description: string
  createdAt: string
  updatedAt: string
}

export interface RouteInput {
  serviceId: number
  name: string
  path: string
  upstreamPath: string
  methods: HttpMethod[]
  audience: RouteAudience
  programmingAccessEnabled: boolean
  forwardBrowserCredentials: boolean
  anonymousAccessEnabled: boolean
  authorizedServiceIds: number[]
  status: ResourceStatus
  priority: number
  timeoutMs: number
  description: string
}

export interface ServiceCredential {
  id: number
  serviceId: number
  serviceCode: string
  serviceName: string
  audience: RouteAudience
  name: string
  accessKey: string
  description: string
  status: ResourceStatus
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CredentialInput {
  serviceId: number
  name: string
  description: string
  status: ResourceStatus
  expiresAt: string | null
}

export interface CredentialUpdateInput {
  name: string
  description: string
  status: ResourceStatus
  expiresAt: string | null
}

export interface GeneratedCredential {
  credential: ServiceCredential
  secretKey: string
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Overview {
  serviceCount: number
  enabledServiceCount: number
  routeCount: number
  enabledRouteCount: number
}

export interface ListParams {
  q?: string
  status?: ResourceStatus | ''
  page?: number
  pageSize?: number
  audience?: RouteAudience
}

export interface RouteListParams extends ListParams {
  serviceId?: number
}

export interface CredentialListParams extends ListParams {
  serviceId?: number
}
