<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChatLineRound, Connection, MagicStick, Tickets } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { workbenchApi, workbenchMessage } from '../api'
import type { Dashboard } from '../types'

const router = useRouter(); const loading = ref(true); const dashboard = ref<Dashboard | null>(null)
const metrics = [{ key: 'conversationCount' as const, label: '对话', icon: ChatLineRound, tone: 'tone-green' }, { key: 'messageCount' as const, label: '消息', icon: Tickets, tone: 'tone-teal' }, { key: 'promptCount' as const, label: '提示词', icon: MagicStick, tone: 'tone-coral' }, { key: 'providerCount' as const, label: '模型连接', icon: Connection, tone: 'tone-amber' }]
onMounted(async () => { try { dashboard.value = await workbenchApi.dashboard() } catch (error) { ElMessage.error(workbenchMessage(error, '概览加载失败')) } finally { loading.value = false } })
function openConversation(row: Dashboard['recent'][number]) { void router.push(`/ai-workbench/chat/${row.id}`) }
</script>

<template><div v-loading="loading" class="page-stack ai-overview"><header class="page-heading"><div><h2>个人 AI 概览</h2><p>对话、提示词和模型用量</p></div><el-button type="primary" :icon="ChatLineRound" @click="router.push('/ai-workbench/chat')">开始对话</el-button></header><section v-if="dashboard" class="metric-grid"><article v-for="item in metrics" :key="item.key" class="metric-card"><span class="metric-icon" :class="item.tone"><el-icon><component :is="item.icon" /></el-icon></span><div><strong>{{ dashboard[item.key].toLocaleString() }}</strong><span>{{ item.label }}</span></div></article><article class="metric-card"><span class="metric-icon tone-violet"><el-icon><Tickets /></el-icon></span><div><strong>{{ dashboard.totalTokens.toLocaleString() }}</strong><span>累计 Token</span></div></article></section><section class="data-section"><div class="section-heading"><div><h3>最近对话</h3><p>继续上次的工作</p></div></div><el-table v-if="dashboard?.recent.length" :data="dashboard.recent" @row-click="openConversation"><el-table-column prop="title" label="对话" min-width="220" /><el-table-column prop="model" label="模型" min-width="160" /><el-table-column prop="messageCount" label="消息" width="90" /><el-table-column prop="updatedAt" label="更新时间" min-width="180"><template #default="scope">{{ new Date(scope.row.updatedAt).toLocaleString() }}</template></el-table-column></el-table><el-empty v-else description="还没有对话" /></section></div></template>
