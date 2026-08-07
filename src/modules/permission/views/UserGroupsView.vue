<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, ElTree, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'
import { permissionApi, roleApi, userApi, userGroupApi } from '@permission/api'
import { apiMessage } from '@/api/client'
import { useApplicationStore } from '@permission/stores/application'
import { useAuthStore } from '@/stores/auth'
import type { Permission, Role, User, UserGroup, UserGroupPayload } from '@permission/types'

const auth = useAuthStore()
const applicationStore = useApplicationStore()
const loading = ref(false)
const saving = ref(false)
const memberLoading = ref(false)
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const activeTab = ref<'basic' | 'authorization' | 'members'>('basic')
const groups = ref<UserGroup[]>([])
const roles = ref<Role[]>([])
const permissionTree = ref<Permission[]>([])
const userOptions = ref<User[]>([])
const formRef = ref<FormInstance>()
const treeRef = ref<InstanceType<typeof ElTree>>()
const form = reactive<UserGroupPayload>({ applicationId: 0, code: '', name: '', description: '', status: 'enabled', userIds: [], roleIds: [], permissionIds: [] })
const rules: FormRules = {
  code: [{ required: true, message: '请输入用户组编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入用户组名称', trigger: 'blur' }],
}
const canAssign = computed(() => auth.can('user_group:assign'))
const treeProps = {
  label: 'name', children: 'children',
  disabled: (node: unknown) => !canAssign.value || (node as Permission).nodeType === 'group',
}

function mergeByID<T extends { id: string | number }>(current: T[], incoming: T[]) {
  const values = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => values.set(item.id, item))
  return [...values.values()]
}

async function load() {
  if (!applicationStore.currentApplicationId) return
  loading.value = true
  try {
    const [groupItems, roleItems, permissions] = await Promise.all([
      userGroupApi.list(applicationStore.currentApplicationId),
      auth.can('role:list') ? roleApi.list(applicationStore.currentApplicationId) : Promise.resolve([]),
      auth.can('permission:list') ? permissionApi.tree(applicationStore.currentApplicationId) : Promise.resolve([]),
    ])
    groups.value = groupItems
    roles.value = roleItems.filter((role) => !role.builtIn)
    permissionTree.value = permissions
  } catch (error) { ElMessage.error(apiMessage(error, '用户组加载失败')) }
  finally { loading.value = false }
}

async function searchMembers(keyword = '') {
  if (!canAssign.value) return
  memberLoading.value = true
  try {
    const result = await userApi.list({ page: 1, pageSize: 50, search: keyword || undefined, applicationId: applicationStore.currentApplicationId })
    userOptions.value = mergeByID(userOptions.value.filter((item) => form.userIds.includes(item.id)), result.items)
  } catch (error) { ElMessage.error(apiMessage(error, '成员搜索失败')) }
  finally { memberLoading.value = false }
}

function resetForm() {
  Object.assign(form, { applicationId: applicationStore.currentApplicationId, code: '', name: '', description: '', status: 'enabled', userIds: [], roleIds: [], permissionIds: [] })
  userOptions.value = []
  formRef.value?.clearValidate()
}

async function showDialog(permissionIds: number[]) {
  dialogOpen.value = true
  await nextTick()
  treeRef.value?.setCheckedKeys(permissionIds)
  await searchMembers()
}

async function openCreate() {
  editingId.value = null
  activeTab.value = 'basic'
  resetForm()
  await showDialog([])
}

async function openEdit(group: UserGroup) {
  editingId.value = group.id
  activeTab.value = 'basic'
  userOptions.value = group.users || []
  Object.assign(form, {
    applicationId: group.applicationId, code: group.code, name: group.name, description: group.description, status: group.status,
    userIds: group.users?.map((item) => item.id) || [],
    roleIds: group.roles?.map((item) => item.id) || [], permissionIds: group.permissions?.map((item) => item.id) || [],
  })
  await showDialog(form.permissionIds)
}

async function save() {
  if (!await formRef.value?.validate().catch(() => false)) { activeTab.value = 'basic'; return }
  if (canAssign.value && permissionTree.value.length) form.permissionIds = (treeRef.value?.getCheckedKeys(false) || []).map(Number)
  saving.value = true
  try {
    if (editingId.value) await userGroupApi.update(editingId.value, { ...form })
    else await userGroupApi.create({ ...form })
    ElMessage.success(editingId.value ? '用户组已更新' : '用户组已创建')
    dialogOpen.value = false
    await load()
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { saving.value = false }
}

async function remove(group: UserGroup) {
  try {
    await ElMessageBox.confirm(`确定删除用户组“${group.name}”吗？`, '删除用户组', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await userGroupApi.remove(group.id)
    ElMessage.success('用户组已删除')
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
    <section class="page-heading">
      <div><h2>用户组管理</h2><p>{{ applicationStore.currentApplication?.name || '当前应用' }}的成员集合与批量授权</p></div>
      <el-button v-if="auth.can('user_group:create')" type="primary" :icon="Plus" @click="openCreate">新建用户组</el-button>
    </section>
    <section class="data-section">
      <div class="table-toolbar"><span class="table-summary">当前应用共 {{ groups.length }} 个用户组</span><el-tooltip content="刷新列表"><el-button :icon="Refresh" circle aria-label="刷新列表" @click="load" /></el-tooltip></div>
      <el-table v-loading="loading" :data="groups" empty-text="当前应用暂无用户组" class="data-table">
        <el-table-column prop="name" label="用户组" min-width="160"><template #default="scope"><span class="strong-cell">{{ scope.row.name }}</span></template></el-table-column>
        <el-table-column prop="code" label="编码" min-width="150"><template #default="scope"><code>{{ scope.row.code }}</code></template></el-table-column>
        <el-table-column prop="description" label="说明" min-width="210"><template #default="scope">{{ scope.row.description || '-' }}</template></el-table-column>
        <el-table-column label="成员" width="90"><template #default="scope">{{ scope.row.users?.length || 0 }} 人</template></el-table-column>
        <el-table-column label="角色" width="80"><template #default="scope">{{ scope.row.roles?.length || 0 }} 项</template></el-table-column>
        <el-table-column label="权限" width="80"><template #default="scope">{{ scope.row.permissions?.length || 0 }} 项</template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="scope"><el-tag :type="scope.row.status === 'enabled' ? 'success' : 'info'" effect="plain">{{ scope.row.status === 'enabled' ? '启用' : '禁用' }}</el-tag></template></el-table-column>
        <el-table-column v-if="auth.can('user_group:update') || auth.can('user_group:delete')" label="操作" width="112" fixed="right"><template #default="scope"><el-tooltip v-if="auth.can('user_group:update')" content="编辑"><el-button text circle :icon="Edit" aria-label="编辑用户组" @click="openEdit(scope.row)" /></el-tooltip><el-tooltip v-if="auth.can('user_group:delete')" content="删除"><el-button text circle type="danger" :icon="Delete" aria-label="删除用户组" @click="remove(scope.row)" /></el-tooltip></template></el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑用户组' : '新建用户组'" width="min(720px, 94vw)" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-tabs v-model="activeTab" class="entity-form-tabs">
          <el-tab-pane label="基本信息" name="basic">
            <el-form-item label="所属应用"><el-input :model-value="applicationStore.currentApplication?.name" disabled /></el-form-item>
            <div class="form-grid"><el-form-item label="用户组名称" prop="name"><el-input v-model="form.name" /></el-form-item><el-form-item label="用户组编码" prop="code"><el-input v-model="form.code" placeholder="例如 content_team" /></el-form-item></div>
            <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
            <el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio-button value="enabled">启用</el-radio-button><el-radio-button value="disabled">禁用</el-radio-button></el-radio-group></el-form-item>
          </el-tab-pane>
          <el-tab-pane label="角色与权限" name="authorization">
            <el-form-item label="关联角色"><el-select v-model="form.roleIds" multiple filterable class="full-width" placeholder="选择角色" :disabled="!canAssign"><el-option v-for="role in roles" :key="role.id" :label="`${role.name} (${role.code})`" :value="role.id" /></el-select></el-form-item>
            <el-form-item label="直接权限"><div class="permission-tree-picker"><el-tree ref="treeRef" :data="permissionTree" node-key="id" :props="treeProps" show-checkbox default-expand-all check-strictly empty-text="当前应用暂无权限"><template #default="{ data }"><span class="tree-node-label"><strong>{{ data.name }}</strong><code v-if="data.nodeType === 'permission'">{{ data.code }}</code></span></template></el-tree></div></el-form-item>
          </el-tab-pane>
          <el-tab-pane label="成员" name="members">
            <el-form-item label="People 用户">
              <el-select v-model="form.userIds" multiple filterable remote reserve-keyword :remote-method="searchMembers" :loading="memberLoading" :disabled="!canAssign" class="full-width" placeholder="输入用户名或姓名搜索"><el-option v-for="user in userOptions" :key="user.id" :label="`${user.displayName || user.username} (${user.username})`" :value="user.id" /></el-select>
            </el-form-item>
            <el-empty v-if="!form.userIds.length" description="暂无成员" :image-size="64" />
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
