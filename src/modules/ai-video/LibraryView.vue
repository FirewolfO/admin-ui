<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Refresh, Star, StarFilled, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { statusLabel, videos, type VideoTask, type CloudTask } from './api'

const router = useRouter()
const auth = useAuthStore()
const tab = ref('all')
const items = ref<VideoTask[]>([])
const cloudItems = ref<CloudTask[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const working = ref('')
const playing = ref(false)
const playbackUrl = ref('')
const shown = computed(() => tab.value === 'favorites' ? items.value.filter(t => t.favorite) : items.value)
const canImport = computed(() => auth.can('*'))
let generation = 0
let timer = 0
let active = true
const formatTime = (seconds: number) => new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false })

async function load(quiet = false) {
  const version = ++generation
  loading.value = !quiet
  try {
    if (tab.value === 'cloud') {
      const result = await videos.cloud(page.value)
      if (version !== generation) return
      cloudItems.value = result.items
      total.value = result.total
    } else {
      const result = await videos.list()
      if (version !== generation) return
      items.value = result
    }
    error.value = ''
  } catch (e) { if (version === generation) error.value = apiMessage(e, '任务加载失败') }
  finally { if (version === generation) loading.value = false }
}
watch([tab, page], () => { void load() })
onMounted(() => {
  void load()
  timer = window.setInterval(() => {
    if (!document.hidden && !loading.value && !working.value && tab.value !== 'cloud' &&
      (error.value || items.value.some(t => ['submitting', 'queued', 'running', 'archiving'].includes(t.status)))) void load(true)
  }, 8000)
})
function clearPlayer() {
  if (playbackUrl.value) URL.revokeObjectURL(playbackUrl.value)
  playbackUrl.value = ''
}
onBeforeUnmount(() => { active = false; ++generation; clearInterval(timer); clearPlayer() })
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
function openVideo(task: VideoTask, download: boolean) {
  void act(task.id, async () => {
    const blob = await videos.video(task.id)
    if (!active) return
    const url = URL.createObjectURL(blob)
    if (download) {
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-video-${task.ark_id || task.id}.mp4`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } else {
      clearPlayer()
      playbackUrl.value = url
      playing.value = true
    }
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
        <el-radio-button value="favorites">已收藏</el-radio-button>
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
      </article>
      <el-empty v-if="!cloudItems.length && !loading && !error" description="方舟暂无可查询的任务" />
      <el-pagination v-if="total > 20" v-model:current-page="page" layout="prev, pager, next" :page-size="20" :total="total" />
    </template>
    <template v-else>
      <article v-for="task in shown" :key="task.id" class="work">
        <div class="info"><strong>{{ task.prompt || (task.image ? '图片生成视频' : '方舟历史作品') }}</strong>
          <small>{{ formatTime(task.created) }} · {{ task.model }}<template v-if="task.duration"> · {{ task.ratio === 'adaptive' ? '自适应画幅' : task.ratio }} · {{ task.duration === -1 ? '智能时长' : task.duration + ' 秒' }}</template></small>
          <small v-if="task.materials?.length">{{ task.materials[0].role === 'reference_image' ? task.materials.length + ' 张参考图' : task.materials.length === 2 ? '首尾帧' : '首帧' }}</small>
          <small v-if="task.ark_id">{{ task.ark_id }}</small>
          <p v-if="task.message">{{ task.message }}</p>
        </div>
        <el-tag :type="task.status === 'succeeded' ? 'success' : task.status === 'failed' ? 'danger' : 'info'">{{ statusLabel(task.status) }}</el-tag>
        <div v-if="task.status === 'succeeded'" class="actions">
          <el-button :icon="VideoPlay" :disabled="!!working" @click="openVideo(task, false)">预览</el-button>
          <el-button :icon="Download" :disabled="!!working" @click="openVideo(task, true)">下载</el-button>
          <el-button :icon="task.favorite ? StarFilled : Star" :disabled="!!working" @click="favorite(task)">{{ task.favorite ? '取消收藏' : '收藏' }}</el-button>
        </div>
      </article>
      <el-empty v-if="!shown.length && !loading && !error" :description="tab === 'favorites' ? '还没有收藏的成片' : '还没有作品'">
        <el-button v-if="tab === 'all'" type="primary" @click="router.push('/ai-video/create')">创作第一段视频</el-button>
      </el-empty>
    </template>
    <el-dialog v-model="playing" title="成片预览" width="min(850px, 95vw)" destroy-on-close @closed="clearPlayer">
      <video v-if="playbackUrl" :src="playbackUrl" controls autoplay playsinline />
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
.actions { gap:6px; }
.actions .el-button { margin:0; }
video { display:block; width:100%; max-height:70vh; background:#101514; }
</style>
