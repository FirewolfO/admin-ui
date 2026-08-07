import { ref } from 'vue'
import { defineStore } from 'pinia'

export const themeOptions = [
  { id: 'emerald', label: '松石绿', color: '#16856f', sidebar: '#17241f' },
  { id: 'ocean', label: '海湾蓝', color: '#246b8a', sidebar: '#172b35' },
  { id: 'crimson', label: '石榴红', color: '#9b4f62', sidebar: '#302128' },
  { id: 'amber', label: '琥珀金', color: '#8a641e', sidebar: '#302c22' },
] as const

export type ThemeId = typeof themeOptions[number]['id']

const storageKey = 'permission-ui-theme'

function isThemeId(value: string | null): value is ThemeId {
  return themeOptions.some((theme) => theme.id === value)
}

function savedTheme(): ThemeId {
  try {
    const value = localStorage.getItem(storageKey)
    return isThemeId(value) ? value : 'emerald'
  } catch {
    return 'emerald'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const current = ref<ThemeId>(savedTheme())

  function apply() {
    document.documentElement.dataset.theme = current.value
  }

  function select(theme: ThemeId) {
    current.value = theme
    apply()
    try { localStorage.setItem(storageKey, theme) } catch { /* 浏览器禁用存储时仍可在当前页面切换 */ }
  }

  apply()

  return { current, select }
})
