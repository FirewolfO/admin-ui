<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { apiMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { videos, type TaskSet } from './api'

const auth = useAuthStore()
const items = ref<TaskSet[]>([])
const ungrouped = ref(0)
const loading = ref(true)
const working = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  try {
    const result = await videos.taskSets()
    items.value = result.items
    ungrouped.value = result.ungroupedCount
    error.value = ''
  } catch (e) { error.value = apiMessage(e, '加载任务集失败') }
  finally { loading.value = false }
}
onMounted(load)

async function edit(item?: TaskSet) {
  if (working.value) return
  const answer = await ElMessageBox.prompt('任务集名称', item ? '重命名任务集' : '新建任务集', {
    inputValue: item?.name ?? '', confirmButtonText: '保存', cancelButtonText: '取消',
    inputValidator: value => (value?.trim().length > 0 && value.trim().length <= 80) || '请输入 1 至 80 字的名称',
  }).catch(() => undefined)
  if (!answer) return
  working.value = true
  try {
    if (item) await videos.renameSet(item.id, answer.value.trim())
    else await videos.createSet(answer.value.trim())
    await load()
  } catch (e) { ElMessage.error(apiMessage(e, '保存任务集失败')) }
  finally { working.value = false }
}

async function remove(item: TaskSet) {
  const confirmed = await ElMessageBox.confirm(
    `删除「${item.name}」后，其中的任务和成片将移至「未分组」，正在执行的任务会继续。`,
    '删除任务集', { type: 'warning', confirmButtonText: '删除任务集', cancelButtonText: '保留' }
  ).then(() => true, () => false)
  if (!confirmed) return
  working.value = true
  try { await videos.deleteSet(item.id); await load() }
  catch (e) { ElMessage.error(apiMessage(e, '删除任务集失败')) }
  finally { working.value = false }
}
</script>

<template>
  <section class="task-sets" aria-label="任务集">
    <div class="toolbar">
      <el-button type="primary" :icon="Plus" :disabled="working" @click="edit()">新建任务集</el-button>
      <RouterLink v-if="auth.can('*')" :to="{ name: 'ai-video-cloud' }">方舟历史</RouterLink>
    </div>
    <div v-if="error" role="alert">{{ error }} <el-button text @click="load">重试</el-button></div>
    <p v-else-if="loading" role="status">正在加载任务集…</p>
    <ul v-else>
      <li v-for="item in items" :key="item.id">
        <RouterLink :to="{ name: 'ai-video-create', query: { set: item.id } }">
          <strong>{{ item.name }}</strong><small>{{ item.taskCount }} 个任务</small>
        </RouterLink>
        <el-button :disabled="working" @click="edit(item)">重命名</el-button>
        <el-button :disabled="working" @click="remove(item)">删除</el-button>
      </li>
      <li><RouterLink :to="{ name: 'ai-video-create' }">
        <strong>未分组</strong><small>{{ ungrouped }} 个任务</small>
      </RouterLink></li>
    </ul>
  </section>
</template>

<style scoped>
.task-sets { max-width:900px; }
.toolbar, li { display:flex; align-items:center; gap:12px; }
.toolbar { justify-content:space-between; margin-bottom:16px; }
ul { display:grid; gap:8px; list-style:none; padding:0; }
li { padding:12px 16px; border:1px solid var(--el-border-color); border-radius:8px; }
li a { flex:1; min-width:0; display:grid; gap:4px; text-decoration:none; color:var(--el-text-color-primary); overflow-wrap:anywhere; }
a:hover strong, .toolbar a { color:var(--el-color-primary); }
small { color:var(--el-text-color-secondary); }
li .el-button { margin:0; }
</style>
