<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import VideoPreview from './VideoPreview.vue'
import TaskDetails from './TaskDetails.vue'
import TaskProgress from './TaskProgress.vue'
import { statusLabel, videos, type VideoTask, type CloudTask } from './api'

const router = useRouter()
const auth = useAuthStore()
const route = useRoute()
const cloud = computed(() => route.name === 'ai-video-cloud')
const items = ref<VideoTask[]>([])
const cloudItems = ref<CloudTask[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const working = ref('')
const canImport = computed(() => auth.can('*'))
let generation = 0
let timer = 0
let fetching = false

const formatTime = (seconds: number) => new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false })

async function load(quiet = false) {
  const version = ++generation
  fetching = true
  loading.value = !quiet
  try {
    if (cloud.value) {
      const result = await videos.cloud(page.value)
      if (version !== generation) return
      cloudItems.value = result.items
      total.value = result.total
    } else {
      const result = await videos.list(true)
      if (version !== generation) return
      items.value = result
    }
    error.value = ''
  } catch (e) { if (version === generation) error.value = apiMessage(e, '任务加载失败') }
  finally {
    if (version === generation) {
      fetching = false
      loading.value = false
    }
  }
}
watch([cloud, page], () => {
  items.value = []
  void load()
})
function refreshPending() {
  if (!document.hidden && !fetching && !working.value && error.value) void load(true)
}
onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', refreshPending)
  timer = window.setInterval(refreshPending, 8000)
})
onBeforeUnmount(() => { ++generation; clearInterval(timer); document.removeEventListener('visibilitychange', refreshPending) })
async function act(id: string, action: () => Promise<void>) {
  if (working.value) return
  working.value = id
  try { await action() }
  catch (e) { ElMessage.error(apiMessage(e, '操作失败，请重试')) }
  finally { working.value = '' }
}
function updateTask(task: VideoTask) {
  ++generation
  fetching = false
  loading.value = false
  items.value = items.value.map(item => item.id === task.id ? task : item).filter(item => item.favorite)
}
async function linkCloud(task: CloudTask) {
  const answer = await ElMessageBox.prompt(
    `核对提交时间（${formatTime(task.created)}）和模型后，输入作品所有者提供的本地记录 ID。关联后，该用户可查看此任务的成片。`,
    '关联到待核对记录', { confirmButtonText: '确认关联', cancelButtonText: '取消', inputPattern: /^[a-f0-9]{32}$/, inputErrorMessage: '请输入完整的本地记录 ID' }
  ).catch(() => undefined)
  if (answer) void act(task.id, async () => {
    await videos.review(answer.value, { action: 'link', arkId: task.id })
    ElMessage.success('已关联，后台将同步到该作品')
  })
}
function importCloud(task: CloudTask) {
  void act(task.id, async () => {
    const saved = await videos.import(task.id)
    await router.push({ name: 'ai-video-create', query: saved.setId ? { set: saved.setId } : {} })
  })
}
</script>

<template>
  <section class="library">
    <div class="toolbar">
      <div>
        <RouterLink :to="{ name: 'ai-video-task-sets' }">任务集</RouterLink>
        <RouterLink v-if="canImport && !cloud" :to="{ name: 'ai-video-cloud' }">方舟历史</RouterLink>
      </div>
      <div><el-button :icon="Refresh" :loading="loading" @click="load()">刷新</el-button>
        <el-button type="primary" @click="router.push('/ai-video/create')">新建视频</el-button></div>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <template v-if="cloud">
      <article v-for="task in cloudItems" :key="task.id" class="work">
        <div class="info"><strong>{{ task.id }}</strong><small>{{ task.model }} · {{ formatTime(task.created) }}</small></div>
        <el-tag effect="plain">{{ statusLabel(task.status) }}</el-tag>
        <el-button :disabled="!!working" :loading="working === task.id" @click="importCloud(task)">查看或导入任务</el-button>
        <el-button :disabled="!!working" @click="linkCloud(task)">关联到待核对记录</el-button>
      </article>
      <el-empty v-if="!cloudItems.length && !loading && !error" description="方舟暂无可查询的任务" />
      <el-pagination v-if="total > 20" v-model:current-page="page" layout="prev, pager, next" :page-size="20" :total="total" />
    </template>
    <template v-else>
      <div v-if="items.length" class="favorite-grid" aria-label="收藏的视频">
        <article v-for="task in items" :key="task.id" class="favorite-card">
          <TaskDetails :prompt="task.prompt">
            <small>{{ formatTime(task.created) }}<template v-if="task.duration > 0"> · {{ task.duration }} 秒</template></small>
          </TaskDetails>
          <TaskProgress :task="task" />
          <VideoPreview :task="task" @updated="updateTask" />
        </article>
      </div>
      <el-empty v-else-if="!loading && !error" description="还没有收藏的视频">
        <el-button @click="router.push({name: 'ai-video-task-sets'})">打开任务集</el-button>
      </el-empty>
    </template>
  </section>
</template>

<style scoped>
.library { display:grid; gap:14px; max-width:1200px; }
.toolbar, .toolbar > div, .work { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
.toolbar { justify-content:space-between; margin-bottom:4px; }
.work { padding:18px 20px; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
.info { flex:1 1 260px; min-width:0; overflow-wrap:anywhere; }
.info strong, .info small { display:block; }
.info strong { font-size:1rem; white-space:pre-wrap; }
.info small { font-size:.85rem; color:var(--muted); margin-top:5px; }
.info p { margin:8px 0 0; }
.favorite-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr)); gap:18px; }
.favorite-card { min-width:0; display:grid; align-content:start; gap:7px; }

</style>
