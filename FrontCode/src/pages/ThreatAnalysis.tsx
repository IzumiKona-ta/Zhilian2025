import React, { useState, useEffect } from 'react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar } from 'recharts';
import { Filter, Download, RefreshCw, Loader2, FileCheck } from 'lucide-react';

const initialData = [
  { name: '00:00', attacks: 120, traffic: 45 },
  { name: '04:00', attacks: 80, traffic: 30 },
  { name: '08:00', attacks: 250, traffic: 85 },
  { name: '12:00', attacks: 380, traffic: 90 },
  { name: '16:00', attacks: 210, traffic: 65 },
  { name: '20:00', attacks: 340, traffic: 78 },
  { name: '23:59', attacks: 190, traffic: 50 },
];

const ThreatAnalysis: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [chartData, setChartData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Simulate data fetching when timeRange changes
  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange]);

  const fetchData = (range: string) => {
    setLoading(true);
    // Simulate database query time
    setTimeout(() => {
      // Generate some pseudo-random data based on range
      const newData = initialData.map(item => ({
        ...item,
        attacks: Math.floor(Math.random() * (range === '24h' ? 400 : 2000)) + 50,
        traffic: Math.floor(Math.random() * 100)
      }));
      setChartData(newData);
      setLoading(false);
    }, 800);
  };

  const handleRefresh = () => {
    fetchData(timeRange);
  };

  const handleExport = () => {
      setIsExporting(true);
      setExportSuccess(false);
      // Simulate backend PDF generation
      setTimeout(() => {
          setIsExporting(false);
          setExportSuccess(true);
          setTimeout(() => setExportSuccess(false), 3000); // Hide success msg
      }, 2000);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-mono">ANALYTICS<span className="text-cyber-accent">.VIEW</span></h2>
          <p className="text-slate-400 text-sm">多维威胁流量分析大屏</p>
        </div>
        
        <div className="flex gap-3">
           <button onClick={handleRefresh} className={`p-2.5 bg-cyber-800 border border-cyber-700 rounded-lg text-slate-300 hover:text-white hover:border-cyber-accent transition-all ${loading ? 'animate-spin text-cyber-accent' : ''}`}>
             <RefreshCw size={18} />
           </button>
           
           <button 
             onClick={handleExport}
             disabled={isExporting}
             className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-all min-w-[120px] justify-center ${
                 exportSuccess 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50' 
                    : 'bg-cyber-800 border-cyber-700 text-slate-300 hover:text-white hover:bg-cyber-700'
             }`}
           >
             {isExporting ? (
                 <Loader2 size={16} className="animate-spin" />
             ) : exportSuccess ? (
                 <><FileCheck size={16} /> 导出成功</>
             ) : (
                 <><Download size={16} /> 导出报表</>
             )}
           </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-xl p-4 flex flex-wrap gap-6 items-center shadow-lg">
        <div className="flex items-center gap-3">
           <Filter size={16} className="text-cyber-accent" />
           <span className="text-sm font-bold text-slate-300">维度筛选:</span>
        </div>
        
        <div className="flex items-center gap-2">
           <select className="bg-cyber-950 border border-cyber-700 rounded px-3 py-1.5 text-sm text-slate-300 outline-none hover:border-cyber-500 focus:border-cyber-accent transition-colors cursor-pointer" disabled={loading}>
             <option>所有攻击类型</option>
             <option>DDoS 洪水</option>
             <option>SQL 注入</option>
             <option>恶意软件通信</option>
           </select>
        </div>

        <div className="h-6 w-px bg-cyber-700"></div>

        <div className="flex items-center gap-2 bg-cyber-950 rounded-lg p-1 border border-cyber-800">
           {['24h', '7d', '30d'].map(range => (
             <button
               key={range}
               onClick={() => setTimeRange(range)}
               disabled={loading}
               className={`px-4 py-1 text-xs font-bold rounded transition-all ${
                 timeRange === range 
                   ? 'bg-cyber-700 text-white shadow-md' 
                   : 'text-slate-500 hover:text-slate-300 disabled:opacity-50'
               }`}
             >
               {range === '24h' ? '24小时' : range === '7d' ? '7天' : '30天'}
             </button>
           ))}
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="glass-panel rounded-xl p-6 h-[550px] relative">
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <span className="w-1 h-6 bg-cyber-accent rounded-full"></span>
             攻击频率与流量趋势
           </h3>
           <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-blue-500"></span>
                <span className="text-slate-400">攻击次数</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyber-accent"></span>
                <span className="text-slate-400">流量占比</span>
              </div>
           </div>
        </div>

        <div className="h-[85%] w-full relative">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-cyber-900/20 backdrop-blur-sm rounded-lg transition-all">
                    <Loader2 size={40} className="text-cyber-accent animate-spin" />
                </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <defs>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                </linearGradient>
                </defs>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.4} />
                <XAxis 
                dataKey="name" 
                stroke="#94a3b8" 
                tickLine={false} 
                axisLine={false}
                dy={10}
                fontSize={12}
                />
                <YAxis 
                yAxisId="left" 
                stroke="#94a3b8" 
                tickLine={false} 
                axisLine={false}
                label={{ value: '事件数', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                fontSize={12}
                />
                <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#06b6d4" 
                tickLine={false} 
                axisLine={false}
                label={{ value: '流量 %', angle: 90, position: 'insideRight', fill: '#06b6d4', fontSize: 10 }}
                fontSize={12}
                />
                <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    borderColor: '#334155', 
                    color: '#f1f5f9',
                    borderRadius: '8px',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar 
                yAxisId="left" 
                dataKey="attacks" 
                barSize={20} 
                fill="url(#colorAttacks)" 
                radius={[4, 4, 0, 0]} 
                animationDuration={1000}
                />
                <Area 
                yAxisId="right" 
                type="monotone" 
                dataKey="traffic" 
                stroke="#06b6d4" 
                strokeWidth={3} 
                fill="url(#colorTraffic)" 
                dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#fff', stroke: '#06b6d4' }}
                animationDuration={1000}
                />
            </ComposedChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ThreatAnalysis;