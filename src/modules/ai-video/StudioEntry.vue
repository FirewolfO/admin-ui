<script setup lang="ts">
import { EditPen, RefreshRight } from '@element-plus/icons-vue'
import { isTaskPending, statusLabel, type VideoTask } from './api'
import TaskProgress from './TaskProgress.vue'
import VideoPreview from './VideoPreview.vue'

defineProps<{ task: VideoTask; modelLabel: string; busy: boolean }>()
defineEmits<{ edit: [task: VideoTask]; regenerate: [task: VideoTask]; review: [task: VideoTask]; updated: [task: VideoTask] }>()
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
    <p v-else class="state">{{ statusLabel(task.status) }}<template v-if="task.message"> · {{ task.message }}</template></p>
    <div class="actions" v-if="task.status === 'unknown' || task.prompt || task.materials.length">
      <button type="button" :disabled="busy" @click="$emit('edit',task)"><el-icon><EditPen /></el-icon>编辑提示</button>
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
