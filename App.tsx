
import React, { useState, useEffect, useCallback } from 'react';
import TopNav from './components/TopNav.tsx';
import MasterData from './components/MasterData.tsx';
import MemberManagement from './components/MemberManagement.tsx';
import FeesManagement from './components/FeesManagement.tsx';
import SplashScreen from './components/SplashScreen.tsx';
import { ClubConfig, Discipline, Member } from './types.ts';
import { db } from './lib/supabase.ts';
import { Shield, ArrowRight } from 'lucide-react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import SquadConfigView from './components/Squads/SquadConfigView.tsx';
import TorneosPrincipal from './components/Torneos/TorneosPrincipal.tsx';
import TournamentMatchesPage from './components/Torneos/TournamentMatchesPage.tsx';
import TournamentManagement from './components/TournamentManagement.tsx';
import CentralMedica from './components/CentralMedica/CentralMedica.tsx';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [members, setMembers] = useState<Member[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  
  const [config, setConfig] = useState<ClubConfig>({
    name: 'MI CLUB',
    logo_url: '',
    primary_color: '#ec4899',
    secondary_color: '#0f172a',
    disciplines: []
  });

  // SISTEMA DE PULSO AUTOMÁTICO (Keep Alive)
  useEffect(() => {
    const runKeepAlive = async () => {
      const lastPing = localStorage.getItem('supabase_keep_alive');
      const today = new Date().toISOString().split('T')[0];

      // Solo pingamos si no lo hemos hecho hoy, para ahorrar recursos
      if (lastPing !== today) {
        const success = await db.maintenance.ping();
        if (success) {
          localStorage.setItem('supabase_keep_alive', today);
        }
      }
    };

    // Ejecución inmediata al cargar la app
    runKeepAlive();

    // Si la aplicación se queda abierta (ej. una PC del club), 
    // verificamos cada 12 horas si necesitamos enviar un nuevo pulso
    const pulseInterval = setInterval(runKeepAlive, 1000 * 60 * 60 * 12);

    return () => clearInterval(pulseInterval);
  }, []);

  // Efecto de colores de marca
  useEffect(() => {
    const root = document.documentElement;
    const color = config.primary_color || '#ec4899';
    
    // Función simple para ajustar brillo (rudimentario para no añadir dependencias)
    const adjustColor = (hex: string, amount: number) => {
      let r = parseInt(hex.substring(1, 3), 16);
      let g = parseInt(hex.substring(3, 5), 16);
      let b = parseInt(hex.substring(5, 7), 16);
      
      r = Math.max(0, Math.min(255, r + amount));
      g = Math.max(0, Math.min(255, g + amount));
      b = Math.max(0, Math.min(255, b + amount));
      
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };

    root.style.setProperty('--primary-50', adjustColor(color, 200));
    root.style.setProperty('--primary-100', adjustColor(color, 160));
    root.style.setProperty('--primary-200', adjustColor(color, 120));
    root.style.setProperty('--primary-300', adjustColor(color, 80));
    root.style.setProperty('--primary-400', adjustColor(color, 40));
    root.style.setProperty('--primary-500', color);
    root.style.setProperty('--primary-600', adjustColor(color, -20));
    root.style.setProperty('--primary-700', adjustColor(color, -40));
    root.style.setProperty('--primary-800', adjustColor(color, -60));
    root.style.setProperty('--primary-900', adjustColor(color, -80));
    root.style.setProperty('--primary-glow', `${color}33`);

    // Secondary color shades
    const secondaryColor = config.secondary_color || '#0f172a';
    root.style.setProperty('--secondary-50', adjustColor(secondaryColor, 200));
    root.style.setProperty('--secondary-100', adjustColor(secondaryColor, 160));
    root.style.setProperty('--secondary-200', adjustColor(secondaryColor, 120));
    root.style.setProperty('--secondary-300', adjustColor(secondaryColor, 80));
    root.style.setProperty('--secondary-400', adjustColor(secondaryColor, 40));
    root.style.setProperty('--secondary-500', secondaryColor);
    root.style.setProperty('--secondary-600', adjustColor(secondaryColor, -20));
    root.style.setProperty('--secondary-700', adjustColor(secondaryColor, -40));
    root.style.setProperty('--secondary-800', adjustColor(secondaryColor, -60));
    root.style.setProperty('--secondary-900', adjustColor(secondaryColor, -80));
    root.style.setProperty('--secondary-glow', `${secondaryColor}33`);
  }, [config.primary_color, config.secondary_color]);

  // Efecto de tema oscuro
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDarkMode]);

  // FUNCIÓN DE CARGA OPTIMIZADA
  const fetchData = useCallback(async () => {
    try {
      const [configRes, membersRes] = await Promise.all([
        db.config.get(),
        db.members.getAll()
      ]);

      if (configRes.data) {
        const rawDisciplines: any[] = configRes.data.disciplines || [];
        const normalizedDisciplines = rawDisciplines.map(d => ({
          ...d,
          branches: d.branches || [
            { gender: 'Masculino', enabled: true, categories: d.categories || [] },
            { gender: 'Femenino', enabled: false, categories: [] }
          ]
        }));

        setConfig({
          name: configRes.data.name || 'MI CLUB',
          logo_url: configRes.data.logo_url || '',
          primary_color: configRes.data.primary_color || '#ec4899',
          secondary_color: configRes.data.secondary_color || '#0f172a',
          disciplines: normalizedDisciplines
        });
      }

      if (membersRes.data) {
        setMembers(membersRes.data);
      }

    } catch (err) {
      console.error("Error crítico en carga de datos:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveMember = async (member: Member) => {
    try {
      await db.members.upsert(member);
      fetchData(); // Recarga ligera
    } catch (e) {
      console.error("Error al guardar miembro:", e);
      throw e;
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await db.members.delete(id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.error("Error al eliminar miembro:", e);
    }
  };

  const handleEnterDiscipline = (disc: Discipline) => {
    setTransitioningId(disc.id);
    setTimeout(() => {
      navigate(`/squads/${disc.id}/config`);
      setTransitioningId(null);
    }, 400);
  };

  const handleSaveConfig = async (newConfig: ClubConfig) => {
    setConfig(newConfig);
    try {
      await db.config.update({
        name: newConfig.name,
        logo_url: newConfig.logo_url,
        primary_color: newConfig.primary_color,
        secondary_color: newConfig.secondary_color,
        disciplines: newConfig.disciplines,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error saving config:", e);
    }
  };

  if (isLoading) return <SplashScreen />;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-[#080a0f] text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans overflow-x-hidden`}>
      <TopNav 
        currentView={location.pathname === '/' || location.pathname.startsWith('/squads') ? 'squads' : location.pathname.slice(1)} 
        setView={(v) => navigate(v === 'squads' ? '/' : `/${v}`)} 
        isDarkMode={isDarkMode} 
        toggleTheme={() => setIsDarkMode(!isDarkMode)} 
        config={config}
      />
      
      <main className="flex-1 min-h-screen">
        <Routes>
          <Route path="/master-data" element={
            <div className="pt-24">
              <MasterData config={config} onSave={handleSaveConfig} />
            </div>
          } />

          <Route path="/members" element={
            <div className="pt-24">
              <MemberManagement 
                members={members} 
                config={config} 
                onSaveMember={handleSaveMember}
                onDeleteMember={handleDeleteMember}
              />
            </div>
          } />

          <Route path="/payments" element={
            <div className="pt-24">
              <FeesManagement />
            </div>
          } />

          <Route path="/central-medica" element={
            <div className="pt-24">
              <CentralMedica config={config} />
            </div>
          } />

          <Route path="/torneos" element={
            <div className="pt-24">
              <TorneosPrincipal />
            </div>
          } />

          <Route path="/torneos/:tournamentId" element={
            <div className="pt-24">
              <TournamentManagement clubConfig={config} />
            </div>
          } />

          <Route path="/torneos/:tournamentId/partidos" element={
            <div className="pt-24">
              <TournamentMatchesPage clubConfig={config} />
            </div>
          } />
          
          <Route path="/" element={
            <div className="pt-24 p-12 max-w-7xl mx-auto">
              <header className="mb-20 animate-fade-in flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none dark:text-white italic">Planteles</h2>
                  <div className="flex items-center gap-4 mt-6">
                      <div className="w-16 h-2 bg-primary-600 rounded-full shadow-[0_0_15px_var(--primary-glow)]"></div>
                      <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">Gestión por Disciplina</p>
                  </div>
                </div>
              </header>

              {config.disciplines.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                  {config.disciplines.map(disc => {
                    const isTransitioning = transitioningId === disc.id;
                    return (
                      <div 
                        key={disc.id}
                        onClick={() => !transitioningId && handleEnterDiscipline(disc)}
                        className={`group bg-white dark:bg-[#0f1219] rounded-[4rem] p-12 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-3xl transition-all duration-500 cursor-pointer relative overflow-hidden ${isTransitioning ? 'scale-110 opacity-0' : 'hover:-translate-y-2'}`}
                      >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-primary-600/5 rounded-bl-full group-hover:bg-primary-600/10 transition-all duration-700"></div>
                        <div className={`w-24 h-24 rounded-full bg-slate-950 flex items-center justify-center mb-10 shadow-2xl relative z-10 border-4 border-slate-100 dark:border-slate-800 transition-all duration-500 ${isTransitioning ? 'scale-[3] rotate-12' : 'group-hover:scale-110 group-hover:rotate-6'}`}>
                          {disc.iconUrl ? (
                            <img src={disc.iconUrl} className="w-full h-full object-cover rounded-full p-1" />
                          ) : (
                            <Shield size={32} className="text-primary-600" />
                          )}
                          <div className="absolute -inset-2 rounded-full border border-primary-600/20 animate-pulse group-hover:border-primary-600/50"></div>
                        </div>
                        <h3 className="text-4xl font-black uppercase tracking-tighter dark:text-white leading-none mb-4 italic group-hover:text-primary-600 transition-colors">{disc.name}</h3>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-8">Ecosistema Deportivo</p>
                        <div className="flex items-center gap-3 text-primary-600 font-black uppercase text-[10px] tracking-widest overflow-hidden">
                          <span className="group-hover:translate-x-0 -translate-x-full opacity-0 group-hover:opacity-100 transition-all duration-500">Explorar Consola</span>
                          <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform duration-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-40 text-center animate-fade-in">
                   <Shield size={64} className="mx-auto text-slate-200 mb-8" />
                   <h2 className="text-3xl font-black uppercase mb-4">Configuración Pendiente</h2>
                   <button onClick={() => navigate('/master-data')} className="bg-primary-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl">Definir Estructura</button>
                </div>
              )}
            </div>
          } />

          <Route path="/squads/:disciplineId/config" element={<SquadConfigView config={config} members={members} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
