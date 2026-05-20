<template>
  <div class="permissions-page">
    <div class="permissions-container">
      <h1 class="page-title">🔐 权限管理</h1>

      <el-tabs v-model="activeTab" type="border-card">
        <!-- 权限定义 -->
        <el-tab-pane label="权限定义" name="permissions">
          <div class="toolbar">
            <el-button type="primary" @click="openPermDefDialog()">+ 新增权限</el-button>
            <el-button @click="toggleExpandAll">
              {{ isAllExpanded ? '全部折叠' : '全部展开' }}
            </el-button>
          </div>

          <el-collapse v-model="expandedModules">
            <el-collapse-item
              v-for="(perms, module) in permissionGroups"
              :key="module"
              :title="`${module}（${perms.length}）`"
              :name="module"
            >
              <el-table :data="perms" border stripe size="small">
                <el-table-column prop="code" label="权限码" width="180" />
                <el-table-column prop="name" label="权限名称" width="160" />
                <el-table-column prop="type" label="类型" width="80">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.type === 'page' ? 'success' : ''">{{ row.type }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="说明" show-overflow-tooltip />
                <el-table-column label="操作" width="140" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" @click="openPermDefDialog(row)">编辑</el-button>
                    <el-button size="small" type="danger" @click="handleDeletePermission(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </el-tab-pane>

        <!-- 角色管理 -->
        <el-tab-pane label="角色管理" name="roles">
          <div class="toolbar">
            <el-button type="primary" @click="openRoleDialog()">+ 新增角色</el-button>
          </div>

          <el-table :data="roles" v-loading="rolesLoading" border stripe>
            <el-table-column prop="name" label="角色名称" width="140" />
            <el-table-column prop="code" label="标识码" width="140" />
            <el-table-column prop="description" label="描述" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openRoleDialog(row)">编辑</el-button>
                <el-button size="small" type="primary" @click="openPermissionDialog(row)">权限</el-button>
                <el-button size="small" type="danger" @click="handleDeleteRole(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 用户管理 -->
        <el-tab-pane label="用户管理" name="users">
          <div class="toolbar">
            <el-input
              v-model="userSearch.keyword"
              placeholder="搜索用户名/昵称"
              style="width: 240px"
              clearable
              @keyup.enter="fetchUsers"
            >
              <template #append>
                <el-button @click="fetchUsers">搜索</el-button>
              </template>
            </el-input>
          </div>

          <el-table :data="users" v-loading="usersLoading" border stripe>
            <el-table-column prop="username" label="用户名" width="120" />
            <el-table-column prop="nickname" label="昵称" width="120" />
            <el-table-column label="角色" min-width="160">
              <template #default="{ row }">
                <el-tag v-for="role in row.roles" :key="role.id" size="small" style="margin-right: 4px">
                  {{ role.name }}
                </el-tag>
                <span v-if="!row.roles?.length" style="color: #999">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="openUserRoleDialog(row)">分配角色</el-button>
                <el-button size="small" @click="openUserPermDialog(row)">直接权限</el-button>
                <el-button size="small" :type="row.status ? 'danger' : 'success'" @click="toggleUserStatus(row)">
                  {{ row.status ? '禁用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="userSearch.page"
            v-model:page-size="userSearch.page_size"
            :total="userTotal"
            layout="total, prev, pager, next"
            class="pagination"
            @current-change="fetchUsers"
          />
        </el-tab-pane>

        <!-- 菜单管理 -->
        <el-tab-pane label="菜单管理" name="menus">
          <div class="toolbar">
            <el-button type="primary" @click="openMenuDialog()">+ 新增菜单</el-button>
            <el-button @click="toggleExpandAllMenus">
              {{ menusExpanded ? '全部折叠' : '全部展开' }}
            </el-button>
          </div>

          <el-table ref="menuTableRef" :data="menuTree" row-key="id" :tree-props="{ children: 'children' }" border stripe>
            <el-table-column prop="label" label="菜单名称" min-width="160">
              <template #default="{ row }">
                <span :style="{ paddingLeft: row.parent_id === 0 ? '0' : '20px' }">{{ row.label }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="path" label="路径" width="180" />
            <el-table-column prop="permission_code" label="关联权限" width="180">
              <template #default="{ row }">
                <el-tag v-if="row.permission_code" size="small">{{ row.permission_code }}</el-tag>
                <span v-else style="color: #999">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="sort_order" label="排序" width="70" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '显示' : '隐藏' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openMenuDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDeleteMenu(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 权限定义弹窗 -->
    <el-dialog v-model="permDefDialog.visible" :title="permDefDialog.isEdit ? '编辑权限' : '新增权限'" width="460px">
      <el-form :model="permDefDialog.form" label-width="80px">
        <el-form-item label="权限码" required>
          <el-input v-model="permDefDialog.form.code" placeholder="如：expenses:page" />
        </el-form-item>
        <el-form-item label="权限名称" required>
          <el-input v-model="permDefDialog.form.name" placeholder="如：费用管理-页面" />
        </el-form-item>
        <el-form-item label="所属模块">
          <el-input v-model="permDefDialog.form.module" placeholder="如：expenses" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="permDefDialog.form.type">
            <el-radio label="page">页面</el-radio>
            <el-radio label="action">操作</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="permDefDialog.form.description" type="textarea" rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="permDefDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="permDefDialog.loading" @click="submitPermission">保存</el-button>
      </template>
    </el-dialog>

    <!-- 角色弹窗 -->
    <el-dialog v-model="roleDialog.visible" :title="roleDialog.isEdit ? '编辑角色' : '新增角色'" width="460px">
      <el-form :model="roleDialog.form" label-width="80px">
        <el-form-item label="角色名称" required>
          <el-input v-model="roleDialog.form.name" placeholder="如：管理员" />
        </el-form-item>
        <el-form-item label="标识码" required>
          <el-input v-model="roleDialog.form.code" placeholder="如：admin" :disabled="roleDialog.isEdit" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="roleDialog.form.description" type="textarea" rows="2" placeholder="角色描述" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="roleDialog.form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="roleDialog.loading" @click="submitRole">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分配权限弹窗 -->
    <el-dialog v-model="permDialog.visible" title="分配权限" width="560px">
      <div v-loading="permDialog.loading">
        <div class="perm-current-role">当前角色：<strong>{{ permDialog.roleName }}</strong></div>
        <el-tree
          ref="permTreeRef"
          :data="permissionTree"
          show-checkbox
          node-key="id"
          :default-checked-keys="permDialog.checkedKeys"
          :props="{ label: 'label', children: 'children' }"
        />
      </div>
      <template #footer>
        <el-button @click="permDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="permDialog.submitting" @click="submitRolePermissions">保存</el-button>
      </template>
    </el-dialog>

    <!-- 用户角色弹窗 -->
    <el-dialog v-model="userRoleDialog.visible" title="分配角色" width="400px">
      <div class="user-role-current">当前用户：<strong>{{ userRoleDialog.username }}</strong></div>
      <el-checkbox-group v-model="userRoleDialog.selected">
        <el-checkbox v-for="role in roles" :key="role.id" :label="role.id">{{ role.name }}</el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="userRoleDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="userRoleDialog.loading" @click="submitUserRoles">保存</el-button>
      </template>
    </el-dialog>

    <!-- 用户直接权限弹窗 -->
    <el-dialog v-model="userPermDialog.visible" title="直接权限" width="520px">
      <div class="user-role-current">当前用户：<strong>{{ userPermDialog.username }}</strong></div>
      <el-select
        v-model="userPermDialog.selected"
        multiple
        filterable
        clearable
        placeholder="搜索并选择权限"
        style="width: 100%"
      >
        <el-option-group v-for="(perms, module) in permissionGroups" :key="module" :label="module">
          <el-option v-for="p in perms" :key="p.id" :label="`${p.name} (${p.code})`" :value="p.id" />
        </el-option-group>
      </el-select>
      <template #footer>
        <el-button @click="userPermDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="userPermDialog.loading" @click="submitUserDirectPerms">保存</el-button>
      </template>
    </el-dialog>

    <!-- 菜单弹窗 -->
    <el-dialog v-model="menuDialog.visible" :title="menuDialog.isEdit ? '编辑菜单' : '新增菜单'" width="480px">
      <el-form :model="menuDialog.form" label-width="90px">
        <el-form-item label="父菜单">
          <el-select v-model="menuDialog.form.parent_id" placeholder="无（一级菜单）" clearable style="width: 100%">
            <el-option label="无（一级菜单）" :value="0" />
            <el-option v-for="m in rootMenus" :key="m.id" :label="m.label" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="菜单名称" required>
          <el-input v-model="menuDialog.form.label" placeholder="如：支出记账" />
        </el-form-item>
        <el-form-item label="路由路径">
          <el-input v-model="menuDialog.form.path" placeholder="如：/expense" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="menuDialog.form.icon" placeholder="如：WalletOutlined" />
        </el-form-item>
        <el-form-item label="关联权限">
          <el-select v-model="menuDialog.form.permission_id" placeholder="不关联权限" clearable filterable style="width: 100%">
            <el-option label="不关联权限" :value="null" />
            <el-option-group v-for="(perms, module) in permissionGroups" :key="module" :label="module">
              <el-option v-for="p in perms" :key="p.id" :label="`${p.name} (${p.code})`" :value="p.id" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="menuDialog.form.sort_order" :min="0" :max="999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="menuDialog.form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="menuDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="menuDialog.loading" @click="submitMenu">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, getCurrentInstance } from 'vue'
import {
  getPermissionsTree,
  createPermission,
  updatePermission,
  deletePermission,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  assignRolePermissions,
  getAdminUsers,
  assignUserRoles,
  updateUserStatus,
  getUserDirectPermissions,
  setUserDirectPermissions,
  getAdminMenus,
  createMenu,
  updateMenu,
  deleteMenu
} from '@/services/api.js'

export default {
  name: 'SystemPermissionsView',
  setup() {
    const { proxy } = getCurrentInstance()
    const activeTab = ref('permissions')
    const permTreeRef = ref(null)

    // ========== 权限定义 ==========
    const permissionGroups = ref({})
    const expandedModules = ref([])

    const isAllExpanded = computed(() => {
      const modules = Object.keys(permissionGroups.value)
      return modules.length > 0 && modules.every((m) => expandedModules.value.includes(m))
    })

    const toggleExpandAll = () => {
      if (isAllExpanded.value) {
        expandedModules.value = []
      } else {
        expandedModules.value = Object.keys(permissionGroups.value)
      }
    }

    const permDefDialog = reactive({
      visible: false,
      isEdit: false,
      loading: false,
      form: { code: '', name: '', module: '', type: 'action', description: '' }
    })

    // ========== 角色管理 ==========
    const roles = ref([])
    const rolesLoading = ref(false)
    const roleDialog = reactive({
      visible: false,
      isEdit: false,
      loading: false,
      form: { name: '', code: '', description: '', status: 1 }
    })
    const permDialog = reactive({
      visible: false,
      loading: false,
      submitting: false,
      roleId: null,
      roleName: '',
      checkedKeys: []
    })
    const permissionTree = ref([])

    // ========== 用户管理 ==========
    const users = ref([])
    const usersLoading = ref(false)
    const userTotal = ref(0)
    const userSearch = reactive({ keyword: '', page: 1, page_size: 20 })
    const userRoleDialog = reactive({
      visible: false,
      loading: false,
      userId: null,
      username: '',
      selected: []
    })
    const userPermDialog = reactive({
      visible: false,
      loading: false,
      userId: null,
      username: '',
      selected: []
    })

    // ========== 菜单管理 ==========
    const menus = ref([])
    const menuTableRef = ref(null)
    const menuDialog = reactive({
      visible: false,
      isEdit: false,
      loading: false,
      rowId: null,
      form: { parent_id: 0, label: '', path: '', icon: '', permission_id: null, sort_order: 0, status: 1 }
    })

    const rootMenus = computed(() => menus.value.filter((m) => m.parent_id === 0))

    const menuTree = computed(() => {
      const map = {}
      const tree = []
      menus.value.forEach((item) => {
        map[item.id] = { ...item, children: [] }
      })
      menus.value.forEach((item) => {
        if (item.parent_id === 0 || item.parent_id === null) {
          tree.push(map[item.id])
        } else if (map[item.parent_id]) {
          map[item.parent_id].children.push(map[item.id])
        }
      })
      return tree
    })

    // ========== 数据获取 ==========
    const fetchPermissionGroups = async () => {
      try {
        const res = await getPermissionsTree()
        if (res.data.status === 'success') {
          const data = res.data.data || {}
          // 给每个权限补上所属模块字段，方便编辑回显
          Object.entries(data).forEach(([module, perms]) => {
            perms.forEach((p) => { p.module = module })
          })
          permissionGroups.value = data
        }
      } catch (error) {
        console.error('获取权限列表失败:', error)
      }
    }

    const fetchRoles = async () => {
      rolesLoading.value = true
      try {
        const res = await getRoles()
        if (res.data.status === 'success') {
          roles.value = res.data.data || []
        }
      } catch (error) {
        console.error('获取角色失败:', error)
        proxy.$message.error({ message: '获取角色失败', offset: 60 })
      } finally {
        rolesLoading.value = false
      }
    }

    const fetchUsers = async () => {
      usersLoading.value = true
      try {
        const res = await getAdminUsers({
          keyword: userSearch.keyword,
          page: userSearch.page,
          page_size: userSearch.page_size
        })
        if (res.data.status === 'success') {
          users.value = res.data.data?.list || res.data.data || []
          userTotal.value = res.data.data?.total || 0
        }
      } catch (error) {
        console.error('获取用户失败:', error)
        proxy.$message.error({ message: '获取用户失败', offset: 60 })
      } finally {
        usersLoading.value = false
      }
    }

    const fetchMenus = async () => {
      try {
        const res = await getAdminMenus()
        if (res.data.status === 'success') {
          menus.value = res.data.data || []
        }
      } catch (error) {
        console.error('获取菜单失败:', error)
        proxy.$message.error({ message: '获取菜单失败', offset: 60 })
      }
    }

    // ========== 权限定义操作 ==========
    const openPermDefDialog = (row = null) => {
      permDefDialog.isEdit = !!row
      if (row) {
        permDefDialog.form = { ...row }
      } else {
        permDefDialog.form = { code: '', name: '', module: '', type: 'action', description: '' }
      }
      permDefDialog.visible = true
    }

    const submitPermission = async () => {
      if (!permDefDialog.form.code.trim() || !permDefDialog.form.name.trim()) {
        proxy.$message.warning({ message: '请填写权限码和权限名称', offset: 60 })
        return
      }
      permDefDialog.loading = true
      try {
        const data = {
          code: permDefDialog.form.code.trim(),
          name: permDefDialog.form.name.trim(),
          module: permDefDialog.form.module?.trim() || '',
          type: permDefDialog.form.type,
          description: permDefDialog.form.description?.trim() || ''
        }
        if (permDefDialog.isEdit) {
          await updatePermission(permDefDialog.form.id, data)
          proxy.$message.success({ message: '权限更新成功', offset: 60 })
        } else {
          await createPermission(data)
          proxy.$message.success({ message: '权限创建成功', offset: 60 })
        }
        permDefDialog.visible = false
        fetchPermissionGroups()
      } catch (error) {
        console.error('保存权限失败:', error)
        proxy.$message.error({ message: error.response?.data?.message || '保存失败', offset: 60 })
      } finally {
        permDefDialog.loading = false
      }
    }

    const handleDeletePermission = async (row) => {
      try {
        await proxy.$confirm(`确定删除权限「${row.name} (${row.code})」吗？`, '提示', { type: 'warning' })
        await deletePermission(row.id)
        proxy.$message.success({ message: '删除成功', offset: 60 })
        fetchPermissionGroups()
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除权限失败:', error)
          proxy.$message.error({ message: error.response?.data?.message || '删除失败', offset: 60 })
        }
      }
    }

    // ========== 角色管理操作 ==========
    const openRoleDialog = (row = null) => {
      roleDialog.isEdit = !!row
      if (row) {
        roleDialog.form = { ...row }
      } else {
        roleDialog.form = { name: '', code: '', description: '', status: 1 }
      }
      roleDialog.visible = true
    }

    const submitRole = async () => {
      if (!roleDialog.form.name.trim() || !roleDialog.form.code.trim()) {
        proxy.$message.warning({ message: '请填写角色名称和标识码', offset: 60 })
        return
      }
      roleDialog.loading = true
      try {
        const data = {
          name: roleDialog.form.name.trim(),
          code: roleDialog.form.code.trim(),
          description: roleDialog.form.description?.trim() || '',
          status: roleDialog.form.status
        }
        if (roleDialog.isEdit) {
          await updateRole(roleDialog.form.id, data)
          proxy.$message.success({ message: '角色更新成功', offset: 60 })
        } else {
          await createRole(data)
          proxy.$message.success({ message: '角色创建成功', offset: 60 })
        }
        roleDialog.visible = false
        fetchRoles()
      } catch (error) {
        console.error('保存角色失败:', error)
        proxy.$message.error({ message: error.response?.data?.message || '保存失败', offset: 60 })
      } finally {
        roleDialog.loading = false
      }
    }

    const handleDeleteRole = async (row) => {
      try {
        await proxy.$confirm(`确定删除角色「${row.name}」吗？`, '提示', { type: 'warning' })
        await deleteRole(row.id)
        proxy.$message.success({ message: '删除成功', offset: 60 })
        fetchRoles()
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除角色失败:', error)
          proxy.$message.error({ message: error.response?.data?.message || '删除失败', offset: 60 })
        }
      }
    }

    const openPermissionDialog = async (row) => {
      permDialog.roleId = row.id
      permDialog.roleName = row.name
      permDialog.loading = true
      permDialog.visible = true
      try {
        const [permRes, rolePermRes] = await Promise.all([
          getPermissionsTree(),
          getRolePermissions(row.id)
        ])
        if (permRes.data.status === 'success') {
          permissionTree.value = buildPermissionTree(permRes.data.data || [])
        }
        if (rolePermRes.data.status === 'success') {
          permDialog.checkedKeys = rolePermRes.data.data || []
        }
      } catch (error) {
        console.error('获取权限数据失败:', error)
      } finally {
        permDialog.loading = false
      }
    }

    const buildPermissionTree = (groups) => {
      return Object.entries(groups).map(([module, perms]) => ({
        label: module,
        children: perms.map((p) => ({ label: `${p.name} (${p.code})`, id: p.id }))
      }))
    }

    const submitRolePermissions = async () => {
      const checked = permTreeRef.value?.getCheckedKeys(true) || []
      permDialog.submitting = true
      try {
        await assignRolePermissions(permDialog.roleId, { permission_ids: checked })
        proxy.$message.success({ message: '权限分配成功', offset: 60 })
        permDialog.visible = false
        fetchRoles()
        window.dispatchEvent(new CustomEvent('refresh-menus'))
      } catch (error) {
        console.error('分配权限失败:', error)
        proxy.$message.error({ message: error.response?.data?.message || '分配失败', offset: 60 })
      } finally {
        permDialog.submitting = false
      }
    }

    // ========== 用户管理操作 ==========
    const openUserRoleDialog = (row) => {
      userRoleDialog.userId = row.id
      userRoleDialog.username = row.nickname || row.username
      userRoleDialog.selected = row.roles?.map((r) => r.id) || []
      userRoleDialog.visible = true
    }

    const submitUserRoles = async () => {
      userRoleDialog.loading = true
      try {
        await assignUserRoles(userRoleDialog.userId, { role_ids: userRoleDialog.selected })
        proxy.$message.success({ message: '角色分配成功', offset: 60 })
        userRoleDialog.visible = false
        fetchUsers()
        window.dispatchEvent(new CustomEvent('refresh-menus'))
      } catch (error) {
        console.error('分配角色失败:', error)
        proxy.$message.error({ message: error.response?.data?.message || '分配失败', offset: 60 })
      } finally {
        userRoleDialog.loading = false
      }
    }

    const toggleUserStatus = async (row) => {
      const newStatus = row.status ? 0 : 1
      try {
        await updateUserStatus(row.id, { status: newStatus })
        proxy.$message.success({ message: newStatus ? '账号已启用' : '账号已禁用', offset: 60 })
        fetchUsers()
        window.dispatchEvent(new CustomEvent('refresh-menus'))
      } catch (error) {
        console.error('修改用户状态失败:', error)
        proxy.$message.error({ message: error.response?.data?.message || '操作失败', offset: 60 })
      }
    }

    const openUserPermDialog = async (row) => {
      userPermDialog.userId = row.id
      userPermDialog.username = row.nickname || row.username
      userPermDialog.visible = true
      try {
        const res = await getUserDirectPermissions(row.id)
        if (res.data.status === 'success') {
          userPermDialog.selected = res.data.data || []
        }
      } catch (error) {
        console.error('获取用户直接权限失败:', error)
        userPermDialog.selected = []
      }
    }

    const submitUserDirectPerms = async () => {
      userPermDialog.loading = true
      try {
        await setUserDirectPermissions(userPermDialog.userId, { permission_ids: userPermDialog.selected })
        proxy.$message.success({ message: '直接权限设置成功', offset: 60 })
        userPermDialog.visible = false
        window.dispatchEvent(new CustomEvent('refresh-menus'))
      } catch (error) {
        console.error('设置用户直接权限失败:', error)
        proxy.$message.error({ message: error.response?.data?.message || '设置失败', offset: 60 })
      } finally {
        userPermDialog.loading = false
      }
    }

    // ========== 菜单管理操作 ==========
    const openMenuDialog = (row = null) => {
      menuDialog.isEdit = !!row
      menuDialog.rowId = row ? row.id : null
      if (row) {
        menuDialog.form = {
          parent_id: row.parent_id ?? 0,
          label: row.label,
          path: row.path,
          icon: row.icon,
          permission_id: row.permission_id,
          sort_order: row.sort_order,
          status: row.status ?? 1
        }
      } else {
        menuDialog.form = { parent_id: 0, label: '', path: '', icon: '', permission_id: null, sort_order: 0, status: 1 }
      }
      menuDialog.visible = true
    }

    const submitMenu = async () => {
      if (!menuDialog.form.label.trim()) {
        proxy.$message.warning({ message: '请填写菜单名称', offset: 60 })
        return
      }
      menuDialog.loading = true
      try {
        const data = {
          parent_id: menuDialog.form.parent_id ?? 0,
          label: menuDialog.form.label.trim(),
          path: menuDialog.form.path?.trim() || '',
          icon: menuDialog.form.icon?.trim() || '',
          permission_id: menuDialog.form.permission_id,
          sort_order: menuDialog.form.sort_order ?? 0,
          status: menuDialog.form.status
        }
        if (menuDialog.isEdit) {
          await updateMenu(menuDialog.rowId, data)
          proxy.$message.success({ message: '菜单更新成功', offset: 60 })
        } else {
          await createMenu(data)
          proxy.$message.success({ message: '菜单创建成功', offset: 60 })
        }
        menuDialog.visible = false
        fetchMenus()
        window.dispatchEvent(new CustomEvent('refresh-menus'))
      } catch (error) {
        console.error('保存菜单失败:', error)
        proxy.$message.error({ message: error.response?.data?.message || '保存失败', offset: 60 })
      } finally {
        menuDialog.loading = false
      }
    }

    const handleDeleteMenu = async (row) => {
      const hasChildren = menus.value.some((m) => m.parent_id === row.id)
      const tip = hasChildren ? `确定删除菜单「${row.label}」吗？其子菜单也会被一并删除。` : `确定删除菜单「${row.label}」吗？`
      try {
        await proxy.$confirm(tip, '提示', { type: 'warning' })
        await deleteMenu(row.id)
        proxy.$message.success({ message: '删除成功', offset: 60 })
        fetchMenus()
        window.dispatchEvent(new CustomEvent('refresh-menus'))
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除菜单失败:', error)
          proxy.$message.error({ message: error.response?.data?.message || '删除失败', offset: 60 })
        }
      }
    }

    const menusExpanded = ref(false)

    const toggleExpandAllMenus = () => {
      const table = menuTableRef.value
      if (!table) return
      menusExpanded.value = !menusExpanded.value
      menuTree.value.forEach((row) => {
        if (row.children && row.children.length > 0) {
          table.toggleRowExpansion(row, menusExpanded.value)
        }
      })
    }

    onMounted(() => {
      fetchPermissionGroups()
      fetchRoles()
      fetchUsers()
      fetchMenus()
    })

    return {
      activeTab,
      permTreeRef,
      permissionGroups,
      permDefDialog,
      roles,
      rolesLoading,
      roleDialog,
      permDialog,
      permissionTree,
      users,
      usersLoading,
      userTotal,
      userSearch,
      userRoleDialog,
      userPermDialog,
      menus,
      menuTableRef,
      menuTree,
      rootMenus,
      menuDialog,
      menusExpanded,
      toggleExpandAllMenus,
      expandedModules,
      isAllExpanded,
      toggleExpandAll,
      fetchUsers,
      openPermDefDialog,
      submitPermission,
      handleDeletePermission,
      openRoleDialog,
      submitRole,
      handleDeleteRole,
      openPermissionDialog,
      submitRolePermissions,
      openUserRoleDialog,
      submitUserRoles,
      toggleUserStatus,
      openUserPermDialog,
      submitUserDirectPerms,
      openMenuDialog,
      submitMenu,
      handleDeleteMenu
    }
  }
}
</script>

<style scoped>
.permissions-page {
  min-height: calc(100vh - 60px);
  background: #f5f7fa;
  padding: 24px;
}

.permissions-container {
  max-width: 1100px;
  margin: 0 auto;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #333;
  margin: 0 0 20px 0;
}

.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.perm-group {
  margin-bottom: 20px;
}

.perm-group-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid #667eea;
}

.perm-current-role,
.user-role-current {
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 14px;
}
</style>
