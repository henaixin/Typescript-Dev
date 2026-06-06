import * as fs from 'fs';
import * as path from 'path';
import * as toml from '@iarna/toml';

export interface AppConfig {
  api: {
    base_url: string;
    auth_endpoint: string;
    list_endpoint: string;
    refresh_endpoint: string;
  };
  auth: {
    app_id: string;
    app_secret: string;
  };
  refresh: {
    interval_ms: number;
    total_count: number;
    loop_interval_ms: number;
    max_rounds: number;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  api: {
    base_url: 'http://192.168.100.2:8081',
    auth_endpoint: '/openapi/mc/v1/authenticate',
    list_endpoint: '/openapi/usm/v1/camera/list',
    refresh_endpoint: '/openapi/usm/v1/camera/refresh',
  },
  auth: {
    app_id: 'qmPIEPfgYILb',
    app_secret: 'UFzoFNTLT3CZvWGqmSVPGyq9',
  },
  refresh: {
    interval_ms: 2000,
    total_count: 20,
    loop_interval_ms: 3600000,
    max_rounds: 3,
  },
};

export function loadConfig(configPath?: string): AppConfig {
  const pathsToTry = [
    configPath,
    path.resolve(process.cwd(), 'config.toml'),
    path.resolve(__dirname, '../config.toml'),
    path.resolve(__dirname, '../../config.toml'),
  ].filter(Boolean) as string[];

  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = toml.parse(raw) as unknown as AppConfig;
        return mergeConfig(DEFAULT_CONFIG, parsed);
      } catch (err) {
        console.warn(`[Config] 读取配置文件失败: ${p}`, (err as Error).message);
      }
    }
  }

  console.warn('[Config] 未找到配置文件，使用默认配置');
  return DEFAULT_CONFIG;
}

function mergeConfig(defaults: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    api: { ...defaults.api, ...override.api },
    auth: { ...defaults.auth, ...override.auth },
    refresh: { ...defaults.refresh, ...override.refresh },
  };
}
