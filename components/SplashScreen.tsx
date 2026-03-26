
import React from 'react';
import { Shield } from 'lucide-react';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] bg-[#080a0f] flex flex-col items-center justify-center">
      <div className="relative mb-8">
        <div className="absolute -inset-4 bg-primary-600/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-white/5 shadow-2xl relative">
          <Shield size={48} className="text-primary-500 animate-bounce" />
        </div>
      </div>
      <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Plegma <span className="text-primary-500">Sport</span></h1>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2">Cargando ecosistema</p>
      <div className="w-32 h-1 bg-white/5 rounded-full mt-8 overflow-hidden relative">
        <div className="absolute inset-0 bg-primary-600 animate-[loading_1.5s_infinite]"></div>
      </div>
      <style>{`
        @keyframes loading {
          0% { left: -100%; width: 50%; }
          100% { left: 100%; width: 50%; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
