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
          <el-button type="warning" @click="syncListings" :loading="syncLoading" :disabled="!!syncListingLoading || !!syncToProductLoading">
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
        height="calc(100vh - 340px)"
        :row-class-name="getRowClassName"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600,textAlign:'center'}"
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

        <el-table-column prop="sku" label="SKU" width="175" show-overflow-tooltip fixed="left">
          <template #default="scope">
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-family:monospace;font-size:13px;font-weight:500;color:#1a1a2e;">{{ scope.row.sku }}</span>
              <el-tooltip content="复制" placement="top">
                <el-icon style="cursor:pointer;color:#909399;flex-shrink:0;" @click="copyText(scope.row.sku)"><DocumentCopy /></el-icon>
              </el-tooltip>
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

        <el-table-column prop="asin" label="ASIN" width="145">
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
            <el-popover v-if="scope.row.competitor_asins?.length" trigger="hover" placement="right" width="240">
              <template #reference>
                <div class="listing-competitor-summary"><span>竞品</span><a :href="`https://www.amazon.com/dp/${scope.row.competitor_asins[0]}`" target="_blank" rel="noopener noreferrer">{{ scope.row.competitor_asins[0] }}</a><span v-if="scope.row.competitor_asins.length>1">…</span></div>
              </template>
              <div class="listing-competitor-links"><strong>竞品 ASIN · {{ scope.row.competitor_asins.length }} 个</strong><a v-for="item in scope.row.competitor_asins" :key="item" :href="`https://www.amazon.com/dp/${item}`" target="_blank" rel="noopener noreferrer">{{ item }} ↗</a></div>
            </el-popover>
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
            <template v-if="scope.row.our_price !== undefined && scope.row.our_price !== null">
              <span style="font-weight:600;color:#1a1a2e;">
                {{ scope.row.our_price }} {{ scope.row.currency || '' }}
              </span>
              <span v-if="scope.row.discounted_price !== undefined && scope.row.discounted_price !== null && scope.row.discounted_price !== scope.row.our_price" style="font-size:12px;color:#999;text-decoration:line-through;margin-left:4px;">
                {{ scope.row.discounted_price }}
              </span>
            </template>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="BSR 排名" width="260" align="left" header-align="center">
          <template #default="scope">
            <div v-if="scope.row.bsr_rank" class="bsr-cell" @click="openBsrTrendDialog(scope.row)">
              <div class="bsr-badges">
                <span class="bsr-badge bsr-badge-main">
                  <span class="bsr-rank">#{{ formatNumber(scope.row.bsr_rank) }}</span>
                  <span class="bsr-in">in</span>
                  <span class="bsr-category" :title="scope.row.bsr_category">{{ scope.row.bsr_category }}</span>
                </span>
                <span v-if="scope.row.bsr_sub_rank" class="bsr-badge bsr-badge-sub">
                  <span class="bsr-rank">#{{ formatNumber(scope.row.bsr_sub_rank) }}</span>
                  <span class="bsr-in">in</span>
                  <span class="bsr-category" :title="scope.row.bsr_sub_category">{{ scope.row.bsr_sub_category }}</span>
                </span>
              </div>
              <div v-if="scope.row.bsr_trend === 'up'" class="bsr-trend bsr-up">
                <el-icon><ArrowUp /></el-icon> {{ formatBsrPct(scope.row.bsr_change_pct) }}% <span class="bsr-prev">({{ formatNumber(scope.row.bsr_prev_rank) }})</span>
              </div>
              <div v-else-if="scope.row.bsr_trend === 'down'" class="bsr-trend bsr-down">
                <el-icon><ArrowDown /></el-icon> {{ formatBsrPct(scope.row.bsr_change_pct) }}% <span class="bsr-prev">({{ formatNumber(scope.row.bsr_prev_rank) }})</span>
              </div>
              <div v-else-if="scope.row.bsr_trend === 'new'" class="bsr-trend bsr-new">新</div>
            </div>
            <div v-else style="text-align:center;color:#bbb;">—</div>
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

        <el-table-column label="操作" width="184" fixed="right" align="center">
          <template #default="scope">
            <el-tooltip content="查看与修改" placement="top">
              <el-button type="primary" link @click="viewDetail(scope.row)">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-tooltip>
            <el-popover placement="left" width="min(340px, calc(100vw - 24px))" trigger="hover" :show-after="150" :hide-after="180" :popper-options="{ modifiers: [{ name: 'preventOverflow', options: { altAxis: true, tether: false, padding: 12 } }] }">
              <template #reference>
                <el-button type="warning" link aria-label="同步最新数据" :loading="syncListingLoading === scope.row.sku || syncToProductLoading === scope.row.sku" :disabled="!!syncListingLoading || !!syncToProductLoading || syncLoading" @click="syncSingleListing(scope.row.sku)">
                  <el-icon><RefreshRight /></el-icon>
                </el-button>
              </template>
              <div class="listing-sync-menu">
                <section class="sync-direct">
                  <strong>直接点击图标</strong>
                  <p>同步亚马逊后台最新信息到本地 Listing。</p>
                </section>
                <section class="sync-product">
                  <strong>点击下方按钮</strong>
                  <p>将本地 Listing 信息维护到产品表。</p>
                  <el-button type="primary" size="large" :loading="syncToProductLoading === scope.row.sku" :disabled="!!syncListingLoading || !!syncToProductLoading || syncLoading" @click="syncToProduct(scope.row.sku)">维护到产品表</el-button>
                  <p class="sync-secondary">使用已保存的 Listing，保留已有 AI 申报资料。</p>
                  <p class="sync-secondary">新产品可能调用 AI；父体会同步全部子体。</p>
                </section>
              </div>
            </el-popover>
            <FeatureGuide v-if="scope.row === competitorGuideRow" feature-key="listing-competitors-v1" title="现在可以绑定竞品了" description="点击关联图标，绑定竞品 ASIN，也可开启竞品数据采集。" placement="bottom-end" :enabled="!competitorGuideClosed && !loading && !competitorTarget && !detailDialogVisible && !historyTarget && !syncVariantDialogVisible" @dismiss="competitorGuideClosed = true">
              <template #default="{ visible }"><el-tooltip content="绑定竞品 ASIN" placement="top" :disabled="visible"><el-button type="primary" link aria-label="绑定竞品ASIN" @click="openCompetitors(scope.row)"><el-icon><Connection /></el-icon></el-button></el-tooltip></template>
            </FeatureGuide>
            <el-tooltip v-else content="绑定竞品 ASIN" placement="top"><el-button type="primary" link aria-label="绑定竞品ASIN" :disabled="!scope.row.asin" @click="openCompetitors(scope.row)"><el-icon><Connection /></el-icon></el-button></el-tooltip>
            <el-tooltip content="前往工具 · 关键词反查（美国站）" placement="top"><el-button type="success" link aria-label="卖家精灵关键词" :disabled="!scope.row.asin" @click="openSellersprite(scope.row)"><el-icon><DataAnalysis /></el-icon></el-button></el-tooltip>
            <el-tooltip content="修改记录" placement="top"><el-button type="info" link aria-label="修改记录" @click="openListingHistory(scope.row)"><el-icon><Clock /></el-icon></el-button></el-tooltip>
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

    <ListingHistoryDialog v-if="historyTarget" :key="`${historyTarget.shopId}:${historyTarget.sku}`" :shop-id="historyTarget.shopId" :sku="historyTarget.sku" @close="historyTarget = null" />
    <ListingCompetitorDialog v-if="competitorTarget" :key="`${competitorTarget.shopId}:${competitorTarget.sku}`" :shop-id="competitorTarget.shopId" :sku="competitorTarget.sku" :asin="competitorTarget.asin" @close="competitorTarget=null" @saved="competitorsSaved" />

    <!-- Listing 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`Listing 详情 - ${currentListing?.sku}`"
      width="80%"
      :destroy-on-close="true"
      :close-on-click-modal="!textWriteBusy && !editingSection"
      :close-on-press-escape="!textWriteBusy && !editingSection"
      :show-close="!textWriteBusy && !editingSection"
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
              可编辑标题、价格、描述、卖点及搜索词。编辑前读取实时数据；提交已接受不代表最终生效，以回读结果为准。
            </template>
          </el-alert>
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px;gap:8px;">
            <el-tooltip content="语言标签不是翻译功能；强制切换可能新增重复内容或被平台判为无效语言。文字编辑会保留原标签。" placement="top">
              <el-tag type="info">文字语言：{{ listingLanguageTag }} · 保留原标签</el-tag>
            </el-tooltip>
            <el-tooltip
              effect="dark"
              placement="top"
              content="将当前 Listing 的标题、商品亮点、描述、五点描述、搜索关键字等字段，一键同步到同父体下的其他变体。"
            >
              <el-button
                size="small"
                :disabled="!listingDetail || !listingDetail.parent_sku || listingDetail.parentage_level === 'parent'"
                @click="openSyncVariantDialog"
              >
                <el-icon><CopyDocument /></el-icon> 同步字段到变体
              </el-button>
            </el-tooltip>
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
              <el-descriptions-item label="BSR 排名" :span="3">
                <div v-if="listingDetail.bsr_rank" class="bsr-detail-cell" @click="openBsrTrendDialog(listingDetail)">
                  <div class="bsr-badges">
                    <span class="bsr-badge bsr-badge-main">
                      <span class="bsr-rank">#{{ formatNumber(listingDetail.bsr_rank) }}</span>
                      <span class="bsr-in">in</span>
                      <span class="bsr-category" :title="listingDetail.bsr_category">{{ listingDetail.bsr_category }}</span>
                    </span>
                    <span v-if="listingDetail.bsr_sub_rank" class="bsr-badge bsr-badge-sub">
                      <span class="bsr-rank">#{{ formatNumber(listingDetail.bsr_sub_rank) }}</span>
                      <span class="bsr-in">in</span>
                      <span class="bsr-category" :title="listingDetail.bsr_sub_category">{{ listingDetail.bsr_sub_category }}</span>
                    </span>
                  </div>
                  <div v-if="listingDetail.bsr_trend === 'up'" class="bsr-trend bsr-up">
                    <el-icon><ArrowUp /></el-icon> {{ formatBsrPct(listingDetail.bsr_change_pct) }}% ({{ formatNumber(listingDetail.bsr_prev_rank) }})
                  </div>
                  <div v-else-if="listingDetail.bsr_trend === 'down'" class="bsr-trend bsr-down">
                    <el-icon><ArrowDown /></el-icon> {{ formatBsrPct(listingDetail.bsr_change_pct) }}% ({{ formatNumber(listingDetail.bsr_prev_rank) }})
                  </div>
                  <div v-else-if="listingDetail.bsr_trend === 'new'" class="bsr-trend bsr-new">新</div>
                  <el-icon style="margin-left:4px;color:#909399;"><TrendCharts /></el-icon>
                </div>
                <span v-else style="color:#bbb;">—</span>
              </el-descriptions-item>
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
                <ListingPriceEditor v-if="editingSection === 'price'" :key="`${selectedShopId}:${listingDetail.sku}`" :shop-id="selectedShopId" :sku="listingDetail.sku" @close="cancelEdit" @updated="onPriceUpdated" />
                <template v-if="editingSection !== 'price'">
                  <div>
                    <div v-if="getPriceDisplay().primary !== null">
                      <span style="font-weight:600;color:#1a1a2e;font-size:15px;">
                        {{ getPriceDisplay().primary }} {{ getPriceCurrency() }}
                      </span>
                    </div>
                    <div v-if="getPriceDisplay().msrp !== null" style="font-size:12px;color:#999;text-decoration:line-through;margin-top:2px;">
                      MSRP {{ getPriceDisplay().msrp }} {{ listingDetail.currency || getPriceCurrency() }}
                    </div>
                    <span v-if="getPriceDisplay().primary === null && getPriceDisplay().msrp === null" style="color:#bbb;">-</span>
                    <el-button type="primary" size="small" style="margin-left:8px;" @click="startEdit('price')">
                      <el-icon><Edit /></el-icon> 编辑
                    </el-button>
                  </div>
                </template>
              </el-descriptions-item>
              <el-descriptions-item label="商品标题" :span="3">
                <ListingTextEditor :key="`${selectedShopId}:${listingDetail.sku}:item_name`" v-bind="textEditorProps('item_name', '商品标题')" @updated="onTextUpdated" @busy="onTextBusy('item_name', $event)">
                  {{ listingDetail.item_name || '-' }}
                </ListingTextEditor>
              </el-descriptions-item>
              <el-descriptions-item label="商品亮点" :span="3">
                <ListingTextEditor :key="`${selectedShopId}:${listingDetail.sku}:title_differentiation`" v-bind="textEditorProps('title_differentiation', '商品亮点')" @updated="onTextUpdated" @busy="onTextBusy('title_differentiation', $event)">
                  {{ listingDetail.title_differentiation || '-' }}
                </ListingTextEditor>
              </el-descriptions-item>
              <el-descriptions-item label="同步时间">{{ formatDate(listingDetail.sync_time) }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDate(listingDetail.created_at) }}</el-descriptions-item>
              <el-descriptions-item label="最后修改时间">{{ formatDate(listingDetail.last_updated_date) }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 商品描述 -->
          <div class="detail-section">
            <div class="section-header">
              <h4>商品描述</h4>
            </div>
            <ListingTextEditor :key="`${selectedShopId}:${listingDetail.sku}:product_description`" v-bind="textEditorProps('product_description', '商品描述')" @updated="onTextUpdated" @busy="onTextBusy('product_description', $event)">
            <template v-if="listingDetail.product_description">
              <div class="description-box">{{ listingDetail.product_description }}</div>
            </template>
            <el-empty v-else description="暂无描述" :image-size="60" />
            </ListingTextEditor>
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
            </div>
            <ListingTextEditor :key="`${selectedShopId}:${listingDetail.sku}:bullet_point`" v-bind="textEditorProps('bullet_point', '卖点')" @updated="onTextUpdated" @busy="onTextBusy('bullet_point', $event)">
            <template v-if="listingDetail.bullets && listingDetail.bullets.length > 0">
              <el-table :data="listingDetail.bullets" stripe border size="small" style="width: 100%">
                <el-table-column type="index" label="序号" width="60" align="center" />
                <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip />
                <el-table-column prop="language_tag" label="语言" width="100" align="center" />
              </el-table>
            </template>
            <el-empty v-else description="暂无卖点" :image-size="60" />
            </ListingTextEditor>
          </div>

          <!-- 搜索关键字 -->
          <div class="detail-section">
            <div class="section-header">
              <h4>搜索关键字</h4>
            </div>
            <ListingTextEditor :key="`${selectedShopId}:${listingDetail.sku}:generic_keyword`" v-bind="textEditorProps('generic_keyword', '搜索关键字')" @updated="onTextUpdated" @busy="onTextBusy('generic_keyword', $event)">
            <template v-if="getGenericKeyword()">
              <div class="description-box">{{ getGenericKeyword() }}</div>
            </template>
            <el-empty v-else description="暂无搜索关键字" :image-size="60" />
            </ListingTextEditor>
          </div>

          <!-- 图片原位管理；目录图与本次提交分开，避免旧图冒充新图。 -->
          <div class="detail-section">
            <ListingImageEditor :key="`${selectedShopId}:${listingDetail.sku}:images`" :shop-id="selectedShopId" :sku="listingDetail.sku" :initial-images="listingDetail.images || []" @updated="onImagesUpdated" @busy="onTextBusy('images', $event)" />
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
        <div v-if="listingDetail" class="detail-sticky-close">
          <el-button type="primary" :disabled="textWriteBusy" @click="detailDialogVisible = false">关闭</el-button>
        </div>
        <el-empty v-else description="暂无详情数据" />
      </div>
    </el-dialog>

    <!-- 同步字段到变体弹框 -->
    <el-dialog
      v-model="syncVariantDialogVisible"
      title="同步字段到变体"
      width="640px"
      align-center
      :close-on-click-modal="false"
    >
      <div v-loading="syncVariantLoading" style="min-height:180px;">
        <div style="display:flex;gap:16px;min-height:220px;">
          <!-- 左侧：字段 -->
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
            <div style="font-weight:600;color:#1a1a2e;margin-bottom:4px;">选择要同步的字段</div>
            <el-checkbox-group v-model="syncVariantFields" style="display:flex;flex-direction:column;gap:6px;">
              <el-checkbox
                v-for="field in syncVariantFieldOptions"
                :key="field.value"
                :label="field.value"
                style="margin-right:0;"
              >
                {{ field.label }}
              </el-checkbox>
            </el-checkbox-group>
            <el-link type="primary" :underline="false" style="margin-top:8px;align-self:flex-start;" @click="syncVariantFields = syncVariantFields.length === syncVariantFieldOptions.length ? [] : syncVariantFieldOptions.map(f => f.value)">
              {{ syncVariantFields.length === syncVariantFieldOptions.length ? '全不选' : '全选' }}
            </el-link>
          </div>

          <el-divider direction="vertical" style="height:auto;" />

          <!-- 右侧：变体 -->
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
            <div style="font-weight:600;color:#1a1a2e;margin-bottom:4px;">选择目标变体</div>
            <el-checkbox-group v-model="syncVariantTargets" style="display:flex;flex-direction:column;gap:6px;">
              <el-checkbox
                v-for="variant in syncVariantOptions"
                :key="variant.sku"
                :label="variant.sku"
                style="margin-right:0;"
              >
                <span :title="variant.product_name" style="display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;">
                  {{ variant.sku }}{{ variant.product_name ? ' - ' + variant.product_name : '' }}
                </span>
              </el-checkbox>
            </el-checkbox-group>
            <div v-if="!syncVariantLoading && syncVariantOptions.length === 0" style="color:#999;font-size:13px;">
              暂无可同步的变体
            </div>
            <el-link v-if="syncVariantOptions.length > 0" type="primary" :underline="false" style="margin-top:8px;align-self:flex-start;" @click="syncVariantTargets = syncVariantTargets.length === syncVariantOptions.length ? [] : syncVariantOptions.map(v => v.sku)">
              {{ syncVariantTargets.length === syncVariantOptions.length ? '全不选' : '全选' }}
            </el-link>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="syncVariantDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncVariantSubmitLoading" :disabled="syncVariantFields.length === 0 || syncVariantTargets.length === 0" @click="submitSyncVariant">
          确认同步
        </el-button>
      </template>
    </el-dialog>

    <!-- BSR 趋势弹框 -->
    <el-dialog
      v-model="bsrTrendDialogVisible"
      :title="`BSR 趋势 - ${bsrTrendTarget?.sku || ''}`"
      width="820px"
      align-center
      :destroy-on-close="true"
      @close="closeBsrTrendDialog"
    >
      <div v-loading="bsrTrendLoading" style="min-height:320px;">
        <div v-if="bsrTrendData && bsrTrendData.trend && bsrTrendData.trend.dates && bsrTrendData.trend.dates.length > 0">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap;">
            <div class="bsr-badges">
              <span v-if="bsrTrendData.current?.bsr_rank" class="bsr-badge bsr-badge-main">
                <span class="bsr-rank">#{{ formatNumber(bsrTrendData.current.bsr_rank) }}</span>
                <span class="bsr-in">in</span>
                <span class="bsr-category" :title="bsrTrendData.current.bsr_category">{{ bsrTrendData.current.bsr_category }}</span>
              </span>
              <span v-if="bsrTrendData.current?.bsr_sub_rank" class="bsr-badge bsr-badge-sub">
                <span class="bsr-rank">#{{ formatNumber(bsrTrendData.current.bsr_sub_rank) }}</span>
                <span class="bsr-in">in</span>
                <span class="bsr-category" :title="bsrTrendData.current.bsr_sub_category">{{ bsrTrendData.current.bsr_sub_category }}</span>
              </span>
            </div>
            <div v-if="bsrTrendData.current?.bsr_trend === 'up'" class="bsr-trend bsr-up" style="font-size:16px;">
              <el-icon><ArrowUp /></el-icon> {{ formatBsrPct(bsrTrendData.current.bsr_change_pct) }}%
            </div>
            <div v-else-if="bsrTrendData.current?.bsr_trend === 'down'" class="bsr-trend bsr-down" style="font-size:16px;">
              <el-icon><ArrowDown /></el-icon> {{ formatBsrPct(bsrTrendData.current.bsr_change_pct) }}%
            </div>
            <div v-else-if="bsrTrendData.current?.bsr_trend === 'new'" class="bsr-trend bsr-new" style="font-size:16px;">新</div>
          </div>
          <div ref="bsrTrendChartRef" style="width:100%;height:360px;"></div>
        </div>
        <el-empty v-else-if="!bsrTrendLoading" description="暂无 BSR 数据" :image-size="80" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { computed, ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useListQuerySync } from '@/composables/useListQuerySync.js'
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight, Goods, Picture, WarningFilled, Edit, DocumentCopy, CopyDocument, TrendCharts, ArrowUp, ArrowDown, Clock, DataAnalysis, Connection } from '@element-plus/icons-vue'
import {
  getAmazonListings,
  getAmazonListing,
  getAmazonListingText,
  getAmazonListingBsrTrend,
  syncAmazonListings,
  syncListingToProduct,
  syncAmazonListing,
  getAmazonListingVariants,
  syncAmazonListingToVariants
} from '@/services/api.js'
import * as echarts from 'echarts'
import ListingPriceEditor from '@/components/ListingPriceEditor.vue'
import ListingTextEditor from '@/components/ListingTextEditor.vue'
import ListingImageEditor from '@/components/ListingImageEditor.vue'
import ListingHistoryDialog from '@/components/ListingHistoryDialog.vue'
import ListingCompetitorDialog from '@/components/ListingCompetitorDialog.vue'
import FeatureGuide from '@/components/FeatureGuide.vue'
import { useShopCache } from '@/composables/useShopCache'

export default {
  name: 'AmazonListingView',
  components: {
    ListingPriceEditor,
    ListingTextEditor,
    ListingImageEditor,
    ListingHistoryDialog,
    ListingCompetitorDialog,
    FeatureGuide,
    Connection,
    DataAnalysis,
    Clock,
    Search,
    Refresh,
    RefreshRight,
    Goods,
    Picture,
    WarningFilled,
    Edit,
    DocumentCopy,
    CopyDocument,
    TrendCharts,
    ArrowUp,
    ArrowDown
  },
  setup() {
    const router = useRouter()
    const loading = ref(false)
    const syncLoading = ref(false)
    const listings = ref([])
    const historyTarget = ref(null)
    const competitorTarget = ref(null)
    const competitorGuideClosed = ref(false)
    // 当前页仅首个可绑定行显示主动引导，其余行仍使用普通悬浮说明。
    const competitorGuideRow = computed(() => listings.value.find(row => row.asin))
    // 冻结点击时的店铺/SKU；编辑弹框通过后端版本校验避免覆盖他人变更。
    const openCompetitors = (row) => {
      if (selectedShopId.value && row.asin) competitorTarget.value = { shopId:selectedShopId.value, sku:row.sku, asin:row.asin }
    }
    // 保存后仅重读仍然选中的来源店铺列表，不把旧店铺结果混入新选择。
    const competitorsSaved = (data) => {
      if (String(data.shop_id) === String(selectedShopId.value)) fetchListings()
    }
    const openSellersprite = (row) => {
      if (row.marketplace_id && row.marketplace_id !== 'ATVPDKIKX0DER') { ElMessage.warning('关键词反查当前仅支持美国站'); return }
      if (row.asin) router.push({ path: '/tools/keyword-reverse', query: { asin: row.asin.trim().toUpperCase(), shop_id: selectedShopId.value || undefined } })
    }
    const openListingHistory = (row) => {
      if (selectedShopId.value && row.sku) historyTarget.value = { shopId: selectedShopId.value, sku: row.sku }
    }

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

    const { initFromQuery, syncQuery, watchQuery } = useListQuerySync({
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
    let detailRevision = 0

    // 编辑状态
    const editingSection = ref(null)
    const textBusyFields = reactive({})
    const textWriteBusy = computed(() => Object.values(textBusyFields).some(Boolean))
    let textSnapshot = null, textSnapshotRequest = null, textSnapshotAt = 0, textSnapshotRevision = 0
    const listingLanguageTag = ref('en_US')

    // 变体字段同步弹窗
    const syncVariantDialogVisible = ref(false)
    const syncVariantLoading = ref(false)
    const syncVariantSubmitLoading = ref(false)
    const syncVariantOptions = ref([])
    const syncVariantFields = ref([])
    const syncVariantTargets = ref([])

    // BSR 趋势
    const bsrTrendDialogVisible = ref(false)
    const bsrTrendLoading = ref(false)
    const bsrTrendTarget = ref(null)
    const bsrTrendData = ref(null)
    const bsrTrendChartRef = ref(null)
    let bsrTrendChart = null

    const syncVariantFieldOptions = [
      { label: '标题', value: 'item_name' },
      { label: '商品亮点', value: 'title_differentiation' },
      { label: '描述', value: 'product_description' },
      { label: '五点描述 1', value: 'bullet_point_1' },
      { label: '五点描述 2', value: 'bullet_point_2' },
      { label: '五点描述 3', value: 'bullet_point_3' },
      { label: '五点描述 4', value: 'bullet_point_4' },
      { label: '五点描述 5', value: 'bullet_point_5' },
      { label: '搜索关键字', value: 'generic_keyword' }
    ]


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
      competitorTarget.value = null
      detailRevision++
      detailDialogVisible.value = false
      invalidateTextSnapshot()
      editingSection.value = null
      listingDetail.value = null
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

    // 全店拉取Listing时同样避免与当前行的刷新或产品同步重叠。
    const syncListings = async () => {
      if (syncLoading.value || syncListingLoading.value || syncToProductLoading.value) return
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
      const revision = ++detailRevision
      const shopId = selectedShopId.value
      detailDialogVisible.value = true
      detailLoading.value = true
      listingDetail.value = null
      editingSection.value = null
      invalidateTextSnapshot()

      try {
        const response = await getAmazonListing(row.sku, shopId)
        if (revision !== detailRevision || shopId !== selectedShopId.value || !detailDialogVisible.value) return
        if (response.data.status === 'success') {
          listingDetail.value = response.data.data || null
          updateListingLanguageTag()
        } else {
          ElMessage.error(response.data.message || '获取 Listing 详情失败')
        }
      } catch (error) {
        console.error('获取 Listing 详情失败:', error)
        ElMessage.error('获取 Listing 详情失败: ' + (error.response?.data?.message || error.message))
      } finally {
        if (revision === detailRevision) detailLoading.value = false
      }
    }

    // 将已保存Listing复制到本地产品；已有申报资料保留，并防止两个同步动作重叠。
    const syncToProduct = async (sku) => {
      if (syncToProductLoading.value || syncListingLoading.value || syncLoading.value) return
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncToProductLoading.value = sku
      const shopId = selectedShopId.value
      try {
        const response = await syncListingToProduct(sku, shopId)
        if (response.data.status === 'success') {
          const results = response.data.data?.results || []
          const failed = results.filter(item => item.status !== 'success').length
          if (failed) ElMessage.warning(`已同步 ${results.length - failed} 个子体，${failed} 个失败，请核对后重试`)
          else ElMessage.success(response.data.message || `产品 ${sku} 已同步，本地申报资料保留`)
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

    // 从亚马逊刷新当前SKU的本地Listing；切换店铺后不把旧请求结果刷新到新店铺。
    const syncSingleListing = async (sku) => {
      if (syncListingLoading.value || syncToProductLoading.value || syncLoading.value) return
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncListingLoading.value = sku
      const shopId = selectedShopId.value
      try {
        await syncAmazonListing(sku, shopId)
        ElMessage.success(`Listing ${sku} 同步成功`)
        if (shopId === selectedShopId.value) await fetchListings()
      } catch (error) {
        console.error('同步 Listing 失败:', error)
        ElMessage.error('同步失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncListingLoading.value = null
      }
    }

    // ===== Listing 编辑方法 =====
    const startEdit = (section) => {
      if (!listingDetail.value) return
      if (section === 'price') editingSection.value = section
    }

    const cancelEdit = () => {
      editingSection.value = null
    }

    const invalidateTextSnapshot = () => {
      textSnapshotRevision++
      textSnapshot = null; textSnapshotRequest = null; textSnapshotAt = 0
      for (const field of Object.keys(textBusyFields)) delete textBusyFields[field]
    }
    const onTextBusy = (field, value) => { textBusyFields[field] = value }
    const loadTextSnapshot = (force = false) => {
      const shopId = selectedShopId.value, sku = listingDetail.value?.sku
      if (!shopId || !sku) return Promise.reject(new Error('请重新打开Listing详情'))
      if (!force && textSnapshot && Date.now() - textSnapshotAt < 60000) return Promise.resolve(textSnapshot)
      if (textSnapshotRequest) return textSnapshotRequest
      const revision = textSnapshotRevision
      const pending = getAmazonListingText(sku, shopId).then(response => {
        if (revision !== textSnapshotRevision || shopId !== selectedShopId.value || sku !== listingDetail.value?.sku) throw new Error('当前Listing已切换，请重新编辑')
        textSnapshot = response.data.data; textSnapshotAt = Date.now()
        onTextUpdated(textSnapshot)
        return textSnapshot
      }).finally(() => { if (textSnapshotRequest === pending) textSnapshotRequest = null })
      textSnapshotRequest = pending
      return pending
    }
    const textEditorProps = (field, label) => {
      let attrs = {}
      try { attrs = JSON.parse(listingDetail.value.attributes_json || '{}') } catch { /* 空缓存由实时读取补全 */ }
      let rows = (Array.isArray(attrs[field]) ? attrs[field] : []).filter(row => row.marketplace_id === listingDetail.value.marketplace_id)
      if (!rows.length) {
        const fallback = { item_name: listingDetail.value.item_name, title_differentiation: listingDetail.value.title_differentiation, product_description: listingDetail.value.product_description, generic_keyword: getGenericKeyword() }[field]
        if (field === 'bullet_point') rows = (listingDetail.value.bullets || []).map(row => ({ value: row.content, language_tag: row.language_tag, marketplace_id: listingDetail.value.marketplace_id }))
        else if (fallback) rows = [{ value: fallback, language_tag: listingLanguageTag.value, marketplace_id: listingDetail.value.marketplace_id }]
      }
      return { shopId: selectedShopId.value, sku: listingDetail.value.sku, field, label, initialRows: rows, loadSnapshot: loadTextSnapshot, writeBusy: textWriteBusy.value }
    }

    const onTextUpdated = (snapshot) => {
      if (!listingDetail.value || String(snapshot.shop_id) !== String(selectedShopId.value) || snapshot.sku !== listingDetail.value.sku) return
      textSnapshot = snapshot; textSnapshotAt = Date.now()
      const values = name => snapshot.fields[name].rows
      let attrs = {}
      try { attrs = JSON.parse(listingDetail.value.attributes_json || '{}') } catch { /* 兼容空缓存 */ }
      for (const name of Object.keys(snapshot.fields)) {
        if (values(name).length) attrs[name] = values(name)
        else delete attrs[name]
      }
      const updated = { ...listingDetail.value, attributes_json: JSON.stringify(attrs),
        item_name: values('item_name')[0]?.value || '', title_differentiation: values('title_differentiation')[0]?.value || '',
        product_description: values('product_description')[0]?.value || '',
        generic_keyword: values('generic_keyword'),
        bullets: values('bullet_point').map((row, index) => ({ content: row.value, language_tag: row.language_tag, sort_order: index })) }
      listingDetail.value = updated
      const index = listings.value.findIndex(row => row.sku === snapshot.sku)
      if (index !== -1) listings.value[index] = { ...listings.value[index], ...updated }
      updateListingLanguageTag()
    }

    const onImagesUpdated = (snapshot) => {
      if (!listingDetail.value || String(snapshot.shop_id) !== String(selectedShopId.value) || snapshot.sku !== listingDetail.value.sku) return
      let attrs = {}
      try { attrs = JSON.parse(listingDetail.value.attributes_json || '{}') } catch { /* 兼容空属性 */ }
      const images = []
      snapshot.slots.forEach((slot, index) => {
        const name = index ? `other_product_image_locator_${index}` : 'main_product_image_locator'
        if (slot.rows.length) attrs[name] = slot.rows
        else delete attrs[name]
        if (slot.url) images.push({ image_type: index ? `other_${index}` : 'main', media_location: slot.url, sort_order: index })
      })
      listingDetail.value = { ...listingDetail.value, images, attributes_json: JSON.stringify(attrs) }
      if (snapshot.main_image?.link) {
        listingDetail.value.main_image_url = snapshot.main_image.link
        const index = listings.value.findIndex(row => row.sku === snapshot.sku)
        if (index !== -1) listings.value[index].main_image_url = snapshot.main_image.link
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
          updateListingLanguageTag()
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

    const updateListingLanguageTag = () => {
      const detail = listingDetail.value
      if (detail?.bullets?.length > 0) {
        listingLanguageTag.value = detail.bullets[0].language_tag || 'en_US'
      }
      return listingLanguageTag.value
    }

    // ===== 变体字段同步 =====
    const openSyncVariantDialog = async () => {
      if (!listingDetail.value || !selectedShopId.value) return

      syncVariantDialogVisible.value = true
      syncVariantFields.value = []
      syncVariantTargets.value = []
      syncVariantOptions.value = []
      syncVariantLoading.value = true

      try {
        const response = await getAmazonListingVariants(listingDetail.value.sku, selectedShopId.value)
        if (response.data.status === 'success') {
          const variants = response.data.data?.variants || response.data.data || []
          syncVariantOptions.value = variants.filter(v => v.sku !== listingDetail.value.sku)
        } else {
          ElMessage.error(response.data.message || '获取变体列表失败')
        }
      } catch (error) {
        console.error('获取变体列表失败:', error)
        ElMessage.error('获取变体列表失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncVariantLoading.value = false
      }
    }

    const submitSyncVariant = async () => {
      if (!listingDetail.value || !selectedShopId.value) return
      if (syncVariantFields.value.length === 0) {
        ElMessage.warning('请至少选择一个要同步的字段')
        return
      }
      if (syncVariantTargets.value.length === 0) {
        ElMessage.warning('请至少选择一个目标变体')
        return
      }

      syncVariantSubmitLoading.value = true
      try {
        const response = await syncAmazonListingToVariants(listingDetail.value.sku, {
          shop_id: selectedShopId.value,
          target_skus: syncVariantTargets.value,
          fields: syncVariantFields.value
        })

        if (response.data.status === 'success') {
          const result = response.data.data || {}
          ElMessage.success(response.data.message || `已同步 ${result.updated_count || 0} 个变体`)
          syncVariantDialogVisible.value = false

          // 刷新当前 listing 详情
          const resp = await getAmazonListing(listingDetail.value.sku, selectedShopId.value)
          if (resp.data.status === 'success') {
            listingDetail.value = resp.data.data || null
            updateListingLanguageTag()
          }
          await fetchListings()
        } else {
          ElMessage.error(response.data.message || '同步失败')
        }
      } catch (error) {
        console.error('同步字段到变体失败:', error)
        ElMessage.error('同步失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncVariantSubmitLoading.value = false
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
      if (detail.pricing_snapshot) return detail.pricing_snapshot.currency
      if (detail.currency) return detail.currency
      const offers = detail.offers || []
      if (offers.length > 0 && offers[0].currency) return offers[0].currency
      return detail.currency || 'USD'
    }

    // 仅接收当前弹窗上下文的实时结果，不让旧SKU迟到响应覆盖新页面。
    const onPriceUpdated = (snapshot) => {
      if (snapshot.sku !== listingDetail.value?.sku || String(snapshot.shop_id) !== String(selectedShopId.value)) return
      listingDetail.value.pricing_snapshot = snapshot
      const row = listings.value.find(item => item.sku === snapshot.sku)
      if (row) {
        row.our_price = snapshot.fields.standard_price.value
        row.discounted_price = snapshot.fields.sale_price.value
      }
    }

    // 获取价格展示数据：primary=实际售价, msrp=划线价
    const getPriceDisplay = () => {
      const detail = listingDetail.value
      const result = { primary: null, msrp: null }
      if (!detail) return result
      if (detail.pricing_snapshot) {
        const live = detail.pricing_snapshot
        const actual = live.effective_offers.find(row => row.offerType === 'B2C')
        result.primary = actual?.price?.amount ?? live.fields.standard_price.value
        return result
      }
      if (detail.our_price != null) {
        result.primary = detail.our_price
      } else {
        const offers = detail.offers || []
        const primaryOffer = offers.find(o => o.audience === 'ALL') || offers[0]
        if (primaryOffer && primaryOffer.our_price != null) {
          result.primary = primaryOffer.our_price
        }
      }
      if (detail.discounted_price != null && detail.discounted_price !== result.primary) {
        result.msrp = detail.discounted_price
      }
      return result
    }

    const getGenericKeyword = () => {
      const detail = listingDetail.value
      if (!detail) return ''
      if (detail.generic_keyword) {
        return typeof detail.generic_keyword === 'string'
          ? detail.generic_keyword
          : (detail.generic_keyword[0]?.value || '')
      }
      try {
        const attrs = JSON.parse(detail.attributes_json || '{}')
        const gk = attrs.generic_keyword
        if (gk) {
          return typeof gk === 'string' ? gk : (gk[0]?.value || '')
        }
      } catch {
        /* ignore parse error */
      }
      return ''
    }

    const copyText = async (text) => {
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        ElMessage.success('已复制到剪贴板')
      } catch (err) {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        ElMessage.success('已复制到剪贴板')
      }
    }

    // 格式化数字（千分位）
    const formatNumber = (value) => {
      if (value === undefined || value === null || value === '') return '-'
      const num = Number(value)
      if (Number.isNaN(num)) return value
      return num.toLocaleString('en-US')
    }

    // 格式化 BSR 百分比：保留 1 位小数，负数取绝对值
    const formatBsrPct = (value) => {
      if (value === undefined || value === null) return '-'
      const num = Number(value)
      if (Number.isNaN(num)) return value
      return Math.abs(num).toFixed(1)
    }

    // 打开 BSR 趋势弹框
    const openBsrTrendDialog = async (row) => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }
      if (!row || !row.sku) return

      bsrTrendTarget.value = row
      bsrTrendDialogVisible.value = true
      bsrTrendLoading.value = true
      bsrTrendData.value = null

      try {
        const response = await getAmazonListingBsrTrend(row.sku, selectedShopId.value)
        if (response.data.status === 'success') {
          bsrTrendData.value = response.data.data || null
          nextTick(() => {
            buildBsrTrendChart()
          })
        } else {
          ElMessage.error(response.data.message || '获取 BSR 趋势失败')
        }
      } catch (error) {
        console.error('获取 BSR 趋势失败:', error)
        ElMessage.error('获取 BSR 趋势失败: ' + (error.response?.data?.message || error.message))
      } finally {
        bsrTrendLoading.value = false
      }
    }

    // 构建 BSR 趋势折线图（两条线：大类目 + 子类目）
    const buildBsrTrendChart = () => {
      if (!bsrTrendChartRef.value) return
      const trend = bsrTrendData.value?.trend
      if (!trend || !trend.dates || trend.dates.length === 0) return

      if (bsrTrendChart) {
        bsrTrendChart.dispose()
      }
      bsrTrendChart = echarts.init(bsrTrendChartRef.value)

      const dates = trend.dates
      const parentName = trend.categories?.parent || '大类目'
      const subName = trend.categories?.sub || '子类目'
      const parentData = (trend.parent || []).map(item => item?.rank ?? null)
      const subData = (trend.sub || []).map(item => item?.rank ?? null)
      const hasSubData = subData.some(v => v !== null && v !== undefined)

      // 分别计算两条线的 Y 轴范围
      const parentRanks = parentData.filter(v => v !== null && v !== undefined)
      const subRanks = subData.filter(v => v !== null && v !== undefined)
      const parentMin = parentRanks.length ? Math.min(...parentRanks) : 0
      const parentMax = parentRanks.length ? Math.max(...parentRanks) : 0
      const subMin = subRanks.length ? Math.min(...subRanks) : 0
      const subMax = subRanks.length ? Math.max(...subRanks) : 0
      const parentPadding = Math.max(Math.round((parentMax - parentMin) * 0.1), 1)
      const subPadding = Math.max(Math.round((subMax - subMin) * 0.1), 1)

      const series = []

      series.push({
        name: parentName,
        type: 'line',
        yAxisIndex: 0,
        data: parentData,
        smooth: true,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: '#667eea', type: 'dashed' },
        itemStyle: { color: '#667eea', borderWidth: 1, borderColor: '#fff' }
      })

      if (hasSubData) {
        series.push({
          name: subName,
          type: 'line',
          yAxisIndex: 1,
          data: subData,
          smooth: true,
          connectNulls: false,
          symbol: 'emptyCircle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#67c23a' },
          itemStyle: { color: '#67c23a', borderWidth: 2, borderColor: '#fff' }
        })
      }

      const option = {
        color: ['#667eea', '#67c23a'],
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            let html = `<div style="font-weight:600;margin-bottom:4px;">${params[0]?.name || ''}</div>`
            params.forEach(param => {
              const rank = param.value
              const color = param.color
              const name = param.seriesName
              html += `<div style="display:flex;align-items:center;gap:6px;">`
              html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>`
              if (rank !== null && rank !== undefined) {
                html += `<span>${name}: #${formatNumber(rank)}</span>`
              } else {
                html += `<span style="color:#999;">${name}: 数据缺失</span>`
              }
              html += `</div>`
            })
            return html
          }
        },
        legend: {
          data: series.map(s => s.name),
          bottom: 0,
          itemGap: 20
        },
        grid: { left: 70, right: hasSubData ? 80 : 24, top: 30, bottom: 50 },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLabel: { color: '#666', rotate: 30, fontSize: 11 }
        },
        yAxis: [
          {
            type: 'value',
            inverse: true,
            name: parentName,
            min: Math.max(parentMin - parentPadding, 0),
            max: parentMax + parentPadding,
            position: 'left',
            axisLine: { show: true, lineStyle: { color: '#667eea' } },
            axisLabel: {
              color: '#667eea',
              formatter: (value) => formatNumber(value)
            },
            splitLine: { lineStyle: { color: '#f0f0f0' } }
          },
          hasSubData ? {
            type: 'value',
            inverse: true,
            name: subName,
            min: Math.max(subMin - subPadding, 0),
            max: subMax + subPadding,
            position: 'right',
            offset: 0,
            axisLine: { show: true, lineStyle: { color: '#67c23a' } },
            axisLabel: {
              color: '#67c23a',
              formatter: (value) => formatNumber(value)
            },
            splitLine: { show: false }
          } : null
        ].filter(Boolean),
        series
      }

      bsrTrendChart.setOption(option)
    }

    const closeBsrTrendDialog = () => {
      if (bsrTrendChart) {
        bsrTrendChart.dispose()
        bsrTrendChart = null
      }
      bsrTrendTarget.value = null
      bsrTrendData.value = null
    }

    const resizeBsrTrendChart = () => {
      bsrTrendChart?.resize()
    }

    onMounted(async () => {
      await fetchShopList()
      if (shopList.value.length > 0) {
        selectedShopId.value = defaultShopId()
      }
      initFromQuery()
      fetchListings()
      window.addEventListener('resize', resizeBsrTrendChart)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', resizeBsrTrendChart)
      if (bsrTrendChart) {
        bsrTrendChart.dispose()
        bsrTrendChart = null
      }
    })

    watchQuery(() => fetchListings())

    return {
      loading,
      syncLoading,
      listings,
      historyTarget,
      competitorTarget,
      competitorGuideClosed,
      competitorGuideRow,
      openCompetitors,
      competitorsSaved,
      openSellersprite,
      openListingHistory,
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
      copyText,
      getMarketplaceDomain,
      getStatusList,
      getSingleStatusType,
      getSingleStatusText,
      getIssuesIconColor,
      getRowClassName,
      getPriceCurrency,
      getPriceDisplay,
      onPriceUpdated,
      getGenericKeyword,
      editingSection,
      listingLanguageTag,
      textWriteBusy,
      textEditorProps,
      onTextBusy,
      onTextUpdated,
      onImagesUpdated,
      startEdit,
      cancelEdit,
      syncVariantDialogVisible,
      syncVariantLoading,
      syncVariantSubmitLoading,
      syncVariantOptions,
      syncVariantFields,
      syncVariantTargets,
      syncVariantFieldOptions,
      openSyncVariantDialog,
      submitSyncVariant,
      bsrTrendDialogVisible,
      bsrTrendLoading,
      bsrTrendTarget,
      bsrTrendData,
      bsrTrendChartRef,
      openBsrTrendDialog,
      closeBsrTrendDialog,
      formatNumber,
      formatBsrPct
    }
  }
}
</script>

<style scoped>
.listing-competitor-summary{display:flex;align-items:center;gap:4px;max-width:100%;margin-top:5px;color:#99a6b8;font-size:10px;white-space:nowrap;overflow:hidden}.listing-competitor-summary a{min-width:0;overflow:hidden;text-overflow:ellipsis;font:10px Consolas,monospace;color:#7e94b2;text-decoration:none}.listing-competitor-summary a:hover{color:#409eff}.listing-competitor-links{display:flex;flex-direction:column;gap:8px;max-height:240px;overflow:auto}.listing-competitor-links strong{font-size:12px;color:#60738b}.listing-competitor-links a{font:12px Consolas,monospace;color:#4d7db8;text-decoration:none}
.listing-sync-menu { color: #526078; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.listing-sync-menu section { padding: 12px; border-radius: 8px; }
.listing-sync-menu section + section { margin-top: 10px; }
.listing-sync-menu .sync-direct { background: #fff8eb; }
.listing-sync-menu .sync-direct strong { color: #986318; }
.listing-sync-menu .sync-product { background: #f0f6ff; }
.listing-sync-menu strong { display: block; color: #263e60; font-size: 14px; }
.listing-sync-menu p { margin: 6px 0 0; }
.listing-sync-menu .sync-secondary { color: #728199; font-size: 12px; }
.listing-sync-menu .el-button { width: 100%; margin: 10px 0 4px; font-weight: 600; }
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
:deep(.el-scrollbar__wrap) {
  overflow-x: auto !important;
}
:deep(.el-table__body-wrapper) {
  overflow-x: auto !important;
}
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  height: 8px;
}
:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #c0c4cc;
  border-radius: 4px;
}
:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: transparent;
  border-radius: 4px;
}
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

/* BSR 排名 */
.bsr-cell {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}
.bsr-cell:hover {
  background: #f5f7fa;
}
.bsr-badges {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-wrap: wrap;
}
.bsr-detail-cell .bsr-badges {
  flex-direction: row;
}
.bsr-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.5;
  white-space: nowrap;
  max-width: 100%;
}
.bsr-badge-main {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #d9f0c9;
}
.bsr-badge-sub {
  background: #e8f5e9;
  color: #52c41a;
  border: 1px solid #c8e6c9;
}
.bsr-badge .bsr-rank {
  font-family: monospace;
  font-weight: 600;
}
.bsr-badge .bsr-in {
  font-size: 11px;
  opacity: 0.8;
  font-weight: 400;
}
.bsr-badge .bsr-category {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
  font-weight: 500;
}
.bsr-trend {
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.bsr-trend .el-icon {
  font-size: 12px;
}
.bsr-prev {
  font-weight: 400;
  color: #999;
  font-size: 11px;
}
.bsr-up {
  color: #67c23a;
}
.bsr-down {
  color: #f56c6c;
}
.bsr-new {
  color: #909399;
}

.bsr-detail-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex-wrap: wrap;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}
.bsr-detail-cell:hover {
  background: #f5f7fa;
}
.bsr-detail-cell .bsr-badge .bsr-category {
  max-width: 260px;
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

:deep(.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

:deep(.el-dialog__body) {
  overflow-y: auto;
  flex: 1;
}

.detail-sticky-close {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 0;
  border-top: 1px solid #eee;
  margin-top: 12px;
}
</style>
