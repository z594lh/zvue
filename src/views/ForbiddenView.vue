<template>
  <div class="forbidden-page">
    <div class="forbidden-box">
      <div class="icon">🚫</div>
      <h1>403</h1>
      <p>抱歉，您没有权限访问该页面</p>
      <router-link to="/" class="back-btn">返回首页</router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ForbiddenView'
}
</script>

<style scoped>
.forbidden-page {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.forbidden-box {
  text-align: center;
  padding: 40px;
}

.icon {
  font-size: 64px;
  margin-bottom: 16px;
}

h1 {
  font-size: 48px;
  font-weight: bold;
  color: #e74c3c;
  margin: 0 0 8px 0;
}

p {
  font-size: 16px;
  color: #666;
  margin: 0 0 24px 0;
}

.back-btn {
  display: inline-block;
  padding: 12px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}
</style>
