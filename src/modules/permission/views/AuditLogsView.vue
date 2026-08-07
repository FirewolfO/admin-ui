<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search, View } from '@element-plus/icons-vue'
import { auditApi } from '@permission/api'
import { apiMessage } from '@/api/client'
import { useApplicationStore } from '@permission/stores/application'
import type { AuditLog } from '@permission/types'

const applicationStore = useApplicationStore()

const loading = ref(false)
const logs = ref<AuditLog[]>([])
const total = ref(0)
const detailOpen = ref(false)
const selected = ref<AuditLog | null>(null)
const filters = reactive({ search: '', action: '', applicationId: 0 })
const pagination = reactive({ page: 1, pageSize: 20 })

const detailText = computed(() => {
  if (!selected.value?.detail) return '无附加信息'
  try { return JSON.stringify(JSON.parse(selected.value.detail), null, 2) } catch { return selected.value.detail }
})

async function load() {
  loading.value = true
  try {
    const result = await auditApi.list({ ...pagination, search: filters.search || undefined, action: filters.action || undefined, applicationId: filters.applicationId || undefined })
    logs.value = result.items
    total.value = result.total
  } catch (error) { ElMessage.error(apiMessage(error)) }
  finally { loading.value = false }
}
function search() { pagination.page = 1; load() }
function showDetail(log: AuditLog) { selected.value = log; detailOpen.value = true }
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
async function initialize() {
	try { await applicationStore.hydrate() } catch { /* load still reports API errors */ }
	filters.applicationId = applicationStore.currentApplicationId
	await load()
}
onMounted(initialize)
watch(() => applicationStore.currentApplicationId, (id) => { filters.applicationId = id; search() })
</script>

<template>
  <div class="page-stack">
	<section class="page-heading"><div><h2>审计日志</h2><p>{{ applicationStore.currentApplication?.name || '当前应用' }}的授权与管理操作</p></div></section>
    <section class="data-section">
      <div class="table-toolbar">
        <div class="filter-row">
          <el-input v-model="filters.search" clearable placeholder="搜索操作人、资源或资源 ID" :prefix-icon="Search" class="search-input" @keyup.enter="search" />
          <el-input v-model="filters.action" clearable placeholder="动作，例如 auth.login" class="action-input" @keyup.enter="search" />
          <el-button :icon="Search" @click="search">查询</el-button>
        </div>
        <el-tooltip content="刷新列表"><el-button :icon="Refresh" circle aria-label="刷新列表" @click="load" /></el-tooltip>
      </div>
      <el-table v-loading="loading" :data="logs" empty-text="暂无审计记录" class="data-table">
        <el-table-column prop="actorName" label="操作人" min-width="120"><template #default="scope">{{ scope.row.actorName || '匿名' }}</template></el-table-column>
        <el-table-column prop="action" label="动作" min-width="190"><template #default="scope"><code>{{ scope.row.action }}</code></template></el-table-column>
        <el-table-column prop="resource" label="资源" min-width="110" />
        <el-table-column prop="resourceId" label="资源 ID" min-width="100"><template #default="scope">{{ scope.row.resourceId || '-' }}</template></el-table-column>
        <el-table-column prop="ipAddress" label="IP 地址" min-width="140" />
        <el-table-column label="结果" width="90"><template #default="scope"><el-tag :type="scope.row.success ? 'success' : 'danger'" effect="plain">{{ scope.row.success ? '成功' : '失败' }}</el-tag></template></el-table-column>
        <el-table-column label="时间" min-width="180"><template #default="scope">{{ formatTime(scope.row.createdAt) }}</template></el-table-column>
        <el-table-column label="详情" width="72" fixed="right"><template #default="scope"><el-tooltip content="查看详情"><el-button text circle :icon="View" aria-label="查看详情" @click="showDetail(scope.row)" /></el-tooltip></template></el-table-column>
      </el-table>
      <div class="pagination-row"><el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="total" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @change="load" /></div>
    </section>
    <el-dialog v-model="detailOpen" title="审计详情" width="min(560px, 92vw)">
      <el-descriptions v-if="selected" :column="1" border>
        <el-descriptions-item label="请求结果">{{ selected.success ? '成功' : '失败' }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ selected.actorName || '匿名' }}</el-descriptions-item>
        <el-descriptions-item label="动作">{{ selected.action }}</el-descriptions-item>
        <el-descriptions-item label="资源">{{ selected.resource }} {{ selected.resourceId }}</el-descriptions-item>
        <el-descriptions-item label="IP 地址">{{ selected.ipAddress || '-' }}</el-descriptions-item>
        <el-descriptions-item label="时间">{{ formatTime(selected.createdAt) }}</el-descriptions-item>
      </el-descriptions>
      <pre class="audit-detail">{{ detailText }}</pre>
    </el-dialog>
  </div>
</template>
