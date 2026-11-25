<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, Refresh, Star, StarFilled, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import VideoPreview from './VideoPreview.vue'
import TaskReview from './TaskReview.vue'
import TaskProgress from './TaskProgress.vue'
import { downloadVideo, isTaskPending, statusLabel, videos, type VideoTask, type CloudTask } from './api'

const router = useRouter()
const auth = useAuthStore()
const route = useRoute()
const libraryTab = ref('all')
const tab = computed({
  get: () => route.name === 'ai-video-favorites' ? 'favorites' : libraryTab.value,
  set: (value: string) => {
    if (value === 'favorites') void router.push({ name: 'ai-video-favorites' })
    else {
      libraryTab.value = value
      if (route.name === 'ai-video-favorites') void router.push({ name: 'ai-video-library' })
    }
  },
})
const items = ref<VideoTask[]>([])
const cloudItems = ref<CloudTask[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const working = ref('')
const playing = ref(false)
const selected = ref<VideoTask>()
const reviewing = ref<VideoTask>()
const shown = computed(() => tab.value === 'favorites' ? items.value.filter(t => t.favorite && t.status === 'succeeded') : items.value)
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
    if (tab.value === 'cloud') {
      const result = await videos.cloud(page.value)
      if (version !== generation) return
      cloudItems.value = result.items
      total.value = result.total
    } else {
      const result = await videos.list(tab.value === 'favorites')
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
watch([tab, page], () => {
  playing.value = false
  items.value = []
  void load()
})
function refreshPending() {
  if (!document.hidden && !fetching && !working.value && tab.value !== 'cloud' &&
      (error.value || items.value.some(isTaskPending))) void load(true)
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
function favorite(task: VideoTask) {
  void act(task.id, async () => { await videos.favorite(task.id, !task.favorite); await load(true) })
}
function updateTask(task: VideoTask) {
  ++generation
  fetching = false
  loading.value = false
  if (selected.value?.id === task.id) selected.value = task
  items.value = items.value.map(item => item.id === task.id ? task : item)
}
function openVideo(task: VideoTask, download: boolean) {
  if (download) void act(task.id, () => downloadVideo(task.id))
  else { selected.value = task; playing.value = true }
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
    await videos.import(task.id)
    tab.value = 'all'
    ElMessage.success('任务已加入作品库')
  })
}
</script>

<template>
  <section class="library">
    <div class="toolbar">
      <el-radio-group v-model="tab" aria-label="作品筛选">
        <el-radio-button value="all">全部作品</el-radio-button>
        <el-radio-button value="favorites">我的收藏</el-radio-button>
        <el-radio-button v-if="canImport" value="cloud">方舟历史</el-radio-button>
      </el-radio-group>
      <div><el-button :icon="Refresh" :loading="loading" @click="load()">刷新</el-button>
        <el-button type="primary" @click="router.push('/ai-video/create')">新建视频</el-button></div>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <template v-if="tab === 'cloud'">
      <article v-for="task in cloudItems" :key="task.id" class="work">
        <div class="info"><strong>{{ task.id }}</strong><small>{{ task.model }} · {{ formatTime(task.created) }}</small></div>
        <el-tag effect="plain">{{ statusLabel(task.status) }}</el-tag>
        <el-button :disabled="!!working" :loading="working === task.id" @click="importCloud(task)">加入我的作品</el-button>
        <el-button :disabled="!!working" @click="linkCloud(task)">关联到待核对记录</el-button>
      </article>
      <el-empty v-if="!cloudItems.length && !loading && !error" description="方舟暂无可查询的任务" />
      <el-pagination v-if="total > 20" v-model:current-page="page" layout="prev, pager, next" :page-size="20" :total="total" />
    </template>
    <template v-else-if="tab === 'favorites'">
      <div v-if="shown.length" class="favorite-grid" aria-label="收藏的视频">
        <article v-for="task in shown" :key="task.id" class="favorite-card">
          <VideoPreview :task="task" @updated="updateTask" />
          <div class="info">
            <strong>{{ task.prompt || '收藏的视频' }}</strong>
            <small>{{ formatTime(task.created) }}<template v-if="task.duration > 0"> · {{ task.duration }} 秒</template></small>
          </div>
        </article>
      </div>
      <el-empty v-else-if="!loading && !error" description="还没有收藏的视频">
        <el-button @click="tab = 'all'">查看我的作品</el-button>
      </el-empty>
    </template>
    <template v-else>
      <article v-for="task in shown" :key="task.id" class="work">
        <div class="info"><strong>{{ task.prompt || (task.image ? '图片生成视频' : '方舟历史作品') }}</strong>
          <small>{{ formatTime(task.created) }} · {{ task.model }}<template v-if="task.duration"> · {{ task.ratio === 'adaptive' ? '自适应画幅' : task.ratio }} · {{ task.duration === -1 ? '智能时长' : task.duration + ' 秒' }}</template></small>
          <small v-if="task.materials?.length">{{ task.materials[0].role === 'reference_image' ? task.materials.length + ' 张参考图' : task.materials.length === 2 ? '首尾帧' : '首帧' }}</small>
          <small v-if="task.ark_id">{{ task.ark_id }}</small>
          <p v-if="task.message && !isTaskPending(task)">{{ task.message }}</p>
        </div>
        <TaskProgress v-if="isTaskPending(task)" :task="task" />
        <el-tag v-else :type="task.status === 'succeeded' ? 'success' : task.status === 'failed' ? 'danger' : 'info'">{{ statusLabel(task.status) }}</el-tag>
        <el-button v-if="task.status === 'unknown'" @click="reviewing = task">核对任务</el-button>
        <div v-if="task.status === 'succeeded'" class="actions">
          <el-button :icon="VideoPlay" :disabled="!!working" @click="openVideo(task, false)">预览</el-button>
          <el-button :icon="Download" :disabled="!!working" @click="openVideo(task, true)">下载</el-button>
          <el-button :icon="task.favorite ? StarFilled : Star" :disabled="!!working" @click="favorite(task)">{{ task.favorite ? '取消收藏' : '收藏' }}</el-button>
        </div>
      </article>
      <el-empty v-if="!shown.length && !loading && !error" description="还没有作品">
        <el-button type="primary" @click="router.push('/ai-video/create')">创作第一段视频</el-button>
      </el-empty>
    </template>
    <TaskReview v-if="reviewing" :task="reviewing" @close="reviewing = undefined" @resolved="reviewing = undefined; load(true)" />
    <el-dialog v-model="playing" title="成片预览" width="min(850px, 95vw)" destroy-on-close @closed="selected = undefined">
      <VideoPreview v-if="playing && selected" :key="selected.id" :task="selected" autoplay @updated="updateTask" />
    </el-dialog>
  </section>
</template>

<style scoped>
.library { display:grid; gap:14px; max-width:1200px; }
.toolbar, .work, .actions { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
.toolbar { justify-content:space-between; margin-bottom:4px; }
.work { padding:18px 20px; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
.info { flex:1 1 260px; min-width:0; overflow-wrap:anywhere; }
.info strong, .info small { display:block; }
.info strong { font-size:1rem; white-space:pre-wrap; }
.info small { font-size:.85rem; color:var(--muted); margin-top:5px; }
.info p { margin:8px 0 0; }
.favorite-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr)); gap:18px; }
.favorite-card { min-width:0; }
.favorite-card .info { padding:8px 2px; }
.favorite-card strong { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
.actions { gap:6px; }
.actions .el-button { margin:0; }
</style>
