
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Filter, Plus, Edit3, Calendar, Trophy, Loader2, AlertTriangle, Activity, RefreshCcw, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Tournament, Match, Rival, Player, ClubConfig } from '../../types';
import { getPartidosByTorneo, updateMatchStatus, rescheduleMatch, suspendFullDate, resumeFullDate } from '../../lib/torneos';
import { getRivals } from '../../lib/rivals';
import { db } from '../../lib/supabase';
import { getPlayersByCategory } from '../../lib/playerUtils';
import CargarResultadoModal from './CargarResultadoModal';
import AgregarFechaModal from './AgregarFechaModal';
import ConvocatoriaModal from './ConvocatoriaModal';

interface VerPartidosProps {
  tournament: Tournament;
  onBack: () => void;
  clubName: string;
  clubConfig: ClubConfig;
}

const VerPartidos: React.FC<VerPartidosProps> = ({ tournament, onBack, clubName, clubConfig }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [showResultModal, setShowResultModal] = useState(false);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [showAddFechaModal, setShowAddFechaModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [categoryPlayers, setCategoryPlayers] = useState<Player[]>([]);
  
  // Suspension State
  const [suspensionMode, setSuspensionMode] = useState<'match' | 'date' | null>(null);
  const [suspensionTarget, setSuspensionTarget] = useState<Match | string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [suspensionNewDate, setSuspensionNewDate] = useState('');
  const [isProcessingSuspension, setIsProcessingSuspension] = useState(false);

  const getCategoryName = (catId: string) => {
    if (!clubConfig) return catId;
    for (const discipline of clubConfig.disciplines) {
      for (const branch of discipline.branches) {
        const category = branch.categories.find(c => c.id === catId);
        if (category) return category.name;
      }
    }
    return catId;
  };

  const loadMatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPartidosByTorneo(tournament.id);
      setMatches(data);
      
      // Get discipline name to filter rivals
      const discipline = clubConfig.disciplines.find(d => d.id === tournament.discipline_id);
      const rivalsData = await getRivals(discipline?.name);
      
      setRivals(rivalsData);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tournament.id, tournament.discipline_id, clubConfig.disciplines]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const filteredMatches = selectedCategory === 'TODAS' 
    ? matches 
    : matches.filter(m => (m.categoryid || (m as any).category_id || (m as any).category) === selectedCategory);

  // Group matches by date
  const groupedMatches = filteredMatches.reduce((acc, match) => {
    const date = match.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const sortedDates = Object.keys(groupedMatches).sort();

  const handleOpenResultModal = async (match: Match) => {
    setSelectedMatch(match);
    // Load players for this category
    try {
      const { data } = await db.players.getAll();
      if (data) {
        const discipline = clubConfig.disciplines.find(d => d.id === tournament.discipline_id);
        const filtered = getPlayersByCategory(
          data as any,
          discipline?.name || '',
          tournament.gender,
          getCategoryName((match.categoryid || (match as any).category_id || (match as any).category) || ''),
          tournament.discipline_id,
          match.categoryid || (match as any).category_id || (match as any).category
        );
        setCategoryPlayers(filtered as any);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    }
    setShowResultModal(true);
  };

  const handleOpenSquadModal = async (match: Match) => {
    setSelectedMatch(match);
    // Load players for this category
    try {
      const { data } = await db.players.getAll();
      if (data) {
        const discipline = clubConfig.disciplines.find(d => d.id === tournament.discipline_id);
        const filtered = getPlayersByCategory(
          data as any,
          discipline?.name || '',
          tournament.gender,
          getCategoryName((match.categoryid || (match as any).category_id || (match as any).category) || ''),
          tournament.discipline_id,
          match.categoryid || (match as any).category_id || (match as any).category
        );
        setCategoryPlayers(filtered as any);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    }
    setShowSquadModal(true);
  };

  const handleResumeDate = async (date: string) => {
    try {
      await resumeFullDate(tournament.id, date);
      await loadMatches();
    } catch (error) {
      console.error('Error resuming date:', error);
      alert('Error al reanudar la fecha');
    }
  };

  const handleResumeMatch = async (matchId: string) => {
    try {
      await updateMatchStatus(matchId, 'Scheduled');
      await loadMatches();
    } catch (error) {
      console.error('Error resuming match:', error);
      alert('Error al reanudar el partido');
    }
  };

  const handleSuspensionAction = async (reprogram: boolean) => {
    if (!suspensionTarget) return;
    setIsProcessingSuspension(true);
    try {
      if (suspensionMode === 'match') {
        const match = suspensionTarget as Match;
        if (reprogram && suspensionNewDate) {
          await rescheduleMatch(match, suspensionNewDate, suspensionReason);
        } else {
          await updateMatchStatus(match.id, 'Suspended', suspensionReason);
        }
      } else {
        const date = suspensionTarget as string;
        await suspendFullDate(tournament.id, date, suspensionReason, reprogram ? suspensionNewDate : undefined);
      }
      await loadMatches();
      setSuspensionMode(null);
      setSuspensionTarget(null);
      setSuspensionReason('');
      setSuspensionNewDate('');
    } catch (error) {
      console.error('Error in suspension action:', error);
      alert('Error al procesar la suspensión');
    } finally {
      setIsProcessingSuspension(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 p-3 md:p-12 pb-32">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6 md:mb-12">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-primary-500 transition-colors uppercase font-black text-[9px] md:text-[10px] tracking-widest mb-3 md:mb-6"
        >
          <ArrowLeft size={14} /> Volver
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="w-10 h-10 md:w-16 md:h-16 bg-primary-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl shadow-primary-900/20 shrink-0">
              <Trophy size={20} md:size={32} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none truncate pr-4">
                {tournament.name} <span className="text-primary-500 block md:inline">- Partidos</span>
              </h1>
              <p className="text-[7px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-1 md:mt-2">Gestión Integral de Encuentros</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/50 w-full md:w-auto">
            <Filter size={14} className="text-slate-500 ml-2" />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-white font-black text-[10px] md:text-xs outline-none pr-4 cursor-pointer flex-1 md:flex-none uppercase tracking-widest"
            >
              <option value="TODAS" className="bg-slate-900 text-white">Todas las Categorías</option>
              {Array.from(new Set(matches.map(m => m.categoryid || (m as any).category_id || (m as any).category).filter(id => !!id))).map(catId => (
                <option key={catId as string} value={catId as string} className="bg-slate-900 text-white">
                  {getCategoryName(catId as string)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary-600" size={32} />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando partidos...</p>
          </div>
        ) : sortedDates.length > 0 ? (
          sortedDates.map((date, index) => {
            const dateMatches = groupedMatches[date];
            const isDateSuspended = dateMatches.every(m => m.status === 'Suspended');
            const isDateRescheduled = isDateSuspended && matches.some(m => m.original_date === date && m.is_overridden);

            return (
              <div key={date} className="animate-fade-in">
                <div className="flex items-center justify-between mb-4 md:mb-6 px-1 md:px-6">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="hidden md:block w-8 h-8 bg-primary-600/20 rounded-lg flex items-center justify-center text-primary-500 font-black italic text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base md:text-xl font-black text-white uppercase italic tracking-tight">Fecha {index + 1}</h3>
                        {isDateRescheduled ? (
                          <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                            REPROG.
                          </span>
                        ) : isDateSuspended ? (
                          <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-widest border border-red-500/20">
                            SUSP.
                          </span>
                        ) : null}
                      </div>
                      <p className="text-slate-500 font-bold text-[8px] md:text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={10} className="md:size-3" /> {new Date(date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 md:gap-3">
                    <button 
                      onClick={() => handleResumeDate(date)}
                      className="p-2 md:px-4 md:py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                      title="Reanudar Fecha"
                    >
                      <RefreshCcw size={14} className="md:size-3" /> 
                      <span className="hidden md:inline">Reanudar Fecha</span>
                    </button>
                    <button 
                      onClick={() => { setSuspensionMode('date'); setSuspensionTarget(date); }}
                      className="p-2 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                      title="Suspender Fecha"
                    >
                      <AlertTriangle size={14} className="md:size-3" />
                      <span className="hidden md:inline">Suspender Fecha</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-xl backdrop-blur-sm">
                  {groupedMatches[date].map(match => (
                    <div key={match.id} className="p-4 md:p-8 border-b border-slate-800 last:border-0 hover:bg-white/[0.02] transition-all group flex flex-col sm:flex-row items-center gap-4 md:gap-10">
                      {/* Categoria */}
                      <div className="w-full sm:w-24 shrink-0 text-center sm:text-left">
                        <span className="text-[7px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5 md:mb-1 block">Categoría</span>
                        <span className="text-[10px] md:text-xs font-black text-primary-500 uppercase tracking-tight">
                          {getCategoryName((match.categoryid || (match as any).category_id || (match as any).category) || '')}
                        </span>
                      </div>

                      {/* Equipos y Resultado */}
                      <div className="flex-1 w-full flex items-center justify-between gap-3 md:gap-12">
                        <div className="flex-1 text-right min-w-0">
                          <span className="text-xs md:text-xl font-black text-white uppercase italic tracking-tighter truncate block">{match.hometeam}</span>
                          <span className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase mt-0.5 block">Local</span>
                        </div>

                        <div className="flex flex-col items-center gap-1.5 shrink-0 px-2">
                          <div className={`bg-slate-950/50 px-4 md:px-7 py-2 md:py-4 rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-6 text-lg md:text-3xl font-black italic shadow-inner border border-white/5 ${match.status === 'Suspended' ? 'opacity-40' : ''}`}>
                            <span className={match.status === 'Finished' ? 'text-primary-500' : 'text-slate-700'}>
                              {match.status === 'Finished' ? match.homescore : '0'}
                            </span>
                            <span className="text-[7px] md:text-[10px] text-slate-700 not-italic uppercase tracking-[0.2em] md:tracking-[0.3em] font-black">VS</span>
                            <span className={match.status === 'Finished' ? 'text-primary-500' : 'text-slate-700'}>
                              {match.status === 'Finished' ? match.awayscore : '0'}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 text-left min-w-0">
                          <span className="text-xs md:text-xl font-black text-white uppercase italic tracking-tighter truncate block">{match.awayteam}</span>
                          <span className="text-[7px] md:text-[8px] font-bold text-slate-500 uppercase mt-0.5 block">Visitante</span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="w-full sm:w-auto flex items-center gap-2 md:gap-4 border-t sm:border-t-0 border-slate-800/50 pt-4 sm:pt-0 shrink-0">
                        <button 
                          onClick={() => handleOpenSquadModal(match)}
                          className="flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl md:rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-900/20 active:scale-95 text-[9px] md:text-[10px] font-black uppercase tracking-widest"
                        >
                          <Users size={16} className="md:size-5" />
                          <span className="sm:inline">Plantilla</span>
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleOpenResultModal(match)}
                            className="p-3 md:p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl md:rounded-2xl transition-all border border-white/5"
                            title="Resultado"
                          >
                            <Edit3 size={16} className="md:size-5" />
                          </button>
                          
                          {match.status === 'Suspended' ? (
                            <button 
                              onClick={() => handleResumeMatch(match.id)}
                              className="p-3 md:p-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl md:rounded-2xl transition-all border border-emerald-500/20"
                              title="Reanudar"
                            >
                              <RefreshCcw size={16} className="md:size-5" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => { setSuspensionMode('match'); setSuspensionTarget(match); }}
                              className="p-3 md:p-4 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl md:rounded-2xl transition-all border border-orange-500/20"
                              title="Incidencias"
                            >
                              <Activity size={16} className="md:size-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-20 bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center">
            <Calendar size={40} className="text-slate-700 mb-4" />
            <h3 className="text-xl font-black uppercase text-slate-500 italic tracking-widest">No hay partidos programados</h3>
          </div>
        )}

        <button 
          onClick={() => setShowAddFechaModal(true)}
          className="w-full py-6 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 hover:text-primary-500 hover:border-primary-500/50 transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <Plus size={24} className="group-hover:scale-110 transition-transform" />
          <span className="font-black uppercase tracking-widest text-[10px]">Agregar Nueva Fecha</span>
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showResultModal && selectedMatch && !showSquadModal && (
          <CargarResultadoModal 
            key="resultado-modal"
            match={selectedMatch}
            players={categoryPlayers}
            onClose={() => setShowResultModal(false)}
            onSuccess={() => {
              setShowResultModal(false);
              loadMatches();
            }}
          />
        )}
        {showSquadModal && selectedMatch && !showResultModal && (
          <ConvocatoriaModal 
            key="squad-modal"
            match={selectedMatch}
            players={categoryPlayers as any}
            discipline={clubConfig.disciplines.find(d => d.id === tournament.discipline_id)?.name || 'FUTBOL'}
            onClose={() => setShowSquadModal(false)}
            onSuccess={() => {
              setShowSquadModal(false);
              loadMatches();
            }}
          />
        )}
        {showAddFechaModal && (
          <AgregarFechaModal 
            key="add-fecha-modal"
            tournamentId={tournament.id}
            categories={tournament.assigned_categories || []}
            rivals={rivals}
            clubName={clubName}
            onClose={() => setShowAddFechaModal(false)}
            onSuccess={() => {
              setShowAddFechaModal(false);
              loadMatches();
            }}
          />
        )}

        {suspensionMode && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <motion.div 
               initial={{ opacity: 0, y: 20, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-red-600" />
              
              <div className="flex items-center gap-6 mb-8 text-orange-500">
                <div className="p-4 bg-orange-500/10 rounded-3xl">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                    {suspensionMode === 'match' ? 'Suspender Partido' : 'Suspender Fecha'}
                  </h3>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Gestionar estado y reprogramación
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-4">Motivo de Suspensión (Opcional)</label>
                   <textarea
                     value={suspensionReason}
                     onChange={(e) => setSuspensionReason(e.target.value)}
                     placeholder="Ej: Condiciones climáticas, falta de jugadores..."
                     className="bg-slate-800 border-2 border-slate-700/50 rounded-3xl p-6 text-white font-bold text-sm outline-none focus:border-orange-500 transition-all min-h-[100px] resize-none"
                   />
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-4">Nueva Fecha (Poner para Reprogramar)</label>
                   <div className="relative">
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                      <input
                        type="date"
                        value={suspensionNewDate}
                        onChange={(e) => setSuspensionNewDate(e.target.value)}
                        className="w-full bg-slate-800 border-2 border-slate-700/50 rounded-3xl pl-16 pr-6 py-5 text-white font-bold text-sm outline-none focus:border-orange-500 transition-all appearance-none"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                   <button
                     onClick={() => handleSuspensionAction(false)}
                     disabled={isProcessingSuspension}
                     className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest transition-all border border-slate-700 disabled:opacity-50"
                   >
                     Solo Suspender
                   </button>
                   <button
                     onClick={() => handleSuspensionAction(true)}
                     disabled={isProcessingSuspension || !suspensionNewDate}
                     className="flex-1 py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-orange-600/20 disabled:opacity-50"
                   >
                     Suspender y Reprogramar
                   </button>
                </div>

                <button
                  onClick={() => { setSuspensionMode(null); setSuspensionTarget(null); }}
                  className="w-full py-4 text-slate-500 hover:text-white font-bold uppercase text-[10px] tracking-[0.2em] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VerPartidos;
