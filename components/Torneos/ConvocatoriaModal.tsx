
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-ground/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-8 border-b border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-primary-600/10 rounded-3xl flex items-center justify-center border border-primary-600/20 shadow-inner">
              <Users className="text-primary-600" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[var(--text-main)] uppercase italic tracking-tighter">Planilla de Convocados</h2>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
                {match.hometeam} vs {match.awayteam} • {new Date(match.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-surface-hover rounded-2xl transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-primary-600" size={40} />
              <p className="text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest opacity-40 italic">Iniciando protocolo de convocatoria...</p>
            </div>
          ) : (
            <>
              {/* Counters & Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                <div className="bg-surface-ground rounded-3xl p-8 border border-[var(--surface-border)] flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Titulares Requididos</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-3xl font-black italic ${startersCount === 11 ? 'text-emerald-500' : 'text-primary-500'}`}>
                        {startersCount} <span className="text-[var(--text-muted)] opacity-30">/ 11</span>
                      </span>
                      {startersCount === 11 && <Check className="text-emerald-500" size={24} />}
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl shadow-xl transition-all ${startersCount === 11 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-primary-600/10 text-primary-600 border border-primary-600/20'}`}>
                    <Star size={28} fill={startersCount === 11 ? 'currentColor' : 'none'} />
                  </div>
                </div>

                <div className="bg-surface-ground rounded-3xl p-8 border border-[var(--surface-border)] flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Efectivos Convocados</p>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black italic text-[var(--text-main)]">
                        {summonedCount} <span className="text-[var(--text-muted)] opacity-30 text-sm">TOTAL</span>
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-secondary-600/10 text-secondary-500 rounded-2xl border border-secondary-500/20 shadow-xl">
                    <Users size={28} />
                  </div>
                </div>
              </div>

              {/* Status Alert */}
              {startersCount !== 11 && (
                <div className="bg-orange-500/5 border-2 border-orange-500/20 rounded-3xl p-6 flex items-center gap-6 animate-pulse">
                  <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-orange-500 uppercase tracking-[0.2em] italic mb-1">Alineación no validada</p>
                    <p className="text-[10px] text-orange-500/70 font-bold leading-relaxed uppercase tracking-widest italic">
                      Se requieren exactamente 11 jugadores para la alineación inicial. {startersCount < 11 ? `Faltan ${11 - startersCount} elecciones.` : `Exceso de ${startersCount - 11} titulares.`}
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
                      className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between gap-4 group cursor-pointer ${
                        selData.selected 
                          ? (selData.starting ? 'border-primary-600 bg-primary-600/5 shadow-xl shadow-primary-900/5' : 'border-[var(--surface-border)] bg-surface-ground') 
                          : 'border-[var(--surface-border)] bg-surface-card grayscale hover:grayscale-0 opacity-40 hover:opacity-100 hover:scale-[1.01]'
                      }`}
                      onClick={() => toggleSelected(player.id)}
                    >
                      <div className="flex items-center gap-6 flex-1">
                        <div className="relative">
                          <img 
                            src={player.photourl || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`}
                            alt={player.name}
                            className={`w-14 h-14 rounded-2xl object-cover border-2 transition-all ${selData.selected ? 'border-primary-500 shadow-lg' : 'border-[var(--surface-border)] opacity-30 group-hover:opacity-100'}`}
                          />
                          {selData.selected && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-surface-card shadow-lg">
                              <Check size={12} className="text-white" strokeWidth={4} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                             <p className={`text-sm font-black uppercase italic tracking-tighter ${selData.selected ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{player.name}</p>
                             {playerDebts.has(player.id) && (
                               <div className="bg-orange-500/10 text-orange-500 p-1.5 rounded-lg animate-pulse border border-orange-500/20" title="Jugador con deuda pendiente">
                                 <DollarSign size={10} strokeWidth={4} />
                               </div>
                             )}
                          </div>
                          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mt-2 opacity-60">
                          {player.dni ? `Documento: ${player.dni}` : 'IDENTIDAD NO REGISTRADA'} 
                          {selData.selected ? (selData.starting ? ' • ESTRATEGIA: TITULAR' : ' • ESTRATEGIA: BANCO') : ' • ESTADO: DISPONIBLE'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => toggleStarting(player.id)}
                          disabled={!selData.selected}
                          className={`p-4 rounded-2xl border-2 transition-all ${
                            selData.starting 
                              ? 'bg-primary-600 border-primary-600 text-white shadow-xl shadow-primary-600/30' 
                              : (selData.selected ? 'bg-surface-card border-[var(--surface-border)] text-[var(--text-muted)] hover:text-primary-500 hover:border-primary-500 shadow-sm' : 'bg-surface-ground border-[var(--surface-border)] text-[var(--text-muted)]/20 cursor-not-allowed opacity-20')
                          }`}
                          title={selData.starting ? 'Remover Titular' : 'Marcar como Titular'}
                        >
                          <Star size={20} fill={selData.starting ? 'currentColor' : 'none'} strokeWidth={selData.starting ? 1 : 2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes Section */}
              <div className="space-y-4 pt-4">
                <label className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-[0.2em] ml-6 italic opacity-60">Apuntes Tácticos & Observaciones</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones específicas, lesionados a seguir, o variaciones tácticas para este encuentro..."
                  className="w-full bg-surface-ground border-2 border-[var(--surface-border)] rounded-[2.5rem] p-8 text-[var(--text-main)] font-bold text-sm outline-none focus:border-primary-600 transition-all min-h-[140px] resize-none shadow-inner placeholder:italic placeholder:opacity-20"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-10 border-t border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky bottom-0 shadow-2xl">
          <div className="hidden md:flex items-center gap-3 text-[var(--text-muted)] opacity-60">
            <Info size={16} className="text-primary-500" />
            <p className="text-[10px] font-black uppercase tracking-widest italic leading-tight">Los perfiles no seleccionados serán <br/>omitidos del acta arbitral.</p>
          </div>
          <div className="flex items-center gap-6 w-full md:w-auto">
            <button onClick={onClose} className="px-10 py-5 text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all tracking-[0.2em]">Cerrar</button>
            <button 
              onClick={handleSave}
              disabled={isSaving || startersCount !== 11}
              className="flex-1 md:flex-none px-14 py-5 bg-primary-600 hover:bg-primary-700 disabled:opacity-30 disabled:hover:bg-primary-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-4 shadow-2xl shadow-primary-900/40 italic active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <Save size={18} strokeWidth={3} />
                  <span>Confirmar Plantel</span>
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
