<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Delete, EditPen, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { routesApi, servicesApi } from '@gateway/api'
import { apiMessage } from '@gateway/api/client'
import StatusTag from '@gateway/components/StatusTag.vue'
import { useAudience } from '@gateway/composables/useAudience'
import type { GatewayRoute, HttpMethod, ResourceStatus, RouteInput, UpstreamService } from '@gateway/types'

const currentRoute = useRoute()
const router = useRouter()
const { audience } = useAudience()
const loading = ref(false)
const saving = ref(false)
const items = ref<GatewayRoute[]>([])
const services = ref<UpstreamService[]>([])
const total = ref(0)
const query = reactive<{ q: string; status: ResourceStatus | ''; serviceId?: number; page: number; pageSize: number }>({ q: '', status: '', page: 1, pageSize: 20 })
const dialogVisible = ref(false)
const editingID = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<RouteInput>(emptyForm())
const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
const selectedServiceCode = computed(() => services.value.find((service) => service.id === form.serviceId)?.code || '{service}')

const rules: FormRules<RouteInput> = {
  serviceId: [{ required: true, message: '请选择所属服务', trigger: 'change' }],
  name: [{ required: true, message: '请输入路由名称', trigger: 'blur' }],
  path: [
    { required: true, message: '请输入匹配路径', trigger: 'blur' },
    { pattern: /^\/[^\s?#]*$/, message: '路径必须以 / 开头且不含空格、? 或 #', trigger: 'blur' },
  ],
  upstreamPath: [
    { required: true, message: '请输入上游路径', trigger: 'blur' },
    { pattern: /^\/[^\s?#]*$/, message: '路径必须以 / 开头且不含空格、? 或 #', trigger: 'blur' },
  ],
  methods: [{ type: 'array', min: 1, required: true, message: '请至少选择一个 HTTP 方法', trigger: 'change' }],
  authorizedServiceIds: [{
    validator: (_rule, value: number[], callback) => {
      if (form.audience === 'inner' && value.length === 0) callback(new Error('请至少授权一个调用方服务'))
      else callback()
    },
    trigger: 'change',
  }],
}

function emptyForm(): RouteInput {
  return { serviceId: 0, name: '', path: '/', upstreamPath: '/', methods: ['GET'], audience: audience.value, programmingAccessEnabled: false, forwardBrowserCredentials: false, anonymousAccessEnabled: false, authorizedServiceIds: [], status: 'enabled', priority: 100, timeoutMs: 10000, description: '' }
}

async function loadServices() {
  try {
    const result = await servicesApi.list({ audience: audience.value, page: 1, pageSize: 100 })
    services.value = result.items
  } catch (error) {
    ElMessage.error(apiMessage(error, '服务选项加载失败'))
  }
}

async function load() {
  loading.value = true
  try {
    const result = await routesApi.list({ ...query, audience: audience.value })
    items.value = result.items
    total.value = result.total
  } catch (error) {
    ElMessage.error(apiMessage(error, '路由列表加载失败'))
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

function openEdit(item: GatewayRoute) {
  editingID.value = item.id
  Object.assign(form, {
    serviceId: item.serviceId,
    name: item.name,
    path: item.path,
    upstreamPath: item.upstreamPath,
    methods: [...item.methods],
    audience: item.audience,
    programmingAccessEnabled: item.programmingAccessEnabled,
    forwardBrowserCredentials: item.forwardBrowserCredentials,
    anonymousAccessEnabled: item.anonymousAccessEnabled,
    authorizedServiceIds: [...item.authorizedServiceIds],
    status: item.status,
    priority: item.priority,
    timeoutMs: item.timeoutMs,
    description: item.description,
  })
  dialogVisible.value = true
}

async function submit() {
  if (!await formRef.value?.validate()) return
  saving.value = true
  try {
    const input: RouteInput = { ...form, methods: [...form.methods] }
    if (editingID.value) await routesApi.update(editingID.value, input)
    else await routesApi.create(input)
    ElMessage.success(editingID.value ? '路由已更新' : '路由已创建')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(apiMessage(error, '路由保存失败'))
  } finally {
    saving.value = false
  }
}

async function remove(item: GatewayRoute) {
  try {
    await ElMessageBox.confirm(`确定删除路由“${item.name}”吗？`, '删除路由', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await routesApi.remove(item.id)
    ElMessage.success('路由已删除')
    if (items.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error, '路由删除失败'))
  }
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

watch(audience, () => {
  Object.assign(query, { q: '', status: '', serviceId: undefined, page: 1 })
  dialogVisible.value = false
  if (currentRoute.query.serviceId) void router.replace({ name: 'gateway-routes' })
  void Promise.all([loadServices(), load()])
})
</script>

<template>
  <section class="management-page">
    <div class="toolbar">
      <div class="filters route-filters">
        <el-input v-model="query.q" clearable placeholder="搜索名称或路径" :prefix-icon="Search" @keyup.enter="search" @clear="search" />
        <el-select v-model="query.serviceId" placeholder="全部服务" clearable filterable @change="search">
          <el-option v-for="service in services" :key="service.id" :label="service.name" :value="service.id" />
        </el-select>
        <el-select v-model="query.status" placeholder="全部状态" clearable @change="search">
          <el-option label="已启用" value="enabled" />
          <el-option label="已停用" value="disabled" />
        </el-select>
        <el-tooltip content="刷新列表"><el-button :icon="Refresh" aria-label="刷新列表" @click="resetFilters" /></el-tooltip>
      </div>
      <el-button type="primary" :icon="Plus" :disabled="services.length === 0" @click="openCreate">新增路由</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="items" empty-text="暂无路由配置" table-layout="fixed">
        <el-table-column label="路由" min-width="160"><template #default="{ row }"><div class="primary-cell"><strong>{{ row.name }}</strong><small>{{ row.serviceName }}</small></div></template></el-table-column>
        <el-table-column v-if="audience === 'open'" label="编程访问" width="110"><template #default="{ row }"><el-tag :type="row.programmingAccessEnabled ? 'success' : 'info'" size="small" effect="plain">{{ row.programmingAccessEnabled ? '已开启' : '未开启' }}</el-tag></template></el-table-column>
        <el-table-column v-else label="授权服务" width="100"><template #default="{ row }">{{ row.authorizedServiceIds.length }}</template></el-table-column>
        <el-table-column label="方法" width="160"><template #default="{ row }"><div class="method-list"><el-tag v-for="method in row.methods" :key="method" size="small" effect="plain">{{ method }}</el-tag></div></template></el-table-column>
        <el-table-column label="访问路径" min-width="300"><template #default="{ row }"><code>/api/{{ row.audience }}/{{ row.serviceCode }}{{ row.path }}</code></template></el-table-column>
        <el-table-column label="上游路径" min-width="200"><template #default="{ row }"><code>{{ row.upstreamPath }}</code></template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><StatusTag :status="row.status" /></template></el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="超时" width="110"><template #default="{ row }">{{ row.timeoutMs }} ms</template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }"><div class="row-actions"><el-tooltip content="编辑路由"><el-button text :icon="EditPen" aria-label="编辑路由" @click="openEdit(row)" /></el-tooltip><el-tooltip content="删除路由"><el-button text type="danger" :icon="Delete" aria-label="删除路由" @click="remove(row)" /></el-tooltip></div></template>
        </el-table-column>
      </el-table>
      <div class="pagination-row"><span>共 {{ total }} 项</span><el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" layout="prev, pager, next" :total="total" @current-change="load" /></div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingID ? '编辑路由' : '新增路由'" width="min(700px, 94vw)" destroy-on-close @closed="formRef?.clearValidate()">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item label="所属服务" prop="serviceId"><el-select v-model="form.serviceId" filterable placeholder="请选择服务"><el-option v-for="service in services" :key="service.id" :label="`${service.name} (${service.code})`" :value="service.id" /></el-select></el-form-item>
          <el-form-item label="路由名称" prop="name"><el-input v-model="form.name" maxlength="100" /></el-form-item>
        </div>
        <el-form-item v-if="audience === 'inner'" label="授权调用方服务" prop="authorizedServiceIds">
          <el-select v-model="form.authorizedServiceIds" multiple filterable collapse-tags :max-collapse-tags="3" placeholder="选择允许调用该接口的服务">
            <el-option v-for="service in services" :key="service.id" :label="`${service.name} (${service.code})`" :value="service.id" />
          </el-select>
        </el-form-item>
        <div v-else class="form-grid">
          <el-form-item label="开启编程访问">
            <el-switch v-model="form.programmingAccessEnabled" :disabled="form.anonymousAccessEnabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="转发浏览器凭据">
            <el-switch v-model="form.forwardBrowserCredentials" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="匿名 Open 访问">
            <el-switch v-model="form.anonymousAccessEnabled" :disabled="form.programmingAccessEnabled" active-text="开启" inactive-text="关闭" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="服务内匹配路径" prop="path"><el-input v-model="form.path" placeholder="/orders/:id"><template #prepend>/api/{{ form.audience }}/{{ selectedServiceCode }}</template></el-input></el-form-item>
          <el-form-item label="上游路径" prop="upstreamPath"><el-input v-model="form.upstreamPath" placeholder="/orders/:id" /></el-form-item>
        </div>
        <el-form-item label="HTTP 方法" prop="methods"><el-checkbox-group v-model="form.methods" class="method-options"><el-checkbox-button v-for="method in methods" :key="method" :value="method">{{ method }}</el-checkbox-button></el-checkbox-group></el-form-item>
        <div class="form-grid form-grid-three">
          <el-form-item label="优先级"><el-input-number v-model="form.priority" :min="0" :max="10000" controls-position="right" /></el-form-item>
          <el-form-item label="请求超时"><el-input-number v-model="form.timeoutMs" :min="100" :max="120000" :step="500" controls-position="right" /><span class="field-unit">毫秒</span></el-form-item>
          <el-form-item label="路由状态"><el-switch v-model="form.status" active-value="enabled" inactive-value="disabled" active-text="启用" inactive-text="停用" /></el-form-item>
        </div>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" maxlength="1000" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="submit">保存</el-button></template>
    </el-dialog>
  </section>
</template>
