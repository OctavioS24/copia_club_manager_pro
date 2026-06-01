
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2, Loader2, Clock, Award, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Match, Player, MatchEvent, MatchSquad } from '../../types';
import { updateMatchResult } from '../../lib/torneos';
import { getDisciplineConfig, DisciplineConfig } from '../../lib/disciplineConfig';
import { supabase } from '../../lib/supabase';
import { getMatchSquad } from '../../lib/squads';

interface CargarResultadoModalProps {
  match: Match;
  players: Player[];
  isMyClubHome: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CargarResultadoModal: React.FC<CargarResultadoModalProps> = ({ 
  match, 
  players, 
  isMyClubHome,
  onClose, 
  onSuccess 
}) => {
  const [homeScore, setHomeScore] = useState(match.homescore || 0);
  const [awayScore, setAwayScore] = useState(match.awayscore || 0);
  const [events, setEvents] = useState<MatchEvent[]>(match.events || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disciplineConfig, setDisciplineConfig] = useState<DisciplineConfig | null>(null);
  const [matchSquad, setMatchSquad] = useState<MatchSquad | null>(null);

  const squadPlayers = useMemo(() => {
    const catId = match.categoryid || match.category_id;
    // Filtrar solo los que tienen rol PLAYER en esta categoría
    const onlyAthletes = players.filter(p => {
      const m = p as any;
      if (!m.assignments || !Array.isArray(m.assignments)) return true;
      return m.assignments.some((asign: any) => 
        asign.role === 'PLAYER' && (!catId || asign.category_id === catId)
      );
    });

    if (!matchSquad || !matchSquad.players || matchSquad.players.length === 0) {
      return []; 
    }
    const squadPlayerIds = new Set(matchSquad.players.map(p => p.player_id));
    return onlyAthletes.filter(p => squadPlayerIds.has(p.id));
  }, [players, matchSquad, match.categoryid, match.category_id]);

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [isRivalEvent, setIsRivalEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<MatchEvent>>({
    type: '',
    player_id: '',
    is_rival: false,
    additional_data: {}
  });

  // Efecto para mantener el marcador sincronizado con los eventos
  useEffect(() => {
    let home = 0;
    let away = 0;

    events.forEach(event => {
      const typeUpper = (event.type || '').trim().toUpperCase();
      const eventConfig = disciplineConfig?.event_types.find(et => et.name.toUpperCase() === typeUpper);
      
      // Fallback robusto para GOL / GOAL / PUNTOS (siempre afecta marcador por defecto si es GOL)
      const isGoalFallback = typeUpper === 'GOL' || typeUpper === 'GOAL' || typeUpper.includes('GOL');
      
      if (eventConfig?.affects_score || isGoalFallback) {
        const val = eventConfig?.score_value || 1; // Default 1 point
        
        if (event.is_rival) {
          // Si el evento es del rival
          if (isMyClubHome) away += val; // Soy local, rival es visitante
          else home += val; // Soy visitante, rival es local
        } else {
          // Si el evento es de mi club
          if (isMyClubHome) home += val; // Soy local
          else away += val; // Soy visitante
        }
      }
    });
    setHomeScore(home);
    setAwayScore(away);
  }, [events, disciplineConfig, isMyClubHome]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Obtener el torneo para saber la disciplina
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('discipline_id')
          .eq('id', match.tournamentid)
          .single();
        
        if (tournament) {
          // Obtener la configuración del club para las disciplinas
          const { data: clubData } = await supabase.from('club_config').select('disciplines').single();
          const disc = clubData?.disciplines?.find((d: any) => d.id === tournament.discipline_id);
          
          if (disc) {
            const config = await getDisciplineConfig(disc.name);
            setDisciplineConfig(config);
            if (config && config.event_types.length > 0) {
              setNewEvent(prev => ({ ...prev, type: config.event_types[0].name as any }));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching discipline config for modal:", err);
      }
    };
    fetchConfig();

    const fetchSquad = async () => {
      try {
        const squadData = await getMatchSquad(match.id);
        setMatchSquad(squadData);
      } catch (err) {
        console.error("Error fetching squad for modal:", err);
      }
    };
    fetchSquad();
  }, [match.tournamentid, match.tournament_id, match.id]);

  const handleAddEvent = () => {
    if (!isRivalEvent && !newEvent.player_id) return;
    if (!newEvent.type) return;

    const player = players.find(p => p.id === newEvent.player_id);
    let eventConfig = disciplineConfig?.event_types.find(et => et.name === newEvent.type);
    
    // Fallback robusto para GOL si el config aún no cargó o es nulo
    if (!eventConfig && newEvent.type === 'GOL') {
      eventConfig = { id: '1', name: 'GOL', icon: 'Goal', color: '#10b981', statsKey: 'GOLES_TOTALES', affects_score: true, score_value: 1 };
    }

    const squadPlayer = matchSquad?.players?.find(p => p.player_id === newEvent.player_id);
    
    const eventToAdd: MatchEvent = {
      ...newEvent,
      id: crypto.randomUUID(),
      match_id: match.id,
      player_name: isRivalEvent ? match.awayteam : (player?.name || 'Jugador Desconocido'),
      is_rival: isRivalEvent,
      type: newEvent.type,
      squad_player_id: squadPlayer?.id
    } as MatchEvent;

    setEvents([...events, eventToAdd]);
    setShowEventForm(false);
    setNewEvent({ type: disciplineConfig?.event_types[0]?.name || 'GOL', player_id: '', additional_data: {} });
  };

  const handleRemoveEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const recalculateScore = () => {
    let home = 0;
    let away = 0;

    events.forEach(event => {
      const typeUpper = (event.type || '').trim().toUpperCase();
      const eventConfig = disciplineConfig?.event_types.find(et => et.name.toUpperCase() === typeUpper);
      
      const isGoalFallback = typeUpper === 'GOL' || typeUpper === 'GOAL' || typeUpper.includes('GOL');
      
      if (eventConfig?.affects_score || isGoalFallback) {
        const val = eventConfig?.score_value || 1;
        if (event.is_rival) {
          if (isMyClubHome) away += val;
          else home += val;
        } else {
          if (isMyClubHome) home += val;
          else away += val;
        }
      }
    });
    setHomeScore(home);
    setAwayScore(away);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updateMatchResult(match.id, homeScore, awayScore, events);
      onSuccess();
    } catch (error) {
      console.error('Error updating match result:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-card border-2 border-[var(--surface-border)] rounded-[2.5rem] md:rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto max-h-[88vh] relative"
      >
        {/* Header */}
        <div className="p-3 md:p-5 border-b border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-600/10 rounded-2xl md:rounded-2xl flex items-center justify-center border border-primary-600/20 shadow-inner shrink-0">
              <Award className="text-primary-600 w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tighter truncate">Cargar Resultado</h2>
              <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-0.5 opacity-40 italic truncate">
                {match.hometeam} <span className="text-primary-600">VS</span> {match.awayteam}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 md:p-3 text-[var(--text-muted)] hover:text-white hover:bg-surface-hover rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-5 md:space-y-6 custom-scrollbar">
          {/* Scoreboard */}
          <div className="relative group">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 bg-surface-ground p-6 md:p-10 rounded-[2.5rem] md:rounded-[2.5rem] border-2 border-[var(--surface-border)] shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-primary-600 opacity-[0.02] pointer-events-none" />
              
              <div className="flex flex-row md:flex-col items-center gap-4 relative z-10 flex-1 w-full md:w-auto">
                <p className="hidden md:block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] italic opacity-40 truncate max-w-[120px]">{match.hometeam}</p>
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-primary-600 blur-2xl md:blur-3xl opacity-10" />
                  <input 
                    type="number" 
                    value={homeScore}
                    readOnly
                    className="w-20 h-20 md:w-32 md:h-32 bg-surface-card border-2 md:border-3 border-primary-600 rounded-2xl md:rounded-[2.5rem] text-center text-3xl md:text-6xl font-black text-[var(--text-main)] outline-none relative z-10 shadow-2xl italic group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex-1 md:flex-none text-left md:text-center">
                  <p className="md:hidden text-xs font-black text-[var(--text-main)] uppercase tracking-widest mb-1 opacity-80 truncate">{match.hometeam}</p>
                  <span className="text-[8px] font-black text-primary-500 uppercase tracking-widest italic font-bold">Anfitrión</span>
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-center shrink-0 relative z-10 gap-4 md:gap-0">
                <div className="h-0.5 w-8 md:w-0.5 md:h-10 bg-primary-600/20 rounded-full md:mb-3" />
                <span className="text-xl md:text-4xl font-black text-primary-500 opacity-20 italic uppercase tracking-tighter">VS</span>
                <div className="h-0.5 w-8 md:w-0.5 md:h-10 bg-primary-600/20 rounded-full md:mt-3" />
              </div>

              <div className="flex flex-row md:flex-col items-center gap-4 relative z-10 flex-1 w-full md:w-auto">
                <div className="flex-1 md:flex-none text-right md:text-center order-2 md:order-none">
                  <p className="md:hidden text-xs font-black text-[var(--text-main)] uppercase tracking-widest mb-1 opacity-80 truncate">{match.awayteam}</p>
                  <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest italic opacity-40 font-bold">Visitante</span>
                </div>
                <div className="relative shrink-0 order-1 md:order-none">
                  <div className="absolute inset-0 bg-primary-600 blur-2xl md:blur-3xl opacity-10" />
                  <input 
                    type="number" 
                    value={awayScore}
                    readOnly
                    className="w-20 h-20 md:w-32 md:h-32 bg-surface-card border-2 md:border-3 border-[var(--surface-border)] rounded-2xl md:rounded-[2.5rem] text-center text-3xl md:text-6xl font-black text-[var(--text-main)] outline-none relative z-10 shadow-2xl italic group-hover:scale-105 transition-transform"
                  />
                </div>
                <p className="hidden md:block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] italic opacity-40 truncate max-w-[120px]">{match.awayteam}</p>
              </div>
              
              <button 
                onClick={recalculateScore} 
                className="absolute right-4 top-4 md:right-6 md:top-6 p-2 md:p-4 bg-surface-card border border-[var(--surface-border)] rounded-xl text-[var(--text-muted)] hover:text-primary-500 hover:border-primary-500 transition-all hover:rotate-180 duration-700 shadow-xl"
                title="Recalcular marcador"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Events Section */}
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-primary-600 rounded-full" />
                <h3 className="text-xl md:text-xl font-black text-[var(--text-main)] uppercase italic tracking-tighter flex items-center gap-2">
                  <Clock size={18} className="text-primary-600" /> Incidencias
                </h3>
              </div>
              <div className="flex bg-surface-ground p-1.5 rounded-xl border border-[var(--surface-border)]">
                <button 
                  onClick={() => {
                    setIsRivalEvent(false);
                    setShowEventForm(true);
                  }}
                  className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2 ${!isRivalEvent && showEventForm ? 'bg-primary-600 text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
                >
                  <Plus size={12} strokeWidth={3} /> Mi Club
                </button>
                <button 
                  onClick={() => {
                    setIsRivalEvent(true);
                    setShowEventForm(true);
                  }}
                  className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2 ${isRivalEvent && showEventForm ? 'bg-primary-600 text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
                >
                  <Plus size={12} strokeWidth={3} /> Rival
                </button>
              </div>
            </div>

            {showEventForm && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 md:p-10 rounded-3xl md:rounded-[3rem] border-2 space-y-6 md:space-y-8 shadow-2xl ${isRivalEvent ? 'bg-surface-ground border-[var(--surface-border)]' : 'bg-primary-600/5 border-primary-600/20'}`}
              >
                <div className="flex items-center gap-3 md:gap-4">
                   <div className={`p-2.5 md:p-3 rounded-xl ${isRivalEvent ? 'bg-surface-card' : 'bg-primary-600/10 text-primary-500'}`}>
                     <Activity size={20} className="md:w-6 md:h-6" />
                   </div>
                   <h4 className="text-[10px] md:text-[12px] font-black uppercase tracking-widest text-[var(--text-muted)] italic leading-tight">
                     Acción de <span className={isRivalEvent ? 'text-[var(--text-main)] underline decoration-primary-600' : 'text-primary-500 underline decoration-primary-500/20'}>{isRivalEvent ? match.awayteam : 'Mi Club'}</span>
                   </h4>
                </div>

                {!isRivalEvent && squadPlayers.length === 0 ? (
                  <div className="py-6 text-center space-y-4">
                    <AlertCircle className="mx-auto text-amber-500" size={40} />
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-main)] italic">Convocatoria Pendiente</h4>
                      <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider leading-relaxed max-w-md mx-auto">
                        No hay planilla de convocados cargada para este encuentro. Primero debes crear y guardar la convocatoria para poder registrar las incidencias tácticas del equipo.
                      </p>
                    </div>
                    <div className="flex justify-center pt-2">
                      <button onClick={() => setShowEventForm(false)} className="px-6 py-2.5 bg-surface-card border border-[var(--surface-border)] hover:bg-surface-hover rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] transition-colors">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                      {!isRivalEvent && (
                        <div className="flex flex-col gap-2 md:gap-3">
                          <label className="text-[9px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-3 md:ml-4 italic opacity-60">Jugador</label>
                          <select 
                            value={newEvent.player_id}
                            onChange={(e) => setNewEvent({...newEvent, player_id: e.target.value})}
                            className="w-full px-5 md:px-6 py-4 md:py-5 bg-surface-card border-2 border-[var(--surface-border)] rounded-2xl md:rounded-3xl text-[var(--text-main)] font-black text-xs md:text-sm uppercase tracking-widest outline-none focus:border-primary-600 shadow-inner"
                          >
                            <option value="">-- SELECCIONAR --</option>
                            {squadPlayers.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 md:gap-3">
                        <label className="text-[9px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-3 md:ml-4 italic opacity-60">Incidencia</label>
                        <select 
                          value={newEvent.type}
                          onChange={(e) => setNewEvent({...newEvent, type: e.target.value as any})}
                          className="w-full px-5 md:px-6 py-4 md:py-5 bg-surface-card border-2 border-[var(--surface-border)] rounded-2xl md:rounded-3xl text-[var(--text-main)] font-black text-xs md:text-sm uppercase tracking-widest outline-none focus:border-primary-600 shadow-inner"
                        >
                          <option value="">-- TIPO --</option>
                          {disciplineConfig ? (
                            disciplineConfig.event_types
                              .filter(et => !et.scope || et.scope === 'BOTH' || (isRivalEvent ? et.scope === 'RIVAL' : et.scope === 'OWN'))
                              .map(et => (
                                <option key={et.id} value={et.name}>{et.name}</option>
                              ))
                          ) : (
                            <>
                              <option value="GOL">GOL</option>
                              <option value="TARJETA AMARILLA">TARJETA AMARILLA</option>
                              <option value="TARJETA ROJA">TARJETA ROJA</option>
                            </>
                          )}
                        </select>
                      </div>

                      {disciplineConfig?.additional_fields?.map(field => (
                        <div key={field} className="flex flex-col gap-2 md:gap-3">
                          <label className="text-[9px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-3 md:ml-4 italic opacity-60">{field}</label>
                          <input 
                            type="text"
                            placeholder={`Ej: ${field === 'minuto' ? "45" : "Dato"}`}
                            value={newEvent.additional_data?.[field] || ''}
                            onChange={(e) => setNewEvent({
                              ...newEvent, 
                              additional_data: {
                                ...newEvent.additional_data,
                                [field]: e.target.value
                              }
                            })}
                            className="w-full px-5 md:px-6 py-4 md:py-5 bg-surface-card border-2 border-[var(--surface-border)] rounded-2xl md:rounded-3xl text-[var(--text-main)] font-black text-xs md:text-sm outline-none focus:border-primary-600 shadow-inner"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-3 md:gap-4 pt-4 md:pt-6">
                      <button onClick={() => setShowEventForm(false)} className="px-6 py-3 text-[10px] md:text-[11px] font-black uppercase text-[var(--text-muted)] hover:text-white transition-colors tracking-widest italic opacity-60">Abortar</button>
                      <button onClick={handleAddEvent} className="px-8 md:px-10 py-3 md:py-3.5 bg-emerald-600 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/30 italic">Registrar</button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {events.map((event, idx) => {
                const eventConfig = disciplineConfig?.event_types.find(et => et.name === event.type);
                const extraInfo = disciplineConfig?.additional_fields?.map(f => event.additional_data?.[f]).filter(Boolean).join(' • ');
                
                return (
                  <div key={event.id || idx} className={`p-3 md:p-5 rounded-2xl md:rounded-[2rem] border-2 flex items-center justify-between group transition-all hover:scale-[1.01] ${event.is_rival ? 'bg-surface-ground border-[var(--surface-border)]' : 'bg-primary-600/5 border-primary-600/20 shadow-lg'}`}>
                    <div className="flex items-center gap-4 md:gap-5 min-w-0">
                      <div 
                        className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-[1.2rem] flex items-center justify-center shadow-inner border border-[var(--surface-border)] shrink-0"
                        style={{ 
                          backgroundColor: eventConfig ? `${eventConfig.color}15` : 'var(--primary-soft)',
                          color: eventConfig ? eventConfig.color : 'var(--primary-500)'
                        }}
                      >
                        {eventConfig ? <Activity size={20} className="md:w-7 md:h-7" /> : <Award size={20} className="md:w-7 md:h-7" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs md:text-sm font-black uppercase tracking-tight italic text-[var(--text-main)] truncate">
                            {event.player_name}
                          </p>
                          {event.is_rival && <span className="px-2 py-0.5 bg-surface-card text-[6px] md:text-[7px] font-black text-primary-500 border border-primary-500/20 rounded-full uppercase tracking-widest italic shadow-sm">RIVAL</span>}
                        </div>
                        <p className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.25em] mt-1 md:mt-2 opacity-50 italic truncate">
                          {event.type} {extraInfo ? `• ${extraInfo}` : ''}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveEvent(event.id!)}
                      className="p-3 md:p-4 text-[var(--text-muted)] hover:text-red-500 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-surface-card rounded-xl md:rounded-2xl border border-[var(--surface-border)] shadow-md hover:border-red-500/20 shrink-0"
                    >
                      <Trash2 size={16} className="md:w-5 md:h-5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {events.length === 0 && !showEventForm && (
              <div className="py-24 text-center bg-surface-ground rounded-[4rem] border-4 border-dashed border-[var(--surface-border)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary-600/2 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="w-20 h-20 bg-surface-card rounded-3xl flex items-center justify-center mx-auto mb-6 border-2 border-[var(--surface-border)] shadow-2xl relative z-10">
                  <Activity className="text-[var(--text-muted)] opacity-20" size={32} />
                </div>
                <p className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] italic opacity-30 relative z-10">Secuencia de Eventos Vacía</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 md:p-6 border-t border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex flex-col sm:flex-row gap-2 md:gap-4 sticky bottom-0 z-10">
          <button 
            onClick={onClose}
            className="w-full sm:w-1/3 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] text-[var(--text-muted)] hover:text-white transition-all border-2 border-[var(--surface-border)] hover:border-white shadow-sm italic"
          >
            Anular
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:flex-1 py-2.5 md:py-3 bg-primary-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.3em] shadow-xl shadow-primary-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 md:gap-4 disabled:opacity-30 italic"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Save size={18} strokeWidth={4} />
                Confirmar
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CargarResultadoModal;
