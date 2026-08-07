<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { themeOptions, useThemeStore, type ThemeId } from '@permission/stores/theme'

const themeStore = useThemeStore()
const visible = ref(false)
const currentTheme = computed(() => themeOptions.find((theme) => theme.id === themeStore.current) ?? themeOptions[0])

function selectTheme(theme: ThemeId) {
  themeStore.select(theme)
  visible.value = false
}
</script>

<template>
  <el-popover v-model:visible="visible" placement="bottom-end" :width="210" trigger="click" popper-class="theme-popover">
    <template #reference>
      <el-button class="theme-switcher-button" circle aria-label="切换界面主题" title="切换界面主题">
        <span class="current-theme-swatch" :style="{ backgroundColor: currentTheme.sidebar }">
          <i :style="{ backgroundColor: currentTheme.color }" />
        </span>
      </el-button>
    </template>
    <div class="theme-menu" role="radiogroup" aria-label="界面主题">
      <div class="theme-menu-title">界面主题</div>
      <button
        v-for="theme in themeOptions"
        :key="theme.id"
        type="button"
        class="theme-option"
        :class="{ 'is-active': themeStore.current === theme.id }"
        role="radio"
        :aria-checked="themeStore.current === theme.id"
        @click="selectTheme(theme.id)"
      >
        <span class="theme-swatch" :style="{ backgroundColor: theme.sidebar }">
          <i :style="{ backgroundColor: theme.color }" />
        </span>
        <span>{{ theme.label }}</span>
        <el-icon v-if="themeStore.current === theme.id"><Check /></el-icon>
      </button>
    </div>
  </el-popover>
</template>
