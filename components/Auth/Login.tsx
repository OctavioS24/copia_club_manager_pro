
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, AlertCircle } from 'lucide-react';

interface LoginProps {
  config?: ClubConfig;
}

const Login: React.FC<LoginProps> = () => {
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
            <div className="mb-8 flex justify-center w-full">
              <svg 
                viewBox="0 0 690 164" 
                className="w-full max-w-[280px] md:max-w-[320px] h-auto" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Left grid */}
                <rect x="0" y="0" width="76" height="76" rx="22" fill="#e7567b" />
                <rect x="88" y="0" width="76" height="76" rx="22" fill="#e7567b" />
                <rect x="88" y="88" width="76" height="76" rx="22" fill="#e7567b" />
                <rect x="4" y="92" width="68" height="68" rx="18" stroke="#e7567b" strokeWidth="8" fill="none" />

                {/* PLEGMA letters */}
                <path 
                  d="M 205 12 L 205 152 M 205 12 H 235 C 265 12, 265 82, 235 82 H 205" 
                  stroke="#e7567b" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 285 12 L 285 152 H 335" 
                  stroke="#e7567b" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 410 12 H 360 L 360 152 H 410 M 360 82 H 395" 
                  stroke="#e7567b" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 490 62 C 490 32, 470 12, 440 12 C 410 12, 390 41, 390 82 C 390 123, 410 152, 440 152 C 470 152, 490 128, 490 92 H 455" 
                  stroke="#e7567b" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 515 152 L 515 15 L 550 92 L 585 15 L 585 152" 
                  stroke="#e7567b" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 610 152 L 640 15 L 670 152 M 622 97 H 658" 
                  stroke="#e7567b" 
                  strokeWidth="15" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
            </div>
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
