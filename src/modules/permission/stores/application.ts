import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { applicationApi } from '@permission/api'
import type { Application } from '@permission/types'

const STORAGE_KEY = 'permission_current_application'

export const useApplicationStore = defineStore('application', () => {
  const applications = ref<Application[]>([])
  const currentApplicationId = ref(Number(localStorage.getItem(STORAGE_KEY)) || 0)
  const loading = ref(false)
  const initialized = ref(false)
  const currentApplication = computed(() => applications.value.find((item) => item.id === currentApplicationId.value) || null)

  function select(applicationId: number) {
	if (applicationId === 0) {
	  currentApplicationId.value = 0
	  localStorage.removeItem(STORAGE_KEY)
	  return
	}
	if (!applications.value.some((item) => item.id === applicationId && item.status === 'enabled')) return
    currentApplicationId.value = applicationId
    localStorage.setItem(STORAGE_KEY, String(applicationId))
  }

  async function hydrate(force = false) {
    if (initialized.value && !force) return
    loading.value = true
    try {
      applications.value = (await applicationApi.list()).filter((item) => item.status === 'enabled')
      if (!applications.value.some((item) => item.id === currentApplicationId.value)) {
        select(applications.value[0]?.id || 0)
      }
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  function upsert(application: Application) {
    const index = applications.value.findIndex((item) => item.id === application.id)
    if (application.status !== 'enabled') {
      if (index >= 0) applications.value.splice(index, 1)
    } else if (index >= 0) applications.value[index] = application
    else applications.value.push(application)
    if (!applications.value.some((item) => item.id === currentApplicationId.value)) select(applications.value[0]?.id || 0)
  }

  function setApplications(items: Application[]) {
    applications.value = items.filter((item) => item.status === 'enabled')
    initialized.value = true
    if (!applications.value.some((item) => item.id === currentApplicationId.value)) select(applications.value[0]?.id || 0)
  }

  function reset() {
    applications.value = []
    currentApplicationId.value = 0
    initialized.value = false
    localStorage.removeItem(STORAGE_KEY)
  }

  return { applications, currentApplicationId, currentApplication, loading, initialized, select, hydrate, upsert, setApplications, reset }
})
