<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Connection, DataBoard, Document, Expand, Grid, Key, Link, Lock, Menu as MenuIcon,
  Operation, Setting, SetUp, SwitchButton, UserFilled,
} from '@element-plus/icons-vue'
import { avatarUrl, apiMessage } from '@/api/client'
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
const drawerOpen = ref(false)

const permissionItems = computed(() => [
  { path: '/permission/dashboard', label: '概览', icon: Grid, permission: 'dashboard:view' },
  { path: '/permission/applications', label: '接入应用', icon: Link, permission: 'application:list' },
  { path: '/permission/roles', label: '角色', icon: Operation, permission: 'role:list' },
  { path: '/permission/permissions', label: '权限', icon: Key, permission: 'permission:list' },
  { path: '/permission/user-groups', label: '用户组', icon: UserFilled, permission: 'user_group:list' },
  { path: '/permission/audit-logs', label: '审计日志', icon: Lock, permission: 'audit:list' },
  { path: '/permission/docs', label: 'API 文档', icon: Document, permission: '' },
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

async function handleCommand(command: string) {
  if (command === 'profile') await router.push('/profile')
  if (command === 'logout') {
    await auth.logout()
    await router.replace('/login')
  }
}

onMounted(async () => {
  if (!auth.can('application:list')) return
  try { await applicationStore.hydrate() }
  catch (error) { ElMessage.error(apiMessage(error, '应用列表加载失败')) }
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar desktop-sidebar">
      <div class="brand"><span class="brand-mark"><el-icon><Grid /></el-icon></span><span><strong>Admin Center</strong><small>Internal Console</small></span></div>
      <el-menu :default-active="route.path" router class="side-menu">
        <el-menu-item-group title="PERMISSION">
          <el-menu-item v-for="item in permissionItems" :key="item.path" :index="item.path"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></el-menu-item>
        </el-menu-item-group>
        <el-menu-item-group v-if="auth.can('gateway:manage')" title="GATEWAY">
          <el-menu-item v-for="item in gatewayItems" :key="item.path" :index="item.path"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></el-menu-item>
        </el-menu-item-group>
      </el-menu>
      <div class="sidebar-foot">People SSO</div>
    </aside>

    <el-drawer v-model="drawerOpen" direction="ltr" :with-header="false" size="260px">
      <aside class="sidebar drawer-sidebar">
        <div class="brand"><span class="brand-mark"><el-icon><Grid /></el-icon></span><span><strong>Admin Center</strong><small>Internal Console</small></span></div>
        <el-menu :default-active="route.path" router class="side-menu" @select="drawerOpen = false">
          <el-menu-item v-for="item in [...permissionItems, ...(auth.can('gateway:manage') ? gatewayItems : [])]" :key="item.path" :index="item.path"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span></el-menu-item>
        </el-menu>
      </aside>
    </el-drawer>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-title"><el-button class="mobile-menu-button" text :icon="Expand" aria-label="打开导航" @click="drawerOpen = true" /><h1>{{ pageTitle }}</h1></div>
        <div class="topbar-actions">
          <div v-if="isPermission && auth.can('application:list')" class="global-app-switcher">
            <el-icon><Connection /></el-icon>
            <el-select :model-value="applicationStore.currentApplicationId" :loading="applicationStore.loading" placeholder="选择应用" aria-label="当前应用" @change="applicationStore.select"><el-option v-for="application in applicationStore.applications" :key="application.id" :label="application.name" :value="application.id" /></el-select>
          </div>
          <el-segmented v-if="isGateway" v-model="gatewayWorkspace" :options="audienceOptions" class="audience-switch" aria-label="接口类型" />
          <ThemeSwitcher />
          <el-dropdown trigger="click" @command="handleCommand">
            <button class="account-trigger"><IdentityAvatar :name="auth.user?.displayName" :identifier="auth.user?.username" :src="avatarUrl(auth.user)" :size="32" :email="auth.user?.email" :phone="auth.user?.phone" :status="auth.user?.status" /><span class="account-copy"><strong>{{ auth.user?.displayName }}</strong><small>{{ auth.user?.username }}</small></span><el-icon><Setting /></el-icon></button>
            <template #dropdown><el-dropdown-menu><el-dropdown-item command="profile" :icon="Setting">个人设置</el-dropdown-item><el-dropdown-item command="logout" :icon="SwitchButton" divided>退出登录</el-dropdown-item></el-dropdown-menu></template>
          </el-dropdown>
        </div>
      </header>
      <main class="page-content"><RouterView /></main>
    </div>
  </div>
</template>
