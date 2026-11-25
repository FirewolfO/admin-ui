<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { statusLabel, videos, type CloudTask, type VideoTask } from './api'

const props = defineProps<{ task: VideoTask }>()
const emit = defineEmits<{ close: []; resolved: [action: 'link' | 'close'] }>()
const auth = useAuthStore()
const canLink = computed(() => auth.can('*'))
const open = ref(true)
const action = ref<'link' | 'close' | ''>(canLink.value ? 'link' : '')
const page = ref(1)
const total = ref(0)
const items = ref<CloudTask[]>([])
const selected = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const formatTime = (seconds: number) => new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false })
const refresh = ref(0)

watch([action, page, refresh], async (_, __, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  error.value = ''
  items.value = []
  selected.value = ''
  loading.value = action.value === 'link'
  if (!loading.value) return
  try {
    const result = await videos.cloud(page.value, props.task.model)
    if (active) { items.value = result.items; total.value = result.total }
  } catch (e) {
    if (active) error.value = apiMessage(e, '方舟历史加载失败')
  } finally { if (active) loading.value = false }
}, { immediate: true })

async function save() {
  if (saving.value || !action.value || (action.value === 'link' && !selected.value)) return
  saving.value = true
  error.value = ''
  try {
    await videos.review(props.task.id, action.value === 'link' ? { action: 'link', arkId: selected.value } : { action: 'close' })
    ElMessage.success(action.value === 'link' ? '已关联，后台将同步方舟任务' : '已结束本地记录')
    emit('resolved', action.value)
  } catch (e) { error.value = apiMessage(e, '保存失败，请重试') }
  finally { saving.value = false }
}
</script>

<template>
  <el-dialog v-model="open" title="核对方舟任务" width="min(580px, 94vw)" append-to-body
    :show-close="!saving" :close-on-click-modal="!saving" :close-on-press-escape="!saving" @closed="emit('close')">
    <div class="review">
      <p>提交时没有收到方舟任务 ID。请按提交时间和模型核对方舟历史，避免重复生成和计费。</p>
      <div class="details">
        <strong>{{ formatTime(task.created) }}</strong>
        <span>{{ task.model }} · {{ task.ratio }} · {{ task.duration === -1 ? '智能时长' : task.duration + ' 秒' }}</span>
        <span>本地记录 ID <code>{{ task.id }}</code></span>
      </div>
      <p v-if="!canLink">请将本地记录 ID 和提交时间发给平台管理员。管理员可在「方舟历史」查找任务，并将它关联回你的作品。</p>
      <el-radio-group v-model="action" :disabled="saving" aria-label="核对结果">
        <el-radio v-if="canLink" value="link">关联方舟任务</el-radio>
        <el-radio value="close">已核对，结束本地记录</el-radio>
      </el-radio-group>
      <template v-if="action === 'link'">
        <span>请选择确认属于本次提交的方舟任务。</span>
        <span v-if="loading" role="status">正在查询方舟历史…</span>
        <div v-else-if="items.length" class="matches" role="radiogroup" aria-label="同模型方舟任务">
          <label v-for="item in items" :key="item.id">
            <input v-model="selected" type="radio" name="ark-task" :value="item.id" :disabled="saving" />
            <span>{{ formatTime(item.created) }} · {{ statusLabel(item.status) }}<br /><code>{{ item.id }}</code></span>
          </label>
        </div>
        <span v-if="!loading && !items.length && !error">方舟历史中没有可查询的同模型任务。</span>
        <el-pagination v-if="total > 20" v-model:current-page="page" :disabled="saving || loading" layout="prev, pager, next"
          :pager-count="5" :page-size="20" :total="total" />
      </template>
      <p v-if="action === 'close'">结束后会保留提示词和素材。此操作仅更新本地记录，方舟上已受理的任务仍会继续。</p>
      <div v-if="error" role="alert">
        <el-alert :title="error" type="error" show-icon :closable="false" />
        <el-button v-if="action === 'link'" link @click="refresh++">刷新方舟历史</el-button>
      </div>
    </div>
    <template #footer>
      <el-button :disabled="saving" @click="open = false">暂不处理</el-button>
      <el-button type="primary" :loading="saving" :disabled="!action || (action === 'link' && !selected)" @click="save">
        {{ action === 'link' ? '确认关联' : '确认结束' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.review, .details { display:grid; gap:12px; overflow-wrap:anywhere; }
.review p { margin:0; line-height:1.6; }
.details { gap:4px; padding:12px; border-radius:6px; background:var(--el-fill-color-light); }
.matches { overflow:auto; max-height: min(220px, 30vh); border:1px solid var(--el-border-color); border-radius:6px; }
.matches label { display:flex; align-items:center; gap:8px; padding:8px; cursor:pointer; }
.matches label:has(:checked) { background:var(--el-color-primary-light-9); }
.details code { user-select:all; }
</style>
