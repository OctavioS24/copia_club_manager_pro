
import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Loader2, Clock, Award, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { Match, Player, MatchEvent } from '../../types';
import { updateMatchResult } from '../../lib/torneos';
import { getDisciplineConfig, DisciplineConfig } from '../../lib/disciplineConfig';
import { supabase } from '../../lib/supabase';

interface CargarResultadoModalProps {
  match: Match;
  players: Player[];
  onClose: () => void;
  onSuccess: () => void;
}

const CargarResultadoModal: React.FC<CargarResultadoModalProps> = ({ 
  match, 
  players, 
  onClose, 
  onSuccess 
}) => {
  const [homeScore, setHomeScore] = useState(match.homescore || 0);
  const [awayScore, setAwayScore] = useState(match.awayscore || 0);
  const [events, setEvents] = useState<Partial<MatchEvent>[]>(match.events || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disciplineConfig, setDisciplineConfig] = useState<DisciplineConfig | null>(null);

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<MatchEvent>>({
    type: 'GOL',
    minute: 0,
    playerid: ''
  });

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
          // Obtener el nombre de la disciplina desde club_config
          const { data: clubConfig } = await supabase.from('club_config').select('disciplines').single();
          const disc = clubConfig?.disciplines?.find((d: any) => d.id === tournament.discipline_id);
          
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
  }, [match.tournamentid, match.tournament_id]);

  const handleAddEvent = () => {
    if (!newEvent.playerid) return;
    const player = players.find(p => p.id === newEvent.playerid);
    const eventToAdd = {
      ...newEvent,
      id: crypto.randomUUID(),
      playerName: player?.name || 'Jugador Desconocido'
    };
    setEvents([...events, eventToAdd]);
    setShowEventForm(false);
    setNewEvent({ type: 'GOL', minute: 0, playerid: '' });
  };

  const handleRemoveEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-pink-600/10 rounded-2xl">
              <Award className="text-pink-600" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Cargar Resultado</h2>
              <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{match.hometeam} vs {match.awayteam}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
          {/* Scoreboard */}
          <div className="flex items-center justify-center gap-12 bg-slate-800/50 p-10 rounded-[2.5rem] border border-slate-700/50 shadow-inner">
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{match.hometeam}</p>
              <input 
                type="number" 
                min="0"
                value={homeScore}
                onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                className="w-24 h-24 bg-slate-900 border-2 border-slate-700 rounded-3xl text-center text-4xl font-black text-white outline-none focus:border-pink-600 transition-all shadow-xl"
              />
            </div>
            <div className="text-2xl font-black text-slate-600 italic uppercase tracking-tighter">VS</div>
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{match.awayteam}</p>
              <input 
                type="number" 
                min="0"
                value={awayScore}
                onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                className="w-24 h-24 bg-slate-900 border-2 border-slate-700 rounded-3xl text-center text-4xl font-black text-white outline-none focus:border-pink-600 transition-all shadow-xl"
              />
            </div>
          </div>

          {/* Events Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} className="text-pink-600" /> Eventos del Partido
              </h3>
              <button 
                onClick={() => setShowEventForm(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Agregar Evento
              </button>
            </div>

            {showEventForm && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/80 p-6 rounded-2xl border border-pink-600/20 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-2">Jugador</label>
                    <select 
                      value={newEvent.playerid}
                      onChange={(e) => setNewEvent({...newEvent, playerid: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs outline-none focus:border-pink-600"
                    >
                      <option value="">SELECCIONAR JUGADOR...</option>
                      {players.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-2">Tipo</label>
                    <select 
                      value={newEvent.type}
                      onChange={(e) => setNewEvent({...newEvent, type: e.target.value as any})}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs outline-none focus:border-pink-600"
                    >
                      {disciplineConfig ? (
                        disciplineConfig.event_types.map(et => (
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
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-2">Minuto</label>
                    <input 
                      type="number"
                      value={newEvent.minute}
                      onChange={(e) => setNewEvent({...newEvent, minute: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs outline-none focus:border-pink-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowEventForm(false)} className="px-4 py-2 text-[9px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancelar</button>
                  <button onClick={handleAddEvent} className="px-6 py-2 bg-pink-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-pink-700 transition-all">Confirmar</button>
                </div>
              </motion.div>
            )}

            <div className="space-y-3">
              {events.map((event, idx) => {
                const eventConfig = disciplineConfig?.event_types.find(et => et.name === event.type);
                return (
                  <div key={event.id || idx} className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
                        style={{ 
                          backgroundColor: eventConfig ? `${eventConfig.color}20` : (event.type === 'GOL' ? '#10b98120' : '#ef444420'),
                          color: eventConfig ? eventConfig.color : (event.type === 'GOL' ? '#10b981' : '#ef4444')
                        }}
                      >
                        {eventConfig ? <Activity size={18} /> : (event.type === 'GOL' ? <Award size={18} /> : <div className="w-3 h-4 rounded-sm bg-current" />)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-tight italic">{event.playerName}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{event.type} • {event.minute}'</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveEvent(event.id!)}
                      className="p-2 text-slate-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {events.length === 0 && !showEventForm && (
                <div className="py-10 text-center bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-700">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">No hay eventos registrados</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-10 border-t border-slate-800 bg-slate-900/50 flex gap-6">
          <button 
            onClick={onClose}
            className="flex-1 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest text-slate-400 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-[2] py-5 bg-pink-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-pink-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Save size={20} strokeWidth={3} />
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
