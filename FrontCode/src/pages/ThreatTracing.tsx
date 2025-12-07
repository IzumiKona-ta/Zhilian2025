import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Crosshair, X, Monitor, Shield, Activity, Globe } from 'lucide-react';
import { CHINA_GEO_NODES } from '../utils/constants';
import * as echarts from 'echarts';

const ThreatTracing: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);

  // 初始化 ECharts 地图
  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;

    let chart: echarts.ECharts | null = null;
    let abortController = new AbortController();

    const initChart = async () => {
      // Ensure container has dimensions
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        console.warn("ECharts container has 0 dimensions");
        return;
      }

      if (!chart) {
        chart = echarts.init(container);
        setChartInstance(chart);
      }

      chart.showLoading({
        text: '正在初始化地理模型...',
        color: '#06b6d4',
        textColor: '#94a3b8',
        maskColor: 'rgba(2, 6, 23, 0.2)',
        zlevel: 0,
      });

      try {
        const response = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json', {
          signal: abortController.signal
        });
        const geoJson = await response.json();
        
        echarts.registerMap('china', geoJson);
        chart.hideLoading();

        // 构造数据
        const cityData = CHINA_GEO_NODES.map(node => ({
          ...node,
          value: [...node.coord, node.threats],
        }));

        // 模拟攻击飞线数据
        const generateLines = () => {
          const lines = [];
          const centers = CHINA_GEO_NODES.filter(n => ['bj', 'sh', 'gz'].includes(n.id));
          
          for (let i = 0; i < 25; i++) {
            const source = CHINA_GEO_NODES[Math.floor(Math.random() * CHINA_GEO_NODES.length)];
            const target = centers[Math.floor(Math.random() * centers.length)];
            
            if (source.id !== target.id) {
              lines.push({
                fromName: source.name,
                toName: target.name,
                coords: [source.coord, target.coord],
                value: Math.floor(Math.random() * 100)
              });
            }
          }
          return lines;
        };

        const option: echarts.EChartsOption = {
          backgroundColor: 'transparent', // Use container background
          tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#334155',
            textStyle: { color: '#f1f5f9' },
            formatter: (params: any) => {
              if (params.seriesType === 'effectScatter') {
                return `
                  <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">${params.name}</div>
                  <div style="font-size: 12px; color: #06b6d4;">威胁指数: <span style="color: white; font-family: monospace;">${params.value[2]}</span></div>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">主要威胁: ${params.data.type}</div>
                `;
              }
              return params.name;
            }
          },
          geo: {
            map: 'china',
            roam: true,
            zoom: 1.25,
            center: [105.1954, 36.8617],
            label: {
              show: true,
              color: '#94a3b8',
              fontSize: 10,
              formatter: (params: any) => {
                return ['北京', '上海', '广州', '重庆', '西安'].includes(params.name) ? params.name : '';
              }
            },
            itemStyle: {
              areaColor: '#1e293b',
              borderColor: '#06b6d4',
              borderWidth: 1,
              shadowColor: 'rgba(6, 182, 212, 0.5)',
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowOffsetY: 5
            },
            emphasis: {
              itemStyle: {
                areaColor: '#334155',
                borderColor: '#22d3ee',
                borderWidth: 2,
                shadowBlur: 20
              },
              label: { show: true, color: '#fff' }
            },
            select: {
              itemStyle: { areaColor: '#0f172a' }
            }
          },
          series: [
            {
              name: '威胁节点',
              type: 'effectScatter',
              coordinateSystem: 'geo',
              data: cityData,
              symbolSize: (val: number[]) => Math.max(8, val[2] / 5),
              showEffectOn: 'render',
              rippleEffect: {
                brushType: 'stroke',
                scale: 4,
                period: 4,
                number: 3
              },
              label: {
                show: true,
                position: 'right',
                formatter: '{b}',
                color: '#e2e8f0',
                fontSize: 12,
                fontWeight: 'bold',
                backgroundColor: 'rgba(2, 6, 23, 0.5)',
                padding: [2, 4],
                borderRadius: 2
              },
              itemStyle: {
                color: (params: any) => {
                  const val = params.value[2];
                  return val > 80 ? '#ef4444' : val > 50 ? '#f59e0b' : '#06b6d4';
                },
                shadowBlur: 10,
                shadowColor: '#000'
              },
              zlevel: 2
            },
            {
              name: '攻击链路',
              type: 'lines',
              zlevel: 1,
              effect: {
                show: true,
                period: 5,
                trailLength: 0.7,
                color: '#fff',
                symbol: 'arrow',
                symbolSize: 5
              },
              lineStyle: {
                color: (params: any) => params.data.value > 80 ? '#ef4444' : '#22d3ee',
                width: 1,
                opacity: 0.4,
                curveness: 0.2
              },
              data: generateLines()
            }
          ]
        };

        chart.setOption(option);
        
        chart.on('click', (params: any) => {
          if (params.componentType === 'series' && params.seriesType === 'effectScatter') {
            setSelectedCity(params.data);
          }
        });

      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Failed to load map data", error);
          chart.hideLoading();
        }
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (!chart) {
            initChart();
          } else {
            chart.resize();
          }
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      abortController.abort();
      resizeObserver.disconnect();
      chart?.dispose();
    };
  }, []);

  const handleZoom = (scale: number) => {
    if (chartInstance) {
      const option = chartInstance.getOption() as any;
      const zoom = option.geo[0].zoom || 1.25;
      chartInstance.setOption({ geo: { zoom: zoom + scale } });
    }
  };

  const handleReset = () => {
    if (chartInstance) {
      chartInstance.setOption({
        geo: { zoom: 1.25, center: [105.1954, 36.8617] }
      });
      setSelectedCity(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[600px] gap-4 animate-fade-in relative">
      {/* Left Panel: Map */}
      <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden relative border border-cyber-700/50 shadow-[0_0_50px_rgba(6,182,212,0.05)] bg-cyber-900/40">
        {/* Decorative Grid BG */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        
        {/* Map Header */}
        <div className="absolute top-5 left-5 z-20 pointer-events-none">
          <div className="bg-cyber-900/90 backdrop-blur-md border border-cyber-700 p-4 rounded-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe className="text-cyber-accent animate-pulse-slow" size={20} /> 全国威胁态势溯源
            </h2>
            <div className="flex items-center gap-4 mt-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]"></span> 高危区域</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_8px_#f59e0b]"></span> 中危区域</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-cyber-accent rounded-full shadow-[0_0_8px_#06b6d4]"></span> 监控正常</span>
            </div>
          </div>
        </div>

        {/* Map Controls */}
        <div className="absolute top-5 right-5 z-20 flex flex-col gap-2">
           <button onClick={() => handleZoom(0.2)} className="p-2.5 bg-cyber-900/90 rounded-lg border border-cyber-700 hover:border-cyber-accent hover:text-cyber-accent text-slate-400 shadow-xl transition-all active:scale-95"><ZoomIn size={20} /></button>
           <button onClick={() => handleZoom(-0.2)} className="p-2.5 bg-cyber-900/90 rounded-lg border border-cyber-700 hover:border-cyber-accent hover:text-cyber-accent text-slate-400 shadow-xl transition-all active:scale-95"><ZoomOut size={20} /></button>
           <button onClick={handleReset} className="p-2.5 bg-cyber-900/90 rounded-lg border border-cyber-700 hover:border-cyber-accent hover:text-cyber-accent text-slate-400 shadow-xl transition-all active:scale-95"><Crosshair size={20} /></button>
        </div>

        {/* ECharts Container with fallback height */}
        <div ref={chartRef} className="w-full h-full z-10 min-h-[500px]" style={{ minHeight: '500px' }} />
      </div>

      {/* Right Panel: Detail View */}
      <div className={`transition-all duration-500 ease-in-out ${selectedCity ? 'w-full lg:w-96 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 overflow-hidden'}`}>
        {selectedCity && (
          <div className="glass-panel rounded-xl h-full flex flex-col border-t-4 border-t-cyber-accent animate-slide-up bg-cyber-900/80">
            {/* Header */}
            <div className="p-5 border-b border-cyber-700/50 bg-cyber-800/30">
              <div className="flex justify-between items-start">
                <div>
                   <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                     {selectedCity.name} 
                   </h3>
                   <span className="text-xs px-2 py-0.5 bg-cyber-900 rounded border border-cyber-700 text-slate-400 font-mono mt-1 inline-block shadow-inner">
                     GEO: {selectedCity.coord[0].toFixed(2)}, {selectedCity.coord[1].toFixed(2)}
                   </span>
                </div>
                <button onClick={() => setSelectedCity(null)} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-cyber-700 rounded"><X size={20} /></button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
               {/* Threat Score */}
               <div className="bg-cyber-900/50 rounded-lg p-4 border border-cyber-800 relative shadow-inner">
                 <div className="flex justify-between items-end mb-2">
                   <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">威胁感知指数</span>
                   <span className={`text-3xl font-mono font-bold ${selectedCity.threats > 50 ? 'text-red-500' : 'text-yellow-500'}`}>
                     {selectedCity.threats}
                   </span>
                 </div>
                 <div className="w-full bg-cyber-950 h-2 rounded-full overflow-hidden border border-cyber-800">
                   <div 
                      className={`h-full rounded-full transition-all duration-1000 ${selectedCity.threats > 50 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-yellow-600 to-yellow-400'}`} 
                      style={{ width: `${Math.min(100, selectedCity.threats)}%` }}
                    ></div>
                 </div>
               </div>
               
               {/* Details List */}
               <div className="space-y-4">
                 <div className="group">
                   <label className="text-xs font-bold text-slate-500 uppercase block mb-1">主要威胁类型</label>
                   <div className="flex items-center gap-2 text-white p-3 bg-cyber-800/50 rounded border border-cyber-700/50 group-hover:border-cyber-accent/50 transition-colors shadow-sm">
                     <Activity size={18} className="text-cyber-accent" />
                     {selectedCity.type}
                   </div>
                 </div>

                 <div className="group">
                   <label className="text-xs font-bold text-slate-500 uppercase block mb-1">情报详情</label>
                   <div className="p-3 bg-cyber-800/50 rounded border border-cyber-700/50 group-hover:border-cyber-accent/50 transition-colors shadow-sm">
                     <p className="text-sm text-slate-300 leading-relaxed">{selectedCity.details}</p>
                   </div>
                 </div>
               </div>

               {/* Action Buttons */}
               <div className="pt-4 grid grid-cols-2 gap-3">
                  <button className="bg-cyber-700 hover:bg-cyber-600 text-white py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-all shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-0.5">
                    <Monitor size={16} /> 资产详情
                  </button>
                  <button className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-all shadow-lg hover:shadow-red-500/10 hover:-translate-y-0.5">
                    <Shield size={16} /> 区域封锁
                  </button>
               </div>
               
               {/* Trace Log */}
               <div className="mt-4 font-mono text-[10px] text-slate-500 space-y-1 opacity-70 border-t border-cyber-800 pt-3">
                 <div>&gt; Initiating trace route to node...</div>
                 <div>&gt; Hops detected: {Math.floor(Math.random() * 10) + 2}</div>
                 <div className="text-cyber-accent">&gt; Connection secure.</div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreatTracing;