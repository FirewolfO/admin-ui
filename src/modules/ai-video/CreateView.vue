<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument, Delete, Plus, Upload, VideoCamera } from '@element-plus/icons-vue'
import { apiMessage } from '@/api/client'
import { copyText } from '@permission/utils/clipboard'
import { videos, type ImageMode, type VideoModel } from './api'

const router = useRouter()
const prompt = ref('')
const mode = ref<ImageMode>('text')
const modelId = ref('')
const models = ref<VideoModel[]>([])
const ratios = ref<string[]>([])
const ratio = ref('16:9')
const duration = ref(5)
const frameUrls = ref(['', ''])
const references = ref<string[]>([])
const publishing = ref('')
const submitting = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement>()
const model = computed(() => models.value.find(item => item.id === modelId.value))
const busy = computed(() => !!publishing.value || submitting.value)
const limit = computed(() => model.value?.maxReferences ?? 0)
const selected = computed(() => {
  if (mode.value === 'references') return references.value
  if (mode.value === 'frames') return frameUrls.value
  return mode.value === 'first' ? frameUrls.value.slice(0, 1) : []
})
const followFrame = computed(() => model.value?.adaptiveFramesOnly && ['first', 'frames'].includes(mode.value))
const taskRatio = computed(() => followFrame.value ? 'adaptive' : ratio.value)
const availableDurations = computed(() => model.value?.durations ?? [])
const valid = computed(() => {
  if (!model.value || busy.value) return false
  if (mode.value === 'text') return !!prompt.value.trim()
  return selected.value.length > 0 && selected.value.every(url => url.trim()) &&
    (mode.value !== 'references' || selected.value.length <= limit.value)
})
let requestId = ''
let uploadIndex = 0
watch([prompt, modelId, mode, selected, taskRatio, duration], () => { requestId = '' }, { deep: true })
watch(model, item => {
  if (!item) return
  if (!item.durations.includes(duration.value)) {
    duration.value = duration.value > Math.max(...item.durations) ? Math.max(...item.durations) : 5
    ElMessage.info(`已按当前模型将时长调整为 ${duration.value} 秒`)
  }
  if (!item.maxReferences && ['frames', 'references'].includes(mode.value)) mode.value = 'first'
})

async function loadSettings() {
  try {
    const settings = await videos.settings()
    if (!settings.models?.length || !settings.ratios?.length) throw new Error('模型设置尚未就绪，请重新加载')
    models.value = settings.models
    ratios.value = settings.ratios
    modelId.value = settings.model
    error.value = ''
  } catch (e) { error.value = apiMessage(e, '无法读取模型设置') }
}
onMounted(loadSettings)

function slotLabel(index: number) {
  if (mode.value === 'references') return `参考图 ${index + 1}`
  return index === 0 ? '首帧' : '尾帧'
}
function setUrl(index: number, url: string) {
  if (mode.value === 'references') references.value[index] = url
  else frameUrls.value[index] = url
}
function chooseFile(index = 0) {
  uploadIndex = index
  fileInput.value?.click()
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length || busy.value) return
  const multi = mode.value === 'references'
  if (multi && references.value.filter(url => url.trim()).length + files.length > limit.value) {
    error.value = `当前模型最多可使用 ${limit.value} 张参考图`
    return
  }
  if (files.some(file => file.size >= 30_000_000)) { error.value = '每张图片须小于 30 MB'; return }
  error.value = ''
  let done = 0
  try {
    for (const file of files) {
      publishing.value = `正在发布 ${done + 1} / ${files.length}`
      const url = await videos.upload(file)
      if (multi) {
        const empty = references.value.findIndex(item => !item.trim())
        if (empty < 0) references.value.push(url)
        else references.value[empty] = url
      } else setUrl(uploadIndex, url)
      done++
    }
    ElMessage.success(`已发布 ${done} 张图片`)
  } catch (e) { error.value = `${done ? '已保留前 ' + done + ' 张。' : ''}${apiMessage(e, '图片上传失败')}` }
  finally { publishing.value = '' }
}
async function copyImage(url: string) {
  try { await copyText(url); ElMessage.success('已复制素材地址') }
  catch { ElMessage.error('复制失败，请手动复制图片地址') }
}
async function submit() {
  if (!valid.value) return
  submitting.value = true
  error.value = ''
  requestId ||= Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
  try {
    const task = await videos.create({
      requestId, model: modelId.value, mode: mode.value, images: selected.value.map(url => url.trim()),
      prompt: prompt.value.trim(), ratio: taskRatio.value, duration: duration.value,
    })
    if (task.status === 'failed' || task.status === 'unknown') {
      error.value = task.message
      if (task.status === 'failed') requestId = ''
      return
    }
    ElMessage.success('生成任务已提交')
    await router.push('/ai-video/library')
  } catch (e) { error.value = apiMessage(e, '提交失败，请重试') }
  finally { submitting.value = false }
}
</script>

<template>
  <form class="studio" @submit.prevent="submit">
    <el-alert v-if="error" class="wide" :title="error" type="error" show-icon @close="error = ''" />
    <fieldset :disabled="busy" class="panel">
      <legend>镜头设计</legend>
      <label for="video-model">生成模型</label>
      <el-select id="video-model" v-model="modelId" aria-label="生成模型" :disabled="busy" placeholder="加载模型中">
        <el-option v-for="item in models" :key="item.id" :label="item.label" :value="item.id" />
      </el-select>
      <el-button v-if="!model && error" text @click="loadSettings">重新加载模型</el-button>
      <label for="video-prompt">画面描述</label>
      <el-input id="video-prompt" v-model="prompt" type="textarea" :rows="6" maxlength="4000" show-word-limit
        :placeholder="mode === 'references' ? '例如：以图 1 的山谷为场景，镜头跟随图 2 中的小船。' : '例如：清晨的山谷里，薄雾缓缓升起，镜头沿着河面向前推进。'" />
      <div class="settings">
        <div><label for="video-ratio">画幅</label>
          <el-input v-if="followFrame" id="video-ratio" model-value="跟随首帧" readonly />
          <el-select v-else id="video-ratio" v-model="ratio" aria-label="画幅" :disabled="busy">
            <el-option v-for="value in ratios" :key="value" :label="value === 'adaptive' ? '自适应画幅' : value" :value="value" />
          </el-select>
        </div>
        <div><label for="video-duration">视频时长 <small v-if="model">最长 {{ Math.max(...availableDurations) }} 秒</small></label>
          <el-select id="video-duration" v-model="duration" aria-label="视频时长" :disabled="busy">
            <el-option v-for="seconds in availableDurations" :key="seconds" :label="seconds === -1 ? '智能时长' : seconds + ' 秒'" :value="seconds" />
          </el-select>
        </div>
      </div>
      <el-button type="primary" native-type="submit" :icon="VideoCamera" :loading="submitting" :disabled="!valid">生成视频</el-button>
    </fieldset>
    <fieldset :disabled="busy" class="panel">
      <legend>图片素材</legend>
      <label for="video-mode">生成方式</label>
      <el-select id="video-mode" v-model="mode" aria-label="生成方式" :disabled="busy || !model">
        <el-option label="纯文本" value="text" /><el-option label="单张首帧" value="first" />
        <el-option v-if="limit" label="首尾帧" value="frames" /><el-option v-if="limit" label="多图参考" value="references" />
      </el-select>
      <template v-if="mode !== 'text'">
        <p class="hint">上传的图片将发布到公开的 FirewolfO/images 仓库。支持 PNG、JPEG、WebP，每张小于 30 MB。也可粘贴已有的仓库图片地址。</p>
        <template v-if="mode === 'references'">
          <div class="tools">
            <el-button :icon="Upload" :disabled="busy" @click="chooseFile()">批量上传图片</el-button>
            <el-button :icon="Plus" :disabled="busy || references.length >= limit" @click="references.push('')">添加地址</el-button>
          </div>
          <p class="hint" role="status">参考图 {{ references.length }} / {{ limit }} 张<span v-if="references.length > limit">，请移除超出的图片或切换模型。</span></p>
        </template>
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" :multiple="mode === 'references'" hidden @change="upload" />
        <div v-for="(url, index) in selected" :key="index" class="asset">
          <label :for="'asset-' + index">{{ slotLabel(index) }}</label>
          <img v-if="url.startsWith('https://raw.githubusercontent.com/FirewolfO/images/')" :src="url" :alt="slotLabel(index)" loading="lazy" />
          <el-input :id="'asset-' + index" :model-value="url" placeholder="仓库图片地址" @update:model-value="setUrl(index, $event)" />
          <div class="tools">
            <el-button v-if="mode !== 'references'" text :icon="Upload" :disabled="busy" @click="chooseFile(index)">上传{{ slotLabel(index) }}</el-button>
            <el-button v-if="url" text :icon="CopyDocument" :disabled="busy" @click="copyImage(url)">复制地址</el-button>
            <el-button v-if="mode === 'references'" text :icon="Delete" :disabled="busy" @click="references.splice(index, 1)">移除</el-button>
          </div>
        </div>
        <p v-if="publishing" role="status">{{ publishing }}</p>
      </template>
    </fieldset>
  </form>
</template>

<style scoped>
.studio { display:grid; grid-template-columns:minmax(0, 1.35fr) minmax(280px, 1fr); gap:22px; max-width:1200px; align-items:start; }
.wide { grid-column:1/-1; }
.panel { min-width:0; margin:0; border:1px solid var(--line); border-radius:12px; padding:12px 24px 24px; background:var(--surface); }
legend { font-weight:650; font-size:1.15rem; padding:0 7px; }
label { display:block; font-size:.9rem; font-weight:600; margin:14px 0 8px; }
.hint, small { color:var(--muted); line-height:1.6; font-size:.85rem; font-weight:400; }
.settings { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:4px 0 22px; }
.tools { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.tools .el-button { margin:0; }
.asset { margin-top:16px; border-top:1px solid var(--line); }
.asset img { display:block; max-width:100%; max-height:110px; border-radius:6px; margin:8px 0; }
@media (max-width:850px) { .studio { grid-template-columns:1fr; } .panel { padding:12px 16px 16px; } }
</style>
