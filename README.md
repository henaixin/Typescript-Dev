# TypeScript 项目开发示例

这是一个完整的 TypeScript 项目示例，支持多平台打包（Windows、macOS、Linux），并可通过 Docker Compose 一键部署。

## 环境要求

- Node.js (推荐使用 nvm 管理)
- npm 或 yarn
- Docker 与 Docker Compose（容器化部署时）

## 快速开始

### 1. 安装 Node.js (使用 nvm)

如果你还没有安装 nvm，请先安装 nvm：

```bash
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# 重新加载配置
source ~/.bashrc  # 或者 source ~/.zshrc
```

**Windows 用户**：

1. 访问 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) 下载最新版本
2. 运行安装程序（推荐使用 `nvm-setup.exe`）
3. 安装完成后，重新打开命令提示符或 PowerShell

安装 Node.js 最新 LTS 版本：

```bash
# 安装最新 LTS 版本
nvm install --lts

# 使用该版本
nvm use --lts

# 验证安装
node --version
npm --version
```

### 2. 克隆或初始化项目

```bash
cd your-project-directory
```

### 3. 安装依赖

```bash
npm install
```

## 项目结构

```
typescript_stady/
├── src/                    # TypeScript 源代码
│   └── index.ts            # 主入口文件
├── dist/                   # 编译后的 JavaScript 代码
├── build/                  # 本地打包后的可执行文件
├── bin/                    # 部署时放置可执行文件的目录（Docker 挂载用）
├── env/                    # 预构建的 Docker 镜像 tar 包
├── Dockerfile              # Docker 镜像构建文件
├── docker-compose.yaml     # Docker Compose 部署配置
├── .github/workflows/      # GitHub Actions 工作流
│   └── build.yml           # 多平台自动构建与 Release 打包
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── README.md               # 项目文档
└── TypeScript-运维.md      # 运维与扩展指南
```

## 开发命令

### 编译 TypeScript

```bash
npm run build
```

### 开发模式（编译并运行）

```bash
npm run dev
```

### 运行程序

```bash
npm run start
```

## 多平台打包

本项目使用 `pkg` 工具将 Node.js 应用打包为原生可执行文件。

### ⚠️ 重要说明

**本地打包时，pkg 工具需要在目标操作系统上进行构建**：
- 在 Windows 环境下只能构建 Windows 版本
- 在 macOS 环境下只能构建 macOS 版本
- 在 Linux 环境下只能构建 Linux 版本

如需一次性构建所有平台的二进制文件，推荐使用下方的 **GitHub Actions 自动构建**。

### 本地打包命令

- **Windows (x64)** - 在 Windows 环境运行：
  ```bash
  npm run package:win
  ```

- **macOS (ARM64)** - 在 macOS 环境运行：
  ```bash
  npm run package:mac
  ```

- **Linux (x64)** - 在 Linux 环境运行：
  ```bash
  npm run package:linux-x64
  ```

- **Linux (ARM64)** - 在 Linux 环境运行：
  ```bash
  npm run package:linux-arm64
  ```

- **当前平台** - 自动检测并构建当前操作系统版本：
  ```bash
  npm run package:current
  ```

打包后的文件将保存在 `build/` 目录下。

### pkg 配置

在 `package.json` 中配置了 pkg 的基本选项：

```json
"pkg": {
  "assets": [],
  "targets": ["node18"],
  "outputPath": "build"
}
```

### 可用的打包目标

pkg 支持的目标格式：`node<version>-<platform>-<arch>`

- **Node 版本**: node18 (推荐，兼容性更好), node20, node22 等
- **平台**: win, macos, linux
- **架构**: x64, arm64

## Docker Compose 部署

本项目支持通过 Docker Compose 使用预构建镜像运行，无需在目标机器上安装 Node.js。

### 前置准备

1. **准备可执行文件**：将对应平台的可执行文件放入 `bin/` 目录：
   - x86_64 架构：`bin/typescript-demo-linux-amd64`
   - ARM64  架构：`bin/typescript-demo-linux-arm64`

2. **加载 Docker 镜像**（首次使用）：
   ```bash
   # x86_64 架构
   docker load -i env/typescript-demo-linux-amd64.tar

   # ARM64 架构
   docker load -i env/typescript-demo-linux-arm64.tar
   ```

### 启动服务

根据宿主机架构选择对应的 profile 启动：

```bash
# x86_64 架构（Intel / AMD CPU）
docker compose --profile x64 up

# ARM64 架构（Apple Silicon / 树莓派 / ARM 服务器）
docker compose --profile arm64 up
```

### 配置说明

- `bin/` 目录映射到容器内的 `/app`，可执行文件从此路径启动
- 容器配置 `stdin_open: true` 和 `tty: true`，以支持程序读取键盘输入（按回车退出）
- 时区默认为 `Asia/Shanghai`，可在 `docker-compose.yaml` 中修改

> **💡 重要提示：修改 `docker-compose.yaml` 不需要重新构建 Docker 镜像**
>
> 本项目使用预构建的基础镜像（`env/` 目录中的 tar 包），`docker-compose.yaml` 仅定义容器的运行参数（如环境变量、卷映射、启动命令等）。
> - 修改 `docker-compose.yaml`（如调整时区、容器名、profile）→ **只需重启容器**：`docker compose --profile x64 restart`
> - 更新 `bin/` 中的可执行文件 → **只需重启容器**：`docker compose --profile x64 restart`
> - 只有 `Dockerfile` 变更时才需要重新构建镜像

## GitHub Actions 自动构建与 Release

本项目已配置完整的 CI/CD 工作流，支持自动构建、打包和发布。

### 触发条件

| 事件 | 行为 |
|------|------|
| `push` 到 `main` 分支 | 检测变更，按需构建二进制文件或镜像 |
| `pull_request` 到 `main` | 同上进行构建验证 |
| **发布 Release** | 触发完整构建流程，并自动打包上传 |

### 工作流 Job 说明

#### 1. `build` - 多平台二进制打包

在以下运行器上并行构建：

| 平台 | 架构 | 输出文件 |
|------|------|----------|
| Linux | x64 | `typescript-demo-linux-x64` |
| Linux | ARM64 | `typescript-demo-linux-arm64` |
| Windows | x64 | `typescript-demo-win-x64.exe` |
| macOS | ARM64 | `typescript-demo-macos-arm64` |

#### 2. `docker` - Docker 镜像构建

使用 `docker buildx` + QEMU 交叉编译，构建以下镜像并导出为 tar：

- `typescript-demo:linux-amd64` → `typescript-demo-linux-amd64.tar`
- `typescript-demo:linux-arm64` → `typescript-demo-linux-arm64.tar`

#### 3. `release-bundle` - Release 资源打包（仅 Release 触发）

当创建 Release 时，自动执行以下操作：

1. 下载所有构建产物（4 平台可执行文件 + 2 个镜像 tar）
2. 整理目录结构：
   ```
   bin/                                    # 可执行文件
   ├── typescript-demo-linux-x64
   ├── typescript-demo-linux-arm64
   ├── typescript-demo-win-x64.exe
   └── typescript-demo-macos-arm64
   env/                                    # Docker 镜像包
   ├── typescript-demo-linux-amd64.tar
   └── typescript-demo-linux-arm64.tar
   docker-compose.yaml                     # 部署配置
   ```
3. 打包为两种格式：`typescript-demo-release.zip` 和 `typescript-demo-release.tar.gz`
4. 自动上传到 Release Assets

### 手动触发 Release

```bash
# 创建标签
git tag v1.0.0

# 推送标签
git push origin v1.0.0
```

在 GitHub 页面基于该标签创建 Release 并发布后，GitHub Actions 将自动完成剩余流程。

## TypeScript 配置

项目配置位于 `tsconfig.json`：

- `target`: ES2020 - 编译目标版本
- `module`: CommonJS - 模块系统
- `outDir`: ./dist - 输出目录
- `rootDir`: ./src - 源代码目录
- `strict`: true - 启用严格类型检查
- `types`: ["node"] - 包含 Node.js 类型定义

## 自定义开发

### 添加新的 TypeScript 文件

在 `src/` 目录下创建新的 `.ts` 文件，TypeScript 编译器会自动处理。

### 修改入口文件

在 `src/index.ts` 中编写你的应用逻辑。

### 安装额外的依赖

```bash
npm install <package-name>
npm install --save-dev <dev-package-name>
```

## 故障排除

### nvm 命令找不到

确保你已经正确加载了 nvm 配置：

```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

### TypeScript 编译错误

检查 `tsconfig.json` 配置是否正确，确保所有依赖都已安装。

### pkg 打包失败

- 确保 `npm run build` 成功完成
- 检查 `package.json` 中的 `bin` 字段是否指向正确的入口文件
- 确保有足够的磁盘空间

### Docker 容器启动后立刻退出

- 确认 `bin/` 目录下已放入对应平台的可执行文件
- 确认已执行 `docker load -i env/xxx.tar` 加载镜像
- 检查 `docker-compose.yaml` 中的 `command` 路径是否与实际文件名一致

## 许可证

ISC
