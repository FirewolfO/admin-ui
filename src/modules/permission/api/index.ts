import { api, unwrap } from '@/api/client'
import type {
  AdministratorIdentity, Application, ApplicationAdministrators, ApplicationPayload, ApplicationSecret, AuditLog, DashboardData, Department, Page, Permission, PermissionGrantPayload, PermissionGrants, PermissionPayload, PermissionPrincipalGrant,
  Role, RolePayload, RolePrincipalPayload, RolePrincipals, Session, TokenResponse, User, UserGroup, UserGroupPayload,
} from '@permission/types'

export const authApi = {
  oauthStart: (redirectUri: string) => unwrap<{ authorizationUrl: string }>(api.get('/auth/oauth/start', { params: { redirectUri } })),
  oauthCallback: (code: string, state: string) => unwrap<TokenResponse>(api.post('/auth/oauth/callback', { code, state })),
  me: () => unwrap<{ user: User; permissions: string[] }>(api.get('/auth/me')),
  logout: (refreshToken: string) => unwrap<null>(api.post('/auth/logout', { refreshToken })),
  authorize: (permissions: string[], applicationId?: number) => unwrap<{ permissions: Record<string, boolean> }>(api.post('/auth/authorize', { permissions, applicationId })),
  sessions: () => unwrap<Session[]>(api.get('/auth/sessions')),
  revokeSession: (id: number) => unwrap<null>(api.delete(`/auth/sessions/${id}`)),
}

export const dashboardApi = {
	get: (applicationId?: number) => unwrap<DashboardData>(api.get('/dashboard', { params: applicationId ? { applicationId } : undefined })),
}

export const userApi = {
  list: (params: { page: number; pageSize: number; search?: string; status?: string; applicationId?: number; assignedOnly?: boolean }) => unwrap<Page<User>>(api.get('/users', { params })),
}

export const departmentApi = {
  list: () => unwrap<Department[]>(api.get('/departments')),
}

export const roleApi = {
  list: (applicationId?: number) => unwrap<Role[]>(api.get('/roles', { params: applicationId ? { applicationId } : undefined })),
  create: (payload: RolePayload) => unwrap<Role>(api.post('/roles', payload)),
  update: (id: number, payload: RolePayload) => unwrap<Role>(api.put(`/roles/${id}`, payload)),
  remove: (id: number) => unwrap<null>(api.delete(`/roles/${id}`)),
  principals: (id: number) => unwrap<RolePrincipals>(api.get(`/roles/${id}/principals`)),
  updatePrincipals: (id: number, payload: RolePrincipalPayload) => unwrap<RolePrincipals>(api.put(`/roles/${id}/principals`, payload)),
}

export const userGroupApi = {
  list: (applicationId: number) => unwrap<UserGroup[]>(api.get('/user-groups', { params: { applicationId } })),
  create: (payload: UserGroupPayload) => unwrap<UserGroup>(api.post('/user-groups', payload)),
  update: (id: number, payload: UserGroupPayload) => unwrap<UserGroup>(api.put(`/user-groups/${id}`, payload)),
  remove: (id: number) => unwrap<null>(api.delete(`/user-groups/${id}`)),
}

export const permissionApi = {
  list: (applicationId?: number) => unwrap<Permission[]>(api.get('/permissions', { params: applicationId ? { applicationId } : undefined })),
  tree: (applicationId: number) => unwrap<Permission[]>(api.get('/permissions/tree', { params: { applicationId } })),
  create: (payload: PermissionPayload) => unwrap<Permission>(api.post('/permissions', payload)),
  update: (id: number, payload: PermissionPayload) => unwrap<Permission>(api.put(`/permissions/${id}`, payload)),
  remove: (id: number) => unwrap<null>(api.delete(`/permissions/${id}`)),
  grants: (id: number) => unwrap<PermissionGrants>(api.get(`/permissions/${id}/grants`)),
  updateGrants: (id: number, payload: PermissionGrantPayload) => unwrap<PermissionGrants>(api.put(`/permissions/${id}/grants`, payload)),
}

export const applicationApi = {
  list: () => unwrap<Application[]>(api.get('/applications')),
  create: (payload: ApplicationPayload) => unwrap<Application>(api.post('/applications', payload)),
  update: (id: number, payload: ApplicationPayload) => unwrap<Application>(api.put(`/applications/${id}`, payload)),
  remove: (id: number) => unwrap<null>(api.delete(`/applications/${id}`)),
  rotateSecret: (id: number, gracePeriodHours = 0) => unwrap<Application>(api.post(`/applications/${id}/rotate-secret`, { gracePeriodHours })),
	secrets: (id: number) => unwrap<ApplicationSecret[]>(api.get(`/applications/${id}/secrets`)),
	revokeSecret: (applicationId: number, secretId: number) => unwrap<null>(api.delete(`/applications/${applicationId}/secrets/${secretId}`)),
  administrators: (id: number) => unwrap<ApplicationAdministrators>(api.get(`/applications/${id}/administrators`)),
  administratorCandidates: (id: number, search?: string) => unwrap<Page<AdministratorIdentity>>(api.get(`/applications/${id}/administrator-candidates`, { params: { page: 1, pageSize: 50, search: search || undefined } })),
  updateAdministrators: (id: number, userIds: string[]) => unwrap<ApplicationAdministrators>(api.put(`/applications/${id}/administrators`, { userIds })),
  systemAdministrators: (id: number) => unwrap<RolePrincipals>(api.get(`/applications/${id}/system-administrators`)),
  systemAdministratorCandidates: (id: number, search?: string) => unwrap<Page<PermissionPrincipalGrant>>(api.get(`/applications/${id}/system-administrator-candidates`, { params: { page: 1, pageSize: 50, search: search || undefined } })),
  updateSystemAdministrators: (id: number, payload: RolePrincipalPayload) => unwrap<RolePrincipals>(api.put(`/applications/${id}/system-administrators`, payload)),
}

export const auditApi = {
  list: (params: { page: number; pageSize: number; search?: string; action?: string; applicationId?: number }) => unwrap<Page<AuditLog>>(api.get('/audit-logs', { params })),
}
