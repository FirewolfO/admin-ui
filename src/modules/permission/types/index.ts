export type Status = 'enabled' | 'disabled'
export type PermissionNodeType = 'group' | 'permission'

export interface Application {
  id: number
  code: string
  name: string
  description: string
  homepageUrl: string
  clientId: string
  clientSecret?: string
  status: Status
  builtIn: boolean
  createdAt: string
  updatedAt: string
}

export interface ApplicationSecret {
	id: number
	applicationId: number
	version: number
	clientSecret?: string
	status: 'active' | 'revoked' | 'expired'
	current: boolean
	expiresAt: string | null
	revokedAt: string | null
	createdById: number | null
	createdByName: string
	createdAt: string
}

export interface Permission {
  id: number
  code: string
  name: string
  resource: string
  action: string
  description: string
  applicationId: number
  application?: Application
  parentId: number | null
  nodeType: PermissionNodeType
  sortOrder: number
  children?: Permission[]
  builtIn: boolean
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: number
  applicationId: number
  application?: Application
  code: string
  name: string
  description: string
  status: Status
  builtIn: boolean
  permissions?: Permission[]
  createdAt: string
  updatedAt: string
}

export interface UserGroup {
  id: number
  applicationId: number
  application?: Application
  code: string
  name: string
  description: string
  status: Status
  users?: User[]
  roles?: Role[]
  permissions?: Permission[]
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: string
  parentId: string
  code: string
  name: string
  description: string
  status: Status
  employeeCount: number
  createdAt: string
  updatedAt: string
  children?: Department[]
}

export interface UserGroupPayload {
  applicationId: number
  code: string
  name: string
  description: string
  status: Status
  userIds: number[]
  roleIds: number[]
  permissionIds: number[]
}

export interface User {
  id: number
  username: string
  displayName: string
  email: string
  phone: string
  bio: string
  avatarUpdatedAt: string | null
  status: Status
  roles?: Role[]
  permissions?: Permission[]
  lockedUntil?: string | null
  passwordChangedAt: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: number
  actorId: number | null
  actorName: string
  applicationId: number | null
  action: string
  resource: string
  resourceId: string
  detail: string
  ipAddress: string
  success: boolean
  createdAt: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: User
  permissions: string[]
}

export interface Session {
  id: number
  ipAddress: string
  userAgent: string
  expiresAt: string
  createdAt: string
  current: boolean
}

export interface DashboardData {
  users: number
  enabledUsers: number
  roles: number
  permissions: number
  applications: number
  recentAuditLogs: AuditLog[]
}

export interface RolePayload {
  applicationId: number
  code: string
  name: string
  description: string
  status: Status
  permissionIds: number[]
}

export interface PermissionPayload {
  code: string
  name: string
  resource: string
  action: string
  description: string
  applicationId: number
  parentId: number | null
  nodeType: PermissionNodeType
  sortOrder: number
}

export interface ApplicationPayload {
  code: string
  name: string
  description: string
  homepageUrl: string
  status: Status
}

export interface ApplicationAdministrators {
  application: Application
  userIds: number[]
  users: AdministratorIdentity[]
}

export interface AdministratorIdentity {
  id: number
  username: string
  displayName: string
  email: string
  phone: string
  status: Status
  avatarUpdatedAt: string | null
}

export interface EffectivePermission {
  permission: Permission
  sources: string[]
}

export interface PermissionPrincipalGrant {
  id: number
  identifier: string
  displayName: string
  email: string
  phone: string
  status: Status
  avatarUpdatedAt: string | null
  sources: string[]
}

export interface AvatarPayload {
  contentType: string
  data: string
}

export interface PermissionGrants {
  permission: Permission
  roleIds: number[]
  userIds: number[]
	groupIds: number[]
  departmentIds: string[]
  roles: Role[]
  users: PermissionPrincipalGrant[]
	groups: UserGroup[]
  departments: Department[]
}

export interface PermissionGrantPayload {
  roleIds: number[]
  userIds: number[]
	groupIds: number[]
  departmentIds: string[]
}

export interface RolePrincipals {
  role: Role
  userIds: number[]
	groupIds: number[]
  departmentIds: string[]
  users: PermissionPrincipalGrant[]
	groups: UserGroup[]
  departments: Department[]
}

export interface RolePrincipalPayload {
  userIds: number[]
	groupIds: number[]
  departmentIds: string[]
}
