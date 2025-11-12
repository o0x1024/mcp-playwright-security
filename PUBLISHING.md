# 发布到 NPM 指南

本文档说明如何将 mcp-playwright-security 发布到 npm，使用户可以通过 `npx` 安装运行。

## 前置准备

### 1. 注册 NPM 账户
如果还没有 npm 账户，请访问 [https://www.npmjs.com/signup](https://www.npmjs.com/signup) 注册。

### 2. 登录 NPM
在本地终端登录到 npm：

```bash
npm login
```

输入你的用户名、密码和邮箱（如果启用了 2FA，还需要输入一次性密码）。

### 3. 验证登录状态

```bash
npm whoami
```

## 发布前检查清单

### 1. 检查 package.json 配置

确保 `package.json` 中的以下字段配置正确：

```json
{
  "name": "@executeautomation/playwright-mcp-server-security",
  "version": "1.0.6",  // 每次发布前需要更新版本号
  "description": "Model Context Protocol servers for Playwright",
  "license": "MIT",
  "author": "ExecuteAutomation, Ltd (https://executeautomation.com)",
  "homepage": "https://executeautomation.github.io/mcp-playwright/",
  "repository": {
    "type": "git",
    "url": "https://github.com/executeautomation/mcp-playwright.git"
  },
  "bin": {
    "playwright-mcp-server-security": "dist/index.js"
  },
  "files": [
    "dist"
  ],
  "keywords": [
    "playwright",
    "automation",
    "AI",
    "Claude MCP"
  ]
}
```

**重要配置说明：**
- `name`: scoped package 名称（以 `@executeautomation/` 开头）
- `version`: 遵循语义化版本（semantic versioning）
- `bin`: 定义命令行工具入口，用户可以通过 `npx playwright-mcp-server-security` 运行
- `files`: 指定要发布的文件/目录（只发布 `dist` 目录）

### 2. 更新版本号

根据变更类型更新版本号：

```bash
# 补丁版本（bug 修复）：1.0.6 -> 1.0.7
npm version patch

# 次要版本（新功能，向后兼容）：1.0.6 -> 1.1.0
npm version minor

# 主要版本（破坏性变更）：1.0.6 -> 2.0.0
npm version major
```

或者手动编辑 `package.json` 中的 `version` 字段。

### 3. 运行测试

确保所有测试通过：

```bash
npm test
```

### 4. 构建项目

```bash
npm run build
```

确认 `dist` 目录已生成且包含所有必要文件。

### 5. 验证打包内容

查看将要发布的文件列表：

```bash
npm pack --dry-run
```

这会显示哪些文件会被包含在发布包中。

## 发布流程

### 方式一：直接发布

```bash
npm publish --access public
```

**注意：** 因为这是 scoped package（`@executeautomation/...`），需要添加 `--access public` 参数，否则默认为私有包（需要付费账户）。

### 方式二：使用 npm scripts（推荐）

在 `package.json` 中添加发布脚本：

```json
{
  "scripts": {
    "build": "tsc && shx chmod +x dist/*.js",
    "prepare": "npm run build",
    "prepublishOnly": "npm test && npm run build",
    "publish:npm": "npm publish --access public"
  }
}
```

然后运行：

```bash
npm run publish:npm
```

### 方式三：发布前测试（推荐）

1. 创建本地测试包：

```bash
npm pack
```

这会生成一个 `.tgz` 文件，例如 `executeautomation-playwright-mcp-server-security-1.0.6.tgz`

2. 在其他目录测试安装：

```bash
cd /tmp
npm install /path/to/executeautomation-playwright-mcp-server-security-1.0.6.tgz
npx playwright-mcp-server-security
```

3. 确认无误后再发布：

```bash
npm publish --access public
```

## 发布后验证

### 1. 检查 NPM 网站

访问你的包页面：
```
https://www.npmjs.com/package/@executeautomation/playwright-mcp-server-security
```

### 2. 测试安装

```bash
# 使用 npx 直接运行（无需安装）
npx -y @executeautomation/playwright-mcp-server-security

# 或全局安装
npm install -g @executeautomation/playwright-mcp-server-security
playwright-mcp-server-security
```

### 3. 测试在 Claude Desktop 中使用

更新 Claude Desktop 配置：

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

## 常见问题

### 1. 发布失败：需要身份验证

```bash
npm login
```

### 2. 版本号冲突

错误信息：`You cannot publish over the previously published versions`

解决方案：更新版本号后再发布

```bash
npm version patch
npm publish --access public
```

### 3. Scoped package 需要付费账户

错误信息：`You must sign up for private packages`

解决方案：添加 `--access public` 参数

```bash
npm publish --access public
```

### 4. 文件未包含在发布包中

检查 `package.json` 中的 `files` 字段，确保包含必要的目录。

也可以创建 `.npmignore` 文件来排除不需要的文件：

```
# .npmignore
src/
*.test.ts
*.test.js
jest.config.cjs
tsconfig.test.json
coverage/
node_modules/
.git/
.github/
docs/
image/
```

### 5. 二进制文件没有执行权限

确保在构建脚本中添加执行权限：

```json
{
  "scripts": {
    "build": "tsc && shx chmod +x dist/*.js"
  }
}
```

或者在 `dist/index.js` 文件顶部添加 shebang：

```javascript
#!/usr/bin/env node
```

## 版本管理最佳实践

### 语义化版本

- **主版本号（Major）**：破坏性变更
- **次版本号（Minor）**：新功能，向后兼容
- **修订号（Patch）**：Bug 修复

### Git 标签

每次发布后创建 Git 标签：

```bash
git tag v1.0.6
git push origin v1.0.6
```

### 更新日志

维护 `CHANGELOG.md` 文件记录每个版本的变更：

```markdown
## [1.0.6] - 2025-01-12

### Added
- 添加 proxy 参数支持，允许指定代理服务器

### Changed
- 优化浏览器启动逻辑

### Fixed
- 修复代理配置不生效的问题
```

## 自动化发布（CI/CD）

### 使用 GitHub Actions

创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to NPM

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

需要在 GitHub 仓库设置中添加 `NPM_TOKEN` secret。

## 撤销发布

如果发布了错误的版本，可以撤销（**24小时内**）：

```bash
npm unpublish @executeautomation/playwright-mcp-server-security@1.0.6
```

**注意：** 
- 只能撤销 24 小时内发布的版本
- 撤销后，该版本号不能再次使用
- 建议使用 `npm deprecate` 代替撤销

```bash
npm deprecate @executeautomation/playwright-mcp-server-security@1.0.6 "This version has bugs, please use 1.0.7"
```

## 参考资源

- [NPM 官方文档](https://docs.npmjs.com/)
- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [package.json 配置指南](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
