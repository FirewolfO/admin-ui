import axios from 'axios'
import { usePlatformSession } from '@/api/client'

const client = usePlatformSession(axios.create({
  baseURL: import.meta.env.VITE_AI_VIDEO_API_BASE_URL || '/api/ai-video/v1',
  timeout: 180_000,
}))

export interface CloudTask {
  id: string
  model: string
  status: string
  created: number
}

export type ImageMode = 'text' | 'first' | 'frames' | 'references'

export interface VideoModel {
  id: string
  label: string
  durations: number[]
  maxReferences: number
  adaptiveFramesOnly: boolean
}

export interface VideoTask extends CloudTask {
  ark_id: string | null
  prompt: string
  image: string
  materials: { role: 'first_frame' | 'last_frame' | 'reference_image'; url: string }[]
  ratio: string
  duration: number
  favorite: boolean
  message: string
}

export const videos = {
  settings: async () => (await client.get<{ model: string; models: VideoModel[]; ratios: string[]; cloudHistory: boolean }>('/settings')).data,
  upload: async (file: File) => {
    const data = new FormData()
    data.set('image', file)
    return (await client.post<{ url: string }>('/assets', data)).data.url
  },
  create: async (input: { requestId: string; prompt: string; model: string; mode: ImageMode; images: string[]; ratio: string; duration: number }) =>
    (await client.post<VideoTask>('/tasks', input)).data,
  list: async () => (await client.get<{ items: VideoTask[] }>('/tasks')).data.items,
  favorite: async (id: string, favorite: boolean) =>
    (await client.put<VideoTask>(`/tasks/${id}/favorite`, { favorite })).data,
  video: async (id: string) => (await client.get<Blob>(`/tasks/${id}/video`, { responseType: 'blob' })).data,
  cloud: async (page: number) => (await client.get<{ items: CloudTask[]; total: number }>('/cloud', { params: { page } })).data,
  import: async (id: string) => (await client.post<VideoTask>(`/cloud/${encodeURIComponent(id)}/import`)).data,
}

export function statusLabel(status: string) {
  return ({
    submitting: '提交中', unknown: '待核对', queued: '排队中', running: '生成中', archiving: '保存中',
    succeeded: '已完成', failed: '失败', expired: '已过期', cancelled: '已取消',
  } as Record<string, string>)[status] || status
}
