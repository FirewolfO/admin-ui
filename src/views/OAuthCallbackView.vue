<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { apiMessage } from '@/api/client'
import { safeLoginRedirect } from '@/utils/oauth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const failed = ref(false)

onMounted(async () => {
  try {
    const code = String(route.query.code || '')
    const state = String(route.query.state || '')
    if (!code || !state) throw new Error('OAuth 回调参数缺失')
    await auth.completeOAuth(code, state)
    const redirect = safeLoginRedirect(sessionStorage.getItem('admin_ui_login_redirect'))
    sessionStorage.removeItem('admin_ui_login_redirect')
    await router.replace(redirect)
  } catch (error) {
    failed.value = true
    ElMessage.error(apiMessage(error, 'People 登录失败'))
  }
})
</script>

<template><main class="login-page"><section class="login-panel callback-panel"><el-result :icon="failed ? 'error' : 'info'" :title="failed ? '登录失败' : '正在完成登录'"><template v-if="failed" #extra><el-button type="primary" @click="$router.replace('/login')">返回登录</el-button></template></el-result></section></main></template>
