import React, { useState, useEffect } from 'react';
import { Save, Play, Square, AlertCircle, Server, Clock, Globe, Activity, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { HostConfig } from '../types';
import { ConfigService } from '../services/connector';

const DataCollection: React.FC = () => {
  const [config, setConfig] = useState<HostConfig>({
    id: '1',
    name: '默认节点配置',
    ips: ['192.168.1.101', '10.0.0.55'],
    frequency: 5,
    status: 'Idle',
  });
  const [rawIps, setRawIps] = useState(config.ips.join('\n'));
  const [ipStatus, setIpStatus] = useState<{total: number, valid: number, invalid: number}>({total: 0, valid: 0, invalid: 0});
  const [isDirty, setIsDirty] = useState(false);
  
  // States for async actions
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionResults, setConnectionResults] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const lines = rawIps.split('\n').map(l => l.trim()).filter(l => l);
    let valid = 0;
    let invalid = 0;
    lines.forEach(ip => {
        // Simple IPv4 regex check
        if (/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/.test(ip)) valid++;
        else invalid++;
    });
    setIpStatus({ total: lines.length, valid, invalid });
    setIsDirty(true);
    setConnectionResults({}); // Reset test results on change
  }, [rawIps]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionResults({});
    const ips = rawIps.split('\n').map(ip => ip.trim()).filter(ip => ip !== '');
    
    // Simulate pinging each IP sequentially or in parallel
    for (const ip of ips) {
        await new Promise(r => setTimeout(r, 400)); // Simulate network latency per IP
        // Mock result: 80% chance of success
        setConnectionResults(prev => ({...prev, [ip]: Math.random() > 0.2}));
    }
    setIsTesting(false);
  };

  const handleSave = async () => {
    if (ipStatus.invalid > 0) {
      alert('无法保存：存在格式错误的 IP 地址，请检查输入。');
      return;
    }
    
    setIsSaving(true);
    
    try {
        const ips = rawIps.split('\n').map(ip => ip.trim()).filter(ip => ip !== '');
        const newConfig = { ...config, ips };
        
        // 1. 调用真实后端接口保存配置
        await ConfigService.updateConfig(newConfig);
        
        setConfig(newConfig);
        setIsDirty(false);
    } catch (err) {
        console.error("Save config failed:", err);
        alert("保存配置失败，请检查网络连接或后端状态。");
    } finally {
        setIsSaving(false);
    }
  };

  const toggleCollection = () => {
    if (config.status === 'Collecting') {
      setConfig(prev => ({ ...prev, status: 'Idle' }));
    } else {
      setConfig(prev => ({ ...prev, status: 'Collecting', lastCollection: new Date().toISOString() }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white font-mono">COLLECTION<span className="text-cyber-accent">.CONFIG</span></h2>
          <p className="text-slate-400 text-sm mt-1">网络威胁数据采集源配置</p>
        </div>
        <div className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-3 border backdrop-blur-md transition-all duration-500 ${
          config.status === 'Collecting' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
            : 'bg-slate-800/50 text-slate-400 border-slate-700'
        }`}>
           <div className="relative">
             <div className={`w-2.5 h-2.5 rounded-full ${config.status === 'Collecting' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
             {config.status === 'Collecting' && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>}
           </div>
           采集引擎: {config.status === 'Collecting' ? '运行中' : '已停止'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main IP Input Area */}
        <div className="lg:col-span-8 glass-panel rounded-xl p-1 relative overflow-hidden">
          <div className="bg-cyber-900/80 rounded-lg p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
               <label className="flex items-center gap-2 text-sm font-bold text-cyber-accent uppercase tracking-wider">
                 <Globe size={16} /> 目标主机列表 (IPv4/IPv6)
               </label>
               <div className="flex gap-3">
                   <button 
                     onClick={handleTestConnection}
                     disabled={isTesting || ipStatus.total === 0}
                     className="px-3 py-1.5 bg-cyber-800 hover:bg-cyber-700 border border-cyber-700 rounded-xs text-xs text-slate-300 flex items-center gap-2 transition-all disabled:opacity-50"
                   >
                     {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                     测试连通性
                   </button>
                   <div className="text-xs space-x-3 flex bg-cyber-950 rounded-md px-3 py-1 border border-cyber-800 items-center">
                      <span className="text-slate-400">总计: <span className="text-white font-mono">{ipStatus.total}</span></span>
                      <span className="text-emerald-400">有效: <span className="font-mono">{ipStatus.valid}</span></span>
                      {ipStatus.invalid > 0 && <span className="text-red-400 animate-pulse">无效: <span className="font-mono">{ipStatus.invalid}</span></span>}
                   </div>
               </div>
            </div>
            
            <div className="relative flex-1">
                <textarea
                  value={rawIps}
                  onChange={(e) => setRawIps(e.target.value)}
                  spellCheck={false}
                  disabled={isSaving}
                  className="w-full h-full bg-cyber-950/50 border border-cyber-700 rounded-lg p-4 font-mono text-sm text-slate-300 focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent outline-none resize-none leading-relaxed shadow-inner"
                  placeholder="192.168.1.1&#10;10.0.0.5..."
                />
                {/* Visual feedback for connection test */}
                {Object.keys(connectionResults).length > 0 && (
                    <div className="absolute top-4 right-4 flex flex-col gap-1 pointer-events-none">
                        {rawIps.split('\n').map((ip, idx) => {
                            const trimmed = ip.trim();
                            if (!trimmed) return null;
                            const result = connectionResults[trimmed];
                            if (result === undefined) return <div key={idx} className="h-5"></div>; // Placeholder
                            return (
                                <div key={idx} className={`h-5 flex items-center justify-end animate-fade-in`}>
                                    {result ? (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-500 bg-emerald-500/10 px-1 rounded"><Wifi size={10} /> 在线</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] text-red-500 bg-red-500/10 px-1 rounded"><WifiOff size={10} /> 超时</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            
            {ipStatus.invalid > 0 && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-500/5 p-2 rounded border border-red-500/20">
                <AlertCircle size={16} />
                <span>检测到格式错误的 IP 地址，请修正后保存。</span>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Settings Card */}
          <div className="glass-panel rounded-xl p-6 bg-gradient-to-b from-cyber-800/50 to-cyber-900/50">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Server size={20} className="text-cyber-accent" /> 采集参数
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">任务名称</label>
                <input 
                  type="text" 
                  value={config.name}
                  onChange={(e) => setConfig({...config, name: e.target.value})}
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-3 text-sm text-white focus:border-cyber-accent outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-2">
                  <Clock size={14} /> 采集频率
                </label>
                <div className="relative">
                  <select 
                    value={config.frequency}
                    onChange={(e) => setConfig({...config, frequency: parseInt(e.target.value)})}
                    className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-3 text-sm text-white appearance-none outline-none focus:border-cyber-accent cursor-pointer"
                  >
                    <option value={1}>高频 (1 分钟/次)</option>
                    <option value={5}>标准 (5 分钟/次)</option>
                    <option value={15}>低频 (15 分钟/次)</option>
                    <option value={30}>节能 (30 分钟/次)</option>
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-cyber-700 space-y-3">
              <button 
                id="save-btn"
                onClick={handleSave}
                disabled={!isDirty || ipStatus.invalid > 0 || isSaving}
                className="w-full flex items-center justify-center gap-2 bg-cyber-700 hover:bg-cyber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-all font-medium shadow-lg group relative overflow-hidden"
              >
                {isSaving && (
                    <div className="absolute inset-0 bg-cyber-accent/20 animate-pulse"></div>
                )}
                {isSaving ? (
                    <><Loader2 size={18} className="animate-spin" /> 正在下发配置...</>
                ) : (
                    <><Save size={18} /> {isDirty ? '保存配置变更' : '配置已保存'}</>
                )}
              </button>
              
              <button 
                onClick={toggleCollection}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold shadow-lg transform active:scale-95 ${
                  config.status === 'Collecting' 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                    : 'bg-gradient-to-r from-cyber-accent to-blue-500 text-white hover:shadow-cyber-accent/30'
                }`}
              >
                {config.status === 'Collecting' ? (
                  <><Square size={18} fill="currentColor" /> 停止采集任务</>
                ) : (
                  <><Play size={18} fill="currentColor" /> 立即开始采集</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataCollection;