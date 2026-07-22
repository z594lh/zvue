// src/services/api.js
import axios from 'axios';

// src/services/api.js
const api = axios.create({
  baseURL: '/api',  // 同源：开发走 devServer 代理，生产走 CF Pages Functions 反代
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

/**
 * 上传用户头像
 * @param {FormData} formData 包含 avatar 图片文件
 */
export const uploadAvatar = (formData) => {
  return api.post('/user/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
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

// ==================== 权限缓存 ====================

const PERMISSIONS_KEY = 'user_permissions';

export const setUserPermissions = (permissions) => {
  if (permissions && Array.isArray(permissions)) {
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
  }
};

export const getUserPermissions = () => {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearUserPermissions = () => {
  localStorage.removeItem(PERMISSIONS_KEY);
};

// ==================== 菜单缓存 ====================

const MENUS_KEY = 'user_menus';

export const setUserMenus = (menus) => {
  if (menus && Array.isArray(menus)) {
    localStorage.setItem(MENUS_KEY, JSON.stringify(menus));
  }
};

export const getUserMenus = () => {
  try {
    const raw = localStorage.getItem(MENUS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearUserMenus = () => {
  localStorage.removeItem(MENUS_KEY);
};

/**
 * 根据路径从菜单缓存中查找对应的 permission_code
 * @param {string} path 路由路径
 * @returns {string|null}
 */
export const findPermissionCodeByPath = (path) => {
  const menus = getUserMenus();
  const flat = [];
  const walk = (list) => {
    list.forEach((item) => {
      flat.push(item);
      if (item.children) walk(item.children);
    });
  };
  walk(menus);
  const found = flat.find((item) => item.path === path && item.permission_code);
  return found ? found.permission_code : null;
};

// ==================== 记账（transactions）相关接口 ====================

/**
 * 获取交易记录列表
 * @param {Object} params {transaction_type, month, category, account_type, reimbursed, created_by, source_no, page, page_size}
 */
export const getTransactionList = (params = {}) => {
  return api.get('/transactions/list', { params });
};

// 兼容旧命名
export const getExpenseList = getTransactionList;

/**
 * 新增交易记录
 * @param {Object} data {transaction_type, date, category, amount, remark, has_invoice, invoice_image, account_type, reimbursed}
 */
export const createTransaction = (data) => {
  return api.post('/transactions/add', data);
};

// 兼容旧命名
export const createExpense = createTransaction;

/**
 * 更新交易记录
 * @param {string} id 记录ID
 * @param {Object} data 更新数据
 */
export const updateTransaction = (id, data) => {
  return api.put(`/transactions/${id}`, data);
};

// 兼容旧命名
export const updateExpense = updateTransaction;

/**
 * 切换私账报销状态
 * @param {string} id 记录ID
 */
export const toggleReimburseStatus = (id) => {
  return api.patch(`/transactions/${id}/reimburse`);
};

/**
 * 删除交易记录
 * @param {string} id 记录ID
 */
export const deleteTransaction = (id) => {
  return api.delete(`/transactions/${id}`);
};

// 兼容旧命名
export const deleteExpense = deleteTransaction;

/**
 * 上传发票图片（独立接口，返回图片URL）
 * @param {FormData} formData 包含 invoice 文件
 */
export const uploadInvoiceImage = (formData) => {
  return api.post('/transactions/upload-invoice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * 获取交易记录操作日志
 * @param {string} id 记录ID
 */
export const getTransactionLogs = (id) => {
  return api.get(`/transactions/${id}/logs`);
};

// 兼容旧命名
export const getExpenseLogs = getTransactionLogs;

/**
 * 获取交易统计汇总
 * @param {Object} params {transaction_type, month, category, account_type, reimbursed, created_by}
 */
export const getTransactionSummary = (params = {}) => {
  return api.get('/transactions/summary', { params });
};

// 兼容旧命名
export const getExpenseSummary = getTransactionSummary;

// ==================== 下拉框选项接口 (/options) ====================

export const getShopOptions = () => {
  return api.get('/options/shops');
};

export const getSupplierOptions = () => {
  return api.get('/options/suppliers');
};

export const getProductOptions = () => {
  return api.get('/options/products');
};

export const getCategoryOptions = () => {
  return api.get('/options/products/categories');
};

export const getLogisticsProviderOptions = () => {
  return api.get('/options/logistics-providers');
};

export const getUserOptions = () => {
  return api.get('/options/users');
};

/**
 * 获取记账分类下拉（支出/收入/盘盈冲正）
 * @param {Object} params {type: 'expense'|'income'|'adjustment'}
 */
export const getTransactionCategories = (params = {}) => {
  return api.get('/options/transactions/categories', { params });
};

export const getWarehouseOptions = (shop_id) => {
  return api.get('/options/amazon/warehouses', { params: { shop_id } });
};

export const getShipmentOptions = () => {
  return api.get('/options/amazon/shipments');
};

export const getInboundPlanOptions = () => {
  return api.get('/options/amazon/inbound-plans');
};

export const getProductBoardFilterOptions = () => {
  return api.get('/options/product-board/filters');
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
export const exportAmazonShipmentInvoice = (shipment_id, shop_id, logistics_provider_id = null) => {
  const params = { shop_id };
  if (logistics_provider_id) {
    params.provider_id = logistics_provider_id;
  }
  return api.get(`/amazon/shipments/${shipment_id}/invoice/export`, {
    params,
    responseType: 'blob'
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

/**
 * 同步单个货件详情
 * @param {string} shipment_id 货件ID
 * @param {number} shop_id 店铺ID
 */
export const syncInboundShipmentDetail = (shipment_id, shop_id) => {
  return api.post(`/amazon/sync/inbound-shipments/${shipment_id}/detail`, { shop_id });
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


/**
 * 同步入库计划箱子数据
 * @param {string} plan_id 入库计划ID
 * @param {Object} data {shop_id}
 */
export const syncAmazonInboundPlanBoxes = (plan_id, data = {}) => {
  return api.post(`/amazon/sync/inbound-plans/${plan_id}/boxes`, data);
};


// ==================== 亚马逊入库计划相关接口 ====================

/**

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
 * @param {Object} data {shop_name, seller_id, sp_refresh_token, marketplace_id, region, credential_group_id, ads_refresh_token, ads_profile_id, is_default}
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

// ==================== 亚马逊广告 API 授权相关接口 ====================

/**
 * 获取广告 API 授权链接（需复制到紫鸟浏览器中打开）
 * @param {number} shopId 店铺ID
 */
export const getAdsAuthorizeUrl = (shopId) => {
  return api.get('/amazon/ads/authorize-url', { params: { shop_id: shopId } });
};

/**
 * 获取店铺下的广告账户 profile 列表（需已完成授权）
 * @param {number} shopId 店铺ID
 */
export const getAdsProfiles = (shopId) => {
  return api.get('/amazon/ads/profiles', { params: { shop_id: shopId } });
};

/**
 * 手动设置 ads_profile_id
 * @param {Object} data {shop_id, profile_id}
 */
export const setAdsProfile = (data) => {
  return api.post('/amazon/ads/profile', data);
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

/**
 * 批量修改供应商状态
 * @param {Object} data {ids: number[], status: number}
 */
export const batchUpdateSupplierStatus = (data) => {
  return api.put('/suppliers/batch-status', data);
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

/**
 * 批量修改进货单状态
 * @param {Object} data {ids: number[], status: number}
 */
export const batchUpdatePurchaseOrderStatus = (data) => {
  return api.put('/purchase-orders/batch-status', data);
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

/**
 * 售价反推利润率
 * @param {Object} data {seller_sku, selling_price, ad_rate, refund_rate, shop_id}
 */
export const calculateProfitRate = (data) => {
  return api.post('/pricing/profit-rate', data);
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

/**
 * 批量修改货代状态
 * @param {Object} data {ids: number[], status: number}
 */
export const batchUpdateLogisticsProviderStatus = (data) => {
  return api.put('/logistics-providers/batch-status', data);
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

export const patchAmazonListingLanguage = (sku, data) => {
  return api.patch(`/amazon/listings/${sku}/language`, data);
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

/**
 * 同步单个 Listing（从 SP-API 拉取最新数据）
 * @param {string} sku 卖家 SKU
 * @param {number} shop_id 店铺ID
 */
export const syncAmazonListing = (sku, shop_id) => {
  return api.post(`/amazon/listings/${sku}/sync`, { shop_id });
};

// ==================== 选品看板（备货看板）相关接口 ====================

/**
 * 获取选品看板产品列表
 * @param {Object} params {keyword, amazon_status, is_listed, min_sales, sort_by, sort_dir, page, page_size}
 */
export const getProductBoardList = (params = {}) => {
  return api.get('/product-board', { params });
};

/**
 * 获取选品看板统计概览
 */
export const getProductBoardStats = () => {
  return api.get('/product-board/stats');
};

/**
 * 获取选品看板筛选选项
 * 返回 { amazon_statuses: [] }
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
 * @param {Object} params {keyword, amazon_status, is_listed, min_sales}
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

// ==================== 报表中心相关接口 ====================

/**
 * 获取经营报表列表
 * @param {Object} params {type, start_date, end_date, shop_id, page, page_size}
 */
export const getBusinessReports = (params = {}) => {
  return api.get('/reports/business', { params });
};

/**
 * 获取经营报表汇总
 * @param {Object} params {type, start_date, end_date, shop_id}
 * @returns {Object} data 建议包含：sum_sales, sum_total_cost, sum_gross_profit, sum_orders,
 *                   record_count, cost_breakdown: {ad_cost, fba_fees, platform_fees, product_cost, headway_cost, refund_amount}
 */
export const getBusinessSummary = (params = {}) => {
  return api.get('/reports/business/summary', { params });
};

/**
 * 获取经营趋势
 * @param {Object} params {type, start_date, end_date, shop_id}
 */
export const getBusinessTrend = (params = {}) => {
  return api.get('/reports/business/trend', { params });
};

/**
 * 获取成本构成汇总（用于成本饼图，按筛选日期范围聚合）
 * @param {Object} params {type, start_date, end_date, shop_id}
 * @returns {Object} data {ad_cost, fba_fees, platform_fees, product_cost, headway_cost, refund_amount, total_cost}
 */
export const getBusinessCostBreakdown = (params = {}) => {
  return api.get('/reports/business/cost-breakdown', { params });
};

/**
 * 手动触发经营报表生成
 * @param {Object} data {report_type, period, shop_id}
 */
export const generateBusinessReport = (data = {}) => {
  return api.post('/reports/business/generate', data);
};

/**
 * 获取SKU利润列表
 * @param {Object} params {keyword, start_date, end_date, shop_id, page, page_size}
 */
export const getSkuProfitList = (params = {}) => {
  return api.get('/reports/sku-profit', { params });
};

/**
 * 获取SKU利润排行
 * @param {Object} params {sort_by, sort_dir, limit, start_date, end_date, shop_id}
 */
export const getSkuProfitTop = (params = {}) => {
  return api.get('/reports/sku-profit/top', { params });
};

/**
 * 获取SKU利润汇总（按日期范围聚合到SKU维度）
 * @param {Object} params {keyword, start_date, end_date, shop_id, page, page_size}
 */
export const getSkuProfitAggregate = (params = {}) => {
  return api.get('/reports/sku-profit/aggregate', { params });
};

/**
 * 手动触发SKU利润生成
 * @param {Object} data {period_start, period_end, shop_id}
 */
export const generateSkuProfit = (data = {}) => {
  return api.post('/reports/sku-profit/generate', data);
};

// ==================== SKU 销售数据报表接口 ====================

/**
 * 获取 SKU 销售数据列表
 * @param {Object} params {keyword, sku, shop_id, sort_by, sort_dir, page, page_size}
 */
export const getSkuSalesList = (params = {}) => {
  return api.get('/reports/sku-sales', { params });
};

/**
 * 手动全量生成 SKU 销售数据报表
 * @param {Object} data {report_date, shop_id}
 */
export const generateSkuSales = (data = {}) => {
  return api.post('/reports/sku-sales/generate', data);
};

/**
 * 手动单 SKU 生成 SKU 销售数据报表
 * @param {string} sku SKU 编号
 * @param {Object} data {shop_id, report_date}
 */
export const generateSkuSalesForSku = (sku, data = {}) => {
  return api.post(`/reports/sku-sales/generate/${encodeURIComponent(sku)}`, data);
};

/**
 * 获取库存周转列表
 * @param {Object} params {status, keyword, sku, shop_id, page, page_size}
 */
export const getInventoryTurnover = (params = {}) => {
  return api.get('/reports/inventory-turnover', { params });
};

/**
 * 获取库存周转统计
 * @param {Object} params {shop_id}
 */
export const getInventoryStats = (params = {}) => {
  return api.get('/reports/inventory-turnover/stats', { params });
};

/**
 * 按库存状态获取SKU列表（用于汇总卡片点击弹框）
 * @param {Object} params {status, keyword, shop_id, page, page_size}
 */
export const getInventoryByStatus = (params = {}) => {
  return api.get('/reports/inventory-turnover/by-status', { params });
};

/**
 * 手动触发库存周转生成
 * @param {Object} data {shop_id}
 */
export const generateInventoryTurnover = (data = {}) => {
  return api.post('/reports/inventory-turnover/generate', data);
};

/**
 * 批量更新库存状态
 * @param {Object} data {ids, status}
 */
export const batchUpdateInventoryStatus = (data = {}) => {
  return api.post('/reports/inventory-turnover/batch-update-status', data);
};

/**
 * 一键生成昨日全部报表
 */
export const generateYesterdayReports = () => {
  return api.post('/reports/generate-yesterday');
};

/**
 * 查询生成日志
 * @param {Object} params {report_type, status, page, page_size}
 */
export const getGenerationLogs = (params = {}) => {
  return api.get('/reports/generation-logs', { params });
};

/**
 * 导入广告费明细
 * @deprecated 数据已改为自动同步 (amazon_ads_raw_reports)，手动导入写入旧表不再流入报表。
 *             请使用 syncAmazonAdsReports 进行手动同步。
 * @param {Object} data {records}
 */
export const importAdSpend = (data = {}) => {
  return api.post('/reports/ad-spend/import', data);
};

// ==================== 广告数据同步接口 ====================

/**
 * 手动同步广告数据（单店铺）
 * 同步阻塞调用，每次约需 1-6 分钟，建议前端设置 10 分钟超时
 * @param {Object} data {shop_id, date}  date 可选，默认昨天
 */
export const syncAmazonAdsReports = (data = {}) => {
  return api.post('/amazon/ads/reports/sync', data, { timeout: 600000 });
};

/**
 * 查询广告数据同步状态
 * @param {Object} params {shop_id, date}
 */
export const getAmazonAdsReportsStatus = (params = {}) => {
  return api.get('/amazon/ads/reports/status', { params });
};

/**
 * 导入退款明细
 * @param {Object} data {records}
 */
export const importRefundRecords = (data = {}) => {
  return api.post('/reports/refund/import', data);
};

// ==================== 广告效果报表接口 ====================

/**
 * 广告效果报表列表
 * @param {Object} params {type, dimension, campaign_id, ad_group_id, asin, start_date, end_date, shop_id, page, page_size}
 */
export const getAdvertisingReports = (params = {}) => {
  return api.get('/reports/advertising', { params });
};

/**
 * 广告效果汇总统计
 * @param {Object} params {type, dimension, start_date, end_date, shop_id}
 */
export const getAdvertisingSummary = (params = {}) => {
  return api.get('/reports/advertising/summary', { params });
};

/**
 * 广告效果趋势
 * @param {Object} params {type, dimension, start_date, end_date, shop_id}
 */
export const getAdvertisingTrend = (params = {}) => {
  return api.get('/reports/advertising/trend', { params });
};

/**
 * 手动触发广告效果报表生成
 * @param {Object} data {report_type, period, period_start, period_end, shop_id}
 */
export const generateAdvertisingReport = (data = {}) => {
  return api.post('/reports/advertising/generate', data);
};

// ==================== 广告筛选下拉框接口 ====================

/**
 * 广告活动下拉（数据来自 amazon_ads_raw_reports 去重）
 * @param {Object} params {shop_id}
 */
export const getAdvertisingCampaignOptions = (params = {}) => {
  return api.get('/options/advertising/campaigns', { params });
};

/**
 * 广告组下拉（按活动联动，数据来自 amazon_ads_raw_reports 去重）
 * @param {Object} params {shop_id, campaign_id}
 */
export const getAdvertisingAdGroupOptions = (params = {}) => {
  return api.get('/options/advertising/ad-groups', { params });
};

/**
 * 推广ASIN下拉（按活动联动，数据来自 amazon_ads_raw_reports 去重）
 * @param {Object} params {shop_id, campaign_id}
 */
export const getAdvertisingAsinOptions = (params = {}) => {
  return api.get('/options/advertising/asins', { params });
};

/**
 * 广告商品下拉（按活动+广告组联动，数据来自 amazon_ads_raw_reports 去重）
 * @param {Object} params {shop_id, campaign_id, ad_group_id}
 */
export const getAdvertisingProductOptions = (params = {}) => {
  return api.get('/options/advertising/products', { params });
};

// ==================== 广告效果分日明细接口（四层可展开表格）====================

/**
 * 获取分日广告完整树形数据（当前页一次性返回：日期 -> 活动 -> 广告组 -> 商品）
 * @param {Object} params {type, start_date, end_date, shop_id, page, page_size}
 */
export const getAdvertisingDailyTree = (params = {}) => {
  return api.get('/reports/advertising/daily/tree', { params });
};

// ==================== 广告原始数据详情接口（对标 Amazon 后台页签）====================

/**
 * 客户搜索词详情（对标 Amazon 后台 → 搜索词 页签）
 * @param {Object} params {start_date, end_date, campaign_id, ad_group_id, shop_id,
 *                         sort_by, sort_dir, page, page_size, keyword}
 */
export const getAdvertisingSearchTerms = (params = {}) => {
  return api.get('/reports/advertising/search-terms', { params });
};

/**
 * 关键词定向详情（对标 Amazon 后台 → 定向 页签）
 * @param {Object} params {start_date, end_date, campaign_id, ad_group_id, shop_id,
 *                         sort_by, sort_dir, page, page_size, keyword}
 */
export const getAdvertisingTargeting = (params = {}) => {
  return api.get('/reports/advertising/targeting', { params });
};

/**
 * 广告活动详情（对标 Amazon 后台 → 广告活动 列表）
 * @param {Object} params {start_date, end_date, campaign_id, ad_group_id, shop_id,
 *                         sort_by, sort_dir, page, page_size, keyword}
 */
export const getAdvertisingCampaigns = (params = {}) => {
  return api.get('/reports/advertising/campaigns', { params });
};

/**
 * 推广商品详情（对标 Amazon 后台 → 推广的商品 页签）
 * @param {Object} params {start_date, end_date, campaign_id, ad_group_id, shop_id,
 *                         sort_by, sort_dir, page, page_size, asin, keyword}
 */
export const getAdvertisingProducts = (params = {}) => {
  return api.get('/reports/advertising/products', { params });
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

/**
 * 导入运单
 * @param {FormData} formData
 */
export const importLogisticsWaybills = (formData) => {
  return api.post('/logistics-waybills/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * 批量修改运单状态
 * @param {Object} data {ids: number[], status: number}
 */
export const batchUpdateLogisticsWaybillStatus = (data) => {
  return api.put('/logistics-waybills/batch-status', data);
};

/**
 * 获取计划任务（Cron Tasks）列表
 */
export const getCronTasks = (params = {}) => {
  return api.get('/cron/tasks', { params });
};

/**
 * 获取当前用户的菜单列表（后端已按权限过滤）
 */
export const getMenus = () => {
  return api.get('/menus');
};

// ==================== 权限管理（RBAC）接口 ====================

/**
 * 获取全部权限树（按模块分组）
 */
export const getPermissionsTree = () => {
  return api.get('/permissions');
};

/**
 * 创建权限
 * @param {Object} data {code, name, type, module, description}
 */
export const createPermission = (data) => {
  return api.post('/permissions', data);
};

/**
 * 修改权限
 * @param {number} id 权限ID
 * @param {Object} data
 */
export const updatePermission = (id, data) => {
  return api.put(`/permissions/${id}`, data);
};

/**
 * 删除权限
 * @param {number} id 权限ID
 */
export const deletePermission = (id) => {
  return api.delete(`/permissions/${id}`);
};

/**
 * 获取角色列表
 */
export const getRoles = () => {
  return api.get('/roles');
};

/**
 * 创建角色
 * @param {Object} data {name, code, description, status}
 */
export const createRole = (data) => {
  return api.post('/roles', data);
};

/**
 * 修改角色
 * @param {number} id 角色ID
 * @param {Object} data {name, code, description, status}
 */
export const updateRole = (id, data) => {
  return api.put(`/roles/${id}`, data);
};

/**
 * 删除角色
 * @param {number} id 角色ID
 */
export const deleteRole = (id) => {
  return api.delete(`/roles/${id}`);
};

/**
 * 获取角色权限码列表
 * @param {number} id 角色ID
 */
export const getRolePermissions = (id) => {
  return api.get(`/roles/${id}/permissions`);
};

/**
 * 分配角色权限
 * @param {number} id 角色ID
 * @param {Object} data {permission_codes: string[]}
 */
export const assignRolePermissions = (id, data) => {
  return api.put(`/roles/${id}/permissions`, data);
};

/**
 * 获取用户列表（含角色）
 * @param {Object} params {keyword, page, page_size}
 */
export const getAdminUsers = (params = {}) => {
  return api.get('/users', { params });
};

/**
 * 分配用户角色
 * @param {number} id 用户ID
 * @param {Object} data {role_ids: number[]}
 */
export const assignUserRoles = (id, data) => {
  return api.put(`/users/${id}/roles`, data);
};

/**
 * 启用/禁用用户账号
 * @param {number} id 用户ID
 * @param {Object} data {status: 0|1}
 */
export const updateUserStatus = (id, data) => {
  return api.put(`/users/${id}/status`, data);
};

/**
 * 获取用户直接授予的权限ID列表
 * @param {number} id 用户ID
 */
export const getUserDirectPermissions = (id) => {
  return api.get(`/users/${id}/permissions/direct`);
};

/**
 * 设置用户直接权限（全量覆盖）
 * @param {number} id 用户ID
 * @param {Object} data {permission_ids: number[]}
 */
export const setUserDirectPermissions = (id, data) => {
  return api.put(`/users/${id}/permissions`, data);
};

// ==================== 亚马逊入库计划相关接口 ====================

// ==================== 箱唛整理任务接口 ====================

/**
 * 新建箱唛整理任务
 * @param {Object} data {shop_id, inbound_plan_id, crop_config}
 */
/**
 * 新建箱唛整理任务（multipart/form-data）
 * @param {FormData} formData 包含 shop_id, inbound_plan_id, crop_config(字符串), cargo_agent_zip(可选)
 */
export const createLabelOrganizeTask = (formData) => {
  return api.post('/fba/organize-plan-labels', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * 获取箱唛整理任务列表
 * @param {Object} params {shop_id, status, page, page_size}
 */
export const getLabelOrganizeTasks = (params = {}) => {
  return api.get('/fba/organize-plan-labels/tasks', { params });
};

/**
 * 获取箱唛整理任务详情
 * @param {string} taskId 任务ID
 */
export const getLabelOrganizeTaskDetail = (taskId) => {
  return api.get(`/fba/organize-plan-labels/tasks/${taskId}`);
};

/**
 * 下载箱唛整理结果 ZIP
 * @param {string} taskId 任务ID
 */
export const downloadLabelOrganizeResult = (taskId) => {
  return api.get(`/fba/organize-plan-labels/tasks/${taskId}/download`, {
    responseType: 'blob'
  });
};

/**
 * 删除箱唛整理任务
 * @param {string} taskId 任务ID
 */
export const deleteLabelOrganizeTask = (taskId) => {
  return api.delete(`/fba/organize-plan-labels/tasks/${taskId}`);
};

/**
 * 取消箱唛整理任务
 * @param {string} taskId 任务ID
 */
export const cancelLabelOrganizeTask = (taskId) => {
  return api.post(`/fba/organize-plan-labels/tasks/${taskId}/cancel`);
};

/**
 * 重试箱唛整理任务
 * @param {string} taskId 任务ID
 */
export const retryLabelOrganizeTask = (taskId) => {
  return api.post(`/fba/organize-plan-labels/tasks/${taskId}/retry`);
};

// ==================== 物流发票导出 ====================

export const createInvoiceOrganizeTask = (data) => {
  return api.post('/amazon/invoices/organize', data)
}

export const getInvoiceOrganizeTasks = (params = {}) => {
  return api.get('/amazon/invoices/organize/tasks', { params })
}

export const getInvoiceOrganizeTaskDetail = (taskId) => {
  return api.get(`/amazon/invoices/organize/tasks/${taskId}`)
}

export const downloadInvoiceOrganizeResult = (taskId) => {
  return api.get(`/amazon/invoices/organize/tasks/${taskId}/download`, {
    responseType: 'blob'
  })
}

export const deleteInvoiceOrganizeTask = (taskId) => {
  return api.delete(`/amazon/invoices/organize/tasks/${taskId}`)
}

export const cancelInvoiceOrganizeTask = (taskId) => {
  return api.post(`/amazon/invoices/organize/tasks/${taskId}/cancel`)
}

export const retryInvoiceOrganizeTask = (taskId) => {
  return api.post(`/amazon/invoices/organize/tasks/${taskId}/retry`)
}

// ==================== 菜单管理接口 ====================

/**
 * 获取全部菜单（管理端，不过滤权限）
 */
export const getAdminMenus = () => {
  return api.get('/menus/admin');
};

/**
 * 创建菜单
 * @param {Object} data {parent_id, label, path, icon, permission_id, sort_order, status}
 */
export const createMenu = (data) => {
  return api.post('/menus', data);
};

/**
 * 修改菜单
 * @param {number} id 菜单ID
 * @param {Object} data
 */
export const updateMenu = (id, data) => {
  return api.put(`/menus/${id}`, data);
};

/**
 * 删除菜单（会级联删除子菜单）
 * @param {number} id 菜单ID
 */
export const deleteMenu = (id) => {
  return api.delete(`/menus/${id}`);
};


