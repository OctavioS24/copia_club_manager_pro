
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
      <div className="mb-6 md:mb-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 md:gap-8">
        <div className="shrink-0">
           <div className="flex items-center gap-4">
             <h2 className="text-2xl md:text-5xl font-black text-[var(--text-main)] uppercase tracking-tighter italic leading-none transition-all">Central Médica</h2>
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
               className="p-3 bg-surface-ground rounded-xl text-[var(--text-muted)] hover:text-primary-600 transition-all hover:scale-110 active:scale-95 shadow-sm border border-[var(--surface-border)]"
               title="Refrescar Datos"
             >
               <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
             </button>
           </div>
           <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.3em] text-[8px] md:text-xs mt-3 opacity-60">Control de Salud e Integridad Física</p>
        </div>
        
        <div className="w-full xl:w-auto">
          <div className="flex items-center gap-1.5 p-1.5 bg-surface-ground rounded-2xl border border-[var(--surface-border)] overflow-x-auto no-scrollbar scroll-smooth shadow-inner">
              <button 
                onClick={() => setFilter('all')} 
                className={`px-4 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'all' ? 'bg-surface-card text-primary-600 shadow-lg' : 'text-[var(--text-muted)] hover:text-primary-600'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilter('injured')} 
                className={`px-4 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'injured' ? 'bg-surface-card text-red-500 shadow-lg' : 'text-[var(--text-muted)] hover:text-red-500'}`}
              >
                Bajas
              </button>
              <button 
                onClick={() => setFilter('ready')} 
                className={`px-4 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'ready' ? 'bg-surface-card text-emerald-500 shadow-lg' : 'text-[var(--text-muted)] hover:text-emerald-500'}`}
              >
                Listos
              </button>
              <button 
                onClick={() => setFilter('notfit')} 
                className={`px-4 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'notfit' ? 'bg-surface-card text-orange-500 shadow-lg' : 'text-[var(--text-muted)] hover:text-orange-500'}`}
              >
                No Aptos
              </button>
              <button 
                onClick={() => setFilter('expired')} 
                className={`px-4 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === 'expired' ? 'bg-surface-card text-indigo-500 shadow-lg' : 'text-[var(--text-muted)] hover:text-indigo-500'}`}
              >
                Vencidos
              </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 mb-8 md:mb-10">
         <div className="bg-surface-card border border-[var(--surface-border)] p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-tight">Bajas Médicas</span>
              <p className="text-xl md:text-5xl font-black text-red-600 italic mt-0.5 md:mt-1">{injuredPlayersCount.length}</p>
            </div>
            <div className="w-8 h-8 md:w-14 md:h-14 bg-red-600/10 rounded-lg md:rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <Activity size={14} md:size={28} />
            </div>
         </div>

         <div className="bg-surface-card border border-[var(--surface-border)] p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-tight">Atletas Listos</span>
              <p className="text-xl md:text-5xl font-black text-emerald-600 italic mt-0.5 md:mt-1">{readyPlayersCount.length}</p>
            </div>
            <div className="w-8 h-8 md:w-14 md:h-14 bg-emerald-600/10 rounded-lg md:rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <CheckCircle size={14} md:size={28} />
            </div>
         </div>

         <div className="bg-surface-card border border-[var(--surface-border)] p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-tight">No Aptos</span>
              <p className="text-xl md:text-5xl font-black text-orange-600 italic mt-0.5 md:mt-1">{notFitPlayersCount.length}</p>
            </div>
            <div className="w-8 h-8 md:w-14 md:h-14 bg-orange-600/10 rounded-lg md:rounded-2xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
              <AlertTriangle size={14} md:size={28} />
            </div>
         </div>

         <div className="bg-surface-card border border-[var(--surface-border)] p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-tight">Vencidos</span>
              <p className="text-xl md:text-5xl font-black text-indigo-500 italic mt-0.5 md:mt-1">{expiredPlayersCount.length}</p>
            </div>
            <div className="w-8 h-8 md:w-14 md:h-14 bg-indigo-500/10 rounded-lg md:rounded-2xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
              <Clock size={14} md:size={28} />
            </div>
         </div>
      </div>

      <div className="bg-surface-card rounded-[2.5rem] md:rounded-[3.5rem] shadow-xl border border-[var(--surface-border)] overflow-hidden">
        {/* Mobile-only view: Structured compact list */}
        <div className="md:hidden divide-y divide-[var(--surface-border)]">
          {displayPlayers.map(player => (
            <div 
              key={player.id} 
              onClick={() => handleViewClick(player)}
              className="p-5 flex items-center justify-between group active:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-5 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-surface-ground overflow-hidden shadow-inner shrink-0 relative border border-[var(--surface-border)]">
                  <img src={player.photourl || 'https://via.placeholder.com/64'} className="w-full h-full object-cover" />
                  {isExpired(player) && (
                    <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                      <Clock size={14} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <h4 className="font-black text-[var(--text-main)] uppercase text-sm tracking-tighter block line-clamp-1 italic leading-tight">{player.name}</h4>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">DNI: {player.dni}</span>
                    <div className="flex items-center gap-2">
                       {player.medical?.expiry_date && (
                         <span className={`text-[8px] font-black italic ${isExpired(player) ? 'text-red-500' : 'text-[var(--text-muted)] opacity-40'}`}>
                           Exp: {player.medical.expiry_date.split('-').reverse().join('/')}
                         </span>
                       )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {hasActiveInjury(player) ? (
                  <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 border border-red-500/20">
                    <Activity size={10} /> BAJA
                  </span>
                ) : isExpired(player) ? (
                  <span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 border border-indigo-500/20">
                    <Clock size={10} /> VENCIDO
                  </span>
                ) : isNotFit(player) ? (
                  <span className="px-2 py-1 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 border border-orange-500/20">
                    <AlertTriangle size={10} /> NO APTO
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 border border-emerald-500/20">
                    <CheckCircle size={10} /> APTO
                  </span>
                )}
                <button 
                  className="p-2 bg-primary-600/10 text-primary-600 rounded-lg hover:bg-primary-600 hover:text-white transition-all"
                >
                  {readOnly ? <Eye size={16} /> : <Edit2 size={16} />}
                </button>
              </div>
            </div>
          ))}
          {displayPlayers.length === 0 && (
            <div className="py-24 text-center text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest italic opacity-40">
              Sin atletas en esta vista
            </div>
          )}
        </div>

        {/* Desktop-only view: Full Table */}
        <div className="hidden md:block overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-hover text-[var(--text-muted)] font-black uppercase tracking-widest text-[9px] border-b border-[var(--surface-border)]">
                <th className="px-3 md:px-8 py-6 text-left">Atleta / Identidad</th>
                <th className="px-3 md:px-8 py-6 text-center">Estatus Médico</th>
                <th className="px-3 md:px-8 py-6 text-center">Vencimiento</th>
                <th className="px-3 md:px-8 py-6 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y border-[var(--surface-border)]">
              {displayPlayers.map(player => (
                <tr key={player.id} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-3 md:px-8 py-4 md:py-6">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-surface-ground overflow-hidden shadow-inner shrink-0 leading-none group-hover:scale-105 transition-transform border border-[var(--surface-border)]">
                          <img src={player.photourl || 'https://via.placeholder.com/64'} className="w-full h-full object-cover" />
                       </div>
                       <div>
                          <span className="font-black text-[var(--text-main)] uppercase text-sm tracking-tighter block line-clamp-1 italic group-hover:text-primary-600 transition-colors">{player.name}</span>
                          <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-60">DNI: {player.dni}</span>
                       </div>
                     </div>
                  </td>
                  <td className="px-3 md:px-8 py-4 md:py-6 text-center">
                    <div className="flex justify-center">
                      {hasActiveInjury(player) ? (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-600 border border-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-[0.15em]">
                            <Activity size={12} className="shrink-0" />
                            Baja
                         </span>
                      ) : isExpired(player) ? (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 rounded-lg text-[9px] font-black uppercase tracking-[0.15em]">
                            <Clock size={12} className="shrink-0" />
                            Vencido
                         </span>
                      ) : isNotFit(player) ? (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-600 border border-orange-500/20 rounded-lg text-[9px] font-black uppercase tracking-[0.15em]">
                            <AlertTriangle size={12} className="shrink-0" />
                            No Apto
                         </span>
                      ) : (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-[0.15em]">
                            <CheckCircle size={12} className="shrink-0" />
                            Apto
                         </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 md:px-8 py-4 md:py-6">
                      <div className="flex items-center justify-center gap-3">
                          <div className={`flex items-center gap-2 text-[10px] md:text-[11px] font-black italic ${isExpired(player) ? 'text-red-600' : 'text-[var(--text-muted)]'}`}>
                             <Calendar size={14} className={isExpired(player) ? 'text-red-500' : 'text-primary-600'} />
                             {player.medical?.expiry_date ? player.medical.expiry_date.split('-').reverse().join('/') : 'N/A'}
                          </div>
                      </div>
                  </td>
                  <td className="px-3 md:px-8 py-4 md:py-6 text-right">
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
