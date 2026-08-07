<script setup lang="ts">
import { Back, Lock } from '@element-plus/icons-vue'
</script>

<template>
  <section class="state-page">
    <span class="state-icon"><el-icon><Lock /></el-icon></span>
    <h2>无权访问</h2>
    <p>当前账号没有访问此功能所需的权限。</p>
    <el-button type="primary" :icon="Back" @click="$router.push('/permission/dashboard')">返回概览</el-button>
  </section>
</template>
