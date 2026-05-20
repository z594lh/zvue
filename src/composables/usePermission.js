const PERMISSIONS_KEY = 'user_permissions'

/**
 * 设置用户权限列表
 * @param {string[]} permissions
 */
export const setUserPermissions = (permissions) => {
  if (permissions && Array.isArray(permissions)) {
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions))
  }
}

/**
 * 获取用户权限列表
 * @returns {string[]}
 */
export const getUserPermissions = () => {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * 清除用户权限
 */
export const clearUserPermissions = () => {
  localStorage.removeItem(PERMISSIONS_KEY)
}

/**
 * 检查是否有指定权限
 * @param {string} code 权限码，如 'expenses:create'
 * @returns {boolean}
 */
export const hasPermission = (code) => {
  if (!code) return true
  const permissions = getUserPermissions()
  return permissions.includes(code)
}

/**
 * 检查是否有任意一个权限
 * @param {string[]} codes 权限码数组
 * @returns {boolean}
 */
export const hasAnyPermission = (codes) => {
  if (!codes || codes.length === 0) return true
  const permissions = getUserPermissions()
  return codes.some((code) => permissions.includes(code))
}

/**
 * 检查是否拥有指定模块的页面权限（:page）
 * @param {string} moduleCode 模块名，如 'expenses'
 * @returns {boolean}
 */
export const hasPagePermission = (moduleCode) => {
  return hasPermission(`${moduleCode}:page`)
}

/**
 * Vue3 Composition API 用法
 * 在 setup 中使用
 */
export function usePermission() {
  return {
    permissions: getUserPermissions(),
    hasPermission,
    hasAnyPermission,
    hasPagePermission
  }
}
