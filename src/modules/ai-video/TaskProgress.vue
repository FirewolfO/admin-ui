<script setup lang="ts">
import { computed } from 'vue'
import { statusLabel, type VideoTask } from './api'

const props = defineProps<{ task: VideoTask }>()
const label = computed(() => {
  const state = statusLabel(props.task.status)
  const value = props.task.generationPercent
  if (props.task.status === 'running' && typeof value === 'number' && value >= 0 && value <= 100) {
    return `${state} ${value}%`
  }
  return state
})
</script>

<template>
  <p class="task-state" role="status">
    {{ label }}
    <span v-if="task.message"> · {{ task.message }}</span>
  </p>
</template>

<style scoped>
.task-state { margin:0; font-size:14px; }
</style>
