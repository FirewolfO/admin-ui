<script setup lang="ts">
import { computed } from 'vue'
import type { Status } from '@permission/types'

const props = withDefaults(defineProps<{
  name?: string
  identifier?: string
  size?: number
  email?: string
  phone?: string
  status?: Status | ''
  showCard?: boolean
}>(), { name: '', identifier: '', size: 36, email: '', phone: '', status: '', showCard: true })

const colors = ['#176b5b', '#26658c', '#76558a', '#a04e45', '#80651e', '#3e5f9b', '#695247', '#4f7138']
const displayName = computed(() => props.name.trim() || props.identifier.trim() || '用户')
const initials = computed(() => Array.from(displayName.value).slice(-2).join('').toUpperCase())
const background = computed(() => {
  let hash = 0
  for (const char of Array.from(props.identifier || displayName.value)) hash = (hash * 31 + (char.codePointAt(0) || 0)) >>> 0
  return colors[hash % colors.length]
})
const statusLabel = computed(() => props.status === 'disabled' ? '禁用' : '启用')
</script>

<template>
  <el-popover placement="right" trigger="hover" :show-after="250" :width="286" :disabled="!showCard" popper-class="identity-popover">
    <template #reference>
      <el-avatar :size="size" class="identity-avatar" :style="{ backgroundColor: background }"><span>{{ initials }}</span></el-avatar>
    </template>
    <div class="identity-card">
      <div class="identity-card-heading">
        <el-avatar :size="46" class="identity-avatar" :style="{ backgroundColor: background }"><span>{{ initials }}</span></el-avatar>
        <div><strong>{{ displayName }}</strong><small>{{ identifier || '-' }}</small></div>
      </div>
      <dl>
        <template v-if="email"><dt>邮箱</dt><dd>{{ email }}</dd></template>
        <template v-if="phone"><dt>联系电话</dt><dd>{{ phone }}</dd></template>
        <template v-if="status"><dt>状态</dt><dd><el-tag :type="status === 'enabled' ? 'success' : 'info'" effect="plain" size="small">{{ statusLabel }}</el-tag></dd></template>
      </dl>
    </div>
  </el-popover>
</template>
