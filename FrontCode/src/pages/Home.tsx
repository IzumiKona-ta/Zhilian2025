import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  Map, 
  FileText, 
  Server, 
  AlertTriangle, 
  Cpu, 
  Globe, 
  Clock,
  ArrowRight,
  Database
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { DashBoardService, AnalysisService } from '../services/connector';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [safetyScore, setSafetyScore] = useState(0);
  const [stats, setStats] = useState({
    todayAttacks: 0,
    activeThreats: 0,
    protectedAssets: 0
  });
  const [trafficData, setTrafficData] = useState<any[]>([]);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboard = await DashBoardService.getSummary();
        if (dashboard) {
          setSafetyScore(dashboard.securityScore || 0);
          setStats({
            todayAttacks: dashboard.totalAttacksToday || 0,
            activeThreats: dashboard.activeThreats || 0,
            protectedAssets: dashboard.protectedAssets || 0
          });
        }

        const traffic = await AnalysisService.getTraffic(1, 20);
        if (traffic && traffic.length > 0) {
          // Transform backend traffic data for chart
          const chartData = traffic.map((t: any) => ({
            v: t.attackCount || 0
          })).reverse(); // Assuming recent first, we want chronological
          setTrafficData(chartData);
        } else {
            // Empty placeholder if no data
            setTrafficData([{v:0}, {v:0}, {v:0}, {v:0}, {v:0}]);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // 快捷导航卡片配置
  const quickActions = [
    { 
      title: '采集节点配置', 
      desc: '管理分布式的日志采集探针与心跳状态', 
      path: '/collection', 
      icon: Database, // 使用 Database 图标
      color: 'text-cyan-400', 
      bg: 'bg-cyan-500/10',
      border: 'hover:border-cyan-500/50'
    },
    { 
      title: '威胁态势分析', 
      desc: '查看全网攻击流量趋势与类型分布', 
      path: '/analysis', 
      icon: Activity, 
      color: 'text-blue-400', 
      bg: 'bg-blue-500/10',
      border: 'hover:border-blue-500/50'
    },
    { 
      title: '攻击溯源图谱', 
      desc: '基于地理位置追踪高危攻击源头', 
      path: '/tracing', 
      icon: Map, 
      color: 'text-purple-400', 
      bg: 'bg-purple-500/10',
      border: 'hover:border-purple-500/50'
    },
    { 
      title: '实时威胁预警', 
      desc: 'IDS 入侵检测系统实时日志流', 
      path: '/alerts', 
      icon: AlertTriangle, 
      color: 'text-red-400', 
      bg: 'bg-red-500/10',
      border: 'hover:border-red-500/50'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* 顶部欢迎区 & 状态概览 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide font-mono flex items-center gap-3">
            COMMAND<span className="text-cyber-accent">CENTER</span>
            <span className="text-xs font-sans px-2 py-1 bg-cyber-accent/20 text-cyber-accent rounded border border-cyber-accent/30 tracking-normal">
              v2.5.1 LIVE
            </span>
          </h1>
          <p className="text-slate-400 mt-2">欢迎回来，管理员。全网监控节点心跳正常。</p>
        </div>
        <div className="flex items-center gap-4 bg-cyber-900/50 p-3 rounded-xl border border-cyber-800 backdrop-blur-sm">
           <Clock size={20} className="text-cyber-accent" />
           <span className="font-mono text-xl text-white font-bold">
             {currentTime.toLocaleTimeString()}
           </span>
           <span className="text-xs text-slate-500 border-l border-slate-700 pl-4">
             {currentTime.toLocaleDateString()}
           </span>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Widget 1: 安全评分 */}
        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldCheck size={80} />
          </div>
          <div className="relative z-10">
             <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">系统综合安全评分</h3>
             <div className="flex items-end gap-2 mt-2">
               <span className="text-4xl font-mono font-bold text-emerald-400 animate-slide-up">{safetyScore}</span>
               <span className="text-sm text-slate-500 mb-1">/ 100</span>
             </div>
             <div className="w-full bg-cyber-950 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${safetyScore}%` }}></div>
             </div>
          </div>
        </div>

        {/* Widget 2: 今日拦截 */}
        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
           <div className="flex justify-between items-start">
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">今日拦截威胁</h3>
                <p className="text-3xl font-mono font-bold text-white mt-2">{stats.todayAttacks}</p>
                <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                  <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  实时防御中
                </div>
              </div>
              <div className="h-12 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficData}>
                    <Area type="monotone" dataKey="v" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* Widget 3: 在线采集节点 (已添加交互) */}
        <div 
            onClick={() => navigate('/collection')}
            className="glass-panel p-6 rounded-xl relative overflow-hidden group cursor-pointer hover:border-cyber-accent/50 hover:bg-cyber-900/60 transition-all active:scale-[0.98]"
        >
           <div className="flex justify-between items-start">
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider group-hover:text-cyber-accent transition-colors">受保护资产</h3>
                <p className="text-3xl font-mono font-bold text-white mt-2">
                  {stats.protectedAssets}
                </p>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                   <ArrowRight size={12} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-cyber-accent"/>
                   <span>全网覆盖</span>
                </p>
              </div>
              <div className="p-3 bg-cyber-800 rounded-lg text-cyber-accent group-hover:bg-cyber-accent group-hover:text-cyber-900 transition-colors shadow-lg">
                <Globe size={24} />
              </div>
           </div>
        </div>

        {/* Widget 4: 待处理告警 */}
        <div 
            onClick={() => navigate('/alerts')}
            className="glass-panel p-6 rounded-xl relative overflow-hidden group cursor-pointer border-red-500/20 hover:border-red-500/50 hover:bg-red-900/10 transition-all active:scale-[0.98]"
        >
           <div className="flex justify-between items-start">
              <div>
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider group-hover:text-red-400 transition-colors">活跃威胁</h3>
                <p className="text-3xl font-mono font-bold text-red-400 mt-2 animate-pulse">{stats.activeThreats}</p>
                <p className="text-xs text-red-300/70 mt-1 group-hover:text-red-300">
                  点击立即处理 &rarr;
                </p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                <AlertTriangle size={24} />
              </div>
           </div>
        </div>
      </div>

      {/* 功能导航 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左侧：快捷功能入口 */}
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-lg font-bold text-white flex items-center gap-2">
             <Activity size={18} className="text-cyber-accent"/> 快速访问
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action, idx) => (
                <div 
                  key={idx}
                  onClick={() => navigate(action.path)}
                  className={`glass-panel p-5 rounded-xl border border-cyber-700 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/10 group ${action.border}`}
                >
                  <div className="flex items-start justify-between">
                     <div className={`p-3 rounded-lg ${action.bg} ${action.color}`}>
                       <action.icon size={24} />
                     </div>
                     <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                       <ArrowRight size={20} className="text-slate-500 group-hover:text-white" />
                     </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-bold text-white group-hover:text-cyber-accent transition-colors">{action.title}</h3>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-1">{action.desc}</p>
                  </div>
                </div>
              ))}
           </div>

           {/* 底部横幅 */}
           <div className="relative overflow-hidden rounded-xl border border-cyber-700 group cursor-pointer hover:border-cyber-accent/50 transition-colors" onClick={() => navigate('/reports')}>
             <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-cyber-900/40 z-0"></div>
             <div className="relative z-10 p-8 flex justify-between items-center">
                <div>
                   <h3 className="text-xl font-bold text-white mb-2">生成本周安全总结报告</h3>
                   <p className="text-slate-300 text-sm max-w-md">基于 AI 引擎自动分析过去 7 天的攻击日志、阻断记录及主机状态，一键导出 PDF/Markdown。</p>
                </div>
                <div className="h-12 w-12 bg-cyber-accent rounded-full flex items-center justify-center text-cyber-900 shadow-lg shadow-cyan-500/50 group-hover:scale-110 transition-transform">
                   <FileText size={24} fill="currentColor" />
                </div>
             </div>
           </div>
        </div>

        {/* 右侧：实时动态 */}
        <div className="lg:col-span-1">
           <div className="glass-panel rounded-xl h-full flex flex-col border-cyber-700">
             <div className="p-5 border-b border-cyber-700 flex justify-between items-center bg-cyber-900/50 rounded-t-xl">
               <h3 className="font-bold text-white flex items-center gap-2">
                 <Cpu size={16} className="text-slate-400"/> 系统审计日志
               </h3>
               <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
             </div>
             <div className="flex-1 p-4 overflow-y-auto max-h-[400px] custom-scrollbar space-y-4">
                {[
                  { time: '10:42:05', msg: 'System integrity check passed', type: 'info' },
                  { time: '10:41:12', msg: 'Admin user login from 192.168.1.5', type: 'info' },
                  { time: '10:38:55', msg: 'Blocked malicious IP 45.33.22.11', type: 'success' },
                  { time: '10:35:20', msg: 'High CPU usage detected on Node-03', type: 'warning' },
                  { time: '10:30:00', msg: 'Scheduled database backup completed', type: 'info' },
                  { time: '10:15:42', msg: 'New firewall rule applied', type: 'info' },
                ].map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs font-mono border-l-2 border-cyber-800 pl-3 py-1 hover:border-cyber-accent transition-colors">
                    <span className="text-slate-500 shrink-0">{log.time}</span>
                    <span className={`${
                      log.type === 'warning' ? 'text-yellow-400' : 
                      log.type === 'success' ? 'text-emerald-400' : 
                      'text-slate-300'
                    }`}>
                      {log.msg}
                    </span>
                  </div>
                ))}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Home;