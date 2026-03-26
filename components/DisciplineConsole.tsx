
import React, { useState, useEffect, useMemo } from 'react';
import { Discipline, ClubConfig, Member, Player, Category, Tournament } from '../types';
import { 
  BarChart3, Users, CalendarCheck2, Stethoscope, ChevronLeft, 
  Activity, Trophy, TrendingUp, Filter, Loader2, User, UserCheck,
  ChevronUp, ChevronDown, LayoutDashboard
} from 'lucide-react';
import Dashboard from './Dashboard';
import AttendanceTracker from './AttendanceTracker';
import MedicalDashboard from './MedicalDashboard';
import PlayerCard from './PlayerCard';
import TournamentManagement from './TournamentManagement';
import { db } from '../lib/supabase';

interface DisciplineConsoleProps {
  discipline: Discipline;
  clubConfig: ClubConfig;
  members: Member[];
  onBack: () => void;
  onRefresh?: () => Promise<void> | void;
}

const DisciplineConsole: React.FC<DisciplineConsoleProps> = ({ discipline, clubConfig, members, onBack, onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'players' | 'attendance' | 'medical' | 'tournaments'>('summary');
  const [selectedGender, setSelectedGender] = useState<'Masculino' | 'Femenino'>('Masculino');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [persistedPlayers, setPersistedPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);

  const activeBranch = useMemo(() => 
    discipline.branches.find(b => b.gender === selectedGender && b.enabled),
  [discipline, selectedGender]);

  useEffect(() => {
    if (activeBranch && activeBranch.categories.length > 0) {
      if (!activeBranch.categories.find(c => c.id === selectedCategoryId)) {
        setSelectedCategoryId(activeBranch.categories[0].id);
      }
    }
  }, [activeBranch]);

  const fetchPlayersData = async () => {
    if (!selectedCategoryId || !activeBranch) return;
    setIsLoadingPlayers(true);
    try {
      const categoryName = activeBranch.categories.find(c => c.id === selectedCategoryId)?.name;
      const { data } = await db.players.getAll();
      if (data) {
        const filtered = data.filter(p => {
          const matchesDisc = p.discipline === discipline.name;
          const matchesCat = p.category === categoryName;
          return matchesDisc && matchesCat;
        });
        setPersistedPlayers(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  useEffect(() => {
    fetchPlayersData();
  }, [selectedCategoryId, discipline.name, selectedGender]);

  const displayPlayers = useMemo(() => {
    if (!selectedCategoryId) return [];
    
    const assignedMembers = members.filter(m => {
      if (!m.assignments) return false;
      return m.assignments.some((a: any) => {
        // Robustez: Comprobamos IDs con y sin guiones bajos
        const aDiscId = a.discipline_id || a.disciplineId;
        const aCatId = a.category_id || a.categoryId;
        
        return aDiscId === discipline.id && aCatId === selectedCategoryId && a.role === 'PLAYER';
      });
    });

    return assignedMembers.map(m => {
      const savedData = persistedPlayers.find(p => p.dni === m.dni || p.id === m.id);
      const categoryName = activeBranch?.categories.find(c => c.id === selectedCategoryId)?.name || '';
      return {
        id: m.id,
        name: m.name,
        dni: m.dni,
        number: savedData?.number || '00',
        position: savedData?.position || 'N/A',
        discipline: discipline.name,
        gender: m.gender,
        category: categoryName,
        photoUrl: m.photoUrl,
        email: m.email,
        overallRating: savedData?.overallRating || 0,
        stats: savedData?.stats || {},
        medical: savedData?.medical || { isFit: true, expiryDate: '' },
        status: savedData?.status || 'Active'
      };
    });
  }, [members, discipline.id, discipline.name, selectedCategoryId, persistedPlayers, activeBranch]);

  const subTabs = [
    { id: 'summary', label: 'Dashboard', icon: BarChart3 },
    { id: 'players', label: 'Plantel', icon: Users },
    { id: 'attendance', label: 'Presentes', icon: CalendarCheck2 },
    { id: 'tournaments', label: 'Torneos', icon: Trophy },
    { id: 'medical', label: 'Médico', icon: Stethoscope },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] mt-24 animate-fade-in overflow-hidden bg-slate-50 dark:bg-[#080a0f] border-t border-slate-200 dark:border-white/5">
      <header className={`relative flex-none bg-white dark:bg-[#0f1219] border-b border-slate-200 dark:border-white/10 z-[140] shadow-sm transition-all duration-300 ${isHeaderCollapsed ? 'pb-1' : 'pb-4'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div className={`flex items-center gap-4 w-full md:w-auto transition-all ${isHeaderCollapsed ? 'scale-90 origin-left' : ''}`}>
              <button onClick={onBack} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-400 hover:text-primary-600 transition-all">
                <ChevronLeft size={18} strokeWidth={2.5} />
              </button>
              <div className="flex items-center gap-3">
                <div className={`rounded-xl bg-slate-950 flex items-center justify-center shadow-xl border border-primary-600/30 transition-all ${isHeaderCollapsed ? 'w-8 h-8' : 'w-10 h-10'}`}>
                  {discipline.iconUrl ? <img src={discipline.iconUrl} className="w-full h-full object-cover p-1" /> : <Activity size={isHeaderCollapsed ? 14 : 20} className="text-primary-600" />}
                </div>
                <div>
                  <h2 className={`font-black uppercase tracking-tighter dark:text-white italic transition-all ${isHeaderCollapsed ? 'text-lg' : 'text-2xl'}`}>{discipline.name}</h2>
                </div>
              </div>
            </div>

            <div className={`flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto no-scrollbar transition-all ${isHeaderCollapsed ? 'scale-95' : ''}`}>
              {subTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <tab.icon size={12} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`grid transition-all duration-500 ease-in-out ${isHeaderCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none mb-0' : 'grid-rows-[1fr] opacity-100 mb-4'}`}>
            <div className="overflow-hidden">
                <div className="flex flex-col md:flex-row gap-6 border-t border-slate-100 dark:border-white/5 pt-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Rama</span>
                      <div className="flex gap-1.5">
                        {['Masculino', 'Femenino'].map(g => (
                          <button key={g} onClick={() => setSelectedGender(g as any)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${selectedGender === g ? 'bg-slate-950 text-white border-slate-950 shadow-md' : 'bg-transparent border-slate-100 dark:border-white/10 text-slate-400 opacity-60'}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">División</span>
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
                        {activeBranch?.categories.map(cat => (
                          <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${selectedCategoryId === cat.id ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-400'}`}>
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 z-[200]">
          <button 
            onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)} 
            className="w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-primary-600 shadow-[0_4px_10px_rgba(0,0,0,0.1)] hover:scale-110 transition-all cursor-pointer"
          >
            {isHeaderCollapsed ? <ChevronDown size={12} strokeWidth={3} /> : <ChevronUp size={12} strokeWidth={3} />}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#080a0f] p-4 md:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {isLoadingPlayers ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="animate-spin text-primary-600 mb-2" size={24} />
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Sincronizando...</p>
            </div>
          ) : (
            <>
              {activeSubTab === 'summary' && <Dashboard currentCategory={activeBranch?.categories.find(c => c.id === selectedCategoryId)?.name || 'General'} />}
              {activeSubTab === 'players' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-fade-in">
                  {displayPlayers.map(athlete => (
                    <div key={athlete.id} onClick={() => setSelectedPlayer(athlete)} className="bg-white dark:bg-[#0f1219] rounded-2xl p-4 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border-2 border-slate-50 dark:border-slate-800 p-1 mb-3 group-hover:scale-110 transition-transform relative">
                          <img src={athlete.photoUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover rounded-full" />
                          <div className="absolute -bottom-1 -right-1 bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-black italic text-[8px] shadow-lg">{athlete.overallRating}</div>
                        </div>
                        <h3 className="font-black uppercase tracking-tighter text-xs text-slate-800 dark:text-white text-center leading-none truncate w-full">{athlete.name}</h3>
                        <p className="text-[7px] font-black text-primary-600 mt-1 uppercase">{athlete.position} #{athlete.number}</p>
                    </div>
                  ))}
                  {displayPlayers.length === 0 && (
                     <div className="col-span-full py-20 text-center opacity-30 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem]">
                        <Users size={48} className="mx-auto mb-4" />
                        <p className="text-[9px] font-black uppercase tracking-widest">No hay atletas asignados a esta división</p>
                        <p className="text-[8px] font-bold uppercase mt-2">Verifica el rol JUGADOR en Miembros</p>
                     </div>
                  )}
                </div>
              )}
              {activeSubTab === 'attendance' && <AttendanceTracker players={displayPlayers} clubConfig={clubConfig} forceSelectedDisc={discipline.name} />}
              {activeSubTab === 'tournaments' && (
                <TournamentManagement 
                  discipline={discipline} 
                  category={activeBranch?.categories.find(c => c.id === selectedCategoryId) || null}
                  gender={selectedGender}
                  players={displayPlayers}
                  clubConfig={clubConfig}
                />
              )}
              {activeSubTab === 'medical' && <MedicalDashboard players={displayPlayers} onRefresh={fetchPlayersData} />}
            </>
          )}
        </div>
      </div>

      {selectedPlayer && (
        <PlayerCard 
          player={selectedPlayer} 
          onClose={() => setSelectedPlayer(null)} 
          onSaveSuccess={() => fetchPlayersData()}
          clubConfig={clubConfig}
        />
      )}
    </div>
  );
};

export default DisciplineConsole;
