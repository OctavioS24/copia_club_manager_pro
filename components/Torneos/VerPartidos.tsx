
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Filter, Plus, Edit3, X, Save, Calendar, Trophy, Loader2, AlertTriangle, Activity, RefreshCcw, Users } from 'lucide-react';
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
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [newDateValue, setNewDateValue] = useState('');
  const [isUpdatingDate, setIsUpdatingDate] = useState(false);

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

  const handleUpdateDate = async (oldDate: string) => {
    if (!newDateValue || newDateValue === oldDate) {
      setEditingDate(null);
      return;
    }

    if (sortedDates.includes(newDateValue)) {
      alert('NO PUEDES MOVER LOS PARTIDOS A UNA FECHA QUE YA TIENE OTROS PARTIDOS PROGRAMADOS.');
      return;
    }

    setIsUpdatingDate(true);
    try {
      const matchesToUpdate = groupedMatches[oldDate];
      const promises = matchesToUpdate.map(match => 
        db.matches.update(match.id, { date: newDateValue })
      );
      await Promise.all(promises);
      await loadMatches();
      setEditingDate(null);
    } catch (error) {
      console.error('Error updating matches date:', error);
      alert('Error al actualizar la fecha');
    } finally {
      setIsUpdatingDate(false);
    }
  };

  const handleUpdateIndividualMatchDate = async (matchId: string) => {
    if (!newDateValue) {
      setEditingMatchId(null);
      return;
    }

    setIsUpdatingDate(true);
    try {
      await db.matches.update(matchId, { date: newDateValue });
      await loadMatches();
      setEditingMatchId(null);
    } catch (error) {
      console.error('Error updating individual match date:', error);
      alert('Error al actualizar la fecha del partido');
    } finally {
      setIsUpdatingDate(false);
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
    <div className="min-h-screen bg-[var(--surface-ground)] text-[var(--text-main)] p-4 md:px-8 md:py-10 pb-48">
      {/* Header Area */}
      <div className="max-w-7xl mx-auto mb-8 md:mb-12">
        <button 
          onClick={onBack}
          className="group flex items-center gap-3 text-[var(--text-muted)] hover:text-primary-500 transition-all uppercase font-black text-[9px] md:text-[10px] tracking-[0.3em] mb-6 md:mb-8 bg-surface-card w-fit px-5 py-2.5 rounded-full border border-[var(--surface-border)] shadow-sm"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Retroceder al Módulo
        </button>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 md:gap-10">
          <div className="flex items-center gap-5 md:gap-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary-600 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="w-16 h-16 md:w-24 md:h-24 bg-primary-600 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center shadow-2xl shadow-primary-900/40 shrink-0 relative z-10 border-4 border-white/10">
                <Trophy size={32} className="md:w-12 md:h-12 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-4 py-1.5 bg-primary-600/10 text-primary-500 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border border-primary-500/20">Calendario Oficial</span>
                <span className="hidden md:inline-block w-8 h-[1px] bg-[var(--surface-border)]" />
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-none pr-4 max-w-3xl">
                {tournament.name}
              </h1>
              <p className="text-[9px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mt-3 opacity-40 flex items-center gap-2">
                <Activity size={14} className="text-primary-600" />
                Sincronización Deportiva
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 shrink-0">
            <p className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest ml-3 opacity-40 italic">Filtrar por segmentación</p>
            <div className="flex items-center gap-3 bg-surface-card backdrop-blur-xl p-3 md:p-3.5 rounded-[1.2rem] md:rounded-[1.8rem] border border-[var(--surface-border)] shadow-xl w-full lg:w-[280px] focus-within:border-primary-500 transition-all">
              <Filter size={16} className="text-primary-500 shrink-0" />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-[var(--text-main)] font-black text-xs outline-none w-full cursor-pointer uppercase tracking-[0.15em] appearance-none"
              >
                <option value="TODAS" className="bg-surface-card text-[var(--text-main)] text-xs">Visión Global (Todas)</option>
                {Array.from(new Set(matches.map(m => m.categoryid || (m as any).category_id || (m as any).category).filter(id => !!id))).map(catId => (
                  <option key={catId as string} value={catId as string} className="bg-surface-card text-[var(--text-main)] text-xs">
                    {getCategoryName(catId as string)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Matches Content Grid */}
      <div className="max-w-7xl mx-auto space-y-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-48 gap-8">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-primary-600/30 animate-pulse" />
              <Loader2 className="animate-spin text-primary-600 relative" size={64} strokeWidth={3} />
            </div>
            <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.5em] text-[10px] italic opacity-40 animate-pulse">Reconstruyendo fixture en tiempo real...</p>
          </div>
        ) : sortedDates.length > 0 ? (
          sortedDates.map((date, index) => {
            const dateMatches = groupedMatches[date];
            const isDateSuspended = dateMatches.every(m => m.status === 'Suspended');
            const isDateRescheduled = isDateSuspended && matches.some(m => m.original_date === date && m.is_overridden);

            return (
              <div key={date} className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 md:gap-6 px-2 md:px-6">
                  <div className="flex items-center gap-4 md:gap-5">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-surface-card rounded-2xl flex items-center justify-center border-2 border-[var(--surface-border)] shadow-lg relative overflow-hidden group shrink-0">
                      <div className="absolute inset-0 bg-primary-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500 opacity-10" />
                      <span className="text-lg md:text-xl font-black text-primary-500 italic relative z-10">{index + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg md:text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tighter">Fecha Detallada</h3>
                        {isDateRescheduled ? (
                          <span className="bg-blue-600 text-white px-2 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest italic">
                            REPROG.
                          </span>
                        ) : isDateSuspended ? (
                          <span className="bg-orange-600 text-white px-2 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest italic">
                            POSTER.
                          </span>
                        ) : (
                          <span className="bg-emerald-600/10 text-emerald-500 px-2 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest border border-emerald-500/20 italic">
                            CONF.
                          </span>
                        )}
                      </div>
                      <p className="text-[8px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2 opacity-60">
                        <Calendar size={12} className="text-primary-500 md:w-[14px] md:h-[14px]" />
                        {editingDate === date ? (
                          <div className="flex items-center gap-2 bg-surface-card p-1 rounded-xl border border-primary-500/50 shadow-lg">
                            <input 
                              type="date"
                              value={newDateValue}
                              onChange={(e) => setNewDateValue(e.target.value)}
                              className="bg-transparent border-none px-2 py-1 text-[10px] text-primary-500 font-black outline-none w-32"
                            />
                            <button 
                              onClick={() => handleUpdateDate(date)}
                              disabled={isUpdatingDate}
                              className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                              title="Confirmar cambio para toda la fecha"
                            >
                              {isUpdatingDate ? <Loader2 size={12} className="animate-spin" /> : <Save size={14} />}
                            </button>
                            <button 
                              onClick={() => setEditingDate(null)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                              setEditingDate(date);
                              setNewDateValue(date);
                            }}
                            className="group/btn hover:text-primary-500 transition-all flex items-center gap-2 bg-surface-card/50 px-3 py-1.5 rounded-lg border border-transparent hover:border-primary-500/30"
                            title="Haz clic para corregir la fecha de todos estos partidos"
                          >
                            <span className="truncate">{new Date(date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            <Edit3 size={10} className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 md:gap-3">
                    <button 
                      onClick={() => handleResumeDate(date)}
                      className="flex-1 md:flex-none px-4 md:px-5 py-2.5 md:py-3 bg-emerald-600 text-white rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all hover:bg-emerald-700 flex items-center justify-center gap-2 active:scale-95"
                    >
                      <RefreshCcw size={12} strokeWidth={3} className="md:w-[14px] md:h-[14px]" /> <span className="md:inline">Reanudar</span>
                    </button>
                    <button 
                      onClick={() => { setSuspensionMode('date'); setSuspensionTarget(date); }}
                      className="p-2.5 md:p-3 bg-surface-card hover:bg-orange-600 text-[var(--text-muted)] hover:text-white border-2 border-[var(--surface-border)] hover:border-orange-600 rounded-xl transition-all shadow-sm active:scale-95"
                      title="Interrumpir Fecha"
                    >
                      <AlertTriangle size={16} className="md:w-[18px] md:h-[18px]" />
                    </button>
                  </div>
                </div>

                <div className="bg-surface-card border-2 border-[var(--surface-border)] rounded-[2rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary-600/2 to-transparent pointer-events-none" />
                  {groupedMatches[date].map((match, mIdx) => (
                    <div key={match.id} className={`p-5 md:p-8 border-b-2 border-[var(--surface-border)] last:border-0 hover:bg-surface-hover/40 transition-all group relative ${match.status === 'Suspended' ? 'grayscale opacity-70' : ''}`}>
                      {/* Match Number Overlay */}
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[40px] md:text-[80px] font-black text-[var(--text-muted)] opacity-[0.02] pointer-events-none italic select-none">
                        #{mIdx + 1}
                      </span>

                      <div className="flex flex-col lg:flex-row lg:items-center gap-6 md:gap-12 relative z-10">
                        {/* Segment / Category */}
                        <div className="w-full lg:w-40 shrink-0 flex flex-row lg:flex-col items-center lg:items-start justify-between lg:justify-center border-b lg:border-b-0 lg:border-r border-[var(--surface-border)] pb-3 md:pb-4 lg:pb-0 lg:pr-6 gap-3">
                          <div className="min-w-0">
                            <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 opacity-40">Segmento</p>
                            <p className="text-xs md:text-xl font-black text-primary-500 uppercase italic tracking-tighter leading-none mb-1 truncate">
                              {getCategoryName((match.categoryid || (match as any).category_id || (match as any).category) || '')}
                            </p>
                          </div>
                          <div className="shrink-0 px-2 md:px-3 py-1 bg-surface-ground rounded-lg border border-[var(--surface-border)] text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                            Fase Regular
                          </div>
                        </div>

                        {/* Versus Grid */}
                        <div className="flex-1 flex flex-col md:grid md:grid-cols-[1fr,auto,1fr] items-center gap-6 md:gap-10">
                          <div className="text-center md:text-right w-full">
                            <h4 className="text-lg md:text-3xl font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-tight mb-1 whitespace-normal break-words">{match.hometeam}</h4>
                            <div className="flex items-center justify-center md:justify-end gap-2">
                               <span className="text-[7px] md:text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">LOCAL</span>
                               <div className="w-3 md:w-4 h-1 bg-primary-600 rounded-full" />
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-2 md:gap-4 shrink-0">
                            <div className="relative">
                              <div className="absolute inset-0 bg-primary-600 blur-2xl opacity-10" />
                              <div className="bg-surface-ground px-5 md:px-8 py-2.5 md:py-6 rounded-2xl md:rounded-[2.5rem] flex items-center gap-3 md:gap-6 text-2xl md:text-5xl font-black italic shadow-2xl border-2 border-[var(--surface-border)] relative z-10">
                                <span className={match.status === 'Finished' ? 'text-[var(--text-main)] transition-colors' : 'text-[var(--text-muted)] opacity-10'}>
                                  {match.status === 'Finished' ? match.homescore : '0'}
                                </span>
                                <div className="flex flex-col items-center justify-center gap-1 md:gap-1.5">
                                  <div className="w-0.5 h-1 md:h-2 bg-primary-500/20 rounded-full" />
                                  <span className="text-[8px] md:text-xs text-primary-500 opacity-30 not-italic uppercase tracking-widest font-black">VS</span>
                                  <div className="w-0.5 h-1 md:h-2 bg-primary-500/20 rounded-full" />
                                </div>
                                <span className={match.status === 'Finished' ? 'text-[var(--text-main)] transition-colors' : 'text-[var(--text-muted)] opacity-10'}>
                                  {match.status === 'Finished' ? match.awayscore : '0'}
                                </span>
                              </div>
                            </div>
                            
                            {match.status === 'Finished' ? (
                              <div className="flex items-center gap-1.5 px-3 md:px-4 py-1 bg-emerald-600 text-white rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest italic">
                                Finalizado
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 md:px-4 py-1 bg-surface-ground text-[var(--text-muted)] border border-[var(--surface-border)] rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest italic">
                                En Espera
                              </div>
                            )}
                          </div>

                          <div className="text-center md:text-left w-full">
                            <h4 className="text-lg md:text-3xl font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-tight mb-1 whitespace-normal break-words">{match.awayteam}</h4>
                            <div className="flex items-center justify-center md:justify-start gap-2">
                               <div className="w-3 md:w-4 h-1 bg-primary-600/30 rounded-full" />
                               <span className="text-[7px] md:text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">VISITA</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Hub */}
                        <div className="w-full lg:w-fit flex flex-row lg:flex-col items-center gap-2 md:gap-3 bg-surface-ground/50 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-[var(--surface-border)] shadow-inner">
                          <button 
                            onClick={() => handleOpenSquadModal(match)}
                            className="flex-1 lg:w-full px-4 md:px-6 py-3 md:py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 md:gap-3 active:scale-95 text-[9px] md:text-[10px] font-black uppercase tracking-widest group/btn min-w-0"
                          >
                            <Users size={14} className="md:w-4 md:h-4 group-hover/btn:scale-110 transition-transform shrink-0" />
                            <span className="truncate">Convocar</span>
                          </button>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {editingMatchId === match.id ? (
                              <div className="flex items-center gap-1 bg-surface-card p-1 rounded-lg border border-primary-500/50">
                                <input 
                                  type="date"
                                  value={newDateValue}
                                  onChange={(e) => setNewDateValue(e.target.value)}
                                  className="bg-transparent text-[9px] text-primary-500 outline-none w-24"
                                />
                                <button 
                                  onClick={() => handleUpdateIndividualMatchDate(match.id)}
                                  className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded"
                                >
                                  {isUpdatingDate ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                </button>
                                <button 
                                  onClick={() => setEditingMatchId(null)}
                                  className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => {
                                  setEditingMatchId(match.id);
                                  setNewDateValue(match.date);
                                }}
                                className="p-3 md:p-4 bg-surface-card hover:bg-primary-600 text-[var(--text-muted)] hover:text-white rounded-xl transition-all border border-[var(--surface-border)] hover:border-primary-600 shadow-sm"
                                title="Corregir Fecha de este Partido"
                              >
                                <Calendar size={16} className="md:w-[18px] md:h-[18px]" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleOpenResultModal(match)}
                              className="p-3 md:p-4 bg-surface-card hover:bg-primary-600 text-[var(--text-muted)] hover:text-white rounded-xl transition-all border border-[var(--surface-border)] hover:border-primary-600 shadow-sm"
                              title="Cuentas / Resultados"
                            >
                              <Edit3 size={16} className="md:w-[18px] md:h-[18px]" />
                            </button>
                            
                            {match.status === 'Suspended' ? (
                              <button 
                                onClick={() => handleResumeMatch(match.id)}
                                className="p-3 md:p-4 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-xl transition-all border border-emerald-500/20 shadow-sm"
                                title="Restaurar Encuentro"
                              >
                                <RefreshCcw size={16} className="md:w-[18px] md:h-[18px] animate-spin-slow" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => { setSuspensionMode('match'); setSuspensionTarget(match); }}
                                className="p-3 md:p-4 bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white rounded-xl transition-all border border-orange-500/20 shadow-sm"
                                title="Reportar Novedad"
                              >
                                <Activity size={16} className="md:w-[18px] md:h-[18px]" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-48 bg-surface-card rounded-[5rem] border-4 border-dashed border-[var(--surface-border)] flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="w-32 h-32 bg-surface-ground rounded-[3rem] flex items-center justify-center mb-10 border-2 border-[var(--surface-border)] shadow-2xl relative z-10">
              <Calendar size={56} className="text-[var(--text-muted)] opacity-20" />
            </div>
            <h3 className="text-4xl font-black uppercase text-[var(--text-muted)] italic tracking-[0.3em] opacity-30 relative z-10 italic">Secuencia no definida</h3>
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] mt-6 opacity-20 relative z-10">Agregue un nuevo encuentro para iniciar el registro histórico</p>
          </div>
        )}

        {/* Global Action */}
        <button 
          onClick={() => setShowAddFechaModal(true)}
          className="w-full py-20 border-4 border-dashed border-[var(--surface-border)] hover:border-primary-500/40 rounded-[4rem] text-[var(--text-muted)] hover:text-primary-500 transition-all flex flex-col items-center justify-center gap-6 group bg-surface-card/20 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-primary-600/2 translate-y-full group-hover:translate-y-0 transition-transform duration-700" />
          <div className="w-20 h-20 rounded-[2.5rem] bg-surface-card flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all shadow-2xl border-2 border-[var(--surface-border)] group-hover:border-primary-600 relative z-10">
            <Plus size={36} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
          </div>
          <span className="font-black uppercase tracking-[0.5em] text-[12px] relative z-10 italic">Inyectar Nueva Jornada al Calendario</span>
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
            existingDates={sortedDates}
            onClose={() => setShowAddFechaModal(false)}
            onSuccess={() => {
              setShowAddFechaModal(false);
              loadMatches();
            }}
          />
        )}

        {suspensionMode && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-surface-ground/90 backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div 
               initial={{ opacity: 0, y: 20, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-red-600" />
              
              <div className="flex items-center gap-6 mb-8 text-orange-500">
                <div className="p-4 bg-orange-500/10 rounded-3xl">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-[var(--text-main)] uppercase italic tracking-tighter">
                    {suspensionMode === 'match' ? 'Suspender Partido' : 'Suspender Fecha'}
                  </h3>
                  <p className="text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest mt-1">
                    Gestionar estado y reprogramación
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-widest ml-4">Motivo de Suspensión (Opcional)</label>
                   <textarea
                     value={suspensionReason}
                     onChange={(e) => setSuspensionReason(e.target.value)}
                     placeholder="Ej: Condiciones climáticas, falta de jugadores..."
                     className="bg-surface-ground border-2 border-[var(--surface-border)] rounded-3xl p-6 text-[var(--text-main)] font-bold text-sm outline-none focus:border-orange-500 transition-all min-h-[100px] resize-none"
                   />
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-widest ml-4">Nueva Fecha (Poner para Reprogramar)</label>
                   <div className="relative">
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={18} />
                      <input
                        type="date"
                        value={suspensionNewDate}
                        onChange={(e) => setSuspensionNewDate(e.target.value)}
                        className="w-full bg-surface-ground border-2 border-[var(--surface-border)] rounded-3xl pl-16 pr-6 py-5 text-[var(--text-main)] font-bold text-sm outline-none focus:border-orange-500 transition-all appearance-none"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                   <button
                     onClick={() => handleSuspensionAction(false)}
                     disabled={isProcessingSuspension}
                     className="flex-1 py-5 bg-surface-ground hover:bg-surface-hover text-[var(--text-main)] rounded-3xl font-black uppercase text-[10px] tracking-widest transition-all border border-[var(--surface-border)] disabled:opacity-50"
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
                  className="w-full py-4 text-[var(--text-muted)] hover:text-white font-black uppercase text-[10px] tracking-[0.2em] transition-all"
                >
                  Cancelar Operación
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
