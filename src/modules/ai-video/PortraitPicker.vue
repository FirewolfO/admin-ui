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
const shared = ref(false)
const error = ref('')
const saving = ref(false)
const matches = computed(() => props.portraits.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(query.value.trim().toLowerCase())))

async function add() {
  if (saving.value || !id.value.trim() || !name.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    const portrait = await videos.addPortrait({ id: id.value.trim(), name: name.value.trim(), preview: preview.value.trim(),
      scope: shared.value ? 'shared' : 'personal' })
    emit('added', portrait)
    query.value = portrait.id
    adding.value = false
    id.value = name.value = preview.value = ''
    shared.value = false
  } catch (e) { error.value = apiMessage(e, '添加人像失败') }
  finally { saving.value = false }
}
</script>
<template>
  <section class="portraits" aria-label="预置虚拟人像" @keydown.enter.stop>
    <div class="toolbar">
      <input v-model="query" type="search" placeholder="搜索人像名称或素材 ID" aria-label="搜索虚拟人像" @keydown.enter.prevent />
      <button type="button" class="manage" :disabled="saving" :aria-expanded="adding" @click="adding = !adding; error = ''">添加人像</button>
    </div>
    <div v-if="adding" class="fields" @keydown.enter.prevent="add">
      <p>在<a href="https://ark.volcengine.com/region:cn-beijing/experience/gen_video?model=doubao-seedance-2-5-260628"
        target="_blank" rel="noopener noreferrer">方舟体验中心</a>打开「虚拟人像库」，复制所选图片的素材 ID。首次使用需同意方舟使用协议。</p>
      <p>使用自己的虚拟人物图片时，请先在本系统使用的方舟项目中上传，审核通过后再填写素材 ID。<a
        href="https://docs.volcengine.com/docs/ark/private-virtual-avatar-library-guide-preview?lang=zh"
        target="_blank" rel="noopener noreferrer">查看上传步骤</a></p>
      <label>方舟图片素材 ID<input v-model="id" placeholder="asset-… 或 asset://asset-…" /></label>
      <label>人像名称<input v-model="name" maxlength="80" /></label>
      <label>预览图（选填）<input v-model="preview" placeholder="FirewolfO/images 图片地址" /></label>
      <label v-if="auth.can('*')" class="share"><input v-model="shared" type="checkbox" />共享给所有用户</label>
      <p v-if="!shared">新添加的人像仅自己可见。</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <button type="button" :disabled="saving || !id.trim() || !name.trim()" @click="add">保存人像</button>
    </div>
    <div v-if="matches.length" class="grid">
      <button v-for="p in matches" :key="p.id" type="button" class="card" :aria-label="'选择' + p.name"
        @click="emit('choose', ['asset://' + p.id])">
        <img v-if="portraitCover(p)" :src="portraitCover(p)" :alt="p.name" loading="lazy" />
        <el-icon v-else><UserFilled /></el-icon>
        <span>{{ p.name }}</span>
        <small v-if="p.scope === 'personal'">仅自己可见</small>
      </button>
    </div>
    <p v-else>没有匹配的人像。</p>
    <p>点击人像即可将其加入当前视频的参考图。</p>
  </section>
</template>
<style scoped>
.portraits, .fields, label { display:grid; gap:10px; }
input { width:100%; box-sizing:border-box; padding:8px; border:1px solid #555; border-radius:7px; background:#19191b; color:inherit; }
.toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; }
.share { display:flex; align-items:center; gap:6px; }
.share input { width:auto; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(105px,1fr)); gap:10px; max-height:36vh; overflow:auto; }
button { cursor:pointer; font:inherit; color:inherit; border:1px solid #555; border-radius:7px; background:#303034; }
.card { min-width:0; overflow:hidden; padding:0; }
.card:is(:hover,:focus-visible) { border-color:#d4e2ff; }
.card img,.card .el-icon { width:100%; height:116px; object-fit:contain; background:#19191b; }
.card .el-icon { font-size:32px; }
.card span { display:block; padding:6px; overflow-wrap:anywhere; }
.card small { display:block; padding-bottom:6px; }
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
