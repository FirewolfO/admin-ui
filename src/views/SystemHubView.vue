<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'
import { internalSystems } from '@/config/systems'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const systems = computed(() => internalSystems.filter((system) => !system.requiredPermission || auth.can(system.requiredPermission)))
</script>

<template>
  <section class="system-hub">
    <header class="system-hub-heading">
      <p>ADMIN CENTER</p>
      <h2>所有系统</h2>
    </header>
    <div v-if="systems.length" class="system-card-grid">
      <button v-for="system in systems" :key="system.key" class="system-card" type="button" @click="router.push(system.entry)">
        <span class="system-card-icon" :class="`system-${system.key}`"><el-icon><component :is="system.icon" /></el-icon></span>
        <span class="system-card-copy"><strong>{{ system.label }}</strong><small>{{ system.name }}</small><span>{{ system.description }}</span></span>
        <el-icon class="system-card-arrow"><ArrowRight /></el-icon>
      </button>
    </div>
    <el-empty v-else description="暂无可访问的系统" />
  </section>
</template>
