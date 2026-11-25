<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiMessage } from '@/api/client'
import { videos, type AssetItem } from './api'

const props = defineProps<{ action: 'move' | 'delete'; selection: AssetItem[] }>()
const emit = defineEmits<{ close: []; done: [count: number] }>()
const folders = ref<string[]>([])
const destination = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const moving = computed(() => props.action === 'move')
const selectedFolders = computed(() => props.selection.filter(item => item.kind === 'folder'))
const noun = computed(() => !selectedFolders.value.length ? '图片' :
  selectedFolders.value.length === props.selection.length ? '文件夹' : '素材')
const fileCount = computed(() => props.selection.reduce((count, item) => count + (item.fileCount ?? 1), 0))
function insideSelection(dir: string) {
  return selectedFolders.value.some(item => item.path === dir || dir.startsWith(item.path + '/'))
}
const sources = computed(() => props.selection.map(i => i.path.split('/').slice(0, -1).join('/')))
const alreadyThere = computed(() => sources.value.filter(dir => dir === destination.value).length)
const ready = computed(() => props.selection.length && !saving.value &&
  (!moving.value || (!loading.value && destination.value !== null && !insideSelection(destination.value) && alreadyThere.value < props.selection.length)))

async function loadFolders() {
  loading.value = true
  error.value = ''
  try { folders.value = await videos.folders() }
  catch (e) { error.value = apiMessage(e, '目录加载失败') }
  finally { loading.value = false }
}
onMounted(() => { if (moving.value) void loadFolders() })

async function submit() {
  if (!ready.value) return
  saving.value = true
  error.value = ''
  try {
    const count = await videos.batchAssets(props.action, props.selection, destination.value)
    emit('done', count)
  } catch (e) { error.value = apiMessage(e, '素材操作失败') }
  finally { saving.value = false }
}
</script>
<template>
  <el-dialog :model-value="true" :title="(moving ? '移动' : '删除') + noun" width="min(480px, 94vw)"
    :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @close="emit('close')">
    <p v-if="selectedFolders.length">{{ moving ? '移动' : '从 images 仓库删除' }}所选的 {{ selection.length }} 项，含 {{ selectedFolders.length }} 个文件夹，共 {{ fileCount }} 个文件。所有子目录都会一并{{ moving ? '移动' : '删除' }}。</p>
    <p v-else>{{ moving ? '移动所选的 ' : '从 images 仓库删除所选的 ' }}{{ selection.length }} 张图片{{ moving ? '到目标目录。' : '？' }}</p>
    <ul class="files"><li v-for="item in selection" :key="item.path">{{ item.path }}<span v-if="item.kind === 'folder'">（{{ item.fileCount }} 个文件）</span></li></ul>
    <label v-if="moving" class="target">目标目录
      <select v-model="destination" :disabled="loading || saving">
        <option :value="null" disabled>{{ loading ? '正在读取目录…' : '请选择目标目录' }}</option>
        <option v-for="dir in folders" :key="dir" :value="dir" :disabled="insideSelection(dir) || sources.every(path => path === dir)">{{ dir || '素材库根目录' }}</option>
      </select>
    </label>
    <p v-if="moving && alreadyThere">其中 {{ alreadyThere }} {{ selectedFolders.length ? '项' : '张' }}已在该目录。</p>
    <p v-if="error" class="error" role="alert">{{ error }}
      <el-button v-if="moving && !folders.length" link @click="loadFolders">重试</el-button>
    </p>
    <template #footer>
      <el-button :disabled="saving" @click="emit('close')">取消</el-button>
      <el-button :type="moving ? 'primary' : 'danger'" :loading="saving" :disabled="!ready" @click="submit">
        {{ moving ? '确认移动' : '确认删除' }}
      </el-button>
    </template>
  </el-dialog>
</template>
<style scoped>
p { margin:0 0 10px; }
.files { max-height:27vh; overflow:auto; margin:0; padding-inline-start:22px; overflow-wrap:anywhere; line-height:1.7; }
.target { display:grid; gap:6px; margin-top:18px; }
select { width:100%; padding:8px; border:1px solid var(--line); border-radius:6px; background:var(--surface); color:inherit; font:inherit; }
.error { margin-top:12px; color:var(--el-color-danger); }
</style>
