<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Close, Connection, DataBoard, Document, Expand, Grid, Key, Link, Lock, Menu as MenuIcon,
  Operation, Setting, SetUp, SwitchButton, UserFilled,
} from '@element-plus/icons-vue'
import { apiMessage } from '@/api/client'
import { internalSystems } from '@/config/systems'
import IdentityAvatar from '@permission/components/IdentityAvatar.vue'
import ThemeSwitcher from '@permission/components/ThemeSwitcher.vue'
import { useApplicationStore } from '@permission/stores/application'
import { useAudience } from '@gateway/composables/useAudience'
import { useAuthStore } from '@/stores/auth'
import type { RouteAudience } from '@gateway/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const applicationStore = useApplicationStore()
const { audience, setAudience } = useAudience()
const navigationDrawerOpen = ref(false)
const systemDrawerOpen = ref(false)

const permissionItems = computed(() => [
  { path: '/permission/dashboard', label: '概览', icon: Grid, permission: 'dashboard:view' },
  { path: '/permission/applications', label: '接入应用', icon: Link, permission: 'application:list' },
  { path: '/permission/roles', label: '角色', icon: Operation, permission: 'role:list' },
  { path: '/permission/permissions', label: '权限', icon: Key, permission: 'permission:list' },
  { path: '/permission/user-groups', label: '用户组', icon: UserFilled, permission: 'user_group:list' },
  { path: '/permission/audit-logs', label: '审计日志', icon: Lock, permission: 'audit:list' },
].filter((item) => !item.permission || auth.can(item.permission)))

const gatewayItems = computed(() => [
  { path: '/gateway/overview', label: '运行概览', icon: DataBoard },
  { path: '/gateway/services', label: '服务', icon: MenuIcon },
  { path: '/gateway/routes', label: '路由', icon: SetUp },
  ...(audience.value === 'inner' ? [{ path: '/gateway/credentials', label: '调用凭据', icon: Key }] : []),
])

const pageTitle = computed(() => String(route.meta.title || 'Admin Center'))
const isPermission = computed(() => route.meta.module === 'permission')
const isGateway = computed(() => route.meta.module === 'gateway')
const activeSystem = computed(() => internalSystems.find((system) => system.key === route.meta.module) || null)
const visibleSystems = computed(() => internalSystems.filter((system) => auth.can(system.requiredPermission)))
const activeItems = computed(() => isPermission.value ? permissionItems.value : isGateway.value ? gatewayItems.value : [])
const gatewayWorkspace = computed<RouteAudience>({
  get: () => audience.value,
  set: (value) => {
    setAudience(value)
    if (value === 'open' && route.name === 'gateway-credentials') void router.replace('/gateway/overview')
  },
})
const audienceOptions = [
  { label: 'Inner 内部接口', value: 'inner' },
  { label: 'Open OpenAPI', value: 'open' },
]

function openSystemDrawer() {
  navigationDrawerOpen.value = false
  systemDrawerOpen.value = true
}

async function enterSystem(entry: string) {
  systemDrawerOpen.value = false
  await router.push(entry)
}

async function showAllSystems() {
  systemDrawerOpen.value = false
  navigationDrawerOpen.value = false
  await router.push('/systems')
}

async function handleCommand(command: string) {
  if (command === 'profile') await router.push('/profile')
  if (command === 'logout') {
    await auth.logout()
    await router.replace('/login')
  }
}

watch(isPermission, async (active) => {
  if (!active || !auth.can('application:list')) return
  try { await applicationStore.hydrate() }
  catch (error) { ElMessage.error(apiMessage(error, '应用列表加载失败')) }
}, { immediate: true })
</script>

<template>
  <div class="app-shell">
    <aside v-if="activeSystem" class="sidebar desktop-sidebar">
      <div class="brand">
        <span class="brand-mark"><el-icon><component :is="activeSystem.icon" /></el-icon></span>
        <span><strong>{{ activeSystem.label }}</strong><small>Admin Center</small></span>
      </div>
      <el-menu :default-active="route.path" router class="side-menu">
        <el-menu-item v-for="item in activeItems" :key="item.path" :index="item.path"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></el-menu-item>
      </el-menu>
      <button class="all-systems-trigger" type="button" @click="openSystemDrawer"><el-icon><Grid /></el-icon><span>所有系统</span></button>
      <div class="sidebar-foot">People SSO</div>
    </aside>

    <el-drawer v-model="navigationDrawerOpen" direction="ltr" :with-header="false" size="260px">
      <aside v-if="activeSystem" class="sidebar drawer-sidebar">
        <div class="brand">
          <span class="brand-mark"><el-icon><component :is="activeSystem.icon" /></el-icon></span>
          <span><strong>{{ activeSystem.label }}</strong><small>Admin Center</small></span>
        </div>
        <el-menu :default-active="route.path" router class="side-menu" @select="navigationDrawerOpen = false">
          <el-menu-item v-for="item in activeItems" :key="item.path" :index="item.path"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></el-menu-item>
        </el-menu>
        <button class="all-systems-trigger" type="button" @click="openSystemDrawer"><el-icon><Grid /></el-icon><span>所有系统</span></button>
      </aside>
    </el-drawer>

    <el-drawer v-model="systemDrawerOpen" direction="ltr" :with-header="false" size="min(380px, 92vw)">
      <div class="system-drawer-panel">
        <header><div><small>ADMIN CENTER</small><h2>切换系统</h2></div><el-button text :icon="Close" aria-label="关闭系统抽屉" @click="systemDrawerOpen = false" /></header>
        <button class="system-drawer-all" type="button" @click="showAllSystems"><el-icon><Grid /></el-icon><span>所有系统</span></button>
        <div class="system-drawer-list">
          <button v-for="system in visibleSystems" :key="system.key" class="system-drawer-item" :class="{ 'is-active': activeSystem?.key === system.key }" type="button" @click="enterSystem(system.entry)">
            <span class="system-drawer-icon" :class="`system-${system.key}`"><el-icon><component :is="system.icon" /></el-icon></span>
            <span><strong>{{ system.label }}</strong><small>{{ system.description }}</small></span>
          </button>
        </div>
      </div>
    </el-drawer>

    <div class="workspace" :class="{ 'without-sidebar': !activeSystem }">
      <header class="topbar">
        <div class="topbar-title">
          <el-button v-if="activeSystem" class="mobile-menu-button" text :icon="Expand" aria-label="打开系统导航" @click="navigationDrawerOpen = true" />
          <el-button v-else-if="route.name !== 'systems'" text :icon="Grid" aria-label="返回所有系统" @click="showAllSystems" />
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-actions">
          <div v-if="isPermission && auth.can('application:list')" class="global-app-switcher">
            <el-icon><Connection /></el-icon>
            <el-select :model-value="applicationStore.currentApplicationId" :loading="applicationStore.loading" placeholder="选择应用" aria-label="当前应用" @change="applicationStore.select"><el-option v-for="application in applicationStore.applications" :key="application.id" :label="application.name" :value="application.id" /></el-select>
          </div>
          <el-segmented v-if="isGateway" v-model="gatewayWorkspace" :options="audienceOptions" class="audience-switch" aria-label="接口类型" />
          <el-tooltip content="Inner API 文档">
            <el-button text :icon="Document" :class="{ 'is-active': route.name === 'inner-api-docs' }" aria-label="打开 Inner API 文档" @click="router.push({ name: 'inner-api-docs' })" />
          </el-tooltip>
          <ThemeSwitcher />
          <el-dropdown trigger="click" @command="handleCommand">
            <button class="account-trigger"><IdentityAvatar :name="auth.user?.displayName" :identifier="auth.user?.username" :size="32" :email="auth.user?.email" :phone="auth.user?.phone" :status="auth.user?.status" /><span class="account-copy"><strong>{{ auth.user?.displayName }}</strong><small>{{ auth.user?.username }}</small></span><el-icon><Setting /></el-icon></button>
            <template #dropdown><el-dropdown-menu><el-dropdown-item command="profile" :icon="Setting">个人设置</el-dropdown-item><el-dropdown-item command="logout" :icon="SwitchButton" divided>退出登录</el-dropdown-item></el-dropdown-menu></template>
          </el-dropdown>
        </div>
      </header>
      <main :class="['page-content', { 'docs-page-content': route.name === 'inner-api-docs' }]"><RouterView /></main>
    </div>
  </div>
</template>
