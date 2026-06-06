#!/usr/bin/env node

import { loadConfig } from './config';
import { CameraApi, CameraItem, delay } from './api';
import * as path from 'path';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}小时${minutes % 60}分${seconds % 60}秒`;
  if (minutes > 0) return `${minutes}分${seconds % 60}秒`;
  return `${seconds}秒`;
}

async function refreshCameras(api: CameraApi, cameras: CameraItem[], intervalMs: number): Promise<{ successCount: number; failCount: number }> {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < cameras.length; i++) {
    const cam = cameras[i];
    console.log(`\n[Progress] ${i + 1}/${cameras.length} - ${cam.name || cam.camera_id}`);
    if (cam.online_status === 1) {
      console.log('[Info] 摄像头已在线，跳过');
      continue;
    }

    try {
      await api.refreshCamera(cam.camera_id);
      successCount++;
    } catch (err) {
      failCount++;
      console.error(`[Error] 刷新失败 (${cam.camera_id}):`, (err as Error).message);
    }

    // 如果不是最后一个，等待指定间隔
    if (i < cameras.length - 1) {
      console.log(`[Wait] 等待 ${intervalMs}ms...`);
      await delay(intervalMs);
    }
  }

  return { successCount, failCount };
}

async function main() {
  // 支持命令行传入配置文件路径，例如: node dist/index.js ./my-config.toml
  const configArg = process.argv[2];
  const configPath = configArg ? path.resolve(configArg) : undefined;

  const config = loadConfig(configPath);
  console.log('============================================');
  console.log('      摄像头点位自动刷新工具');
  console.log('============================================');
  console.log(`  API 地址:       ${config.api.base_url}`);
  console.log(`  刷新间隔:       ${config.refresh.interval_ms}ms`);
  console.log(`  分页大小:       ${config.refresh.total_count}`);
  console.log(`  循环间隔:       ${formatDuration(config.refresh.loop_interval_ms)}`);
  console.log(`  每轮最大轮询:   ${config.refresh.max_rounds}次`);
  console.log('============================================');

  const api = new CameraApi(config);

  // 1. 认证获取 Token（程序启动时只认证一次）
  try {
    await api.authenticate();
  } catch (err) {
    console.error('[Fatal] 认证失败:', (err as Error).message);
    process.exit(1);
  }

  // 无限循环运行
  while (true) {
    const loopStartTime = Date.now();
    console.log('\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    console.log(`[Loop] 开始新一轮刷新 (${new Date().toLocaleString()})`);
    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

    try {
      // 2. 获取摄像头列表
      const cameras = await api.getCameraList();
      if (cameras.length === 0) {
        console.log('[Info] 摄像头列表为空，无需刷新');
      } else {
        let round = 0;
        let hasOffline = true;

        while (hasOffline && round < config.refresh.max_rounds) {
          round++;
          console.log(`\n[Round ${round}/${config.refresh.max_rounds}] 开始第 ${round} 轮刷新，共 ${cameras.length} 个点位`);

          // 重新获取最新列表（每轮开始前刷新状态）
          const currentCameras = round > 1 ? await api.getCameraList() : cameras;
          const offlineCameras = currentCameras.filter(c => c.online_status !== 1);

          if (offlineCameras.length === 0) {
            console.log('[Info] 所有摄像头均已在线，无需刷新');
            hasOffline = false;
            break;
          }

          console.log(`[Info] 当前离线摄像头: ${offlineCameras.length} 个`);
          const { successCount, failCount } = await refreshCameras(api, offlineCameras, config.refresh.interval_ms);
          console.log(`\n[Round ${round}] 本轮完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);

          // 检查是否还有离线的（如果还有且未满3轮，继续下一轮）
          if (round < config.refresh.max_rounds) {
            const latestCameras = await api.getCameraList();
            const remainingOffline = latestCameras.filter(c => c.online_status !== 1);
            if (remainingOffline.length === 0) {
              console.log('[Info] 所有摄像头已恢复在线');
              hasOffline = false;
            } else {
              console.log(`[Info] 仍有 ${remainingOffline.length} 个摄像头离线，准备下一轮...`);
            }
          } else {
            console.log(`[Info] 已达到最大轮询次数 (${config.refresh.max_rounds}次)`);
          }
        }
      }
    } catch (err) {
      console.error('[Error] 本轮刷新异常:', (err as Error).message);
    }

    // 计算还需等待的时间
    const elapsed = Date.now() - loopStartTime;
    const waitTime = Math.max(0, config.refresh.loop_interval_ms - elapsed);

    console.log('\n<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
    console.log(`[Loop] 本轮结束，耗时 ${formatDuration(elapsed)}`);
    console.log(`[Loop] 下次刷新将在 ${formatDuration(waitTime)} 后开始 (${new Date(Date.now() + waitTime).toLocaleString()})`);
    console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');

    await delay(waitTime);
  }
}

main();
