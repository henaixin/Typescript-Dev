# syntax=docker/dockerfile:1
# ============================================================
# 通用 Node.js 二进制应用基础镜像
# 支持 Alpine / Debian-Slim / Ubuntu 等多种基础镜像
# ============================================================

ARG BASE_IMAGE=debian:bookworm-slim
ARG APP_UID=1000
ARG APP_GID=1000
ARG APP_USER=appuser
ARG APP_GROUP=appgroup

FROM ${BASE_IMAGE}

# OCI 镜像元数据
LABEL org.opencontainers.image.title="typescript-demo" \
      org.opencontainers.image.description="Generic base image for pkg-packaged Node.js binaries" \
      org.opencontainers.image.source="https://github.com/OWNER/REPO"

# --------------------------------------------------
# 安装运行时依赖（自动适配 Alpine / Debian 系）
# --------------------------------------------------
RUN set -eux; \
    if command -v apk >/dev/null 2>&1; then \
        # Alpine: 安装 CA 证书、时区、glibc 兼容层，以及 pkg 运行时依赖
        # pkg 打包的 Node 二进制默认基于 glibc，在 musl 环境需 libc6-compat / gcompat
        apk add --no-cache ca-certificates tzdata libc6-compat gcompat libstdc++ libgcc; \
        rm -rf /var/cache/apk/*; \
    elif command -v apt-get >/dev/null 2>&1; then \
        # Debian / Ubuntu
        apt-get update; \
        apt-get install -y --no-install-recommends ca-certificates tzdata libstdc++6 libgcc1; \
        rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /app

# --------------------------------------------------
# 创建非 root 用户（自动适配 Alpine / Debian 语法）
# --------------------------------------------------
ARG APP_UID
ARG APP_GID
ARG APP_USER
ARG APP_GROUP

RUN set -eux; \
    if command -v addgroup >/dev/null 2>&1 && command -v adduser >/dev/null 2>&1; then \
        # Alpine 风格
        addgroup -g "${APP_GID}" "${APP_GROUP}" 2>/dev/null || true; \
        adduser -u "${APP_UID}" -G "${APP_GROUP}" -s /bin/sh -D "${APP_USER}" 2>/dev/null || true; \
    else \
        # Debian / Ubuntu 风格
        groupadd -g "${APP_GID}" "${APP_GROUP}" 2>/dev/null || true; \
        useradd -u "${APP_UID}" -g "${APP_GID}" -s /bin/sh -m "${APP_USER}" 2>/dev/null || true; \
    fi

# 创建工作目录并设置权限
RUN mkdir -p /app && chown -R "${APP_UID}:${APP_GID}" /app

USER ${APP_USER}


# 设置工作目录
WORKDIR /app
