<script setup lang="ts">
import { computed, ref } from 'vue'
import { FullScreen, Link } from '@element-plus/icons-vue'

const loading = ref(true)
const configuredBaseUrl = String(import.meta.env.VITE_DOCUMENT_BASE_URL || '').trim().replace(/\/$/, '')
const documentBaseUrl = configuredBaseUrl || `${window.location.protocol}//${window.location.hostname}:5180`
const documentUrl = computed(() => `${documentBaseUrl}/systems/permission?embedded=1`)

function handleLoad() {
  loading.value = false
}
</script>

<template>
  <div class="embedded-docs-page">
    <div class="embedded-docs-toolbar">
      <div><el-icon><Link /></el-icon><span>权限管理接口集合</span></div>
      <el-tooltip content="在新窗口打开">
        <el-button tag="a" :href="documentUrl" target="_blank" :icon="FullScreen">独立查看</el-button>
      </el-tooltip>
    </div>
    <div v-loading="loading" element-loading-text="正在加载接口文档" class="embedded-docs-frame">
      <iframe
        :src="documentUrl"
        title="权限管理接口文档"
        allow="clipboard-write"
        @load="handleLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.embedded-docs-page { display: grid; grid-template-rows: 48px minmax(640px, calc(100vh - 132px)); min-width: 0; overflow: hidden; background: white; border: 1px solid var(--theme-border); border-radius: 6px; }
.embedded-docs-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 12px 0 17px; border-bottom: 1px solid var(--theme-border); }
.embedded-docs-toolbar > div { display: flex; align-items: center; gap: 8px; color: #46564f; font-size: 13px; font-weight: 600; }
.embedded-docs-toolbar > div .el-icon { color: var(--theme-primary); }
.embedded-docs-frame { min-width: 0; min-height: 640px; }
.embedded-docs-frame iframe { display: block; width: 100%; height: 100%; min-height: 640px; border: 0; }
@media (max-width: 640px) {
  .embedded-docs-page { grid-template-rows: 48px minmax(600px, calc(100vh - 116px)); border-right: 0; border-left: 0; border-radius: 0; }
  .embedded-docs-toolbar { padding-left: 12px; }
  .embedded-docs-toolbar .el-button { width: 36px; padding: 8px; font-size: 0; }
}
</style>
