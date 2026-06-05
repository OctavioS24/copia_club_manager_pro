
import React, { useState, useEffect } from 'react';
import { ClubConfig, Member } from '../../types';
import { 
  Stethoscope, Search, Edit2, Loader2, Filter, 
  User, AlertTriangle, CheckCircle, Activity, Clock
} from 'lucide-react';
import { db } from '../../lib/supabase';
import MedicalEditModal from './MedicalEditModal';

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

interface CentralMedicaProps {
  config: ClubConfig;
}

const CentralMedica: React.FC<CentralMedicaProps> = ({ config }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [players, setPlayers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Member | null>(null);

  // Flatten categories from all disciplines for the selector
  const allCategories = React.useMemo(() => {
    const cats: { id: string; name: string; discipline: string }[] = [];
    config.disciplines.forEach(disc => {
      disc.branches.forEach(branch => {
        branch.categories.forEach(cat => {
          cats.push({ id: cat.id, name: cat.name, discipline: disc.name });
        });
      });
    });
    return cats;
  }, [config]);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!selectedCategory) {
        setPlayers([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data } = await db.members.getAll();
        if (data) {
          // Filter by category and PLAYER/STAFF role, including Active and Injured
          const filtered = data.filter((m: any) => 
            (m.status === 'Active' || m.status === 'Injured') && 
            m.assignments?.some((a: any) => a.category_id === selectedCategory && (a.role === 'PLAYER' || a.role === 'STAFF'))
          );
          
          // Sort by last name (assuming name is "First Last")
          const sorted = [...filtered].sort((a, b) => {
            const nameA = a.name.split(' ').reverse().join(' ');
            const nameB = b.name.split(' ').reverse().join(' ');
            return nameA.localeCompare(nameB);
          });
          
          setPlayers(sorted);
        }
      } catch (err) {
        console.error("Error fetching players for CentralMedica:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [selectedCategory]);

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.dni.includes(searchTerm)
  );

  const handleEdit = (player: Member) => {
    setEditingPlayer(player);
    setShowModal(true);
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-fade-in pb-40">
      <header className="mb-10 md:mb-16">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 pb-8 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="w-10 h-10 md:w-16 md:h-16 bg-primary-600 rounded-xl md:rounded-3xl flex items-center justify-center text-white shadow-xl shadow-primary-600/20">
              <Stethoscope size={20} md:size={32} />
            </div>
            <div>
              <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none italic">
                Central <span className="text-primary-600">Médica</span>
              </h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[7px] md:text-[10px] mt-1 md:mt-2">Gestión de Salud e Integridad Física</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f1219] p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col md:flex-row gap-4 md:gap-6 items-center mt-6 md:mt-12">
          <div className="flex-1 w-full relative">
            <Filter size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-primary-600" />
            <select 
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/5 p-4 md:p-6 pl-14 md:pl-16 rounded-2xl md:rounded-[2rem] font-black text-xs uppercase tracking-widest dark:text-white outline-none border border-transparent focus:border-primary-600/30 appearance-none transition-all cursor-pointer shadow-inner"
            >
              <option value="">Seleccionar Categoría / Plantel</option>
              {allCategories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-900 font-sans">
                  {cat.discipline} - {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 w-full relative">
            <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!selectedCategory}
              className="w-full bg-slate-50 dark:bg-white/5 p-4 md:p-6 pl-14 md:pl-16 rounded-2xl md:rounded-[2rem] font-bold text-xs uppercase tracking-widest dark:text-white outline-none border border-transparent focus:border-primary-600/30 transition-all disabled:opacity-30 shadow-inner"
            />
          </div>
        </div>
      </header>

      {!selectedCategory ? (
        <div className="py-24 md:py-40 text-center bg-white dark:bg-white/5 rounded-[2.5rem] md:rounded-[4rem] border-4 border-dashed border-slate-200 dark:border-white/5">
          <Filter size={48} md:size={64} className="mx-auto mb-6 md:mb-8 text-slate-200 dark:text-white/10" />
          <h3 className="text-lg md:text-xl font-black uppercase text-slate-400 tracking-widest px-4">
            Selecciona una categoría para gestionar la salud de los atletas
          </h3>
        </div>
      ) : isLoading ? (
        <div className="py-40 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Sincronizando expedientes...</p>
        </div>
      ) : players.length === 0 ? (
        <div className="py-40 text-center">
           <User size={64} className="mx-auto mb-8 text-slate-200" />
           <p className="font-black uppercase text-slate-400 tracking-widest px-4 text-center">No se encontraron jugadores activos en esta categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {filteredPlayers.map(player => {
            const hasActiveInjury = player.status === 'Injured';
            const isFit = player.medical?.is_fit;
            const hasExpired = player.medical?.expiry_date ? new Date(player.medical.expiry_date) < new Date() : false;

            return (
              <div 
                key={player.id}
                onClick={() => handleEdit(player)}
                className="group bg-white dark:bg-[#0f1219] rounded-2xl md:rounded-[3.5rem] p-4 md:p-10 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl md:hover:-translate-y-2 transition-all relative overflow-hidden cursor-pointer"
              >
                {/* Mobile Layout: Horizontal Structured */}
                <div className="flex md:hidden items-center justify-between gap-4 py-1">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner shrink-0 relative border border-slate-200 dark:border-white/5 flex items-center justify-center">
                      {player.photourl ? (
                        <img src={player.photourl} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-primary-600 italic tracking-tighter">
                          {getInitials(player.name)}
                        </span>
                      )}
                      {hasExpired && (
                        <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                          <AlertTriangle size={14} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <h4 className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-tighter leading-tight italic truncate">{player.name}</h4>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">DNI: {player.dni}</span>
                          <span className={`text-[8px] font-black italic tracking-widest ${hasExpired ? 'text-orange-500' : 'text-slate-400 opacity-40'}`}>
                             {player.medical?.expiry_date ? player.medical.expiry_date.split('-').reverse().join('/') : 'N/A'}
                          </span>
                        </div>
                        <div className="flex pt-0.5">
                          {hasActiveInjury ? (
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 rounded-md border border-red-500/10"><Activity size={10} /> BAJA</span>
                          ) : hasExpired ? (
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 rounded-md border border-indigo-500/10"><Clock size={10} /> VENCIDO</span>
                          ) : !isFit ? (
                            <span className="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 rounded-md border border-orange-500/10"><AlertTriangle size={10} /> NO APTO</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 rounded-md border border-emerald-500/10"><CheckCircle size={10} /> APTO</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-primary-600 shadow-sm shrink-0">
                    <Edit2 size={18} />
                  </button>
                </div>

                {/* Desktop Layout: Cards (Hidden on Mobile) */}
                <div className="hidden md:block">
                  <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
                    <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-[1.5rem] bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner shrink-0 relative group-hover:scale-105 transition-transform border border-slate-200 dark:border-white/5 flex items-center justify-center">
                      {player.photourl ? (
                        <img src={player.photourl} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm md:text-lg font-black text-primary-600 italic tracking-tighter">
                          {getInitials(player.name)}
                        </span>
                      )}
                      {hasExpired && (
                        <div className="absolute inset-0 bg-orange-500/40 flex items-center justify-center" title="Ficha Vencida">
                          <AlertTriangle size={16} md:size={24} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base md:text-xl font-black uppercase text-slate-800 dark:text-white tracking-tighter leading-none italic truncate">{player.name}</h4>
                      <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 md:mt-2">DNI: {player.dni}</p>
                    </div>
                  </div>

                  <div className="space-y-3 md:space-y-4 mb-6 md:mb-10 pt-6 border-t border-slate-50 dark:border-white/5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">Estado</span>
                        {hasActiveInjury ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[9px] font-black tracking-[0.1em] animate-pulse">
                            <Activity size={12} className="shrink-0" /> Baja Médica
                          </span>
                        ) : hasExpired ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-xl text-[9px] font-black tracking-[0.1em]">
                            <Clock size={12} className="shrink-0" /> Vencido
                          </span>
                        ) : !isFit ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl text-[9px] font-black tracking-[0.1em]">
                            <AlertTriangle size={12} className="shrink-0" /> No Apto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[9px] font-black tracking-[0.1em]">
                            <CheckCircle size={12} className="shrink-0" /> Apto
                          </span>
                        )}
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">Vencimiento</span>
                        <span className={`${hasExpired ? 'text-orange-500 font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                          {player.medical?.expiry_date ? player.medical.expiry_date.split('-').reverse().join('/') : 'PENDIENTE'}
                        </span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(player); }}
                    className="w-full py-4 md:py-5 bg-slate-100 dark:bg-white/5 group-hover:bg-primary-600 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 md:gap-4 text-slate-400 group-hover:text-white transition-all shadow-inner font-black uppercase text-[10px] tracking-widest"
                  >
                    <Edit2 size={16} /> Gestionar Ficha
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && editingPlayer && (
        <MedicalEditModal 
          player={editingPlayer as any} 
          onClose={() => {
            setShowModal(false);
            setEditingPlayer(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingPlayer(null);
            // Refresh players
            setSelectedCategory(null);
            setTimeout(() => setSelectedCategory(selectedCategory), 10);
          }}
        />
      )}
    </div>
  );
};

export default CentralMedica;
