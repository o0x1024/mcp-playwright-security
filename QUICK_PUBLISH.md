# 快速发布指南 🚀

## 方式一：使用自动化脚本（推荐）

```bash
./publish.sh
```

这个脚本会自动执行以下步骤：
1. ✅ 检查 NPM 登录状态
2. ✅ 检查 Git 工作区状态
3. ✅ 运行测试
4. ✅ 构建项目
5. ✅ 选择版本类型并更新
6. ✅ 预览发布文件
7. ✅ 发布到 NPM
8. ✅ 创建并推送 Git 标签

## 方式二：手动发布

### 1. 登录 NPM

```bash
npm login
```

### 2. 更新版本号

```bash
# 补丁版本（1.0.6 -> 1.0.7）
npm version patch

# 次要版本（1.0.6 -> 1.1.0）
npm version minor

# 主要版本（1.0.6 -> 2.0.0）
npm version major
```

### 3. 测试和构建

```bash
npm test
npm run build
```

### 4. 预览发布内容

```bash
npm run pack:check
```

### 5. 发布到 NPM

```bash
npm run publish:npm
```

或直接运行：

```bash
npm publish --access public
```

## 验证发布

### 1. 检查 NPM 页面

访问: https://www.npmjs.com/package/@executeautomation/playwright-mcp-server-security

### 2. 测试安装

```bash
# 使用 npx 运行（推荐）
npx -y @executeautomation/playwright-mcp-server-security

# 全局安装
npm install -g @executeautomation/playwright-mcp-server-security
```

### 3. 在 Claude Desktop 中测试

配置文件（`~/Library/Application Support/Claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server-security"]
    }
  }
}
```

## 常用命令

```bash
# 查看当前登录用户
npm whoami

# 查看包信息
npm view @executeautomation/playwright-mcp-server-security

# 查看所有已发布版本
npm view @executeautomation/playwright-mcp-server-security versions

# 查看最新版本
npm view @executeautomation/playwright-mcp-server-security version

# 标记版本为废弃
npm deprecate @executeautomation/playwright-mcp-server-security@1.0.6 "Use 1.0.7 instead"
```

## 版本号规范

遵循语义化版本 (Semantic Versioning)：

- **MAJOR（主版本）**: 不兼容的 API 变更
- **MINOR（次版本）**: 向后兼容的功能新增
- **PATCH（补丁版本）**: 向后兼容的问题修复

示例：`1.0.6`
- 1 = 主版本
- 0 = 次版本
- 6 = 补丁版本

## 发布后检查清单

- [ ] NPM 页面显示新版本
- [ ] 使用 `npx` 可以运行最新版本
- [ ] README.md 中的安装说明正确
- [ ] 在 Claude Desktop 中测试正常
- [ ] Git 标签已创建并推送
- [ ] GitHub Release 已创建（可选）
- [ ] CHANGELOG.md 已更新（建议）

## 故障排除

### 发布失败：未登录

```bash
npm login
```

### 发布失败：版本已存在

```bash
npm version patch  # 更新版本号
npm publish --access public
```

### 发布失败：需要公开访问权限

确保添加了 `--access public` 参数：

```bash
npm publish --access public
```

## 需要帮助？

查看详细文档：[PUBLISHING.md](./PUBLISHING.md)
