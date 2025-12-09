import React, { useState, useEffect } from 'react';
import { Plus, Trash2, PlayCircle, StopCircle, Loader2, X, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { HostCollectionConfig } from '../types';
import { ConfigService } from '../services/connector';

const DataCollection: React.FC = () => {
  const [hosts, setHosts] = useState<HostCollectionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ hostIp: string; collectFreq: number }>({ hostIp: '', collectFreq: 5 });
  const [submitting, setSubmitting] = useState(false);

  const fetchHosts = async () => {
    setLoading(true);
    try {
      const data = await ConfigService.getHostList();
      // 修复：防御性检查，确保 setHosts 永远接收数组
      setHosts(Array.isArray(data?.list) ? data.list : []);
    } catch (err) {
      console.error("Failed to fetch hosts", err);
      setHosts([]); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHosts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ConfigService.createHost({
        hostIp: formData.hostIp,
        collectFreq: formData.collectFreq,
        collectStatus: 0 
      });
      setIsModalOpen(false);
      setFormData({ hostIp: '', collectFreq: 5 });
      fetchHosts();
    } catch (err) {
      console.error("Failed to create host", err);
      alert("创建失败，请检查后端服务");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (host: HostCollectionConfig) => {
    const newStatus = host.collectStatus === 1 ? 2 : 1;
    try {
      await ConfigService.updateHost(host.id, { collectStatus: newStatus });
      setHosts(prev => prev.map(h => h.id === host.id ? { ...h, collectStatus: newStatus } : h));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定要删除此采集配置吗？")) return;
    try {
      await ConfigService.deleteHost(id);
      setHosts(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white font-mono">COLLECTION<span className="text-cyber-accent">.MANAGER</span></h2>
          <p className="text-slate-400 text-sm mt-1">云外主机采集节点配置中心</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchHosts} className="p-2.5 bg-cyber-800 border border-cyber-700 rounded-lg hover:text-white text-slate-400 transition-colors">
            <RefreshCw size={18} />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-cyber-accent to-blue-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg hover:shadow-cyber-accent/20 transition-all active:scale-95"
          >
            <Plus size={18} /> 新增节点
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-cyber-900/80 text-slate-400 uppercase text-xs font-bold border-b border-cyber-700">
            <tr>
              <th className="p-5 pl-6">ID</th>
              <th className="p-5">主机 IP</th>
              <th className="p-5">采集频率</th>
              <th className="p-5">运行状态</th>
              <th className="p-5">创建时间</th>
              <th className="p-5 text-right pr-6">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyber-700/50 text-slate-300">
            {loading ? (
              <tr><td colSpan={6} className="p-10 text-center text-slate-500"><Loader2 className="animate-spin inline mr-2"/> 加载配置中...</td></tr>
            ) : (hosts || []).length === 0 ? (
              <tr><td colSpan={6} className="p-10 text-center text-slate-500"><AlertCircle className="inline mr-2 mb-1"/> 暂无数据，请尝试新增节点</td></tr>
            ) : (
              hosts.map(host => (
                <tr key={host.id} className="hover:bg-cyber-800/30 transition-colors group">
                  <td className="p-5 pl-6 font-mono text-xs text-slate-500">#{host.id}</td>
                  <td className="p-5 font-bold text-white font-mono tracking-wide">{host.hostIp}</td>
                  <td className="p-5 text-sm">{host.collectFreq} min</td>
                  <td className="p-5">
                    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded text-xs font-bold border ${
                      host.collectStatus === 1 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                      host.collectStatus === 3 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {host.collectStatus === 1 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}
                      {host.collectStatus === 1 ? 'Running' : host.collectStatus === 2 ? 'Paused' : host.collectStatus === 3 ? 'Error' : 'Stopped'}
                    </span>
                  </td>
                  <td className="p-5 text-xs text-slate-500 font-mono">{host.createTime || '-'}</td>
                  <td className="p-5 text-right pr-6">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleStatus(host)}
                        className={`p-2 rounded border transition-colors ${
                          host.collectStatus === 1 
                            ? 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10' 
                            : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                        }`}
                        title={host.collectStatus === 1 ? "暂停采集" : "启动采集"}
                      >
                        {host.collectStatus === 1 ? <StopCircle size={16} /> : <PlayCircle size={16} />}
                      </button>
                      <button 
                        onClick={() => handleDelete(host.id)}
                        className="p-2 text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors"
                        title="删除配置"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cyber-900 border border-cyber-700 rounded-xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-slide-up">
            <div className="flex justify-between items-center border-b border-cyber-800 pb-4">
              <h3 className="text-lg font-bold text-white">新建采集节点</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400 hover:text-white"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">主机 IP 地址</label>
                <input 
                  required
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-3 text-white outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent transition-all"
                  placeholder="例如: 192.168.1.100"
                  value={formData.hostIp}
                  onChange={e => setFormData({...formData, hostIp: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">采集频率 (分钟)</label>
                <input 
                  type="number"
                  min="1"
                  max="60"
                  required
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-3 text-white outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent transition-all"
                  value={formData.collectFreq}
                  onChange={e => setFormData({...formData, collectFreq: parseInt(e.target.value)})}
                />
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-3 bg-cyber-accent text-cyber-900 font-bold rounded-lg hover:bg-cyan-400 transition-colors flex justify-center items-center gap-2 mt-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {submitting ? '保存中...' : '确认添加'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCollection;