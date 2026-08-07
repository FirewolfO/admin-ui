<script setup lang="ts">
import type { ResourceStatus } from '@gateway/types'

defineProps<{ status: ResourceStatus }>()
</script>

<template>
  <el-tag :type="status === 'enabled' ? 'success' : 'info'" effect="light" size="small">
    {{ status === 'enabled' ? '已启用' : '已停用' }}
  </el-tag>
</template>
