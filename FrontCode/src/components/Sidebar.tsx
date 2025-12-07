import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  ShieldAlert, 
  Activity, 
  Map, 
  FileText, 
  Server, 
  Users, 
  LogOut,
  LayoutDashboard,
  Zap
} from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '数据采集配置' },
    { to: '/analysis', icon: Activity, label: '威胁分析中心' },
    { to: '/alerts', icon: ShieldAlert, label: '实时威胁预警' },
    { to: '/tracing', icon: Map, label: '攻击溯源图谱' },
    { to: '/hids', icon: Server, label: 'HIDS 主机监控' },
    { to: '/reports', icon: FileText, label: '智能报告生成' },
    { to: '/organization', icon: Users, label: '组织与共享' },
  ];

  return (
    <aside className="w-72 bg-cyber-950 border-r border-cyber-800 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl shadow-cyber-900">
      {/* Brand Logo */}
      <div className="h-20 border-b border-cyber-800 flex items-center px-6 gap-3 bg-gradient-to-r from-cyber-900 to-cyber-950">
        <div className="w-10 h-10 bg-gradient-to-br from-cyber-accent to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyber-accent/20 text-white">
          <Zap size={24} fill="currentColor" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-wider font-mono">SENTINEL<span className="text-cyber-accent">PRO</span></h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Cyber Intelligence</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4 mb-2">主要模块</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                isActive
                  ? 'bg-cyber-accent/10 text-cyber-accent shadow-[0_0_15px_rgba(6,182,212,0.15)] border border-cyber-accent/20'
                  : 'text-slate-400 hover:bg-cyber-800 hover:text-slate-200 hover:translate-x-1'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-accent rounded-l-full"></div>}
                <item.icon size={20} className={isActive ? "animate-pulse" : "group-hover:text-cyber-accent transition-colors"} />
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile / Logout */}
      <div className="p-4 border-t border-cyber-800 bg-cyber-900/30">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-cyber-700 border-2 border-cyber-600 flex items-center justify-center">
            <span className="font-bold text-xs">ADM</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Admin User</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 在线
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all hover:shadow-lg hover:shadow-red-500/10"
        >
          <LogOut size={18} />
          <span className="font-medium text-sm">安全退出</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;