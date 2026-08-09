import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearSession, getAccessToken, refreshPlatformAccessToken } from '@/api/client'
import type { Category, Comment, Dashboard, Media, Post, PostInput, PostPage, ReviewNotification, ReviewSubmission } from './types'
import { toPostInput } from './post'
interface Envelope<T> { code: string; message: string; data: T; requestId: string }
interface RetryConfig extends InternalAxiosRequestConfig { _retry?: boolean }
const api = axios.create({ baseURL: import.meta.env.VITE_BLOG_API_BASE_URL || '/api/blog/v1', timeout: 20_000 })
api.interceptors.request.use((config) => { const token = getAccessToken(); if (token) config.headers.Authorization = `Bearer ${token}`; return config })
api.interceptors.response.use((response) => response, async (error: AxiosError<Envelope<unknown>>) => { const original = error.config as RetryConfig | undefined; if (error.response?.status === 401 && original && !original._retry) { original._retry = true; try { original.headers.Authorization = `Bearer ${await refreshPlatformAccessToken()}`; return api(original) } catch { clearSession(); window.location.assign(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`) } }; return Promise.reject(error) })
const unwrap = async <T>(promise: Promise<{ data: Envelope<T> }>) => (await promise).data.data
export const apiMessage = (error: unknown, fallback = '请求失败') => axios.isAxiosError<Envelope<unknown>>(error) ? error.response?.data?.message || fallback : error instanceof Error ? error.message : fallback
export const blogApi = {
  dashboard: () => unwrap<Dashboard>(api.get('/dashboard')),
  posts: (params: Record<string, string | number>) => unwrap<PostPage>(api.get('/posts', { params })),
  post: (id: string) => unwrap<Post>(api.get(`/posts/${id}`)),
  createPost: (input: PostInput) => unwrap<Post>(api.post('/posts', toPostInput(input))),
  updatePost: (id: string, input: PostInput) => unwrap<Post>(api.put(`/posts/${id}`, toPostInput(input))),
  publishPost: (id: string) => unwrap<Post>(api.post(`/posts/${id}/publish`)),
  deletePost: (id: string) => unwrap<{ deleted: boolean }>(api.delete(`/posts/${id}`)),
  ratePost: (id: string, stars: number) => unwrap<{ stars: number; ratingCount: number; ratingAverage: number }>(api.post(`/posts/${id}/rating`, { stars })),
  categories: () => unwrap<Category[]>(api.get('/categories')),
  createCategory: (input: Pick<Category, 'name' | 'slug' | 'description'>) => unwrap<Category>(api.post('/categories', input)),
  updateCategory: (id: string, input: Pick<Category, 'name' | 'slug' | 'description'>) => unwrap<Category>(api.put(`/categories/${id}`, input)),
  deleteCategory: (id: string) => unwrap<{ deleted: boolean }>(api.delete(`/categories/${id}`)),
  comments: (postId: string) => unwrap<Comment[]>(api.get(`/posts/${postId}/comments`)),
  createComment: (postId: string, content: string) => unwrap<Comment>(api.post(`/posts/${postId}/comments`, { content })),
  deleteComment: (id: string) => unwrap<{ deleted: boolean }>(api.delete(`/comments/${id}`)),
  upload: (file: File) => { const data = new FormData(); data.append('file', file); return unwrap<Media>(api.post('/media', data, { headers: { 'Content-Type': 'multipart/form-data' } })) },
  reviews: () => unwrap<Post[]>(api.get('/reviews')),
  myReviews: () => unwrap<ReviewSubmission[]>(api.get('/reviews/mine')),
  reviewNotifications: () => unwrap<ReviewNotification[]>(api.get('/reviews/notifications')),
  readReviewNotifications: () => unwrap<{ read: number }>(api.post('/reviews/notifications/read')),
  approve: (id: string) => unwrap<Post>(api.post(`/reviews/${id}/approve`)),
  reject: (id: string, note: string) => unwrap<Post>(api.post(`/reviews/${id}/reject`, { note })),
}
