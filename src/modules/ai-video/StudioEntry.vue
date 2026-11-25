<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditPen, RefreshRight, VideoPlay } from '@element-plus/icons-vue'
import { apiMessage } from '@/api/client'
import { statusLabel, videos, type VideoTask } from './api'

const props = defineProps<{ task: VideoTask; modelLabel: string; busy: boolean }>()
defineEmits<{ edit: [task: VideoTask]; regenerate: [task: VideoTask] }>()
const card = ref<HTMLElement>()
const player = ref<HTMLVideoElement>()
const poster = ref('')
const source = ref('')
const loading = ref(false)
const error = ref('')
let alive = true
let visible = false
let triedPoster = false
let observer: IntersectionObserver | undefined
async function loadPoster() {
  if (!visible || triedPoster || props.task.status !== 'succeeded') return
  triedPoster = true
  try {
    const blob = await videos.poster(props.task.id)
    if (alive) poster.value = URL.createObjectURL(blob)
  } catch { /* An archived video can still be played without a thumbnail. */ }
}
watch(() => props.task.status, loadPoster)
onMounted(() => {
  if (!card.value) return
  observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting
    if (visible) void loadPoster()
    else player.value?.pause()
  }, { rootMargin:'180px' })
  observer.observe(card.value)
})
onBeforeUnmount(() => {
  alive = false
  observer?.disconnect()
  if (poster.value) URL.revokeObjectURL(poster.value)
  if (source.value) URL.revokeObjectURL(source.value)
})
async function play() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const blob = await videos.video(props.task.id)
    if (alive) source.value = URL.createObjectURL(blob)
  } catch (e) { error.value = apiMessage(e, '视频加载失败，请重试') }
  finally { loading.value = false }
}
</script>
<template>
  <article ref="card" class="entry">
    <time :datetime="new Date(task.created * 1000).toISOString()">{{ new Date(task.created * 1000).toLocaleString('zh-CN', {hour12:false}) }}</time>
    <div class="caption"><strong>{{ task.prompt || (task.image ? '图片生成视频' : '方舟历史作品') }}</strong>
      <span>{{ modelLabel }}</span><span v-if="task.materials.length">素材 · {{ task.materials.length }}</span>
      <span v-if="task.ratio">{{ task.ratio === 'adaptive' ? '自动匹配' : task.ratio }}</span>
      <span v-if="task.options.resolution">{{ task.options.resolution }}</span>
      <span v-if="task.duration">{{ task.duration > 0 ? task.duration + 's' : '智能时长' }}</span><span v-if="task.options.draft">草稿</span>
    </div>
    <div v-if="task.status === 'succeeded'" class="screen">
      <video v-if="source" ref="player" :src="source" :poster="poster" controls autoplay playsinline />
      <button v-else type="button" @click="play" :disabled="loading" aria-label="播放成片">
        <img v-if="poster" :src="poster" alt="" /><span class="play"><el-icon><VideoPlay /></el-icon>{{ loading ? '加载中' : '' }}</span>
      </button>
    </div>
    <p v-else class="state">{{ statusLabel(task.status) }}<template v-if="task.message"> · {{ task.message }}</template></p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="actions" v-if="task.prompt || task.materials.length">
      <button type="button" :disabled="busy" @click="$emit('edit',task)"><el-icon><EditPen /></el-icon>编辑提示</button>
      <button type="button" :disabled="busy" @click="$emit('regenerate',task)"><el-icon><RefreshRight /></el-icon>重新生成</button>
    </div>
  </article>
</template>
<style scoped>
.entry { margin:0 0 28px; color:#efeff1; overflow-wrap:anywhere; }
time,.state { color:#a3a3ab; font-size:13px; }
.caption { display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 0; margin:9px 0 13px; }
.caption strong { font-weight:500; font-size:15px; white-space:pre-wrap; margin-right:10px; }
.caption span { color:#aaaab2; font-size:13px; padding:0 9px; border-left:1px solid #404044; }
.screen { width:min(500px,100%); aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:#19191c; }
.screen button,.screen video { display:grid; place-items:center; position:relative; width:100%; height:100%; background:#141417; border:none; }
.screen img { position:absolute; width:100%; height:100%; object-fit:contain; }
.play { position:relative; display:flex; align-items:center; padding:8px; border-radius:50px; background:#111b; color:white; font-size:25px; }
.actions { display:flex; gap:8px; margin-top:12px; }
button { cursor:pointer; }
.actions button { display:flex; align-items:center; gap:6px; background:#212124; color:#dddde2; border:1px solid #303034; border-radius:20px; padding:6px 12px; font-size:13px; }
.actions button:hover { background:#343437; }
button:disabled { opacity:.6; }
</style>
