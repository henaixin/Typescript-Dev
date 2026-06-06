import { AppConfig } from './config';

export interface AuthResponse {
  data?: {
    token?: string;
  };
  code?: number;
  msg?: string;
}

export interface CameraItem {
  camera_id: string;
  camera_types: number[];
  exists: number;
  extra: Record<string, unknown>;
  gps: string;
  height: number;
  id: number;
  init_picture: string;
  name: string;
  online_status: number;
  sdk_info: Record<string, unknown>;
  source_id: number;
  stream_url: string;
  third_platform_index_id: string;
  width: number;
}

export interface CameraListResponse {
  current?: number;
  data?: CameraItem[];
  page_size?: number;
  total?: number;
  code?: number;
  msg?: string;
}

export interface RefreshResponse {
  code?: number;
  msg?: string;
  data?: unknown;
}

export class CameraApi {
  private config: AppConfig;
  private token: string | null = null;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private async post<T>(url: string, body: unknown, auth = false): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (auth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as T;
  }

  async authenticate(): Promise<void> {
    const url = `${this.config.api.base_url}${this.config.api.auth_endpoint}`;
    const body = {
      app_id: this.config.auth.app_id,
      app_secret: this.config.auth.app_secret,
    };

    console.log('[Auth] 正在获取 Token...');
    const res = await this.post<AuthResponse>(url, body);

    if (res.code !== 0 && res.code !== undefined) {
      throw new Error(`认证失败: ${res.msg || JSON.stringify(res)}`);
    }

    const token = res.data?.token;
    if (!token) {
      throw new Error('认证接口未返回 token');
    }

    this.token = token;
    console.log('[Auth] Token 获取成功');
  }

  async getCameraList(): Promise<CameraItem[]> {
    if (!this.token) {
      throw new Error('未获取 Token，请先调用 authenticate()');
    }

    const url = `${this.config.api.base_url}${this.config.api.list_endpoint}`;
    const body = {
      current: 1,
      page_size: this.config.refresh.total_count,
    };

    console.log('[List] 正在获取摄像头列表...');
    const res = await this.post<CameraListResponse>(url, body, true);

    if (res.code !== 0 && res.code !== undefined) {
      throw new Error(`获取列表失败: ${res.msg || JSON.stringify(res)}`);
    }

    const cameras = res.data || [];
    console.log(`[List] 共获取 ${cameras.length} 个摄像头`);
    return cameras;
  }

  async refreshCamera(cameraId: string): Promise<void> {
    if (!this.token) {
      throw new Error('未获取 Token，请先调用 authenticate()');
    }

    const url = `${this.config.api.base_url}${this.config.api.refresh_endpoint}`;
    const body = {
      camera_ids: [cameraId],
    };

    console.log(`[Refresh] 正在刷新摄像头: ${cameraId}`);
    const res = await this.post<RefreshResponse>(url, body, true);

    if (res.code !== 0 && res.code !== undefined) {
      throw new Error(`刷新失败: ${res.msg || JSON.stringify(res)}`);
    }

    console.log(`[Refresh] 刷新成功: ${cameraId}`);
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
