import React, { useState, useEffect } from 'react';
import { Users, Star, Check, X, Loader2, Save, Info, DollarSign, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { Match, Member, MatchSquadPlayer } from '../../types';
import { getMatchSquad, saveMatchSquad } from '../../lib/squads';
import { db, supabase } from '../../lib/supabase';

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
  const [activeCommitments, setActiveCommitments] = useState<Set<string>>(new Set());
  
  // Step navigation: 'convocatoria' (paso 1) or 'titulares' (paso 2)
  const [actionStep, setActionStep] = useState<'convocatoria' | 'titulares'>('convocatoria');

  // State for selected players and starters
  const [selection, setSelection] = useState<Record<string, { selected: boolean, starting: boolean }>>({});
  const [notes, setNotes] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const loadSquadAndDebts = async () => {
      setIsLoading(true);
      try {
        // Cargar convocatoria existente
        const existingSquad = await getMatchSquad(match.id);
        
        // Cargar rival para obtener la ubicación por defecto
        const { data: rivalsData } = await supabase.from('rivals').select('*');
        const matchRival = rivalsData?.find(r => r.name === match.hometeam || r.name === match.awayteam);
        const defaultLocation = matchRival?.address_url || '';

        // Cargar morosos
        const { data: debts } = await db.fees.getAllDebts();
        if (debts) {
          setPlayerDebts(new Set(debts.map(d => d.member_id)));
        }

        // Cargar compromisos de pago activos
        const { data: commitments } = await supabase
          .from('payment_commitments')
          .select('member_id')
          .eq('fulfilled', false);
        if (commitments) {
          setActiveCommitments(new Set(commitments.map(c => c.member_id)));
        }
        
        const initialSelection: Record<string, { selected: boolean, starting: boolean }> = {};
        
        // Default: If no squad exists, all provided players are pre-selected but not starting
        players.forEach(p => {
          initialSelection[p.id] = { selected: !existingSquad, starting: false };
        });

        if (existingSquad) {
          setNotes(existingSquad.notes || '');
          setAppointmentTime(existingSquad.appointment_time || '');
          setLocation(existingSquad.location || defaultLocation);
          existingSquad.players?.forEach(sp => {
            if (initialSelection[sp.player_id]) {
              initialSelection[sp.player_id] = { selected: true, starting: sp.is_starting };
            }
          });
        } else {
          setLocation(defaultLocation);
        }

        setSelection(initialSelection);
      } catch (error) {
        console.error('Error loading squad:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSquadAndDebts();
  }, [match.id, match.hometeam, match.awayteam, players]);

  const toggleSelected = (playerId: string) => {
    setSelection(prev => {
      const current = prev[playerId] || { selected: false, starting: false };
      // If we unselect, it cannot be starting either
      return {
        ...prev,
        [playerId]: { 
          selected: !current.selected, 
          starting: false 
        }
      };
    });
  };

  const toggleStarting = (playerId: string) => {
    setSelection(prev => {
      const current = prev[playerId] || { selected: false, starting: false };
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
    setIsSaving(true);
    try {
      const playersToSave: Partial<MatchSquadPlayer>[] = Object.entries(selection)
        .filter(([, data]) => data.selected)
        .map(([playerId, data]) => ({
          player_id: playerId,
          is_starting: data.starting,
          minutes_played: data.starting ? 90 : 0 // Default starting to full match
        }));

      await saveMatchSquad(
        {
          match_id: match.id,
          tournament_id: match.tournamentid || (match as any).tournament_id || match.tournament_id,
          category_id: match.categoryid || (match as any).category_id,
          discipline: discipline,
          notes: notes,
          appointment_time: appointmentTime || null,
          location: location || null
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

  const playersUpToDate = players.filter(player => !(playerDebts.has(player.id) && !activeCommitments.has(player.id)));
  const playersWithDebts = players.filter(player => playerDebts.has(player.id) && !activeCommitments.has(player.id));

  const sortedUpToDate = [...playersUpToDate].sort((a, b) => a.name.localeCompare(b.name));
  const sortedWithDebts = [...playersWithDebts].sort((a, b) => a.name.localeCompare(b.name));

  // Convocados array for Step 2
  const summonedPlayers = players.filter(p => selection[p.id]?.selected);
  const startingLineup = summonedPlayers.filter(p => selection[p.id]?.starting).sort((a, b) => a.name.localeCompare(b.name));
  const substitutesLineup = summonedPlayers.filter(p => !selection[p.id]?.starting).sort((a, b) => a.name.localeCompare(b.name));

  const renderPlayerSelectCard = (player: Member) => {
    const selData = selection[player.id] || { selected: false, starting: false };
    const hasDebt = playerDebts.has(player.id) && !activeCommitments.has(player.id);
    return (
      <div 
        key={player.id}
        className={`p-5 rounded-[2rem] border-2 transition-all flex items-center justify-between gap-4 group cursor-pointer ${
          selData.selected 
            ? 'border-primary-600 bg-primary-600/5 shadow-md shadow-primary-900/5' 
            : 'border-[var(--surface-border)] bg-surface-card hover:border-[var(--surface-border-hover)]'
        }`}
        onClick={() => toggleSelected(player.id)}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="relative">
            <img 
              referrerPolicy="no-referrer"
              src={player.photourl || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`}
              alt={player.name}
              className={`w-12 h-12 rounded-2xl object-cover border-2 transition-all ${selData.selected ? 'border-primary-500 shadow-md' : 'border-[var(--surface-border)] opacity-60'}`}
            />
            {selData.selected && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-surface-card shadow-lg animate-fade-in">
                <Check size={10} className="text-white" strokeWidth={4} />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
               <p className={`text-xs font-black uppercase italic tracking-tighter ${selData.selected ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{player.name}</p>
               {hasDebt && (
                 <div className="bg-orange-500/10 text-orange-500 p-1 rounded-lg border border-orange-500/20" title="Jugador con deuda pendiente / Compromiso activo acuerda plan de pagos">
                   <DollarSign size={8} strokeWidth={4} />
                 </div>
               )}
            </div>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1 opacity-75">
              {player.dni ? `Documento: ${player.dni}` : 'IDENTIDAD NO REGISTRADA'}
            </p>
          </div>
        </div>
        <div className="pointer-events-none">
          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selData.selected ? 'bg-primary-600 border-primary-600 text-white' : 'border-[var(--surface-border)] text-transparent'}`}>
            <Check size={12} strokeWidth={4} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-surface-ground/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-primary-600/10 rounded-2xl flex items-center justify-center border border-primary-600/20 shadow-inner">
              <Users className="text-primary-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-none">Planilla de Convocados</h2>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
                {match.hometeam} vs {match.awayteam} • {new Date(match.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 text-[var(--text-muted)] hover:text-red-500 hover:bg-surface-hover rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Wizard progress steps indicator */}
        <div className="px-8 py-3 bg-surface-ground border-b border-[var(--surface-border)] flex items-center justify-center gap-5 shrink-0">
          <button
            onClick={() => setActionStep('convocatoria')}
            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${actionStep === 'convocatoria' ? 'text-primary-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${actionStep === 'convocatoria' ? 'bg-primary-600 text-white' : 'bg-surface-card border border-[var(--surface-border)] text-[var(--text-muted)]'}`}>1</div>
            <span>1. Modificar Convocados</span>
          </button>
          
          <div className="h-0.5 w-12 bg-[var(--surface-border)]" />
          
          <button
            disabled={summonedCount === 0}
            onClick={() => setActionStep('titulares')}
            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40 ${actionStep === 'titulares' ? 'text-primary-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${actionStep === 'titulares' ? 'bg-primary-600 text-white' : 'bg-surface-card border border-[var(--surface-border)] text-[var(--text-muted)]'}`}>2</div>
            <span>2. Definir Alineación</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-primary-600" size={36} />
              <p className="text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest opacity-40 italic">Cargando plantel...</p>
            </div>
          ) : actionStep === 'convocatoria' ? (
            /* ================= STEP 1: SELECT SQUAD PLAYERS ================= */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Efectivos Convocados</p>
                    <span className="text-xl font-black italic text-[var(--text-main)]">
                      {summonedCount} / <span className="opacity-40">{players.length}</span>
                    </span>
                  </div>
                  <div className="p-3 bg-primary-600/10 text-primary-600 rounded-xl">
                    <Users size={18} />
                  </div>
                </div>

                <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Titulares actuales</p>
                    <span className={`text-xl font-black italic ${startersCount === 11 ? 'text-emerald-500' : 'text-[var(--text-main)]'}`}>
                      {startersCount} <span className="text-xs font-normal text-[var(--text-muted)]">titulares</span>
                    </span>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Star size={18} fill={startersCount > 0 ? 'currentColor' : 'none'} />
                  </div>
                </div>
              </div>

              {/* Listado de Jugadores por Estado de Pago */}
              <div className="space-y-6">
                {/* Primera sección: Jugadores con pagos al día */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest italic">Jugadores al día ({sortedUpToDate.length})</h3>
                  </div>
                  {sortedUpToDate.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sortedUpToDate.map(renderPlayerSelectCard)}
                    </div>
                  ) : (
                    <div className="p-4 bg-surface-ground rounded-xl border border-dashed border-[var(--surface-border)] text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider italic">
                      No hay jugadores sin deudas pendientes.
                    </div>
                  )}
                </div>

                {/* Segunda sección: Jugadores que deben */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-[10px] font-black uppercase text-red-500 tracking-widest italic">Jugadores con saldos pendientes ({sortedWithDebts.length})</h3>
                  </div>
                  {sortedWithDebts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sortedWithDebts.map(renderPlayerSelectCard)}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-500/5 text-emerald-500 rounded-xl border border-dashed border-emerald-500/20 text-center text-[10px] font-bold uppercase tracking-wider italic">
                      ¡Todos los jugadores están al día con sus pagos! 🎉
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ================= STEP 2: ASSIGN STARTERS / SUBSTITUTES ================= */
            <div className="space-y-6">
              <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl p-4 flex items-center gap-4">
                <div className="p-2 bg-primary-500/10 rounded-xl text-primary-500 shrink-0">
                  <Star size={20} fill="currentColor" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-main)] italic">Modo Pizarra Táctica: Selección de Alineación</h4>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1 italic">
                    Toca a cualquier jugador para cambiarlo instantáneamente entre <span className="text-emerald-500 font-black">Titulares</span> y <span className="text-amber-500 font-bold">Suplentes</span> de forma ágil e intuitiva.
                  </p>
                </div>
              </div>

              {/* Columns Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* COLUMN LEFT: BANQUILLO / SUPLENTES */}
                <div className="bg-surface-ground border border-[var(--surface-border)] rounded-[2rem] p-5 space-y-4 shadow-sm min-h-[350px]">
                  <div className="flex justify-between items-center border-b border-[var(--surface-border)] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-black uppercase italic tracking-wider text-[var(--text-main)]">BANCO / SUPLENTES</h4>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[9px] font-black uppercase tracking-wider">{substitutesLineup.length} Jugadores</span>
                  </div>

                  {substitutesLineup.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5">
                      {substitutesLineup.map(player => (
                        <div
                          key={player.id}
                          onClick={() => toggleStarting(player.id)}
                          className="p-4 bg-surface-card hover:bg-surface-hover border border-[var(--surface-border)] hover:border-emerald-500/30 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:translate-x-1 group"
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              referrerPolicy="no-referrer"
                              src={player.photourl || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`}
                              alt={player.name}
                              className="w-10 h-10 rounded-xl object-cover border border-[var(--surface-border)] opacity-80"
                            />
                            <div>
                              <p className="text-xs font-black uppercase text-[var(--text-main)] leading-none mb-1">{player.name}</p>
                              <span className="text-[8px] font-black text-[var(--text-muted)] tracking-widest uppercase">Tap para subir a Titular</span>
                            </div>
                          </div>
                          <button className="p-2 rounded-lg bg-surface-ground text-[var(--text-muted)] group-hover:text-emerald-500 transition-colors">
                            <Star size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs font-semibold text-[var(--text-muted)] italic uppercase tracking-wider opacity-60">
                      Banco vacío. No hay suplentes.
                    </div>
                  )}
                </div>

                {/* COLUMN RIGHT: TITULARES / ALINEACION */}
                <div className="bg-primary-500/[0.02] border-2 border-primary-500/20 rounded-[2rem] p-5 space-y-4 shadow-md min-h-[350px]">
                  <div className="flex justify-between items-center border-b border-primary-500/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 className="text-xs font-black uppercase italic tracking-wider text-[var(--text-main)]">TITULARES (Alineación Inicial)</h4>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[9px] font-black uppercase tracking-wider">{startingLineup.length} TITULARES</span>
                  </div>

                  {startingLineup.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5">
                      {startingLineup.map(player => (
                        <div
                          key={player.id}
                          onClick={() => toggleStarting(player.id)}
                          className="p-4 bg-surface-card hover:bg-surface-hover border-2 border-primary-600 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:translate-x-[-4px] group shadow-inner"
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              referrerPolicy="no-referrer"
                              src={player.photourl || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`}
                              alt={player.name}
                              className="w-10 h-10 rounded-xl object-cover border-2 border-primary-500"
                            />
                            <div>
                              <p className="text-xs font-black uppercase text-primary-500 leading-none mb-1">{player.name}</p>
                              <span className="text-[8px] font-black text-emerald-500 tracking-widest uppercase">Tap para bajar al Banco</span>
                            </div>
                          </div>
                          <button className="p-2 rounded-lg bg-emerald-500 text-white shadow-md">
                            <Star size={16} fill="white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs font-semibold text-[var(--text-muted)] italic uppercase tracking-wider opacity-60">
                      Toca jugadores suplentes de la izquierda para colocarlos en la alineación titular.
                    </div>
                  )}
                </div>
              </div>

              {/* Match and Tact Notes fields inside step 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[var(--surface-border)]">
                {/* Notes Column */}
                <div className="space-y-2">
                  <label htmlFor="notes-field" className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest italic ml-2 block opacity-75">Apuntes Tácticos & Observaciones</label>
                  <textarea 
                    id="notes-field"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instrucciones específicas, lesionados a seguir, o variaciones tácticas para este encuentro..."
                    className="w-full bg-surface-ground border-2 border-[var(--surface-border)] rounded-2xl p-4 text-[var(--text-main)] font-semibold text-xs outline-none focus:border-primary-600 transition-all min-h-[140px] resize-none"
                  />
                </div>

                {/* Details Column */}
                <div className="space-y-4">
                  <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <label htmlFor="citation-time-field" className="text-[9px] font-black text-primary-500 uppercase tracking-widest block italic">
                        Hora de Citación
                      </label>
                      <input
                        id="citation-time-field"
                        type="time"
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        className="w-full bg-surface-card border border-[var(--surface-border)] hover:border-primary-500/50 focus:border-primary-600 rounded-xl px-4 py-2 mt-1 text-xs font-black uppercase text-[var(--text-main)] outline-none transition-all"
                      />
                    </div>
                    <div className="p-3 bg-primary-600/10 text-primary-600 rounded-xl">
                      <Users size={20} />
                    </div>
                  </div>

                  <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <label htmlFor="location-field" className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block italic">
                        Ubicación del Partido
                      </label>
                      <input
                        id="location-field"
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Dirección o enlace de mapa"
                        className="w-full bg-surface-card border border-[var(--surface-border)] hover:border-emerald-500/50 focus:border-emerald-600 rounded-xl px-4 py-2 mt-1 text-xs font-bold text-[var(--text-main)] outline-none transition-all"
                      />
                    </div>
                    {location ? (
                      <a
                        href={location.startsWith('http://') || location.startsWith('https://') ? location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-xl border border-emerald-500/20 shadow-md flex items-center gap-1.5 transition-all text-xs font-black uppercase tracking-wider cursor-pointer"
                        title="Abrir ubicación en Google Maps"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapPin size={18} />
                      </a>
                    ) : (
                      <div className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl">
                        <MapPin size={20} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 border-t border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky bottom-0 shrink-0">
          <div className="hidden md:flex items-center gap-2 text-[var(--text-muted)] opacity-75">
            <Info size={14} className="text-primary-500" />
            <p className="text-[8px] font-black uppercase tracking-widest italic leading-tight">Al confirmarse, la plantilla podrá ser visualizada en los reportes de juego.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            {actionStep === 'titulares' ? (
              <button 
                onClick={() => setActionStep('convocatoria')}
                className="px-6 py-4 border border-[var(--surface-border)] hover:border-[var(--text-muted)] hover:bg-surface-hover rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2 transition-all"
              >
                <ChevronLeft size={14} />
                <span>Volver</span>
              </button>
            ) : (
              <button onClick={onClose} className="px-6 py-4 text-[9px] font-black uppercase text-[var(--text-muted)] hover:text-red-500 transition-all tracking-widest">Cerrar</button>
            )}

            {actionStep === 'convocatoria' ? (
              <button 
                disabled={summonedCount === 0}
                onClick={() => setActionStep('titulares')}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-30 disabled:hover:bg-primary-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md italic"
              >
                <span>Alineación táctica</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button 
                onClick={handleSave}
                disabled={isSaving || summonedCount === 0}
                className="px-10 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-30 disabled:hover:bg-primary-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-md italic"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Confirmar Convocatoria</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConvocatoriaModal;
