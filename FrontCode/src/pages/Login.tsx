import React, { useState } from 'react';
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthService } from '../services/connector';

// Inline SVG to avoid module resolution issues
const noiseBg = "data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.4'/%3E%3C/svg%3E";

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. 调用真实后端登录
      await AuthService.login(username, password);
      // 2. 登录成功，更新父组件状态
      onLogin();
    } catch (err: any) {
      console.error("Login failed:", err);
      // 演示模式：如果连接后端失败，允许用户进入（实际生产中应移除此逻辑）
      if (import.meta.env.DEV && (err.code === "ERR_NETWORK" || err.response?.status === 404)) {
         if (window.confirm("连接后端失败。是否以【离线演示模式】进入？\n(注意：此时无法与真实后端交互)")) {
             localStorage.setItem('auth_token', 'demo_token');
             onLogin();
             return;
         }
      }
      setError(err.response?.data?.message || '身份验证失败，请检查账号密码或网络连接。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-950 flex items-center justify-center relative overflow-hidden font-sans">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-cyber-accent/5 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
        
        {/* Grid Pattern Overlay with Local Noise SVG */}
        <div 
          className="absolute inset-0 opacity-20 mix-blend-soft-light"
          style={{ backgroundImage: `url("${noiseBg}")` }}
        ></div>
        
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-1">
        {/* Card Border Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyber-accent to-blue-600 rounded-2xl blur opacity-30"></div>
        
        <div className="relative bg-cyber-900/80 backdrop-blur-xl border border-cyber-700/50 p-8 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div className="relative">
              <div className="absolute inset-0 bg-cyber-accent blur-md opacity-40 rounded-xl"></div>
              <div className="w-20 h-20 bg-gradient-to-br from-cyber-900 to-cyber-800 border border-cyber-700 rounded-xl flex items-center justify-center mb-4 relative z-10">
                <ShieldCheck size={40} className="text-cyber-accent" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-wide font-mono mt-4">SENTINEL<span className="text-cyber-accent">GUARD</span></h1>
            <p className="text-slate-400 text-sm mt-2 text-center tracking-wide">下一代网络威胁态势感知平台</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
               <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16} />
                  {error}
               </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-cyber-accent uppercase tracking-wider ml-1">账号</label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyber-accent transition-colors" size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-cyber-950/50 border border-cyber-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent transition-all placeholder-slate-600"
                  placeholder="请输入管理员账号"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-cyber-accent uppercase tracking-wider ml-1">密码</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyber-accent transition-colors" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-cyber-950/50 border border-cyber-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent transition-all placeholder-slate-600"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyber-accent to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-cyber-accent/20 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>身份验证中...</span>
                </>
              ) : (
                <>
                  <span>进入控制台</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-cyber-800 text-center">
            <p className="text-xs text-slate-500 font-mono">
              SYSTEM SECURE &bull; 256-BIT ENCRYPTION
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;