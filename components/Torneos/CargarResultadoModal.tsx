
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2, Loader2, Clock, Award, Activity, RefreshCw } from 'lucide-react';
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
      return onlyAthletes; 
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center pt-20 pb-6 px-4 md:pt-24 md:pb-12 pointer-events-auto">
      <div 
        className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" 
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/5 rounded-[2rem] md:rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] md:max-h-[85vh] relative z-10"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2.5 md:p-3 bg-primary-600/10 rounded-xl md:rounded-2xl">
              <Award className="text-primary-600 w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Cargar Resultado</h2>
              <p className="text-slate-500 font-bold text-[8px] md:text-[10px] uppercase tracking-widest truncate max-w-[150px] md:max-w-none">{match.hometeam} vs {match.awayteam}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 md:w-6 md:h-6 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-10 space-y-6 md:space-y-10 overflow-y-auto custom-scrollbar">
          {/* Scoreboard */}
          <div className="relative group">
            <div className="flex items-center justify-center gap-4 sm:gap-16 bg-slate-800/30 p-4 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-white/5 shadow-inner">
              <div className="flex flex-col items-center gap-2 md:gap-3 flex-1 sm:flex-none">
                <p className="text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest truncate max-w-[80px] md:max-w-none">{match.hometeam}</p>
                <input 
                  type="number" 
                  value={homeScore}
                  readOnly
                  className="w-16 h-16 sm:w-32 sm:h-32 bg-slate-950 border-2 border-primary-600/30 rounded-2xl md:rounded-[2.5rem] text-center text-2xl sm:text-6xl font-black text-white outline-none cursor-default shadow-2xl"
                />
                <span className="text-[7px] font-bold text-primary-500/50 uppercase tracking-widest sm:hidden">Local</span>
              </div>

              <div className="flex flex-col items-center justify-center shrink-0">
                <span className="text-lg md:text-4xl font-black text-slate-700 italic uppercase tracking-tighter">VS</span>
              </div>

              <div className="flex flex-col items-center gap-2 md:gap-3 flex-1 sm:flex-none">
                <p className="text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest truncate max-w-[80px] md:max-w-none">{match.awayteam}</p>
                <input 
                  type="number" 
                  value={awayScore}
                  readOnly
                  className="w-16 h-16 sm:w-32 sm:h-32 bg-slate-950 border-2 border-primary-600/30 rounded-2xl md:rounded-[2.5rem] text-center text-2xl sm:text-6xl font-black text-white outline-none cursor-default shadow-2xl"
                />
                <span className="text-[7px] font-bold text-slate-500/50 uppercase tracking-widest sm:hidden">Visitante</span>
              </div>
              
              <button 
                onClick={recalculateScore} 
                className="absolute right-3 top-3 md:right-8 md:top-8 p-2 md:p-3 bg-slate-950 border border-slate-700 rounded-xl md:rounded-2xl text-slate-500 hover:text-primary-500 hover:border-primary-500 transition-all group/btn shadow-xl"
                title="Recalcular marcador"
              >
                <RefreshCw size={14} className="md:size-4 group-hover/btn:rotate-180 transition-all duration-500" />
              </button>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-full text-[8px] font-black uppercase tracking-[0.2em] text-primary-500 shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10">
              Sincronizado
            </div>
          </div>

          {/* Events Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary-600 rounded-full" />
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} className="text-primary-600" /> Eventos del Partido
                </h3>
              </div>
              <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => {
                    setIsRivalEvent(false);
                    setShowEventForm(true);
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-black uppercase text-[8px] tracking-widest transition-all flex items-center justify-center gap-2 ${!isRivalEvent && showEventForm ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Plus size={10} /> Mi Club
                </button>
                <button 
                  onClick={() => {
                    setIsRivalEvent(true);
                    setShowEventForm(true);
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-black uppercase text-[8px] tracking-widest transition-all flex items-center justify-center gap-2 ${isRivalEvent && showEventForm ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Plus size={10} /> Rival
                </button>
              </div>
            </div>

            {showEventForm && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-8 rounded-[2rem] border-2 space-y-6 ${isRivalEvent ? 'bg-slate-800/50 border-slate-700' : 'bg-primary-600/5 border-primary-600/20'}`}
              >
                <div className="flex items-center justify-between mb-2">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                     Agregando Evento: <span className={isRivalEvent ? 'text-white' : 'text-primary-600'}>{isRivalEvent ? match.awayteam : 'Mi Club'}</span>
                   </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {!isRivalEvent && (
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Jugador</label>
                      <select 
                        value={newEvent.player_id}
                        onChange={(e) => setNewEvent({...newEvent, player_id: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:border-primary-600 shadow-inner"
                      >
                        <option value="">SELECCIONAR...</option>
                        {squadPlayers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">Tipo de Evento</label>
                    <select 
                      value={newEvent.type}
                      onChange={(e) => setNewEvent({...newEvent, type: e.target.value as any})}
                      className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:border-primary-600 shadow-inner"
                    >
                      <option value="">SELECCIONAR TIPO...</option>
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

                  {/* Additional Dynamic Fields */}
                  {disciplineConfig?.additional_fields?.map(field => (
                    <div key={field} className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2">{field}</label>
                      <input 
                        type="text"
                        placeholder={`Ej: ${field === 'minuto' ? "45'" : "1"}`}
                        value={newEvent.additional_data?.[field] || ''}
                        onChange={(e) => setNewEvent({
                          ...newEvent, 
                          additional_data: {
                            ...newEvent.additional_data,
                            [field]: e.target.value
                          }
                        })}
                        className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:border-primary-600 shadow-inner"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowEventForm(false)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancelar</button>
                  <button onClick={handleAddEvent} className="px-10 py-3 bg-secondary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary-700 transition-all shadow-xl shadow-secondary-600/20">Agregar</button>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((event, idx) => {
                const eventConfig = disciplineConfig?.event_types.find(et => et.name === event.type);
                const extraInfo = disciplineConfig?.additional_fields?.map(f => event.additional_data?.[f]).filter(Boolean).join(' • ');
                
                return (
                  <div key={event.id || idx} className={`p-5 rounded-[1.5rem] border flex items-center justify-between group transition-all hover:scale-[1.02] ${event.is_rival ? 'bg-slate-800/20 border-slate-700/30' : 'bg-primary-600/5 border-primary-600/10'}`}>
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner"
                        style={{ 
                          backgroundColor: eventConfig ? `${eventConfig.color}20` : '#3b82f620',
                          color: eventConfig ? eventConfig.color : '#3b82f6'
                        }}
                      >
                        {eventConfig ? <Activity size={20} /> : <Award size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-[10px] font-black uppercase tracking-tight italic ${event.is_rival ? 'text-slate-400' : 'text-white'}`}>
                            {event.player_name}
                          </p>
                          {event.is_rival && <span className="px-2 py-0.5 bg-slate-700 text-[6px] font-black text-white rounded uppercase">Rival</span>}
                        </div>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
                          {event.type} {extraInfo ? `• ${extraInfo}` : ''}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveEvent(event.id!)}
                      className="p-3 text-slate-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 bg-slate-900/50 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            {events.length === 0 && !showEventForm && (
              <div className="py-20 text-center bg-slate-800/10 rounded-[3rem] border-2 border-dashed border-slate-800">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                  <Activity className="text-slate-600" size={24} />
                </div>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">No hay eventos registrados</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-10 border-t border-slate-800 bg-slate-900/50 flex flex-col-reverse sm:flex-row gap-4 sm:gap-6">
          <button 
            onClick={onClose}
            className="w-full sm:w-1/3 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-[11px] tracking-widest text-slate-500 hover:bg-white/[0.03] transition-all border border-slate-800"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:flex-1 py-4 md:py-5 bg-[#d4ff00] text-black rounded-xl md:rounded-2xl font-black uppercase text-[11px] md:text-xs tracking-[0.2em] shadow-2xl shadow-[#d4ff00]/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Save size={18} strokeWidth={3} />
                Guardar Resultado
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CargarResultadoModal;
