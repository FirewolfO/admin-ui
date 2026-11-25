<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { generationStages, statusLabel, type VideoTask } from './api'

const props = defineProps<{ task: VideoTask }>()
const stageIndex = computed(() => generationStages.findIndex(stage => stage.status === props.task.status))
const now = ref(Math.floor(Date.now() / 1000))
const elapsed = computed(() => {
  const seconds = Math.max(0, now.value - props.task.created)
  const minutes = Math.floor(seconds / 60)
  if (minutes >= 60) return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
  return minutes ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`
})
let timer: number
onMounted(() => { timer = window.setInterval(() => { now.value = Math.floor(Date.now() / 1000) }, 1000) })
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <section class="task-progress" aria-label="视频生成进度">
    <div class="summary">
      <strong role="status">{{ statusLabel(task.status) }}</strong>
      <span role="timer">已用时 {{ elapsed }}</span>
    </div>
    <ol aria-label="生成阶段">
      <li v-for="(stage, i) in generationStages" :key="stage.status" :class="{ past: i < stageIndex }"
        :aria-current="i === stageIndex ? 'step' : undefined">{{ stage.label }}</li>
    </ol>
    <p v-if="task.message">{{ task.message }}</p>
  </section>
</template>

<style scoped>
.task-progress { width:100%; max-width:500px; color:inherit; }
.summary { display:flex; align-items:baseline; justify-content:space-between; gap:12px; font-size:14px; }
.summary span,li { color:var(--progress-muted,var(--muted)); font-size:12px; }
.summary span { font-variant-numeric:tabular-nums; }
ol { display:flex; list-style:none; gap:4px; padding:0; margin:9px 0 0; }
li { flex:1; text-align:center; }
li::before { display:block; content:''; height:4px; border-radius:2px; margin-bottom:4px; background:var(--progress-track,var(--line)); }
li.past::before,li[aria-current]::before { background:var(--progress-accent,var(--accent)); }
li[aria-current] { font-weight:700; color:var(--progress-accent,var(--accent)); }
p { margin:6px 0 0; font-size:13px; }
</style>
