import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Server, Activity, Disc, Cpu, Network, Wifi, AlertOctagon } from 'lucide-react';
import { Link } from 'react-router-dom';

const HostMonitoring: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [hostId, setHostId] = useState('host-001');
  
  // 模拟连接状态: 'connected' | 'unstable' | 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'unstable' | 'disconnected'>('connected');
  const [latency, setLatency] = useState(24);

  // 1. 模拟网络抖动和连接状态变化
  useEffect(() => {
    const statusInterval = setInterval(() => {
       const rand = Math.random();
       if (rand > 0.95) setConnectionStatus('disconnected');
       else if (rand > 0.85) setConnectionStatus('unstable');
       else setConnectionStatus('connected');

       // 延迟波动
       setLatency(prev => {
         const target = connectionStatus === 'unstable' ? Math.floor(Math.random() * 300) + 100 : Math.floor(Math.random() * 40) + 10;
         return Math.floor((prev + target) / 2);
       });
    }, 3000);

    return () => clearInterval(statusInterval);
  }, [connectionStatus]);

  // 2. 数据流更新 (受连接状态影响)
  useEffect(() => {
    // Initialize simulated data
    const initData = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      cpu: Math.floor(Math.random() * 40) + 20,
      memory: Math.floor(Math.random() * 30) + 40,
      net: Math.floor(Math.random() * 80) + 10,
    }));
    setData(initData);

    const interval = setInterval(() => {
      // 如果断开连接，则不更新数据
      if (connectionStatus === 'disconnected') return;

      setData(prev => {
        const lastTime = prev[prev.length - 1].time;
        const newPoint = {
          time: lastTime + 1,
          cpu: Math.floor(Math.random() * 40) + 20 + (Math.random() > 0.8 ? 30 : 0),
          memory: Math.floor(Math.random() * 30) + 40,
          net: Math.floor(Math.random() * 80) + 10,
        };
        const newData = [...prev.slice(1), newPoint];
        return newData;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [connectionStatus]);

  const latest = data[data.length - 1] || { cpu: 0, memory: 0, net: 0 };

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
              <option value="host-001">Web-Server-01 (10.0.0.5)</option>
              <option value="host-002">DB-Cluster-Master (10.0.0.6)</option>
              <option value="host-003">Backup-Node (192.168.1.20)</option>
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