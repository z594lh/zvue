// src/services/api.js
import axios from 'axios';

// src/services/api.js
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production'
      ? `${process.env.VUE_APP_API_BASE_URL}/api`  // 生产环境使用配置
      : '/api',                                    // 开发环境使用代理
  timeout: 1000000,
  headers: {
      'Content-Type': 'application/json'
  }
});


export const getConfig = () => {
  return api.get('/config');
};

// 文本翻译
export const translateText = (text, source = 'auto', target = 'zh') => {
  return api.post('/translate', { text, source, target });
};
  
// 图片翻译
export const translateImage = (imageBase64, source = 'auto', target = 'zh') => {
  return api.post('/translate-image', { image: imageBase64, source, target });
};

// AI 文本翻译
export const translateAIText = (text, source = 'auto', target = 'zh') => {
  return api.post('/translate-ai', { text, source, target });
};

// AI 图片翻译
export const translateAIImage = (imageBase64, source = 'auto', target = 'zh') => {
  return api.post('/translate-ai-image', { image: imageBase64, source, target });
};

/**
 * AI 文生图
 * @param {Object} data 包含 prompt, model, session_id, image(可选)
 */
export const generateAIImage = (data) => {
  return api.post('/ai/chat-image', data);
};

/**
 * AI 图生图
 * @param {Object} data 包含 prompt, model, image_ids(可选), images(可选), session_id(可选)
 */
export const editAIImage = (data) => {
  return api.post('/ai/edit-image-v2', data);
};

/**
 * 获取图库列表（分页、倒序）
 * @param {number} page 页码
 * @param {number} pageSize 每页数量
 */
export const getGalleryList = (page = 1, pageSize = 20) => {
  return api.get('/ai/gallery', {
    params: { page, page_size: pageSize }
  });
};

/**
 * 删除图库中的单张图片
 * @param {string} image_id 图片 ID
 */
export const deleteImageApi = (image_id) => {
  return api.delete(`/ai/gallery/${image_id}`);
};

// ==================== 用户认证相关接口 ====================

/**
 * 用户注册
 * @param {Object} data {username, password, nickname}
 */
export const register = (data) => {
  return api.post('/user/register', data);
};

/**
 * 用户登录
 * @param {Object} data {username, password}
 */
export const login = (data) => {
  return api.post('/user/login', data);
};

/**
 * 用户登出
 */
export const logout = () => {
  return api.post('/user/logout');
};

/**
 * 获取当前用户信息
 */
export const getUserProfile = () => {
  return api.get('/user/profile');
};

/**
 * 修改用户信息
 * @param {Object} data {nickname}
 */
export const updateUserProfile = (data) => {
  return api.put('/user/profile', data);
};

/**
 * 修改密码
 * @param {Object} data {old_password, new_password}
 */
export const changePassword = (data) => {
  return api.put('/user/password', data);
};

// 设置认证token
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('auth_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('auth_token');
  }
};

// 从localStorage恢复token
export const restoreAuthToken = () => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return token;
  }
  return null;
};

// 检查是否已登录
export const isAuthenticated = () => {
  return !!localStorage.getItem('auth_token');
};

// ==================== 记账相关接口 ====================

/**
 * 获取支出列表
 * @param {Object} params {month, category, account_type, reimbursed, page, page_size}
 */
export const getExpenseList = (params = {}) => {
  return api.get('/expenses/list', { params });
};

/**
 * 新增支出记录
 * @param {Object} data {date, category, amount, remark, has_invoice, invoice_image, account_type, reimbursed}
 */
export const createExpense = (data) => {
  return api.post('/expenses/add', data);
};

/**
 * 更新支出记录
 * @param {string} id 记录ID
 * @param {Object} data 更新数据
 */
export const updateExpense = (id, data) => {
  return api.put(`/expenses/${id}`, data);
};

/**
 * 切换私账报销状态
 * @param {string} id 记录ID
 */
export const toggleReimburseStatus = (id) => {
  return api.patch(`/expenses/${id}/reimburse`);
};

/**
 * 删除支出记录
 * @param {string} id 记录ID
 */
export const deleteExpense = (id) => {
  return api.delete(`/expenses/${id}`);
};

/**
 * 上传发票图片（独立接口，返回图片URL）
 * @param {FormData} formData 包含 invoice 文件
 */
export const uploadInvoiceImage = (formData) => {
  return api.post('/expenses/upload-invoice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * 获取支出记录操作日志
 * @param {string} id 记录ID
 */
export const getExpenseLogs = (id) => {
  return api.get(`/expenses/${id}/logs`);
};

/**
 * 获取支出模块用户列表（创建人筛选用）
 */
export const getExpenseUsers = () => {
  return api.get('/expenses/users');
};

// ==================== FBA 标签打印相关接口 ====================

/**
 * 生成 FBA FNSKU 标签 PDF
 * @param {Object} data {fnsku, product_name, extra_info, sku, width_mm, height_mm}
 */
export const generateFbaLabel = (data) => {
  return api.post('/fba/label', data);
};

// ==================== 亚马逊货件管理相关接口 ====================

/**
 * 获取亚马逊货件列表
 * @param {Object} params {page, page_size, status, destination_fc}
 */
export const getAmazonShipments = (params = {}) => {
  return api.get('/amazon/shipments', { params });
};

/**
 * 获取货件商品列表
 * @param {string} shipment_id 货件ID
 * @param {Object} params {page, page_size}
 */
export const getAmazonShipmentItems = (shipment_id, params = {}) => {
  return api.get(`/amazon/shipments/${shipment_id}/items`, { params });
};

/**
 * 获取亚马逊货件箱唛标签 PDF
 * @param {string} shipment_id 货件ID
 * @param {number} shop_id 店铺ID（必填）
 * @param {string} page_type 标签页面类型，默认 PackageLabel_Thermal_NonPCP
 * @param {number} page_size 每页标签数量，默认 2
 * @param {string} box_id 箱子ID（可选，传则打印单个箱子箱唛）
 */
export const getAmazonShipmentLabels = (shipment_id, shop_id, page_type = 'PackageLabel_Thermal_NonPCP', page_size = 2, box_id = null) => {
  const params = { shop_id, page_type, page_size };
  if (box_id) {
    params.box_id = box_id;
  }
  return api.get(`/amazon/shipments/${shipment_id}/labels`, { params });
};

/**
 * 导出货件发票
 * @param {string} shipment_id 货件ID
 * @param {number} shop_id 店铺ID（必填）
 */
export const exportAmazonShipmentInvoice = (shipment_id, shop_id) => {
  return api.get(`/amazon/shipments/${shipment_id}/invoice/export`, {
    params: { shop_id },
    responseType: 'blob'
  });
};

/**
 * 一键同步所有数据
 */
export const syncAmazonAll = () => {
  return api.post('/amazon/sync/all');
};

/**
 * 同步货件数据
 * @param {Object} data {status_list, last_update_after}
 */
export const syncAmazonShipments = (data = {}) => {
  return api.post('/amazon/sync/shipments', data);
};

/**
 * 同步指定货件的商品数据
 * @param {string} shipment_id 货件ID
 */
export const syncAmazonShipmentItems = (shipment_id) => {
  return api.post(`/amazon/sync/shipments/${shipment_id}/items`);
};

/**
 * 同步入库计划箱子数据
 * @param {string} plan_id 入库计划ID
 * @param {Object} data {shop_id}
 */
export const syncAmazonInboundPlanBoxes = (plan_id, data = {}) => {
  return api.post(`/amazon/sync/inbound-plans/${plan_id}/boxes`, data);
};

/**
 * 获取仓库列表
 * @param {number} shop_id 店铺ID（必填）
 */
export const getAmazonWarehouses = (shop_id) => {
  return api.get('/amazon/warehouses', { params: { shop_id } });
};

/**
 * 获取亚马逊入库计划箱子列表
 * @param {string} shipment_id 货件编号（必填）
 * @param {number} shop_id 店铺ID（必填）
 * @param {Object} params {page, page_size}
 */
export const getAmazonInboundPlanBoxes = (shipment_id, shop_id, params = {}) => {
  return api.get('/amazon/inbound-plan-boxes', {
    params: { shipment_id, shop_id, ...params }
  });
};

// ==================== 亚马逊入库计划货件相关接口（新接口）====================

/**
 * 查询入库计划货件列表（连表详情）
 * @param {Object} params {shop_id, inbound_plan_id, shipment_confirmation_id, amazon_reference_id, destination_warehouse_id, status, page, page_size}
 */
export const getInboundShipments = (params = {}) => {
  return api.get('/amazon/inbound-shipments', { params });
};

/**
 * 一键同步最新货件数据
 * @param {Object} data {shop_id}
 */
export const syncInboundShipments = (data = {}) => {
  return api.post('/amazon/sync/inbound-shipments', data);
};

/**
 * 查询货件详情
 * @param {string} shipment_id 新版 shipmentId
 * @param {number} shop_id 店铺ID（必填）
 */
export const getInboundShipmentDetail = (shipment_id, shop_id) => {
  return api.get(`/amazon/inbound-shipments/${shipment_id}/detail`, { params: { shop_id } });
};

// ==================== 亚马逊订单管理相关接口 ====================

/**
 * 获取亚马逊订单列表
 * @param {Object} params {shop_id, order_status, amazon_order_id, buyer_name, purchase_date_from, purchase_date_to, page, page_size}
 */
export const getAmazonOrders = (params = {}) => {
  return api.get('/amazon/orders', { params });
};

/**
 * 获取亚马逊订单详情（含商品列表）
 * @param {string} order_id 亚马逊订单号
 * @param {number} shop_id 店铺ID（必填）
 */
export const getAmazonOrder = (order_id, shop_id) => {
  return api.get(`/amazon/orders/${order_id}`, { params: { shop_id } });
};

/**
 * 手动同步订单列表
 * @param {Object} data {shop_id, created_after, created_before, order_statuses, marketplace_ids}
 */
export const syncAmazonOrders = (data = {}) => {
  return api.post('/amazon/sync/orders', data);
};

/**
 * 手动同步指定订单的商品数据
 * @param {string} order_id 亚马逊订单号
 * @param {Object} data {shop_id}
 */
export const syncAmazonOrderItems = (order_id, data = {}) => {
  return api.post(`/amazon/sync/orders/${order_id}/items`, data);
};

/**
 * 一键全量同步订单（订单列表 + 商品明细）
 * @param {Object} data {shop_id, created_after, created_before, order_statuses, marketplace_ids}
 */
export const syncAmazonOrdersAll = (data = {}) => {
  return api.post('/amazon/sync/orders-all', data);
};

// ==================== 亚马逊库存管理相关接口 ====================

/**
 * 获取店铺列表（用于店铺选择器，仅启用状态）
 */
export const getShops = () => {
  return api.get('/shops');
};

/**
 * 获取所有店铺列表（含禁用，管理后台用）
 */
export const getAllShops = () => {
  return api.get('/shops/all');
};

/**
 * 获取单个店铺详情
 * @param {number} id 店铺ID
 */
export const getShop = (id) => {
  return api.get(`/shops/${id}`);
};

/**
 * 创建店铺
 * @param {Object} data {shop_name, seller_id, refresh_token, marketplace_id, region, is_default}
 */
export const createShop = (data) => {
  return api.post('/shops', data);
};

/**
 * 更新店铺
 * @param {number} id 店铺ID
 * @param {Object} data 更新数据
 */
export const updateShop = (id, data) => {
  return api.put(`/shops/${id}`, data);
};

/**
 * 删除店铺（软删除）
 * @param {number} id 店铺ID
 */
export const deleteShop = (id) => {
  return api.delete(`/shops/${id}`);
};

/**
 * 设为默认店铺
 * @param {number} id 店铺ID
 */
export const setDefaultShop = (id) => {
  return api.post(`/shops/${id}/set-default`);
};

/**
 * 获取亚马逊库存列表
 * @param {Object} params {page, page_size, seller_sku, asin, shop_id}
 */
export const getAmazonInventory = (params = {}) => {
  return api.get('/amazon/inventory', { params });
};

/**
 * 同步库存数据
 * @param {Object} data {seller_skus, start_date_time, shop_id}
 */
export const syncAmazonInventory = (data = {}) => {
  return api.post('/amazon/sync/inventory', data);
};

// ==================== 供应商管理相关接口 ====================

/**
 * 获取供应商列表
 * @param {Object} params {keyword, status, page, page_size}
 */
export const getSuppliers = (params = {}) => {
  return api.get('/suppliers', { params });
};

/**
 * 获取供应商详情
 * @param {number} id 供应商ID
 */
export const getSupplier = (id) => {
  return api.get(`/suppliers/${id}`);
};

/**
 * 创建供应商
 * @param {Object} data 供应商数据
 */
export const createSupplier = (data) => {
  return api.post('/suppliers', data);
};

/**
 * 更新供应商
 * @param {number} id 供应商ID
 * @param {Object} data 供应商数据
 */
export const updateSupplier = (id, data) => {
  return api.put(`/suppliers/${id}`, data);
};

/**
 * 删除供应商
 * @param {number} id 供应商ID
 */
export const deleteSupplier = (id) => {
  return api.delete(`/suppliers/${id}`);
};

// ==================== 进货单管理相关接口 ====================

/**
 * 获取进货单列表
 * @param {Object} params {supplier_id, status, keyword, page, page_size}
 */
export const getPurchaseOrders = (params = {}) => {
  return api.get('/purchase-orders', { params });
};

/**
 * 获取进货单详情
 * @param {number} id 进货单ID
 */
export const getPurchaseOrder = (id) => {
  return api.get(`/purchase-orders/${id}`);
};

/**
 * 创建进货单
 * @param {Object} data 进货单数据
 */
export const createPurchaseOrder = (data) => {
  return api.post('/purchase-orders', data);
};

/**
 * 更新进货单
 * @param {number} id 进货单ID
 * @param {Object} data 进货单数据
 */
export const updatePurchaseOrder = (id, data) => {
  return api.put(`/purchase-orders/${id}`, data);
};

/**
 * 删除进货单
 * @param {number} id 进货单ID
 */
export const deletePurchaseOrder = (id) => {
  return api.delete(`/purchase-orders/${id}`);
};

// ==================== 产品管理相关接口 ====================

/**
 * 获取产品列表
 * @param {Object} params {keyword, status, page, page_size}
 */
export const getProducts = (params = {}) => {
  return api.get('/products', { params });
};

/**
 * 创建产品
 * @param {Object} data 产品数据
 */
export const createProduct = (data) => {
  return api.post('/products', data);
};

/**
 * 更新产品
 * @param {number} id 产品ID
 * @param {Object} data 产品数据
 */
export const updateProduct = (id, data) => {
  return api.put(`/products/${id}`, data);
};

/**
 * 删除产品
 * @param {number} id 产品ID
 */
export const deleteProduct = (id) => {
  return api.delete(`/products/${id}`);
};

/**
 * 获取产品分类列表（下拉框用，不分页）
 */
export const getProductCategories = () => {
  return api.get('/products/categories');
};

// ==================== 类目管理相关接口 ====================

/**
 * 获取类目列表（分页、搜索）
 * @param {Object} params {keyword, page, page_size}
 */
export const getCategories = (params = {}) => {
  return api.get('/products/categories', { params });
};

/**
 * 获取类目详情
 * @param {number} id 类目ID
 */
export const getCategory = (id) => {
  return api.get(`/products/categories/${id}`);
};

/**
 * 创建类目
 * @param {Object} data {category, category_cn, commission_rate}
 */
export const createCategory = (data) => {
  return api.post('/products/categories', data);
};

/**
 * 更新类目
 * @param {number} id 类目ID
 * @param {Object} data 类目数据
 */
export const updateCategory = (id, data) => {
  return api.put(`/products/categories/${id}`, data);
};

/**
 * 删除类目
 * @param {number} id 类目ID
 */
export const deleteCategory = (id) => {
  return api.delete(`/products/categories/${id}`);
};

/**
 * 创建产品（支持文件上传）
 * @param {FormData} formData
 */
export const createProductWithFiles = (formData) => {
  return api.post('/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * 更新产品（支持文件上传）
 * @param {number} id 产品ID
 * @param {FormData} formData
 */
export const updateProductWithFiles = (id, formData) => {
  return api.put(`/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// ==================== PDF 在线编辑与拆分接口 ====================

/**
 * 编辑 PDF（真正修改 PDF 内容流）
 * @param {File} file 原始 PDF 文件
 * @param {Array} operations 编辑指令数组
 */
export const editPdf = (file, operations) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('operations', JSON.stringify(operations));
  return api.post('/pdf/edit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob'
  });
};

/**
 * 拆分 PDF 页面
 * @param {File} file 原始 PDF 文件
 * @param {number[]} pages 要拆分的页面索引数组（从 0 开始）
 */
export const splitPdf = (file, pages) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('data', JSON.stringify({ pages }));
  return api.post('/pdf/split', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob'
  });
};

// ==================== 售价计算接口 ====================

/**
 * SKU 售价反算
 * @param {Object} data {seller_sku, target_profit_rate, fba_fee, commission_rate, ad_rate, refund_rate, exchange_rate, purchase_cost, purchase_cost_currency}
 */
export const calculatePricing = (data) => {
  return api.post('/pricing/calculate', data);
};

// ==================== 货代管理相关接口 ====================

/**
 * 获取货代列表
 * @param {Object} params {keyword, status, page, page_size}
 */
export const getLogisticsProviders = (params = {}) => {
  return api.get('/logistics-providers', { params });
};

/**
 * 获取货代详情
 * @param {number} id 货代ID
 */
export const getLogisticsProvider = (id) => {
  return api.get(`/logistics-providers/${id}`);
};

/**
 * 创建货代
 * @param {Object} data 货代数据
 */
export const createLogisticsProvider = (data) => {
  return api.post('/logistics-providers', data);
};

/**
 * 更新货代
 * @param {number} id 货代ID
 * @param {Object} data 货代数据
 */
export const updateLogisticsProvider = (id, data) => {
  return api.put(`/logistics-providers/${id}`, data);
};

/**
 * 删除货代
 * @param {number} id 货代ID
 */
export const deleteLogisticsProvider = (id) => {
  return api.delete(`/logistics-providers/${id}`);
};

// ==================== Amazon Listing 管理相关接口 ====================

/**
 * 获取 Amazon Listing 列表
 * @param {Object} params {shop_id, page, page_size, sku, asin, product_type, status, parent_sku, keyword}
 */
export const getAmazonListings = (params = {}) => {
  return api.get('/amazon/listings', { params });
};

/**
 * 获取 Amazon Listing 详情
 * @param {string} sku 卖家 SKU
 * @param {number} shop_id 店铺ID（必填）
 */
export const getAmazonListing = (sku, shop_id) => {
  return api.get(`/amazon/listings/${sku}`, { params: { shop_id } });
};

/**
 * 手动触发 Listing 同步
 * @param {Object} data {shop_id, included_data, page_size}
 */
export const syncAmazonListings = (data = {}) => {
  return api.post('/amazon/sync/listings', data);
};

/**
 * 实时获取 Listing 详情（直连 SP-API）
 * @param {string} sku 卖家 SKU
 * @param {number} shop_id 店铺ID（必填）
 * @param {string} included_data 逗号分隔，如 summaries,attributes,issues,offers
 */
export const getAmazonListingSpApi = (sku, shop_id, included_data = 'summaries,attributes,issues') => {
  return api.get(`/amazon/listings/spapi/${sku}`, { params: { shop_id, included_data } });
};

/**
 * 上传 Listing 图片到 OSS
 * @param {FormData} formData 包含 image 文件
 */
export const uploadAmazonListingImage = (formData) => {
  return api.post('/amazon/listings/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * 上架新 Listing
 * @param {Object} data {shop_id, sku, product_type, attributes, requirements, condition_type}
 */
export const createAmazonListing = (data) => {
  return api.post('/amazon/listings', data);
};

/**
 * 修改 Listing（完全覆盖式更新）
 * @param {string} sku 卖家 SKU
 * @param {Object} data {shop_id, ...更新数据}
 */
export const updateAmazonListing = (sku, data) => {
  return api.put(`/amazon/listings/${sku}`, data);
};

/**
 * 部分更新 Listing（JSON Patch）
 * @param {string} sku 卖家 SKU
 * @param {Object} data {shop_id, patches, product_type}
 */
export const patchAmazonListing = (sku, data) => {
  return api.patch(`/amazon/listings/${sku}`, data);
};

/**
 * 删除 Listing
 * @param {string} sku 卖家 SKU
 * @param {number} shop_id 店铺ID（必填）
 * @param {string} marketplace_ids 逗号分隔的市场ID
 */
export const deleteAmazonListing = (sku, shop_id, marketplace_ids = '') => {
  const params = marketplace_ids ? { shop_id, marketplace_ids } : { shop_id };
  return api.delete(`/amazon/listings/${sku}`, { params });
};

/**
 * 删除 OSS 图片
 * @param {Object} data {oss_key} 或 {url}
 */
export const deleteAmazonListingImage = (data) => {
  return api.delete('/amazon/listings/delete-image', { data });
};

/**
 * 清理孤儿图片
 * @param {Object} data {dry_run}
 */
export const cleanupAmazonListingImages = (data = { dry_run: true }) => {
  return api.post('/amazon/listings/cleanup-images', data);
};

/**
 * 同步 Listing 到产品表
 * @param {string} sku 卖家 SKU
 * @param {number} shop_id 店铺ID
 */
export const syncListingToProduct = (sku, shop_id) => {
  return api.post(`/amazon/listings/${sku}/sync-to-product`, { shop_id });
};

// ==================== 选品看板（备货看板）相关接口 ====================

/**
 * 获取选品看板批次列表
 */
export const getProductBoardBatches = () => {
  return api.get('/product-board/batches');
};

/**
 * 获取选品看板产品列表
 * @param {Object} params {batch, keyword, amazon_status, min_sales, sort_by, sort_dir, page, page_size}
 */
export const getProductBoardList = (params = {}) => {
  return api.get('/product-board', { params });
};

/**
 * 获取选品看板统计概览
 * @param {Object} params {batch}
 */
export const getProductBoardStats = (params = {}) => {
  return api.get('/product-board/stats', { params });
};

/**
 * 获取选品看板筛选选项
 */
export const getProductBoardFilters = () => {
  return api.get('/product-board/filters');
};

/**
 * 获取选品看板产品跨批次趋势
 * @param {string} asins 逗号分隔的ASIN列表
 */
export const getProductBoardTrend = (asins) => {
  return api.get('/product-board/trend', { params: { asins } });
};

/**
 * 删除选品看板单条记录
 * @param {number} id 记录ID
 */
export const deleteProductBoardItem = (id) => {
  return api.delete(`/product-board/${id}`);
};

/**
 * 批量删除选品看板记录
 * @param {number[]} ids ID数组
 */
export const batchDeleteProductBoardItems = (ids) => {
  return api.post('/product-board/batch-delete', { ids });
};

/**
 * 导入选品看板数据
 * @param {FormData} formData 包含 file
 */
export const importProductBoard = (formData) => {
  return api.post('/product-board/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * 导出选品看板数据
 * @param {Object} params {batch, keyword}
 */
export const exportProductBoard = (params = {}) => {
  return api.get('/product-board/export', {
    params,
    responseType: 'blob'
  });
};

/**
 * 切换产品上架状态
 * @param {string} asin ASIN
 * @param {boolean} is_listed 是否已上架
 */
export const toggleProductBoardListed = (asin, is_listed) => {
  return api.post('/product-board/toggle-listed', { asin, is_listed });
};

// ==================== 货代运单管理相关接口 ====================

/**
 * 获取运单列表
 * @param {Object} params {waybill_no, provider_id, status, transport_type, page, page_size}
 */
export const getLogisticsWaybills = (params = {}) => {
  return api.get('/logistics-waybills', { params });
};

/**
 * 获取运单详情
 * @param {number} id 运单ID
 */
export const getLogisticsWaybill = (id) => {
  return api.get(`/logistics-waybills/${id}`);
};

/**
 * 创建运单
 * @param {Object} data 运单数据
 */
export const createLogisticsWaybill = (data) => {
  return api.post('/logistics-waybills', data);
};

/**
 * 更新运单
 * @param {number} id 运单ID
 * @param {Object} data 运单数据
 */
export const updateLogisticsWaybill = (id, data) => {
  return api.put(`/logistics-waybills/${id}`, data);
};

/**
 * 删除运单
 * @param {number} id 运单ID
 */
export const deleteLogisticsWaybill = (id) => {
  return api.delete(`/logistics-waybills/${id}`);
};

/**
 * 获取可供绑定的 FBA 货件列表
 * @param {Object} params {status_list, keyword, exclude_waybill_id}
 */
export const getAvailableShipments = (params = {}) => {
  return api.get('/logistics-waybills/available-shipments', { params });
};


