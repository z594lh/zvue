<template>
  <CpcLayout active-tab="campaigns" @shop-change="onShopChange">
    <div class="cpc-sub-page">
      <div class="filter-panel">
        <h3 class="page-title">
          <el-icon size="20" style="margin-right:6px;vertical-align:middle"><Share /></el-icon>广告结构
        </h3>
        <el-input v-model="search" placeholder="搜索活动/广告组/关键词" clearable style="width:220px" @input="filterTree" />
        <el-button type="primary" class="btn-search" @click="fetchData">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>

      <div v-loading="loading" class="tree-panel">
        <el-empty v-if="!shopId" description="请选择店铺" />
        <el-empty v-else-if="!filteredTreeData.length" description="暂无数据" />
        <el-tree
          v-else
          :data="filteredTreeData"
          node-key="id"
          default-expand-all
          :expand-on-click-node="false"
          :props="{ children: 'children', label: 'label' }"
        >
          <template #default="{ data }">
            <div class="tree-node">
              <el-icon v-if="data.type === 'campaign'" style="color:#409eff"><Promotion /></el-icon>
              <el-icon v-else-if="data.type === 'ad_group'" style="color:#67c23a"><Grid /></el-icon>
              <el-icon v-else-if="data.type === 'keyword'" style="color:#e6a23c"><Collection /></el-icon>
              <el-icon v-else-if="data.type === 'target'" style="color:#f56c6c"><Aim /></el-icon>
              <el-icon v-else-if="data.type === 'product_ad'" style="color:#909399"><Goods /></el-icon>
              <span class="node-label">{{ data.label }}</span>
              <el-tag
                v-if="data.type === 'campaign'"
                size="small"
                :type="data.data?.state === 'ENABLED' ? 'success' : 'info'"
                class="node-tag"
              >{{ data.data?.state === 'ENABLED' ? '启用' : '暂停' }}</el-tag>
              <el-tag v-if="data.type === 'campaign' && data.data?.targeting_type" size="small" class="node-tag">
                {{ data.data.targeting_type === 'AUTO' ? '自动' : '手动' }}
              </el-tag>
              <span v-if="data.type === 'campaign' && data.data?.daily_budget" class="node-extra">
                日预算: ${{ Number(data.data.daily_budget).toFixed(2) }}
              </span>
              <span v-if="data.type === 'keyword' && data.data?.bid" class="node-extra">
                出价: ${{ Number(data.data.bid).toFixed(2) }}
              </span>
            </div>
          </template>
        </el-tree>
      </div>
    </div>
  </CpcLayout>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import CpcLayout from '@/components/cpc/CpcLayout.vue'
import { getCpcStructureTree } from '@/services/cpc'

const shopId = ref(null)
const loading = ref(false)
const treeData = ref([])
const search = ref('')

const onShopChange = (val) => { shopId.value = val; fetchData() }

const fetchData = async () => {
  if (!shopId.value) { treeData.value = []; return }
  loading.value = true
  try {
    const res = await getCpcStructureTree({ shop_id: shopId.value })
    if (res.data.status === 'success') {
      treeData.value = res.data.data || []
    }
  } catch { ElMessage.error('获取结构数据失败') }
  finally { loading.value = false }
}

const filterNode = (node, keyword) => {
  if (!keyword) return true
  const lowerKeyword = keyword.toLowerCase()
  if ((node.label || '').toLowerCase().includes(lowerKeyword)) return true
  if (node.children && node.children.length) {
    return node.children.some(child => filterNode(child, keyword))
  }
  return false
}

const cloneTree = (nodes) => {
  return nodes.map(node => ({
    ...node,
    children: node.children && node.children.length ? cloneTree(node.children) : undefined
  }))
}

const filteredTreeData = computed(() => {
  if (!search.value) return treeData.value
  const cloned = cloneTree(treeData.value)
  return cloned.filter(node => filterNode(node, search.value))
})

const filterTree = () => { /* computed handles filtering */ }

onMounted(() => { if (shopId.value) fetchData() })
</script>

<style scoped>
.cpc-sub-page { background: #fff; border-radius: 4px; padding: 12px; }
.filter-panel { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.page-title { margin: 0; font-size: 16px; color: #303133; display: flex; align-items: center; }
.btn-search { background: #009688; border-color: #009688; }
.tree-panel { min-height: 300px; }
.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  font-size: 14px;
}
.node-label { margin-left: 2px; }
.node-tag { margin-left: 8px; }
.node-extra { margin-left: auto; color: #909399; font-size: 12px; }
</style>
