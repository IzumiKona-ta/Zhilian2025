import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Server, Activity, Disc, Cpu, Network, Wifi, AlertOctagon, HardDrive, FileSearch, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MonitorService, ConfigService } from '../services/connector';

const HostMonitoring: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [hostId, setHostId] = useState('');
  const [hosts, setHosts] = useState<any[]>([]);
  
  // 连接状态: 'connected' | 'unstable' | 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'unstable' | 'disconnected'>('disconnected');
  const [latency, setLatency] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load hosts (Configured + Active)
  useEffect(() => {
    const fetchHosts = async () => {
      try {
        const allHostsMap = new Map<string, any>();

        // 1. Get Configured Hosts
        try {
          const configRes = await ConfigService.getHostList(1, 100);
          if (configRes.list) {
            configRes.list.forEach((h: any) => {
              // Ensure we handle potential missing fields gracefully
              if (h.hostIp) {
                allHostsMap.set(h.hostIp, { id: h.id, hostIp: h.hostIp, source: 'config' });
              }
            });
          }
        } catch (e) {
          console.error("Failed to load config hosts", e);
        }

        // 2. Get Active Hosts (reporting data)
        try {
          // Fetch recent monitor records to find active hosts
          const monitorRes = await MonitorService.getMonitorList(1, 100);
          if (monitorRes) {
            monitorRes.forEach((h: any) => {
               // h.hostId is the IP in the monitor data
               if (h.hostId && !allHostsMap.has(h.hostId)) {
                 allHostsMap.set(h.hostId, { id: `auto-${h.hostId}`, hostIp: h.hostId, source: 'active' });
               }
            });
          }
        } catch (e) {
           console.error("Failed to load active hosts", e);
        }

        const combinedHosts = Array.from(allHostsMap.values());
        setHosts(combinedHosts);

        // Default to first host if not set
        if (!hostId && combinedHosts.length > 0) {
           setHostId(combinedHosts[0].hostIp);
        }
      } catch (e) {
        console.error("Failed to load hosts", e);
      }
    };
    fetchHosts();
  }, []);

  // 用于保持数据点数量
  const MAX_DATA_POINTS = 30;

  // 数据流更新 (轮询后端)
  useEffect(() => {
    if (!hostId) return;

    // 清空现有数据当切换主机时
    setData([]);
    setLoading(true);

    const fetchHostData = async () => {
      const startTime = Date.now();
      try {
        const serverData = await MonitorService.getHostStatus(hostId);
        const endTime = Date.now();
        setLatency(endTime - startTime);
        
        if (serverData) {
          setConnectionStatus('connected');
          setData(prev => {
            const newPoint = {
              time: prev.length > 0 ? prev[prev.length - 1].time + 1 : 0,
              cpu: serverData.cpuUsage || 0,
              memory: serverData.memoryUsage || 0,
              net: serverData.networkConn || 0, // 使用 networkConn 作为网络指标，或者是连接数
              diskUsage: serverData.diskUsage || 0,
              diskInfo: serverData.diskInfo || '0 GB / 0 GB',
              fileStatus: serverData.fileStatus ? JSON.parse(serverData.fileStatus) : [],
              timestamp: serverData.monitorTime
            };
            
            const newData = [...prev, newPoint];
            if (newData.length > MAX_DATA_POINTS) {
              return newData.slice(newData.length - MAX_DATA_POINTS);
            }
            return newData;
          });
        } else {
            // No data for this host yet
            setConnectionStatus('disconnected');
        }
      } catch (err: any) {
        console.error("Failed to fetch host data:", err);
        setConnectionStatus('disconnected');
        // 只有在完全连接失败时才认为是断开，404 可能只是暂时没有数据
      } finally {
        setLoading(false);
      }
    };

    // 立即执行一次
    fetchHostData();

    // 轮询间隔 3秒
    const interval = setInterval(fetchHostData, 3000);

    return () => clearInterval(interval);
  }, [hostId]);

  const latest = data.length > 0 ? data[data.length - 1] : { 
      cpu: 0, 
      memory: 0, 
      net: 0,
      diskUsage: 0,
      diskInfo: '0 GB / 0 GB',
      fileStatus: []
  };

  // Status Indicator Component
  const StatusBadge = () => {
    if (connectionStatus === 'disconnected') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs font-bold animate-pulse">
           <AlertOctagon size={14} /> CONNECTION LOST
        </div>
      );
    } else if (connectionStatus === 'unstable') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 text-xs font-bold">
           <Wifi size={14} /> HIGH LATENCY ({latency}ms)
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs font-bold transition-all">
         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
         STABLE ({latency}ms)
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3 font-mono">
          HIDS.MONITOR <span className="text-xs bg-cyber-accent/20 text-cyber-accent px-2 py-1 rounded font-sans">LIVE</span>
        </h2>
        
        <div className="flex items-center gap-4">
          <StatusBadge />
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden md:inline">监控对象:</span>
            <select 
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              className="bg-cyber-950 border border-cyber-700 rounded px-4 py-2 text-white outline-none focus:border-cyber-accent"
            >
              {hosts.length > 0 ? (
                hosts.map((host: any) => (
                  <option key={host.id} value={host.hostIp}>
                    {host.hostIp} (ID: {host.id})
                  </option>
                ))
              ) : (
                <option value="" disabled>No Hosts Configured</option>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Card */}
        <div className={`glass-panel rounded-xl p-6 relative overflow-hidden group hover:border-cyber-accent/50 transition-colors ${connectionStatus === 'disconnected' ? 'opacity-50 grayscale' : ''}`}>
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Cpu size={14} /> CPU 负载
                </p>
                <h3 className="text-4xl font-mono text-white mt-2 font-bold">{latest.cpu}%</h3>
             </div>
             <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${latest.cpu > 80 ? 'from-red-500 to-orange-500' : 'from-blue-500 to-cyan-500'} opacity-20 group-hover:opacity-100 transition-opacity`}>
               <Activity size={24} className="text-white" />
             </div>
           </div>
           {/* Mini Chart */}
           <div className="h-16 mt-4 -mx-2">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data}>
                 <defs>
                   <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fill="url(#cpuGradient)" isAnimationActive={connectionStatus !== 'disconnected'} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Memory Card */}
        <div className={`glass-panel rounded-xl p-6 relative overflow-hidden group hover:border-purple-500/50 transition-colors ${connectionStatus === 'disconnected' ? 'opacity-50 grayscale' : ''}`}>
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Disc size={14} /> 内存使用
                </p>
                <h3 className="text-4xl font-mono text-white mt-2 font-bold">{latest.memory}%</h3>
             </div>
             <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 opacity-20 group-hover:opacity-100 transition-opacity">
               <Disc size={24} className="text-white" />
             </div>
           </div>
           <div className="h-16 mt-4 -mx-2">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data}>
                 <defs>
                   <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <Area type="monotone" dataKey="memory" stroke="#a855f7" strokeWidth={2} fill="url(#memGradient)" isAnimationActive={connectionStatus !== 'disconnected'} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Action Card */}
        <Link to="/hids/processes" className="glass-panel rounded-xl p-6 flex flex-col justify-center items-center gap-4 hover:bg-cyber-800 transition-all cursor-pointer group border-dashed">
           <div className="p-4 bg-cyber-900 rounded-full text-cyber-accent group-hover:scale-110 group-hover:bg-cyber-accent group-hover:text-cyber-900 transition-all duration-300 shadow-lg shadow-cyber-accent/10">
             <Activity size={32} />
           </div>
           <div className="text-center">
             <h3 className="font-bold text-lg text-white group-hover:text-cyber-accent transition-colors">系统进程深度分析</h3>
             <p className="text-xs text-slate-500 mt-1">查看异常 PID 及资源占用</p>
           </div>
        </Link>
      </div>

      {/* [新增] 磁盘与文件监控 (Grid布局) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
         {/* 磁盘使用状态 */}
         <div className={`glass-panel rounded-xl p-6 relative ${connectionStatus === 'disconnected' ? 'opacity-50 grayscale' : ''}`}>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
               <HardDrive size={14} /> 磁盘空间 (System Root)
            </h3>
            <div className="flex items-end gap-2">
               <span className="text-3xl font-mono font-bold text-white">{latest.diskInfo.split(' / ')[0] || '0 GB'}</span>
               <span className="text-sm text-slate-500 mb-1">/ {latest.diskInfo.split(' / ')[1] || '0 GB'} Total</span>
            </div>
            
            {/* 进度条 */}
            <div className="mt-4 space-y-2">
               <div className="flex justify-between text-xs text-slate-400">
                  <span>Usage</span>
                  <span className="text-white font-bold">{latest.diskUsage.toFixed(1)}%</span>
               </div>
               <div className="w-full h-3 bg-cyber-900 rounded-full overflow-hidden border border-cyber-800">
                  <div className={`h-full rounded-full relative transition-all duration-1000 ${latest.diskUsage > 80 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${latest.diskUsage}%` }}>
                     <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
               </div>
            </div>

            <div className="mt-4 pt-4 border-t border-cyber-800 flex justify-between text-xs text-slate-500">
               <div>Read: <span className="text-blue-400">-- MB/s</span></div>
               <div>Write: <span className="text-purple-400">-- MB/s</span></div>
            </div>
         </div>

         {/* 核心文件监控 */}
         <div className={`glass-panel rounded-xl p-6 overflow-hidden ${connectionStatus === 'disconnected' ? 'opacity-50 grayscale' : ''}`}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <FileSearch size={14} /> 核心文件监控
               </h3>
               <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">FIM Active</span>
            </div>
            
            <div className="space-y-3 text-sm max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
               {latest.fileStatus && latest.fileStatus.length > 0 ? (
                  latest.fileStatus.map((file: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-cyber-800/50 rounded transition-colors group">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <FolderOpen size={16} className="text-slate-500 group-hover:text-cyber-accent flex-shrink-0" />
                            <span className="text-slate-300 font-mono text-xs truncate" title={file.path}>
                                {file.path.length > 30 ? '...' + file.path.slice(-25) : file.path}
                            </span>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 ml-2">
                            <span className={`text-xs font-bold ${file.status === 'Normal' ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`}>
                                {file.status}
                            </span>
                            <span className="text-[10px] text-slate-600">{file.lastMod}</span>
                        </div>
                    </div>
                  ))
               ) : (
                  <div className="text-center text-slate-500 py-4">Waiting for agent report...</div>
               )}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[350px]">
         {/* Main Chart */}
         <div className={`lg:col-span-2 glass-panel rounded-xl p-6 h-full flex flex-col transition-opacity ${connectionStatus === 'disconnected' ? 'opacity-60' : ''}`}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 shrink-0">
              <Network size={16} className="text-cyber-accent"/> 网络 I/O 吞吐量 (MB/s)
            </h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', color: '#fff' }}
                     itemStyle={{ fontWeight: 'bold', color: '#22d3ee' }}
                     labelStyle={{ display: 'none' }}
                  />
                  <Line type="monotone" dataKey="net" stroke="#22d3ee" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={0} />
                </LineChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Terminal Log */}
         <div className="glass-panel rounded-xl p-0 flex flex-col overflow-hidden bg-black/40 h-full">
            <div className="px-4 py-2 bg-cyber-900/80 border-b border-cyber-800 flex items-center justify-between shrink-0">
               <span className="text-xs font-mono text-slate-400">system_audit.log</span>
               <div className="flex gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                  <div className="w-2 h-2 rounded-full bg-slate-600"></div>
               </div>
            </div>
            <div className="flex-1 p-4 font-mono text-xs space-y-2 overflow-hidden relative">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyber-950 pointer-events-none"></div>
               {connectionStatus === 'disconnected' && (
                 <p className="text-red-500 font-bold bg-red-500/10 p-1 border border-red-500/30">
                   [FATAL] Connection to host lost. Retrying...
                 </p>
               )}
               <p className="text-emerald-500/80">[INFO] Audit daemon started.</p>
               <p className="text-slate-400">[LOG] User 'admin' login from 192.168.1.105</p>
               <p className="text-slate-400">[LOG] Cron job executed: daily_backup.sh</p>
               <p className="text-yellow-500/80">[WARN] High latency detected on eth0</p>
               {latest.cpu > 60 && <p className="text-red-400 animate-pulse">[ALERT] CPU load threshold exceeded ({latest.cpu}%)</p>}
               <p className="text-slate-400">[LOG] Synchronizing NTP server...</p>
               <p className="text-slate-400 opacity-50">...</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default HostMonitoring;