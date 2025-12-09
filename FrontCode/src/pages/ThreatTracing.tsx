import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Crosshair, X, Monitor, Shield, Activity, Globe, List, AlertTriangle } from 'lucide-react';
import { CHINA_GEO_NODES } from '../utils/constants';
import * as echarts from 'echarts';
import { TracingService } from '../services/connector';

const ThreatTracing: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);
  const [tracingEvents, setTracingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取真实溯源数据
  useEffect(() => {
    const fetchTracingData = async () => {
      try {
        const data = await TracingService.getList(1, 100);
        setTracingEvents(data);
      } catch (err) {
        console.error("Failed to fetch tracing data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTracingData();
    // 轮询更新
    const interval = setInterval(fetchTracingData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 初始化 ECharts 地图 (基础底图)
  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;

    let chart: echarts.ECharts | null = null;
    let abortController = new AbortController();

    const initChart = async () => {
      // Ensure container has dimensions
      if (container.clientWidth === 0 || container.clientHeight === 0) {
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

        // 构造节点数据
        const cityData = CHINA_GEO_NODES.map(node => ({
          ...node,
          value: [...node.coord, node.threats],
        }));

        const option: echarts.EChartsOption = {
          backgroundColor: 'transparent',
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
              fontSize: 10
            },
            itemStyle: {
              areaColor: '#0f172a',
              borderColor: '#1e293b',
              borderWidth: 1,
              shadowColor: 'rgba(6, 182, 212, 0.5)',
              shadowBlur: 10
            },
            emphasis: {
              itemStyle: {
                areaColor: '#1e293b',
                borderColor: '#06b6d4',
                borderWidth: 2
              },
              label: {
                color: '#fff'
              }
            }
          },
          series: [
            {
              name: 'Nodes',
              type: 'effectScatter',
              coordinateSystem: 'geo',
              data: cityData,
              symbolSize: (val: any) => val[2] / 5,
              showEffectOn: 'render',
              rippleEffect: {
                brushType: 'stroke',
                scale: 3
              },
              label: {
                show: false
              },
              itemStyle: {
                color: '#06b6d4',
                shadowBlur: 10,
                shadowColor: '#06b6d4'
              },
              zlevel: 1
            },
            {
              name: 'Attack Lines',
              type: 'lines',
              zlevel: 2,
              effect: {
                show: true,
                period: 4,
                trailLength: 0.5,
                color: '#ef4444',
                symbol: 'arrow',
                symbolSize: 5
              },
              lineStyle: {
                color: '#ef4444',
                width: 1,
                opacity: 0.4,
                curveness: 0.2
              },
              data: [] // Initial empty
            }
          ]
        };

        chart.setOption(option);
        
        chart.on('click', (params: any) => {
          if (params.seriesType === 'effectScatter') {
            setSelectedCity(params.data);
          }
        });

      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Failed to load map data:', error);
          chart?.hideLoading();
        }
      }
    };

    initChart();

    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      abortController.abort();
      window.removeEventListener('resize', handleResize);
      chart?.dispose();
    };
  }, []);

  // 监听 tracingEvents 更新地图连线
  useEffect(() => {
    if (!chartInstance || !tracingEvents) return;

    // 真实攻击飞线数据生成逻辑
    const generateLines = () => {
      if (tracingEvents.length === 0) return [];
      
      const lines: any[] = [];
      // 假设目标中心是北京 (SOC中心)
      const targetNode = CHINA_GEO_NODES.find(n => n.id === 'bj');
      if (!targetNode) return [];

      tracingEvents.forEach(event => {
        // 尝试根据 malwareOrigin 匹配源节点
        let sourceNode = CHINA_GEO_NODES.find(n => event.malwareOrigin && n.name.includes(event.malwareOrigin));
        
        // 如果无法直接匹配，且存在恶意IP，使用IP哈希映射到某个节点作为演示
        if (!sourceNode && event.maliciousIp) {
            const sum = event.maliciousIp.split('.').reduce((acc: number, part: string) => acc + (parseInt(part) || 0), 0);
            sourceNode = CHINA_GEO_NODES[sum % CHINA_GEO_NODES.length];
        }

        if (sourceNode && sourceNode.id !== targetNode.id) {
          lines.push({
            fromName: sourceNode.name,
            toName: targetNode.name,
            coords: [sourceNode.coord, targetNode.coord],
            value: 80 // 默认高危
          });
        }
      });
      
      return lines;
    };

    chartInstance.setOption({
        series: [
            { name: 'Nodes' }, // Keep existing
            {
                name: 'Attack Lines',
                data: generateLines()
            }
        ]
    });

  }, [tracingEvents, chartInstance]);

  const handleZoom = (delta: number) => {
    if (chartInstance) {
      const option = chartInstance.getOption() as any;
      const currentZoom = option.geo[0].zoom;
      chartInstance.setOption({
        geo: { zoom: currentZoom + delta }
      });
    }
  };

  const handleReset = () => {
    if (chartInstance) {
      chartInstance.setOption({
        geo: { 
          center: [105.1954, 36.8617],
          zoom: 1.25 
        }
      });
      setSelectedCity(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 animate-fade-in relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 z-10">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 font-mono">
            ATTACK.TRACING <span className="text-xs bg-cyber-accent/20 text-cyber-accent px-2 py-1 rounded font-sans animate-pulse">LIVE THREATS</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">全球威胁溯源可视化图谱</p>
        </div>
        
        <div className="flex gap-4">
          <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-3">
             <div className="text-right">
               <div className="text-xs text-slate-500 uppercase">Active Nodes</div>
               <div className="text-xl font-bold text-cyber-accent font-mono">{CHINA_GEO_NODES.length}</div>
             </div>
             <Globe className="text-cyber-accent opacity-50" />
          </div>
          <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-3">
             <div className="text-right">
               <div className="text-xs text-slate-500 uppercase">Tracing Events</div>
               <div className="text-xl font-bold text-red-400 font-mono">{tracingEvents.length}</div>
             </div>
             <Activity className="text-red-400 opacity-50" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative rounded-2xl border border-cyber-800 bg-cyber-950/50 backdrop-blur-sm overflow-hidden flex">
        
        {/* Map Container */}
        <div className="flex-1 relative">
           {/* Legend */}
           <div className="absolute bottom-5 left-5 z-20 pointer-events-none">
             <div className="glass-panel p-4 rounded-lg space-y-2 pointer-events-auto">
               <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Map Legend</div>
               <div className="flex items-center gap-2 text-xs text-slate-300">
                 <span className="w-2 h-2 rounded-full bg-cyber-accent shadow-[0_0_8px_#06b6d4]"></span> 监控正常
               </div>
               <div className="flex items-center gap-2 text-xs text-slate-300">
                 <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></span> 威胁检测
               </div>
               <div className="flex items-center gap-2 text-xs text-slate-300">
                 <span className="w-8 h-0.5 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0"></span> 攻击链路
               </div>
             </div>
           </div>

           {/* Map Controls */}
           <div className="absolute top-5 right-5 z-20 flex flex-col gap-2">
              <button onClick={() => handleZoom(0.2)} className="p-2.5 bg-cyber-900/90 rounded-lg border border-cyber-700 hover:border-cyber-accent hover:text-cyber-accent text-slate-400 shadow-xl transition-all active:scale-95"><ZoomIn size={20} /></button>
              <button onClick={() => handleZoom(-0.2)} className="p-2.5 bg-cyber-900/90 rounded-lg border border-cyber-700 hover:border-cyber-accent hover:text-cyber-accent text-slate-400 shadow-xl transition-all active:scale-95"><ZoomOut size={20} /></button>
              <button onClick={handleReset} className="p-2.5 bg-cyber-900/90 rounded-lg border border-cyber-700 hover:border-cyber-accent hover:text-cyber-accent text-slate-400 shadow-xl transition-all active:scale-95"><Crosshair size={20} /></button>
           </div>

           {/* ECharts Container */}
           <div ref={chartRef} className="w-full h-full z-10 min-h-[500px]" style={{ minHeight: '500px' }} />
        </div>

        {/* Real-time List Panel (Left Side Overlay) */}
        <div className="absolute top-5 left-5 z-20 w-80 max-h-[60%] flex flex-col pointer-events-none">
             {/* List content could go here if needed, but omitted for now as it wasn't in original logic or was cut off */}
        </div>
      </div>
    </div>
  );
};

export default ThreatTracing;
