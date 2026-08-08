import type { PostStatus } from './types'
export const statusLabel = (status: PostStatus) => ({ draft: '草稿', published: '已发布', archived: '已归档' } as const)[status]
export const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
