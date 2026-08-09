import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    module?: 'permission' | 'gateway' | 'blog'
    permission?: string
    public?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: '登录', public: true } },
    { path: '/oauth/callback', name: 'oauth-callback', component: () => import('@/views/OAuthCallbackView.vue'), meta: { title: '登录中', public: true } },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', redirect: '/systems' },
        { path: 'systems', name: 'systems', component: () => import('@/views/SystemHubView.vue'), meta: { title: '所有系统' } },
        { path: 'permission/dashboard', name: 'permission-dashboard', component: () => import('@permission/views/DashboardView.vue'), meta: { title: '权限概览', module: 'permission', permission: 'dashboard:view' } },
        { path: 'permission/user-groups', name: 'permission-user-groups', component: () => import('@permission/views/UserGroupsView.vue'), meta: { title: '用户组管理', module: 'permission', permission: 'user_group:list' } },
        { path: 'permission/roles', name: 'permission-roles', component: () => import('@permission/views/RolesView.vue'), meta: { title: '角色管理', module: 'permission', permission: 'role:list' } },
        { path: 'permission/applications', name: 'permission-applications', component: () => import('@permission/views/ApplicationsView.vue'), meta: { title: '接入应用', module: 'permission', permission: 'application:list' } },
        { path: 'permission/permissions', name: 'permission-permissions', component: () => import('@permission/views/PermissionsView.vue'), meta: { title: '权限管理', module: 'permission', permission: 'permission:list' } },
        { path: 'permission/audit-logs', name: 'permission-audit-logs', component: () => import('@permission/views/AuditLogsView.vue'), meta: { title: '权限审计', module: 'permission', permission: 'audit:list' } },
        { path: 'docs', name: 'inner-api-docs', component: () => import('@/views/DocsView.vue'), meta: { title: 'Inner API 文档' } },
        { path: 'permission/docs', redirect: '/docs' },
        { path: 'profile', name: 'profile', component: () => import('@permission/views/ProfileView.vue'), meta: { title: '个人设置' } },
        { path: 'gateway/overview', name: 'gateway-overview', component: () => import('@gateway/views/OverviewView.vue'), meta: { title: 'Gateway 概览', module: 'gateway' } },
        { path: 'gateway/services', name: 'gateway-services', component: () => import('@gateway/views/ServicesView.vue'), meta: { title: '服务管理', module: 'gateway' } },
        { path: 'gateway/routes', name: 'gateway-routes', component: () => import('@gateway/views/RoutesView.vue'), meta: { title: '路由管理', module: 'gateway' } },
        { path: 'gateway/credentials', name: 'gateway-credentials', component: () => import('@gateway/views/CredentialsView.vue'), meta: { title: '调用凭据', module: 'gateway' } },
        { path: 'blog/dashboard', name: 'blog-dashboard', component: () => import('@blog/views/DashboardView.vue'), meta: { title: '博客工作台', module: 'blog', permission: 'svc.inner.blog:view' } },
        { path: 'blog/posts', name: 'blog-posts', component: () => import('@blog/views/PostsView.vue'), meta: { title: '文章管理', module: 'blog', permission: 'svc.inner.blog:view' } },
        { path: 'blog/posts/new', name: 'blog-post-new', component: () => import('@blog/views/PostEditorView.vue'), meta: { title: '新建文章', module: 'blog', permission: 'svc.inner.blog:manage' } },
        { path: 'blog/posts/:id/edit', name: 'blog-post-edit', component: () => import('@blog/views/PostEditorView.vue'), meta: { title: '编辑文章', module: 'blog', permission: 'svc.inner.blog:manage' } },
		{ path: 'blog/reviews', name: 'blog-reviews', component: () => import('@blog/views/ReviewsView.vue'), meta: { title: '审核记录', module: 'blog', permission: 'svc.inner.blog:view' } },
        { path: 'blog/categories', name: 'blog-categories', component: () => import('@blog/views/CategoriesView.vue'), meta: { title: '分类管理', module: 'blog', permission: 'svc.inner.blog:manage' } },
        { path: 'blog/comments', name: 'blog-comments', component: () => import('@blog/views/CommentsView.vue'), meta: { title: '评论管理', module: 'blog', permission: 'svc.inner.blog:view' } },
        { path: 'forbidden', name: 'forbidden', component: () => import('@permission/views/ForbiddenView.vue'), meta: { title: '无权访问' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} - Admin Center` : 'Admin Center'
  const auth = useAuthStore()
  await auth.hydrate()
  if (to.meta.public) return auth.authenticated && to.name === 'login' ? '/systems' : true
  if (!auth.authenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.permission && !auth.can(to.meta.permission)) return { name: 'forbidden' }
  if (to.meta.module === 'gateway' && !auth.can('gateway:manage')) return { name: 'forbidden' }
  return true
})

export default router
