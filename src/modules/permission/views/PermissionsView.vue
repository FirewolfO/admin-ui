<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Edit, FolderAdd, Plus, Refresh, Search, UserFilled } from '@element-plus/icons-vue'
import { departmentApi, permissionApi, roleApi, userApi, userGroupApi } from '@permission/api'
import { apiMessage } from '@/api/client'
import { useApplicationStore } from '@permission/stores/application'
import { useAuthStore } from '@/stores/auth'
import IdentityAvatar from '@permission/components/IdentityAvatar.vue'
import { buildDepartmentTree } from '@permission/utils/departments'
import type { Department, Permission, PermissionGrants, PermissionNodeType, PermissionPayload, PermissionPrincipalGrant, Role, UserGroup } from '@permission/types'

const auth = useAuthStore()
const applicationStore = useApplicationStore()
const loading = ref(false)
const saving = ref(false)
const permissions = ref<Permission[]>([])
const search = ref('')
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<PermissionPayload>({ code: '', name: '', resource: '', action: '', description: '', applicationId: 0, parentId: null, nodeType: 'permission', sortOrder: 0 })
const grantOpen = ref(false)
const grantLoading = ref(false)
const grantSaving = ref(false)
const grantPermission = ref<Permission | null>(null)
const grants = ref<PermissionGrants | null>(null)
const grantRoles = ref<Role[]>([])
const grantGroups = ref<UserGroup[]>([])
const departmentOptions = ref<Department[]>([])
const userOptions = ref<PermissionPrincipalGrant[]>([])
const principalSearching = ref(false)
const grantForm = reactive({ roleIds: [] as number[], userIds: [] as string[], groupIds: [] as number[], departmentIds: [] as string[] })
const canEditRoleGrants = computed(() => auth.can('permission:update') && auth.can('role:assign') && auth.can('role:list'))
const canEditUserGrants = computed(() => auth.can('permission:update') && auth.can('user:assign'))
const canEditGroupGrants = computed(() => auth.can('permission:update') && auth.can('user_group:assign'))
const canEditDepartmentGrants = computed(() => auth.can('permission:update') && auth.can('user:assign'))
const canSaveGrants = computed(() => canEditRoleGrants.value || canEditGroupGrants.value || canEditUserGrants.value || canEditDepartmentGrants.value)
const departmentTree = computed(() => buildDepartmentTree(departmentOptions.value))
const departmentTreeProps = {
  label: 'name', children: 'children',
  disabled: (node: Department) => node.status !== 'enabled',
}
const rules: FormRules = {
  code: [{ required: true, message: '请输入节点编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入节点名称', trigger: 'blur' }],
  resource: [{ validator: (_rule, value, callback) => form.nodeType === 'permission' && !value?.trim() ? callback(new Error('请输入资源标识')) : callback(), trigger: 'blur' }],
  action: [{ validator: (_rule, value, callback) => form.nodeType === 'permission' && !value?.trim() ? callback(new Error('请输入动作标识')) : callback(), trigger: 'blur' }],
}

function filterTree(nodes: Permission[], keyword: string): Permission[] {
  return nodes.flatMap((node) => {
    const children = filterTree(node.children || [], keyword)
    const matched = [node.code, node.name, node.resource, node.action].some((value) => value.toLowerCase().includes(keyword))
    return matched || children.length ? [{ ...node, children }] : []
  })
}

function groupTree(nodes: Permission[]): Permission[] {
  return nodes.filter((node) => node.nodeType === 'group' && node.id !== editingId.value).map((node) => ({ ...node, children: groupTree(node.children || []) }))
}

const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return keyword ? filterTree(permissions.value, keyword) : permissions.value
})
const parentGroups = computed(() => groupTree(permissions.value))

async function load() {
  if (!applicationStore.currentApplicationId) return
  loading.value = true
  try { permissions.value = await permissionApi.tree(applicationStore.currentApplicationId) }
  catch (error) { ElMessage.error(apiMessage(error)) }
  finally { loading.value = false }
}

function resetForm(nodeType: PermissionNodeType, parentId: number | null = null) {
  Object.assign(form, { code: '', name: '', resource: '', action: '', description: '', applicationId: applicationStore.currentApplicationId, parentId, nodeType, sortOrder: 0 })
  formRef.value?.clearValidate()
}
function openCreate(nodeType: PermissionNodeType, parentId: number | null = null) {
  editingId.value = null
  resetForm(nodeType, parentId)
  dialogOpen.value = true
}
function openEdit(permission: Permission) {
  editingId.value = permission.id
  Object.assign(form, { code: permission.code, name: permission.name, resource: permission.resource, action: permission.action, description: permission.description, applicationId: permission.applicationId, parentId: permission.parentId, nodeType: permission.nodeType, sortOrder: permission.sortOrder })
  dialogOpen.value = true
}
async function save() {
  if (!await formRef.value?.validate().catch(() => false)) return
  saving.value = true
  const payload = { ...form, resource: form.nodeType === 'group' ? '' : form.resource, action: form.nodeType === 'group' ? '' : form.action }
  try {
    if (editingId.value) await permissionApi.update(editingId.value, payload)
    else await permissionApi.create(payload)
    ElMessage.success(editingId.value ? '节点已更新' : '节点已创建')
    dialogOpen.value = false
    await load()
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { saving.value = false }
}
async function remove(permission: Permission) {
  try {
    await ElMessageBox.confirm(`确定删除${permission.nodeType === 'group' ? '分组' : '权限'}“${permission.name}”吗？`, '删除节点', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await permissionApi.remove(permission.id)
    ElMessage.success('节点已删除')
    await load()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error)) }
}

function mergePrincipalOptions(current: PermissionPrincipalGrant[], incoming: PermissionPrincipalGrant[]) {
  const values = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => values.set(item.id, item))
  return [...values.values()]
}
async function searchGlobalUsers(keyword: string) {
  if (!auth.can('user:list')) return
  principalSearching.value = true
  try {
    const result = await userApi.list({ page: 1, pageSize: 50, search: keyword || undefined, applicationId: applicationStore.currentApplicationId })
    const options = result.items.map((user) => ({ id: user.id, identifier: user.username, displayName: user.displayName, email: user.email, phone: user.phone, status: user.status, sources: [] }))
    userOptions.value = mergePrincipalOptions(userOptions.value.filter((item) => grantForm.userIds.includes(item.id)), options)
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { principalSearching.value = false }
}
async function openGrants(permission: Permission) {
  grantPermission.value = permission
  grantOpen.value = true
  grantLoading.value = true
  try {
	const [grantResult, roles, groups, departments] = await Promise.all([
	  permissionApi.grants(permission.id),
	  auth.can('role:list') ? roleApi.list(applicationStore.currentApplicationId) : Promise.resolve([]),
	  auth.can('user_group:list') ? userGroupApi.list(applicationStore.currentApplicationId) : Promise.resolve([]),
	  auth.can('user:list') ? departmentApi.list() : Promise.resolve([]),
	])
    grants.value = grantResult
    grantRoles.value = (roles.length ? roles : grantResult.roles).filter((role) => role.status === 'enabled')
	grantGroups.value = groups.length ? groups : grantResult.groups
	departmentOptions.value = departments.length ? departments : grantResult.departments
    Object.assign(grantForm, { roleIds: [...grantResult.roleIds], userIds: [...grantResult.userIds], groupIds: [...grantResult.groupIds], departmentIds: [...grantResult.departmentIds] })
    userOptions.value = grantResult.users.filter((item) => grantResult.userIds.includes(item.id))
	    if (auth.can('user:list')) await searchGlobalUsers('')
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { grantLoading.value = false }
}
async function saveGrants() {
  if (!grantPermission.value) return
  grantSaving.value = true
  try {
	grants.value = await permissionApi.updateGrants(grantPermission.value.id, { roleIds: grantForm.roleIds, userIds: grantForm.userIds, groupIds: grantForm.groupIds, departmentIds: grantForm.departmentIds })
    ElMessage.success('授权主体已更新')
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { grantSaving.value = false }
}
onMounted(async () => {
  try { await applicationStore.hydrate() }
  catch (error) { ElMessage.error(apiMessage(error)) }
  await load()
})
watch(() => applicationStore.currentApplicationId, () => { dialogOpen.value = false; grantOpen.value = false; load() })
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><h2>权限管理</h2><p>{{ applicationStore.currentApplication?.name || '当前应用' }}的权限目录与授权能力</p></div>
      <div v-if="auth.can('permission:create')" class="heading-actions"><el-button :icon="FolderAdd" @click="openCreate('group')">新建分组</el-button><el-button type="primary" :icon="Plus" @click="openCreate('permission')">新建权限</el-button></div>
    </section>
    <section class="data-section">
      <div class="table-toolbar"><el-input v-model="search" clearable placeholder="搜索编码、名称、资源或动作" :prefix-icon="Search" class="search-input" /><el-tooltip content="刷新权限树"><el-button :icon="Refresh" circle aria-label="刷新权限树" @click="load" /></el-tooltip></div>
      <el-table v-loading="loading" :data="filtered" row-key="id" default-expand-all :tree-props="{ children: 'children' }" empty-text="当前应用暂无权限" class="data-table permission-tree-table">
        <el-table-column prop="name" label="节点名称" min-width="220"><template #default="scope"><span class="strong-cell">{{ scope.row.name }}</span><el-tag :type="scope.row.nodeType === 'group' ? 'warning' : 'success'" effect="plain" size="small">{{ scope.row.nodeType === 'group' ? '分组' : '权限' }}</el-tag><el-tag v-if="scope.row.builtIn" type="info" effect="plain" size="small">内置</el-tag></template></el-table-column>
        <el-table-column prop="code" label="节点编码" min-width="210"><template #default="scope"><code>{{ scope.row.code }}</code></template></el-table-column>
        <el-table-column label="资源 / 动作" min-width="170"><template #default="scope"><span v-if="scope.row.nodeType === 'permission'"><code>{{ scope.row.resource }}</code> / <code>{{ scope.row.action }}</code></span><span v-else>-</span></template></el-table-column>
        <el-table-column prop="description" label="说明" min-width="190"><template #default="scope">{{ scope.row.description || '-' }}</template></el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="72" />
		<el-table-column label="授权实体" width="132"><template #default="scope"><el-button v-if="scope.row.nodeType === 'permission'" link type="primary" :icon="UserFilled" @click="openGrants(scope.row)">{{ canSaveGrants ? '查看与授权' : '查看' }}</el-button><span v-else>-</span></template></el-table-column>
		<el-table-column v-if="auth.can('permission:create') || auth.can('permission:update') || auth.can('permission:delete')" label="操作" width="148" fixed="right"><template #default="scope"><el-tooltip v-if="scope.row.nodeType === 'group' && auth.can('permission:create')" content="新建子节点"><el-button text circle :icon="Plus" aria-label="新建子节点" @click="openCreate('permission', scope.row.id)" /></el-tooltip><el-tooltip v-if="auth.can('permission:update')" content="编辑"><el-button text circle :icon="Edit" aria-label="编辑节点" :disabled="scope.row.builtIn" @click="openEdit(scope.row)" /></el-tooltip><el-tooltip v-if="auth.can('permission:delete')" content="删除"><el-button text circle type="danger" :icon="Delete" aria-label="删除节点" :disabled="scope.row.builtIn" @click="remove(scope.row)" /></el-tooltip></template></el-table-column>
      </el-table>
    </section>
    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑权限节点' : '新建权限节点'" width="min(600px, 94vw)" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid"><el-form-item label="所属应用"><el-input :model-value="applicationStore.currentApplication?.name" disabled /></el-form-item><el-form-item label="节点类型"><el-radio-group v-model="form.nodeType"><el-radio-button value="group">分组</el-radio-button><el-radio-button value="permission">权限</el-radio-button></el-radio-group></el-form-item></div>
        <div class="form-grid"><el-form-item label="节点名称" prop="name"><el-input v-model="form.name" /></el-form-item><el-form-item label="节点编码" prop="code"><el-input v-model="form.code" :placeholder="form.nodeType === 'group' ? '例如 content' : '例如 article:publish'" /></el-form-item></div>
        <div class="form-grid"><el-form-item label="上级分组"><el-tree-select v-model="form.parentId" :data="parentGroups" node-key="id" :props="{ label: 'name', children: 'children' }" check-strictly clearable class="full-width" placeholder="根节点" /></el-form-item><el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="-999" :max="9999" class="full-width" /></el-form-item></div>
        <div v-if="form.nodeType === 'permission'" class="form-grid"><el-form-item label="资源标识" prop="resource"><el-input v-model="form.resource" placeholder="article" /></el-form-item><el-form-item label="动作标识" prop="action"><el-input v-model="form.action" placeholder="publish" /></el-form-item></div>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
	  <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
	</el-dialog>
	<el-dialog v-model="grantOpen" :title="`${grantPermission?.name || ''} / 授权主体`" width="min(760px, 96vw)" destroy-on-close>
	  <div v-loading="grantLoading" class="grant-editor">
		<el-form label-position="top">
		  <el-form-item label="授权角色"><el-select v-model="grantForm.roleIds" multiple filterable clearable class="full-width" placeholder="选择当前应用角色" :disabled="!canEditRoleGrants"><el-option v-for="role in grantRoles" :key="role.id" :label="`${role.name} (${role.code})`" :value="role.id" :disabled="role.code === 'system_admin'" /></el-select></el-form-item>
		  <el-form-item label="授权用户组"><el-select v-model="grantForm.groupIds" multiple filterable clearable class="full-width" placeholder="选择当前应用用户组" :disabled="!canEditGroupGrants"><el-option v-for="group in grantGroups" :key="group.id" :label="`${group.name} (${group.code})`" :value="group.id" /></el-select></el-form-item>
		  <el-form-item label="直接授权 People 部门"><el-tree-select v-model="grantForm.departmentIds" :data="departmentTree" node-key="id" :props="departmentTreeProps" multiple check-strictly filterable collapse-tags collapse-tags-tooltip class="full-width" placeholder="选择部门，授权自动覆盖全部下级部门" :disabled="!canEditDepartmentGrants" /></el-form-item>
			  <el-form-item label="直接授权 People 用户"><el-select v-model="grantForm.userIds" multiple filterable remote reserve-keyword :remote-method="searchGlobalUsers" :loading="principalSearching" class="full-width" placeholder="输入用户名、姓名、邮箱或电话搜索" :disabled="!canEditUserGrants"><el-option v-for="user in userOptions" :key="user.id" class="identity-select-option" :label="`${user.displayName || user.identifier} (${user.identifier})`" :value="user.id"><div class="select-user-option"><IdentityAvatar :name="user.displayName" :identifier="user.identifier" :size="28" :email="user.email" :phone="user.phone" :status="user.status" /><span><strong>{{ user.displayName || user.identifier }}</strong><small>{{ user.identifier }}</small></span></div></el-option></el-select></el-form-item>
		</el-form>
		<div class="grant-summary"><h4>已获得此权限的主体</h4><el-tabs>
		  <el-tab-pane :label="`角色 ${grants?.roles.length || 0}`"><el-empty v-if="!grants?.roles.length" description="暂无角色" :image-size="56" /><div v-else class="grant-list"><div v-for="role in grants?.roles || []" :key="role.id"><span><strong>{{ role.name }}</strong><code>{{ role.code }}</code></span><el-tag effect="plain">角色授权</el-tag></div></div></el-tab-pane>
		  <el-tab-pane :label="`用户组 ${grants?.groups.length || 0}`"><el-empty v-if="!grants?.groups.length" description="暂无用户组" :image-size="56" /><div v-else class="grant-list"><div v-for="group in grants?.groups || []" :key="group.id"><span><strong>{{ group.name }}</strong><code>{{ group.code }}</code></span><el-tag effect="plain">用户组授权</el-tag></div></div></el-tab-pane>
		  <el-tab-pane :label="`People 部门 ${grants?.departments.length || 0}`"><el-empty v-if="!grants?.departments.length" description="暂无部门" :image-size="56" /><div v-else class="grant-list"><div v-for="department in grants?.departments || []" :key="department.id"><span><strong>{{ department.name }}</strong><code>{{ department.code }}</code></span><el-tag effect="plain">含下级部门</el-tag></div></div></el-tab-pane>
			  <el-tab-pane :label="`People 用户 ${grants?.users.length || 0}`"><el-empty v-if="!grants?.users.length" description="暂无用户" :image-size="56" /><div v-else class="grant-list"><div v-for="user in grants?.users || []" :key="user.id"><span><IdentityAvatar :name="user.displayName" :identifier="user.identifier" :size="32" :email="user.email" :phone="user.phone" :status="user.status" /><span><strong>{{ user.displayName || user.identifier }}</strong><code>{{ user.identifier }}</code></span></span><span><el-tag v-for="source in user.sources" :key="source" effect="plain" class="inline-tag">{{ source }}</el-tag></span></div></div></el-tab-pane>
		</el-tabs></div>
	  </div>
	  <template #footer><el-button @click="grantOpen = false">关闭</el-button><el-button v-if="canSaveGrants" type="primary" :loading="grantSaving" @click="saveGrants">保存授权</el-button></template>
	</el-dialog>
  </div>
</template>
