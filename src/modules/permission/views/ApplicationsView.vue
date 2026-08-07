<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Clock, CopyDocument, Delete, Edit, Key, Link, Plus, Refresh, UserFilled } from '@element-plus/icons-vue'
import { applicationApi } from '@permission/api'
import { apiMessage, avatarUrl } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useApplicationStore } from '@permission/stores/application'
import { copyText } from '@permission/utils/clipboard'
import IdentityAvatar from '@permission/components/IdentityAvatar.vue'
import type { Application, ApplicationPayload, ApplicationSecret, PermissionPrincipalGrant, Status } from '@permission/types'

const auth = useAuthStore()
const applicationStore = useApplicationStore()
const loading = ref(false)
const saving = ref(false)
const applications = ref<Application[]>([])
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const credentialOpen = ref(false)
const credential = ref({ clientId: '', clientSecret: '' })
const rotateOpen = ref(false)
const rotating = ref(false)
const rotateApplication = ref<Application | null>(null)
const gracePeriodHours = ref(24)
const secretHistoryOpen = ref(false)
const secretHistoryLoading = ref(false)
const secretHistoryApplication = ref<Application | null>(null)
const secretHistory = ref<ApplicationSecret[]>([])
const administratorOpen = ref(false)
const administratorLoading = ref(false)
const administratorSaving = ref(false)
const administratorSearching = ref(false)
const administratorApplication = ref<Application | null>(null)
const administratorOptions = ref<PermissionPrincipalGrant[]>([])
const administratorIds = ref<number[]>([])
const selectedAdministrators = computed(() => administratorOptions.value.filter((user) => administratorIds.value.includes(user.id)))
const formRef = ref<FormInstance>()
const form = reactive<ApplicationPayload>({ code: '', name: '', description: '', homepageUrl: '', status: 'enabled' })
const rules: FormRules = {
  code: [{ required: true, message: '请输入应用编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
  homepageUrl: [{ type: 'url', message: '请输入有效的 HTTP(S) 地址', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    applications.value = await applicationApi.list()
    applicationStore.setApplications(applications.value)
  }
  catch (error) { ElMessage.error(apiMessage(error)) }
  finally { loading.value = false }
}
function resetForm() { Object.assign(form, { code: '', name: '', description: '', homepageUrl: '', status: 'enabled' as Status }); formRef.value?.clearValidate() }
function openCreate() { editingId.value = null; resetForm(); dialogOpen.value = true }
function openEdit(application: Application) {
  editingId.value = application.id
  Object.assign(form, { code: application.code, name: application.name, description: application.description, homepageUrl: application.homepageUrl, status: application.status })
  dialogOpen.value = true
}
async function save() {
  if (!await formRef.value?.validate().catch(() => false)) return
  saving.value = true
  try {
    const payload: ApplicationPayload = { ...form }
    const result = editingId.value ? await applicationApi.update(editingId.value, payload) : await applicationApi.create(payload)
    ElMessage.success(editingId.value ? '应用已更新' : '应用已创建')
    dialogOpen.value = false
    if (result.clientSecret) showCredential(result)
    await load()
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { saving.value = false }
}
function showCredential(application: Application) {
  credential.value = { clientId: application.clientId, clientSecret: application.clientSecret || '' }
  credentialOpen.value = true
}
async function copyApplicationSecret(application: Application) {
  if (!application.clientSecret) {
    ElMessage.warning('该历史密钥无法恢复，请先轮换密钥后再复制')
    return
  }
  try {
    await copyText(application.clientSecret)
    ElMessage.success('客户端密钥已复制')
  } catch { ElMessage.error('复制失败，请检查浏览器剪贴板权限') }
}
async function copyCredentialSecret() {
  if (!credential.value.clientSecret) return
  try {
    await copyText(credential.value.clientSecret)
    ElMessage.success('客户端密钥已复制')
  } catch { ElMessage.error('复制失败，请检查浏览器剪贴板权限') }
}
function clearCredential() { credential.value = { clientId: '', clientSecret: '' } }
function openRotateSecret(application: Application) {
	rotateApplication.value = application
	gracePeriodHours.value = 24
	rotateOpen.value = true
}
async function rotateSecret() {
	if (!rotateApplication.value) return
	rotating.value = true
  try {
	const result = await applicationApi.rotateSecret(rotateApplication.value.id, gracePeriodHours.value)
	rotateOpen.value = false
	showCredential(result)
    ElMessage.success('应用密钥已轮换')
	await load()
	if (secretHistoryApplication.value?.id === result.id) await loadSecretHistory()
  } catch (error) { ElMessage.error(apiMessage(error)) }
	finally { rotating.value = false }
}
async function loadSecretHistory() {
	if (!secretHistoryApplication.value) return
	secretHistoryLoading.value = true
	try { secretHistory.value = await applicationApi.secrets(secretHistoryApplication.value.id) }
	catch (error) { ElMessage.error(apiMessage(error, '密钥历史加载失败')) }
	finally { secretHistoryLoading.value = false }
}
async function openSecretHistory(application: Application) {
	secretHistoryApplication.value = application
	secretHistory.value = []
	secretHistoryOpen.value = true
	await loadSecretHistory()
}
async function copySecretVersion(version: ApplicationSecret) {
	if (!version.clientSecret) {
		ElMessage.warning('该版本仅保留哈希，无法恢复明文')
		return
	}
	try {
		await copyText(version.clientSecret)
		ElMessage.success(`v${version.version} 密钥已复制`)
	} catch { ElMessage.error('复制失败，请检查浏览器剪贴板权限') }
}
async function revokeSecretVersion(version: ApplicationSecret) {
	if (!secretHistoryApplication.value) return
	try {
		await ElMessageBox.confirm(`确定立即撤销 v${version.version} 吗？使用该密钥的请求将无法继续鉴权。`, '撤销历史密钥', { type: 'warning', confirmButtonText: '撤销', cancelButtonText: '取消' })
		await applicationApi.revokeSecret(secretHistoryApplication.value.id, version.id)
		ElMessage.success(`v${version.version} 已撤销`)
		await loadSecretHistory()
	} catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error)) }
}
function secretStatus(version: ApplicationSecret) {
	if (version.current) return { label: '当前', type: 'success' as const }
	if (version.status === 'active') return { label: '过渡中', type: 'warning' as const }
	if (version.status === 'expired') return { label: '已过期', type: 'info' as const }
	return { label: '已撤销', type: 'danger' as const }
}
function formatSecretTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-' }
async function remove(application: Application) {
  try {
    await ElMessageBox.confirm(`确定删除应用“${application.name}”吗？删除前需先清空所属权限。`, '删除应用', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await applicationApi.remove(application.id)
    ElMessage.success('应用已删除')
    await load()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error)) }
}
function mergeAdministratorOptions(incoming: PermissionPrincipalGrant[]) {
  const users = new Map(administratorOptions.value.filter((user) => administratorIds.value.includes(user.id)).map((user) => [user.id, user]))
  incoming.forEach((user) => users.set(user.id, user))
  administratorOptions.value = [...users.values()]
}
async function searchAdministratorCandidates(keyword: string) {
  if (!administratorApplication.value) return
  administratorSearching.value = true
  try {
    const result = await applicationApi.systemAdministratorCandidates(administratorApplication.value.id, keyword)
    mergeAdministratorOptions(result.items)
  } catch (error) { ElMessage.error(apiMessage(error, '管理员候选用户加载失败')) }
  finally { administratorSearching.value = false }
}
async function openAdministrators(application: Application) {
  administratorApplication.value = application
  administratorOptions.value = []
  administratorIds.value = []
  administratorOpen.value = true
  administratorLoading.value = true
  try {
    const result = await applicationApi.systemAdministrators(application.id)
    administratorIds.value = [...result.userIds]
    administratorOptions.value = result.users
    await searchAdministratorCandidates('')
  } catch (error) { ElMessage.error(apiMessage(error, '系统管理员加载失败')) }
  finally { administratorLoading.value = false }
}
async function saveAdministrators() {
  if (!administratorApplication.value) return
  if (!administratorIds.value.length) {
    ElMessage.warning('应用至少需要一名系统管理员')
    return
  }
  administratorSaving.value = true
  try {
		await applicationApi.updateSystemAdministrators(administratorApplication.value.id, {
		  userIds: administratorIds.value,
		  groupIds: [],
    })
    ElMessage.success('系统管理员已更新')
    administratorOpen.value = false
    await load()
  } catch (error) { ElMessage.error(apiMessage(error, '系统管理员保存失败')) }
  finally { administratorSaving.value = false }
}
function administratorAvatarUrl(principal: PermissionPrincipalGrant) {
  const identity = { id: principal.id, avatarUpdatedAt: principal.avatarUpdatedAt }
  return avatarUrl(identity)
}
onMounted(load)
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><h2>接入应用</h2><p>登记使用统一认证与授权能力的业务系统</p></div>
      <el-button v-if="auth.can('application:create')" type="primary" :icon="Plus" @click="openCreate">新建应用</el-button>
    </section>
    <section class="data-section">
      <div class="table-toolbar"><span class="table-summary">共 {{ applications.length }} 个应用</span><el-tooltip content="刷新列表"><el-button :icon="Refresh" circle aria-label="刷新列表" @click="load" /></el-tooltip></div>
      <el-table v-loading="loading" :data="applications" empty-text="暂无接入应用" class="data-table">
        <el-table-column prop="name" label="应用名称" min-width="150"><template #default="scope"><span class="strong-cell">{{ scope.row.name }}</span><el-tag v-if="scope.row.builtIn" type="info" effect="plain" size="small">内置</el-tag></template></el-table-column>
        <el-table-column prop="code" label="应用编码" min-width="170"><template #default="scope"><code>{{ scope.row.code }}</code></template></el-table-column>
        <el-table-column prop="description" label="说明" min-width="220"><template #default="scope">{{ scope.row.description || '-' }}</template></el-table-column>
        <el-table-column prop="clientId" label="客户端 ID" min-width="190"><template #default="scope"><code>{{ scope.row.clientId }}</code></template></el-table-column>
        <el-table-column label="客户端密钥" width="150"><template #default="scope"><span class="masked-secret"><code>********</code><el-tooltip :content="scope.row.clientSecret ? '复制客户端密钥' : '历史密钥不可恢复，请先轮换'"><el-button text circle :icon="CopyDocument" aria-label="复制客户端密钥" @click="copyApplicationSecret(scope.row)" /></el-tooltip></span></template></el-table-column>
        <el-table-column label="官网地址" min-width="190"><template #default="scope"><el-link v-if="scope.row.homepageUrl" :href="scope.row.homepageUrl" target="_blank" :icon="Link">访问</el-link><span v-else>-</span></template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="scope"><el-tag :type="scope.row.status === 'enabled' ? 'success' : 'info'" effect="plain">{{ scope.row.status === 'enabled' ? '启用' : '禁用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="224" fixed="right"><template #default="scope"><el-tooltip v-if="auth.can('application:update')" content="系统管理员"><el-button text circle :icon="UserFilled" aria-label="设置系统管理员" @click="openAdministrators(scope.row)" /></el-tooltip><el-tooltip v-if="auth.can('application:list')" content="密钥历史"><el-button text circle :icon="Clock" aria-label="查看密钥历史" @click="openSecretHistory(scope.row)" /></el-tooltip><el-tooltip v-if="auth.can('application:rotate-secret')" content="轮换密钥"><el-button text circle :icon="Key" aria-label="轮换密钥" @click="openRotateSecret(scope.row)" /></el-tooltip><el-tooltip v-if="auth.can('application:update')" content="编辑"><el-button text circle :icon="Edit" aria-label="编辑应用" :disabled="scope.row.builtIn" @click="openEdit(scope.row)" /></el-tooltip><el-tooltip v-if="auth.can('application:delete')" content="删除"><el-button text circle type="danger" :icon="Delete" aria-label="删除应用" :disabled="scope.row.builtIn" @click="remove(scope.row)" /></el-tooltip></template></el-table-column>
      </el-table>
    </section>
    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑应用' : '新建应用'" width="min(560px, 92vw)" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid"><el-form-item label="应用名称" prop="name"><el-input v-model="form.name" /></el-form-item><el-form-item label="应用编码" prop="code"><el-input v-model="form.code" placeholder="例如 official_website" /></el-form-item></div>
        <el-form-item label="官网地址" prop="homepageUrl"><el-input v-model="form.homepageUrl" placeholder="https://example.com" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio-button value="enabled">启用</el-radio-button><el-radio-button value="disabled">禁用</el-radio-button></el-radio-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
	<el-dialog v-model="rotateOpen" :title="`${rotateApplication?.name || ''} / 轮换密钥`" width="min(520px, 92vw)" destroy-on-close>
	  <el-form label-position="top">
		<el-form-item label="旧密钥过渡期">
		  <el-select v-model="gracePeriodHours" class="full-width">
			<el-option label="立即失效" :value="0" />
			<el-option label="保留 1 小时" :value="1" />
			<el-option label="保留 24 小时" :value="24" />
			<el-option label="保留 7 天" :value="168" />
		  </el-select>
		</el-form-item>
	  </el-form>
	  <template #footer><el-button @click="rotateOpen = false">取消</el-button><el-button type="primary" :icon="Key" :loading="rotating" @click="rotateSecret">确认轮换</el-button></template>
	</el-dialog>
	<el-dialog v-model="secretHistoryOpen" :title="`${secretHistoryApplication?.name || ''} / 密钥历史`" width="min(900px, 96vw)">
	  <el-table v-loading="secretHistoryLoading" :data="secretHistory" empty-text="暂无密钥版本">
		<el-table-column label="版本" width="84"><template #default="scope"><code>v{{ scope.row.version }}</code></template></el-table-column>
		<el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="secretStatus(scope.row).type" effect="plain">{{ secretStatus(scope.row).label }}</el-tag></template></el-table-column>
		<el-table-column label="客户端密钥" min-width="150"><template #default="scope"><span class="masked-secret"><code>********</code><el-tooltip :content="scope.row.clientSecret ? `复制 v${scope.row.version} 密钥` : '该版本不可恢复'"><el-button text circle :icon="CopyDocument" :disabled="!scope.row.clientSecret" :aria-label="`复制 v${scope.row.version} 密钥`" @click="copySecretVersion(scope.row)" /></el-tooltip></span></template></el-table-column>
		<el-table-column label="有效至" min-width="180"><template #default="scope">{{ scope.row.current ? '持续有效' : formatSecretTime(scope.row.expiresAt || scope.row.revokedAt) }}</template></el-table-column>
		<el-table-column label="创建人" min-width="120"><template #default="scope">{{ scope.row.createdByName || 'system' }}</template></el-table-column>
		<el-table-column label="创建时间" min-width="180"><template #default="scope">{{ formatSecretTime(scope.row.createdAt) }}</template></el-table-column>
		<el-table-column label="操作" width="72" fixed="right"><template #default="scope"><el-tooltip v-if="!scope.row.current && scope.row.status === 'active'" content="立即撤销"><el-button text circle type="danger" :icon="Delete" :aria-label="`撤销 v${scope.row.version}`" @click="revokeSecretVersion(scope.row)" /></el-tooltip></template></el-table-column>
	  </el-table>
	  <template #footer><el-button type="primary" @click="secretHistoryOpen = false">关闭</el-button></template>
	</el-dialog>
    <el-dialog v-model="credentialOpen" title="应用凭证" width="min(560px, 92vw)" :close-on-click-modal="false" @closed="clearCredential">
      <el-alert title="客户端密钥不会明文显示，请复制到应用后端的安全配置中。禁止写入浏览器前端代码。" type="warning" show-icon :closable="false" />
      <el-form label-position="top" class="credential-form"><el-form-item label="客户端 ID"><el-input :model-value="credential.clientId" readonly /></el-form-item><el-form-item label="客户端密钥"><el-input model-value="****************" readonly><template #append><el-tooltip content="复制客户端密钥"><el-button :icon="CopyDocument" aria-label="复制客户端密钥" @click="copyCredentialSecret" /></el-tooltip></template></el-input></el-form-item></el-form>
      <template #footer><el-button type="primary" @click="credentialOpen = false">我已保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="administratorOpen" :title="`${administratorApplication?.name || ''} / 系统管理员`" width="min(620px, 94vw)" destroy-on-close>
      <div v-loading="administratorLoading" class="application-administrator-editor">
        <el-form label-position="top">
          <el-form-item label="系统管理员">
            <el-select v-model="administratorIds" multiple filterable remote reserve-keyword :remote-method="searchAdministratorCandidates" :loading="administratorSearching" class="full-width" placeholder="输入 People 用户名、姓名、邮箱或电话搜索">
              <el-option v-for="user in administratorOptions" :key="user.id" class="identity-select-option" :label="`${user.displayName || user.identifier} (${user.identifier})`" :value="user.id">
                <div class="select-user-option"><IdentityAvatar :name="user.displayName" :identifier="user.identifier" :src="administratorAvatarUrl(user)" :size="28" :email="user.email" :phone="user.phone" :status="user.status" /><span><strong>{{ user.displayName || user.identifier }}</strong><small>{{ user.identifier }}</small></span></div>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>
        <div class="associated-principal-list">
          <el-empty v-if="!selectedAdministrators.length" description="至少选择一名系统管理员" :image-size="56" />
          <template v-else><div v-for="user in selectedAdministrators" :key="user.id" class="associated-principal">
              <IdentityAvatar :name="user.displayName" :identifier="user.identifier" :src="administratorAvatarUrl(user)" :size="34" :email="user.email" :phone="user.phone" :status="user.status" />
              <span><strong>{{ user.displayName || user.identifier }}</strong><small>{{ user.identifier }}</small></span>
              <el-tag :type="user.status === 'enabled' ? 'success' : 'info'" effect="plain" size="small">{{ user.status === 'enabled' ? '启用' : '禁用' }}</el-tag>
          </div></template>
        </div>
      </div>
      <template #footer><el-button @click="administratorOpen = false">取消</el-button><el-button type="primary" :loading="administratorSaving" :disabled="!administratorIds.length" @click="saveAdministrators">保存</el-button></template>
    </el-dialog>
  </div>
</template>
