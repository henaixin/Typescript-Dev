# AGENTS.md

> 本文件面向 AI 编程助手。如果你正在阅读此文件，说明你对本项目一无所知——以下信息全部基于项目实际内容，不含假设。

---

## 项目概览

本项目（`typescript_stady`）是一个 **TypeScript 项目开发示例**，核心目标是演示如何将 Node.js 应用通过 `pkg` 工具打包为跨平台原生可执行文件（Windows、macOS、Linux x64/ARM64）。

当前应用逻辑非常简单：运行后打印当前操作系统平台信息（平台、架构、Node.js 版本、OS 发行版、用户主目录），然后等待用户按下回车键退出。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript 5.x（目标 ES2020，模块系统 CommonJS） |
| 运行时 | Node.js 18 |
| 打包工具 | `pkg` 5.8.1（将 Node.js 应用编译为独立二进制文件） |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| 依赖管理 | npm |

---

## 项目结构

```
.
├── src/
│   └── index.ts              # 唯一源码文件，应用入口
├── dist/                     # tsc 编译输出目录（.gitignore）
├── build/                    # pkg 打包后的可执行文件输出目录（.gitignore）
├── env/                      # 存放预构建的 Docker 镜像 tar 包（如 linux-amd64/arm64）
├── .github/workflows/
│   └── build.yml             # GitHub Actions：多平台自动构建 + Release
├── package.json              # npm 配置、pkg 配置、脚本定义
├── tsconfig.json             # TypeScript 编译配置
├── Dockerfile                # 通用基础镜像（支持 Alpine / Debian / Ubuntu）
├── docker-compose.yaml       # 按 CPU 架构（x64 / arm64）分 Profile 启动容器
├── git-push-new-branch.sh    # Git 工作流辅助脚本：创建分支、提交、推送、自动更新 CI 分支触发列表
├── README.md                 # 面向人类开发者的项目文档（中文）
├── TypeScript-运维.md         # TypeScript 运维自动化相关的参考资料（非本项目实际配置）
└── AGENTS.md                 # 本文件
```

---

## 构建与运行命令

```bash
# 安装依赖
npm install

# 编译 TypeScript（输出到 dist/）
npm run build

# 开发模式：编译后立即运行
npm run dev

# 运行已编译的程序
npm run start

# 打包为当前平台的可执行文件（输出到 build/）
npm run package:current

# 打包为指定平台（需要在对应操作系统上执行）
npm run package:win        # Windows x64
npm run package:mac        # macOS ARM64
npm run package:linux-x64  # Linux x64
npm run package:linux-arm64 # Linux ARM64

# 一次性打包两个 Linux 架构
npm run package:linux
```

> ⚠️ **pkg 的限制**：`pkg` 必须在目标操作系统上执行构建。例如，Windows 可执行文件只能在 Windows 宿主机构建，macOS 只能在 macOS 构建，Linux 只能在 Linux 构建。跨平台构建请使用 GitHub Actions。

---

## 代码组织

- **唯一源码入口**：`src/index.ts`
- 当前代码量极少，没有子模块拆分。所有逻辑（获取平台信息、格式化输出、等待键盘输入）都集中在 `src/index.ts` 中。
- `package.json` 中的 `bin` 字段指向 `dist/index.js`，这是 `pkg` 打包时的入口依据。

---

## TypeScript 配置要点

见 `tsconfig.json`：

- `target`: `ES2020`
- `module`: `CommonJS`
- `outDir`: `./dist`
- `rootDir`: `./src`
- `strict`: `true`（启用所有严格类型检查）
- `types`: `["node"]`（仅包含 Node.js 内置类型）
- `moduleResolution`: `node10`

**约定**：本项目使用 CommonJS 模块输出，但源码中允许使用 ES Module 风格的 `import` 语法（由 `esModuleInterop` 支持）。

---

## 测试策略

**当前状态：本项目没有配置任何测试框架。**

`package.json` 的 `devDependencies` 中仅有 `@types/node`、`pkg`、`typescript`，没有 Jest、Mocha、Vitest 等测试工具。

如果需要添加测试，项目文档 `TypeScript-运维.md` 中提到了 `jest` + `ts-jest` 作为推荐方案，但这只是参考性内容，尚未实际集成。

---

## CI/CD 与发布流程

GitHub Actions 工作流位于 `.github/workflows/build.yml`，包含三个任务：

1. **`changes`（变更检测）**
   - 使用 `dorny/paths-filter` 检测 `src/` 或 `Dockerfile` 是否有变更。

2. **`build`（多平台二进制构建）**
   - 触发条件：`src/` 目录有变更。
   - 构建矩阵：
     - `ubuntu-latest` → `linux-x64`、`linux-arm64`
     - `windows-latest` → `win-x64`
     - `macos-latest` → `macos-arm64`
   - 每个任务执行 `npm ci` → `npm run build` → `npx pkg` → 上传 Artifact。

3. **`docker`（Docker 镜像构建）**
   - 触发条件：`Dockerfile` 有变更。
   - 使用 `docker/build-push-action` 构建 `linux/amd64` 和 `linux/arm64` 镜像，输出为 tar 文件。

4. **`release`（自动发布）**
   - 触发条件：推送以 `v` 开头的 tag（如 `v1.0.0`）。
   - 下载所有构建产物，使用 `softprops/action-gh-release` 自动创建 GitHub Release 并上传四个平台的二进制文件。

---

## Docker 与部署架构

### Dockerfile

- 设计为**通用基础镜像**，支持通过 `BASE_IMAGE` 构建参数切换 `alpine:3.20`、`debian:slim`、`ubuntu` 等。
- 自动检测包管理器（`apk` 或 `apt-get`）安装 `ca-certificates`、`tzdata`、以及 `glibc` 兼容层（Alpine 需要 `libc6-compat` / `gcompat`，因为 `pkg` 打包的二进制默认基于 glibc）。
- 创建非 root 用户 `appuser`（UID/GID 默认 1000），最终容器以该用户运行。
- **注意**：镜像本身**不包含**应用二进制文件，运行时通过挂载宿主机的二进制文件到 `/app/app` 来执行。

### docker-compose.yaml

- 使用 Compose Profile 区分架构：
  - `docker compose --profile x64 up` —— 挂载 `build/typescript-demo-linux-x64`
  - `docker compose --profile arm64 up` —— 挂载 `build/typescript-demo-linux-arm64`
- 挂载方式为**只读**（`:ro`）。
- 容器配置 `stdin_open: true` + `tty: true`，因为应用需要读取键盘输入（等待回车退出）。
- 时区环境变量默认设为 `Asia/Shanghai`。

---

## 开发约定与工具

### 代码风格

- 项目使用**中文**编写注释和文档（`README.md`、`Dockerfile`、`docker-compose.yaml`、脚本等）。
- 若新增代码，建议保持中文注释风格，以与现有代码一致。
- TypeScript 严格模式已开启，任何新增代码必须通过类型检查。

### `git-push-new-branch.sh` 脚本

这是一个项目特化的 Git 工作流辅助脚本，功能包括：

- 自动生成或切换到指定分支。
- 自动检测未提交更改，禁止跨分支提交（安全机制）。
- **自动修改 `.github/workflows/build.yml`**：将新分支名追加到 `branches` 触发列表中，使新分支也能触发 CI。
- 自动生成 commit message（默认格式：`feat: refresh camera points (branch: <branch-name>)`）。
- 推送后自动生成 GitHub Pull Request 链接。

用法示例：
```bash
./git-push-new-branch.sh -m "fix: something" my-feature
./git-push-new-branch.sh --force existing-branch
```

---

## 安全注意事项

1. **非 root 容器运行**：`Dockerfile` 中创建了 `appuser` 并以该用户运行容器，降低宿主机被入侵后的影响面。
2. **只读挂载**：`docker-compose.yaml` 中将宿主机二进制文件以 `:ro` 只读方式挂载到容器内，防止容器内意外修改可执行文件。
3. **无敏感信息泄露**：`.gitignore` 已排除 `.env`、`.env.local`、`node_modules/`、`dist/`、`build/` 等目录。
4. **GitHub Actions 安全**：工作流仅在 `src/` 或 `Dockerfile` 变更时触发构建，避免无意义的 CI 运行；使用 `actions/checkout@v4` 等官方维护的 Action。

---

## 常见问题与排查

| 问题 | 排查方向 |
|------|----------|
| `npm run build` 报错 | 检查 `tsconfig.json`，确保 Node.js 版本兼容，确认 `@types/node` 已安装 |
| `pkg` 打包失败 | 确认 `npm run build` 已成功；检查 `package.json` 的 `bin` 字段是否指向 `dist/index.js`；确认磁盘空间充足 |
| Docker 容器内二进制无法运行 | 确认宿主机架构与二进制架构匹配；Alpine 容器需确认已安装 `gcompat` 或 `libc6-compat` |
| GitHub Actions 未触发 | 检查 `.github/workflows/build.yml` 的 `branches` 列表是否包含当前分支；`git-push-new-branch.sh` 会自动追加 |

---

## 扩展建议（如需继续开发）

- 当前 `src/index.ts` 是一个极简 Demo。若要扩展功能，直接在 `src/` 下新增 `.ts` 文件，并在 `index.ts` 中引入即可。
- 若项目变大，建议引入：
  - 测试框架（如 `jest` + `ts-jest`）
  - 代码格式化工具（如 `prettier`）
  - Linter（如 `eslint` + `@typescript-eslint`）
- 若需引入外部运行时依赖，直接 `npm install <package>`；若依赖包含原生模块，`pkg` 可能需要额外配置 `assets` 或 `scripts`。
