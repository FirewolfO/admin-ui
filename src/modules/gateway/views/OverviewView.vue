<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CircleCheck, Connection, Menu as MenuIcon, SetUp, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { overviewApi, routesApi, servicesApi } from '@gateway/api'
import { apiMessage } from '@gateway/api/client'
import StatusTag from '@gateway/components/StatusTag.vue'
import { useAudience } from '@gateway/composables/useAudience'
import type { GatewayRoute, Overview, UpstreamService } from '@gateway/types'

const router = useRouter()
const { audience } = useAudience()
const loading = ref(false)
const overview = ref<Overview>({ serviceCount: 0, enabledServiceCount: 0, routeCount: 0, enabledRouteCount: 0 })
const services = ref<UpstreamService[]>([])
const routes = ref<GatewayRoute[]>([])

const disabledServiceCount = computed(() => overview.value.serviceCount - overview.value.enabledServiceCount)
const disabledRouteCount = computed(() => overview.value.routeCount - overview.value.enabledRouteCount)

async function load() {
  loading.value = true
  try {
    const [summary, servicePage, routePage] = await Promise.all([
      overviewApi.get(audience.value),
      servicesApi.list({ audience: audience.value, page: 1, pageSize: 5 }),
      routesApi.list({ audience: audience.value, page: 1, pageSize: 5 }),
    ])
    overview.value = summary
    services.value = servicePage.items
    routes.value = routePage.items
  } catch (error) {
    ElMessage.error(apiMessage(error, '概览加载失败'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(audience, load)
</script>

<template>
  <div v-loading="loading" class="overview-page">
    <section class="metrics-grid" aria-label="配置统计">
      <article class="metric-card metric-services">
        <span class="metric-icon"><el-icon><Connection /></el-icon></span>
        <div><span>服务总数</span><strong>{{ overview.serviceCount }}</strong><small>{{ overview.enabledServiceCount }} 个已启用</small></div>
      </article>
      <article class="metric-card metric-routes">
        <span class="metric-icon"><el-icon><SetUp /></el-icon></span>
        <div><span>路由总数</span><strong>{{ overview.routeCount }}</strong><small>{{ overview.enabledRouteCount }} 条已启用</small></div>
      </article>
      <article class="metric-card metric-active">
        <span class="metric-icon"><el-icon><CircleCheck /></el-icon></span>
        <div><span>生效配置</span><strong>{{ overview.enabledServiceCount + overview.enabledRouteCount }}</strong><small>服务与路由</small></div>
      </article>
      <article class="metric-card metric-disabled">
        <span class="metric-icon"><el-icon><Warning /></el-icon></span>
        <div><span>停用配置</span><strong>{{ disabledServiceCount + disabledRouteCount }}</strong><small>不会进入运行时</small></div>
      </article>
    </section>

    <section class="data-section">
      <div class="section-heading">
        <div><el-icon><MenuIcon /></el-icon><h2>最近服务</h2></div>
        <el-button text type="primary" @click="router.push({ name: 'gateway-services' })">查看全部<el-icon><ArrowRight /></el-icon></el-button>
      </div>
      <el-table :data="services" empty-text="暂无服务配置" table-layout="fixed">
        <el-table-column label="服务" min-width="180">
          <template #default="{ row }"><div class="primary-cell"><strong>{{ row.name }}</strong><code>{{ row.code }}</code></div></template>
        </el-table-column>
        <el-table-column prop="baseUrl" label="上游地址" min-width="240" show-overflow-tooltip />
        <el-table-column label="路由" width="90"><template #default="{ row }">{{ row.routeCount }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><StatusTag :status="row.status" /></template></el-table-column>
      </el-table>
    </section>

    <section class="data-section">
      <div class="section-heading">
        <div><el-icon><SetUp /></el-icon><h2>最近路由</h2></div>
        <el-button text type="primary" @click="router.push({ name: 'gateway-routes' })">查看全部<el-icon><ArrowRight /></el-icon></el-button>
      </div>
      <el-table :data="routes" empty-text="暂无路由配置" table-layout="fixed">
        <el-table-column prop="name" label="路由" min-width="150" />
        <el-table-column label="方法" width="150">
          <template #default="{ row }"><div class="method-list"><el-tag v-for="method in row.methods" :key="method" size="small" effect="plain">{{ method }}</el-tag></div></template>
        </el-table-column>
        <el-table-column label="访问路径" min-width="250"><template #default="{ row }"><code>/api/{{ row.audience }}/{{ row.serviceCode }}{{ row.path }}</code></template></el-table-column>
        <el-table-column prop="serviceName" label="目标服务" min-width="140" />
        <el-table-column label="状态" width="100"><template #default="{ row }"><StatusTag :status="row.status" /></template></el-table-column>
      </el-table>
    </section>
  </div>
</template>
