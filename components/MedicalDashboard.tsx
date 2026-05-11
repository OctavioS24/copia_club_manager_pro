
import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import { 
  Activity, AlertTriangle, CheckCircle, Calendar, 
  Edit2, Loader2, Clock, RefreshCw, Eye
} from 'lucide-react';
import { db } from '../lib/supabase';
import MedicalEditModal from './CentralMedica/MedicalEditModal';

interface MedicalDashboardProps {
  players?: Member[];
  onRefresh?: () => void;
  readOnly?: boolean;
}

import { useCategory } from '../context/useCategory';

const MedicalDashboard: React.FC<MedicalDashboardProps> = ({ 
  players: propPlayers, 
  onRefresh,
  readOnly = true 
}) => {
  const { selectedDivision, selectedDiscipline } = useCategory();
  const [players, setPlayers] = useState<Member[]>(propPlayers || []);
  const [filter, setFilter] = useState<'all' | 'injured' | 'expired' | 'ready' | 'notfit'>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch players if needed
  useEffect(() => {
    const fetchPlayers = async () => {
      if (propPlayers) return;

      setIsLoading(true);
      try {
        const { data } = await db.members.getAll();
        if (data && selectedDivision && selectedDiscipline) {
          const filtered = data.filter((m: any) => 
            m.assignments?.some((a: any) => 
              a.discipline_id === selectedDiscipline && 
              a.category_id === selectedDivision
            )
          );
          setPlayers(filtered);
        }
      } catch (err) {
        console.error("Error fetching players for MedicalDashboard:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [propPlayers, selectedDivision, selectedDiscipline]);
  
  const handleViewClick = (player: Member) => {
    setSelectedPlayer(player);
    setShowModal(true);
  };

  const handleSave = async () => {
    // Refresh local state or call parent refresh
    if (onRefresh) {
      onRefresh();
    } else {
      // Fallback refresh
      const { data } = await db.members.getAll();
      if (data && selectedDivision && selectedDiscipline) {
         const filtered = data.filter((m: any) => 
          m.assignments?.some((a: any) => 
            a.discipline_id === selectedDiscipline && 
            a.category_id === selectedDivision
          )
        );
        setPlayers(filtered);
      }
    }
    setShowModal(false);
  };

  const isExpired = (p: Member) => {
    if (!p.medical?.expiry_date) return false;
    return new Date(p.medical.expiry_date) < new Date();
  };

  const hasActiveInjury = (p: Member) => {
    return p.status === 'Injured';
  };

  const isNotFit = (p: Member) => {
    return !hasActiveInjury(p) && !p.medical?.is_fit;
  };

  const isApto = (p: Member) => {
    return !hasActiveInjury(p) && p.medical?.is_fit;
  };

  const injuredPlayersCount = players.filter(hasActiveInjury);
  const notFitPlayersCount = players.filter(isNotFit);
  const readyPlayersCount = players.filter(isApto);
  const expiredPlayersCount = players.filter(isExpired);

  const displayPlayers = React.useMemo(() => {
    switch (filter) {
      case 'injured': return injuredPlayersCount;
      case 'notfit': return notFitPlayersCount;
      case 'ready': return readyPlayersCount;
      case 'expired': return expiredPlayersCount;
      default: return players;
    }
  }, [filter, players, injuredPlayersCount, notFitPlayersCount, readyPlayersCount, expiredPlayersCount]);

  if (isLoading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Sincronizando estado médico...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10 h-full overflow-y-auto custom-scrollbar">
      <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="w-full">
           <div className="flex items-center justify-between lg:justify-start gap-4">
             <h2 className="text-3xl md:text-4xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Central Médica</h2>
             <button 
               onClick={async () => {
                 setIsLoading(true);
                 try {
                   const { data } = await db.members.getAll();
                   if (data && selectedDivision && selectedDiscipline) {
                     const filtered = data.filter((m: any) => 
                       m.assignments?.some((a: any) => 
                         a.discipline_id === selectedDiscipline && 
                         a.category_id === selectedDivision
                       )
                     );
                     setPlayers(filtered);
                   }
                 } finally {
                   setIsLoading(false);
                 }
               }}
               className="p-2.5 bg-surface-ground rounded-xl text-[var(--text-muted)] hover:text-primary-600 transition-all"
               title="Refrescar Datos"
             >
               <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
             </button>
           </div>
           <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-[8px] md:text-[10px] mt-1">Control de Salud e Integridad Física</p>
        </div>
        
        <div className="w-full lg:w-auto overflow-x-auto no-scrollbar scroll-smooth">
          <div className="flex gap-2 p-1.5 bg-surface-ground rounded-2xl border border-[var(--surface-border)] min-w-max">
              <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-surface-card text-primary-600 shadow-md' : 'text-[var(--text-muted)]'}`}>Todos</button>
              <button onClick={() => setFilter('injured')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'injured' ? 'bg-surface-card text-red-500 shadow-md' : 'text-[var(--text-muted)]'}`}>Bajas</button>
              <button onClick={() => setFilter('ready')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'ready' ? 'bg-surface-card text-emerald-500 shadow-md' : 'text-[var(--text-muted)]'}`}>Listos</button>
              <button onClick={() => setFilter('notfit')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'notfit' ? 'bg-surface-card text-orange-500 shadow-md' : 'text-[var(--text-muted)]'}`}>No Aptos</button>
              <button onClick={() => setFilter('expired')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'expired' ? 'bg-surface-card text-[var(--text-main)] shadow-md' : 'text-[var(--text-muted)]'}`}>Vencidos</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-10">
         <div className="bg-surface-card border border-[var(--surface-border)] p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Bajas Médicas</span>
              <p className="text-2xl md:text-5xl font-black text-red-600 italic mt-1">{injuredPlayersCount.length}</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 bg-red-600/10 rounded-xl md:rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <Activity size={18} md:size={28} />
            </div>
         </div>

         <div className="bg-surface-card border border-[var(--surface-border)] p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Atletas Listos</span>
              <p className="text-2xl md:text-5xl font-black text-emerald-600 italic mt-1">{readyPlayersCount.length}</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 bg-emerald-600/10 rounded-xl md:rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <CheckCircle size={18} md:size={28} />
            </div>
         </div>

         <div className="bg-surface-card border border-[var(--surface-border)] p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">No Aptos</span>
              <p className="text-2xl md:text-5xl font-black text-orange-600 italic mt-1">{notFitPlayersCount.length}</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 bg-orange-600/10 rounded-xl md:rounded-2xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
              <AlertTriangle size={18} md:size={28} />
            </div>
         </div>

         <div className="bg-surface-card border border-[var(--surface-border)] p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Vencidos</span>
              <p className="text-2xl md:text-5xl font-black text-[var(--text-muted)] italic mt-1">{expiredPlayersCount.length}</p>
            </div>
            <div className="w-10 h-10 md:w-14 md:h-14 bg-surface-ground rounded-xl md:rounded-2xl flex items-center justify-center text-[var(--text-muted)] group-hover:scale-110 transition-transform">
              <Clock size={18} md:size={28} />
            </div>
         </div>
      </div>

      <div className="bg-surface-card rounded-[2.5rem] md:rounded-[3.5rem] shadow-xl border border-[var(--surface-border)] overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-hover text-[var(--text-muted)] font-black uppercase tracking-widest text-[9px] border-b border-[var(--surface-border)]">
                <th className="px-6 md:p-8 py-6">Atleta / Identidad</th>
                <th className="px-6 md:p-8 py-6">División</th>
                <th className="px-6 md:p-8 py-6">Estatus Médico</th>
                <th className="px-6 md:p-8 py-6">Vencimiento</th>
                <th className="px-6 md:p-8 py-6 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y border-[var(--surface-border)]">
              {displayPlayers.map(player => (
                <tr key={player.id} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-6 md:p-8 py-4 md:py-6">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-surface-ground overflow-hidden shadow-inner shrink-0">
                          <img src={player.photourl || 'https://via.placeholder.com/64'} className="w-full h-full object-cover" />
                       </div>
                       <div>
                          <span className="font-black text-[var(--text-main)] uppercase text-sm tracking-tighter block line-clamp-1">{player.name}</span>
                          <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">DNI: {player.dni}</span>
                       </div>
                     </div>
                  </td>
                  <td className="px-6 md:p-8 py-4 md:py-6">
                     <div className="flex flex-col text-left">
                        <span className="font-black text-[9px] uppercase text-primary-600 tracking-widest">{player.discipline}</span>
                        <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase">{player.category}</span>
                     </div>
                  </td>
                  <td className="px-6 md:p-8 py-4 md:py-6">
                    {hasActiveInjury(player) ? (
                       <div className="flex items-center gap-2 text-red-600">
                          <Activity size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Baja</span>
                       </div>
                    ) : isNotFit(player) ? (
                       <div className="flex items-center gap-2 text-orange-600">
                          <AlertTriangle size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">No Apto</span>
                       </div>
                    ) : (
                       <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Apto</span>
                       </div>
                    )}
                  </td>
                  <td className="px-6 md:p-8 py-4 md:py-6">
                      <div className="flex items-center gap-3">
                         <div className={`flex items-center gap-2 text-[10px] md:text-[11px] font-black italic ${isExpired(player) ? 'text-red-600' : 'text-[var(--text-muted)]'}`}>
                            <Calendar size={14} className={isExpired(player) ? 'text-red-500' : 'text-primary-600'} />
                            {player.medical?.expiry_date || 'N/A'}
                         </div>
                         {isExpired(player) && (
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-[7px] font-black uppercase tracking-widest leading-none">Venc.</span>
                         )}
                      </div>
                  </td>
                  <td className="px-6 md:p-8 py-4 md:py-6 text-right">
                      <button 
                        onClick={() => handleViewClick(player)} 
                        className={`p-2.5 md:p-3 bg-surface-ground rounded-xl md:rounded-2xl transition-all shadow-sm border border-[var(--surface-border)] ${readOnly ? 'text-primary-600 hover:bg-primary-600 hover:text-white' : 'text-[var(--text-muted)] hover:text-primary-600 hover:bg-surface-card'}`}
                        title={readOnly ? "Ver Ficha Médica" : "Gestionar Ficha Médica"}
                      >
                          {readOnly ? <Eye size={16} /> : <Edit2 size={16} />}
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedPlayer && (
        <MedicalEditModal 
          player={selectedPlayer}
          readOnly={readOnly}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default MedicalDashboard;
