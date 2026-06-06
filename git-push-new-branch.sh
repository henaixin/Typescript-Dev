#!/usr/bin/env bash
# ============================================================
# Git 创建分支、提交并推送到远程仓库的脚本
# 用法:
#   ./git-push-new-branch.sh [分支名]
#
# 参数:
#   分支名  - 可选，要创建并推送的新分支名称
#             不传则自动使用当前时间戳生成: refresh-$(date +%Y%m%d-%H%M%S)
#
# 示例:
#   ./git-push-new-branch.sh refresh-camara
#   ./git-push-new-branch.sh
# ============================================================

set -euo pipefail

# --- 参数映射：分支名称 ---
# 如果传了第一个参数，就用它作为分支名；否则自动生成
BRANCH_NAME="${1:-refresh-$(date +%Y%m%d-%H%M%S)}"

echo "============================================"
echo "  Git 分支创建与推送脚本"
echo "============================================"
echo "目标分支名: ${BRANCH_NAME}"
echo ""

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "[错误] 当前目录不是 Git 仓库"
    exit 1
fi

# 检查是否有未提交的更改
if git diff-index --quiet HEAD -- && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo "[提示] 工作区干净，没有需要提交的更改"
    read -p "是否继续创建空分支并推送? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "已取消操作"
        exit 0
    fi
    CREATE_EMPTY=true
else
    CREATE_EMPTY=false
fi

# 检查远程仓库
echo "[1/6] 检查远程仓库..."
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    echo "[错误] 未配置远程仓库 origin"
    exit 1
fi
echo "      远程仓库: ${REMOTE_URL}"

# 检查分支是否已存在
echo "[2/6] 检查分支是否存在..."
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    echo "[错误] 本地分支 '${BRANCH_NAME}' 已存在"
    exit 1
fi
if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH_NAME}"; then
    echo "[错误] 远程分支 'origin/${BRANCH_NAME}' 已存在"
    exit 1
fi
echo "      分支名可用"

# 创建并切换分支
echo "[3/6] 创建并切换到新分支: ${BRANCH_NAME}"
git checkout -b "${BRANCH_NAME}"

# 自动更新 workflow 文件中的分支触发列表
echo "[4/6] 更新 GitHub Actions workflow 分支触发列表..."
WORKFLOW_FILE=".github/workflows/build.yml"
if [ -f "${WORKFLOW_FILE}" ]; then
    # 检查分支是否已在触发列表中
    if grep -E "branches: \[.*${BRANCH_NAME}.*\]" "${WORKFLOW_FILE}" > /dev/null 2>&1; then
        echo "      分支 '${BRANCH_NAME}' 已在 workflow 触发列表中，无需修改"
    else
        # 在 branches: [ xxx ] 列表末尾追加新分支名（兼容已有多个分支的情况）
        # 注意: sed ERE 中 ] 不需要转义
        sed -i -E "s/branches: \[ ([^]]*) \]/branches: [ \1, ${BRANCH_NAME} ]/g" "${WORKFLOW_FILE}"
        echo "      已追加分支 '${BRANCH_NAME}' 到 ${WORKFLOW_FILE}"
    fi
else
    echo "      未找到 ${WORKFLOW_FILE}，跳过"
fi

# 如果有更改则提交
if [ "$CREATE_EMPTY" = false ]; then
    echo "[5/6] 添加并提交所有更改..."
    git add -A
    COMMIT_MSG="feat: refresh camera points (branch: ${BRANCH_NAME})"
    git commit -m "${COMMIT_MSG}"
    echo "      Commit 完成: ${COMMIT_MSG}"
else
    echo "[5/6] 跳过提交（工作区干净）"
fi

# 推送到远程
echo "[6/6] 推送到远程仓库..."
git push -u origin "${BRANCH_NAME}"

echo ""
echo "============================================"
echo "  ✅ 推送成功！"
echo "  分支: ${BRANCH_NAME}"
echo "  远程: ${REMOTE_URL}"
echo "============================================"
echo ""
echo "创建 Pull Request 链接:"
echo "  https://github.com/henaixin/Typescript-Dev/pull/new/${BRANCH_NAME}"
