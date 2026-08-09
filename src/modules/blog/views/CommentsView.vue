<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Promotion } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { apiMessage, blogApi } from '@blog/api'
import EmojiPicker from '@blog/components/EmojiPicker.vue'
import { formatDate } from '@blog/format'
import type { Comment, Post } from '@blog/types'

const route = useRoute()
const auth = useAuthStore()
const posts = ref<Post[]>([])
const postId = ref(String(route.query.postId || ''))
const comments = ref<Comment[]>([])
const content = ref('')
const commentInput = ref<{ textarea?: HTMLTextAreaElement } | null>(null)
const loading = ref(false)
const sending = ref(false)
const rating = ref(0)
const ratingSubmitting = ref(false)

const selectedPost = computed(() => posts.value.find((post) => post.id === postId.value))
const canRate = computed(() => Boolean(
  selectedPost.value
  && selectedPost.value.status === 'published'
  && selectedPost.value.reviewStatus === 'approved'
  && selectedPost.value.authorId !== auth.user?.id,
))
const ratingTooltip = computed(() => {
  if (!selectedPost.value) return '星标评分'
  if (selectedPost.value.authorId === auth.user?.id) return '不能为自己的文章评分'
  if (selectedPost.value.status !== 'published' || selectedPost.value.reviewStatus !== 'approved') return '文章发布后可评分'
  return '星标评分'
})

function syncRating() {
  rating.value = selectedPost.value?.myRating || 0
}

async function load() {
  if (!postId.value) {
    comments.value = []
    return
  }
  loading.value = true
  try {
    comments.value = await blogApi.comments(postId.value)
  } catch (error) {
    ElMessage.error(apiMessage(error, '评论加载失败'))
  } finally {
    loading.value = false
  }
}

async function insertEmoji(emoji: string) {
  const textarea = commentInput.value?.textarea
  const start = textarea?.selectionStart ?? content.value.length
  const end = textarea?.selectionEnd ?? start
  content.value = `${content.value.slice(0, start)}${emoji}${content.value.slice(end)}`
  await nextTick()
  const cursor = start + emoji.length
  textarea?.focus()
  textarea?.setSelectionRange(cursor, cursor)
}

async function rate(value: number | undefined) {
  const post = selectedPost.value
  if (!post || !value || !canRate.value) {
    syncRating()
    return
  }
  ratingSubmitting.value = true
  try {
    const result = await blogApi.ratePost(post.id, value)
    post.myRating = result.stars
    post.ratingCount = result.ratingCount
    post.ratingAverage = result.ratingAverage
    rating.value = result.stars
    ElMessage.success('评分已更新')
  } catch (error) {
    syncRating()
    ElMessage.error(apiMessage(error, '评分失败'))
  } finally {
    ratingSubmitting.value = false
  }
}

async function send() {
  if (!content.value.trim()) return
  sending.value = true
  try {
    await blogApi.createComment(postId.value, content.value)
    content.value = ''
    await load()
    ElMessage.success('评论已添加')
  } catch (error) {
    ElMessage.error(apiMessage(error, '评论失败'))
  } finally {
    sending.value = false
  }
}

async function remove(item: Comment) {
  try {
    await ElMessageBox.confirm('确认删除这条评论？', '删除评论', { type: 'warning' })
    await blogApi.deleteComment(item.id)
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error, '删除失败'))
  }
}

watch(postId, () => {
  syncRating()
  void load()
})

onMounted(async () => {
  try {
    posts.value = (await blogApi.posts({ page: 1, pageSize: 100 })).items
    if (!postId.value) postId.value = posts.value[0]?.id || ''
    else {
      syncRating()
      await load()
    }
  } catch (error) {
    ElMessage.error(apiMessage(error, '文章加载失败'))
  }
})
</script>

<template>
  <div class="blog-comments">
    <aside>
      <header><strong>选择文章</strong><small>{{ posts.length }} 篇</small></header>
      <button v-for="post in posts" :key="post.id" :class="{ active: post.id === postId }" @click="postId = post.id">
        <strong>{{ post.title }}</strong><small>{{ post.commentCount }} 条评论 · {{ post.ratingAverage.toFixed(1) }} 分</small>
      </button>
      <el-empty v-if="!posts.length" :image-size="48" description="还没有文章" />
    </aside>
    <section>
      <div v-if="selectedPost" class="blog-comment-context">
        <div><strong>{{ selectedPost.title }}</strong><small>{{ selectedPost.ratingAverage.toFixed(1) }} 分 · {{ selectedPost.ratingCount }} 人评分</small></div>
        <el-tooltip :content="ratingTooltip"><span class="blog-comment-rating"><el-rate v-model="rating" :disabled="ratingSubmitting || !canRate" @change="rate" /></span></el-tooltip>
      </div>
      <div v-if="postId" class="blog-comment-composer">
        <el-input ref="commentInput" v-model="content" type="textarea" :rows="3" maxlength="1000" show-word-limit placeholder="补充讨论或反馈" />
        <div class="blog-comment-actions"><EmojiPicker @select="insertEmoji" /><el-button type="primary" :icon="Promotion" :loading="sending" @click="send">发表评论</el-button></div>
      </div>
      <div v-loading="loading" class="blog-comment-list">
        <article v-for="item in comments" :key="item.id"><span class="blog-comment-avatar">{{ item.authorName.slice(0, 1) }}</span><div><header><strong>{{ item.authorName }}</strong><small>{{ formatDate(item.createdAt) }}</small></header><p>{{ item.content }}</p></div><el-button text type="danger" :icon="Delete" aria-label="删除评论" @click="remove(item)" /></article>
        <el-empty v-if="postId && !comments.length" :image-size="56" description="还没有评论" /><el-empty v-if="!postId" :image-size="56" description="请先创建文章" />
      </div>
    </section>
  </div>
</template>
