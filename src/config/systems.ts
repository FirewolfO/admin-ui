import type { Component } from 'vue'
import { Connection, EditPen, Lock, MagicStick, VideoCamera } from '@element-plus/icons-vue'

export type SystemKey = 'permission' | 'gateway' | 'blog' | 'ai-workbench' | 'ai-video'

export interface InternalSystem {
  key: SystemKey
  name: string
  label: string
  description: string
  entry: string
  icon: Component
  requiredPermission?: string
}

export const internalSystems: InternalSystem[] = [
  {
    key: 'permission',
    name: 'Permission',
    label: '权限系统',
    description: '身份、角色与访问策略',
    entry: '/permission/dashboard',
    icon: Lock,
    requiredPermission: 'dashboard:view',
  },
  {
    key: 'gateway',
    name: 'Gateway',
    label: 'Gateway',
    description: '服务、路由与调用凭据',
    entry: '/gateway/overview',
    icon: Connection,
    requiredPermission: 'gateway:manage',
  },
  {
    key: 'blog',
    name: 'Blog',
    label: '内部博客',
    description: '团队文章、分类与评论',
    entry: '/blog/dashboard',
    icon: EditPen,
    requiredPermission: 'svc.inner.blog:view',
  },
  {
    key: 'ai-workbench',
    name: 'AI Workbench',
    label: 'AI 工作台',
    description: '个人对话、提示词与模型连接',
    entry: '/ai-workbench/chat',
    icon: MagicStick,
  },
  {
    key: 'ai-video',
    name: 'AI Video',
    label: 'AI 视频创作',
    description: '生成视频、管理作品与收藏',
    entry: '/ai-video/create',
    icon: VideoCamera,
  },
]
