import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@permission/api'
import { clearSession, getRefreshToken, loadSession, saveSession, updateSessionUser } from '@/api/client'
import { useApplicationStore } from '@permission/stores/application'
import type { User } from '@permission/types'

export const useAuthStore = defineStore('auth', () => {
  const cached = loadSession()
  const user = ref<User | null>(cached?.user || null)
  const permissions = ref<string[]>(cached?.permissions || [])
  const initialized = ref(false)
  const authenticated = computed(() => Boolean(user.value))

  function can(code: string) {
    return permissions.value.includes('*') || permissions.value.includes(code)
  }

  async function completeOAuth(code: string, state: string) {
    const session = await authApi.oauthCallback(code, state)
    useApplicationStore().reset()
    saveSession(session)
    user.value = session.user
    permissions.value = session.permissions
    initialized.value = true
  }

  async function hydrate() {
    if (initialized.value) return
    if (!loadSession()) {
      initialized.value = true
      return
    }
    try {
      const result = await authApi.me()
      user.value = result.user
      permissions.value = result.permissions
    } catch {
      clearSession()
      useApplicationStore().reset()
      user.value = null
      permissions.value = []
    } finally {
      initialized.value = true
    }
  }

  async function logout() {
    try {
      await authApi.logout(getRefreshToken())
    } finally {
      clearSession()
      useApplicationStore().reset()
      user.value = null
      permissions.value = []
    }
  }

  function setUser(value: User) {
    user.value = value
    updateSessionUser(value)
  }

  return { user, permissions, initialized, authenticated, can, completeOAuth, hydrate, logout, setUser }
})
