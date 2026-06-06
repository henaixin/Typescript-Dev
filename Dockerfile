# 通用二进制运行基础镜像
# 基于 Alpine Linux，体积小巧
# 不包含任何具体文件，需通过 docker-compose / docker run 挂载

FROM alpine:3.20

# 安装基本 CA 证书（程序可能需要 HTTPS 请求）和时区数据
RUN apk add --no-cache ca-certificates tzdata && \
    rm -rf /var/cache/apk/*

# 创建工作目录
WORKDIR /app

# 创建非 root 用户（安全最佳实践）
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# 切换到非 root 用户
USER appuser
