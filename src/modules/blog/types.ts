export interface Category { id: string; name: string; slug: string; description: string; postCount: number }
export type PostStatus = 'draft' | 'published' | 'archived'
export interface Post { id: string; title: string; slug: string; excerpt: string; content: string; coverImageUrl: string; status: PostStatus; categoryId: string; category?: Category; tags: string[]; authorName: string; publishedAt?: string; createdAt: string; updatedAt: string; commentCount: number }
export interface Comment { id: string; postId: string; content: string; authorName: string; createdAt: string }
export interface Dashboard { posts: number; published: number; drafts: number; comments: number; categories: number; recent: Post[] }
export interface PostPage { items: Post[]; total: number; page: number; pageSize: number }
export interface PostInput { title: string; slug: string; excerpt: string; content: string; coverImageUrl: string; status: PostStatus; categoryId: string; tags: string[] }
export interface Media { id: string; url: string; filename: string; size: number }
