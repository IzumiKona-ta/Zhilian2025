import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Loader2, CheckCircle, Terminal, Eye, Download, History, ChevronRight } from 'lucide-react';
import { MOCK_THREATS } from '../utils/constants';
import { generateThreatReport } from '../services/geminiService';

const ReportGeneration: React.FC = () => {
  const [reportType, setReportType] = useState<'Daily' | 'Weekly' | 'Custom'>('Daily');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // History simulation
  const [historyLoading, setHistoryLoading] = useState(true);
  const [reportHistory, setReportHistory] = useState<{id: number, title: string, date: string}[]>([]);

  // Fetch history from "backend"
  useEffect(() => {
      setTimeout(() => {
          setReportHistory([
              { id: 101, title: '2023-10-26 安全日报', date: 'Yesterday' },
              { id: 102, title: '第 42 周安全态势周报', date: '3 days ago' },
              { id: 103, title: 'SQL 注入专项分析', date: '1 week ago' },
          ]);
          setHistoryLoading(false);
      }, 1200);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedContent(null);
    setLogs([]);

    // Simulate process logs
    const steps = [
      "正在初始化 AI 引擎...",
      "连接威胁情报数据库...",
      `检索最近 ${reportType === 'Daily' ? '24小时' : '7天'} 数据...`,
      "分析攻击向量与特征...",
      "生成自然语言摘要...",
      "格式化输出..."
    ];

    for (let i = 0; i < steps.length; i++) {
        await new Promise(r => setTimeout(r, 600));
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] INFO: ${steps[i]}`]);
    }

    const content = await generateThreatReport(MOCK_THREATS, reportType);
    
    setGeneratedContent(content);
    setIsGenerating(false);
    
    // Add to local history
    const newReport = {
        id: Date.now(),
        title: `${new Date().toLocaleDateString()} ${reportType === 'Daily' ? '安全日报' : reportType === 'Weekly' ? '周报' : '专项报告'}`,
        date: 'Just now'
    };
    setReportHistory(prev => [newReport, ...prev]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-gradient-to-br from-cyber-accent to-blue-600 rounded-2xl shadow-lg shadow-cyber-accent/20">
           <FileText className="text-white" size={32} />
        </div>
        <div>
           <h2 className="text-2xl font-bold text-white tracking-wide">智能威胁报告引擎</h2>
           <p className="text-slate-400">利用生成式 AI 自动化分析安全日志并生成决策报告。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Config Panel */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass-panel p-6 rounded-xl space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                  <Terminal size={16} className="text-cyber-accent"/> 参数配置
                </h3>
                <div className="space-y-3">
                  {[
                    { id: 'Daily', label: '每日安全日报', desc: '过去 24 小时概览' },
                    { id: 'Weekly', label: '每周态势周报', desc: '深度趋势分析' },
                    { id: 'Custom', label: '专项调查报告', desc: '特定事件复盘' }
                  ].map((type) => (
                    <div 
                      key={type.id}
                      onClick={() => setReportType(type.id as any)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        reportType === type.id 
                          ? 'bg-cyber-accent/10 border-cyber-accent shadow-[0_0_10px_rgba(6,182,212,0.1)]' 
                          : 'bg-cyber-900/50 border-cyber-700 hover:bg-cyber-800'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-bold text-sm ${reportType === type.id ? 'text-white' : 'text-slate-300'}`}>{type.label}</span>
                        {reportType === type.id && <CheckCircle size={16} className="text-cyber-accent" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{type.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {reportType === 'Custom' && (
                <div className="animate-fade-in">
                   <label className="block text-xs font-bold text-slate-400 mb-2">起止日期</label>
                   <div className="relative">
                     <Calendar className="absolute left-3 top-2.5 text-slate-500" size={16} />
                     <input type="date" className="w-full bg-cyber-950 border border-cyber-700 rounded p-2 pl-10 text-sm text-white focus:border-cyber-accent outline-none" />
                   </div>
                </div>
              )}

              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3.5 bg-gradient-to-r from-cyber-accent to-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 hover:shadow-blue-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center gap-2"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : '启动 AI 生成'}
              </button>
           </div>

           {/* Report History Panel */}
           <div className="glass-panel p-6 rounded-xl">
               <h3 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                  <History size={16} className="text-slate-400"/> 历史归档
               </h3>
               {historyLoading ? (
                   <div className="space-y-3">
                       {[1,2,3].map(i => <div key={i} className="h-10 bg-cyber-800/50 rounded animate-pulse"></div>)}
                   </div>
               ) : (
                   <div className="space-y-2">
                       {reportHistory.map(item => (
                           <div key={item.id} className="p-3 hover:bg-cyber-800 rounded cursor-pointer group flex justify-between items-center transition-colors">
                               <div>
                                   <div className="text-sm text-slate-300 group-hover:text-white font-medium">{item.title}</div>
                                   <div className="text-xs text-slate-500">{item.date}</div>
                               </div>
                               <ChevronRight size={14} className="text-slate-600 group-hover:text-cyber-accent opacity-0 group-hover:opacity-100 transition-all" />
                           </div>
                       ))}
                   </div>
               )}
           </div>
        </div>

        {/* Preview / Terminal Panel */}
        <div className="lg:col-span-3">
           <div className="glass-panel rounded-xl h-[700px] flex flex-col overflow-hidden border-cyber-700">
              {/* Header */}
              <div className="px-6 py-3 border-b border-cyber-700 flex justify-between items-center bg-cyber-900/80">
                 <div className="flex items-center gap-2">
                   <div className="flex gap-1.5">
                     <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                     <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                     <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                   </div>
                   <span className="ml-3 text-xs font-mono text-slate-400">report_preview.md</span>
                 </div>
                 {generatedContent && !isGenerating && (
                   <div className="flex gap-3">
                     <button className="text-xs flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                       <Eye size={14} /> 全屏预览
                     </button>
                     <button className="text-xs flex items-center gap-1 text-cyber-accent hover:text-cyan-300 transition-colors font-bold">
                       <Download size={14} /> 导出 PDF
                     </button>
                   </div>
                 )}
              </div>
              
              {/* Content */}
              <div className="flex-1 p-0 bg-cyber-950/80 overflow-y-auto scrollbar-thin relative">
                 {isGenerating ? (
                   <div className="p-6 font-mono text-sm space-y-2">
                     {logs.map((log, idx) => (
                       <div key={idx} className="text-emerald-500/80 animate-fade-in">
                         <span className="mr-2">$</span>{log}
                       </div>
                     ))}
                     <div className="flex items-center gap-2 text-cyber-accent animate-pulse mt-4">
                       <span className="w-2 h-4 bg-cyber-accent block"></span>
                       正在处理...
                     </div>
                   </div>
                 ) : generatedContent ? (
                   <div className="p-8 prose prose-invert prose-sm max-w-none font-sans leading-7">
                     <div className="whitespace-pre-wrap">{generatedContent}</div>
                     <div className="mt-8 pt-4 border-t border-cyber-800 flex items-center gap-2 text-xs text-slate-500 font-mono">
                       <CheckCircle size={12} className="text-emerald-500" /> GENERATION COMPLETE
                     </div>
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                     <div className="w-20 h-20 rounded-full bg-cyber-800/50 flex items-center justify-center border border-cyber-700 border-dashed">
                       <Terminal size={32} />
                     </div>
                     <p className="text-sm">等待任务启动...</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGeneration;