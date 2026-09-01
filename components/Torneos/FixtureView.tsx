
import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Loader2, Edit3, Plus, Activity, Star, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, Player } from '../../types';
import { getFixturesByCategory, getTournaments } from '../../lib/torneos';
import { supabase } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { getPlayersByCategory } from '../../lib/playerUtils';
import CargarResultadoModal from './CargarResultadoModal';
import ConvocatoriaModal from './ConvocatoriaModal';
import { Users } from 'lucide-react';

interface FixtureViewProps {
  disciplineId?: string;
  categoryId?: string;
  gender?: string;
  initialMatchId?: string | null;
  onOpenMatchIdCleared?: () => void;
}

const FixtureView: React.FC<FixtureViewProps> = ({ 
  disciplineId: propDisciplineId, 
  categoryId: propCategoryId, 
  gender: propGender,
  initialMatchId,
  onOpenMatchIdCleared
}) => {
  const { 
    selectedDivision: contextCategoryId, 
    selectedDiscipline: contextDisciplineId, 
    selectedGender: contextGender,
    selectedTournamentId
  } = useCategory();

  const selectedDivision = propCategoryId || contextCategoryId;
  const selectedDiscipline = propDisciplineId || contextDisciplineId;
  const selectedGender = propGender || contextGender;

  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [clubName, setClubName] = useState('MI CLUB');

  const fetchData = React.useCallback(async () => {
    if (!selectedDivision) return;
    
    try {
      setIsLoading(true);
      
      // Fetch club config for name
      const { data: clubData } = await supabase.from('club_config').select('name').eq('id', 1).single();
      if (clubData) setClubName(clubData.name);

      // Fetch tournaments to find the active one for this category
      const tData = await getTournaments();

      // Find the tournament to use: either selectedTournamentId or a fallback
      const chosenTournament = selectedTournamentId 
        ? tData.find(t => t.id === selectedTournamentId)
        : tData.find(t => 
            (t.discipline_id === selectedDiscipline || t.disciplineid === selectedDiscipline) && 
            t.gender === selectedGender &&
            (t.assigned_categories?.includes(selectedDivision) || t.assignedcategories?.includes(selectedDivision))
          );

      if (chosenTournament) {
        const mData = await getFixturesByCategory(chosenTournament.id, selectedDivision);
        setMatches(mData);
      } else {
        setMatches([]);
      }

      // Fetch players for the result modal
      const { data: allPlayers } = await supabase.from('members').select('*');
      
      if (allPlayers) {
        const filtered = getPlayersByCategory(
          allPlayers as any,
          '', // disciplineName fallback
          selectedGender || '',
          '', // categoryName fallback
          selectedDiscipline,
          selectedDivision
        );
        
        const onlyAthletes = filtered.filter(p => {
          const m = p as any;
          if (!m.assignments || !Array.isArray(m.assignments)) return false;
          return m.assignments.some((asign: any) => {
            const matchesDisc = !selectedDiscipline || asign.discipline_id === selectedDiscipline || asign.discipline === selectedDiscipline;
            const matchesCat = !selectedDivision || asign.category_id === selectedDivision || asign.category === selectedDivision;
            const isPlayer = asign.role === 'PLAYER' || asign.role === 'JUGADOR';
            return matchesDisc && matchesCat && isPlayer;
          });
        });
        
        setPlayers(onlyAthletes as any);
      }

    } catch (error) {
      console.error('Error fetching fixture data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDivision, selectedDiscipline, selectedGender, selectedTournamentId]);

  useEffect(() => {
    if (selectedDivision) {
      fetchData();
    }
  }, [selectedDivision, fetchData]);

  useEffect(() => {
    const targetId = initialMatchId || localStorage.getItem('open_fixture_match_id');
    if (targetId && matches.length > 0) {
      const matchToOpen = matches.find(m => m.id === targetId);
      if (matchToOpen) {
        setSelectedMatch(matchToOpen);
        setShowSquadModal(false);
        if (onOpenMatchIdCleared) {
          onOpenMatchIdCleared();
        }
        localStorage.removeItem('open_fixture_match_id');
      }
    }
  }, [initialMatchId, matches, onOpenMatchIdCleared]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        <p className="font-black text-xs tracking-widest uppercase">Cargando Fixture...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] bg-surface-ground rounded-[3rem] border border-dashed border-[var(--surface-border)]">
        <Trophy size={64} className="mb-6 opacity-20 text-primary-500" />
        <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2">No hay fixture asignado</h3>
        <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest">Crea un torneo y asigna esta categoría para ver el fixture</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-card border border-[var(--surface-border)] rounded-2xl md:rounded-[2.5rem] p-5 md:p-8">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary-500 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
            <Trophy className="w-6 h-6 md:w-8 md:h-8 text-primary-contrast" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tighter truncate">Fixture</h2>
            <p className="text-[var(--text-muted)] font-bold text-[9px] md:text-xs uppercase tracking-[0.2em] mt-1">
              Temporada 2024 <span className="text-primary-500 mx-2">|</span> {matches.length} Fechas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex-1 md:flex-none bg-surface-ground px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border border-[var(--surface-border)] text-center">
            <p className="text-[8px] md:text-[10px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-0.5">Jugados</p>
            <p className="text-base md:text-xl font-black text-[var(--text-main)]">{matches.filter(m => m.status === 'Finished').length}</p>
          </div>
          <div className="flex-1 md:flex-none bg-surface-ground px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border border-[var(--surface-border)] text-center">
            <p className="text-[8px] md:text-[10px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-0.5">Pendientes</p>
            <p className="text-base md:text-xl font-black text-primary-500">{matches.filter(m => m.status === 'Scheduled').length}</p>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-4 md:space-y-6">
        {matches.map((match, index) => {
          const isFinished = match.status === 'Finished';
          const isSuspended = match.status === 'Suspended';
          const isHome = match.hometeam === clubName;
          const result = isFinished ? `${match.homescore} - ${match.awayscore}` : (isSuspended ? 'SUSP' : 'VS');
          
          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`group relative bg-surface-card border rounded-[1.5rem] md:rounded-[2rem] overflow-hidden transition-all duration-500 ${
                isSuspended ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--surface-border)] hover:border-primary-500/50 shadow-sm'
              }`}
            >
              <div className="p-4 md:p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
                  {/* Date & Round */}
                  <div className="flex flex-row md:flex-col items-center md:items-start justify-between w-full md:w-auto md:min-w-[120px] pb-4 md:pb-0 border-b md:border-b-0 border-[var(--surface-border)]">
                    <span className="text-[9px] md:text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">Fecha {index + 1}</span>
                    <div className="flex items-center gap-2 text-[var(--text-muted)] font-bold text-[10px] md:text-sm">
                      <Calendar className="w-3 h-3 md:w-4 md:h-4 text-primary-500/50" />
                      {new Date(match.date).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Teams & Score */}
                  <div className="w-full flex-1 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12 py-4 md:py-0">
                    <div className={`w-full md:flex-1 text-center md:text-right space-y-1 ${isHome ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'} ${isSuspended ? 'opacity-50' : ''}`}>
                      <p className="text-base md:text-xl font-black italic uppercase tracking-tighter truncate leading-tight px-2">{match.hometeam}</p>
                      <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest opacity-50">{isHome ? 'Local' : 'Visita'}</p>
                    </div>

                    <div className="flex flex-col items-center gap-1 md:gap-2 shrink-0">
                      <div className={`px-5 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-black text-xl md:text-3xl italic tracking-tighter border-2 transition-all duration-500 shadow-sm ${
                        isFinished 
                          ? 'bg-[var(--primary-soft)] border-[var(--primary-glow)] text-[var(--text-main)] shadow-lg shadow-primary-500/5' 
                          : isSuspended
                            ? 'bg-red-600/10 border-red-500 text-red-500'
                            : 'bg-surface-ground border-[var(--surface-border)] text-[var(--text-muted)]'
                      }`}>
                        {result}
                      </div>
                      {isFinished && (
                        <span className="text-[8px] md:text-[10px] font-black text-green-500 uppercase tracking-widest">Final</span>
                      )}
                      {isSuspended && (
                        <span className="text-[8px] md:text-[10px] font-black text-red-500 uppercase tracking-widest italic animate-pulse">Susp.</span>
                      )}
                    </div>

                    <div className={`w-full md:flex-1 text-center md:text-left space-y-1 ${!isHome ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'} ${isSuspended ? 'opacity-50' : ''}`}>
                      <p className="text-base md:text-xl font-black italic uppercase tracking-tighter truncate leading-tight px-2">{match.awayteam}</p>
                      <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest opacity-50">{!isHome ? 'Local' : 'Visita'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-2 md:gap-3">
                    {!isFinished && !isSuspended && (() => {
                      const matchSquad = Array.isArray((match as any).squad) ? (match as any).squad[0] : (match as any).squad;
                      const hasSquad = !!matchSquad;
                      const squadPlayers = matchSquad?.players || [];
                      const hasStarters = squadPlayers.some((p: any) => p.is_starting);

                      if (!hasSquad) {
                        return (
                          <button
                            onClick={() => {
                              setSelectedMatch(match);
                              setShowSquadModal(true);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 md:px-5 py-3 rounded-xl font-black text-[9px] md:text-[10px] tracking-widest uppercase transition-all bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/20"
                          >
                            <Users className="w-4 h-4" />
                            <span>CONVOCATORIA</span>
                          </button>
                        );
                      }

                      if (!hasStarters) {
                        return (
                          <button
                            onClick={() => {
                              setSelectedMatch(match);
                              setShowSquadModal(true);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 md:px-5 py-3 rounded-xl font-black text-[9px] md:text-[10px] tracking-widest uppercase transition-all bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30"
                          >
                            <Star className="w-4 h-4" fill="currentColor" />
                            <span>DEFINIR EQUIPO</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={() => {
                            setSelectedMatch(match);
                            setShowSquadModal(true);
                          }}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 md:px-5 py-3 rounded-xl font-black text-[9px] md:text-[10px] tracking-widest uppercase transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>PLANTILLA</span>
                        </button>
                      );
                    })()}

                    <button
                      disabled={isSuspended}
                      onClick={() => {
                        setShowSquadModal(false);
                        setSelectedMatch(match);
                      }}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 md:px-6 py-3 rounded-xl font-black text-[9px] md:text-[10px] tracking-widest uppercase transition-all ${
                        isFinished
                          ? 'bg-surface-ground hover:bg-surface-hover text-[var(--text-main)] border border-[var(--surface-border)]'
                          : isSuspended
                            ? 'bg-surface-ground text-[var(--text-muted)] cursor-not-allowed opacity-50'
                            : 'bg-primary-500 text-primary-contrast shadow-lg shadow-primary-500/20'
                      }`}
                    >
                      {isFinished ? (
                        <>
                          <Edit3 className="w-4 h-4" />
                          <span>RESULTADO</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>CARGAR DATOS</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Events Preview */}
                {isFinished && match.events && match.events.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-[var(--surface-border)] flex flex-wrap gap-4 justify-center">
                    {match.events.map((event, eIdx) => {
                      const player = players.find(p => p.id === event.playerid);
                      return (
                        <div key={eIdx} className="flex items-center gap-2 px-3 py-1.5 bg-surface-ground rounded-full border border-[var(--surface-border)]">
                          <Activity className={`w-3 h-3 ${
                            event.type === 'Goal' ? 'text-green-500' : 
                            event.type === 'YellowCard' ? 'text-yellow-500' : 'text-red-500'
                          }`} />
                          <span className="text-[10px] font-bold text-[var(--text-muted)]">{player?.name || 'Jugador'} ({event.minute}')</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {selectedMatch && !showSquadModal && (
          <CargarResultadoModal
            key="resultado-modal"
            match={selectedMatch}
            players={players}
            isMyClubHome={selectedMatch.hometeam === clubName}
            onClose={() => setSelectedMatch(null)}
            onSuccess={() => {
              setSelectedMatch(null);
              fetchData();
            }}
          />
        )}
        {selectedMatch && showSquadModal && (
          <ConvocatoriaModal 
            key="squad-modal"
            match={selectedMatch}
            players={players}
            discipline={contextDisciplineId ? clubName : 'FUTBOL'} // Fallback
            onClose={() => {
              setSelectedMatch(null);
              setShowSquadModal(false);
            }}
            onSuccess={() => {
              setSelectedMatch(null);
              setShowSquadModal(false);
              fetchData();
            }}
            onOpenResultModal={(m) => {
              setShowSquadModal(false);
              setSelectedMatch(m);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FixtureView;
