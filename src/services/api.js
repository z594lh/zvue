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
 * @param {string} page_type 标签页面类型，默认 PackageLabel_Thermal_NonPCP
 * @param {number} page_size 每页标签数量，默认 2
 * @param {string} box_id 箱子ID（可选，传则打印单个箱子箱唛）
 */
export const getAmazonShipmentLabels = (shipment_id, page_type = 'PackageLabel_Thermal_NonPCP', page_size = 2, box_id = null) => {
  const params = { page_type, page_size };
  if (box_id) {
    params.box_id = box_id;
  }
  return api.get(`/amazon/shipments/${shipment_id}/labels`, { params });
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
 */
export const syncAmazonInboundPlanBoxes = (plan_id) => {
  return api.post(`/amazon/sync/inbound-plans/${plan_id}/boxes`);
};

/**
 * 获取仓库列表
 */
export const getAmazonWarehouses = () => {
  return api.get('/amazon/warehouses');
};

/**
 * 获取亚马逊入库计划箱子列表
 * @param {string} shipment_id 货件编号（必填）
 * @param {Object} params {page, page_size}
 */
export const getAmazonInboundPlanBoxes = (shipment_id, params = {}) => {
  return api.get('/amazon/inbound-plan-boxes', {
    params: { shipment_id, ...params }
  });
};

// ==================== 亚马逊库存管理相关接口 ====================

/**
 * 获取亚马逊库存列表
 * @param {Object} params {page, page_size, seller_sku, asin}
 */
export const getAmazonInventory = (params = {}) => {
  return api.get('/amazon/inventory', { params });
};

/**
 * 同步库存数据
 * @param {Object} data {seller_skus, start_date_time}
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
