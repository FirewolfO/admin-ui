<script setup lang="ts">
import { computed, ref } from 'vue'
import { FullScreen, Link } from '@element-plus/icons-vue'

const loading = ref(true)
const configuredBaseUrl = String(import.meta.env.VITE_DOCUMENT_BASE_URL || '').trim().replace(/\/+$/, '')
const documentBaseUrl = configuredBaseUrl || `${window.location.protocol}//${window.location.hostname}:5180`
const documentUrl = computed(() => `${documentBaseUrl}/inner?embedded=1`)
</script>

<template>
  <section class="inner-docs-page">
    <div class="inner-docs-toolbar">
      <div><el-icon><Link /></el-icon><span>Inner 内部接口</span></div>
      <el-tooltip content="在新窗口打开">
        <el-button tag="a" :href="documentUrl" target="_blank" :icon="FullScreen">独立查看</el-button>
      </el-tooltip>
    </div>
    <div v-loading="loading" element-loading-text="正在加载 Inner 接口文档" class="inner-docs-frame">
      <iframe
        :src="documentUrl"
        title="Inner 内部接口文档"
        allow="clipboard-write"
        @load="loading = false"
      />
    </div>
  </section>
</template>

<style scoped>
.inner-docs-page { height: calc(100vh - 70px); display: grid; grid-template-rows: 48px minmax(0, 1fr); overflow: hidden; background: white; }
.inner-docs-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 18px 0 24px; border-bottom: 1px solid var(--theme-border); }
.inner-docs-toolbar > div { display: flex; align-items: center; gap: 8px; color: #46564f; font-size: 13px; font-weight: 650; }
.inner-docs-toolbar > div .el-icon { color: var(--theme-primary); }
.inner-docs-frame { min-width: 0; min-height: 0; }
.inner-docs-frame iframe { display: block; width: 100%; height: 100%; border: 0; }
@media (max-width: 768px) {
  .inner-docs-page { height: calc(100vh - 60px); }
  .inner-docs-toolbar { padding: 0 12px; }
  .inner-docs-toolbar .el-button { width: 36px; padding: 8px; font-size: 0; }
  .inner-docs-toolbar :deep(.el-button .el-icon) { font-size: 16px; }
}
</style>
