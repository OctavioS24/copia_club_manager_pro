
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, Lock, AlertCircle } from 'lucide-react';

interface LoginProps {
  config?: ClubConfig;
}

const Login: React.FC<LoginProps> = ({ config }) => {
  const { user, signInWithGoogle, loading, error } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-[var(--surface-ground)] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full relative">
        {/* Decorative elements */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card border border-[var(--surface-border)] rounded-[4rem] p-10 md:p-14 shadow-2xl relative z-10 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center text-center mb-12">
            <div className="w-24 h-24 rounded-full bg-slate-950 flex items-center justify-center mb-8 shadow-2xl border-4 border-[var(--surface-border)] overflow-hidden">
              {config?.logo_url ? (
                <img src={config.logo_url} alt="Club Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <Shield size={40} className="text-primary-500" />
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-[var(--text-main)] leading-none mb-4">
              {config?.name || 'Club Manager'} <span className="text-primary-500 underline decoration-4 underline-offset-4">Pro</span>
            </h1>
            <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.3em] text-[10px]">Portal de Gestión Interna</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-start gap-4"
            >
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-500 text-xs font-black uppercase tracking-widest mb-1 italic">Acceso Denegado</p>
                <p className="text-[var(--text-main)] text-sm font-medium leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}

          <div className="space-y-6">
            <p className="text-[var(--text-muted)] text-sm font-medium text-center px-4 leading-relaxed">
              Inicia sesión con tu cuenta de Google institucional para acceder al panel de control.
            </p>

            <button 
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-white hover:bg-slate-50 text-slate-900 px-8 py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.1em] shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Continuar con Google
            </button>

            <div className="pt-6 flex justify-center items-center gap-2 text-[var(--text-muted)] opacity-50">
              <Lock size={12} />
              <span className="text-[9px] font-black uppercase tracking-widest">Conexión Segura vía Supabase Auth</span>
            </div>
          </div>
        </motion.div>
        
        <p className="text-center mt-12 text-[var(--text-muted)] font-bold uppercase tracking-[0.2em] text-[8px] opacity-30">
          © {new Date().getFullYear()} Club Manager Pro • Sistema de Gestión de Alto Rendimiento
        </p>
      </div>
    </div>
  );
};

export default Login;
