<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Key, Link, Operation, Refresh, User, UserFilled } from '@element-plus/icons-vue'
import { dashboardApi } from '@permission/api'
import { apiMessage } from '@/api/client'
import { useApplicationStore } from '@permission/stores/application'
import type { DashboardData } from '@permission/types'

const loading = ref(false)
const applicationStore = useApplicationStore()
const data = ref<DashboardData>({ users: 0, enabledUsers: 0, roles: 0, permissions: 0, applications: 0, recentAuditLogs: [] })

const metrics = [
  { key: 'users' as const, label: 'People 用户', icon: User, tone: 'green' },
  { key: 'enabledUsers' as const, label: '启用用户', icon: UserFilled, tone: 'teal' },
  { key: 'roles' as const, label: '角色数量', icon: Operation, tone: 'amber' },
  { key: 'permissions' as const, label: '权限数量', icon: Key, tone: 'coral' },
  { key: 'applications' as const, label: '接入应用', icon: Link, tone: 'violet' },
]

async function load() {
  loading.value = true
  try {
		data.value = await dashboardApi.get(applicationStore.currentApplicationId)
  } catch (error) {
    ElMessage.error(apiMessage(error))
  } finally {
    loading.value = false
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

onMounted(async () => {
	try { await applicationStore.hydrate() } catch (error) { ElMessage.error(apiMessage(error)) }
	await load()
})
watch(() => applicationStore.currentApplicationId, load)
</script>

<template>
  <div v-loading="loading" class="page-stack">
    <section class="page-heading">
		<div><h2>运行概览</h2><p>{{ applicationStore.currentApplication?.name || '当前应用' }}的授权状态</p></div>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </section>
    <section class="metric-grid">
      <article v-for="metric in metrics" :key="metric.key" class="metric-card">
        <span class="metric-icon" :class="`tone-${metric.tone}`"><el-icon><component :is="metric.icon" /></el-icon></span>
        <div><strong>{{ data[metric.key] }}</strong><span>{{ metric.label }}</span></div>
      </article>
    </section>
    <section class="data-section">
      <div class="section-heading"><div><h3>最近操作</h3><p>最新的安全与管理活动</p></div></div>
      <el-table :data="data.recentAuditLogs" empty-text="暂无操作记录">
        <el-table-column prop="actorName" label="操作人" min-width="120" />
        <el-table-column prop="action" label="动作" min-width="180" />
        <el-table-column prop="resource" label="资源" min-width="110" />
        <el-table-column prop="ipAddress" label="IP 地址" min-width="140" />
        <el-table-column label="结果" width="90">
          <template #default="scope"><el-tag :type="scope.row.success ? 'success' : 'danger'" effect="plain">{{ scope.row.success ? '成功' : '失败' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="时间" min-width="180"><template #default="scope">{{ formatTime(scope.row.createdAt) }}</template></el-table-column>
      </el-table>
    </section>
  </div>
</template>
