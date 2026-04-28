
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
              a.category_id === selectedDivision &&
              a.role === 'PLAYER'
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
            a.category_id === selectedDivision &&
            a.role === 'PLAYER'
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
        <div>
           <div className="flex items-center gap-4">
             <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Central Médica</h2>
             <button 
               onClick={async () => {
                 setIsLoading(true);
                 try {
                   const { data } = await db.members.getAll();
                   if (data && selectedDivision && selectedDiscipline) {
                     const filtered = data.filter((m: any) => 
                       m.assignments?.some((a: any) => 
                         a.discipline_id === selectedDiscipline && 
                         a.category_id === selectedDivision &&
                         a.role === 'PLAYER'
                       )
                     );
                     setPlayers(filtered);
                   }
                 } finally {
                   setIsLoading(false);
                 }
               }}
               className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-400 hover:text-primary-600 transition-all"
               title="Refrescar Datos"
             >
               <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
             </button>
           </div>
           <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Control de Salud e Integridad Física</p>
        </div>
        
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-md' : 'text-slate-400'}`}>Todos</button>
            <button onClick={() => setFilter('injured')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'injured' ? 'bg-white dark:bg-slate-700 text-red-500 shadow-md' : 'text-slate-400'}`}>Bajas</button>
            <button onClick={() => setFilter('ready')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'ready' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-md' : 'text-slate-400'}`}>Listos</button>
            <button onClick={() => setFilter('notfit')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'notfit' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-md' : 'text-slate-400'}`}>No Aptos</button>
            <button onClick={() => setFilter('expired')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'expired' ? 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-md' : 'text-slate-400'}`}>Vencidos</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
         <div className="bg-white dark:bg-slate-900 border border-secondary-600/20 dark:border-secondary-400/10 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bajas Médicas</span>
              <p className="text-5xl font-black text-red-600 italic mt-1">{injuredPlayersCount.length}</p>
            </div>
            <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <Activity size={28} />
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-secondary-600/20 dark:border-secondary-400/10 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atletas Listos</span>
              <p className="text-5xl font-black text-emerald-600 italic mt-1">{readyPlayersCount.length}</p>
            </div>
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <CheckCircle size={28} />
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-secondary-600/20 dark:border-secondary-400/10 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Aptos</span>
              <p className="text-5xl font-black text-orange-600 italic mt-1">{notFitPlayersCount.length}</p>
            </div>
            <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
              <AlertTriangle size={28} />
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-secondary-600/20 dark:border-secondary-400/10 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencidos</span>
              <p className="text-5xl font-black text-slate-600 dark:text-slate-400 italic mt-1">{expiredPlayersCount.length}</p>
            </div>
            <div className="w-14 h-14 bg-slate-50 dark:bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
              <Clock size={28} />
            </div>
         </div>
      </div>

      <div className="bg-white dark:bg-[#0f1219] rounded-[3.5rem] shadow-xl border border-secondary-600/30 dark:border-secondary-400/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-400 font-black uppercase tracking-widest text-[9px] border-b border-slate-100 dark:border-white/5">
                <th className="p-8">Atleta / Identidad</th>
                <th className="p-8">División</th>
                <th className="p-8">Estatus Médico</th>
                <th className="p-8">Vencimiento</th>
                <th className="p-8 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {displayPlayers.map(player => (
                <tr key={player.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-8">
                     <div className="flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner shrink-0">
                          <img src={player.photourl || 'https://via.placeholder.com/64'} className="w-full h-full object-cover" />
                       </div>
                       <div>
                          <span className="font-black text-slate-800 dark:text-white uppercase text-sm tracking-tighter block">{player.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {player.dni}</span>
                       </div>
                     </div>
                  </td>
                  <td className="p-8">
                     <div className="flex flex-col">
                        <span className="font-black text-[9px] uppercase text-primary-600 tracking-widest">{player.discipline}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{player.category}</span>
                     </div>
                  </td>
                  <td className="p-8">
                    {hasActiveInjury(player) ? (
                       <div className="flex items-center gap-2 text-red-600">
                          <Activity size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Baja Médica</span>
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
                  <td className="p-8">
                      <div className="flex items-center gap-3">
                         <div className={`flex items-center gap-2 text-[11px] font-black italic ${isExpired(player) ? 'text-red-600' : 'text-slate-500'}`}>
                            <Calendar size={14} className={isExpired(player) ? 'text-red-500' : 'text-primary-600'} />
                            {player.medical?.expiry_date || 'N/A'}
                         </div>
                         {isExpired(player) && (
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-[7px] font-black uppercase tracking-widest leading-none">Vencida</span>
                         )}
                      </div>
                  </td>
                  <td className="p-8 text-right">
                      <button 
                        onClick={() => handleViewClick(player)} 
                        className={`p-3 bg-slate-100 dark:bg-white/5 rounded-2xl transition-all shadow-sm border border-transparent dark:border-white/5 ${readOnly ? 'text-primary-600 hover:bg-primary-600 hover:text-white' : 'text-slate-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-800'}`}
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
