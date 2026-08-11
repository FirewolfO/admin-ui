export interface Provider { id: string; name: string; baseUrl: string; defaultModel: string; enabled: boolean; hasApiKey: boolean; createdAt: string; updatedAt: string }
export interface ProviderInput { name: string; baseUrl: string; defaultModel: string; apiKey: string; enabled?: boolean }
export interface Prompt { id: string; title: string; description: string; category: string; content: string; favorite: boolean; useCount: number; createdAt: string; updatedAt: string }
export interface PromptInput { title: string; description: string; category: string; content: string; favorite?: boolean }
export interface Message { id: string; conversationId: string; role: 'user' | 'assistant' | 'system'; content: string; model?: string; promptTokens: number; completionTokens: number; latencyMs: number; status: 'completed' | 'failed'; createdAt: string }
export interface Conversation { id: string; title: string; providerId: string; model: string; systemPrompt: string; pinned: boolean; createdAt: string; updatedAt: string; messageCount: number; lastMessage?: string; messages?: Message[] }
export interface Dashboard { conversationCount: number; messageCount: number; promptCount: number; providerCount: number; totalTokens: number; recent: Conversation[] }
