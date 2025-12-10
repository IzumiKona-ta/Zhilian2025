import React, { useState, useEffect, useRef } from 'react';
import { MOCK_THREATS } from '../utils/constants';
<<<<<<< HEAD
import { AlertTriangle, ShieldX, Eye, ChevronDown, ChevronUp, Wifi, WifiOff, Activity, Loader2, Unlock, List, Trash2, Plus, X } from 'lucide-react';
=======
import { AlertTriangle, ShieldX, Eye, ChevronDown, ChevronUp, Wifi, WifiOff, Activity, Loader2, Unlock } from 'lucide-react';
>>>>>>> f349a90129b9f0c3c78e0577cf408dd8154a9342
import { ThreatEvent, RiskLevel } from '../types';
import { IDSSocket, ThreatService } from '../services/connector';

const ThreatAlerts: React.FC = () => {
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true); 
  const [isLive, setIsLive] = useState(false); 
  const [wsConnected, setWsConnected] = useState(false); // 真实连接状态
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [processingAction, setProcessingAction] = useState<{id: string, type: 'block' | 'resolve' | 'unblock'} | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<IDSSocket | null>(null);

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

                    <button className="px-4 py-2 bg-cyber-800 text-slate-300 border border-cyber-700 rounded hover:bg-cyber-700 flex items-center gap-2 text-sm">
                      <Eye size={16} /> 关联溯源
                    </button>
                  </div>
               </div>
             )}
           </div>
         ))}
       </div>

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
