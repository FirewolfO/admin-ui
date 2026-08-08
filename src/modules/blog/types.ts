export interface Category { id: string; name: string; slug: string; description: string; postCount: number }
export type PostStatus = 'draft' | 'published' | 'archived'
export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export interface Post { id: string; title: string; slug: string; excerpt: string; content: string; coverImageUrl: string; status: PostStatus; reviewStatus: ReviewStatus; reviewNote?: string; hasPendingChanges: boolean; categoryId: string; category?: Category; tags: string[]; authorId: string; authorName: string; publishedAt?: string; createdAt: string; updatedAt: string; commentCount: number; ratingCount: number; ratingAverage: number; myRating: number; canEdit: boolean; canDelete: boolean }
export interface Comment { id: string; postId: string; content: string; authorName: string; createdAt: string; canDelete: boolean }
export interface Dashboard { posts: number; published: number; drafts: number; pending: number; comments: number; categories: number; recent: Post[] }
export interface PostPage { items: Post[]; total: number; page: number; pageSize: number }
export interface PostInput { title: string; slug: string; excerpt: string; content: string; coverImageUrl: string; status: PostStatus; categoryId: string; tags: string[] }
export interface Media { id: string; url: string; filename: string; size: number }
