<script setup lang="ts">
import { defineAsyncComponent, computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { ArrowLeft, ArrowRight, Close, CopyDocument, Plus, Upload, UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiMessage } from '@/api/client'
import { copyText } from '@permission/utils/clipboard'
import PortraitPicker from './PortraitPicker.vue'
import { portraitCover, videos, type ImageMode, type Portrait } from './api'

const AssetBrowser = defineAsyncComponent(() => import('./AssetBrowser.vue'))
const browsing = ref<'' | 'images' | 'portraits'>('')
const library = ref<InstanceType<typeof AssetBrowser>>()
const props = defineProps<{ urls: string[]; mode: ImageMode | 'auto'; limit: number; disabled: boolean; portraits: Portrait[]; canUsePortraits: boolean }>()
const emit = defineEmits<{ change: [urls: string[]]; added: [portrait: Portrait]; publishing: [active: boolean] }>()
const expanded = ref(false)
let pinned = false
const zone = ref<HTMLElement>()
const shelf = ref<HTMLElement>()
const emptyAdd = ref<HTMLButtonElement>()
const stack = ref<HTMLButtonElement>()
const dialog = ref<HTMLDialogElement>()
const previewIndex = ref<number | null>(null)
const byUri = computed(() => new Map(props.portraits.map(p => ['asset://' + p.id, p])))
const previewUrls = computed(() => props.urls.map(url => {
  const portrait = byUri.value.get(url)
  return portrait ? portraitCover(portrait) : rawUrl(url)
}))
const input = ref<HTMLInputElement>()
const editor = ref(-1)
const link = ref('')
const error = ref('')
const progress = ref('')
const dragging = ref<number | null>(null)
const over = ref<number | null>(null)
const canAdd = computed(() => props.urls.length < props.limit)
const available = computed(() => editor.value >= 0 ? 1 : Math.max(0, props.limit - props.urls.length))
const name = (i: number) => props.mode === 'frames' ? (i === 0 ? '首帧' : '尾帧') : props.mode === 'first' ? '首帧' : `图 ${i + 1}`

function rawUrl(value: string) {
  try {
    const u = new URL(value.trim())
    if (u.origin === 'https://github.com') {
      const match = u.pathname.match(/^\/FirewolfO\/images\/(?:blob|raw)\/(.+\/.+)$/)
      if (match) return 'https://raw.githubusercontent.com/FirewolfO/images/' + match[1]
    }
    if (u.origin === 'https://raw.githubusercontent.com' && /^\/FirewolfO\/images\/.+\/.+/.test(u.pathname)) return u.origin + u.pathname
  } catch { /* An incomplete address is validated when saved. */ }
  return ''
}
function showPhoto(index: number) {
  if (previewUrls.value[index]) previewIndex.value = index
  else edit(index)
}
function expandStack(e: MouseEvent) {
  pinned = true
  expanded.value = true
  if (e.detail === 0) nextTick(() => shelf.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus())
}
function collapse(focus = false) {
  pinned = false
  expanded.value = false
  if (focus) nextTick(() => stack.value?.focus())
}
function leave() {
  if (previewIndex.value === null && !pinned && dragging.value === null && !shelf.value?.querySelector(':focus-visible') && !dialog.value?.open) collapse()
}
function outside(e: PointerEvent) {
  if (previewIndex.value === null && expanded.value && !zone.value?.contains(e.target as Node) && !dialog.value?.open) collapse()
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
async function replacePreview() {
  const index = previewIndex.value
  if (index === null) return
  previewIndex.value = null
  await nextTick()
  edit(index)
}
function edit(index: number) {
  if (props.disabled || progress.value) return
  browsing.value = ''
  editor.value = index
  link.value = index < 0 ? '' : props.urls[index]
  if (props.canUsePortraits && link.value.startsWith('asset://')) browsing.value = 'portraits'
  error.value = ''
  dialog.value?.showModal()
}
function closeDialog() {
  if (!dialog.value?.open) return
  dialog.value.close()
  browsing.value = ''
  collapse()
}
function save(values: string[]) {
  const next = props.urls.slice()
  if (editor.value < 0) next.push(...values)
  else next.splice(editor.value, 1, ...values)
  emit('change', next)
}
function choose(urls: string[]) {
  if (props.disabled || progress.value || !urls.length) return
  if (urls.length > available.value) {
    error.value = editor.value >= 0 ? '替换素材时请选择一张图片' : `本次最多可选 ${available.value} 张图片`
    return
  }
  save(urls)
  closeDialog()
}
function saveLink() {
  const lines = link.value.trim().split(/\r?\n/).map(s => rawUrl(s))
  if (!lines.every(Boolean)) { error.value = '请填写 FirewolfO/images 中的图片地址，每行一个。'; return }
  choose(lines)
}
async function upload(event: Event) {
  const fileInput = event.target as HTMLInputElement
  const files = Array.from(fileInput.files ?? [])
  fileInput.value = ''
  await publishFiles(files)
}
async function publishFiles(files: File[]) {
  if (!files.length || props.disabled || progress.value) return
  const pending = library.value?.pendingCount ?? 0
  if (files.length + pending > available.value) {
    error.value = editor.value >= 0 ? '替换素材时请选择一张图片' :
      `当前最多使用 ${props.limit} 张图片，还可添加 ${Math.max(0, available.value - pending)} 张`
    return
  }
  if (files.some(f => f.size >= 30_000_000)) { error.value = '每张图片须小于 30 MB'; return }
  error.value = ''
  const published: string[] = []
  emit('publishing', true)
  try {
    for (const file of files) {
      progress.value = `发布中 ${published.length + 1}/${files.length}`
      published.push(await videos.upload(file))
    }
  } catch (e) {
    error.value = (published.length ? `已添加 ${published.length} 张。` : '') + apiMessage(e, '图片上传失败')
  } finally {
    if (published.length) save(published)
    progress.value = ''
    emit('publishing', false)
  }
  if (published.length === files.length && !pending) {
    await nextTick()
    closeDialog()
  }
}
function paste(event: ClipboardEvent) {
  if (browsing.value === 'portraits') return
  const data = event.clipboardData
  if (!data || event.defaultPrevented || props.disabled || progress.value) return
  // Browsers expose screenshots and copied files via either list, often via both.
  const files = Array.from(data.files ?? []).filter(file => file.type.startsWith('image/') ||
    (!file.type && /\.(png|jpe?g|webp)$/i.test(file.name)))
  if (!files.length) {
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (!files.length) return
  event.preventDefault()
  if (!dialog.value?.open) edit(-1)
  void publishFiles(files)
}
defineExpose({ paste })

function move(from: number, to: number) {
  if (props.disabled || from === to || to < 0 || to >= props.urls.length) return
  const next = props.urls.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  emit('change', next)
}
function dragStart(e: DragEvent, index: number) {
  if (!e.dataTransfer || props.disabled) return
  dragging.value = index
  e.dataTransfer.setData('text/plain', String(index))
  e.dataTransfer.effectAllowed = 'move'
}
function drop(index: number) {
  if (dragging.value !== null) move(dragging.value, index)
  dragging.value = over.value = null
}
function remove(index: number) {
  if (props.disabled || progress.value || index < 0 || index >= props.urls.length) return
  const focusShelf = shelf.value?.contains(document.activeElement)
  const remaining = props.urls.filter((_, i) => i !== index)
  emit('change', remaining)
  closeDialog()
  if (!remaining.length) collapse()
  if (focusShelf) nextTick(() => {
    const buttons = shelf.value?.querySelectorAll<HTMLButtonElement>('.remove-photo')
    const next = buttons?.[Math.min(index, remaining.length - 1)] ?? emptyAdd.value
    next?.focus({ preventScroll: true })
  })
}
async function copy() {
  try { await copyText(props.urls[editor.value]); ElMessage.success('已复制素材地址') }
  catch { error.value = '请在地址栏中手动复制' }
}
</script>
<template>
  <div ref="zone" class="asset-zone" :class="{ spread: expanded && urls.length }"
    @pointerenter="e => { if (e.pointerType === 'mouse' && urls.length && !disabled) expanded = true }"
    @pointerleave="leave" @mouseleave="leave" @focusout="e => { if (previewIndex === null && e.relatedTarget && !dialog?.open && !zone?.contains(e.relatedTarget as Node) && !zone?.matches(':hover')) collapse() }">
    <button v-if="!urls.length" ref="emptyAdd" type="button" class="tile add tilted" :disabled="disabled" @click="edit(-1)">
      <el-icon><Plus /></el-icon>素材
    </button>
    <div v-else-if="!expanded" class="stack">
      <button ref="stack" type="button" class="stack-photo" :disabled="disabled" :aria-label="'放大查看' + name(0)" @click="showPhoto(0)">
        <template v-for="(url, i) in urls.slice(0, 3)" :key="i">
          <img v-if="previewUrls[i]" :src="previewUrls[i]" :alt="byUri.get(url)?.name || ''"
            :style="{ '--tilt': 3 - i * 8 + 'deg', zIndex: 3 - i }" />
          <span v-else class="stack-fallback" :style="{ zIndex: 3 - i }">{{ byUri.get(url)?.name || name(i) }}</span>
        </template>
      </button>
      <button type="button" class="count" :aria-label="`展开 ${urls.length} 张素材`" :disabled="disabled" @click="expandStack">{{ canAdd ? '+' : urls.length }}</button>
    </div>
    <div v-else ref="shelf" class="shelf" aria-label="素材顺序" @keydown.esc.prevent="collapse(true)">
      <div class="photo-list">
        <div v-for="(url, i) in urls" :key="i" class="tile photo" :class="{ target: over === i && dragging !== i }"
          :draggable="!disabled" @dragstart="dragStart($event, i)" @dragover.prevent="over = i" @drop.prevent="drop(i)" @dragend="dragging = over = null">
          <button type="button" class="thumb" :disabled="disabled" :aria-label="'放大查看' + name(i)" @click="showPhoto(i)">
            <img v-if="previewUrls[i]" :src="previewUrls[i]" :alt="byUri.get(url)?.name || name(i)" draggable="false" /><small v-else>{{ byUri.get(url)?.name || '人像' }}</small><span>{{ name(i) }}</span>
          </button>
          <button type="button" class="remove-photo" :disabled="disabled" :aria-label="'移除' + name(i)"
            title="从本次创作移除，保留素材库原图" @click="remove(i)"><el-icon><Close /></el-icon></button>
          <div v-if="urls.length > 1" class="arrows">
            <button type="button" :disabled="disabled || i === 0" :aria-label="'前移' + name(i)" @click="move(i, i-1)"><el-icon><ArrowLeft /></el-icon></button>
            <button type="button" :disabled="disabled || i === urls.length-1" :aria-label="'后移' + name(i)" @click="move(i, i+1)"><el-icon><ArrowRight /></el-icon></button>
          </div>
        </div>
      </div>
      <button type="button" class="tile add" :disabled="disabled || !canAdd" @click="edit(-1)"><el-icon><Plus /></el-icon>素材</button>
      <button type="button" class="fold" @click="collapse(true)" aria-label="收起素材"><el-icon><Close /></el-icon></button>
    </div>
    <el-image-viewer v-if="previewIndex !== null" teleported hide-on-click-modal
      :url-list="previewUrls" :initial-index="previewIndex" :show-progress="urls.length > 1"
      @switch="previewIndex = $event" @close="previewIndex = null">
      <button type="button" class="replace-preview" :disabled="disabled" @click="replacePreview">替换素材</button>
      <template #viewer-error><span class="preview-error" role="alert">{{ byUri.get(urls[previewIndex])?.name || '图片加载失败' }}</span></template>
    </el-image-viewer>
    <dialog ref="dialog" class="asset-dialog" aria-labelledby="asset-dialog-title" @cancel.prevent="!progress && closeDialog()">
      <header><strong id="asset-dialog-title">{{ editor < 0 ? '添加素材' : '编辑' + name(editor) }}</strong>
        <button type="button" :disabled="!!progress" @click="closeDialog" aria-label="关闭素材窗口">×</button></header>
      <input type="file" ref="input" accept="image/png,image/jpeg,image/webp" :multiple="editor < 0 && limit > 1" hidden @change="upload" />
      <button v-if="!browsing" type="button" class="upload" :disabled="!!progress" @click="input?.click()">
        <el-icon><Upload /></el-icon>{{ progress || '选择图片并上传' }}
      </button>
      <p v-if="!browsing">可直接粘贴截图或图片。粘贴和上传的图片将发布至公开的 FirewolfO/images 仓库。支持 PNG、JPEG、WebP，每张小于 30 MB。</p>
      <div class="sources">
        <button v-if="!browsing" type="button" :disabled="!!progress" @click="browsing = 'images'; error = ''">从素材库选择</button>
        <button v-if="!browsing && canUsePortraits" type="button" :disabled="!!progress" @click="browsing = 'portraits'; error = ''"><el-icon><UserFilled /></el-icon>预置虚拟人像</button>
        <button v-if="browsing" type="button" :disabled="!!progress" @click="browsing = ''; error = ''">返回</button>
      </div>
      <AssetBrowser v-if="browsing === 'images'" ref="library" picker :pick-limit="editor < 0 ? available : undefined"
        :inert="!!progress" @choose="choose" />
      <PortraitPicker v-if="browsing === 'portraits'" :portraits="portraits" @added="emit('added', $event)" @choose="choose" />
      <p v-if="browsing && progress" role="status">{{ progress }}</p>
      <template v-if="!browsing">
        <label for="asset-links">仓库图片地址</label>
        <textarea id="asset-links" v-model="link" :disabled="!!progress" rows="3" placeholder="粘贴已有图片地址，每行一个" />
      </template>
      <p v-if="error" role="alert">{{ error }}</p>
      <footer v-if="!browsing">
        <button v-if="editor >= 0" type="button" :disabled="!!progress" @click="copy"><el-icon><CopyDocument /></el-icon>复制</button>
        <button v-if="editor >= 0" type="button" :disabled="!!progress" title="保留素材库原图" @click="remove(editor)">从本次创作移除</button>
        <button type="button" class="save" :disabled="!!progress || !link.trim()" @click="saveLink">使用地址</button>
      </footer>
    </dialog>
  </div>
</template>
<style scoped>
.asset-zone { flex:none; max-width:100%; align-self:flex-start; padding:5px; }
.asset-zone.spread { flex:1 0 100%; min-width:0; }
.tile,.stack { width:76px; height:76px; position:relative; flex:none; border-radius:10px; }
button { color:inherit; font:inherit; cursor:pointer; }
button:disabled { opacity:.45; cursor:default; }
.add { display:grid; align-content:center; justify-items:center; gap:4px; color:#dedee3; background:#262628; border:1px dashed #66666c; font-size:13px; }
.add .el-icon { font-size:20px; }
.tilted { transform:rotate(-5deg); margin:2px 6px; }
.stack { margin:2px 7px; }
.stack-photo { position:absolute; inset:0; padding:0; border:0; border-radius:inherit; background:transparent; isolation:isolate; cursor:zoom-in; }
.stack img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:9px; transform:rotate(var(--tilt)); border:1px solid #666; background:#333; }
.count { position:absolute; bottom:-6px; right:-8px; display:grid; place-items:center; min-width:26px; height:26px; border-radius:15px; background:#303035; border:1px solid #777; font-size:12px; }
.shelf { display:flex; gap:8px; align-items:flex-start; padding:2px 2px 6px; }
.photo-list { display:flex; min-width:0; gap:8px; overflow-x:auto; scrollbar-width:thin; }
.photo { border:1px solid #4a4a50; overflow:hidden; }
.photo.target { outline:2px solid #b3c7fb; outline-offset:-2px; }
.thumb { border:0; background:#303035; width:100%; height:100%; padding:0; cursor:zoom-in; }
.thumb img { display:block; width:100%; height:100%; object-fit:cover; }
.thumb span { position:absolute; top:2px; left:3px; color:white; background:#161619bb; border-radius:3px; padding:1px 3px; font-size:11px; }
.remove-photo { position:absolute; top:2px; right:2px; display:grid; place-items:center; width:24px; height:24px; padding:0; background:#161619db; color:white; border:0; border-radius:50%; }
.arrows { position:absolute; bottom:0; inset-inline:0; display:flex; justify-content:space-between; pointer-events:none; }
.arrows button,.fold { display:grid; place-items:center; background:#161619d9; border:0; border-radius:5px; width:24px; height:23px; pointer-events:auto; }
.fold { flex:none; align-self:flex-start; }
.replace-preview { position:absolute; top:40px; left:24px; z-index:1; min-height:44px; padding:0 16px; border:1px solid #777; border-radius:22px; background:#28282c; color:white; }
.preview-error { position:relative; border-radius:8px; padding:10px 16px; background:#28282c; color:white; }
.asset-dialog { color:#ededf2; background:#212124; border:1px solid #525259; border-radius:14px; padding:22px; width:min(430px,92vw); box-shadow:0 24px 80px #0006; }
.sources { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
.stack-fallback { position:absolute; inset:0; display:grid; place-content:center; width:100%; height:100%; background:#303034; border-radius:9px; }
.asset-dialog::backdrop { background:#0009; }
.asset-dialog header,.asset-dialog footer { display:flex; align-items:center; gap:8px; }
.asset-dialog header { justify-content:space-between; margin-bottom:18px; }
.asset-dialog button { border:1px solid #515156; border-radius:8px; background:#303034; padding:6px 11px; display:inline-flex; align-items:center; gap:5px; }
.asset-dialog .upload { width:100%; justify-content:center; min-height:56px; border-style:dashed; }
.asset-dialog p { font-size:13px; color:#bdbdc4; line-height:1.6; }
.asset-dialog [role=alert] { color:#ffb3ae; }
.asset-dialog textarea { display:block; width:100%; background:#19191b; border:1px solid #555; border-radius:7px; color:inherit; padding:8px; margin:6px 0 12px; font:inherit; }
.asset-dialog .save { margin-left:auto; background:#e1e5ee; color:#14161b; }
</style>
