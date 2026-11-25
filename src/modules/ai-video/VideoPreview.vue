<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Download, MoreFilled, Star, StarFilled, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiMessage } from '@/api/client'
import { downloadVideo, videos, type VideoTask } from './api'

const props = defineProps<{ task: VideoTask; autoplay?: boolean }>()
const emit = defineEmits<{ updated: [task: VideoTask] }>()
const screen = ref<HTMLElement>()
const player = ref<HTMLVideoElement>()
const poster = ref('')
const source = ref('')
const loading = ref(false)
const error = ref('')
const working = ref(false)
let alive = true
let observer: IntersectionObserver | undefined
let timer = 0
let triedPoster = false

function ready() {
  clearTimeout(timer)
  loading.value = false
}
function failed(message: string) {
  ready()
  error.value = message
  source.value = ''
}
function watchBuffer() {
  clearTimeout(timer)
  loading.value = true
  timer = window.setTimeout(() => failed('视频读取超时，请重试。'), 25_000)
}
async function play() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    const url = await videos.preview(props.task.id)
    if (!alive) return
    source.value = url
    watchBuffer()
    await nextTick()
    await player.value?.play()
  } catch (e) {
    if (!alive) return
    if (e instanceof DOMException && ['NotAllowedError', 'AbortError'].includes(e.name)) ready()
    else failed(apiMessage(e, '预览失败，请重试'))
  }
}
async function loadPoster() {
  if (triedPoster || props.autoplay) return
  triedPoster = true
  try {
    const blob = await videos.poster(props.task.id)
    if (alive) poster.value = URL.createObjectURL(blob)
  } catch { /* Playback also works without a poster. */ }
}
async function action(command: string) {
  if (working.value) return
  working.value = true
  try {
    if (command === 'download') await downloadVideo(props.task.id)
    else {
      const task = await videos.favorite(props.task.id, !props.task.favorite)
      emit('updated', task)
      ElMessage.success(task.favorite ? '已收藏视频' : '已取消收藏')
    }
  } catch (e) { ElMessage.error(apiMessage(e, '操作失败，请重试')) }
  finally { working.value = false }
}
onMounted(() => {
  if (props.autoplay) { void play(); return }
  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) void loadPoster()
    else player.value?.pause()
  }, { rootMargin: '180px' })
  if (screen.value) observer.observe(screen.value)
})
onBeforeUnmount(() => {
  alive = false
  clearTimeout(timer)
  observer?.disconnect()
  if (poster.value) URL.revokeObjectURL(poster.value)
  if (player.value) { player.value.pause(); player.value.removeAttribute('src'); player.value.load() }
})
</script>
<template>
  <div class="preview" ref="screen">
    <video v-if="source" ref="player" :src="source" :poster="poster" controls playsinline preload="metadata"
      @loadeddata="ready" @playing="ready" @canplay="ready" @pause="ready" @waiting="watchBuffer"
      @error="failed('当前视频无法播放，请重试或下载原片。')" />
    <button v-else type="button" class="start" :disabled="loading" :aria-label="error ? '重试播放' : '播放成片'" @click="play">
      <img v-if="poster" :src="poster" alt="" />
      <span class="play"><el-icon><VideoPlay /></el-icon>{{ error ? '重试播放' : loading ? '正在打开…' : '' }}</span>
    </button>
    <span v-if="source && loading" class="buffer" role="status">正在缓冲…</span>
    <span v-if="error" class="media-error" role="alert">{{ error }}</span>
    <el-dropdown class="more" trigger="click" placement="bottom-end" @command="action">
      <button class="more-button" type="button" aria-label="视频操作" :disabled="working"><el-icon><MoreFilled /></el-icon></button>
      <template #dropdown><el-dropdown-menu>
        <el-dropdown-item command="favorite" :icon="task.favorite ? StarFilled : Star">{{ task.favorite ? '取消收藏' : '收藏视频' }}</el-dropdown-item>
        <el-dropdown-item command="download" :icon="Download">下载视频</el-dropdown-item>
      </el-dropdown-menu></template>
    </el-dropdown>
  </div>
</template>
<style scoped>
.preview { position:relative; isolation:isolate; overflow:hidden; border-radius:12px; width:100%; aspect-ratio:16/9; background:#151518; }
video,.start,.start img { width:100%; height:100%; display:block; object-fit:contain; }
.start { position:relative; display:grid; place-items:center; padding:0; cursor:pointer; border:0; background:transparent; color:white; }
.start img { position:absolute; inset:0; }
.play,.buffer,.media-error { color:white; background:#161619d9; border-radius:18px; padding:8px; }
.play { position:relative; display:flex; gap:4px; align-items:center; }
.play .el-icon { font-size:25px; }
.buffer,.media-error { position:absolute; bottom:24%; left:50%; transform:translateX(-50%); font-size:13px; text-align:center; pointer-events:none; }
.more { position:absolute; top:10px; right:10px; }
.more-button { display:grid; place-items:center; width:34px; height:34px; border:0; border-radius:50%; cursor:pointer; background:#161619c9; color:#fff; font-size:18px; }
.more-button:hover,.more-button:focus-visible { background:#36363b; }
</style>
