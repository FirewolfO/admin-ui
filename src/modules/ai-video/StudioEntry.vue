<script setup lang="ts">
import { EditPen, RefreshRight } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiMessage } from '@/api/client'
import { isTaskPending, statusLabel, videos, type VideoTask } from './api'
import TaskProgress from './TaskProgress.vue'
import VideoPreview from './VideoPreview.vue'

const props = defineProps<{ task: VideoTask; modelLabel: string; busy: boolean }>()
const emit = defineEmits<{ edit: [task: VideoTask]; regenerate: [task: VideoTask]; review: [task: VideoTask]; updated: [task: VideoTask]; refresh: [] }>()
const cancelling = ref(false)
async function cancel() {
  if (cancelling.value) return
  cancelling.value = true
  try {
    const confirmed = await ElMessageBox.confirm('确认取消这条任务？方舟仅支持取消仍在排队的任务。', '取消任务',
      { confirmButtonText: '确认取消', cancelButtonText: '继续执行' }).then(() => true, () => false)
    if (!confirmed) return
    const result = await videos.cancel(props.task.id)
    emit('updated', result)
    if (result.status === 'cancelled') ElMessage.success('任务已取消')
    else ElMessage.info('任务当前状态为「' + statusLabel(result.status) + '」')
  } catch (e) { ElMessage.error(apiMessage(e, '取消失败')); emit('refresh') }
  finally { cancelling.value = false }
}
</script>
<template>
  <article class="entry">
    <time :datetime="new Date(task.created * 1000).toISOString()">{{ new Date(task.created * 1000).toLocaleString('zh-CN', {hour12:false}) }}</time>
    <div class="caption"><strong>{{ task.prompt || (task.image ? '图片生成视频' : '方舟历史作品') }}</strong>
      <span>{{ modelLabel }}</span><span v-if="task.materials.length">素材 · {{ task.materials.length }}</span>
      <span v-if="task.ratio">{{ task.ratio === 'adaptive' ? '自动匹配' : task.ratio }}</span>
      <span v-if="task.options.resolution">{{ task.options.resolution }}</span>
      <span v-if="task.duration">{{ task.duration > 0 ? task.duration + 's' : '智能时长' }}</span><span v-if="task.options.draft">草稿</span>
    </div>
    <VideoPreview v-if="task.status === 'succeeded'" class="screen" :task="task" @updated="$emit('updated', $event)" />
    <TaskProgress v-else-if="isTaskPending(task)" :task="task" />
    <p v-else class="state">{{ statusLabel(task.status) }}<template v-if="task.message.includes('InputImageSensitiveContentDetected.PrivacyInformation')"> · 方舟判断输入图片可能含有真人。可编辑素材，使用预置虚拟人像替换对应的参考图。</template><template v-else-if="task.message"> · {{ task.message }}</template></p>
    <div class="actions" v-if="task.status === 'unknown' || task.prompt || task.materials.length">
      <button v-if="task.canCancel" type="button" :disabled="cancelling" @click="cancel">取消任务</button>
      <button type="button" :disabled="busy" @click="$emit('edit',task)"><el-icon><EditPen /></el-icon>{{ task.message.includes('InputImageSensitiveContentDetected.PrivacyInformation') ? '编辑素材' : '编辑提示' }}</button>
      <button v-if="task.status === 'unknown'" type="button" @click="$emit('review',task)">核对任务</button>
      <button type="button" :disabled="busy" @click="$emit('regenerate',task)"><el-icon><RefreshRight /></el-icon>{{ task.status === 'unknown' ? '按原设置新建' : '重新生成' }}</button>
    </div>
  </article>
</template>
<style scoped>
.entry { margin:0 0 28px; color:#efeff1; overflow-wrap:anywhere; }
time,.state { color:#a3a3ab; font-size:13px; }
.caption { display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 0; margin:9px 0 13px; }
.caption strong { font-weight:500; font-size:15px; white-space:pre-wrap; margin-right:10px; }
.caption span { color:#aaaab2; font-size:13px; padding:0 9px; border-left:1px solid #404044; }
.screen { max-width:500px; }
.actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
button { cursor:pointer; }
.actions button { display:flex; align-items:center; gap:6px; background:#212124; color:#dddde2; border:1px solid #303034; border-radius:20px; padding:6px 12px; font-size:13px; }
.actions button:hover { background:#343437; }
button:disabled { opacity:.6; }
</style>
