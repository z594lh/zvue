// vue.config.js
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    host: '::', // 同时支持 IPv4 和 IPv6
    port: 8421,
    allowedHosts: 'all', // 允许所有 Host 请求
    client: {
      overlay: {
        errors: true,
        warnings: false,
        // 忽略 Element Plus el-table 在弹窗中触发的良性 ResizeObserver 循环告警
        runtimeErrors: (error) => {
          const msg = error && error.message ? error.message : ''
          if (msg.includes('ResizeObserver loop')) {
            return false
          }
          return true
        }
      }
    },
    proxy: {
      '/api': {
        target: process.env.VUE_APP_API_BASE_URL || 'http://127.0.0.1:5000' , // 使用环境变量
        changeOrigin: true
      }
    }
  }
})
