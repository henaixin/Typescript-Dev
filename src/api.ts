import { AppConfig } from './config';

export interface AuthResponse {
  accessToken?: string;
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

export interface RefreshResult {
  id?: number;
  // [cameraId: string]: number;
}

export class CameraApi {
  private config: AppConfig;
  private token: string | null = null;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private buildHeaders(auth = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (auth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async get<T>(url: string, auth = false): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as T;
  }

  private async post<T>(url: string, body: unknown, auth = false): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(auth),
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

    let token = res.accessToken || res.data?.token;
    if (!token) {
      throw new Error('认证接口未返回 token');
    }

    if (token.startsWith('userToken=')) {
         this.token = token;
         console.log('[Auth] Token 获取成功');
      // token = token.slice('userToken='.length);
    }else{
      throw new Error('认证接口返回的 token 格式错误');
    }

 
  }

  async getCameraList(): Promise<CameraItem[]> {
    if (!this.token) {
      throw new Error('未获取 Token，请先调用 authenticate()');
    }

    const pageSize = this.config.refresh.total_count;
    const allCameras: CameraItem[] = [];
    let current = 1;
    let total = 0;

    console.log('[List] 正在获取摄像头列表...');

    do {
      const params = new URLSearchParams({
        current: String(current),
        page_size: String(pageSize),
      });
      const url = `${this.config.api.base_url}${this.config.api.list_endpoint}?${params.toString()}`;

      const res = await this.get<CameraListResponse>(url, true);

      if (res.code !== 0 && res.code !== undefined) {
        throw new Error(`获取列表失败: ${res.msg || JSON.stringify(res)}`);
      }

      const pageData = res.data || [];
      allCameras.push(...pageData);

      if (total === 0) {
        total = res.total || 0;
      }

      if (pageData.length === 0 || pageData.length < pageSize) {
        break;
      }

      current++;
    } while (allCameras.length < total);

    console.log(`[List] 共获取 ${allCameras.length} 个摄像头 (total: ${total})`);
    return allCameras;
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
    const res = await this.post<RefreshResult[]>(url, body, true);
    const status = res;
    if (status === undefined) {
      console.warn(`[Refresh] 刷新返回异常: ${JSON.stringify(res)}`);
    } else {
      console.log(`[Refresh] 刷新成功: ${cameraId}, 状态: ${status}`);
    }
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
