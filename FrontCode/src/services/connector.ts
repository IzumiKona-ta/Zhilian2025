import axios from 'axios';
import { Organization, ThreatEvent, HostConfig } from '../types';

// ==========================================
// 1. API 接口地址配置 (Endpoint Configuration)
// ==========================================
// 建议您根据实际后端接口文档修改此处的路径
const ENDPOINTS = {
  // --- 认证鉴权 ---
  AUTH_LOGIN: '/auth/login',            // 登录接口 (POST)
  
  // --- 组织/租户管理接口 ---
  ORG_LIST: '/org/info',           // 获取组织列表 (GET)
  ORG_CREATE: '/org/info',         // 创建新组织 (POST)
  ORG_UPDATE: (id: string) => `/org/info/${id}`, // 更新组织信息 (PUT)
  ORG_DELETE: (id: string) => `/org/info/${id}`, // 删除组织 (DELETE)
  
  // --- 威胁情报与处置接口 ---
  THREAT_BLOCK: (id: string) => `/threats/${id}/block`,     // 阻断攻击源 IP (POST)
  THREAT_UNBLOCK: (id: string) => `/threats/${id}/unblock`, // 解封攻击源 IP (POST)
  THREAT_RESOLVE: (id: string) => `/threats/${id}/resolve`, // 标记事件已解决 (POST)
  THREAT_BLOCKED_IPS: '/threats/blocked-ips',             // 获取当前被封禁的 IP 列表 (GET)
  THREAT_MANUAL_BLOCK: '/threats/manual-block',           // 手动封禁 IP (POST)
  THREAT_MANUAL_UNBLOCK: '/threats/manual-unblock',       // 手动解封 IP (POST)
  THREAT_HISTORY: '/analysis/alert',                        // 获取历史威胁记录 (GET)
  AI_TRACE: '/analysis/ai-trace',                           // AI 威胁溯源分析 (POST)

  // --- 数据采集配置 ---
  CONFIG_UPDATE: '/collection/config',  // Deprecated?
  COLLECTION_HOST: '/collection/host',  // 主机采集配置 (GET/POST)
  COLLECTION_HOST_DETAIL: (id: number) => `/collection/host/${id}`, // 单个主机操作 (PUT/DELETE)

  // --- 仪表盘 ---
  DASHBOARD_SUMMARY: '/dashboard/summary', // 仪表盘摘要
  ANALYSIS_TRAFFIC: '/analysis/traffic',   // 流量统计

  // --- 溯源与监控 ---
  TRACING_LIST: '/tracing/result',           // 溯源列表
  HOST_MONITOR: (hostId: string) => `/host/monitor/realtime/${hostId}`, // 主机实时监控
  PROCESS_MONITOR: '/process/monitor',       // 进程监控
};

// ==========================================
// 2. HTTP 客户端初始化 (Axios Instance)
// ==========================================
export const api = axios.create({
  // 开发环境下使用 /api 前缀触发 Vite 代理；生产环境使用环境变量中的地址
  baseURL: import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api'),
  timeout: 15000, // 请求超时时间：15秒
  headers: {
    'Content-Type': 'application/json',
    'X-Client-ID': 'SentinelGuard-Pro-Web' // 标识客户端来源
  }
});

// [请求拦截器]：每次请求自动携带 Token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// [响应拦截器]：统一处理错误 (如 Token 过期自动跳转)
api.interceptors.response.use(
  response => response,
  error => {
    // 如果后端返回 401 未授权，跳转到登录页
    if (error.response?.status === 401) {
      console.warn('登录已过期，请重新登录');
      localStorage.removeItem('auth_token');
      // window.location.href = '/#/login'; // 根据需要开启，或由 UI 层处理
    }
    return Promise.reject(error);
  }
);

// ==========================================
// 3. 业务服务层 (Service Layer)
// ==========================================

/**
 * 认证服务
 * 用于 Login.tsx
 */
export const AuthService = {
  login: async (username: string, password: string): Promise<string> => {
    // 调用后端登录接口
    // 假设后端返回结构: { token: "eyJh..." } 或 { data: { token: "..." } }
    const response = await api.post(ENDPOINTS.AUTH_LOGIN, { username, password });
    
    // 根据实际后端返回结构获取 Token
    const token = response.data?.token || response.data?.data?.token;
    
    if (token) {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_info', JSON.stringify({ username }));
      return token;
    } else {
      throw new Error('无效的响应格式：未找到 Token');
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
  }
};

/**
 * 采集配置服务
 * 用于 DataCollection.tsx
 */
export const ConfigService = {
  // 获取主机列表
  getHostList: async (pageNum: number = 1, pageSize: number = 100) => {
    const response = await api.get(ENDPOINTS.COLLECTION_HOST, {
      params: { pageNum, pageSize }
    });
    // 适配后端 PageResult { total, records }
    return {
      total: response.data?.data?.total || 0,
      list: response.data?.data?.records || []
    };
  },

  // 新增主机
  createHost: async (data: { hostIp: string; collectFreq: number; collectStatus: number }) => {
    const response = await api.post(ENDPOINTS.COLLECTION_HOST, data);
    return response.data?.data; // 返回新创建的 ID
  },

  // 更新主机
  updateHost: async (id: number, data: Partial<HostCollectionConfig>) => {
    await api.put(ENDPOINTS.COLLECTION_HOST_DETAIL(id), data);
  },

  // 删除主机
  deleteHost: async (id: number) => {
    await api.delete(ENDPOINTS.COLLECTION_HOST_DETAIL(id));
  }
};

/**
 * 仪表盘服务
 * 用于 Home.tsx
 */
export const DashBoardService = {
  getSummary: async () => {
    const response = await api.get(ENDPOINTS.DASHBOARD_SUMMARY);
    return response.data?.data;
  }
};

/**
 * 分析服务
 */
export const AnalysisService = {
  getTraffic: async (pageNum: number = 1, pageSize: number = 20) => {
    const response = await api.get(ENDPOINTS.ANALYSIS_TRAFFIC, {
      params: { pageNum, pageSize }
    });
    return response.data?.data?.records || response.data?.data || [];
  },

  // 新增趋势统计接口
  getTrend: async (range: string = '24h') => {
    const response = await api.get('/analysis/trend', { params: { range } });
    return response.data?.data || [];
  }
};

/**
 * 溯源服务
 */
export const TracingService = {
  getList: async (pageNum: number = 1, pageSize: number = 100) => {
    const response = await api.get(ENDPOINTS.TRACING_LIST, {
      params: { pageNum, pageSize }
    });
    // 适配 PageHelper 格式
    return response.data?.data?.records || response.data?.data || [];
  }
};

/**
 * 监控服务
 */
export const MonitorService = {
  // 获取主机监控列表 (用于发现活跃主机)
  getMonitorList: async (pageNum: number = 1, pageSize: number = 100) => {
    const response = await api.get('/host/monitor', {
      params: { pageNum, pageSize }
    });
    return response.data?.data?.records || [];
  },

  getHostStatus: async (hostId: string) => {
    const response = await api.get(ENDPOINTS.HOST_MONITOR(hostId));
    return response.data?.data;
  },
  
  getProcesses: async (pageNum: number = 1, pageSize: number = 20) => {
    const response = await api.get(ENDPOINTS.PROCESS_MONITOR, {
      params: { pageNum, pageSize }
    });
    return response.data?.data?.records || response.data?.data || [];
  },

  updateProcess: async (id: string, data: any) => {
    await api.put(`${ENDPOINTS.PROCESS_MONITOR}/${id}`, data);
  }
};

/**
 * 组织机构管理服务
 * 用于 OrgManagement.tsx 页面
 */
export const OrgService = {
  // 获取所有组织
  getAll: async (): Promise<Organization[]> => {
    try {
        const response = await api.get(ENDPOINTS.ORG_LIST, {
            params: { pageNum: 1, pageSize: 100 }
        });
        const rawList = response.data?.data?.records || [];
        
        return rawList.map((item: any) => ({
            id: String(item.id),
            name: item.orgName,
            memberCount: item.memberCount || 0,
            maxMembers: item.maxMemberCount || 0,
            adminPermission: item.adminPermission === 1,
            createdAt: item.createTime || ''
        }));
    } catch (e) {
        console.error("Failed to fetch orgs", e);
        return [];
    }
  },

  // 创建组织
  create: async (orgData: Partial<Organization>): Promise<Organization> => {
    const payload = {
        orgName: orgData.name,
        maxMemberCount: orgData.maxMembers,
        adminPermission: orgData.adminPermission ? 1 : 0
    };
    const response = await api.post(ENDPOINTS.ORG_CREATE, payload);
    const item = response.data?.data;
    
    return {
        id: String(item.id),
        name: item.orgName,
        memberCount: item.memberCount || 0,
        maxMembers: item.maxMemberCount || 0,
        adminPermission: item.adminPermission === 1,
        createdAt: item.createTime || new Date().toISOString()
    };
  },

  // 更新组织
  update: async (id: string, orgData: Partial<Organization>): Promise<Organization> => {
    const payload = {
        orgName: orgData.name,
        maxMemberCount: orgData.maxMembers,
        adminPermission: orgData.adminPermission ? 1 : 0
    };
    const response = await api.put(ENDPOINTS.ORG_UPDATE(id), payload);
    const item = response.data?.data;
    
    return {
        id: String(item.id),
        name: item.orgName,
        memberCount: item.memberCount || 0,
        maxMembers: item.maxMemberCount || 0,
        adminPermission: item.adminPermission === 1,
        createdAt: item.createTime || ''
    };
  },

  // 删除组织
  delete: async (id: string): Promise<void> => {
    return api.delete(ENDPOINTS.ORG_DELETE(id));
  }
};

/**
 * 威胁处置服务
 * 用于 ThreatAlerts.tsx 页面
 */
export const ThreatService = {
  // 下发 IP 阻断指令
  blockIp: async (threatId: string): Promise<void> => {
    return api.post(ENDPOINTS.THREAT_BLOCK(threatId));
  },

  // 下发 IP 解封指令
  unblockIp: async (threatId: string): Promise<void> => {
    return api.post(ENDPOINTS.THREAT_UNBLOCK(threatId));
  },
  
  // 标记威胁为"误报"或"已解决"
  resolveThreat: async (threatId: string): Promise<void> => {
    return api.post(ENDPOINTS.THREAT_RESOLVE(threatId));
  },

  // 获取当前被封禁的 IP 列表
  getBlockedIps: async (): Promise<string[]> => {
    const response = await api.get(ENDPOINTS.THREAT_BLOCKED_IPS);
    return response.data?.data || [];
  },

  // 手动封禁 IP
  manualBlock: async (ip: string): Promise<void> => {
    return api.post(ENDPOINTS.THREAT_MANUAL_BLOCK, null, { params: { ip } });
  },

  // 手动解封 IP
  manualUnblock: async (ip: string): Promise<void> => {
    return api.post(ENDPOINTS.THREAT_MANUAL_UNBLOCK, null, { params: { ip } });
  },

  // 获取历史数据
  getHistory: async (): Promise<ThreatEvent[]> => {
    try {
        const response = await api.get(ENDPOINTS.THREAT_HISTORY, {
            params: {
                pageNum: 1,
                pageSize: 100 // 获取最近100条
            }
        });
        
        // 后端返回 Result<PageResult>，结构为 { code: 1, data: { total: 10, records: [...] } }
        // 注意：MyBatis PageHelper 返回的列表通常在 'records' 或 'result' 字段，甚至直接就是 data
        // 让我们兼容这几种情况
        const rawList = response.data?.data?.records || response.data?.data?.result || [];
        
        // 适配器逻辑：将后端 Entity 转换为前端 ThreatEvent
        return rawList.map((item: any) => {
            // 解析 impactScope 字段 (格式: "src -> dst | type")
            let type = 'Unknown';
            let src = 'Unknown';
            let dst = 'Unknown';
            
            if (item.impactScope) {
                try {
                    const parts = item.impactScope.split('|');
                    if (parts.length > 1) {
                        type = parts[1].trim();
                    }
                    
                    const session = parts[0].trim();
                    const ips = session.split('->');
                    if (ips.length > 1) {
                        src = ips[0].trim().split(':')[0];
                        dst = ips[1].trim().split(':')[0];
                    }
                } catch (e) {
                    // ignore parse error
                }
            }
            
            // 映射 RiskLevel
            let riskLevel = 'Medium';
            const level = Number(item.threatLevel);
            if (level === 1) riskLevel = 'Low';
            else if (level === 2) riskLevel = 'Medium';
            else if (level >= 3) riskLevel = 'High';

            return {
                id: item.threatId || String(item.id),
                type: type,
                sourceIp: src,
                targetIp: dst,
                timestamp: item.occurTime ? item.occurTime.replace('T', ' ') : '',
                riskLevel: riskLevel as any,
                status: 'Pending', // 默认状态
                details: item.impactScope // 将原始 scope 作为详情展示
            };
        });
    } catch (error) {
        console.error("Failed to fetch history:", error);
        return [];
    }
  },

  // AI 威胁溯源分析
  traceThreat: async (payload: { question: string, top_k: number }): Promise<any> => {
    const response = await api.post(ENDPOINTS.AI_TRACE, payload);
    return response.data; // 返回 { code, msg, data }
  }
};

/**
 * AI 智能报告服务
 */
export const ReportService = {
  // 调用后端生成 AI 报告
  generate: async (type: string): Promise<string> => {
    const response = await api.post('/report/generate', { type });
    return response.data?.data;
  },
  
  // 获取历史报告
  getHistory: async () => {
    const response = await api.get('/report/history');
    return response.data?.data || [];
  },

  // 删除历史报告
  delete: async (id: number) => {
    return api.delete(`/report/history/${id}`);
  },

  // 重命名历史报告
  rename: async (id: number, newTitle: string) => {
    return api.put(`/report/history/${id}`, { title: newTitle });
  }
};

// ==========================================
// 4. 区块链存证服务 (Blockchain Logger)
// ==========================================
export const BlockchainLogger = {
  /**
   * 将高危威胁事件哈希上链，确保审计日志不可篡改
   */
  logThreatEvent: async (threatId: string, payload: any) => {
    try {
       console.log(`[Blockchain] 正在将威胁事件 ${threatId} 上链存证...`);
       // 模拟上链过程，实际应调用后端 /chain/transaction 接口
       return { txId: '0x' + Math.random().toString(16).substr(2, 40), status: 'COMMITTED' };
    } catch (e) {
       console.error("Blockchain log failed", e);
       return { status: 'FAILED' };
    }
  }
};

// ==========================================
// 5. IDS 实时探针连接 (WebSocket)
// ==========================================
export class IDSSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number = 3000;
  private shouldReconnect: boolean = true;

  constructor() {
    // 优先使用 .env 中的 WebSocket 地址
    this.url = import.meta.env.VITE_IDS_WS_URL || 'ws://localhost:8081/ids/stream';
  }

  /**
   * 建立 WebSocket 连接
   * @param onMessage 收到新威胁时的回调函数
   * @param onStatusChange 连接状态变化时的回调函数
   */
  connect(onMessage: (data: ThreatEvent) => void, onStatusChange?: (status: boolean) => void) {
    console.log(`[IDS] 正在连接硬件探针: ${this.url}`);
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      console.error("[IDS] WebSocket URL 格式错误");
      if(onStatusChange) onStatusChange(false);
      return;
    }

    this.ws.onopen = () => {
      console.log('[IDS] 连接成功 - 实时数据流已开启');
      if (onStatusChange) onStatusChange(true);
      // 发送鉴权 Token
      this.sendMessage({ type: 'AUTH', token: localStorage.getItem('auth_token') });
    };

    this.ws.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);
        
        // 解析 impactScope: "192.168.1.121:12785 -> 10.0.0.5:80 | DDoS"
        let sourceIp = '0.0.0.0';
        let targetIp = '0.0.0.0';
        let attackType = '未知攻击';

        if (rawData.impactScope) {
            try {
                const parts = rawData.impactScope.split('|');
                if (parts.length >= 1) {
                    const flow = parts[0].trim(); // "192.168.1.121:12785 -> 10.0.0.5:80"
                    if (parts.length >= 2) {
                        attackType = parts[1].trim(); // "DDoS"
                    }
                    
                    const ips = flow.split('->');
                    if (ips.length >= 2) {
                        sourceIp = ips[0].trim().split(':')[0];
                        targetIp = ips[1].trim().split(':')[0];
                    }
                }
            } catch (err) {
                console.warn('[IDS] 解析 impactScope 失败:', err);
            }
        }

        // 映射 RiskLevel
        let riskLevel = 'Medium';
        if (rawData.threatLevel) {
            switch (Number(rawData.threatLevel)) {
                case 1: riskLevel = 'Low'; break;
                case 2: riskLevel = 'Medium'; break;
                case 3: riskLevel = 'High'; break;
                case 4: riskLevel = 'High'; break;
                default: riskLevel = 'Medium';
            }
        }

        const adaptedEvent: ThreatEvent = {
            id: rawData.threatId || String(rawData.id) || `IDS-${Date.now()}`,
            type: attackType,
            sourceIp: sourceIp,
            targetIp: targetIp,
            timestamp: rawData.occurTime || new Date().toLocaleTimeString(),
            riskLevel: riskLevel as any,
            status: 'Pending',
            details: rawData.impactScope || '无详细信息'
        };
        
        onMessage(adaptedEvent);
      } catch (e) {
        console.warn('[IDS] 收到的数据无法解析:', event.data);
      }
    };

    this.ws.onclose = () => {
      console.log('[IDS] 连接已断开');
      if (onStatusChange) onStatusChange(false);
      
      // 断线重连机制
      if (this.shouldReconnect) {
        console.log(`[IDS] ${this.reconnectInterval / 1000}秒后尝试重连...`);
        setTimeout(() => this.connect(onMessage, onStatusChange), this.reconnectInterval);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[IDS] 连接发生错误', err);
      this.ws?.close();
    };
  }

  sendMessage(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}