import { readonly, ref } from 'vue'
import type { RouteAudience } from '@gateway/types'

const audience = ref<RouteAudience>('inner')

export function useAudience() {
  function setAudience(value: RouteAudience) {
    audience.value = value
  }

  return { audience: readonly(audience), setAudience }
}
