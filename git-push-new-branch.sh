#!/usr/bin/env bash
# ============================================================
# Git 分支创建/追加提交并推送到远程仓库的脚本
#
# 用法:
#   ./git-push-new-branch.sh [选项] [分支名]
#
# 模式一：创建新分支（不传分支名或传一个不存在的分支名）
#   ./git-push-new-branch.sh              # 自动生成分支名: refresh-YYYYMMDD-HHMMSS
#   ./git-push-new-branch.sh my-feature   # 创建名为 my-feature 的新分支
#
# 模式二：在已有分支上追加提交（传一个已存在的分支名）
#   ./git-push-new-branch.sh refresh-20250606-185532
#
# 选项:
#   -m, --message <msg>   自定义 commit message（默认自动生成）
#   -f, --force           强制推送 (git push --force-with-lease)
#   --no-pull             切换到已有分支时不自动 pull 最新代码
#   -h, --help            显示帮助信息
#
# 示例:
#   ./git-push-new-branch.sh -m "fix: camera offset" refresh-camara
#   ./git-push-new-branch.sh --force my-branch
# ============================================================

set -euo pipefail

# --- 默认值 ---
BRANCH_NAME=""
CUSTOM_MESSAGE=""
FORCE_PUSH=false
NO_PULL=false

# --- 参数解析 ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        -m|--message)
            CUSTOM_MESSAGE="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_PUSH=true
            shift
            ;;
        --no-pull)
            NO_PULL=true
            shift
            ;;
        -h|--help)
            sed -n '2,21p' "$0" | sed 's/^# //; s/^#//'
            exit 0
            ;;
        -*)
            echo "[错误] 未知选项: $1"
            echo "使用 -h 或 --help 查看用法"
            exit 1
            ;;
        *)
            if [ -z "$BRANCH_NAME" ]; then
                BRANCH_NAME="$1"
            else
                echo "[错误] 只能指定一个分支名，多余的: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# 如果没传分支名，自动生成
BRANCH_NAME="${BRANCH_NAME:-refresh-$(date +%Y%m%d-%H%M%S)}"

# 自动生成 commit message（如果用户没传）
if [ -z "$CUSTOM_MESSAGE" ]; then
    COMMIT_MSG="feat: refresh camera points (branch: ${BRANCH_NAME})"
else
    COMMIT_MSG="$CUSTOM_MESSAGE"
fi

echo "============================================"
echo "  Git 分支提交与推送脚本"
echo "============================================"
echo "目标分支名: ${BRANCH_NAME}"
echo "Commit 消息: ${COMMIT_MSG}"
echo ""

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "[错误] 当前目录不是 Git 仓库"
    exit 1
fi

# 获取当前分支（用于后面判断是否在目标分支上）
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# 检查是否有未提交的更改
if git diff-index --quiet HEAD -- && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo "[提示] 工作区干净，没有需要提交的更改"
    read -p "是否继续? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "已取消操作"
        exit 0
    fi
    HAS_CHANGES=false
else
    HAS_CHANGES=true
fi

# 检查远程仓库
echo "[1/6] 检查远程仓库..."
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    echo "[错误] 未配置远程仓库 origin"
    exit 1
fi
echo "      远程仓库: ${REMOTE_URL}"

# --- 分支存在性检查与处理 ---
echo "[2/6] 检查分支状态..."

LOCAL_EXISTS=false
REMOTE_EXISTS=false

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}" 2>/dev/null; then
    LOCAL_EXISTS=true
fi
if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH_NAME}" 2>/dev/null; then
    REMOTE_EXISTS=true
fi

if [ "$LOCAL_EXISTS" = true ] && [ "$REMOTE_EXISTS" = true ]; then
    echo "      本地和远程分支 '${BRANCH_NAME}' 均已存在"
    BRANCH_MODE="existing"
elif [ "$LOCAL_EXISTS" = true ] && [ "$REMOTE_EXISTS" = false ]; then
    echo "      本地分支 '${BRANCH_NAME}' 存在，远程不存在"
    BRANCH_MODE="existing-local-only"
elif [ "$LOCAL_EXISTS" = false ] && [ "$REMOTE_EXISTS" = true ]; then
    echo "      远程分支 'origin/${BRANCH_NAME}' 存在，本地不存在"
    BRANCH_MODE="checkout-remote"
else
    echo "      分支 '${BRANCH_NAME}' 不存在，将创建新分支"
    BRANCH_MODE="new"
fi

# --- 安全检查：有未提交更改时，不允许切换到已存在的其他分支 ---
if [ "$HAS_CHANGES" = true ] && [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
    if [ "$BRANCH_MODE" = "existing" ] || [ "$BRANCH_MODE" = "existing-local-only" ] || [ "$BRANCH_MODE" = "checkout-remote" ]; then
        echo ""
        echo "[错误] 工作区有未提交的更改，不允许跨分支提交到 '${BRANCH_NAME}'"
        echo ""
        echo "  当前分支: ${CURRENT_BRANCH}"
        echo "  目标分支: ${BRANCH_NAME}"
        echo ""
        echo "你只能将更改提交到当前分支。解决方案:"
        echo "  ① 提交到当前分支:     ./git-push-new-branch.sh ${CURRENT_BRANCH}"
        echo "  ② 先 stash 再切换:    git stash && ./git-push-new-branch.sh ${BRANCH_NAME}"
        echo "  ③ 手动 commit 后切换: git add -A && git commit -m '...' && git checkout ${BRANCH_NAME}"
        exit 1
    fi
fi

# --- 根据分支模式执行对应操作 ---
case "$BRANCH_MODE" in
    existing|existing-local-only)
        # 切换到已有分支
        if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
            echo "[3/6] 切换到已有分支: ${BRANCH_NAME}"
            git checkout "${BRANCH_NAME}"
        else
            echo "[3/6] 已在分支 '${BRANCH_NAME}' 上，无需切换"
        fi

        # 可选：pull 最新代码
        if [ "$REMOTE_EXISTS" = true ] && [ "$NO_PULL" = false ]; then
            echo "      拉取远程最新代码..."
            git pull origin "${BRANCH_NAME}" --rebase || {
                echo "[警告] pull 失败，可能存在冲突，请手动解决"
                exit 1
            }
        fi
        ;;

    checkout-remote)
        echo "[3/6] 从远程检出分支: ${BRANCH_NAME}"
        git checkout -b "${BRANCH_NAME}" "origin/${BRANCH_NAME}"
        ;;

    new)
        echo "[3/6] 创建并切换到新分支: ${BRANCH_NAME}"
        git checkout -b "${BRANCH_NAME}"
        ;;
esac

# 自动更新 workflow 文件中的分支触发列表
echo "[4/6] 更新 GitHub Actions workflow 分支触发列表..."
WORKFLOW_FILE=".github/workflows/build.yml"
if [ -f "${WORKFLOW_FILE}" ]; then
    if grep -E "branches: \[.*${BRANCH_NAME}.*\]" "${WORKFLOW_FILE}" > /dev/null 2>&1; then
        echo "      分支 '${BRANCH_NAME}' 已在 workflow 触发列表中"
    else
        sed -i -E "s/branches: \[ ([^]]*) \]/branches: [ \1, ${BRANCH_NAME} ]/g" "${WORKFLOW_FILE}"
        echo "      已追加分支 '${BRANCH_NAME}' 到 ${WORKFLOW_FILE}"
    fi
else
    echo "      未找到 ${WORKFLOW_FILE}，跳过"
fi

# 提交更改
if [ "$HAS_CHANGES" = true ]; then
    echo "[5/6] 添加并提交所有更改..."
    git add -A
    git commit -m "${COMMIT_MSG}"
    echo "      Commit 完成: ${COMMIT_MSG}"
else
    echo "[5/6] 工作区干净，无更改需要提交"
fi

# 推送
echo "[6/6] 推送到远程仓库..."
PUSH_ARGS=""
if [ "$BRANCH_MODE" = "new" ] || [ "$BRANCH_MODE" = "existing-local-only" ]; then
    PUSH_ARGS="-u origin ${BRANCH_NAME}"
elif [ "$FORCE_PUSH" = true ]; then
    PUSH_ARGS="--force-with-lease origin ${BRANCH_NAME}"
else
    PUSH_ARGS="origin ${BRANCH_NAME}"
fi

if [ "$FORCE_PUSH" = true ] && [ "$BRANCH_MODE" != "new" ] && [ "$BRANCH_MODE" != "existing-local-only" ]; then
    git push --force-with-lease origin "${BRANCH_NAME}"
else
    # shellcheck disable=SC2086
    git push ${PUSH_ARGS}
fi

echo ""
echo "============================================"
echo "  ✅ 推送成功！"
echo "  分支: ${BRANCH_NAME}"
echo "  远程: ${REMOTE_URL}"
echo "============================================"
echo ""

# 提取仓库 owner/name 构造 PR 链接
REPO_PATH=$(echo "$REMOTE_URL" | sed -E 's/.*github\.com[:/]([^/]+)\/([^/]+)(\.git)?$/\1\/\2/')
if [ -n "$REPO_PATH" ] && [ "$REPO_PATH" != "$REMOTE_URL" ]; then
    echo "创建 Pull Request 链接:"
    echo "  https://github.com/${REPO_PATH}/pull/new/${BRANCH_NAME}"
else
    echo "PR 链接无法自动生成（非 GitHub 仓库或 URL 格式不支持）"
fi
