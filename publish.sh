#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  NPM 发布流程${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 检查是否登录 NPM
echo -e "${YELLOW}1. 检查 NPM 登录状态...${NC}"
if ! npm whoami &> /dev/null; then
    echo -e "${RED}❌ 未登录 NPM，请先运行: npm login${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 已登录为: $(npm whoami)${NC}"
echo ""

# 2. 检查 Git 状态
echo -e "${YELLOW}2. 检查 Git 状态...${NC}"
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}⚠️  警告: 有未提交的更改${NC}"
    git status -s
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Git 工作区干净${NC}"
fi
echo ""

# 3. 运行测试
echo -e "${YELLOW}3. 运行测试...${NC}"
if ! npm test; then
    echo -e "${RED}❌ 测试失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 测试通过${NC}"
echo ""

# 4. 构建项目
echo -e "${YELLOW}4. 构建项目...${NC}"
if ! npm run build; then
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 构建成功${NC}"
echo ""

# 5. 显示当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}5. 当前版本: ${GREEN}${CURRENT_VERSION}${NC}"
echo ""

# 6. 选择版本类型
echo -e "${YELLOW}6. 选择版本更新类型:${NC}"
echo "  1) patch (补丁版本，bug 修复)"
echo "  2) minor (次要版本，新功能)"
echo "  3) major (主要版本，破坏性变更)"
echo "  4) 手动输入版本号"
echo "  5) 不更新版本（使用当前版本）"
read -p "请选择 (1-5): " version_choice

case $version_choice in
    1)
        npm version patch
        ;;
    2)
        npm version minor
        ;;
    3)
        npm version major
        ;;
    4)
        read -p "请输入新版本号: " new_version
        npm version "$new_version"
        ;;
    5)
        echo -e "${YELLOW}保持当前版本: ${CURRENT_VERSION}${NC}"
        ;;
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac

NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}新版本: ${NEW_VERSION}${NC}"
echo ""

# 7. 预览将要发布的文件
echo -e "${YELLOW}7. 预览将要发布的文件...${NC}"
npm pack --dry-run
echo ""

# 8. 确认发布
echo -e "${YELLOW}8. 准备发布到 NPM...${NC}"
echo -e "   包名: ${GREEN}@gelenlen/playwright-mcp-server-security${NC}"
echo -e "   版本: ${GREEN}${NEW_VERSION}${NC}"
read -p "确认发布? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}已取消发布${NC}"
    exit 1
fi

# 9. 发布到 NPM
echo -e "${YELLOW}9. 发布到 NPM...${NC}"
if npm publish --access public; then
    echo -e "${GREEN}✓ 发布成功！${NC}"
else
    echo -e "${RED}❌ 发布失败${NC}"
    exit 1
fi
echo ""

# 10. 创建 Git 标签
echo -e "${YELLOW}10. 创建 Git 标签...${NC}"
read -p "是否创建 Git 标签并推送? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git tag "v${NEW_VERSION}"
    git push origin "v${NEW_VERSION}"
    git push
    echo -e "${GREEN}✓ 标签已创建并推送${NC}"
fi
echo ""

# 11. 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  发布完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "包地址: ${GREEN}https://www.npmjs.com/package/@gelenlen/playwright-mcp-server-security${NC}"
echo -e "安装命令: ${GREEN}npx -y @gelenlen/playwright-mcp-server-security${NC}"
echo ""
echo -e "${YELLOW}建议操作:${NC}"
echo "  1. 访问 NPM 页面确认发布成功"
echo "  2. 测试安装: npx -y @gelenlen/playwright-mcp-server-security"
echo "  3. 更新 CHANGELOG.md"
echo "  4. 在 GitHub 创建 Release"

echo "  \"mcpServers\": {"
echo "    \"mcpServers\": {"
echo "      \"playwright\": {"
echo "        \"command\": \"npx\","
echo "        \"args\": [\"-y\", \"@gelenlen/playwright-mcp-server-security\"]"
echo "      }"
echo "    }"
echo "  }"
