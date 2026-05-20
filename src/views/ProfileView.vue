<template>
  <div class="profile-page">
    <div class="profile-container">
      <h1 class="page-title">个人中心</h1>

      <!-- 头像卡片 -->
      <div class="card">
        <div class="card-title">我的头像</div>
        <div class="avatar-section">
          <div class="avatar-wrapper" @click="triggerAvatarUpload">
            <img v-if="userInfo.avatar" :src="userInfo.avatar" class="avatar-img" alt="头像" />
            <div v-else class="avatar-default">
              {{ userInfo.nickname?.charAt(0)?.toUpperCase() || userInfo.username?.charAt(0)?.toUpperCase() || 'U' }}
            </div>
            <div class="avatar-overlay">
              <span class="avatar-overlay-text">更换头像</span>
            </div>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleAvatarChange"
          />
          <p class="avatar-tip">支持 JPG、PNG 格式，文件不超过 5MB</p>
        </div>
      </div>

      <!-- 头像裁剪弹窗 -->
      <AvatarCropper
        v-model="cropperVisible"
        :image-src="cropperImageSrc"
        @confirm="handleCropConfirm"
      />

      <!-- 基本资料卡片 -->
      <div class="card">
        <div class="card-title">基本资料</div>
        <form class="form" @submit.prevent="handleUpdateProfile">
          <div class="form-group">
            <label>用户名</label>
            <input :value="userInfo.username" type="text" disabled />
          </div>
          <div class="form-group">
            <label>昵称</label>
            <input
              v-model="profileForm.nickname"
              type="text"
              placeholder="请输入昵称"
              maxlength="50"
            />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input
              v-model="profileForm.email"
              type="email"
              placeholder="请输入邮箱"
              maxlength="100"
            />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input
              v-model="profileForm.phone"
              type="text"
              placeholder="请输入手机号"
              maxlength="20"
            />
          </div>
          <div class="form-group">
            <label>个人简介</label>
            <textarea
              v-model="profileForm.bio"
              rows="3"
              placeholder="写点什么介绍自己..."
              maxlength="500"
            ></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="profileLoading">
              {{ profileLoading ? '保存中...' : '保存资料' }}
            </button>
          </div>
        </form>
      </div>

      <!-- 修改密码卡片 -->
      <div class="card">
        <div class="card-title">修改密码</div>
        <form class="form" @submit.prevent="handleChangePassword">
          <div class="form-group">
            <label>当前密码</label>
            <input
              v-model="passwordForm.old_password"
              type="password"
              placeholder="请输入当前密码"
              required
            />
          </div>
          <div class="form-group">
            <label>新密码</label>
            <input
              v-model="passwordForm.new_password"
              type="password"
              placeholder="至少6个字符"
              required
              minlength="6"
            />
          </div>
          <div class="form-group">
            <label>确认新密码</label>
            <input
              v-model="passwordForm.confirm_password"
              type="password"
              placeholder="请再次输入新密码"
              required
            />
          </div>
          <div v-if="passwordError" class="error-message">{{ passwordError }}</div>
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="passwordLoading">
              {{ passwordLoading ? '修改中...' : '修改密码' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, getCurrentInstance } from 'vue'
import { getUserProfile, updateUserProfile, changePassword, uploadAvatar } from '@/services/api.js'
import AvatarCropper from '@/components/AvatarCropper.vue'

export default {
  name: 'ProfileView',
  components: { AvatarCropper },
  setup() {
    const { proxy } = getCurrentInstance()
    const avatarInput = ref(null)

    const userInfo = reactive({
      username: '',
      nickname: '',
      avatar: '',
      email: '',
      phone: '',
      bio: ''
    })

    const profileForm = reactive({
      nickname: '',
      email: '',
      phone: '',
      bio: ''
    })

    const passwordForm = reactive({
      old_password: '',
      new_password: '',
      confirm_password: ''
    })

    const profileLoading = ref(false)
    const passwordLoading = ref(false)
    const passwordError = ref('')

    // 头像裁剪
    const cropperVisible = ref(false)
    const cropperImageSrc = ref('')

    // 获取用户信息
    const fetchUserInfo = async () => {
      try {
        const res = await getUserProfile()
        if (res.data.status === 'success') {
          const data = res.data.data
          userInfo.username = data.username || ''
          userInfo.nickname = data.nickname || ''
          userInfo.avatar = data.avatar || ''
          userInfo.email = data.email || ''
          userInfo.phone = data.phone || ''
          userInfo.bio = data.bio || ''
          profileForm.nickname = data.nickname || ''
          profileForm.email = data.email || ''
          profileForm.phone = data.phone || ''
          profileForm.bio = data.bio || ''
        }
      } catch (error) {
        console.error('获取用户信息失败:', error)
        proxy.$message.error({ message: '获取用户信息失败', offset: 60 })
      }
    }

    // 触发头像上传
    const triggerAvatarUpload = () => {
      avatarInput.value?.click()
    }

    // 选择头像文件 -> 进入裁剪
    const handleAvatarChange = (event) => {
      const file = event.target.files[0]
      if (!file) return

      // 文件类型校验
      if (!file.type.startsWith('image/')) {
        proxy.$message.warning({ message: '请选择图片文件', offset: 60 })
        event.target.value = ''
        return
      }

      // 文件大小校验（5MB）
      if (file.size > 5 * 1024 * 1024) {
        proxy.$message.warning({ message: '图片大小不能超过 5MB', offset: 60 })
        event.target.value = ''
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        cropperImageSrc.value = e.target.result
        cropperVisible.value = true
      }
      reader.readAsDataURL(file)
      event.target.value = ''
    }

    // 裁剪完成后上传
    const handleCropConfirm = async (blob) => {
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('avatar', file)

      try {
        const res = await uploadAvatar(formData)
        if (res.data.status === 'success') {
          userInfo.avatar = res.data.data.url
          proxy.$message.success({ message: '头像上传成功', offset: 60 })
          window.dispatchEvent(new CustomEvent('login-success'))
        } else {
          proxy.$message.error({ message: res.data.message || '上传失败', offset: 60 })
        }
      } catch (error) {
        console.error('头像上传失败:', error)
        proxy.$message.error({ message: '头像上传失败，请稍后重试', offset: 60 })
      }
    }

    // 更新资料
    const handleUpdateProfile = async () => {
      profileLoading.value = true
      try {
        const res = await updateUserProfile({
          nickname: profileForm.nickname.trim() || undefined,
          email: profileForm.email.trim() || undefined,
          phone: profileForm.phone.trim() || undefined,
          bio: profileForm.bio.trim() || undefined
        })
        if (res.data.status === 'success') {
          userInfo.nickname = profileForm.nickname.trim()
          userInfo.email = profileForm.email.trim()
          userInfo.phone = profileForm.phone.trim()
          userInfo.bio = profileForm.bio.trim()
          proxy.$message.success({ message: '资料保存成功', offset: 60 })
          // 通知导航栏更新用户信息
          window.dispatchEvent(new CustomEvent('login-success'))
        } else {
          proxy.$message.error({ message: res.data.message || '保存失败', offset: 60 })
        }
      } catch (error) {
        console.error('保存资料失败:', error)
        proxy.$message.error({ message: '保存失败，请稍后重试', offset: 60 })
      } finally {
        profileLoading.value = false
      }
    }

    // 修改密码
    const handleChangePassword = async () => {
      passwordError.value = ''

      if (passwordForm.new_password !== passwordForm.confirm_password) {
        passwordError.value = '两次输入的新密码不一致'
        return
      }

      if (passwordForm.new_password.length < 6) {
        passwordError.value = '新密码至少6个字符'
        return
      }

      passwordLoading.value = true
      try {
        const res = await changePassword({
          old_password: passwordForm.old_password,
          new_password: passwordForm.new_password
        })
        if (res.data.status === 'success') {
          proxy.$message.success({ message: '密码修改成功，请重新登录', offset: 60 })
          passwordForm.old_password = ''
          passwordForm.new_password = ''
          passwordForm.confirm_password = ''
        } else {
          passwordError.value = res.data.message || '修改失败'
        }
      } catch (error) {
        console.error('修改密码失败:', error)
        if (error.response && error.response.data?.message) {
          passwordError.value = error.response.data.message
        } else {
          passwordError.value = '修改失败，请稍后重试'
        }
      } finally {
        passwordLoading.value = false
      }
    }

    onMounted(() => {
      fetchUserInfo()
    })

    return {
      avatarInput,
      userInfo,
      profileForm,
      passwordForm,
      profileLoading,
      passwordLoading,
      passwordError,
      cropperVisible,
      cropperImageSrc,
      triggerAvatarUpload,
      handleAvatarChange,
      handleCropConfirm,
      handleUpdateProfile,
      handleChangePassword
    }
  }
}
</script>

<style scoped>
.profile-page {
  min-height: calc(100vh - 60px);
  background: #f5f7fa;
  padding: 24px;
}

.profile-container {
  max-width: 640px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0 0 20px 0;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

/* 头像区域 */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.avatar-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-default {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: bold;
  color: #fff;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.avatar-overlay-text {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.avatar-tip {
  font-size: 12px;
  color: #999;
  margin: 0;
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
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s, box-shadow 0.3s;
  background: #fff;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input::placeholder {
  color: #aaa;
}

.form-group input:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.form-group textarea {
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s, box-shadow 0.3s;
  background: #fff;
  resize: vertical;
  font-family: inherit;
}

.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group textarea::placeholder {
  color: #aaa;
}

.form-actions {
  margin-top: 4px;
}

.submit-btn {
  padding: 12px 28px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  font-size: 13px;
  text-align: center;
  padding: 8px;
  background: #fdf2f2;
  border-radius: 6px;
}

/* 响应式 */
@media (max-width: 640px) {
  .profile-page {
    padding: 16px;
  }

  .card {
    padding: 20px;
  }
}
</style>
