# TypeScript 项目开发示例

这是一个完整的 TypeScript 项目示例，支持多平台打包（Windows、macOS、Linux）。

## 环境要求

- Node.js (推荐使用 nvm 管理)
- npm 或 yarn

## 快速开始

### 1. 安装 Node.js (使用 nvm)

如果你还没有安装 nvm，请先安装 nvm：

```bash
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# 重新加载配置
source ~/.bashrc  # 或者 source ~/.zshrc
```

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
├── src/              # TypeScript 源代码
│   └── index.ts      # 主入口文件
├── dist/             # 编译后的 JavaScript 代码
├── build/            # 打包后的可执行文件
├── package.json      # 项目配置
├── tsconfig.json     # TypeScript 配置
└── README.md         # 项目文档
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

本项目使用 `pkg` 工具将 Node.js 应用打包为可执行文件。

### ⚠️ 重要说明

**pkg 工具需要在目标操作系统上进行构建**：
- 在 Windows 环境下只能构建 Windows 版本
- 在 macOS 环境下只能构建 macOS 版本
- 在 Linux 环境下只能构建 Linux 版本

如需构建所有平台的二进制文件，请在相应的操作系统上运行对应的打包命令。

### 打包命令

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

## 打包说明

### pkg 配置

在 [package.json](file:///mnt/h/TypeScript_stady/package.json#L20-L24) 中配置了 pkg 的基本选项：

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

### GitHub Actions 自动构建（推荐）

本项目已配置 GitHub Actions 自动构建，支持在 GitHub 上自动构建所有平台的二进制文件。

#### 配置文件

项目已包含 `.github/workflows/build.yml`，支持以下平台：

| 平台 | 架构 | 输出文件 |
|------|------|----------|
| Linux | x64 | `typescript-demo-linux-x64` |
| Linux | ARM64 | `typescript-demo-linux-arm64` |
| Windows | x64 | `typescript-demo-win-x64.exe` |
| macOS | ARM64 | `typescript-demo-macos-arm64` |

#### 使用步骤

1. **推送到 GitHub**：

```bash
# 初始化 git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 重命名分支（可选）
git branch -M main

# 添加远程仓库
git remote add origin <your-github-repo-url>

# 推送
git push -u origin main
```

2. **触发自动构建**：

推送到 `main` 分支后，GitHub Actions 会自动开始构建。构建完成后，可以在 GitHub 仓库的 **Actions** 标签页下载构建产物。

3. **创建 Release**：

```bash
# 创建标签
git tag v1.0.0

# 推送标签
git push origin v1.0.0
```

创建标签后，GitHub Actions 会自动创建 Release 并上传所有平台的二进制文件。

## TypeScript 配置

项目配置位于 [tsconfig.json](file:///mnt/h/TypeScript_stady/tsconfig.json)：

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

在 [src/index.ts](file:///mnt/h/TypeScript_stady/src/index.ts) 中编写你的应用逻辑。

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

检查 [tsconfig.json](file:///mnt/h/TypeScript_stady/tsconfig.json) 配置是否正确，确保所有依赖都已安装。

### pkg 打包失败

- 确保 `npm run build` 成功完成
- 检查 [package.json](file:///mnt/h/TypeScript_stady/package.json) 中的 `bin` 字段是否指向正确的入口文件
- 确保有足够的磁盘空间

## 许可证

ISC
