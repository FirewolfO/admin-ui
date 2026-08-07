<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, Grid } from '@element-plus/icons-vue'
import { authApi } from '@permission/api'
import { apiMessage } from '@/api/client'
import ThemeSwitcher from '@permission/components/ThemeSwitcher.vue'
import { oauthRedirectUri, peopleAuthorizationUrl, safeLoginRedirect } from '@/utils/oauth'

const route = useRoute()
const loading = ref(false)
async function login() {
  loading.value = true
  try {
    sessionStorage.setItem('admin_ui_login_redirect', safeLoginRedirect(route.query.redirect))
    const redirectUri = oauthRedirectUri(import.meta.env.VITE_OAUTH_REDIRECT_URI, window.location.origin)
    const result = await authApi.oauthStart(redirectUri)
    window.location.assign(peopleAuthorizationUrl(result.authorizationUrl, import.meta.env.VITE_PEOPLE_LOGIN_ORIGIN))
  } catch (error) {
    ElMessage.error(apiMessage(error, '无法发起 People 登录'))
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-intro">
      <div class="login-brand"><span class="login-brand-mark"><el-icon><Grid /></el-icon></span><span>Admin Center</span></div>
      <div><p class="eyebrow">INTERNAL ADMINISTRATION</p><h1>统一管理平台</h1><p>Permission 与 Gateway</p></div>
      <div class="security-note"><span class="status-dot" />内部服务</div>
    </section>
    <section class="login-panel">
      <div class="login-form-wrap">
        <div class="login-heading-row"><div class="login-heading"><h2>登录管理平台</h2><p>使用 People 企业账号继续</p></div><ThemeSwitcher /></div>
        <el-button type="primary" size="large" :loading="loading" :icon="ArrowRight" class="login-submit" @click="login">使用 People 登录</el-button>
      </div>
    </section>
  </main>
</template>
