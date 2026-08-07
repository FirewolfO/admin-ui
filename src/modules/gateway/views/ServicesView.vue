<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, EditPen, Key, Plus, Refresh, Search, SetUp } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { servicesApi } from '@gateway/api'
import { apiMessage } from '@gateway/api/client'
import StatusTag from '@gateway/components/StatusTag.vue'
import { useAudience } from '@gateway/composables/useAudience'
import type { ResourceStatus, ServiceInput, UpstreamService } from '@gateway/types'

const router = useRouter()
const { audience } = useAudience()
const loading = ref(false)
const saving = ref(false)
const items = ref<UpstreamService[]>([])
const total = ref(0)
const query = reactive<{ q: string; status: ResourceStatus | ''; page: number; pageSize: number }>({ q: '', status: '', page: 1, pageSize: 20 })
const dialogVisible = ref(false)
const editingID = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<ServiceInput>(emptyForm())

const rules: FormRules<ServiceInput> = {
  code: [
    { required: true, message: '请输入服务编码', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_-]{1,63}$/, message: '使用 2-64 位小写字母、数字、_ 或 -', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  baseUrl: [
    { required: true, message: '请输入上游地址', trigger: 'blur' },
    { pattern: /^https?:\/\/[^\s?#]+$/i, message: '请输入有效的 HTTP(S) 地址', trigger: 'blur' },
  ],
  timeoutMs: [{ required: true, message: '请输入默认超时', trigger: 'change' }],
}

function emptyForm(): ServiceInput {
  return { code: '', audience: audience.value, name: '', baseUrl: '', description: '', status: 'enabled', timeoutMs: 10000 }
}

async function load() {
  loading.value = true
  try {
    const result = await servicesApi.list({ ...query, audience: audience.value })
    items.value = result.items
    total.value = result.total
  } catch (error) {
    ElMessage.error(apiMessage(error, '服务列表加载失败'))
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

function resetFilters() {
  Object.assign(query, { q: '', status: '', page: 1 })
  void load()
}

function openCreate() {
  editingID.value = null
  Object.assign(form, emptyForm())
  dialogVisible.value = true
}

function openEdit(item: UpstreamService) {
  editingID.value = item.id
  Object.assign(form, {
    code: item.code,
    audience: item.audience,
    name: item.name,
    baseUrl: item.baseUrl,
    description: item.description,
    status: item.status,
    timeoutMs: item.timeoutMs,
  })
  dialogVisible.value = true
}

async function submit() {
  if (!await formRef.value?.validate()) return
  saving.value = true
  try {
    if (editingID.value) await servicesApi.update(editingID.value, { ...form })
    else await servicesApi.create({ ...form })
    ElMessage.success(editingID.value ? '服务已更新' : '服务已创建')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(apiMessage(error, '服务保存失败'))
  } finally {
    saving.value = false
  }
}

async function remove(item: UpstreamService) {
  try {
    await ElMessageBox.confirm(`确定删除服务“${item.name}”吗？`, '删除服务', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await servicesApi.remove(item.id)
    ElMessage.success('服务已删除')
    if (items.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error, '服务删除失败'))
  }
}

function manageRoutes(item: UpstreamService) {
  void router.push({ name: 'gateway-routes', query: { serviceId: String(item.id) } })
}

function manageCredentials(item: UpstreamService) {
  void router.push({ name: 'gateway-credentials', query: { serviceId: String(item.id) } })
}

onMounted(load)

watch(audience, () => {
  Object.assign(query, { q: '', status: '', page: 1 })
  dialogVisible.value = false
  void load()
})
</script>

<template>
  <section class="management-page">
    <div class="toolbar">
      <div class="filters">
        <el-input v-model="query.q" clearable placeholder="搜索名称、编码或地址" :prefix-icon="Search" @keyup.enter="search" @clear="search" />
        <el-select v-model="query.status" placeholder="全部状态" clearable @change="search">
          <el-option label="已启用" value="enabled" />
          <el-option label="已停用" value="disabled" />
        </el-select>
        <el-tooltip content="刷新列表"><el-button :icon="Refresh" aria-label="刷新列表" @click="resetFilters" /></el-tooltip>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增服务</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="items" empty-text="暂无服务配置" table-layout="fixed">
        <el-table-column label="服务" min-width="190">
          <template #default="{ row }"><div class="primary-cell"><strong>{{ row.name }}</strong><code>{{ row.code }}</code></div></template>
        </el-table-column>
        <el-table-column prop="baseUrl" label="上游地址" min-width="250" show-overflow-tooltip />
        <el-table-column label="状态" width="100"><template #default="{ row }"><StatusTag :status="row.status" /></template></el-table-column>
        <el-table-column label="路由" width="80"><template #default="{ row }">{{ row.routeCount }}</template></el-table-column>
        <el-table-column label="默认超时" width="120"><template #default="{ row }">{{ row.timeoutMs }} ms</template></el-table-column>
        <el-table-column label="更新时间" width="170"><template #default="{ row }">{{ new Date(row.updatedAt).toLocaleString() }}</template></el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-tooltip content="管理路由"><el-button text type="primary" :icon="SetUp" aria-label="管理路由" @click="manageRoutes(row)" /></el-tooltip>
              <el-tooltip v-if="audience === 'inner'" content="管理调用凭据"><el-button text type="primary" :icon="Key" aria-label="管理调用凭据" @click="manageCredentials(row)" /></el-tooltip>
              <el-tooltip content="编辑服务"><el-button text :icon="EditPen" aria-label="编辑服务" @click="openEdit(row)" /></el-tooltip>
              <el-tooltip content="删除服务"><el-button text type="danger" :icon="Delete" aria-label="删除服务" @click="remove(row)" /></el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <span>共 {{ total }} 项</span>
        <el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" layout="prev, pager, next" :total="total" @current-change="load" />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingID ? '编辑服务' : '新增服务'" width="min(640px, 92vw)" destroy-on-close @closed="formRef?.clearValidate()">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item label="服务名称" prop="name"><el-input v-model="form.name" maxlength="100" /></el-form-item>
          <el-form-item label="服务编码" prop="code"><el-input v-model="form.code" maxlength="64" placeholder="order-service" /></el-form-item>
        </div>
        <el-form-item label="上游地址" prop="baseUrl"><el-input v-model="form.baseUrl" placeholder="http://order-service:8080" /></el-form-item>
        <div class="form-grid">
          <el-form-item label="默认超时" prop="timeoutMs"><el-input-number v-model="form.timeoutMs" :min="100" :max="120000" :step="500" controls-position="right" /><span class="field-unit">毫秒</span></el-form-item>
          <el-form-item label="服务状态"><el-switch v-model="form.status" active-value="enabled" inactive-value="disabled" active-text="启用" inactive-text="停用" /></el-form-item>
        </div>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="1000" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="submit">保存</el-button></template>
    </el-dialog>
  </section>
</template>
