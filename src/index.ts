#!/usr/bin/env node

import { loadConfig } from './config';
import { CameraApi, delay } from './api';
import * as path from 'path';

async function main() {
  // 支持命令行传入配置文件路径，例如: node dist/index.js ./my-config.toml
  const configArg = process.argv[2];
  const configPath = configArg ? path.resolve(configArg) : undefined;

  const config = loadConfig(configPath);
  console.log('============================================');
  console.log('      摄像头点位自动刷新工具');
  console.log('============================================');
  console.log(`  API 地址:   ${config.api.base_url}`);
  console.log(`  刷新间隔:   ${config.refresh.interval_ms}ms`);
  console.log(`  分页大小:   ${config.refresh.total_count}`);
  console.log('============================================');

  const api = new CameraApi(config);

  try {
    // 1. 认证获取 Token
    await api.authenticate();

    // 2. 获取摄像头列表
    const cameras = await api.getCameraList();
    if (cameras.length === 0) {
      console.log('[Info] 摄像头列表为空，无需刷新');
      return;
    }

    // 3. 循环刷新每个摄像头
    console.log(`[Info] 开始逐个刷新，共 ${cameras.length} 个点位`);
    for (let i = 0; i < cameras.length; i++) {
      const cam = cameras[i];
      console.log(`\n[Progress] ${i + 1}/${cameras.length} - ${cam.name || cam.camera_id}`);

      try {
        await api.refreshCamera(cam.camera_id);
      } catch (err) {
        console.error(`[Error] 刷新失败 (${cam.camera_id}):`, (err as Error).message);
      }

      // 如果不是最后一个，等待指定间隔
      if (i < cameras.length - 1) {
        console.log(`[Wait] 等待 ${config.refresh.interval_ms}ms...`);
        await delay(config.refresh.interval_ms);
      }
    }

    console.log('\n============================================');
    console.log('      全部刷新完成');
    console.log('============================================');
  } catch (err) {
    console.error('[Fatal]', (err as Error).message);
    process.exit(1);
  }
}

main();
