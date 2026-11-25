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
  resolutions: string[]
  supportsDraft: boolean
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
  options: { resolution?: string; draft?: boolean; generate_audio?: boolean }
}

export interface VideoInput {
  requestId: string
  prompt: string
  model: string
  mode: ImageMode
  images: string[]
  ratio: string
  duration: number
  resolution?: string
  draft?: boolean
  audio?: boolean
}

export interface AssetItem {
  kind: 'folder' | 'image'
  name: string
  path: string
  fileCount?: number
  canDelete?: boolean
  sha?: string
  url?: string
}

async function mediaUrl(id: string, kind: 'preview' | 'download') {
  const path = `/tasks/${encodeURIComponent(id)}`
  const { data } = await client.post<{ resource: string }>(path + '/media-session', { kind }, { timeout: 15_000, withCredentials: true })
  return client.getUri({ url: path + '/' + data.resource })
}

export async function downloadVideo(id: string) {
  const link = document.createElement('a')
  link.href = await mediaUrl(id, 'download')
  link.download = `ai-video-${id}.mp4`
  document.body.append(link)
  link.click()
  link.remove()
}

export const videos = {
  settings: async () => (await client.get<{ model: string; models: VideoModel[]; ratios: string[]; cloudHistory: boolean }>('/settings')).data,
  upload: async (file: File, directory?: string) => {
    const data = new FormData()
    data.set('image', file, file.name || 'clipboard-image')
    if (directory !== undefined) data.set('directory', directory)
    return (await client.post<{ url: string }>('/assets', data)).data.url
  },
  assets: async (directory: string, refresh = false) =>
    (await client.get<{ directory: string; items: AssetItem[] }>('/assets', { params: { directory, refresh: refresh ? 1 : undefined } })).data,
  renameFolder: async (item: AssetItem, name: string) =>
    client.patch('/assets/folders', { path: item.path, sha: item.sha, name }),
  folders: async () => (await client.get<{ folders: string[] }>('/assets/folders')).data.folders,
  batchAssets: async (action: 'delete' | 'move', selection: AssetItem[], destination: string | null) =>
    (await client.post<{ count: number }>('/assets/batch', {
      action, items: selection.map(({ kind, path, sha }) => ({ kind, path, sha })),
      ...(action === 'move' ? { destination } : {}),
    })).data.count,
  createFolder: async (directory: string, name: string) => client.post('/assets/folders', { directory, name }),
  deleteImage: async (item: AssetItem) => client.delete('/assets', { data: { path: item.path, sha: item.sha } }),
  create: async (input: VideoInput) =>
    (await client.post<VideoTask>('/tasks', input)).data,
  list: async (favorites = false) => (await client.get<{ items: VideoTask[] }>('/tasks', { params: favorites ? { favorite: 1 } : {} })).data.items,
  favorite: async (id: string, favorite: boolean) =>
    (await client.put<VideoTask>(`/tasks/${id}/favorite`, { favorite })).data,
  poster: async (id: string) => (await client.get<Blob>(`/tasks/${id}/poster`, { responseType: 'blob' })).data,
  preview: (id: string) => mediaUrl(id, 'preview'),
  cloud: async (page: number) => (await client.get<{ items: CloudTask[]; total: number }>('/cloud', { params: { page } })).data,
  import: async (id: string) => (await client.post<VideoTask>(`/cloud/${encodeURIComponent(id)}/import`)).data,
}

export function statusLabel(status: string) {
  return ({
    submitting: '提交中', unknown: '待核对', queued: '排队中', running: '生成中', archiving: '保存中',
    succeeded: '已完成', failed: '失败', expired: '已过期', cancelled: '已取消',
  } as Record<string, string>)[status] || status
}

export const generationStages = [
  { status: 'submitting', label: '提交' }, { status: 'queued', label: '排队' },
  { status: 'running', label: '生成' }, { status: 'archiving', label: '保存' },
  { status: 'succeeded', label: '完成' },
]

export function isTaskPending(task: CloudTask) {
  return task.status !== 'succeeded' && generationStages.some(stage => stage.status === task.status)
}
