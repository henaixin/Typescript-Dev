# TypeScript 运维自动化指南

本指南介绍如何使用 TypeScript 编写运维自动化脚本，以及本项目在运维场景中的最佳实践。

## TypeScript 运维自动化优势

| 优势 | 说明 |
|------|------|
| **类型安全** | 减少运行时错误，尤其适合复杂的运维脚本 |
| **异步编程** | 原生支持 Promise/async-await，处理并发任务更优雅 |
| **Node.js 生态** | 丰富的第三方库支持文件操作、SSH、HTTP、Docker 等 |
| **跨平台** | 一次编写，多平台运行（Windows/macOS/Linux） |
| **可维护性** | 适合编写大型运维工具和长期维护的脚本 |

## 本项目的运维实践

### 1. 预构建镜像分发

本项目通过 GitHub Actions 自动构建多平台 Docker 镜像，并导出为 tar 包：

```bash
# 镜像加载（目标服务器执行）
docker load -i env/typescript-demo-linux-amd64.tar
docker load -i env/typescript-demo-linux-arm64.tar
```

**优势**：
- 无需在目标服务器安装 Node.js 或编译工具链
- 镜像已包含运行环境，启动即用
- 适合离线环境或网络受限的服务器

### 2. 配置文件与可执行文件热更新

通过 Docker Compose 的 `volumes` 映射，**`bin/` 目录下的可执行文件更新后，重启容器即可生效**，无需重新构建镜像：

```bash
# 1. 替换 bin/ 中的可执行文件
# 2. 重启容器
docker compose --profile x64 restart
```

同理，**修改 `docker-compose.yaml` 也不需要重新构建镜像**。因为本项目使用预构建的基础镜像，Compose 文件仅定义容器的运行参数（环境变量、卷映射、启动命令、tty 等），这些参数在容器启动时动态生效：

```bash
# 修改 docker-compose.yaml 后（如调整时区、容器名）
# 直接重新创建容器即可生效
docker compose --profile x64 up -d --force-recreate
```

**何时需要重新构建镜像？**

| 变更内容 | 是否需要重建镜像 | 操作命令 |
|----------|----------------|----------|
| `docker-compose.yaml`（时区、容器名、profile 等） | ❌ 否 | `docker compose restart` 或 `up -d --force-recreate` |
| `bin/` 中的可执行文件 | ❌ 否 | `docker compose restart` |
| `Dockerfile`（基础镜像、依赖等） | ✅ 是 | `docker build` 或重新加载 tar 包 |

### 3. GitHub Actions 自动化发布

完整的发布流程已集成到 CI/CD：

1. **代码提交** → `main` 分支
2. **创建 Release** → GitHub 页面发布
3. **自动触发** → 构建二进制文件 + Docker 镜像
4. **自动打包** → 生成 `zip` 和 `tar.gz`
5. **自动上传** → 发布到 Release Assets

运维人员只需下载 Release 包，解压后按以下步骤部署：

```bash
# 解压 Release 包
unzip typescript-demo-release.zip -d ./app
cd app

# 加载镜像
docker load -i env/typescript-demo-linux-amd64.tar

# 启动服务（根据架构选择 profile）
docker compose --profile x64 up -d
```

## 推荐的运维工具库

### 1. 文件系统操作
```typescript
// Node.js 内置模块
import * as fs from 'fs/promises';
import * as path from 'path';
```

### 2. Shell 命令执行
```bash
npm install execa
```

```typescript
import { execa } from 'execa';

// 执行命令并获取输出
const { stdout } = await execa('docker', ['ps', '-a']);
console.log(stdout);
```

### 3. CLI 参数解析
```bash
npm install yargs
```

```typescript
import yargs from 'yargs';

const argv = await yargs
  .option('env', {
    alias: 'e',
    describe: '目标环境',
    type: 'string',
    default: 'dev'
  })
  .option('profile', {
    alias: 'p',
    describe: 'Docker Compose profile',
    type: 'string',
    default: 'x64'
  })
  .argv;
```

### 4. SSH 远程操作
```bash
npm install ssh2
```

```typescript
import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('docker compose --profile x64 up -d', (err, stream) => {
    stream.on('close', () => conn.end());
    stream.on('data', (data) => console.log('STDOUT: ' + data));
  });
}).connect({
  host: 'server.example.com',
  username: 'deploy',
  privateKey: require('fs').readFileSync('/path/to/key')
});
```

### 5. HTTP 请求（健康检查）
```bash
npm install axios
```

```typescript
import axios from 'axios';

async function healthCheck(url: string): Promise<boolean> {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}
```

## 实战示例：容器健康检查脚本

```typescript
#!/usr/bin/env node
import { execa } from 'execa';

interface ContainerStatus {
  name: string;
  status: string;
  healthy: boolean;
}

async function checkContainers(): Promise<ContainerStatus[]> {
  const { stdout } = await execa('docker', ['ps', '--format', '{{.Names}}|{{.Status}}']);
  
  return stdout.split('\n').filter(Boolean).map(line => {
    const [name, status] = line.split('|');
    return {
      name,
      status,
      healthy: status.includes('Up') && !status.includes('unhealthy')
    };
  });
}

async function main() {
  console.log('=== Docker 容器健康检查 ===\n');
  
  const containers = await checkContainers();
  for (const c of containers) {
    const icon = c.healthy ? '✅' : '❌';
    console.log(`${icon} ${c.name}: ${c.status}`);
  }
  
  const unhealthy = containers.filter(c => !c.healthy);
  if (unhealthy.length > 0) {
    console.log(`\n⚠️  ${unhealthy.length} 个容器状态异常`);
    process.exit(1);
  }
  
  console.log('\n所有容器运行正常');
}

main().catch(console.error);
```

## 最佳实践建议

### 1. 使用 async/await
```typescript
// ❌ 回调地狱
fs.readFile('config.json', (err, data) => {
  // ...
});

// ✅ 推荐使用 async/await
const data = await fs.readFile('config.json', 'utf-8');
```

### 2. 完善的错误处理
```typescript
try {
  await execa('docker', ['compose', '--profile', 'x64', 'up', '-d']);
  console.log('服务启动成功');
} catch (error: any) {
  console.error(`部署失败: ${error.message}`);
  process.exit(1);
}
```

### 3. 配置管理
```typescript
// config.ts
export const config = {
  development: {
    profile: 'x64',
    composeFile: 'docker-compose.yaml'
  },
  production: {
    profile: 'arm64',
    composeFile: 'docker-compose.yaml'
  }
};
```

### 4. 日志记录
```bash
npm install winston
```

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'deploy.log' }),
    new winston.transports.Console()
  ]
});
```

## 常用运维场景对照表

| 场景 | 推荐工具 | 本项目应用 |
|------|----------|------------|
| 文件备份/同步 | `fs/promises`, `tar` | Release 包打包 |
| 服务监控 | `axios`, `execa` | 容器健康检查 |
| 部署脚本 | `execa`, `ssh2` | Docker Compose 启动 |
| 日志分析 | `fs`, `winston` | 应用日志记录 |
| Docker 管理 | `dockerode`, `execa` | 镜像构建与容器管理 |

## 本项目 CI/CD 工作流速查

```
Release 发布
    │
    ├─→ build job（并行 4 平台）
    │   ├─ linux-x64  → typescript-demo-linux-x64
    │   ├─ linux-arm64 → typescript-demo-linux-arm64
    │   ├─ win-x64    → typescript-demo-win-x64.exe
    │   └─ macos-arm64 → typescript-demo-macos-arm64
    │
    ├─→ docker job（交叉编译）
    │   ├─ linux/amd64 → typescript-demo-linux-amd64.tar
    │   └─ linux/arm64 → typescript-demo-linux-arm64.tar
    │
    └─→ release-bundle job
        ├─ 整理 bin/ + env/ + docker-compose.yaml
        ├─ 打包为 zip / tar.gz
        └─ 上传至 Release Assets
```

## 总结

使用 TypeScript 编写运维脚本的核心优势：

1. **类型安全**：减少运维事故
2. **异步友好**：轻松处理并发任务
3. **生态成熟**：丰富的第三方库支持
4. **跨平台**：一套代码多平台运行
5. **可维护性**：适合团队协作和长期维护

结合本项目的 GitHub Actions 自动化工作流，可以实现从代码提交到生产部署的全链路自动化！🎉
