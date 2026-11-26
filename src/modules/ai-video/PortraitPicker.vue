<script setup lang="ts">
import { computed, ref } from 'vue'
import { UserFilled } from '@element-plus/icons-vue'
import { apiMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { portraitCover, videos, type Portrait } from './api'

const props = defineProps<{ portraits: Portrait[] }>()
const emit = defineEmits<{ choose: [urls: string[]]; added: [portrait: Portrait] }>()
const auth = useAuthStore()
const query = ref('')
const adding = ref(false)
const name = ref('')
const id = ref('')
const preview = ref('')
const error = ref('')
const saving = ref(false)
const matches = computed(() => props.portraits.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(query.value.trim().toLowerCase())))

async function add() {
  if (saving.value || !id.value.trim() || !name.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    const portrait = await videos.addPortrait({ id: id.value.trim(), name: name.value.trim(), preview: preview.value.trim() })
    emit('added', portrait)
    query.value = portrait.id
    adding.value = false
    id.value = name.value = preview.value = ''
  } catch (e) { error.value = apiMessage(e, '添加人像失败') }
  finally { saving.value = false }
}
</script>
<template>
  <section class="portraits" aria-label="预置虚拟人像" @keydown.enter.stop>
    <input v-model="query" type="search" placeholder="搜索人像名称或素材 ID" aria-label="搜索虚拟人像" @keydown.enter.prevent />
    <div v-if="matches.length" class="grid">
      <button v-for="p in matches" :key="p.id" type="button" class="card" :aria-label="'选择' + p.name"
        @click="emit('choose', ['asset://' + p.id])">
        <img v-if="portraitCover(p)" :src="portraitCover(p)" :alt="p.name" loading="lazy" />
        <el-icon v-else><UserFilled /></el-icon>
        <span>{{ p.name }}</span>
      </button>
    </div>
    <p v-else>没有匹配的人像。</p>
    <p>选中的人像按图片顺序作为参考图。首次使用请在<a href="https://ark.volcengine.com/region:cn-beijing/experience/gen_video?model=doubao-seedance-2-5-260628"
      target="_blank" rel="noopener noreferrer">方舟体验中心</a>打开「虚拟人像库」并同意使用协议。</p>
    <button v-if="auth.can('*')" type="button" class="manage" :aria-expanded="adding" @click="adding = !adding">从方舟添加人像</button>
    <div v-if="adding" class="fields" @keydown.enter.prevent="add">
      <label>人像名称<input v-model="name" maxlength="80" /></label>
      <label>方舟图片素材 ID<input v-model="id" placeholder="从方舟虚拟人像库复制 asset- 开头的图片 ID" /></label>
      <label>预览图（选填）<input v-model="preview" placeholder="FirewolfO/images 图片地址" /></label>
      <p>保存后所有平台用户都可选择该人像。</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <button type="button" :disabled="saving || !id.trim() || !name.trim()" @click="add">保存人像</button>
    </div>
  </section>
</template>
<style scoped>
.portraits, .fields, label { display:grid; gap:10px; }
input { width:100%; box-sizing:border-box; padding:8px; border:1px solid #555; border-radius:7px; background:#19191b; color:inherit; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(105px,1fr)); gap:10px; max-height:36vh; overflow:auto; }
button { cursor:pointer; font:inherit; color:inherit; border:1px solid #555; border-radius:7px; background:#303034; }
.card { min-width:0; overflow:hidden; padding:0; }
.card:is(:hover,:focus-visible) { border-color:#d4e2ff; }
.card img,.card .el-icon { width:100%; height:116px; object-fit:contain; background:#19191b; }
.card .el-icon { font-size:32px; }
.card span { display:block; padding:6px; overflow-wrap:anywhere; }
p { margin:0; font-size:13px; color:#c4c4cc; }
a { color:#bdcfff; }
.manage,.fields button { justify-self:start; padding:6px 10px; }
.fields { border-top:1px solid #555; padding-top:10px; }
[role=alert] { color:#ffb3ae; }
.catalog input,.catalog button { background:var(--el-fill-color-blank); color:var(--el-text-color-primary); border-color:var(--el-border-color); }
.catalog p { color:var(--el-text-color-regular); }
.catalog a { color:var(--el-color-primary); }
.catalog .grid { grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr)); max-height:none; }
.catalog .card img,.catalog .card .el-icon { height:170px; background:var(--el-fill-color-light); }
.catalog .card:is(:hover,:focus-visible) { border-color:var(--el-color-primary); }
.catalog .fields { border-color:var(--el-border-color); }
.catalog [role=alert] { color:var(--el-color-danger); }
</style>
