<template>
  <div class="amazon-listing-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><Goods /></el-icon>
          Amazon Listing 列表
        </h1>
        <p class="page-subtitle">查看和管理亚马逊商品 Listing 信息</p>
      </div>
      <div class="header-actions">
        <el-tooltip
          effect="dark"
          placement="top"
          content="从亚马逊 SP-API 手动同步最新 Listing 数据到本地数据库。"
        >
          <el-button type="warning" @click="syncListings" :loading="syncLoading">
            <el-icon><RefreshRight /></el-icon>
            同步 Listing
          </el-button>
        </el-tooltip>
        <el-button type="primary" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-select
          v-model="selectedShopId"
          placeholder="选择店铺"
          style="width: 180px"
          @change="handleShopChange"
        >
          <el-option
            v-for="shop in shopList"
            :key="shop.id"
            :label="shop.shop_name"
            :value="shop.id"
          />
          <el-option value="__refresh__" label="🔄 刷新店铺列表" />
        </el-select>
        <el-input
          v-model="searchForm.sku"
          placeholder="SKU"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-input
          v-model="searchForm.asin"
          placeholder="ASIN"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-input
          v-model="searchForm.product_type"
          placeholder="商品类型"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          style="width: 130px"
        >
          <el-option label="全部" value="" />
          <el-option label="正常在售" value="DISCOVERABLE" />
          <el-option label="被抑制" value="SUPPRESSED" />
          <el-option label="信息不完整" value="INCOMPLETE" />
        </el-select>
        <div style="display:flex;align-items:center;white-space:nowrap;">
          <el-switch
            v-model="searchForm.has_issues"
            @change="handleSearch"
          />
          <span style="margin-left:6px;font-size:13px;color:#666;">仅看有问题的</span>
        </div>
        <el-input
          v-model="searchForm.parent_sku"
          placeholder="父 SKU"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-input
          v-model="searchForm.keyword"
          placeholder="标题/品牌/SKU"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <div class="filter-actions">
        <el-button type="primary" @click="handleSearch" :loading="loading">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
        <el-button plain @click="resetSearch">
          <el-icon><Refresh /></el-icon> 重置
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-card">
      <el-table
        :data="listings"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 260px)"
        :row-class-name="getRowClassName"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
      >
        <el-table-column label="店铺名称" width="140" show-overflow-tooltip fixed="left">
          <template #default>
            <el-tag size="small" effect="plain" type="info">{{ getShopName(selectedShopId) || '-' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="主图" width="80" align="center">
          <template #default="scope">
            <el-image
              v-if="scope.row.main_image_url"
              :src="scope.row.main_image_url"
              :preview-src-list="[scope.row.main_image_url]"
              preview-teleported
              fit="cover"
              class="product-thumb-small"
            />
            <div v-else class="thumb-placeholder-small"><el-icon><Picture /></el-icon></div>
          </template>
        </el-table-column>

        <el-table-column prop="sku" label="SKU" width="160" show-overflow-tooltip fixed="left">
          <template #default="scope">
            <div style="display:flex;align-items:center;gap:4px;">
              <el-button type="primary" text size="small" @click="viewDetail(scope.row)">
                {{ scope.row.sku }}
              </el-button>
              <el-popover
                v-if="scope.row.issues && scope.row.issues.length > 0"
                placement="right"
                trigger="hover"
                :width="340"
              >
                <template #reference>
                  <el-icon
                    :size="15"
                    :color="getIssuesIconColor(scope.row.issues)"
                    style="cursor:pointer;flex-shrink:0;"
                  >
                    <WarningFilled />
                  </el-icon>
                </template>
                <div style="max-height:260px;overflow-y:auto;">
                  <div
                    v-for="(issue, idx) in scope.row.issues"
                    :key="idx"
                    style="margin-bottom:8px;padding:10px;border-radius:4px;"
                    :style="{
                      background: issue.severity === 'ERROR' ? '#fef0f0' : '#fdf6ec',
                      borderLeft: `3px solid ${issue.severity === 'ERROR' ? '#f56c6c' : '#e6a23c'}`
                    }"
                  >
                    <div style="font-weight:600;font-size:13px;color:#333;margin-bottom:4px;">
                      {{ issue.issue_code }}
                      <el-tag
                        :type="issue.severity === 'ERROR' ? 'danger' : 'warning'"
                        size="small"
                        effect="plain"
                        style="margin-left:6px;"
                      >
                        {{ issue.severity }}
                      </el-tag>
                    </div>
                    <div style="font-size:12px;color:#666;line-height:1.5;">
                      {{ issue.message }}
                    </div>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="asin" label="ASIN" width="120" show-overflow-tooltip>
          <template #default="scope">
            <a
              v-if="scope.row.asin && scope.row.marketplace_id"
              :href="`https://${getMarketplaceDomain(scope.row.marketplace_id)}/dp/${scope.row.asin}`"
              target="_blank"
              class="asin-link"
            >
              {{ scope.row.asin }}
            </a>
            <span v-else style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.asin }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="item_name" label="商品标题" min-width="240" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-weight:500;color:#1a1a2e;">{{ scope.row.item_name }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="brand" label="品牌" width="110" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#555;">{{ scope.row.brand }}</span>
          </template>
        </el-table-column>

        <el-table-column label="价格" width="110" align="right">
          <template #default="scope">
            <span v-if="scope.row.list_price !== undefined && scope.row.list_price !== null" style="font-weight:600;color:#1a1a2e;">
              {{ scope.row.list_price }} {{ scope.row.list_price_currency || '' }}
            </span>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="140" align="center">
          <template #default="scope">
            <el-tooltip
              v-if="getStatusList(scope.row.status).length > 1"
              effect="dark"
              :content="getStatusList(scope.row.status).join(', ')"
              placement="top"
            >
              <el-tag :type="getStatusType(scope.row.status)" size="small" effect="dark" round>
                {{ getStatusText(scope.row.status) }}
              </el-tag>
            </el-tooltip>
            <el-tag v-else :type="getStatusType(scope.row.status)" size="small" effect="dark" round>
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="product_type" label="商品类型" width="140" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-size:12px;color:#888;">{{ scope.row.product_type }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="parentage_level" label="层级" width="80" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.parentage_level === 'parent'" type="warning" size="small" effect="plain">父体</el-tag>
            <el-tag v-else-if="scope.row.parentage_level === 'child'" type="success" size="small" effect="plain">子体</el-tag>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="parent_sku" label="父 SKU" width="130" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.parent_sku }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="variation_theme" label="变体主题" width="120" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-size:12px;color:#888;">{{ scope.row.variation_theme }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="fn_sku" label="FNSKU" width="130" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.fn_sku }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ formatDate(scope.row.sync_time) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="scope">
            <el-tooltip content="查看与修改" placement="top">
              <el-button type="primary" link @click="viewDetail(scope.row)">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="同步最新数据" placement="top">
              <el-button
                type="warning"
                link
                :loading="syncListingLoading === scope.row.sku"
                @click="syncSingleListing(scope.row.sku)"
              >
                <el-icon><RefreshRight /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="同步到产品" placement="top">
              <el-button
                type="warning"
                link
                :loading="syncToProductLoading === scope.row.sku"
                @click="syncToProduct(scope.row.sku)"
              >
                <el-icon><Connection /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          :hide-on-single-page="false"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- Listing 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`Listing 详情 - ${currentListing?.sku}`"
      width="80%"
      :destroy-on-close="true"
      align-center
    >
      <div v-loading="detailLoading">
        <div v-if="listingDetail" class="listing-detail">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom:16px;"
          >
            <template #title>
              提示：可修改 标题、价格、描述、卖点 ，带有 <el-icon style="vertical-align:middle;"><Edit /></el-icon> 图标的均可修改，点击保存后即提交到 Amazon。
            </template>
          </el-alert>
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
            <el-button type="warning" size="small" :loading="syncDetailLoading" @click="syncDetail">
              <el-icon><RefreshRight /></el-icon> 同步最新数据
            </el-button>
          </div>
          <!-- 基础信息 -->
          <div class="detail-section">
            <h4>基础信息</h4>
            <el-descriptions :column="3" border>
              <el-descriptions-item label="SKU">{{ listingDetail.sku }}</el-descriptions-item>
              <el-descriptions-item label="ASIN">{{ listingDetail.asin || '-' }}</el-descriptions-item>
              <el-descriptions-item label="FNSKU">{{ listingDetail.fn_sku || '-' }}</el-descriptions-item>
              <el-descriptions-item label="市场ID">{{ listingDetail.marketplace_id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="商品类型">{{ listingDetail.product_type || '-' }}</el-descriptions-item>
              <el-descriptions-item label="状况">{{ listingDetail.condition_type || '-' }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <div class="status-tags">
                  <el-tag
                    v-for="s in getStatusList(listingDetail.status)"
                    :key="s"
                    :type="getSingleStatusType(s)"
                    size="small"
                    style="margin-right: 6px; margin-bottom: 4px"
                  >
                    {{ getSingleStatusText(s) }}
                  </el-tag>
                </div>
              </el-descriptions-item>
              <el-descriptions-item label="层级">
                <el-tag v-if="listingDetail.parentage_level === 'parent'" type="warning" size="small">父体</el-tag>
                <el-tag v-else-if="listingDetail.parentage_level === 'child'" type="success" size="small">子体</el-tag>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="变体主题">{{ listingDetail.variation_theme || '-' }}</el-descriptions-item>
              <el-descriptions-item label="父 SKU">{{ listingDetail.parent_sku || '-' }}</el-descriptions-item>
              <el-descriptions-item label="品牌">{{ listingDetail.brand || '-' }}</el-descriptions-item>
              <el-descriptions-item label="价格">
                <template v-if="editingSection === 'price'">
                  <div style="display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-size:13px;color:#333;white-space:nowrap;min-width:60px;">标准售价:</span>
                      <el-input-number v-model="editForm.standardPrice" :min="0" :precision="2" style="width:150px;" />
                      <span style="font-size:12px;color:#888;white-space:nowrap;">{{ getPriceCurrency() }}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-size:13px;color:#333;white-space:nowrap;min-width:60px;">促销价:</span>
                      <el-input-number v-model="editForm.salePrice" :min="0" :precision="2" style="width:150px;" />
                      <span style="font-size:12px;color:#888;white-space:nowrap;">{{ getPriceCurrency() }} (选填)</span>
                    </div>
                    <template v-if="editForm.salePrice > 0">
                      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:13px;color:#333;white-space:nowrap;min-width:60px;">促销时段:</span>
                        <el-date-picker v-model="editForm.saleStartDate" type="datetime" placeholder="开始时间" value-format="YYYY-MM-DDTHH:mm:ss[Z]" style="width:190px;" />
                        <el-date-picker v-model="editForm.saleEndDate" type="datetime" placeholder="结束时间" value-format="YYYY-MM-DDTHH:mm:ss[Z]" style="width:190px;" />
                      </div>
                    </template>
                    <div style="display:flex;gap:8px;">
                      <el-button type="primary" size="small" :loading="editSaving" @click="saveEdit">保存</el-button>
                      <el-button size="small" @click="cancelEdit">取消</el-button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div>
                    <div v-if="getPriceDisplay().primary !== null">
                      <span style="font-weight:600;color:#1a1a2e;font-size:15px;">
                        {{ getPriceDisplay().primary }} {{ getPriceCurrency() }}
                      </span>
                    </div>
                    <div v-if="getPriceDisplay().msrp !== null" style="font-size:12px;color:#999;text-decoration:line-through;margin-top:2px;">
                      MSRP {{ getPriceDisplay().msrp }} {{ listingDetail.list_price_currency || getPriceCurrency() }}
                    </div>
                    <span v-if="getPriceDisplay().primary === null && getPriceDisplay().msrp === null" style="color:#bbb;">-</span>
                    <el-button type="primary" size="small" style="margin-left:8px;" @click="startEdit('price')">
                      <el-icon><Edit /></el-icon> 编辑
                    </el-button>
                  </div>
                </template>
              </el-descriptions-item>
              <el-descriptions-item label="商品标题" :span="3">
                <template v-if="editingSection === 'title'">
                  <el-input v-model="editForm.title" type="textarea" :rows="2" style="flex:1;" />
                  <div style="display:flex;gap:8px;margin-top:8px;">
                    <el-button type="primary" size="small" :loading="editSaving" @click="saveEdit">保存</el-button>
                    <el-button size="small" @click="cancelEdit">取消</el-button>
                  </div>
                </template>
                <template v-else>
                  <span>{{ listingDetail.item_name || '-' }}</span>
                  <el-button type="primary" size="small" style="margin-left:8px;" @click="startEdit('title')">
                    <el-icon><Edit /></el-icon> 编辑
                  </el-button>
                </template>
              </el-descriptions-item>
              <el-descriptions-item label="同步时间">{{ formatDate(listingDetail.sync_time) }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDate(listingDetail.created_at) }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ formatDate(listingDetail.updated_at) }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 商品描述 -->
          <div class="detail-section">
            <div class="section-header">
              <h4>商品描述</h4>
              <el-button v-if="editingSection !== 'description'" type="primary" size="small" @click="startEdit('description')">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
            </div>
            <template v-if="editingSection === 'description'">
              <el-input v-model="editForm.description" type="textarea" :rows="5" />
              <div style="display:flex;gap:8px;margin-top:8px;">
                <el-button type="primary" size="small" :loading="editSaving" @click="saveEdit">保存</el-button>
                <el-button size="small" @click="cancelEdit">取消</el-button>
              </div>
            </template>
            <template v-else-if="listingDetail.product_description">
              <div class="description-box">{{ listingDetail.product_description }}</div>
            </template>
            <el-empty v-else description="暂无描述" :image-size="60" />
          </div>

          <!-- Issues -->
          <div v-if="listingDetail.issues && listingDetail.issues.length > 0" class="detail-section">
            <h4>问题/警告 ({{ listingDetail.issues.length }})</h4>
            <el-alert
              v-for="(issue, idx) in listingDetail.issues"
              :key="idx"
              :title="issue.message || issue.code || '问题'"
              :type="issue.severity === 'ERROR' ? 'error' : 'warning'"
              :closable="false"
              style="margin-bottom: 8px"
            />
          </div>

          <!-- Bullet Points -->
          <div class="detail-section">
            <div class="section-header">
              <h4>卖点{{ listingDetail.bullets?.length ? ` (${listingDetail.bullets.length})` : '' }}</h4>
              <el-button v-if="editingSection !== 'bullets'" type="primary" size="small" @click="startEdit('bullets')">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
            </div>
            <template v-if="editingSection === 'bullets'">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div v-for="(bullet, idx) in editForm.bullets" :key="idx" style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:13px;color:#888;min-width:20px;flex-shrink:0;">{{ idx + 1 }}.</span>
                  <el-input v-model="editForm.bullets[idx]" :placeholder="`第 ${idx + 1} 点`" maxlength="500" show-word-limit />
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;">
                <el-button type="primary" size="small" :loading="editSaving" @click="saveEdit">保存</el-button>
                <el-button size="small" @click="cancelEdit">取消</el-button>
              </div>
            </template>
            <template v-else-if="listingDetail.bullets && listingDetail.bullets.length > 0">
              <el-table :data="listingDetail.bullets" stripe border size="small" style="width: 100%">
                <el-table-column type="index" label="序号" width="60" align="center" />
                <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip />
                <el-table-column prop="language_tag" label="语言" width="100" align="center" />
              </el-table>
            </template>
            <el-empty v-else description="暂无卖点" :image-size="60" />
          </div>

          <!-- 图片列表 -->
          <div v-if="listingDetail.images && listingDetail.images.length > 0" class="detail-section">
            <h4>图片 ({{ listingDetail.images.length }})</h4>
            <div class="image-list">
              <div
                v-for="img in listingDetail.images"
                :key="img.sort_order"
                class="image-item"
              >
                <el-image
                  :src="img.media_location"
                  fit="cover"
                  :preview-src-list="listingDetail.images.map(i => i.media_location)"
                  preview-teleported
                  style="width: 120px; height: 120px; border-radius: 6px"
                />
                <div class="image-label">{{ img.image_type }}</div>
              </div>
            </div>
          </div>

          <!-- Offers -->
          <div v-if="listingDetail.offers && listingDetail.offers.length > 0" class="detail-section">
            <h4>报价信息 ({{ listingDetail.offers.length }})</h4>
            <el-table :data="listingDetail.offers" stripe border size="small" style="width: 100%">
              <el-table-column prop="currency" label="币种" width="80" align="center" />
              <el-table-column prop="audience" label="受众" width="100" align="center" />
              <el-table-column prop="our_price" label="售价" width="120" align="right" />
              <el-table-column prop="start_at" label="开始时间" width="160" align="center">
                <template #default="scope">
                  {{ formatDate(scope.row.start_at) }}
                </template>
              </el-table-column>
              <el-table-column prop="end_at" label="结束时间" width="160" align="center">
                <template #default="scope">
                  {{ formatDate(scope.row.end_at) }}
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Attributes JSON -->
          <div v-if="listingDetail.attributes_json" class="detail-section">
            <h4>原始属性 (JSON)</h4>
            <el-input
              type="textarea"
              :rows="6"
              :model-value="formatJson(listingDetail.attributes_json)"
              readonly
              resize="none"
            />
          </div>
        </div>
        <el-empty v-else description="暂无详情数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useListQuerySync } from '@/composables/useListQuerySync.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, RefreshRight, Goods, Picture, WarningFilled, Edit, Connection } from '@element-plus/icons-vue'
import {
  getAmazonListings,
  getAmazonListing,
  syncAmazonListings,
  syncListingToProduct,
  patchAmazonListing,
  syncAmazonListing
} from '@/services/api.js'
import { useShopCache } from '@/composables/useShopCache'

export default {
  name: 'AmazonListingView',
  components: {
    Search,
    Refresh,
    RefreshRight,
    Goods,
    Picture,
    WarningFilled,
    Edit,
    Connection
  },
  setup() {
    const loading = ref(false)
    const syncLoading = ref(false)
    const listings = ref([])

    const { shopList, fetchShopList, refreshShopList, getShopName, defaultShopId } = useShopCache()
    const selectedShopId = ref(null)

    // 搜索表单
    const searchForm = reactive({
      sku: '',
      asin: '',
      product_type: '',
      status: '',
      parent_sku: '',
      keyword: '',
      has_issues: false
    })

    // 分页状态
    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const { initFromQuery, syncQuery } = useListQuerySync({
      page: { get: () => pagination.page, set: v => pagination.page = v, type: 'number', default: 1 },
      page_size: { get: () => pagination.page_size, set: v => pagination.page_size = v, type: 'number', default: 20 },
      sku: { get: () => searchForm.sku, set: v => searchForm.sku = v },
      asin: { get: () => searchForm.asin, set: v => searchForm.asin = v },
      product_type: { get: () => searchForm.product_type, set: v => searchForm.product_type = v },
      status: { get: () => searchForm.status, set: v => searchForm.status = v },
      parent_sku: { get: () => searchForm.parent_sku, set: v => searchForm.parent_sku = v },
      keyword: { get: () => searchForm.keyword, set: v => searchForm.keyword = v },
      has_issues: { get: () => searchForm.has_issues, set: v => searchForm.has_issues = v, type: 'boolean', default: false }
    })

    // 详情对话框
    const detailDialogVisible = ref(false)
    const detailLoading = ref(false)
    const syncToProductLoading = ref(null)
    const syncListingLoading = ref(null)
    const syncDetailLoading = ref(false)
    const currentListing = ref(null)
    const listingDetail = ref(null)

    // 编辑状态
    const editingSection = ref(null)
    const editSaving = ref(false)
    const editForm = reactive({
      title: '',
      standardPrice: 0,
      salePrice: 0,
      saleStartDate: null,
      saleEndDate: null,
      description: '',
      bullets: ['', '', '', '', '']
    })

    // 获取 Listing 列表
    const fetchListings = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncQuery()
      loading.value = true
      try {
        const params = {
          shop_id: selectedShopId.value,
          page: pagination.page,
          page_size: pagination.page_size
        }

        if (searchForm.sku) params.sku = searchForm.sku
        if (searchForm.asin) params.asin = searchForm.asin
        if (searchForm.product_type) params.product_type = searchForm.product_type
        if (searchForm.status) params.status = searchForm.status
        if (searchForm.parent_sku) params.parent_sku = searchForm.parent_sku
        if (searchForm.keyword) params.keyword = searchForm.keyword
        if (searchForm.has_issues) params.has_issues = '1'

        const response = await getAmazonListings(params)

        if (response.data.status === 'success') {
          const data = response.data.data || {}
          listings.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取 Listing 列表失败')
          listings.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取 Listing 列表失败:', error)
        ElMessage.error('获取 Listing 列表失败: ' + (error.response?.data?.message || error.message))
        listings.value = []
        pagination.total = 0
      } finally {
        loading.value = false
      }
    }

    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      fetchListings()
    }

    // 重置搜索
    const resetSearch = () => {
      searchForm.sku = ''
      searchForm.asin = ''
      searchForm.product_type = ''
      searchForm.status = ''
      searchForm.parent_sku = ''
      searchForm.keyword = ''
      searchForm.has_issues = false
      pagination.page = 1
      pagination.page_size = 20
      fetchListings()
    }

    // 刷新数据
    const refreshData = () => {
      fetchListings()
    }

    // 切换店铺
    const handleShopChange = async (val) => {
      if (val === '__refresh__') {
        await refreshShopList()
        selectedShopId.value = defaultShopId()
        pagination.page = 1
        fetchListings()
        return
      }
      pagination.page = 1
      fetchListings()
    }

    // 同步 Listing
    const syncListings = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncLoading.value = true
      try {
        const response = await syncAmazonListings({
          shop_id: selectedShopId.value,
          included_data: ['summaries', 'attributes', 'issues'],
          page_size: 20
        })
        if (response.data.status === 'success') {
          const syncData = response.data.data || {}
          if (syncData.deleted_listings > 0) {
            ElMessage.warning(`本次同步标记了 ${syncData.deleted_listings} 条已删除的 Listing（在 Amazon 后台已被删除）`)
          } else {
            ElMessage.success(response.data.message || 'Listing 同步完成')
          }
          await fetchListings()
        } else {
          ElMessage.error(response.data.message || '同步失败')
        }
      } catch (error) {
        console.error('同步 Listing 失败:', error)
        ElMessage.error('同步 Listing 失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncLoading.value = false
      }
    }

    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      fetchListings()
    }

    // 每页数量变化
    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      fetchListings()
    }

    // 查看详情
    const viewDetail = async (row) => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      currentListing.value = row
      detailDialogVisible.value = true
      detailLoading.value = true
      listingDetail.value = null

      try {
        const response = await getAmazonListing(row.sku, selectedShopId.value)
        if (response.data.status === 'success') {
          listingDetail.value = response.data.data || null
        } else {
          ElMessage.error(response.data.message || '获取 Listing 详情失败')
        }
      } catch (error) {
        console.error('获取 Listing 详情失败:', error)
        ElMessage.error('获取 Listing 详情失败: ' + (error.response?.data?.message || error.message))
      } finally {
        detailLoading.value = false
      }
    }

    // 同步 Listing 到产品
    const syncToProduct = async (sku) => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncToProductLoading.value = sku
      try {
        const response = await syncListingToProduct(sku, selectedShopId.value)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || `产品 ${sku} 已同步`)
        } else {
          ElMessage.error(response.data.message || '同步到产品失败')
        }
      } catch (error) {
        console.error('同步到产品失败:', error)
        ElMessage.error('同步到产品失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncToProductLoading.value = null
      }
    }

    // 同步单个 Listing
    const syncSingleListing = async (sku) => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncListingLoading.value = sku
      try {
        await syncAmazonListing(sku, selectedShopId.value)
        ElMessage.success(`Listing ${sku} 同步成功`)
        await fetchListings()
      } catch (error) {
        console.error('同步 Listing 失败:', error)
        ElMessage.error('同步失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncListingLoading.value = null
      }
    }

    // ===== Listing 编辑方法 =====
    const startEdit = (section) => {
      const detail = listingDetail.value
      if (!detail) return

      if (section === 'title') {
        editForm.title = typeof detail.item_name === 'string'
          ? detail.item_name
          : (detail.item_name?.[0]?.value || '')
      } else if (section === 'price') {
        const offers = detail.offers || []
        const primaryOffer = offers.find(o => o.audience === 'ALL') || offers[0]
        editForm.standardPrice = primaryOffer?.our_price ?? detail.list_price ?? 0
        editForm.salePrice = 0
        editForm.saleStartDate = null
        editForm.saleEndDate = null
      } else if (section === 'description') {
        editForm.description = typeof detail.product_description === 'string'
          ? detail.product_description || ''
          : (detail.product_description?.[0]?.value || '')
      } else if (section === 'bullets') {
        const existingBullets = detail.bullets || []
        for (let i = 0; i < 5; i++) {
          editForm.bullets[i] = existingBullets[i]?.content || ''
        }
      }
      editingSection.value = section
    }

    const cancelEdit = () => {
      editingSection.value = null
    }

    const saveEdit = async () => {
      if (!listingDetail.value || !selectedShopId.value) return

      const sku = listingDetail.value.sku
      const shopId = selectedShopId.value
      const productType = listingDetail.value.product_type || ''

      let patchValue
      let patchPath
      let sectionLabel = ''

      if (editingSection.value === 'title') {
        patchPath = '/attributes/item_name'
        patchValue = [{ value: editForm.title, language_tag: 'en_US' }]
        sectionLabel = '标题'
      } else if (editingSection.value === 'price') {
        patchPath = '/attributes/purchasable_offer'
        sectionLabel = '价格'
        const currencyCode = getPriceCurrency()
        const marketplaceId = listingDetail.value.marketplace_id || ''
        const purchasableOffer = {
          marketplace_id: marketplaceId,
          currency: currencyCode,
          our_price: [
            {
              schedule: [
                { value_with_tax: Number(editForm.standardPrice) }
              ]
            }
          ]
        }
        if (editForm.salePrice > 0 && editForm.saleStartDate && editForm.saleEndDate) {
          purchasableOffer.discounted_price = [
            {
              schedule: [
                {
                  value_with_tax: Number(editForm.salePrice),
                  start_at: editForm.saleStartDate,
                  end_at: editForm.saleEndDate
                }
              ]
            }
          ]
        }
        patchValue = [purchasableOffer]
      } else if (editingSection.value === 'description') {
        patchPath = '/attributes/product_description'
        patchValue = [{ value: editForm.description, language_tag: 'en_US' }]
        sectionLabel = '描述'
      } else if (editingSection.value === 'bullets') {
        patchPath = '/attributes/bullet_point'
        patchValue = editForm.bullets
          .filter(b => b.trim() !== '')
          .map(b => ({ value: b, language_tag: 'en_US' }))
        sectionLabel = '五点描述'
      } else {
        return
      }

      try {
        await ElMessageBox.confirm(
          `确认修改 ${listingDetail.value.sku} 的${sectionLabel}并提交到 Amazon？`,
          '确认修改',
          { confirmButtonText: '确认提交', cancelButtonText: '取消', type: 'warning' }
        )
      } catch {
        return
      }

      editSaving.value = true
      try {
        const response = await patchAmazonListing(sku, {
          shop_id: shopId,
          product_type: productType,
          patches: [{ op: 'replace', path: patchPath, value: patchValue }]
        })

        if (response.data.status === 'success' && response.data.data?.status === 'ACCEPTED') {
          if (editingSection.value === 'title') {
            listingDetail.value.item_name = editForm.title
          } else if (editingSection.value === 'price') {
            if (!listingDetail.value.offers) listingDetail.value.offers = []
            const primaryOffer = listingDetail.value.offers.find(o => o.audience === 'ALL')
            if (primaryOffer) {
              primaryOffer.our_price = Number(editForm.standardPrice)
            } else {
              listingDetail.value.offers.unshift({
                currency: getPriceCurrency(),
                audience: 'ALL',
                our_price: Number(editForm.standardPrice),
                start_at: null,
                end_at: null
              })
            }
          } else if (editingSection.value === 'description') {
            listingDetail.value.product_description = editForm.description
          } else if (editingSection.value === 'bullets') {
            listingDetail.value.bullets = editForm.bullets
              .filter(b => b.trim() !== '')
              .map((b, i) => ({ content: b, language_tag: 'en_US', sort_order: i + 1 }))
          }
          ElMessage.success('修改已提交，Amazon 处理中...')
          editingSection.value = null
        } else {
          const issues = response.data.data?.issues
          if (issues && issues.length > 0) {
            ElMessage.warning(issues.map(i => i.message).join('; '))
          } else {
            ElMessage.error(response.data.message || '修改失败')
          }
        }
      } catch (error) {
        console.error('修改 Listing 失败:', error)
        ElMessage.error('修改失败: ' + (error.response?.data?.message || error.message))
      } finally {
        editSaving.value = false
      }
    }

    const syncDetail = async () => {
      if (!listingDetail.value || !selectedShopId.value) return

      syncDetailLoading.value = true
      try {
        await syncAmazonListing(listingDetail.value.sku, selectedShopId.value)
        const response = await getAmazonListing(listingDetail.value.sku, selectedShopId.value)
        if (response.data.status === 'success') {
          listingDetail.value = response.data.data || null
          ElMessage.success('同步成功')
        } else {
          ElMessage.error(response.data.message || '同步失败')
        }
      } catch (error) {
        console.error('同步 Listing 详情失败:', error)
        ElMessage.error('同步失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncDetailLoading.value = false
      }
    }

    // Issues 图标颜色
    const getIssuesIconColor = (issues) => {
      if (!issues || issues.length === 0) return ''
      if (issues.some(i => i.severity === 'ERROR')) return '#f56c6c'
      return '#e6a23c'
    }

    // 行样式：有问题的行高亮
    const getRowClassName = ({ row }) => {
      if (row.issues && row.issues.length > 0) {
        const hasError = row.issues.some(i => i.severity === 'ERROR')
        return hasError ? 'listing-row has-error' : 'listing-row has-warning'
      }
      return 'listing-row'
    }

    // 解析状态列表（逗号分隔）
    const getStatusList = (status) => {
      if (!status) return []
      return status.split(',').map(s => s.trim()).filter(Boolean)
    }

    // 单个状态的样式
    const getSingleStatusType = (status) => {
      const typeMap = {
        'BUYABLE': 'success',
        'DISCOVERABLE': 'warning',
        'SUPPRESSED': 'danger',
        'DELETED': 'info',
        'INCOMPLETE': 'warning'
      }
      return typeMap[status] || 'info'
    }

    // 单个状态的文本
    const getSingleStatusText = (status) => {
      const textMap = {
        'BUYABLE': '可购买',
        'DISCOVERABLE': '可发现',
        'SUPPRESSED': '被抑制',
        'DELETED': '已删除',
        'INCOMPLETE': '信息不完整'
      }
      return textMap[status] || status
    }

    // 综合状态样式（列表用，按优先级判断）
    const getStatusType = (status) => {
      const list = getStatusList(status)
      if (list.length === 0) return 'info'
      // 优先级：SUPPRESSED > DELETED > BUYABLE > DISCOVERABLE > 其他
      if (list.includes('SUPPRESSED')) return 'danger'
      if (list.includes('DELETED')) return 'info'
      if (list.includes('BUYABLE')) return 'success'
      if (list.includes('DISCOVERABLE')) return 'warning'
      return 'info'
    }

    // 综合状态文本（列表用）
    const getStatusText = (status) => {
      const list = getStatusList(status)
      if (list.length === 0) return status || '-'
      // 优先级：SUPPRESSED > DELETED > BUYABLE > DISCOVERABLE > 其他
      if (list.includes('SUPPRESSED')) return '被抑制'
      if (list.includes('DELETED')) return '已删除'
      if (list.includes('BUYABLE')) return '正常在售'
      if (list.includes('DISCOVERABLE')) return '仅可发现'
      return list[0]
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
    }

    // 格式化 JSON
    const formatJson = (jsonStr) => {
      try {
        const obj = JSON.parse(jsonStr || '{}')
        return JSON.stringify(obj, null, 2)
      } catch {
        return jsonStr || ''
      }
    }

    // marketplace_id 对应亚马逊域名
    const getMarketplaceDomain = (marketplaceId) => {
      const domainMap = {
        'ATVPDKIKX0DER': 'amazon.com',
        'A2EUQ1WTGCTBG2': 'amazon.ca',
        'A1AM78C64UM0Y8': 'amazon.com.mx',
        'A2Q3Y263D00KWC': 'amazon.com.br',
        'A2VIGQ35RCS4UG': 'amazon.ae',
        'A1PA6795UKMFR9': 'amazon.de',
        'A1RKKUPIHCS9HS': 'amazon.es',
        'A13V1IB3VIYZZH': 'amazon.fr',
        'APJ6JRA9NG5U4': 'amazon.it',
        'A1F83G8C2ARO7P': 'amazon.co.uk',
        'A21TJRUUN4KGV': 'amazon.in',
        'A17E79C6D8DWNP': 'amazon.sa',
        'A33AVAJ2PDY3EV': 'amazon.com.tr',
        'A19VAU5U5O7RUS': 'amazon.sg',
        'A39IBJ37TRP1C6': 'amazon.co.jp',
        'A3H6HPSLHAK3XG': 'amazon.com.au',
        'A1805IZSGTT6HS': 'amazon.eg',
        'A2NODRKZP88ZB9': 'amazon.se',
        'A1C3SOZRARQ6R3': 'amazon.pl',
        'A1ZFFQZ3HTUKT9': 'amazon.be'
      }
      return domainMap[marketplaceId] || 'amazon.com'
    }

    // 获取当前 listing 的币种
    const getPriceCurrency = () => {
      const detail = listingDetail.value
      if (!detail) return 'USD'
      const offers = detail.offers || []
      if (offers.length > 0 && offers[0].currency) return offers[0].currency
      return detail.list_price_currency || 'USD'
    }

    // 获取价格展示数据：primary=实际售价, msrp=划线价
    const getPriceDisplay = () => {
      const detail = listingDetail.value
      const result = { primary: null, msrp: null }
      if (!detail) return result
      const offers = detail.offers || []
      const primaryOffer = offers.find(o => o.audience === 'ALL') || offers[0]
      if (primaryOffer && primaryOffer.our_price != null) {
        result.primary = primaryOffer.our_price
      }
      if (detail.list_price != null && detail.list_price !== result.primary) {
        result.msrp = detail.list_price
      }
      return result
    }

    onMounted(async () => {
      await fetchShopList()
      if (shopList.value.length > 0) {
        selectedShopId.value = defaultShopId()
      }
      initFromQuery()
      fetchListings()
    })

    return {
      loading,
      syncLoading,
      listings,
      searchForm,
      pagination,
      detailDialogVisible,
      detailLoading,
      syncToProductLoading,
      syncToProduct,
      syncListingLoading,
      syncSingleListing,
      syncDetailLoading,
      syncDetail,
      currentListing,
      listingDetail,
      shopList,
      selectedShopId,
      fetchListings,
      handleSearch,
      resetSearch,
      refreshData,
      syncListings,
      handlePageChange,
      handleSizeChange,
      handleShopChange,
      viewDetail,
      getStatusType,
      getStatusText,
      getShopName,
      formatDate,
      formatJson,
      getMarketplaceDomain,
      getStatusList,
      getSingleStatusType,
      getSingleStatusText,
      getIssuesIconColor,
      getRowClassName,
      getPriceCurrency,
      getPriceDisplay,
      editingSection,
      editSaving,
      editForm,
      startEdit,
      cancelEdit,
      saveEdit
    }
  }
}
</script>

<style scoped>
.amazon-listing-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 24px 40px;
}

/* ===== 头部 ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}
.page-title {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 6px;
  letter-spacing: -0.5px;
}
.page-subtitle {
  font-size: 14px;
  color: #888;
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 10px;
}

/* ===== 筛选栏 ===== */
.filter-bar {
  background: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}
.filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* ===== 表格卡片 ===== */
.table-card {
  background: #fff;
  border-radius: 14px;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
  overflow: hidden;
}
:deep(.el-table) { --el-table-border-color: #f0f0f0; }
:deep(.listing-row:hover) { background-color: #fafbff !important; }
:deep(.listing-row.has-error) { background-color: #fff8f8 !important; }
:deep(.listing-row.has-warning) { background-color: #fffbf5 !important; }
:deep(.listing-row.has-error td:first-child),
:deep(.listing-row.has-warning td:first-child) { position: relative; }
:deep(.listing-row.has-error td:first-child::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #f56c6c;
}
:deep(.listing-row.has-warning td:first-child::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #e6a23c;
}

/* ASIN 链接 */
.asin-link {
  font-family: monospace;
  font-size: 12px;
  color: #409eff;
  text-decoration: none;
}
.asin-link:hover {
  text-decoration: underline;
  color: #66b1ff;
}

/* 小图 */
.product-thumb-small {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  background: #fafafa;
  cursor: pointer;
}
.thumb-placeholder-small {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 18px;
  margin: 0 auto;
}

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

.listing-detail .detail-section {
  margin-top: 20px;
}

.listing-detail .detail-section:first-child {
  margin-top: 0;
}

.listing-detail .detail-section h4 {
  margin-bottom: 12px;
  color: #1a1a2e;
  font-size: 16px;
  font-weight: 600;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.section-header h4 {
  margin-bottom: 0 !important;
}

.description-box {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  line-height: 1.6;
  color: #555;
  white-space: pre-wrap;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.image-label {
  font-size: 12px;
  color: #666;
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .amazon-listing-page {
    padding: 16px 16px 40px;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-group {
    justify-content: stretch;
  }
  .image-list {
    gap: 8px;
  }
  .description-box {
    padding: 10px;
    font-size: 13px;
  }
  .listing-detail .detail-section h4 {
    font-size: 14px;
  }
}
</style>
