<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Clock, Film, FullScreen, MagicStick, Operation, VideoCamera } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiMessage } from '@/api/client'
import { videos, type ImageMode, type VideoModel, type VideoTask } from './api'
import AssetTray from './AssetTray.vue'
import StudioEntry from './StudioEntry.vue'

const models = ref<VideoModel[]>([])
const ratios = ref<string[]>([])
const modelId = ref('')
const model = computed(() => models.value.find(item => item.id === modelId.value))
const mode = ref<ImageMode | 'auto'>('auto')
const photos = ref<string[]>([])
const prompt = ref('')
const ratio = ref('adaptive')
const duration = ref(5)
const resolution = ref('720p')
const draft = ref(false)
const audio = ref(true)
const batch = ref(1)
const expanded = ref(false)
const panel = ref<'format' | 'advanced' | ''>('')
const publishing = ref(false)
const submitting = ref(false)
const progress = ref('')
const error = ref('')
const historyError = ref('')
const tasks = ref<VideoTask[]>([])
const loadingHistory = ref(true)
const feed = ref<HTMLElement>()
const promptField = ref<HTMLTextAreaElement>()
const tools = ref<HTMLElement>()
const busy = computed(() => publishing.value || submitting.value)
const actualMode = computed<ImageMode>(() => {
  if (mode.value !== 'auto') return mode.value
  if (!photos.value.length) return 'text'
  return photos.value.length === 1 ? 'first' : 'references'
})
const limit = computed(() => {
  if (mode.value === 'frames') return 2
  if (mode.value === 'first') return 1
  return model.value?.maxReferences || 1
})
const frameLocked = computed(() => model.value?.adaptiveFramesOnly && ['first','frames'].includes(actualMode.value))
const taskRatio = computed(() => frameLocked.value ? 'adaptive' : ratio.value)
const invalid = computed(() => {
  if (actualMode.value === 'text') return ''
  if (photos.value.length > limit.value) return `当前模式最多使用 ${limit.value} 张图，请移除多余素材或切换模式。`
  if (actualMode.value === 'frames' && photos.value.length !== 2) return '请依次添加首帧和尾帧图片'
  if (!photos.value.length) return '请添加图片素材'
  return ''
})
const ready = computed(() => !!model.value && !busy.value && !invalid.value && (actualMode.value !== 'text' || !!prompt.value.trim()))
const oldestFirst = computed(() => tasks.value.slice().reverse())
const hasPending = computed(() => tasks.value.some(t => ['queued','running','submitting','archiving'].includes(t.status)))
let timer = 0
let historyVersion = 0
let attempt: { signature: string; ids: string[]; next: number } | undefined

watch(model, m => {
  if (!m) return
  if (!m.durations.includes(duration.value)) duration.value = duration.value > Math.max(...m.durations) ? Math.max(...m.durations) : 5
  if (!m.resolutions.includes(resolution.value)) resolution.value = m.resolutions.includes('720p') ? '720p' : m.resolutions[0] || ''
  if (!m.supportsDraft) draft.value = false
  if (!m.maxReferences && ['frames','references'].includes(mode.value)) mode.value = 'auto'
})
function outside(e: PointerEvent) {
  if (!tools.value?.contains(e.target as Node)) panel.value = ''
}
async function loadSettings() {
  try {
    const result = await videos.settings()
    models.value = result.models
    ratios.value = result.ratios
    modelId.value = result.model
    error.value = ''
  } catch (e) { error.value = apiMessage(e,'加载模型失败') }
}
function toBottom() { if (feed.value) feed.value.scrollTop = feed.value.scrollHeight }
async function loadHistory(scroll = false) {
  const version = ++historyVersion
  try {
    const items = await videos.list()
    if (version !== historyVersion) return
    tasks.value = items
    historyError.value = ''
    if (scroll) { await nextTick(); toBottom() }
  } catch (e) { if (version === historyVersion) historyError.value = apiMessage(e,'加载记录失败') }
  finally { loadingHistory.value = false }
}
onMounted(() => {
  void loadSettings()
  void loadHistory(true)
  document.addEventListener('pointerdown',outside)
  timer = window.setInterval(() => { if (!document.hidden && (hasPending.value || historyError.value)) void loadHistory() }, 8000)
})
onBeforeUnmount(() => { ++historyVersion; clearInterval(timer); document.removeEventListener('pointerdown',outside) })
function updatePhotos(urls: string[]) {
  photos.value = urls
  if (mode.value === 'text' && urls.length) mode.value = 'auto'
}
function loadTask(t: VideoTask) {
  if (!models.value.some(m => m.id === t.model)) { ElMessage.warning('该历史模型当前不可用'); return false }
  modelId.value = t.model
  photos.value = t.materials.map(m => m.url)
  mode.value = !photos.value.length ? 'text' : t.materials[0].role === 'reference_image' ? 'references' : photos.value.length === 2 ? 'frames' : 'first'
  prompt.value = t.prompt
  duration.value = t.duration || 5
  ratio.value = t.ratio || 'adaptive'
  resolution.value = t.options.resolution || '720p'
  draft.value = !!t.options.draft
  audio.value = t.options.generate_audio ?? true
  batch.value = 1
  panel.value = ''
  error.value = ''
  nextTick(() => promptField.value?.focus())
  return true
}
async function regenerate(t: VideoTask) {
  if (busy.value || !loadTask(t)) return
  await nextTick()
  await submit()
}
function newRequestId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
}
async function submit() {
  if (!ready.value || !model.value) return
  const input = {
    prompt:prompt.value.trim(), model:modelId.value, mode:actualMode.value, images:actualMode.value === 'text' ? [] : [...photos.value],
    ratio:taskRatio.value, duration:duration.value,
    ...(model.value.resolutions.length ? {resolution:draft.value ? '480p' : resolution.value, audio:audio.value, draft:draft.value} : {}),
  }
  const signature = JSON.stringify([input,batch.value])
  if (attempt?.signature !== signature) {
    const ids = Array.from({length:batch.value}, newRequestId)
    attempt = {signature,ids,next:0}
  }
  submitting.value = true
  panel.value = ''
  error.value = ''
  try {
    while (attempt.next < attempt.ids.length) {
      const index = attempt.next
      progress.value = attempt.ids.length === 1 ? '提交中' : `提交 ${index + 1}/${attempt.ids.length}`
      const task = await videos.create({...input,requestId:attempt.ids[index]})
      if (task.status === 'failed' || task.status === 'unknown') {
        if (task.status === 'failed') attempt.ids[index] = newRequestId()
        throw new Error(task.message || '方舟未确认生成任务')
      }
      attempt.next++
    }
    ElMessage.success(`已提交 ${batch.value} 个生成任务`)
    attempt = undefined
  } catch (e) { error.value = (attempt?.next ? `已提交 ${attempt.next} 个任务。` : '') + apiMessage(e,'提交失败，请重试') }
  finally {
    submitting.value = false
    progress.value = ''
    await loadHistory(true)
  }
}
</script>
<template>
  <section class="studio" aria-label="视频创作工作区">
    <header class="studio-top">
      <RouterLink to="/ai-video/library"><el-icon><Clock /></el-icon>生成历史</RouterLink></header>
    <section ref="feed" class="feed" aria-label="生成记录">
      <div v-if="historyError" class="notice">{{ historyError }} <button type="button" @click="loadHistory()">重试</button></div>
      <StudioEntry v-for="task in oldestFirst" :key="task.id" :task="task" :busy="busy || !model"
        :model-label="models.find(m => m.id === task.model)?.label || task.model" @edit="loadTask" @regenerate="regenerate" />
      <div v-if="!tasks.length && !historyError" class="empty"><el-icon><Film /></el-icon><p>{{ loadingHistory ? '正在加载生成记录…' : '暂无生成记录' }}</p></div>
    </section>
    <form class="composer" :class="{ enlarged: expanded }" @submit.prevent="submit" @keydown.esc="panel = ''; expanded = false">
      <div v-if="error" class="notice" role="alert">{{ error }} <button v-if="!model" type="button" @click="loadSettings">重试</button></div>
      <div class="writing">
        <AssetTray :urls="mode === 'text' ? [] : photos" :mode="mode" :limit="limit" :disabled="busy || !model"
          @change="updatePhotos" @publishing="publishing = $event" />
        <textarea ref="promptField" v-model="prompt" :disabled="busy" maxlength="4000" aria-label="画面描述"
          placeholder="描述你想要生成的视频画面" @keydown.ctrl.enter.prevent="submit" @keydown.meta.enter.prevent="submit" />
        <button type="button" class="expand" :aria-expanded="expanded" :aria-label="expanded ? '收起输入框' : '展开输入框'" @click="expanded = !expanded"><el-icon><FullScreen /></el-icon></button>
      </div>
      <div v-if="invalid" role="status" class="notice">{{ invalid }}</div>
      <div ref="tools" class="controls">
        <label class="pill"><el-icon><VideoCamera /></el-icon><select v-model="mode" aria-label="生成方式" :disabled="busy">
          <option value="auto">智能视频</option><option value="text">纯文本</option><option value="first">单张首帧</option>
          <option v-if="model?.maxReferences" value="frames">首尾帧</option><option v-if="model?.maxReferences" value="references">多图参考</option>
        </select></label>
        <label class="pill model"><select v-model="modelId" aria-label="生成模型" :disabled="busy">
          <option v-for="m in models" :key="m.id" :value="m.id">{{ m.label }}</option></select></label>
        <div class="anchor">
          <button class="pill" type="button" :disabled="busy" :aria-expanded="panel === 'format'" aria-label="画幅、分辨率和时长"
            @click="panel = panel === 'format' ? '' : 'format'">
            {{ taskRatio === 'adaptive' ? '自动匹配' : taskRatio }} <template v-if="resolution">│ {{ draft ? '480p' : resolution }}</template> │ {{ duration === -1 ? '智能时长' : duration + 's' }}
          </button>
          <div v-if="panel === 'format' && model" class="popup">
            <label>画幅<select v-model="ratio" v-if="!frameLocked" aria-label="画幅"><option v-for="r in ratios" :key="r" :value="r">{{ r === 'adaptive' ? '自动匹配' : r }}</option></select><span v-else>跟随首帧</span></label>
            <label v-if="model.resolutions.length">分辨率<select v-if="!draft" v-model="resolution" aria-label="分辨率"><option v-for="r in model.resolutions" :key="r">{{ r }}</option></select><span v-else>480p（草稿）</span></label>
            <label>时长<select v-model="duration" aria-label="视频时长"><option v-for="s in model.durations" :key="s" :value="s">{{ s === -1 ? '智能时长' : s + ' 秒' }}</option></select></label>
          </div>
        </div>
        <div v-if="model?.resolutions.length" class="anchor">
          <button class="pill icon" aria-label="高级参数" type="button" :disabled="busy" :aria-expanded="panel === 'advanced'" @click="panel = panel === 'advanced' ? '' : 'advanced'"><el-icon><Operation /></el-icon></button>
          <div v-if="panel === 'advanced'" class="popup"><label>生成同步声音<input v-model="audio" type="checkbox" /></label></div>
        </div>
        <label v-if="model?.supportsDraft" class="pill toggle">草稿模式<input v-model="draft" type="checkbox" :disabled="busy" /></label>
        <label class="pill">批量<select v-model="batch" aria-label="批量数量" :disabled="busy"><option v-for="n in 4" :key="n" :value="n">{{ n }}</option></select></label>
        <button class="generate" type="submit" :disabled="!ready"><el-icon><MagicStick /></el-icon>{{ progress || (batch > 1 ? '生成 ' + batch + ' 个视频' : '立即生成') }}</button>
      </div>
    </form>
  </section>
</template>
<style scoped>
.studio { height:100%; min-height:0; display:flex; flex-direction:column; color:#f2f2f5; background:#09090b; color-scheme:dark; }
.studio-top { display:flex; align-items:center; justify-content:flex-end; padding:12px clamp(14px,2vw,30px); border-bottom:1px solid #232326; }
.studio-top a,.generate,.pill { display:inline-flex; align-items:center; gap:7px; }

.studio-top a { font-size:14px; text-decoration:none; color:#dedee3; background:#222225; padding:7px 13px; border-radius:20px; }
.feed { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:24px clamp(16px,2.4vw,36px) 0; scrollbar-color:#404046 transparent; }
.empty { height:100%; min-height:60px; display:grid; align-content:center; justify-items:center; color:#9c9ca4; }
.empty .el-icon { font-size:32px; }.empty p { margin:9px 0; font-size:14px; }
.composer { position:relative; margin:10px clamp(10px,2vw,28px) 16px; padding:13px; border:1px solid #414147; border-radius:16px; background:#19191c; box-shadow:0 12px 42px #0005; }
.writing { display:grid; grid-template-columns:96px minmax(0,1fr) 24px; min-height:103px; align-items:start; margin-bottom:10px; }
.writing :deep(.asset-zone) { grid-area:1/1; z-index:1; }
.writing :deep(.asset-zone.spread) { grid-column:1/3; min-height:98px; background:#19191c; }
.writing textarea { grid-area:1/2; width:100%; height:96px; border:0; resize:none; background:transparent; color:inherit; font:inherit; line-height:1.6; padding:7px 10px; }
.enlarged .writing textarea { height: min(35dvh,320px); }
.writing textarea::placeholder { color:#aaaab1; }
.expand { grid-area:1/3; border:0; background:none; color:#c7c7cf; padding:5px; font-size:15px; }
.controls { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
button,select { cursor:pointer; }
button:disabled,select:disabled { cursor:default; opacity:.5; }
.pill,.generate { border:1px solid #414146; border-radius:22px; font:inherit; font-size:14px; min-height:36px; padding:6px 11px; }
.pill { background:#1c1c1f; color:#ededf2; white-space:nowrap; }.pill.model { background:#2a2a2f; }
.pill select { border:0; font:inherit; color:inherit; background:transparent; max-width:100%; }
select option { color:#eee; background:#27272b; }.pill input,.popup input { accent-color:#c3cde2; }
.generate { margin-left:auto; background:#dce3f0; color:#10141a; font-weight:650; gap:6px; }
.generate:disabled { opacity:.48; }.expand:hover,.pill:hover { color:white; }.generate:not(:disabled):hover { background:white; }
.anchor { position:relative; }.popup { position:absolute; bottom:calc(100% + 8px); left:0; z-index:4; display:grid; gap:12px; min-width:205px; background:#28282d; border:1px solid #505058; padding:15px; border-radius:12px; box-shadow:0 4px 25px #0007; }
.popup label { display:flex; align-items:center; justify-content:space-between; gap:14px; font-size:14px; }.popup select { min-width:88px; background:#19191d; border:1px solid #515158; border-radius:5px; padding:4px; }
.notice { padding:4px 3px 10px; color:#f5c5af; font-size:13px; }
.notice button { color:inherit; background:none; border:0; text-decoration:underline; }
.studio :focus-visible { outline:2px solid #b3c7f3; outline-offset:1px; }
@media(max-width:760px) {
  .composer { margin:6px 8px max(8px,env(safe-area-inset-bottom)); padding:10px; }.studio-top { padding:9px 14px; }
  .writing { grid-template-columns:90px minmax(0,1fr) 22px; }.writing textarea { font-size:16px; padding:4px; }
  .pill,.generate { font-size:13px; padding:5px 8px; }.controls { gap:5px; position:relative; }
  .anchor { position:static; }.popup { left:0; right:0; bottom:calc(100% + 8px); }
}
@media(max-height:560px) { .studio-top { display:none; }.composer { margin-bottom:4px; }.enlarged .writing textarea { height:24dvh; } }
</style>
