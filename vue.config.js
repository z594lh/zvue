// vue.config.js
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    host: '::', // 同时支持 IPv4 和 IPv6
    port: 8421,
    allowedHosts: 'all', // 允许所有 Host 请求
    proxy: {
      '/api': {
        target: process.env.VUE_APP_API_BASE_URL, // 使用环境变量
        changeOrigin: true
      }
    }
  }
})
