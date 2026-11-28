<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ prompt: string }>()
const title = computed(() => props.prompt.split(/[\r\n\u2028\u2029]/u, 1)[0].trim() || '未命名任务')
</script>

<template>
  <details class="task-details">
    <summary>{{ title }}</summary>
    <p v-if="prompt" class="prompt">{{ prompt }}</p>
    <slot />
  </details>
</template>

<style scoped>
.task-details { min-width:0; }
summary { width:fit-content; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  cursor:pointer; list-style-position:inside; font-weight:600; line-height:1.6; }
summary:focus-visible { outline:2px solid currentColor; outline-offset:2px; }
.prompt { margin:8px 0; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.6; }
</style>
