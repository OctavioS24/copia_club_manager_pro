
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b11] flex items-center justify-center p-4 md:p-6 font-sans relative overflow-hidden transition-colors duration-500">
      {/* Background Decorative Art / Aurora effects */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[50%] bg-[#e7567b]/10 dark:bg-[#e7567b]/8 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-primary-500/10 dark:bg-primary-500/5 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/5 rounded-full blur-[100px]" />
        
        {/* Subtle grid pattern helper to add depth */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] opacity-50" />
      </div>

      <div className="max-w-md w-full relative z-10 transition-all duration-300">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
          className="bg-white/90 dark:bg-[#0f131c]/95 border border-slate-200/50 dark:border-white/[0.06] rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop-blur-md relative overflow-hidden"
        >
          {/* Accent border on top */}
          <div className="absolute top-0 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-[#e7567b] to-transparent opacity-60" />

          <div className="flex flex-col items-center text-center mb-10">
            {/* Logo Container - designed carefully for maximum contrast in both clear and dark mode */}
            <div className="mb-8 flex justify-center w-full p-6 bg-slate-50 dark:bg-slate-50 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100 select-none transform hover:scale-[1.02] transition-transform duration-300">
              <svg 
                viewBox="0 0 690 164" 
                className="w-full max-w-[220px] md:max-w-[250px] h-auto" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Left grid */}
                <rect x="0" y="0" width="76" height="76" rx="22" fill="#e7567b" />
                <rect x="88" y="0" width="76" height="76" rx="22" fill="#e7567b" />
                <rect x="88" y="88" width="76" height="76" rx="22" fill="#e7567b" />
                <rect x="4" y="92" width="68" height="68" rx="18" stroke="#e7567b" strokeWidth="8" fill="none" />

                {/* PLEGMA letters (charcoal black) */}
                <path 
                  d="M 205 12 L 205 152 M 205 12 H 235 C 265 12, 265 82, 235 82 H 205" 
                  stroke="#292825" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 285 12 L 285 152 H 335" 
                  stroke="#292825" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 410 12 H 360 L 360 152 H 410 M 360 82 H 395" 
                  stroke="#292825" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 490 62 C 490 32, 470 12, 440 12 C 410 12, 390 41, 390 82 C 390 123, 410 152, 440 152 C 470 152, 490 128, 490 92 H 455" 
                  stroke="#292825" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 515 152 L 515 15 L 550 92 L 585 15 L 585 152" 
                  stroke="#292825" 
                  strokeWidth="16" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M 610 152 L 640 15 L 670 152 M 622 97 H 658" 
                  stroke="#292825" 
                  strokeWidth="15" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
            </div>
            
            <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.3em] text-[9px] bg-slate-100 dark:bg-white/[0.04] px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-white/5 transition-colors">
              Portal de Gestión Interna
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4"
            >
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-500 text-[9px] font-black uppercase tracking-widest mb-1 italic">Acceso Denegado</p>
                <p className="text-slate-700 dark:text-slate-300 text-xs font-semibold leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}

          <div className="space-y-8">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold text-center px-4 leading-relaxed uppercase tracking-wider">
              Inicia sesión con tu cuenta de Google institucional para acceder al panel de control.
            </p>

            <button 
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 px-6 py-5 rounded-2xl font-black uppercase text-[10.5px] tracking-[0.15em] shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_rgba(255,255,255,0.05)] transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 bg-white rounded-full p-0.5" />
              {loading ? "Iniciando sesión..." : "Continuar con Google"}
            </button>

            <div className="pt-2 flex justify-center items-center gap-2 text-slate-400 dark:text-slate-500 opacity-60">
              <Lock size={12} className="text-[#e7567b]" />
              <span className="text-[8px] font-black uppercase tracking-widest">Conexión Segura vía Supabase Auth</span>
            </div>
          </div>
        </motion.div>
        
        <p className="text-center mt-10 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] text-[8px] opacity-60">
          © {new Date().getFullYear()} Club Manager Pro • Sistema de Gestión de Alto Rendimiento
        </p>
      </div>
    </div>
  );
};

export default Login;
