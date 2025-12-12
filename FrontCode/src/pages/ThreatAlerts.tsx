import React, { useState, useEffect, useRef } from 'react';
import { MOCK_THREATS } from '../utils/constants';
import { AlertTriangle, ShieldX, Eye, ChevronDown, ChevronUp, Wifi, WifiOff, Activity, Loader2, Unlock, List, Trash2, Plus, X, Brain, Send, Sparkles } from 'lucide-react';
import { ThreatEvent, RiskLevel } from '../types';
import { IDSSocket, ThreatService } from '../services/connector';

// 威胁溯源分析弹窗组件
interface TraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  threat: ThreatEvent | null;
  loading: boolean;
  result: string | null;
  formatThreatToLog: (threat: ThreatEvent) => string;
}

const TraceModal: React.FC<TraceModalProps> = ({ isOpen, onClose, threat, loading, result, formatThreatToLog }) => {
  if (!isOpen || !threat) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-cyber-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/20 overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-cyber-700 bg-gradient-to-r from-purple-500/10 to-blue-500/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Sparkles size={24} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Adv-SecGPT 安全威胁溯源分析
              </h3>
              <p className="text-sm text-slate-400">AI 驱动的智能威胁分析引擎</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-cyber-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 威胁信息摘要 */}
          <div className="bg-cyber-800/50 border border-cyber-700 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">威胁信息</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">攻击类型：</span>
                <span className="text-red-400 font-bold ml-2">{threat.type}</span>
              </div>
              <div>
                <span className="text-slate-500">风险等级：</span>
                <span className={`ml-2 font-bold ${
                  threat.riskLevel === 'High' ? 'text-red-400' : 
                  threat.riskLevel === 'Medium' ? 'text-orange-400' : 'text-blue-400'
                }`}>{threat.riskLevel}</span>
              </div>
              <div>
                <span className="text-slate-500">源 IP：</span>
                <span className="text-slate-300 font-mono ml-2">{threat.sourceIp}</span>
              </div>
              <div>
                <span className="text-slate-500">目标 IP：</span>
                <span className="text-slate-300 font-mono ml-2">{threat.targetIp}</span>
              </div>
            </div>
          </div>
          
          {/* 发送的日志格式 */}
          <div className="bg-cyber-800/50 border border-cyber-700 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
              <Send size={14} /> 发送至智能体的日志格式
            </h4>
            <pre className="text-xs text-emerald-400 bg-black/30 p-3 rounded-lg overflow-x-auto font-mono">
              {formatThreatToLog(threat)}
            </pre>
          </div>
          
          {/* 分析结果 */}
          <div className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20 rounded-xl p-4">
            <h4 className="text-xs font-bold text-purple-400 uppercase mb-3 flex items-center gap-2">
              <Brain size={14} /> Adv-SecGPT 分析结果
            </h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                    <Brain size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-400" />
                  </div>
                  <p className="text-slate-400 text-sm">正在分析威胁数据...</p>
                </div>
              </div>
            ) : result ? (
              <div className="prose prose-invert max-w-none">
                <pre className="text-sm text-slate-300 bg-black/20 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {result}
                </pre>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">等待分析结果...</p>
            )}
          </div>
        </div>
        
        {/* 底部 */}
        <div className="px-6 py-4 border-t border-cyber-700 bg-cyber-800/50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-cyber-700 text-slate-300 border border-cyber-600 rounded-lg hover:bg-cyber-600 transition-colors font-bold"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

const ThreatAlerts: React.FC = () => {
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true); 
  const [isLive, setIsLive] = useState(false); 
  const [wsConnected, setWsConnected] = useState(false); // 真实连接状态
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [processingAction, setProcessingAction] = useState<{id: string, type: 'block' | 'resolve' | 'unblock'} | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<IDSSocket | null>(null);

  // 安全威胁溯源状态
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceResult, setTraceResult] = useState<string | null>(null);
  const [currentThreat, setCurrentThreat] = useState<ThreatEvent | null>(null);

  // --- Firewall Blacklist State ---
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [newBlockIp, setNewBlockIp] = useState('');
  const [blacklistLoading, setBlacklistLoading] = useState(false);

  // Fetch blocked IPs
  const fetchBlockedIps = async () => {
    setBlacklistLoading(true);
    try {
        const ips = await ThreatService.getBlockedIps();
        setBlockedIps(ips);
    } catch (error) {
        console.error("Failed to fetch blocked IPs", error);
        alert("获取黑名单失败");
    } finally {
        setBlacklistLoading(false);
    }
  };

  useEffect(() => {
    if (showBlacklist) {
        fetchBlockedIps();
    }
  }, [showBlacklist]);

  const handleManualBlockSubmit = async () => {
    if (!newBlockIp) return;
    setBlacklistLoading(true); 
    try {
        await ThreatService.manualBlock(newBlockIp);
        const currentIp = newBlockIp; // Capture current value
        setNewBlockIp('');
        
        // 轮询检查是否生效 (最多尝试 5 次，每次间隔 1 秒)
        let attempts = 0;
        const checkInterval = setInterval(async () => {
            attempts++;
            try {
                const ips = await ThreatService.getBlockedIps();
                // 如果新IP已出现在列表中，或者是最后一次尝试
                if (ips.includes(currentIp) || attempts >= 5) {
                    setBlockedIps(ips);
                    setBlacklistLoading(false);
                    clearInterval(checkInterval);
                }
            } catch (e) {
                // Ignore transient errors during polling
            }
        }, 1000);
        
    } catch (error) {
        console.error("Manual block failed", error);
        alert("添加黑名单失败");
        setBlacklistLoading(false);
    }
  };

  const handleManualUnblockSubmit = async (ip: string) => {
    if (!window.confirm(`确定要解封 IP ${ip} 吗？`)) return;
    setBlacklistLoading(true); // 立即显示加载状态
    try {
        await ThreatService.manualUnblock(ip);
        
        // 轮询检查是否生效
        let attempts = 0;
        const checkInterval = setInterval(async () => {
            attempts++;
            const ips = await ThreatService.getBlockedIps();
            // 如果IP已消失，或者是最后一次尝试
            if (!ips.includes(ip) || attempts >= 5) {
                setBlockedIps(ips);
                setBlacklistLoading(false);
                clearInterval(checkInterval);
            }
        }, 1000);

    } catch (error) {
        console.error("Manual unblock failed", error);
        alert("解封失败");
        setBlacklistLoading(false);
    }
  };


  // 1. 初始化: 加载历史数据
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await ThreatService.getHistory();
        setThreats(data);
      } catch (err) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setThreats(MOCK_THREATS);
      }
      setLoading(false);
    };
    fetchHistory();
  }, []);

  // 2. 实时监控: 使用 IDSSocket 连接
  useEffect(() => {
    // 强制自动连接
    if (!socketRef.current) {
      socketRef.current = new IDSSocket();
    }

    socketRef.current.connect(
      (newThreat: ThreatEvent) => {
        // 收到新威胁
        setThreats(prev => [newThreat, ...prev]);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      },
      (status: boolean) => {
        setWsConnected(status);
        // 如果连接成功，自动视为 "Live" 状态
        if (status) setIsLive(true);
      }
    );

    // 清理函数：组件卸载时断开
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // 只在组件挂载时执行一次

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleBlock = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingAction({ id, type: 'block' });
    
    try {
      // 真实调用后端接口
      await ThreatService.blockIp(id);
      
      setThreats(prev => prev.map(t => t.id === id ? { ...t, status: 'Blocked' } : t));
    } catch (error) {
      console.error("Block failed", error);
      alert("阻断指令下发失败，请检查后端日志");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleUnblock = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingAction({ id, type: 'unblock' });
    
    try {
      await ThreatService.unblockIp(id);
      // 解封后状态回退为 Pending，或者可以标记为 "Resolved" 或其他状态，这里暂且回退为 Pending 以便再次操作
      setThreats(prev => prev.map(t => t.id === id ? { ...t, status: 'Pending' } : t));
    } catch (error) {
      console.error("Unblock failed", error);
      alert("解封指令下发失败，请检查后端日志");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingAction({ id, type: 'resolve' });
    
    // 真实场景：调用 API 标记解决
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setThreats(prev => prev.map(t => t.id === id ? { ...t, status: 'Resolved' } : t));
    setProcessingAction(null);
  };

  // 将威胁数据转换为日志格式
  const formatThreatToLog = (threat: ThreatEvent): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(/ /g, '/');
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
    const timezone = '+0800';
    
    // 根据攻击类型生成对应的请求路径（不使用 encodeURIComponent，保持可读性）
    let requestPath = '/index.html';
    let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    
    switch (threat.type.toLowerCase()) {
      case 'ddos':
        requestPath = '/api/stress?flood=AAAAAAA...';
        userAgent = 'DDoS-Bot/1.0';
        break;
      case 'bot':
        requestPath = "/admin/login.php?user=admin&pass=' OR '1'='1";
        userAgent = 'BotNet-Scanner/2.0';
        break;
      case 'sql injection':
      case 'sqli':
        requestPath = '/product.php?id=1 AND (SELECT 55 FROM (SELECT(SLEEP(5)))a)';
        userAgent = 'Mozilla/5.0 (SQLTester)';
        break;
      case 'dos_hulk':
      case 'hulk':
        requestPath = '/search?q=HULK_ATTACK_PAYLOAD';
        userAgent = 'HULK-DoS/1.0';
        break;
      case 'portscan':
      case 'port scan':
        requestPath = `/scan?ports=1-65535&target=${threat.targetIp}`;
        userAgent = 'Nmap-Scanner/7.0';
        break;
      case 'web attack':
        requestPath = '/api/exec?cmd=echo d2hvYW1p | base64 -d | sh';
        userAgent = 'Python/3.8';
        break;
      default:
        requestPath = `/attack?type=${threat.type}`;
        userAgent = `AttackTool/${threat.type}`;
    }
    
    return `${threat.sourceIp} - - [${dateStr}:${timeStr} ${timezone}] "GET ${requestPath} HTTP/1.1" 200 450 "-" "${userAgent}"`;
  };

  // 调用 Adv-SecGPT 智能体进行威胁溯源分析
  const handleThreatTrace = async (threat: ThreatEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentThreat(threat);
    setTraceModalOpen(true);
    setTraceLoading(true);
    setTraceResult(null);
    
    try {
      const logFormat = formatThreatToLog(threat);
      console.log('发送日志格式:', logFormat);
      
      // 通过后端代理调用智能体，避免跨域问题
      const response = await fetch('http://localhost:8081/api/analysis/ai-trace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: `分析日志：${logFormat}`,
          top_k: 3
        })
      });
      
      console.log('响应状态:', response.status, response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('响应错误:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('后端返回结果:', result);
      
      // 后端返回格式是 { code, msg, data }，智能体响应在 data 中
      if (result.code === 1 && result.data) {
        const answer = result.data.answer || result.data.response || JSON.stringify(result.data, null, 2);
        console.log('设置分析结果:', answer);
        setTraceResult(answer);
      } else {
        console.error('分析失败，code:', result.code, 'msg:', result.msg);
        setTraceResult(result.msg || '分析失败，请查看控制台');
      }
    } catch (error) {
      console.error('威胁溯源分析失败:', error);
      setTraceResult(`分析请求失败: ${error instanceof Error ? error.message : '未知错误'}\n\n请确保:\n1. 后端服务正在运行 (http://127.0.0.1:8081)\n2. Adv-SecGPT 智能体服务正在运行 (http://10.138.50.151:8000)`);
    } finally {
      setTraceLoading(false);
    }
  };

  const getRiskLabel = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.HIGH: return '高风险';
      case RiskLevel.MEDIUM: return '中风险';
      case RiskLevel.LOW: return '低风险';
      default: return level;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending': return '处理中';
      case 'Blocked': return '已阻断';
      case 'Resolved': return '已解决';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
       {/* 头部控制栏 */}
       <div className="flex justify-between items-center shrink-0">
         <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             潜在威胁预警 
             {wsConnected && <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
             </span>}
           </h2>
           <p className="text-slate-400 text-sm mt-1">IDS 实时入侵检测日志流</p>
         </div>
         
         <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowBlacklist(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-all"
            >
              <List size={14} /> 防火墙黑名单
            </button>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              wsConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {wsConnected ? <Wifi size={14} className="animate-pulse" /> : <WifiOff size={14} />}
              {wsConnected ? 'IDS_LINK_ACTIVE' : 'IDS_LINK_DOWN'}
            </div>

            <button 
              disabled={true} // 按钮不再具有交互功能，仅作为状态展示
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-lg cursor-default opacity-80 ${
                 wsConnected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
              }`}
            >
              {wsConnected ? (
                <> <Activity size={18} className="animate-pulse" /> 实时监控中 </>
              ) : (
                <> <Loader2 size={18} className="animate-spin" /> 连接中... </>
              )}
            </button>
         </div>
       </div>
       
       {/* 列表区域 */}
       <div 
         ref={scrollContainerRef}
         className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar relative min-h-[400px]"
       >
         {/* Loading Skeleton */}
         {loading && (
           <div className="space-y-4 animate-pulse">
             {[1, 2, 3, 4, 5].map(i => (
               <div key={i} className="bg-cyber-800/50 border border-cyber-700/50 rounded-xl h-24 w-full"></div>
             ))}
           </div>
         )}

         {!loading && threats.length === 0 && (
           <div className="h-full flex flex-col items-center justify-center text-slate-500">
             <ShieldX size={48} className="mb-4 opacity-20" />
             <p>暂无威胁记录</p>
           </div>
         )}

         {/* Threat List */}
         {!loading && threats.map(threat => (
           <div key={threat.id} className={`bg-cyber-800 border ${
             threat.riskLevel === RiskLevel.HIGH ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 
             threat.riskLevel === RiskLevel.MEDIUM ? 'border-orange-500/50' : 'border-cyber-700'
           } rounded-xl overflow-hidden transition-all duration-300 animate-slide-up`}>
             
             {/* Header */}
             <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-cyber-700/50 relative overflow-hidden"
                onClick={() => toggleExpand(threat.id)}
             >
                {/* 新增的高亮动画条，如果是刚刚生成的实时数据 (IDS前缀) */}
                {threat.id.startsWith('IDS-') && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/10 to-transparent pointer-events-none"></div>
                )}

                <div className="flex items-center gap-4">
                   <div className={`w-1.5 h-12 rounded-full ${
                     threat.riskLevel === RiskLevel.HIGH ? 'bg-red-500' : 
                     threat.riskLevel === RiskLevel.MEDIUM ? 'bg-orange-500' : 'bg-blue-500'
                   }`} />
                   <div>
                     <div className="flex items-center gap-3">
                       <h3 className="font-bold text-white">{threat.type}</h3>
                       {threat.id.startsWith('IDS-') && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded animate-pulse">LIVE</span>}
                       <span className={`text-xs px-2 py-0.5 rounded border ${
                         threat.riskLevel === RiskLevel.HIGH ? 'bg-red-500/10 text-red-400 border-red-500/30' : 
                         threat.riskLevel === RiskLevel.MEDIUM ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                       }`}>
                         {getRiskLabel(threat.riskLevel)}
                       </span>
                     </div>
                     <p className="text-sm text-slate-400 mt-1 flex gap-2">
                       <span className="font-mono text-slate-300 bg-black/20 px-1 rounded">{threat.sourceIp}</span> 
                       <span className="text-slate-600">&rarr;</span> 
                       <span className="font-mono text-slate-300 bg-black/20 px-1 rounded">{threat.targetIp}</span>
                     </p>
                   </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500 font-mono">{threat.timestamp}</span>
                  {expandedId === threat.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </div>
             </div>

             {/* Details Drawer */}
             {expandedId === threat.id && (
               <div className="px-16 pb-6 pt-2 border-t border-cyber-700/50 bg-cyber-900/30 backdrop-blur-sm">
                  <div className="grid grid-cols-3 gap-6 mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase">威胁 ID</h4>
                      <p className="font-mono text-sm text-slate-300">{threat.id}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase">捕获时间</h4>
                      <p className="font-mono text-sm text-cyber-accent">{threat.timestamp}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase">处置状态</h4>
                      <p className={`text-sm font-bold flex items-center gap-2 ${threat.status === 'Blocked' ? 'text-red-400' : threat.status === 'Resolved' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {getStatusLabel(threat.status)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Payload / 详细日志</h4>
                    <p className="text-sm text-slate-300 bg-cyber-950 p-3 rounded border border-cyber-700 font-mono break-all">
                      {threat.details}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    {threat.status === 'Pending' && (
                      <>
                        <button 
                          onClick={(e) => handleBlock(threat.id, e)}
                          disabled={processingAction?.id === threat.id}
                          className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 flex items-center gap-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {processingAction?.id === threat.id && processingAction.type === 'block' ? (
                            <Loader2 size={16} className="animate-spin" /> 
                          ) : (
                            <ShieldX size={16} />
                          )}
                          {processingAction?.id === threat.id && processingAction.type === 'block' ? '下发策略...' : '立即阻断'}
                        </button>
                        
                        <button 
                          onClick={(e) => handleResolve(threat.id, e)}
                          disabled={processingAction?.id === threat.id}
                          className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded hover:bg-emerald-500/30 flex items-center gap-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {processingAction?.id === threat.id && processingAction.type === 'resolve' ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                           {processingAction?.id === threat.id && processingAction.type === 'resolve' ? '归档中...' : '标记误报'}
                        </button>
                      </>
                    )}

                    {threat.status === 'Blocked' && (
                      <button 
                        onClick={(e) => handleUnblock(threat.id, e)}
                        disabled={processingAction?.id === threat.id}
                        className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded hover:bg-emerald-500/30 flex items-center gap-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {processingAction?.id === threat.id && processingAction.type === 'unblock' ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Unlock size={16} />
                        )}
                        {processingAction?.id === threat.id && processingAction.type === 'unblock' ? '正在解封...' : '解除封禁'}
                      </button>
                    )}

                    <button 
                      onClick={(e) => handleThreatTrace(threat, e)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border border-purple-500/50 rounded hover:from-purple-500/30 hover:to-blue-500/30 flex items-center gap-2 text-sm font-bold transition-all"
                    >
                      <Brain size={16} /> 安全威胁溯源
                    </button>
                  </div>
               </div>
             )}
           </div>
         ))}
       </div>

       {/* 威胁溯源分析弹窗 */}
       <TraceModal 
         isOpen={traceModalOpen}
         onClose={() => setTraceModalOpen(false)}
         threat={currentThreat}
         loading={traceLoading}
         result={traceResult}
         formatThreatToLog={formatThreatToLog}
       />

       {/* Blacklist Management Modal */}
       {showBlacklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-cyber-900 border border-cyber-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-cyber-700 flex items-center justify-between bg-cyber-800/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <ShieldX size={20} className="text-red-500" />
                        防火墙黑名单管理
                    </h3>
                    <button onClick={() => setShowBlacklist(false)} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 border-b border-cyber-700 bg-cyber-900/50">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="输入 IP 地址 (e.g. 192.168.1.100)" 
                            className="flex-1 bg-cyber-950 border border-cyber-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            value={newBlockIp}
                            onChange={(e) => setNewBlockIp(e.target.value)}
                        />
                        <button 
                            onClick={handleManualBlockSubmit}
                            disabled={!newBlockIp}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} /> 添加封禁
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {blacklistLoading ? (
                        <div className="flex justify-center py-8 text-slate-500">
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    ) : blockedIps.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            暂无封禁 IP
                        </div>
                    ) : (
                        blockedIps.map((ip, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-cyber-800 rounded border border-cyber-700 hover:border-cyber-600 transition-colors">
                                <span className="font-mono text-slate-200">{ip}</span>
                                <button 
                                    onClick={() => handleManualUnblockSubmit(ip)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                    title="解除封禁"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="p-3 bg-cyber-800/30 border-t border-cyber-700 text-xs text-slate-500 text-center">
                    共 {blockedIps.length} 个被封禁 IP
                </div>
            </div>
        </div>
       )}
    </div>
  );
};

export default ThreatAlerts;
