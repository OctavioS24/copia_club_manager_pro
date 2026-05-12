
import React, { useState } from 'react';
import { Database, Sun, Moon, Shield, Users, UserCog, Wallet, Trophy, Stethoscope, Menu, X, LogOut } from 'lucide-react';
import { ClubConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

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
  const { role, user, signOut } = useAuth();

  const allMenuItems = [
    { id: 'squads', label: 'Planteles', icon: Users, roles: ['Admin', 'Entrenador'] },
    { id: 'central-medica', label: 'Médica', icon: Stethoscope, roles: ['Admin', 'Medico'] },
    { id: 'torneos', label: 'Torneos', icon: Trophy, roles: ['Admin'] },
    { id: 'members', label: 'Miembros', icon: UserCog, roles: ['Admin'] },
    { id: 'payments', label: 'Pagos', icon: Wallet, roles: ['Admin', 'Administrativo'] },
    { id: 'master-data', label: 'Estructura', icon: Database, roles: ['Admin'] },
  ];

  // Filtrar menú según rol
  const menu = allMenuItems.filter(item => 
    !role || role === 'Admin' || item.roles.includes(role)
  );

  const handleSetView = (id: string) => {
    setView(id);
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 md:h-24 bg-[var(--surface-card)]/70 backdrop-blur-2xl border-b border-[var(--surface-border)] z-[150] px-3 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6 min-w-0">
          <div 
            onClick={() => handleSetView('squads')}
            className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-primary-500 flex items-center justify-center cursor-pointer shadow-lg shadow-primary-500/20 hover:scale-105 transition-transform shrink-0"
          >
            {config.logo_url ? <img src={config.logo_url} className="w-full h-full object-contain p-1 md:p-2" /> : <Shield size={18} className="text-primary-contrast" />}
          </div>
          <div className="hidden xs:block min-w-0">
            <h1 className="font-black text-[9px] md:text-xs uppercase tracking-[0.1em] md:tracking-[0.3em] dark:text-white leading-none truncate max-w-[100px] sm:max-w-[150px] md:max-w-none">{config.name || 'MI CLUB'}</h1>
            <p className="text-[7px] md:text-[9px] font-bold text-primary-600 uppercase tracking-widest mt-0.5 md:mt-1 opacity-80 leading-none">Management System</p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-4 lg:gap-8">
          {/* DESKTOP MENU */}
          <div className="hidden md:flex gap-0.5 lg:gap-2">
            {menu.map(item => {
              const active = currentView === item.id || 
                            ((currentView === 'discipline-console' || currentView === 'squads-config') && item.id === 'squads');
              return (
                <button
                  key={item.id}
                  onClick={() => handleSetView(item.id)}
                  className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-4 py-2 lg:py-3 rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] uppercase tracking-widest transition-all ${active ? 'bg-primary-500 text-primary-contrast shadow-lg shadow-primary-500/20' : 'text-slate-400 hover:bg-surface-hover hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                  <item.icon size={14} />
                  <span className="hidden lg:inline-block xl:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
          
          <div className="w-px h-6 md:h-8 bg-[var(--surface-border)] mx-0.5 lg:mx-2 hidden md:block"></div>
          
          <div className="flex items-center gap-1 md:gap-2">
            <button 
              onClick={toggleTheme}
              className="p-3 rounded-2xl bg-surface-ground text-slate-400 hover:text-primary-600 transition-all"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* USER PROFILE & LOGOUT */}
            {user && (
              <div className="hidden md:flex items-center gap-3 ml-2 pl-4 border-l border-[var(--surface-border)]">
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-tighter dark:text-white leading-none mb-1">{user.user_metadata.full_name?.split(' ')[0]}</p>
                  <p className="text-[8px] font-bold text-primary-500 uppercase tracking-widest">{role}</p>
                </div>
                <button 
                  onClick={signOut}
                  className="p-3 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  title="Cerrar Sesión"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}

            {/* MOBILE HAMBURGER BUTTON */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-3 rounded-2xl bg-primary-500/10 text-primary-500 md:hidden hover:bg-primary-500 hover:text-primary-contrast transition-all z-[200]"
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
              className="fixed right-0 top-0 bottom-0 w-full sm:w-85 bg-[var(--surface-card)] shadow-2xl z-[190] md:hidden pt-32 px-6 flex flex-col gap-3"
            >
              <div className="mb-6 px-4">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter dark:text-white mb-1">Menú</h2>
                <div className="w-16 h-1.5 bg-primary-500 rounded-full shadow-[0_0_10px_var(--primary-glow)]" />
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
                      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${active ? 'bg-primary-500 text-primary-contrast shadow-lg shadow-primary-500/30' : 'text-slate-400 hover:bg-surface-hover'}`}
                    >
                      <item.icon size={20} />
                      <span>{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-auto mb-10 p-6 bg-surface-ground rounded-[2.5rem] border border-[var(--surface-border)]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <img 
                      src={user?.user_metadata.avatar_url} 
                      className="w-12 h-12 rounded-xl border-2 border-primary-500/20" 
                      alt="User"
                    />
                    <div>
                      <h3 className="font-black text-xs uppercase tracking-widest dark:text-white leading-none">{user?.user_metadata.full_name?.split(' ')[0]}</h3>
                      <p className="text-[9px] font-bold text-primary-500 uppercase tracking-widest mt-1">{role}</p>
                    </div>
                  </div>
                  <button 
                    onClick={signOut}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500"
                  >
                    <LogOut size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-4 pt-6 border-t border-[var(--surface-border)]">
                  <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
                    {config.logo_url ? <img src={config.logo_url} className="w-full h-full object-contain p-2" /> : <Shield size={18} className="text-primary-contrast" />}
                  </div>
                  <div>
                    <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white leading-none">{config.name || 'MI CLUB'}</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Management System</p>
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
