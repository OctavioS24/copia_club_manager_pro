
import React from 'react';
import { LayoutDashboard, Database, Sun, Moon, Shield, Users, UserCog, Wallet } from 'lucide-react';
import { ClubConfig } from '../types';

interface TopNavProps {
  currentView: string;
  setView: (v: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  config: ClubConfig;
}

const TopNav: React.FC<TopNavProps> = ({ 
  currentView, 
  setView, 
  isDarkMode, 
  toggleTheme, 
  config 
}) => {
  const menu = [
    { id: 'squads', label: 'Planteles', icon: Users },
    { id: 'members', label: 'Miembros', icon: UserCog },
    { id: 'payments', label: 'Pagos', icon: Wallet },
    { id: 'master-data', label: 'Estructura', icon: Database },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-24 bg-white/70 dark:bg-[#080a0f]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 z-[150] px-6 md:px-12 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div 
          onClick={() => setView('squads')}
          className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center cursor-pointer shadow-lg shadow-primary-600/20 hover:scale-105 transition-transform"
        >
          {config.logoUrl ? <img src={config.logoUrl} className="w-full h-full object-contain p-2" /> : <Shield size={22} className="text-white" />}
        </div>
        <div className="hidden md:block">
          <h1 className="font-black text-xs uppercase tracking-[0.3em] dark:text-white leading-none">{config.name || 'MI CLUB'}</h1>
          <p className="text-[9px] font-bold text-primary-600 uppercase tracking-widest mt-1">Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-8">
        <div className="flex gap-1 md:gap-4">
          {menu.map(item => {
            const active = currentView === item.id || (currentView === 'discipline-console' && item.id === 'squads');
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${active ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <item.icon size={16} />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-2 hidden sm:block"></div>
        
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary-600 transition-all"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </nav>
  );
};

export default TopNav;
