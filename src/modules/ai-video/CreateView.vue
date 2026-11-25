<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument, Picture, Upload, VideoCamera } from '@element-plus/icons-vue'
import { apiMessage } from '@/api/client'
import { copyText } from '@permission/utils/clipboard'
import { videos } from './api'

const router = useRouter()
const prompt = ref('')
const image = ref('')
const ratio = ref('16:9')
const duration = ref(5)
const model = ref('')
const uploading = ref(false)
const submitting = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement>()
const preview = computed(() => image.value.match(/^https:\/\/raw\.githubusercontent\.com\/FirewolfO\/images\//) ? image.value : '')
let requestId = ''
watch([prompt, image, ratio, duration], () => { requestId = '' })

async function loadSettings() {
  try { model.value = (await videos.settings()).model }
  catch (e) { error.value = apiMessage(e, '无法读取模型设置') }
}
onMounted(loadSettings)

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size >= 30_000_000) { error.value = '图片须小于 30 MB'; return }
  error.value = ''
  uploading.value = true
  try {
    image.value = await videos.upload(file)
    ElMessage.success('首帧图片已发布')
  } catch (e) { error.value = apiMessage(e, '图片上传失败') }
  finally { uploading.value = false }
}
async function copyImage() {
  try { await copyText(image.value); ElMessage.success('已复制素材地址') }
  catch { ElMessage.error('复制失败，请手动复制图片地址') }
}
async function submit() {
  if (submitting.value || uploading.value) return
  submitting.value = true
  error.value = ''
  // getRandomValues also works on the platform's HTTP intranet address.
  requestId ||= Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
  try {
    const task = await videos.create({ requestId, prompt: prompt.value.trim(), image: image.value.trim(), ratio: image.value.trim() ? 'adaptive' : ratio.value, duration: duration.value })
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
    <div v-if="error" class="wide"><el-alert :title="error" type="error" show-icon @close="error = ''" /></div>
    <fieldset :disabled="submitting" class="panel direction">
      <legend>镜头设计</legend>
      <label for="video-prompt">画面描述</label>
      <el-input id="video-prompt" v-model="prompt" type="textarea" :rows="7" maxlength="4000" show-word-limit
        placeholder="例如：清晨的山谷里，薄雾缓缓升起，镜头沿着河面向前推进。" />
      <div class="settings">
        <div><label for="video-ratio">画幅</label><el-input v-if="image.trim()" id="video-ratio" model-value="跟随首帧" readonly /><el-select v-else id="video-ratio" v-model="ratio" aria-label="画幅">
          <el-option label="横屏 · 16:9" value="16:9" /><el-option label="竖屏 · 9:16" value="9:16" /><el-option label="方形 · 1:1" value="1:1" />
        </el-select></div>
        <div><label for="video-duration">时长</label><el-select id="video-duration" v-model="duration" aria-label="时长">
          <el-option v-for="seconds in [5, 8, 10]" :key="seconds" :label="seconds + ' 秒'" :value="seconds" />
        </el-select></div>
      </div>
      <div class="generate">
        <small v-if="model">模型 · {{ model }}</small>
        <el-button type="primary" native-type="submit" :icon="VideoCamera" :loading="submitting"
          :disabled="uploading || (!prompt.trim() && !image.trim())">生成视频</el-button>
      </div>
    </fieldset>
    <fieldset :disabled="submitting || uploading" class="panel material">
      <legend>首帧素材 <small>可选</small></legend>
      <div class="image-box">
        <img v-if="preview" :src="preview" alt="已选择的首帧图片" />
        <el-icon v-else :size="36"><Picture /></el-icon>
      </div>
      <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="upload" />
      <el-button native-type="button" :icon="Upload" :loading="uploading" @click="fileInput?.click()">上传并发布图片</el-button>
      <small>图片将发布到公开的 FirewolfO/images 仓库。支持 PNG、JPEG 和 WebP，小于 30 MB。</small>
      <label for="video-image">素材地址</label>
      <el-input id="video-image" v-model="image" clearable placeholder="也可粘贴仓库中已有的图片地址" />
      <el-button v-if="image" text :icon="CopyDocument" native-type="button" @click="copyImage">复制素材地址</el-button>
    </fieldset>
  </form>
</template>

<style scoped>
.studio { display:grid; grid-template-columns:minmax(0, 1.6fr) minmax(270px, 1fr); gap:22px; max-width:1200px; align-items:start; }
.wide { grid-column:1/-1; }
.panel { min-width:0; margin:0; border:1px solid var(--line); border-radius:12px; padding:20px 24px 24px; background:var(--surface); }
legend { font-weight:650; font-size:1.15rem; padding:0 7px; }
label { display:block; font-size:.9rem; font-weight:600; margin-bottom:8px; }
small { color:var(--muted); line-height:1.6; font-size:.85rem; font-weight:400; overflow-wrap:anywhere; }
.settings { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:22px 0; }
.generate { display:flex; align-items:center; justify-content:space-between; gap:12px; border-top:1px solid var(--line); padding-top:20px; }
.material { display:grid; gap:10px; }
.material label { margin:8px 0 0; }
.image-box { background:var(--theme-page-bg); border-radius:8px; display:grid; place-items:center; aspect-ratio:16/9; color:var(--muted); overflow:hidden; }
.image-box img { width:100%; height:100%; min-height:0; object-fit:contain; }
@media (max-width:850px) { .studio { grid-template-columns:1fr; } .panel { padding:16px; } }
</style>
