
import React, { useState } from 'react';
import { Database, Sun, Moon, Shield, Users, UserCog, Wallet, Trophy, Stethoscope, Menu, X } from 'lucide-react';
import { ClubConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menu = [
    { id: 'squads', label: 'Planteles', icon: Users },
    { id: 'central-medica', label: 'Médica', icon: Stethoscope },
    { id: 'torneos', label: 'Torneos', icon: Trophy },
    { id: 'members', label: 'Miembros', icon: UserCog },
    { id: 'payments', label: 'Pagos', icon: Wallet },
    { id: 'master-data', label: 'Estructura', icon: Database },
  ];

  const handleSetView = (id: string) => {
    setView(id);
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-24 bg-white/70 dark:bg-[#080a0f]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 z-[150] px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div 
            onClick={() => handleSetView('squads')}
            className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center cursor-pointer shadow-lg shadow-primary-600/20 hover:scale-105 transition-transform"
          >
            {config.logo_url ? <img src={config.logo_url} className="w-full h-full object-contain p-2" /> : <Shield size={22} className="text-white" />}
          </div>
          <div className="hidden md:block">
            <h1 className="font-black text-xs uppercase tracking-[0.3em] dark:text-white leading-none">{config.name || 'MI CLUB'}</h1>
            <p className="text-[9px] font-bold text-primary-600 uppercase tracking-widest mt-1">Management System</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-8">
          {/* DESKTOP MENU */}
          <div className="hidden md:flex gap-1 md:gap-4">
            {menu.map(item => {
              const active = currentView === item.id || 
                            ((currentView === 'discipline-console' || currentView === 'squads-config') && item.id === 'squads');
              return (
                <button
                  key={item.id}
                  onClick={() => handleSetView(item.id)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${active ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                >
                  <item.icon size={16} />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
          
          <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-2 hidden md:block"></div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary-600 transition-all"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* MOBILE HAMBURGER BUTTON */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-3 rounded-2xl bg-primary-600/10 text-primary-600 md:hidden hover:bg-primary-600 hover:text-white transition-all z-[200]"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE OVERLAY MENU */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[180] md:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-85 bg-white dark:bg-[#080a0f] shadow-2xl z-[190] md:hidden pt-32 px-6 flex flex-col gap-3"
            >
              <div className="mb-6 px-4">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter dark:text-white mb-1">Menú</h2>
                <div className="w-16 h-1.5 bg-primary-600 rounded-full shadow-[0_0_10px_var(--primary-glow)]" />
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-2">
                {menu.map((item, idx) => {
                  const active = currentView === item.id || 
                                ((currentView === 'discipline-console' || currentView === 'squads-config') && item.id === 'squads');
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleSetView(item.id)}
                      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${active ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                      <item.icon size={20} />
                      <span>{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-auto mb-10 p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/20">
                    {config.logo_url ? <img src={config.logo_url} className="w-full h-full object-contain p-2" /> : <Shield size={20} className="text-white" />}
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-widest dark:text-white leading-none">{config.name || 'MI CLUB'}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management System</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default TopNav;
