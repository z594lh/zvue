<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1 class="logo">ZywTools</h1>
        <p class="subtitle">欢迎回来</p>
      </div>

      <!-- 选项卡切换 -->
      <div class="tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'login' }]"
          @click="activeTab = 'login'"
        >
          登录
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'register' }]"
          @click="activeTab = 'register'"
        >
          注册
        </button>
      </div>

      <!-- 登录表单 -->
      <form v-if="activeTab === 'login'" class="form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="loginForm.username"
            type="text"
            placeholder="请输入用户名"
            required
            minlength="3"
          />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            required
            minlength="6"
          />
        </div>
        <div v-if="loginError" class="error-message">{{ loginError }}</div>
        <button type="submit" class="submit-btn" :disabled="loginLoading">
          {{ loginLoading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- 注册表单 -->
      <form v-else class="form" @submit.prevent="handleRegister">
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="registerForm.username"
            type="text"
            placeholder="3-50个字符"
            required
            minlength="3"
            maxlength="50"
          />
        </div>
        <div class="form-group">
          <label>昵称</label>
          <input
            v-model="registerForm.nickname"
            type="text"
            placeholder="请输入昵称（可选）"
          />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            v-model="registerForm.password"
            type="password"
            placeholder="至少6个字符"
            required
            minlength="6"
          />
        </div>
        <div class="form-group">
          <label>确认密码</label>
          <input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            required
          />
        </div>
        <div v-if="registerError" class="error-message">{{ registerError }}</div>
        <button type="submit" class="submit-btn" :disabled="registerLoading">
          {{ registerLoading ? '注册中...' : '注册' }}
        </button>
      </form>

      <!-- 底部链接 -->
      <div class="footer">
        <p v-if="activeTab === 'login'">
          还没有账号？<a @click="activeTab = 'register'">立即注册</a>
        </p>
        <p v-else>
          已有账号？<a @click="activeTab = 'login'">立即登录</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, ref, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { login, register, setAuthToken } from '@/services/api.js'

export default {
  name: 'LoginView',
  setup() {
    const router = useRouter()
    const { proxy } = getCurrentInstance()
    const activeTab = ref('login')

    // 登录表单
    const loginForm = reactive({
      username: '',
      password: ''
    })
    const loginLoading = ref(false)
    const loginError = ref('')

    // 注册表单
    const registerForm = reactive({
      username: '',
      nickname: '',
      password: '',
      confirmPassword: ''
    })
    const registerLoading = ref(false)
    const registerError = ref('')

    // 登录处理
    const handleLogin = async () => {
      loginError.value = ''
      loginLoading.value = true

      try {
        const res = await login({
          username: loginForm.username.trim(),
          password: loginForm.password.trim()
        })

        if (res.data.status === 'success') {
          // 保存token
          setAuthToken(res.data.data.token)
          // 提示成功
          proxy.$message.success({ message: '登录成功！', offset: window.innerHeight / 2 - 50 })
          // 触发登录成功事件，通知导航栏更新
          window.dispatchEvent(new CustomEvent('login-success'))
          // 跳转到首页
          router.push('/ai-image')
        } else {
          loginError.value = res.data.message || '登录失败'
        }
      } catch (error) {
        console.error('登录错误:', error)
        if (error.response) {
          loginError.value = error.response.data?.message || '登录失败'
        } else {
          loginError.value = '网络错误，请稍后重试'
        }
      } finally {
        loginLoading.value = false
      }
    }

    // 注册处理
    const handleRegister = async () => {
      registerError.value = ''

      // 验证密码
      if (registerForm.password !== registerForm.confirmPassword) {
        registerError.value = '两次输入的密码不一致'
        return
      }

      registerLoading.value = true

      try {
        const res = await register({
          username: registerForm.username.trim(),
          password: registerForm.password.trim(),
          nickname: registerForm.nickname.trim() || undefined
        })

        if (res.data.status === 'success') {
          proxy.$message.success({ message: '注册成功！请登录', offset: window.innerHeight / 2 - 50 })
          // 切换到登录页并填充用户名
          activeTab.value = 'login'
          loginForm.username = registerForm.username
          registerForm.username = ''
          registerForm.nickname = ''
          registerForm.password = ''
          registerForm.confirmPassword = ''
        } else {
          registerError.value = res.data.message || '注册失败'
        }
      } catch (error) {
        console.error('注册错误:', error)
        if (error.response) {
          registerError.value = error.response.data?.message || '注册失败'
        } else {
          registerError.value = '网络错误，请稍后重试'
        }
      } finally {
        registerLoading.value = false
      }
    }

    return {
      activeTab,
      loginForm,
      loginLoading,
      loginError,
      registerForm,
      registerLoading,
      registerError,
      handleLogin,
      handleRegister
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  font-size: 28px;
  font-weight: bold;
  color: #667eea;
  margin: 0 0 8px 0;
}

.subtitle {
  color: #666;
  font-size: 14px;
  margin: 0;
}

/* 选项卡 */
.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
  border-bottom: 2px solid #f0f0f0;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  border: none;
  background: none;
  font-size: 16px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  position: relative;
  transition: color 0.3s;
}

.tab-btn:hover {
  color: #667eea;
}

.tab-btn.active {
  color: #667eea;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #667eea;
}

/* 表单 */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input::placeholder {
  color: #aaa;
}

/* 错误提示 */
.error-message {
  color: #e74c3c;
  font-size: 13px;
  text-align: center;
  padding: 8px;
  background: #fdf2f2;
  border-radius: 6px;
}

/* 提交按钮 */
.submit-btn {
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-top: 8px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 底部链接 */
.footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.footer p {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.footer a {
  color: #667eea;
  cursor: pointer;
  font-weight: 500;
}

.footer a:hover {
  text-decoration: underline;
}

/* 响应式 */
@media (max-width: 480px) {
  .login-container {
    padding: 30px 20px;
  }

  .logo {
    font-size: 24px;
  }
}
</style>
