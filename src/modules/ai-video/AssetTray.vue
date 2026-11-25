<script setup lang="ts">
import { defineAsyncComponent, computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { ArrowLeft, ArrowRight, Close, CopyDocument, Plus, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiMessage } from '@/api/client'
import { copyText } from '@permission/utils/clipboard'
import { videos, type ImageMode } from './api'

const AssetBrowser = defineAsyncComponent(() => import('./AssetBrowser.vue'))
const browsing = ref(false)
const library = ref<InstanceType<typeof AssetBrowser>>()
const props = defineProps<{ urls: string[]; mode: ImageMode | 'auto'; limit: number; disabled: boolean }>()
const emit = defineEmits<{ change: [urls: string[]]; publishing: [active: boolean] }>()
const expanded = ref(false)
let pinned = false
const zone = ref<HTMLElement>()
const shelf = ref<HTMLElement>()
const emptyAdd = ref<HTMLButtonElement>()
const stack = ref<HTMLButtonElement>()
const dialog = ref<HTMLDialogElement>()
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
  if (!pinned && dragging.value === null && !shelf.value?.querySelector(':focus-visible') && !dialog.value?.open) collapse()
}
function outside(e: PointerEvent) {
  if (expanded.value && !zone.value?.contains(e.target as Node) && !dialog.value?.open) collapse()
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
function edit(index: number) {
  if (props.disabled || progress.value) return
  browsing.value = false
  editor.value = index
  link.value = index < 0 ? '' : props.urls[index]
  error.value = ''
  dialog.value?.showModal()
}
function closeDialog() {
  if (!dialog.value?.open) return
  dialog.value.close()
  browsing.value = false
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
    @pointerleave="leave" @mouseleave="leave" @focusout="e => { if (e.relatedTarget && !dialog?.open && !zone?.contains(e.relatedTarget as Node) && !zone?.matches(':hover')) collapse() }">
    <button v-if="!urls.length" ref="emptyAdd" type="button" class="tile add tilted" :disabled="disabled" @click="edit(-1)">
      <el-icon><Plus /></el-icon>素材
    </button>
    <button v-else-if="!expanded" ref="stack" type="button" class="stack" :aria-label="`展开 ${urls.length} 张素材`"
      :disabled="disabled" @click="expandStack">
      <img v-for="(url, i) in urls.slice(-3)" :key="i" :src="rawUrl(url)" alt="" :style="{ '--tilt': (i - Math.min(urls.length - 1, 2)) * 8 + 3 + 'deg' }" />
      <span class="count" aria-hidden="true">{{ canAdd ? '+' : urls.length }}</span>
    </button>
    <div v-else ref="shelf" class="shelf" aria-label="素材顺序" @keydown.esc.prevent="collapse(true)">
      <button type="button" class="tile add" :disabled="disabled || !canAdd" @click="edit(-1)"><el-icon><Plus /></el-icon>素材</button>
      <div v-for="(url, i) in urls" :key="i" class="tile photo" :class="{ target: over === i && dragging !== i }"
        :draggable="!disabled" @dragstart="dragStart($event, i)" @dragover.prevent="over = i" @drop.prevent="drop(i)" @dragend="dragging = over = null">
        <button type="button" class="thumb" :disabled="disabled" :aria-label="'编辑' + name(i)" @click="edit(i)">
          <img :src="rawUrl(url)" :alt="name(i)" draggable="false" /><span>{{ name(i) }}</span>
        </button>
        <button type="button" class="remove-photo" :disabled="disabled" :aria-label="'移除' + name(i)"
          title="从本次创作移除，保留素材库原图" @click="remove(i)"><el-icon><Close /></el-icon></button>
        <div v-if="urls.length > 1" class="arrows">
          <button type="button" :disabled="disabled || i === 0" :aria-label="'前移' + name(i)" @click="move(i, i-1)"><el-icon><ArrowLeft /></el-icon></button>
          <button type="button" :disabled="disabled || i === urls.length-1" :aria-label="'后移' + name(i)" @click="move(i, i+1)"><el-icon><ArrowRight /></el-icon></button>
        </div>
      </div>
      <button type="button" class="fold" @click="collapse(true)" aria-label="收起素材"><el-icon><Close /></el-icon></button>
    </div>
    <dialog ref="dialog" class="asset-dialog" aria-labelledby="asset-dialog-title" @cancel.prevent="!progress && closeDialog()">
      <header><strong id="asset-dialog-title">{{ editor < 0 ? '添加素材' : '编辑' + name(editor) }}</strong>
        <button type="button" :disabled="!!progress" @click="closeDialog" aria-label="关闭素材窗口">×</button></header>
      <input type="file" ref="input" accept="image/png,image/jpeg,image/webp" :multiple="editor < 0 && limit > 1" hidden @change="upload" />
      <button v-if="!browsing" type="button" class="upload" :disabled="!!progress" @click="input?.click()">
        <el-icon><Upload /></el-icon>{{ progress || '选择图片并上传' }}
      </button>
      <p>可直接粘贴截图或图片。粘贴和上传的图片将发布至公开的 FirewolfO/images 仓库。支持 PNG、JPEG、WebP，每张小于 30 MB。</p>
      <button type="button" :disabled="!!progress" :aria-expanded="browsing" @click="browsing = !browsing; error = ''">{{ browsing ? '返回' : '从素材库选择' }}</button>
      <AssetBrowser v-if="browsing" ref="library" picker :pick-limit="editor < 0 ? available : undefined"
        :inert="!!progress" @choose="choose" />
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
.stack { border:0; background:transparent; margin:2px 7px; }
.stack img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:9px; transform:rotate(var(--tilt)); border:1px solid #666; background:#333; }
.count { position:absolute; bottom:-6px; right:-8px; display:grid; place-items:center; min-width:23px; height:23px; border-radius:15px; background:#303035; border:1px solid #777; font-size:12px; }
.shelf { display:flex; gap:8px; align-items:center; overflow-x:auto; padding:2px 2px 6px; scrollbar-width:thin; }
.photo { border:1px solid #4a4a50; overflow:hidden; }
.photo.target { outline:2px solid #b3c7fb; outline-offset:-2px; }
.thumb { border:0; background:#303035; width:100%; height:100%; padding:0; }
.thumb img { display:block; width:100%; height:100%; object-fit:cover; }
.thumb span { position:absolute; top:2px; left:3px; color:white; background:#161619bb; border-radius:3px; padding:1px 3px; font-size:11px; }
.remove-photo { position:absolute; top:2px; right:2px; display:grid; place-items:center; width:24px; height:24px; padding:0; background:#161619db; color:white; border:0; border-radius:50%; }
.arrows { position:absolute; bottom:0; inset-inline:0; display:flex; justify-content:space-between; pointer-events:none; }
.arrows button,.fold { display:grid; place-items:center; background:#161619d9; border:0; border-radius:5px; width:24px; height:23px; pointer-events:auto; }
.fold { flex:none; align-self:flex-start; }
.asset-dialog { color:#ededf2; background:#212124; border:1px solid #525259; border-radius:14px; padding:22px; width:min(430px,92vw); box-shadow:0 24px 80px #0006; }
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
