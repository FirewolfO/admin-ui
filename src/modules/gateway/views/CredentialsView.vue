<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CopyDocument, Delete, EditPen, Key, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { credentialsApi, servicesApi } from '@gateway/api'
import { apiMessage } from '@gateway/api/client'
import StatusTag from '@gateway/components/StatusTag.vue'
import type { CredentialInput, ResourceStatus, ServiceCredential, UpstreamService } from '@gateway/types'

interface CredentialForm {
	serviceId: number
	name: string
	description: string
	status: ResourceStatus
	expiresAt: Date | null
}

const currentRoute = useRoute()
const loading = ref(false)
const saving = ref(false)
const items = ref<ServiceCredential[]>([])
const services = ref<UpstreamService[]>([])
const total = ref(0)
const query = reactive<{ q: string; status: ResourceStatus | ''; serviceId?: number; page: number; pageSize: number }>({ q: '', status: '', page: 1, pageSize: 20 })
const dialogVisible = ref(false)
const secretDialogVisible = ref(false)
const editingID = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<CredentialForm>(emptyForm())
const generated = reactive({ accessKey: '', secretKey: '', serviceName: '' })

const rules: FormRules<CredentialForm> = {
	serviceId: [{ required: true, message: '请选择所属服务', trigger: 'change' }],
	name: [{ required: true, message: '请输入凭据名称', trigger: 'blur' }],
}

function emptyForm(): CredentialForm {
	return { serviceId: 0, name: '', description: '', status: 'enabled', expiresAt: null }
}

async function loadServices() {
	try {
		const result = await servicesApi.list({ audience: 'inner', page: 1, pageSize: 100 })
		services.value = result.items
	} catch (error) {
		ElMessage.error(apiMessage(error, '服务选项加载失败'))
	}
}

async function load() {
	loading.value = true
	try {
		const result = await credentialsApi.list({ ...query, audience: 'inner' })
		items.value = result.items
		total.value = result.total
	} catch (error) {
		ElMessage.error(apiMessage(error, '凭据列表加载失败'))
	} finally {
		loading.value = false
	}
}

function search() {
	query.page = 1
	void load()
}

function resetFilters() {
	Object.assign(query, { q: '', status: '', serviceId: undefined, page: 1 })
	void load()
}

function openCreate() {
	editingID.value = null
	Object.assign(form, emptyForm(), { serviceId: query.serviceId || 0 })
	dialogVisible.value = true
}

function openEdit(item: ServiceCredential) {
	editingID.value = item.id
	Object.assign(form, {
		serviceId: item.serviceId,
		name: item.name,
		description: item.description,
		status: item.status,
		expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
	})
	dialogVisible.value = true
}

async function submit() {
	if (!await formRef.value?.validate()) return
	saving.value = true
	try {
		const expiresAt = form.expiresAt ? form.expiresAt.toISOString() : null
		if (editingID.value) {
			await credentialsApi.update(editingID.value, {
				name: form.name,
				description: form.description,
				status: form.status,
				expiresAt,
			})
			ElMessage.success('凭据已更新')
		} else {
			const input: CredentialInput = {
				serviceId: form.serviceId,
				name: form.name,
				description: form.description,
				status: form.status,
				expiresAt,
			}
			const result = await credentialsApi.create(input)
			Object.assign(generated, {
				accessKey: result.credential.accessKey,
				secretKey: result.secretKey,
				serviceName: result.credential.serviceName,
			})
			secretDialogVisible.value = true
		}
		dialogVisible.value = false
		await load()
	} catch (error) {
		ElMessage.error(apiMessage(error, '凭据保存失败'))
	} finally {
		saving.value = false
	}
}

async function remove(item: ServiceCredential) {
	try {
		await ElMessageBox.confirm(`确定删除凭据“${item.name}”吗？删除后使用该 AK 的调用将无法通过验签。`, '删除凭据', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
		await credentialsApi.remove(item.id)
		ElMessage.success('凭据已删除')
		if (items.value.length === 1 && query.page > 1) query.page -= 1
		await load()
	} catch (error) {
		if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error, '凭据删除失败'))
	}
}

async function copyText(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value)
		ElMessage.success(`${label} 已复制`)
	} catch {
		ElMessage.error(`${label} 复制失败`)
	}
}

function closeSecretDialog() {
	secretDialogVisible.value = false
	Object.assign(generated, { accessKey: '', secretKey: '', serviceName: '' })
}

function expiryText(value: string | null) {
	if (!value) return '永不过期'
	return new Date(value).toLocaleString()
}

watch(() => currentRoute.query.serviceId, async (value) => {
	query.serviceId = value ? Number(value) : undefined
	query.page = 1
	await nextTick()
	await load()
})

onMounted(async () => {
	query.serviceId = currentRoute.query.serviceId ? Number(currentRoute.query.serviceId) : undefined
	await Promise.all([loadServices(), load()])
})
</script>

<template>
	<section class="management-page">
		<div class="toolbar">
			<div class="filters credential-filters">
				<el-input v-model="query.q" clearable placeholder="搜索名称或 AK" :prefix-icon="Search" @keyup.enter="search" @clear="search" />
				<el-select v-model="query.serviceId" placeholder="全部服务" clearable filterable @change="search">
					<el-option v-for="service in services" :key="service.id" :label="service.name" :value="service.id" />
				</el-select>
				<el-select v-model="query.status" placeholder="全部状态" clearable @change="search">
					<el-option label="已启用" value="enabled" />
					<el-option label="已停用" value="disabled" />
				</el-select>
				<el-tooltip content="刷新列表"><el-button :icon="Refresh" aria-label="刷新列表" @click="resetFilters" /></el-tooltip>
			</div>
			<el-button type="primary" :icon="Plus" :disabled="services.length === 0" @click="openCreate">生成 AK/SK</el-button>
		</div>

		<div class="table-panel">
			<el-table v-loading="loading" :data="items" empty-text="暂无调用凭据" table-layout="fixed">
				<el-table-column label="凭据" min-width="180"><template #default="{ row }"><div class="primary-cell"><strong>{{ row.name }}</strong><small>{{ row.serviceName }}</small></div></template></el-table-column>
				<el-table-column label="Access Key" min-width="270">
					<template #default="{ row }"><div class="credential-value"><code>{{ row.accessKey }}</code><el-tooltip content="复制 AK"><el-button text :icon="CopyDocument" aria-label="复制 AK" @click="copyText(row.accessKey, 'AK')" /></el-tooltip></div></template>
				</el-table-column>
				<el-table-column label="状态" width="100"><template #default="{ row }"><StatusTag :status="row.status" /></template></el-table-column>
				<el-table-column label="过期时间" width="180"><template #default="{ row }">{{ expiryText(row.expiresAt) }}</template></el-table-column>
				<el-table-column label="更新时间" width="170"><template #default="{ row }">{{ new Date(row.updatedAt).toLocaleString() }}</template></el-table-column>
				<el-table-column label="操作" width="100" fixed="right">
					<template #default="{ row }"><div class="row-actions"><el-tooltip content="编辑凭据"><el-button text :icon="EditPen" aria-label="编辑凭据" @click="openEdit(row)" /></el-tooltip><el-tooltip content="删除凭据"><el-button text type="danger" :icon="Delete" aria-label="删除凭据" @click="remove(row)" /></el-tooltip></div></template>
				</el-table-column>
			</el-table>
			<div class="pagination-row">
				<span>共 {{ total }} 项</span>
				<el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" layout="prev, pager, next" :total="total" @current-change="load" />
			</div>
		</div>

		<el-dialog v-model="dialogVisible" :title="editingID ? '编辑凭据' : '生成 AK/SK'" width="min(620px, 92vw)" destroy-on-close @closed="formRef?.clearValidate()">
			<el-form ref="formRef" :model="form" :rules="rules" label-position="top">
				<el-form-item label="所属服务" prop="serviceId"><el-select v-model="form.serviceId" filterable :disabled="Boolean(editingID)"><el-option v-for="service in services" :key="service.id" :label="`${service.name} (${service.code})`" :value="service.id" /></el-select></el-form-item>
				<div class="form-grid">
					<el-form-item label="凭据名称" prop="name"><el-input v-model="form.name" maxlength="100" placeholder="生产环境调用凭据" /></el-form-item>
					<el-form-item label="过期时间"><el-date-picker v-model="form.expiresAt" type="datetime" placeholder="永不过期" :disabled-date="(date: Date) => date.getTime() < Date.now() - 86400000" /></el-form-item>
				</div>
				<el-form-item label="凭据状态"><el-switch v-model="form.status" active-value="enabled" inactive-value="disabled" active-text="启用" inactive-text="停用" /></el-form-item>
				<el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="1000" show-word-limit /></el-form-item>
			</el-form>
			<template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="submit">{{ editingID ? '保存' : '生成' }}</el-button></template>
		</el-dialog>

		<el-dialog :model-value="secretDialogVisible" title="AK/SK 已生成" width="min(680px, 94vw)" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
			<el-alert title="SK 仅在本次生成后展示，关闭后无法再次查看。" type="warning" :closable="false" show-icon />
			<div class="generated-credential">
				<div><span>调用方服务</span><strong>{{ generated.serviceName }}</strong></div>
				<div><span>Access Key</span><code>{{ generated.accessKey }}</code><el-tooltip content="复制 AK"><el-button :icon="CopyDocument" aria-label="复制 AK" @click="copyText(generated.accessKey, 'AK')" /></el-tooltip></div>
				<div><span>Secret Key</span><code>{{ generated.secretKey }}</code><el-tooltip content="复制 SK"><el-button :icon="CopyDocument" aria-label="复制 SK" @click="copyText(generated.secretKey, 'SK')" /></el-tooltip></div>
			</div>
			<template #footer><el-button type="primary" :icon="Key" @click="closeSecretDialog">我已妥善保存</el-button></template>
		</el-dialog>
	</section>
</template>
