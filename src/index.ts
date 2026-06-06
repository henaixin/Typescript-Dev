#!/usr/bin/env node

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';

// ==================== 配置项（运行时从 config.toml 读取） ====================
interface AppConfig {
  baseUrl: string;
  port: number;
  appId: string;
  appSecret: string;
  refreshIntervalMs: number;
  pageSize: number;
}

function loadConfig(): AppConfig {
  // 优先从当前工作目录查找 config.toml，其次从可执行文件所在目录查找
  const searchPaths = [
    path.join(process.cwd(), 'config.toml'),
    path.join(__dirname, '..', 'config.toml'),
    path.join(process.argv[1] || '', '..', 'config.toml'),
  ];

  let configFile: string | null = null;
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      configFile = p;
      break;
    }
  }

  if (!configFile) {
    throw new Error(
      '未找到 config.toml 配置文件。请在以下位置之一放置配置文件:\n' +
        searchPaths.map((p) => '  - ' + p).join('\n')
    );
  }

  console.log(`[配置] 读取配置文件: ${configFile}`);
  const raw = fs.readFileSync(configFile, 'utf-8');
  const parsed = toml.parse(raw) as AppConfig;

  // 简单校验
  if (!parsed.baseUrl || !parsed.appId || !parsed.appSecret) {
    throw new Error('config.toml 中缺少必需的配置项: baseUrl, appId, appSecret');
  }

  return {
    baseUrl: String(parsed.baseUrl),
    port: Number(parsed.port) || 8081,
    appId: String(parsed.appId),
    appSecret: String(parsed.appSecret),
    refreshIntervalMs: Number(parsed.refreshIntervalMs) || 2000,
    pageSize: Number(parsed.pageSize) || 100,
  };
}

let CONFIG: AppConfig;

// ==================== 类型定义 ====================
interface AuthResponse {
  data?: {
    token?: string;
  };
  code?: number;
  msg?: string;
}

interface CameraItem {
  camera_id: string;
  name: string;
  online_status?: number;
}

interface CameraListResponse {
  code?: number;
  msg?: string;
  data?: {
    current?: number;
    page_size?: number;
    total?: number;
    data?: CameraItem[];
  };
}

interface RefreshResponse {
  code?: number;
  msg?: string;
}

// ==================== HTTP 请求工具（基于 Node.js 原生 http 模块） ====================
function postJson<T>(path: string, body: object, headers: Record<string, string> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);

    const options: http.RequestOptions = {
      hostname: CONFIG.baseUrl,
      port: CONFIG.port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data) as T;
          resolve(json);
        } catch (err) {
          reject(new Error(`解析响应 JSON 失败: ${(err as Error).message}, 原始响应: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// ==================== 延迟工具 ====================
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== 业务逻辑 ====================

/**
 * 1. 获取认证 Token
 */
async function authenticate(): Promise<string> {
  console.log('[1/3] 正在获取 Token...');
  const res = await postJson<AuthResponse>('/openapi/mc/v1/authenticate', {
    app_id: CONFIG.appId,
    app_secret: CONFIG.appSecret,
  });

  if (!res.data?.token) {
    throw new Error(`获取 Token 失败: ${JSON.stringify(res)}`);
  }

  console.log('[1/3] Token 获取成功');
  return res.data.token;
}

/**
 * 2. 获取摄像头列表（自动分页拉取全部）
 */
async function getCameraList(token: string): Promise<CameraItem[]> {
  console.log('[2/3] 正在获取摄像头列表...');
  const allCameras: CameraItem[] = [];
  let current = 1;
  let total = 0;

  do {
    const res = await postJson<CameraListResponse>(
      '/openapi/usm/v1/camera/list',
      {
        current: current,
        page_size: CONFIG.pageSize,
      },
      { Authorization: `Bearer ${token}` }
    );

    if (res.code !== 0 && res.code !== 200) {
      throw new Error(`获取摄像头列表失败: ${res.msg || JSON.stringify(res)}`);
    }

    const page = res.data;
    if (!page) break;

    const list = page.data || [];
    allCameras.push(...list);
    total = page.total || 0;

    console.log(`  > 第 ${current} 页获取 ${list.length} 条，累计 ${allCameras.length} / ${total}`);

    if (list.length === 0 || allCameras.length >= total) break;
    current++;
  } while (allCameras.length < total);

  console.log(`[2/3] 共获取 ${allCameras.length} 个摄像头`);
  return allCameras;
}

/**
 * 3. 刷新单个摄像头点位
 */
async function refreshCamera(token: string, camera: CameraItem, index: number, total: number): Promise<void> {
  console.log(`[3/3] 正在刷新 (${index + 1}/${total}) camera_id=${camera.camera_id}, name=${camera.name}`);

  const res = await postJson<RefreshResponse>(
    '/openapi/usm/v1/camera/refresh',
    {
      camera_ids: [camera.camera_id],
    },
    { Authorization: `Bearer ${token}` }
  );

  if (res.code !== 0 && res.code !== 200) {
    console.error(`  ✗ 刷新失败: ${res.msg || JSON.stringify(res)}`);
  } else {
    console.log(`  ✓ 刷新成功`);
  }
}

/**
 * 主流程：读取配置 -> 认证 -> 获取列表 -> for 循环逐个刷新
 */
async function main() {
  console.log('========================================');
  console.log('      摄像头点位自动刷新工具');
  console.log('========================================');

  // 读取配置文件
  CONFIG = loadConfig();

  console.log(`[配置] baseUrl=${CONFIG.baseUrl}:${CONFIG.port}`);
  console.log(`[配置] 刷新间隔=${CONFIG.refreshIntervalMs}ms`);
  console.log('');

  const startTime = Date.now();

  try {
    // 1. 获取 token
    const token = await authenticate();

    // 2. 获取全部摄像头列表
    const cameras = await getCameraList(token);

    if (cameras.length === 0) {
      console.log('没有需要刷新的摄像头，程序结束。');
      return;
    }

    // 3. for 循环逐个刷新，间隔可调
    console.log('');
    console.log(`[3/3] 开始逐个刷新，间隔 ${CONFIG.refreshIntervalMs}ms...`);
    for (let i = 0; i < cameras.length; i++) {
      await refreshCamera(token, cameras[i], i, cameras.length);

      // 如果不是最后一个，则等待指定间隔
      if (i < cameras.length - 1) {
        await sleep(CONFIG.refreshIntervalMs);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log('========================================');
    console.log(`  全部完成！共刷新 ${cameras.length} 个点位`);
    console.log(`  总耗时: ${duration}s`);
    console.log('========================================');
  } catch (err) {
    console.error('');
    console.error('程序执行出错:', (err as Error).message);
    process.exit(1);
  }
}

main();
