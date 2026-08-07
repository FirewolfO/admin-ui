<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, ElTree, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'
import { applicationApi, permissionApi, roleApi, userApi, userGroupApi } from '@permission/api'
import { apiMessage, avatarUrl } from '@/api/client'
import { useApplicationStore } from '@permission/stores/application'
import { useAuthStore } from '@/stores/auth'
import IdentityAvatar from '@permission/components/IdentityAvatar.vue'
import type { Permission, PermissionPrincipalGrant, Role, RolePayload, Status, UserGroup } from '@permission/types'

const auth = useAuthStore()
const applicationStore = useApplicationStore()
const loading = ref(false)
const saving = ref(false)
const roles = ref<Role[]>([])
const permissionTree = ref<Permission[]>([])
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const editingRole = ref<Role | null>(null)
const activeTab = ref<'basic' | 'permissions' | 'principals'>('basic')
const principalsLoading = ref(false)
const principalSearching = ref(false)
const principalsLoaded = ref(false)
const userOptions = ref<PermissionPrincipalGrant[]>([])
const groupOptions = ref<UserGroup[]>([])
const principalForm = reactive({ userIds: [] as number[], groupIds: [] as number[] })
const formRef = ref<FormInstance>()
const treeRef = ref<InstanceType<typeof ElTree>>()
const form = reactive<RolePayload>({ applicationId: 0, code: '', name: '', description: '', status: 'enabled', permissionIds: [] })
const rules: FormRules = {
  code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
}
const treeProps = {
  label: 'name', children: 'children',
  disabled: (node: unknown) => (node as Permission).nodeType === 'group' || editingRole.value?.builtIn || !auth.can('role:assign'),
}
const managementRole = computed(() => Boolean(editingRole.value?.builtIn && ['system_admin', 'super_admin'].includes(editingRole.value.code)))
const systemAdministratorRole = computed(() => Boolean(editingRole.value?.builtIn && editingRole.value.code === 'system_admin'))
const canEditPrincipals = computed(() => auth.can('role:update') && (managementRole.value ? auth.can('application:update') : auth.can('user:assign')))
const canEditGroups = computed(() => auth.can('role:update') && auth.can('user_group:assign') && !managementRole.value)
const selectedPrincipals = computed(() => userOptions.value.filter((item) => principalForm.userIds.includes(item.id)))

function isManagementRole(role: Role) { return role.builtIn && ['system_admin', 'super_admin'].includes(role.code) }

async function load() {
  if (!applicationStore.currentApplicationId) return
  loading.value = true
  try {
    const [roleItems, permissionItems] = await Promise.all([
      roleApi.list(applicationStore.currentApplicationId),
      auth.can('permission:list') ? permissionApi.tree(applicationStore.currentApplicationId) : Promise.resolve([]),
    ])
    roles.value = roleItems
    permissionTree.value = permissionItems
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { loading.value = false }
}

function resetForm() {
  Object.assign(form, { applicationId: applicationStore.currentApplicationId, code: '', name: '', description: '', status: 'enabled' as Status, permissionIds: [] })
  formRef.value?.clearValidate()
}
function resetPrincipals() {
  Object.assign(principalForm, { userIds: [], groupIds: [] })
  userOptions.value = []
	groupOptions.value = []
  principalsLoaded.value = false
}
function mergePrincipalOptions(current: PermissionPrincipalGrant[], incoming: PermissionPrincipalGrant[]) {
  const values = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => values.set(item.id, item))
  return [...values.values()]
}
async function searchGlobalUsers(keyword: string) {
  if (managementRole.value && !auth.can('application:update')) return
  if (!managementRole.value && !auth.can('user:list')) return
  principalSearching.value = true
  try {
	const result = systemAdministratorRole.value
	  ? await applicationApi.systemAdministratorCandidates(applicationStore.currentApplicationId, keyword)
	  : await userApi.list({ page: 1, pageSize: 50, search: keyword || undefined, applicationId: applicationStore.currentApplicationId })
    const incoming = result.items.map((user) => ('identifier' in user
      ? user
      : { id: user.id, identifier: user.username, displayName: user.displayName, email: user.email, phone: user.phone, status: user.status, avatarUpdatedAt: user.avatarUpdatedAt, sources: [] }))
    userOptions.value = mergePrincipalOptions(userOptions.value.filter((item) => principalForm.userIds.includes(item.id)), incoming)
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { principalSearching.value = false }
}
async function primePrincipalOptions() {
	await searchGlobalUsers('')
	if (auth.can('user_group:list') && !managementRole.value) {
	  groupOptions.value = await userGroupApi.list(applicationStore.currentApplicationId)
	}
}
function principalAvatarUrl(principal: PermissionPrincipalGrant) {
  const identity = { id: principal.id, avatarUpdatedAt: principal.avatarUpdatedAt }
  return avatarUrl(identity)
}
async function showDialog(checkedKeys: number[]) {
  activeTab.value = editingRole.value?.builtIn ? 'principals' : 'basic'
  dialogOpen.value = true
  await nextTick()
  treeRef.value?.setCheckedKeys(checkedKeys)
}
async function openCreate() {
  editingId.value = null
  editingRole.value = null
  resetForm()
  resetPrincipals()
  principalsLoaded.value = true
  await showDialog([])
  await primePrincipalOptions()
}
async function openEdit(role: Role) {
  editingId.value = role.id
  editingRole.value = role
  resetPrincipals()
  Object.assign(form, { applicationId: role.applicationId, code: role.code, name: role.name, description: role.description, status: role.status, permissionIds: role.permissions?.map((item) => item.id) || [] })
  await showDialog(form.permissionIds)
  principalsLoading.value = true
  try {
    const result = await roleApi.principals(role.id)
    Object.assign(principalForm, { userIds: result.userIds, groupIds: result.groupIds })
    userOptions.value = result.users
    principalsLoaded.value = true
    await primePrincipalOptions()
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { principalsLoading.value = false }
}
async function save() {
	if (!editingRole.value?.builtIn && !await formRef.value?.validate().catch(() => false)) { activeTab.value = 'basic'; return }
	if (!editingRole.value?.builtIn) form.permissionIds = (treeRef.value?.getCheckedKeys(false) || []).map(Number)
  saving.value = true
  try {
	if (editingRole.value?.builtIn) {
	  if (!editingId.value || !canEditPrincipals.value || !principalsLoaded.value) return
		  await roleApi.updatePrincipals(editingId.value, { userIds: principalForm.userIds, groupIds: [] })
	} else {
	  const saved = editingId.value ? await roleApi.update(editingId.value, { ...form }) : await roleApi.create({ ...form })
		  if ((canEditPrincipals.value || canEditGroups.value) && principalsLoaded.value) await roleApi.updatePrincipals(saved.id, { userIds: principalForm.userIds, groupIds: principalForm.groupIds })
	}
	ElMessage.success(editingRole.value?.builtIn ? '管理主体已更新' : editingId.value ? '角色已更新' : '角色已创建')
    dialogOpen.value = false
    await load()
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { saving.value = false }
}
async function remove(role: Role) {
  try {
    await ElMessageBox.confirm(`确定删除角色“${role.name}”吗？`, '删除角色', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await roleApi.remove(role.id)
    ElMessage.success('角色已删除')
    await load()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error)) }
}

onMounted(async () => {
  try { await applicationStore.hydrate() }
  catch (error) { ElMessage.error(apiMessage(error)) }
  await load()
})
watch(() => applicationStore.currentApplicationId, () => { dialogOpen.value = false; load() })
</script>

<template>
  <div class="page-stack">
    <section class="page-heading"><div><h2>角色管理</h2><p>{{ applicationStore.currentApplication?.name || '当前应用' }}的角色与权限组合</p></div><el-button v-if="auth.can('role:create')" type="primary" :icon="Plus" @click="openCreate">新建角色</el-button></section>
    <section class="data-section">
      <div class="table-toolbar"><span class="table-summary">当前应用共 {{ roles.length }} 个角色</span><el-tooltip content="刷新列表"><el-button :icon="Refresh" circle aria-label="刷新列表" @click="load" /></el-tooltip></div>
      <el-table v-loading="loading" :data="roles" empty-text="当前应用暂无角色" class="data-table">
        <el-table-column prop="name" label="角色名称" min-width="150"><template #default="scope"><span class="strong-cell">{{ scope.row.name }}</span><el-tag v-if="scope.row.builtIn" type="info" effect="plain" size="small">内置</el-tag></template></el-table-column>
        <el-table-column prop="code" label="角色编码" min-width="160"><template #default="scope"><code>{{ scope.row.code }}</code></template></el-table-column>
        <el-table-column prop="description" label="说明" min-width="220"><template #default="scope">{{ scope.row.description || '-' }}</template></el-table-column>
        <el-table-column label="权限" width="100"><template #default="scope">{{ ['super_admin', 'system_admin'].includes(scope.row.code) ? '全部' : `${scope.row.permissions?.length || 0} 项` }}</template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="scope"><el-tag :type="scope.row.status === 'enabled' ? 'success' : 'info'" effect="plain">{{ scope.row.status === 'enabled' ? '启用' : '禁用' }}</el-tag></template></el-table-column>
        <el-table-column v-if="auth.can('role:update') || auth.can('role:delete')" label="操作" width="112" fixed="right"><template #default="scope"><el-tooltip v-if="auth.can('role:update')" :content="isManagementRole(scope.row) ? '管理主体' : '编辑'"><el-button text circle :icon="Edit" :aria-label="isManagementRole(scope.row) ? '管理角色主体' : '编辑角色'" :disabled="scope.row.builtIn && !isManagementRole(scope.row)" @click="openEdit(scope.row)" /></el-tooltip><el-tooltip v-if="auth.can('role:delete')" content="删除"><el-button text circle type="danger" :icon="Delete" aria-label="删除角色" :disabled="scope.row.builtIn" @click="remove(scope.row)" /></el-tooltip></template></el-table-column>
      </el-table>
    </section>
    <el-dialog v-model="dialogOpen" :title="editingRole?.builtIn ? '管理角色主体' : editingId ? '编辑角色' : '新建角色'" width="min(680px, 94vw)" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
		<el-tabs v-model="activeTab" class="entity-form-tabs">
		  <el-tab-pane label="基本信息" name="basic">
			<el-form-item label="所属应用"><el-input :model-value="applicationStore.currentApplication?.name" disabled /></el-form-item>
			<div class="form-grid"><el-form-item label="角色名称" prop="name"><el-input v-model="form.name" :disabled="editingRole?.builtIn" /></el-form-item><el-form-item label="角色编码" prop="code"><el-input v-model="form.code" placeholder="例如 content_editor" :disabled="editingRole?.builtIn" /></el-form-item></div>
			<el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="2" :disabled="editingRole?.builtIn" /></el-form-item>
			<el-form-item label="状态"><el-radio-group v-model="form.status" :disabled="editingRole?.builtIn"><el-radio-button value="enabled">启用</el-radio-button><el-radio-button value="disabled">禁用</el-radio-button></el-radio-group></el-form-item>
		  </el-tab-pane>
		  <el-tab-pane label="权限配置" name="permissions">
			<el-form-item label="权限范围"><div class="permission-tree-picker"><el-tree ref="treeRef" :data="permissionTree" node-key="id" :props="treeProps" show-checkbox default-expand-all check-strictly empty-text="当前应用暂无权限"><template #default="{ data }"><span class="tree-node-label"><strong>{{ data.name }}</strong><code v-if="data.nodeType === 'permission'">{{ data.code }}</code></span></template></el-tree></div></el-form-item>
		  </el-tab-pane>
		  <el-tab-pane label="关联主体" name="principals">
			<div v-loading="principalsLoading" class="role-principal-editor">
				  <el-form-item label="关联 People 用户"><el-select v-model="principalForm.userIds" multiple filterable remote reserve-keyword :remote-method="searchGlobalUsers" :loading="principalSearching" :disabled="!canEditPrincipals" class="full-width" placeholder="输入用户名、姓名、邮箱或电话搜索"><el-option v-for="user in userOptions" :key="user.id" class="identity-select-option" :label="`${user.displayName || user.identifier} (${user.identifier})`" :value="user.id"><div class="select-user-option"><IdentityAvatar :name="user.displayName" :identifier="user.identifier" :src="principalAvatarUrl(user)" :size="28" :email="user.email" :phone="user.phone" :status="user.status" /><span><strong>{{ user.displayName || user.identifier }}</strong><small>{{ user.identifier }}</small></span></div></el-option></el-select></el-form-item>
			  <el-form-item v-if="!managementRole" label="关联用户组"><el-select v-model="principalForm.groupIds" multiple filterable class="full-width" placeholder="选择当前应用用户组" :disabled="!canEditGroups"><el-option v-for="group in groupOptions" :key="group.id" :label="`${group.name} (${group.code})`" :value="group.id" /></el-select></el-form-item>
				  <div class="associated-principal-list"><el-empty v-if="!selectedPrincipals.length" description="暂无关联主体" :image-size="56" /><template v-else><div v-for="principal in selectedPrincipals" :key="principal.id" class="associated-principal"><IdentityAvatar :name="principal.displayName" :identifier="principal.identifier" :src="principalAvatarUrl(principal)" :size="34" :email="principal.email" :phone="principal.phone" :status="principal.status" /><span><strong>{{ principal.displayName || principal.identifier }}</strong><small>{{ principal.identifier }}</small></span><el-tag :type="principal.status === 'enabled' ? 'success' : 'info'" effect="plain" size="small">{{ principal.status === 'enabled' ? '启用' : '禁用' }}</el-tag></div></template></div>
			</div>
		  </el-tab-pane>
		</el-tabs>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="Boolean(editingRole?.builtIn && !canEditPrincipals)" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
