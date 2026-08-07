<script setup lang="ts">
import { User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const peopleURL = import.meta.env.VITE_PEOPLE_UI_URL || 'http://localhost:5177/profile'
function openPeople() { window.location.assign(peopleURL) }
</script>

<template>
  <div class="page-stack">
    <section class="page-heading"><div><h2>个人资料</h2><p>身份资料由 People 统一维护</p></div><el-button type="primary" :icon="User" @click="openPeople">前往 People</el-button></section>
    <section class="data-section profile-readonly">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="用户名">{{ auth.user?.username || '-' }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ auth.user?.displayName || '-' }}</el-descriptions-item>
		<el-descriptions-item label="工号">{{ auth.user?.employeeNo || '-' }}</el-descriptions-item>
		<el-descriptions-item label="部门">{{ auth.user?.department || '-' }}</el-descriptions-item>
		<el-descriptions-item label="职务">{{ auth.user?.title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ auth.user?.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ auth.user?.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ auth.user?.status === 'enabled' ? '启用' : '停用' }}</el-descriptions-item>
      </el-descriptions>
    </section>
  </div>
</template>
