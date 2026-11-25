<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { CopyDocument, Delete, Folder, FolderAdd, Refresh, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiMessage } from '@/api/client'
import { copyText } from '@permission/utils/clipboard'
import { videos, type AssetItem } from './api'

const AssetBatchDialog = defineAsyncComponent(() => import('./AssetBatchDialog.vue'))
const batchMode = ref(false)
const checked = ref(new Map<string, AssetItem>())
const selection = computed(() => [...checked.value.values()])
const batchAction = ref<'move' | 'delete' | null>(null)
const props = defineProps<{ picker?: boolean }>()
const emit = defineEmits<{ choose: [url: string] }>()
const directory = ref('')
const items = ref<AssetItem[]>([])
const crumbs = computed(() => directory.value ? directory.value.split('/') : [])
const error = ref('')
const loading = ref(false)
const writing = ref(false)
const input = ref<HTMLInputElement>()
const images = computed(() => items.value.filter(item => item.kind === 'image'))
const checkedHere = computed(() => images.value.filter(item => checked.value.has(item.path)).length)
const readOnly = computed(() => selection.value.some(item => !item.canDelete))
let generation = 0

function select(item: AssetItem, value: boolean) {
  if (value) checked.value.set(item.path, item)
  else checked.value.delete(item.path)
}
function toggleMode() {
  checked.value.clear()
  batchMode.value = !batchMode.value
}
async function batchDone(count: number) {
  ElMessage.success(`已${batchAction.value === 'move' ? '移动' : '删除'} ${count} 张图片`)
  checked.value.clear()
  batchAction.value = null
  await open(directory.value)
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
    const latest = new Map(images.value.map(item => [item.path, item]))
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
    inputPattern: /^[^.\/\\\x00-\x1f][^\/\\\x00-\x1f]*$/, inputErrorMessage: '请输入有效的单个目录名',
  }).catch(() => null)
  if (result) await write(() => videos.createFolder(directory.value, result.value.trim()), '已创建目录')
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
      <label class="select-all"><input type="checkbox" :checked="!!images.length && checkedHere === images.length"
        :indeterminate="checkedHere > 0 && checkedHere < images.length" :disabled="loading || writing || !images.length"
        @change="e => images.forEach(i => select(i, (e.target as HTMLInputElement).checked))" />全选当前目录</label>
      <span aria-live="polite">已选 {{ checked.size }} 张</span>
      <button type="button" :disabled="writing || !checked.size" @click="copy(selection.map(i => i.url).join('\n'))">复制所选地址</button>
      <button type="button" :disabled="writing || !checked.size || readOnly" @click="batchAction = 'move'">批量移动</button>
      <button type="button" :disabled="writing || !checked.size || readOnly" @click="batchAction = 'delete'">批量删除</button>
      <button type="button" :disabled="writing || !checked.size" @click="checked.clear()">清空选择</button>
      <span v-if="readOnly">所选图片中包含仅可复制的素材</span>
    </div>
    <AssetBatchDialog v-if="batchAction" :action="batchAction" :selection="selection" @close="batchAction = null" @done="batchDone" />
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="loading || writing" role="status">{{ writing ? '正在同步到 images 仓库…' : '正在读取目录…' }}</p>
    <p v-else-if="!items.length && !error">此目录暂无素材</p>
    <div class="grid">
      <article v-for="item in items" :key="item.path" class="asset" :class="{ checked: checked.has(item.path) }">
        <button v-if="item.kind === 'folder'" type="button" class="folder" :disabled="writing" @click="open(item.path)">
          <el-icon><Folder /></el-icon><span>{{ item.name }}</span>
        </button>
        <template v-else-if="item.url">
          <button v-if="picker" type="button" class="pick" :aria-label="'选用 ' + item.name" @click="emit('choose',item.url)">
            <img :src="item.url" alt="" loading="lazy" decoding="async" /><span>{{ item.name }}</span>
          </button>
          <label v-else-if="batchMode" class="select-card">
            <input type="checkbox" :checked="checked.has(item.path)" :aria-label="'选择 ' + item.name" :disabled="writing"
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
.folder { display:flex; align-items:center; padding:12px; }
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
