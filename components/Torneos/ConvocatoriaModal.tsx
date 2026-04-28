
import React, { useState, useEffect } from 'react';
import { Users, Star, Check, X, Loader2, Save, Info, AlertCircle, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { Match, Member, MatchSquadPlayer } from '../../types';
import { getMatchSquad, saveMatchSquad } from '../../lib/squads';
import { db } from '../../lib/supabase';

interface ConvocatoriaModalProps {
  match: Match;
  players: Member[];
  onClose: () => void;
  onSuccess: () => void;
  discipline?: string;
}

const ConvocatoriaModal: React.FC<ConvocatoriaModalProps> = ({ 
  match, 
  players, 
  onClose, 
  onSuccess,
  discipline = 'FUTBOL' 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [playerDebts, setPlayerDebts] = useState<Set<string>>(new Set());
  
  // State for selected players and starters
  const [selection, setSelection] = useState<Record<string, { selected: boolean, starting: boolean }>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const loadSquadAndDebts = async () => {
      setIsLoading(true);
      try {
        // Cargar convocatoria existente
        const existingSquad = await getMatchSquad(match.id);
        
        // Cargar morosos
        const { data: debts } = await db.fees.getAllDebts();
        if (debts) {
          setPlayerDebts(new Set(debts.map(d => d.member_id)));
        }
        
        const initialSelection: Record<string, { selected: boolean, starting: boolean }> = {};
        
        // Default: If no squad exists, all provided players are pre-selected but not starting
        players.forEach(p => {
          initialSelection[p.id] = { selected: !existingSquad, starting: false };
        });

        if (existingSquad) {
          setNotes(existingSquad.notes || '');
          existingSquad.players?.forEach(sp => {
            if (initialSelection[sp.player_id]) {
              initialSelection[sp.player_id] = { selected: true, starting: sp.is_starting };
            }
          });
        }

        setSelection(initialSelection);
      } catch (error) {
        console.error('Error loading squad:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSquadAndDebts();
  }, [match.id, players]);

  const toggleSelected = (playerId: string) => {
    setSelection(prev => {
      const current = prev[playerId];
      // If we unselect, it cannot be starting
      return {
        ...prev,
        [playerId]: { 
          selected: !current.selected, 
          starting: !current.selected ? false : false // If it was selected and starting, unselecting removes both
        }
      };
    });
  };

  const toggleStarting = (playerId: string) => {
    setSelection(prev => {
      const current = prev[playerId];
      if (!current.selected) return prev; // Cannot be starting if not selected
      
      return {
        ...prev,
        [playerId]: { ...current, starting: !current.starting }
      };
    });
  };

  const startersCount = Object.values(selection).filter(s => s.starting).length;
  const summonedCount = Object.values(selection).filter(s => s.selected).length;

  const handleSave = async () => {
    // Validation: Exactly 11 starters for Football
    if (startersCount !== 11) {
      alert('Debes seleccionar exactamente 11 jugadores como titulares.');
      return;
    }

    setIsSaving(true);
    try {
      const playersToSave: Partial<MatchSquadPlayer>[] = Object.entries(selection)
        .filter(([, data]) => data.selected)
        .map(([playerId, data]) => ({
          player_id: playerId,
          is_starting: data.starting,
          minutes_played: data.starting ? 90 : 0 // Default starting to full match, can be updated later
        }));

      await saveMatchSquad(
        {
          match_id: match.id,
          tournament_id: match.tournamentid || (match as any).tournament_id,
          category_id: match.categoryid || (match as any).category_id,
          discipline: discipline,
          notes: notes
        },
        playersToSave
      );
      
      onSuccess();
    } catch (error) {
      console.error('Error saving squad:', error);
      alert('Error al guardar la convocatoria');
    } finally {
      setIsSaving(false);
    }
  };

  const playersList = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-primary-600/10 rounded-3xl flex items-center justify-center border border-primary-600/20 shadow-inner">
              <Users className="text-primary-600" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Armar Convocatoria</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                {match.hometeam} vs {match.awayteam} • {new Date(match.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-primary-600" size={32} />
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Cargando plantel...</p>
            </div>
          ) : (
            <>
              {/* Counters & Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Titulares</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-black italic ${startersCount === 11 ? 'text-emerald-500' : 'text-primary-500'}`}>
                        {startersCount} <span className="text-slate-600">/ 11</span>
                      </span>
                      {startersCount === 11 && <Check className="text-emerald-500" size={20} />}
                    </div>
                  </div>
                  <div className={`p-3 rounded-2xl ${startersCount === 11 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary-600/10 text-primary-600'}`}>
                    <Star size={24} fill={startersCount === 11 ? 'currentColor' : 'none'} />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Convocados</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black italic text-white">
                        {summonedCount} <span className="text-slate-600">Total</span>
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-secondary-600/10 text-secondary-500 rounded-2xl">
                    <Users size={24} />
                  </div>
                </div>
              </div>

              {/* Status Alert */}
              {startersCount !== 11 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-4">
                  <AlertCircle className="text-amber-500 shrink-0" size={20} />
                  <div>
                    <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">Validación de Alineación</p>
                    <p className="text-[10px] text-amber-500/70 font-medium leading-relaxed">
                      Para avanzar, debes marcar exactamente 11 jugadores como titulares usando el icono de la estrella. {startersCount < 11 ? `Faltan ${11 - startersCount}.` : `Sobrán ${startersCount - 11}.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Player Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {playersList.map((player) => {
                  const selData = selection[player.id] || { selected: false, starting: false };
                  return (
                    <div 
                      key={player.id}
                      className={`p-5 rounded-[1.5rem] border-2 transition-all flex items-center justify-between gap-4 group cursor-pointer ${
                        selData.selected 
                          ? (selData.starting ? 'border-primary-600 bg-primary-600/5' : 'border-slate-700 bg-slate-800/30') 
                          : 'border-slate-800 bg-slate-900/50 grayscale hover:grayscale-0 opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => toggleSelected(player.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="relative">
                          <img 
                            src={player.photourl || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`}
                            alt={player.name}
                            className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
                          />
                          {selData.selected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                              <Check size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <p className="text-[11px] font-black text-white uppercase italic tracking-tight">{player.name}</p>
                             {playerDebts.has(player.id) && (
                               <div className="bg-amber-500/10 text-amber-500 p-1 rounded-md animate-pulse" title="Jugador con deuda pendiente">
                                 <DollarSign size={12} strokeWidth={3} />
                               </div>
                             )}
                          </div>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
                          {player.dni ? `DNI: ${player.dni}` : 'SIN DNI'} 
                          {selData.selected ? (selData.starting ? ' • TITULAR' : ' • SUPLENTE') : ' • NO CONVOCADO'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => toggleStarting(player.id)}
                          disabled={!selData.selected}
                          className={`p-3 rounded-xl border transition-all ${
                            selData.starting 
                              ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/30' 
                              : (selData.selected ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-primary-500' : 'bg-slate-800/50 border-slate-800 text-slate-700 cursor-not-allowed')
                          }`}
                          title={selData.starting ? 'Titular' : 'Marcar como Titular'}
                        >
                          <Star size={18} fill={selData.starting ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes Section */}
              <div className="space-y-3 pt-4">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-4 font-mono">Apuntes Tácticos / Notas</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales para el partido..."
                  className="w-full bg-slate-800/50 border-2 border-slate-700/50 rounded-[2rem] p-6 text-white font-bold text-sm outline-none focus:border-primary-600 transition-all min-h-[120px] resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md flex justify-between items-center sticky bottom-0">
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <Info size={16} />
            <p className="text-[10px] font-bold uppercase tracking-tight italic">Los jugadores no marcados serán excluidos de la planilla oficial.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={onClose} className="px-8 py-4 text-[11px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancelar</button>
            <button 
              onClick={handleSave}
              disabled={isSaving || startersCount !== 11}
              className="flex-1 md:flex-none px-12 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary-600/20"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Guardar Lista</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConvocatoriaModal;
