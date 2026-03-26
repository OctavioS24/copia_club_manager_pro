
import React from 'react';
import { LayoutDashboard, Database, Sun, Moon, Shield, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { ClubConfig } from '../types';

interface SidebarProps {
  currentView: string;
  setView: (v: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  config: ClubConfig;
  isCollapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setView, 
  isDarkMode, 
  toggleTheme, 
  config,
  isCollapsed,
  setCollapsed
}) => {
  const menu = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'squads', label: 'Planteles', icon: Users },
    { id: 'master-data', label: 'Estructura', icon: Database },
  ];

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside 
        className={`fixed left-0 top-0 h-screen bg-white dark:bg-[#0f1219] border-r border-slate-200 dark:border-white/5 hidden md:flex flex-col z-[100] transition-all duration-500 ease-in-out 
          ${isCollapsed ? 'w-24' : 'w-72'}
        `}
      >
        <div className={`p-6 flex flex-col items-center border-b border-slate-200 dark:border-white/5 transition-all duration-500 ${isCollapsed ? 'min-h-[100px] justify-center' : 'min-h-[180px] justify-center'}`}>
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center shrink-0 shadow-xl shadow-primary-600/30 mb-4 transition-transform hover:scale-105">
            {config.logoUrl ? <img src={config.logoUrl} className="w-full h-full object-contain p-2" /> : <Shield size={28} className="text-white" />}
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in text-center px-4 w-full">
              <h2 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-800 dark:text-white leading-tight break-words">
                {config.name || 'MI CLUB'}
              </h2>
              <div className="mt-2 inline-block px-3 py-1 bg-primary-500/10 rounded-full">
                <p className="text-[9px] font-black text-primary-500 uppercase tracking-widest">Sport Admin</p>
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={() => setCollapsed(!isCollapsed)}
          className="absolute -right-3 top-24 bg-primary-600 text-white p-2 rounded-full shadow-lg border-4 border-slate-50 dark:border-[#080a0f] hover:scale-110 transition-all z-[110]"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          {menu.map(item => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center transition-all group relative rounded-[1.25rem] ${isCollapsed ? 'justify-center p-4' : 'p-4 gap-4'} ${active ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <Icon size={20} className={active ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                {!isCollapsed && <span className="font-bold text-[11px] uppercase tracking-widest animate-fade-in whitespace-nowrap">{item.label}</span>}
                {isCollapsed && active && <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-white/5">
          <button 
            onClick={toggleTheme} 
            className={`w-full flex items-center transition-all rounded-[1.25rem] text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 ${isCollapsed ? 'justify-center p-4' : 'p-4 gap-4'}`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            {!isCollapsed && <span className="font-bold text-[11px] uppercase tracking-widest">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 dark:bg-[#0f1219]/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 flex items-center justify-around px-4 md:hidden z-[200] pb-safe">
          {menu.map(item => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center gap-1 p-2 transition-all ${active ? 'text-primary-600 scale-110' : 'text-slate-400'}`}
              >
                <Icon size={22} strokeWidth={active ? 3 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
              </button>
            );
          })}
          <button onClick={toggleTheme} className="flex flex-col items-center gap-1 p-2 text-slate-400">
            {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            <span className="text-[9px] font-bold uppercase tracking-tight">Tema</span>
          </button>
      </nav>
    </>
  );
};

export default Sidebar;
