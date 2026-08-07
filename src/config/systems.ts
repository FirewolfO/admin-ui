import type { Component } from 'vue'
import { Connection, Lock } from '@element-plus/icons-vue'

export type SystemKey = 'permission' | 'gateway'

export interface InternalSystem {
  key: SystemKey
  name: string
  label: string
  description: string
  entry: string
  icon: Component
  requiredPermission: string
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
]
