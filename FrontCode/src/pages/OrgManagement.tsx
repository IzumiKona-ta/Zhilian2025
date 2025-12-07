import React, { useState, useEffect } from 'react';
import { Share2, Trash2, Edit2, Plus, X, Save, CheckCircle, AlertCircle, Users, Loader2 } from 'lucide-react';
import { Organization } from '../types';
import { OrgService } from '../services/connector'; // 引入真实的 Service

const OrgManagement: React.FC = () => {
  // ---------------- State Management ----------------
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true); // 加载状态
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false); // 提交中状态
  
  const [formData, setFormData] = useState({
    name: '',
    maxMembers: 10,
    adminPermission: false
  });

  // 共享列表状态 (这里暂时保留 Mock，实际也可以接 API)
  const [shares, setShares] = useState([
    { id: 1, title: '月度 DDoS 攻击分析报告', source: '网络防御组 Beta', time: '2 小时前', status: 'pending' },
    { id: 2, title: 'APT-29 组织活动溯源', source: '威胁情报中心', time: '5 小时前', status: 'pending' }
  ]);

  // ---------------- API Calls ----------------

  // 1. 初始化加载数据
  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const data = await OrgService.getAll();
      setOrgs(data);
      setError(null);
    } catch (err) {
      console.error("API Error", err);
      // 优雅降级：如果 API 失败，暂时不显示数据或显示错误，不再回退到 Mock
      setError("无法连接到组织管理服务，请检查后端状态。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  // ---------------- Handlers ----------------

  const handleOpenModal = (org?: Organization) => {
    if (org) {
      setEditingId(org.id);
      setFormData({
        name: org.name,
        maxMembers: org.maxMembers,
        adminPermission: org.adminPermission
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        maxMembers: 10,
        adminPermission: false
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要解散该组织吗？此操作将同步至云端数据库。')) {
      try {
        await OrgService.delete(id);
        setOrgs(prev => prev.filter(org => org.id !== id));
      } catch (err) {
        alert("删除失败，请稍后重试");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (editingId) {
        // API: Update
        const updatedOrg = await OrgService.update(editingId, {
            name: formData.name,
            maxMembers: formData.maxMembers,
            adminPermission: formData.adminPermission
        });
        setOrgs(prev => prev.map(org => org.id === editingId ? updatedOrg : org));
      } else {
        // API: Create
        const newOrg = await OrgService.create({
            name: formData.name,
            maxMembers: formData.maxMembers,
            adminPermission: formData.adminPermission,
            memberCount: 1 // 初始值
        });
        setOrgs(prev => [...prev, newOrg]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert("操作失败：" + (err as any).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareAction = (id: number, action: 'accept' | 'reject') => {
    setShares(prev => prev.filter(s => s.id !== id));
  };

  // ---------------- Render ----------------

  return (
    <div className="space-y-8 animate-fade-in relative">
      
      {/* ---------------- 组织列表区域 ---------------- */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">组织信息管理</h2>
            <p className="text-slate-400 text-sm mt-1">管理当前账户所属的安全运营中心及权限。</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-cyber-accent to-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:shadow-lg hover:shadow-cyber-accent/20 transition-all transform hover:-translate-y-0.5 active:scale-95"
          >
            <Plus size={18} /> 新增组织
          </button>
        </div>

        {loading ? (
           <div className="p-20 flex flex-col items-center justify-center text-cyber-accent">
               <Loader2 size={48} className="animate-spin mb-4" />
               <p>正在同步云端数据...</p>
           </div>
        ) : error ? (
           <div className="p-12 border border-red-500/30 bg-red-500/10 rounded-xl flex flex-col items-center justify-center text-red-400">
             <AlertCircle size={48} className="mb-4" />
             <p>{error}</p>
             <button onClick={fetchOrgs} className="mt-4 px-4 py-2 bg-red-500/20 rounded hover:bg-red-500/30">重试</button>
           </div>
        ) : orgs.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-cyber-700 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-cyber-900/30">
            <AlertCircle size={48} className="mb-4 opacity-50" />
            <p>暂无组织信息，请创建新的组织。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orgs.map(org => (
              <div key={org.id} className="group bg-cyber-900/60 backdrop-blur-sm border border-cyber-700 rounded-xl p-6 hover:border-cyber-accent transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-accent/5 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-cyber-accent transition-colors">{org.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <p className="text-xs text-slate-500 cursor-help" title={new Date(org.createdAt).toLocaleString()}>
                         创建: {new Date(org.createdAt).toLocaleDateString()}
                       </p>
                       {org.adminPermission && (
                         <span className="text-[10px] bg-cyber-accent/10 text-cyber-accent px-1.5 py-0.5 rounded border border-cyber-accent/20 font-mono">ADMIN</span>
                       )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                    <button 
                      onClick={() => handleOpenModal(org)}
                      className="p-2 text-slate-400 hover:text-white bg-cyber-800 hover:bg-cyber-700 rounded-lg border border-cyber-700 transition-colors"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(org.id)}
                      className="p-2 text-red-400 hover:text-red-300 bg-cyber-800 hover:bg-red-900/30 rounded-lg border border-cyber-700 hover:border-red-500/30 transition-colors"
                      title="解散"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-5 mt-6 relative z-10">
                  <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="28" cy="28" r="24" stroke="#1e293b" strokeWidth="5" fill="transparent" />
                        <circle 
                          cx="28" cy="28" r="24" 
                          stroke={org.memberCount / org.maxMembers > 0.9 ? '#ef4444' : '#06b6d4'}
                          strokeWidth="5" fill="transparent" 
                          strokeDasharray={150} 
                          strokeDashoffset={150 - (150 * (org.memberCount / org.maxMembers))}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <Users size={16} className="text-slate-500 mx-auto mb-0.5" />
                      </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1.5">
                       <h4 className="text-sm font-bold text-slate-300">团队饱和度</h4>
                       <span className="text-xs text-slate-500 font-mono">
                         <span className="text-white">{org.memberCount}</span>/{org.maxMembers}
                       </span>
                    </div>
                    <div className="w-full bg-cyber-950 h-1.5 rounded-full overflow-hidden border border-cyber-800/50">
                       <div 
                         className={`h-full rounded-full ${org.memberCount / org.maxMembers > 0.9 ? 'bg-red-500' : 'bg-cyber-accent'}`}
                         style={{ width: `${(org.memberCount / org.maxMembers) * 100}%` }}
                       ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- 共享列表 (保持原样) ---------------- */}
      <section className="border-t border-cyber-800 pt-8">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Share2 className="text-cyber-accent" /> 威胁情报共享中心
        </h2>
        
        <div className="bg-cyber-900/40 border border-cyber-700 rounded-xl overflow-hidden backdrop-blur-sm">
           <div className="p-4 border-b border-cyber-700 flex gap-6 bg-cyber-900/50">
             <button className="text-sm font-bold text-white border-b-2 border-cyber-accent pb-4 -mb-4.5 transition-colors">待接收 ({shares.length})</button>
             <button className="text-sm font-bold text-slate-500 hover:text-slate-300 pb-4 transition-colors">我发起的 (5)</button>
           </div>
           
           <div className="divide-y divide-cyber-700/50">
             {shares.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                   <CheckCircle size={32} className="text-emerald-500/50" />
                   <p className="text-sm">所有共享请求已处理完毕</p>
                </div>
             ) : (
               shares.map((item) => (
                 <div key={item.id} className="p-4 flex flex-col sm:flex-row items-center justify-between hover:bg-cyber-800/30 transition-colors gap-4 animate-slide-up">
                   <div className="flex items-center gap-4 w-full sm:w-auto">
                     <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold shrink-0">
                       {item.source.charAt(0)}
                     </div>
                     <div>
                       <h4 className="font-bold text-white text-sm">{item.title}</h4>
                       <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                         <span>来自: {item.source}</span>
                         <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                         <span>{item.time}</span>
                       </p>
                     </div>
                   </div>
                   <div className="flex gap-2 w-full sm:w-auto justify-end">
                     <button 
                        onClick={() => handleShareAction(item.id, 'reject')}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-cyber-700 hover:bg-cyber-700 rounded-lg transition-colors"
                     >
                       忽略
                     </button>
                     <button 
                        onClick={() => handleShareAction(item.id, 'accept')}
                        className="px-3 py-1.5 text-xs bg-cyber-accent/10 text-cyber-accent border border-cyber-accent/20 hover:bg-cyber-accent/20 rounded-lg font-bold flex items-center gap-1 transition-colors"
                     >
                       <CheckCircle size={14} /> 接收并查看
                     </button>
                   </div>
                 </div>
               ))
             )}
           </div>
        </div>
      </section>

      {/* ---------------- 弹窗模态框 ---------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-cyber-950/80 backdrop-blur-sm" onClick={() => !submitting && setIsModalOpen(false)}></div>
          <div className="relative bg-cyber-900 border border-cyber-700 rounded-xl w-full max-w-md shadow-2xl animate-fade-in overflow-hidden">
            <div className="px-6 py-4 border-b border-cyber-800 flex justify-between items-center bg-gradient-to-r from-cyber-800 to-cyber-900">
              <h3 className="text-lg font-bold text-white">{editingId ? '编辑组织信息' : '创建新组织'}</h3>
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="text-slate-400 hover:text-white transition-colors disabled:opacity-50">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">组织名称</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-3 text-white focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent outline-none transition-all placeholder-slate-600"
                  disabled={submitting}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">最大成员限制</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1"
                    max="200"
                    value={formData.maxMembers}
                    onChange={e => setFormData({...formData, maxMembers: parseInt(e.target.value)})}
                    className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-3 text-white focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent outline-none transition-all"
                    disabled={submitting}
                  />
                  <span className="absolute right-4 top-3 text-slate-500 text-sm">人</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-cyber-950/50 rounded-lg border border-cyber-800 cursor-pointer" onClick={() => !submitting && setFormData({...formData, adminPermission: !formData.adminPermission})}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.adminPermission ? 'bg-cyber-accent border-cyber-accent' : 'border-cyber-700 bg-cyber-900'}`}>
                   {formData.adminPermission && <CheckCircle size={12} className="text-cyber-900" />}
                </div>
                <label className="text-sm text-slate-300 select-none cursor-pointer">
                  授予超级管理员权限 (ROOT)
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-cyber-800 hover:bg-cyber-700 text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyber-accent to-blue-600 hover:shadow-lg hover:shadow-cyber-accent/20 text-white rounded-lg font-bold flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {submitting ? '提交中...' : (editingId ? '保存变更' : '立即创建')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgManagement;