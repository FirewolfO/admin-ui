<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { CopyDocument, Delete, EditPen, Folder, FolderAdd, Refresh, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiMessage } from '@/api/client'
import { copyText } from '@permission/utils/clipboard'
import { videos, type AssetItem } from './api'

const AssetBatchDialog = defineAsyncComponent(() => import('./AssetBatchDialog.vue'))
const batchMode = ref(false)
const checked = ref(new Map<string, AssetItem>())
const selection = computed(() => [...checked.value.values()])
const command = ref<{ action: 'move' | 'delete'; items: AssetItem[] } | null>(null)
const folderNamePattern = /^[^.\/\\\x00-\x1f][^\/\\\x00-\x1f]*$/
const props = defineProps<{ picker?: boolean }>()
const emit = defineEmits<{ choose: [url: string] }>()
const directory = ref('')
const items = ref<AssetItem[]>([])
const crumbs = computed(() => directory.value ? directory.value.split('/') : [])
const error = ref('')
const loading = ref(false)
const writing = ref(false)
const input = ref<HTMLInputElement>()
const folderCount = computed(() => selection.value.filter(item => item.kind === 'folder').length)
const imageCount = computed(() => checked.value.size - folderCount.value)
const selectionLabel = computed(() => {
  if (!folderCount.value) return `${imageCount.value} 张`
  const folders = `${folderCount.value} 个文件夹`
  return imageCount.value ? `${folders}、${imageCount.value} 张图片` : folders
})
const selectedFolders = computed(() => new Set(selection.value.filter(item => item.kind === 'folder').map(item => item.path)))
function includedByFolder(path: string) {
  let index = path.indexOf('/')
  while (index >= 0) {
    if (selectedFolders.value.has(path.slice(0, index))) return true
    index = path.indexOf('/', index + 1)
  }
  return false
}
const selectable = computed(() => items.value.filter(item => (item.canDelete || item.kind === 'image') && !includedByFolder(item.path)))
const checkedHere = computed(() => selectable.value.filter(item => checked.value.has(item.path)).length)
const readOnly = computed(() => selection.value.some(item => !item.canDelete))
let generation = 0

function select(item: AssetItem, value: boolean) {
  if (!value) { checked.value.delete(item.path); return }
  if (includedByFolder(item.path)) return
  if (item.kind === 'folder') {
    for (const path of checked.value.keys()) {
      if (path.startsWith(item.path + '/')) checked.value.delete(path)
    }
  }
  checked.value.set(item.path, item)
}
function toggleMode() {
  checked.value.clear()
  batchMode.value = !batchMode.value
}
async function batchDone(count: number) {
  const completed = command.value
  if (!completed) return
  const folder = completed.items.find(item => item.kind === 'folder' &&
    (directory.value === item.path || directory.value.startsWith(item.path + '/')))
  ElMessage.success(`已${completed.action === 'move' ? '移动' : '删除'} ${count} 项`)
  command.value = null
  checked.value.clear()
  await open(folder ? folder.path.split('/').slice(0, -1).join('/') : directory.value)
}

async function open(path: string, refresh = false) {
  const current = ++generation
  directory.value = path
  items.value = []
  error.value = ''
  loading.value = true
  try {
    const result = await videos.assets(path, refresh)
    if (generation !== current) return
    items.value = result.items
    const latest = new Map(items.value.map(item => [item.path, item]))
    for (const old of checked.value.values()) {
      if (old.path.split('/').slice(0,-1).join('/') !== path) continue
      const item = latest.get(old.path)
      if (item && item.sha === old.sha) checked.value.set(old.path, item)
      else checked.value.delete(old.path)
    }
  } catch (e) { if (generation === current) error.value = apiMessage(e, '素材加载失败') }
  finally { if (generation === current) loading.value = false }
}
onMounted(() => void open(''))

async function write(op: () => Promise<unknown>, message: string) {
  if (writing.value) return
  writing.value = true
  error.value = ''
  try {
    await op()
    ElMessage.success(message)
    await open(directory.value)
  } catch (e) {
    const message = apiMessage(e, '素材操作失败')
    await open(directory.value)
    error.value = message
  } finally { writing.value = false }
}
async function createFolder() {
  const result = await ElMessageBox.prompt('目录将建在 ' + (directory.value || '素材库根目录'), '新建目录', {
    confirmButtonText: '创建', cancelButtonText: '取消', inputPlaceholder: '目录名称',
    inputPattern: folderNamePattern, inputErrorMessage: '请输入有效的单个目录名',
  }).catch(() => null)
  if (result) await write(() => videos.createFolder(directory.value, result.value.trim()), '已创建目录')
}
async function renameFolder(item: AssetItem) {
  const result = await ElMessageBox.prompt(item.path, '重命名文件夹', {
    inputValue: item.name, inputPlaceholder: '新文件夹名称', confirmButtonText: '确认重命名', cancelButtonText: '取消',
    inputValidator: (value: string) => {
      const name = (value || '').trim()
      if (name === item.name) return '请输入新的文件夹名称'
      return folderNamePattern.test(name) || '请输入有效的单个文件夹名称'
    },
  }).catch(() => null)
  if (result) await write(() => videos.renameFolder(item, result.value.trim()), '文件夹已重命名')
}
async function remove(item: AssetItem) {
  const confirmed = await ElMessageBox.confirm(
    `从 images 仓库的当前版本删除「${item.path}」？`, '删除图片',
    { type: 'warning', confirmButtonText: '删除图片', cancelButtonText: '取消' },
  ).then(() => true, () => false)
  if (confirmed) await write(() => videos.deleteImage(item), '已删除图片')
}
async function upload(event: Event) {
  const element = event.target as HTMLInputElement
  const files = Array.from(element.files || [])
  element.value = ''
  if (!files.length) return
  let count = 0
  await write(async () => {
    try {
      for (const file of files) { await videos.upload(file, directory.value); count++ }
    } catch (e) { throw new Error((count ? `已上传 ${count} 张。` : '') + apiMessage(e, '上传失败')) }
  }, '已上传图片')
}
async function copy(url: string) {
  try { await copyText(url); ElMessage.success('已复制图片地址') }
  catch { ElMessage.error('复制失败，可打开原图复制地址') }
}
</script>
<template>
  <section class="assets" :class="{ picker: props.picker }" aria-label="素材库">
    <div class="bar">
      <nav aria-label="素材目录">
        <button type="button" :disabled="writing" @click="open('')">素材库</button>
        <template v-for="(part, i) in crumbs" :key="i"><span>/</span>
          <button type="button" :disabled="writing" @click="open(crumbs.slice(0,i+1).join('/'))">{{ part }}</button>
        </template>
      </nav>
      <div class="tools">
        <button v-if="!picker" type="button" :aria-pressed="batchMode" :disabled="writing" @click="toggleMode">{{ batchMode ? '退出批量管理' : '批量管理' }}</button>
        <button v-if="!picker" type="button" :disabled="loading || writing" @click="createFolder"><el-icon><FolderAdd /></el-icon>新建目录</button>
        <button v-if="!picker" type="button" :disabled="loading || writing" @click="input?.click()"><el-icon><Upload /></el-icon>上传图片</button>
        <button type="button" aria-label="刷新素材" :disabled="loading || writing" @click="open(directory,true)"><el-icon><Refresh /></el-icon></button>
        <input ref="input" type="file" hidden multiple accept="image/jpeg,image/png,image/webp" @change="upload" />
      </div>
    </div>
    <div v-if="batchMode" class="batch">
      <label class="select-all"><input type="checkbox" :checked="!!selectable.length && checkedHere === selectable.length"
        :indeterminate="checkedHere > 0 && checkedHere < selectable.length" :disabled="loading || writing || !selectable.length"
        @change="e => selectable.forEach(i => select(i, (e.target as HTMLInputElement).checked))" />全选当前目录</label>
      <span aria-live="polite">已选 {{ selectionLabel }}</span>
      <button type="button" :disabled="writing || !checked.size || !!folderCount" @click="copy(selection.map(i => i.url).join('\n'))">复制所选地址</button>
      <button type="button" :disabled="writing || !checked.size || readOnly" @click="command = { action: 'move', items: selection }">批量移动</button>
      <button type="button" :disabled="writing || !checked.size || readOnly" @click="command = { action: 'delete', items: selection }">批量删除</button>
      <button type="button" :disabled="writing || !checked.size" @click="checked.clear()">清空选择</button>
      <span v-if="readOnly">部分所选素材没有管理权限</span>
    </div>
    <AssetBatchDialog v-if="command" :action="command.action" :selection="command.items" @close="command = null" @done="batchDone" />
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="loading || writing" role="status">{{ writing ? '正在同步到 images 仓库…' : '正在读取目录…' }}</p>
    <p v-else-if="!items.length && !error">此目录暂无素材</p>
    <div class="grid">
      <article v-for="item in items" :key="item.path" class="asset" :class="{ checked: checked.has(item.path) }">
        <template v-if="item.kind === 'folder'">
          <div class="folder-head">
            <input v-if="batchMode" type="checkbox" :aria-label="'选择文件夹 ' + item.name"
              :disabled="writing || !item.canDelete || includedByFolder(item.path)"
              :checked="checked.has(item.path) || includedByFolder(item.path)" @change="select(item, ($event.target as HTMLInputElement).checked)" />
            <button type="button" class="folder" :disabled="writing" @click="open(item.path)">
              <el-icon><Folder /></el-icon><span>{{ item.name }}</span>
            </button>
          </div>
          <div v-if="!picker && !batchMode && item.canDelete" class="row">
            <button type="button" :disabled="writing" :aria-label="'重命名文件夹 ' + item.name" @click="renameFolder(item)"><el-icon><EditPen /></el-icon>重命名</button>
            <button type="button" :disabled="writing" :aria-label="'删除文件夹 ' + item.name" @click="command = { action: 'delete', items: [item] }"><el-icon><Delete /></el-icon>删除</button>
          </div>
        </template>
        <template v-else-if="item.url">
          <button v-if="picker" type="button" class="pick" :aria-label="'选用 ' + item.name" @click="emit('choose',item.url)">
            <img :src="item.url" alt="" loading="lazy" decoding="async" /><span>{{ item.name }}</span>
          </button>
          <label v-else-if="batchMode" class="select-card">
            <input type="checkbox" :checked="checked.has(item.path) || includedByFolder(item.path)" :aria-label="'选择 ' + item.name" :disabled="writing || includedByFolder(item.path)"
              @change="select(item, ($event.target as HTMLInputElement).checked)" />
            <img :src="item.url" alt="" loading="lazy" decoding="async" /><span>{{ item.name }}</span>
          </label>
          <template v-else>
            <a :href="item.url" target="_blank" rel="noopener noreferrer" :aria-label="'查看原图 ' + item.name">
              <img :src="item.url" alt="" loading="lazy" decoding="async" /><span>{{ item.name }}</span>
            </a>
            <div class="row">
              <button type="button" :disabled="writing" @click="copy(item.url)"><el-icon><CopyDocument /></el-icon>复制地址</button>
              <button v-if="item.canDelete" type="button" :disabled="writing" :aria-label="'删除 ' + item.name" @click="remove(item)"><el-icon><Delete /></el-icon>删除</button>
            </div>
          </template>
        </template>
      </article>
    </div>
  </section>
</template>
<style scoped>
.assets { display:grid; gap:16px; color:var(--text,inherit); }
.bar,.tools,nav,.row,.batch,.select-all { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.bar { justify-content:space-between; }
.assets button,.asset a { font:inherit; color:inherit; cursor:pointer; }
.bar button,.row button,.batch button { display:inline-flex; align-items:center; gap:5px; padding:7px 10px; border-radius:7px; background:transparent; border:1px solid var(--line,#626268); }
nav button { padding:4px; border:0; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(165px,100%),1fr)); align-items:start; gap:12px; }
.asset { min-width:0; overflow:hidden; border-radius:9px; border:1px solid var(--line,#626268); background:var(--surface,transparent); }
.asset a,.pick,.folder { display:block; width:100%; padding:0; border:0; text-align:left; background:none; text-decoration:none; }
.asset img { display:block; width:100%; height:110px; object-fit:contain; background:#19191b; }
.asset span { display:block; padding:8px; overflow-wrap:anywhere; font-size:13px; }
.folder-head { display:flex; align-items:center; }
.folder-head input { flex:none; width:20px; height:20px; margin-left:8px; }
.folder { min-width:0; display:flex; align-items:center; padding:12px; }
.folder .el-icon { font-size:24px; }
.row { padding:0 8px 8px; }
.row button { font-size:12px; padding:4px 7px; }
button:disabled { opacity:.5; cursor:default; }
[role=alert] { color:var(--el-color-danger); }
.batch { padding:10px; border-block:1px solid var(--line); }
.select-card { position:relative; display:block; cursor:pointer; }
.select-card input { position:absolute; top:8px; left:8px; width:20px; height:20px; margin:0; }
.asset.checked { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.picker { max-height:45vh; overflow:auto; color:inherit; }
.picker .grid { grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); }
.picker .asset { background:transparent; }
.picker img { height:75px; }
</style>
