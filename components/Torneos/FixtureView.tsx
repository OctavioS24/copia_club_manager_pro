
import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Loader2, Edit3, Plus, Activity } from 'lucide-react';
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
}

const FixtureView: React.FC<FixtureViewProps> = ({ 
  disciplineId: propDisciplineId, 
  categoryId: propCategoryId, 
  gender: propGender 
}) => {
  const { 
    selectedDivision: contextCategoryId, 
    selectedDiscipline: contextDisciplineId, 
    selectedGender: contextGender 
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

      // Find tournament that matches discipline and gender and has this category
      const activeTournament = tData.find(t => 
        (t.discipline_id === selectedDiscipline || t.disciplineid === selectedDiscipline) && 
        t.gender === selectedGender &&
        (t.assigned_categories?.includes(selectedDivision) || t.assignedcategories?.includes(selectedDivision))
      );

      if (activeTournament) {
        const mData = await getFixturesByCategory(activeTournament.id, selectedDivision);
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
        setPlayers(filtered as any);
      }

    } catch (error) {
      console.error('Error fetching fixture data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDivision, selectedDiscipline, selectedGender]);

  useEffect(() => {
    if (selectedDivision) {
      fetchData();
    }
  }, [selectedDivision, fetchData]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] p-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary-500 rounded-3xl flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Trophy className="w-8 h-8 text-primary-contrast" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">Fixture de Competencia</h2>
            <p className="text-[var(--text-muted)] font-bold text-xs uppercase tracking-[0.2em] mt-1">
              Temporada 2024 <span className="text-primary-500 mx-2">|</span> {matches.length} Fechas Programadas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-surface-ground px-6 py-3 rounded-2xl border border-[var(--surface-border)] text-center">
            <p className="text-[10px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-1">Partidos Jugados</p>
            <p className="text-xl font-black text-[var(--text-main)]">{matches.filter(m => m.status === 'Finished').length}</p>
          </div>
          <div className="bg-surface-ground px-6 py-3 rounded-2xl border border-[var(--surface-border)] text-center">
            <p className="text-[10px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-1">Pendientes</p>
            <p className="text-xl font-black text-primary-500">{matches.filter(m => m.status === 'Scheduled').length}</p>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-6">
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
              className={`group relative bg-surface-card border rounded-[2rem] overflow-hidden transition-all duration-500 ${
                isSuspended ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--surface-border)] hover:border-primary-500/50 shadow-sm'
              }`}
            >
              <div className="p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  {/* Date & Round */}
                  <div className="flex flex-col items-center md:items-start gap-2 min-w-[120px]">
                    <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">Fecha {index + 1}</span>
                    <div className="flex items-center gap-2 text-[var(--text-muted)] font-bold text-sm">
                      <Calendar className="w-4 h-4" />
                      {new Date(match.date).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Teams & Score */}
                  <div className="flex-1 flex items-center justify-center gap-4 md:gap-12">
                    <div className={`flex-1 text-right space-y-2 ${isHome ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'} ${isSuspended ? 'opacity-50' : ''}`}>
                      <p className="text-lg md:text-xl font-black italic uppercase tracking-tighter truncate">{match.hometeam}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">{isHome ? 'Local' : 'Visitante'}</p>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <div className={`px-6 py-3 rounded-2xl font-black text-2xl md:text-3xl italic tracking-tighter border-2 transition-all duration-500 ${
                        isFinished 
                          ? 'bg-[var(--primary-soft)] border-[var(--primary-glow)] text-[var(--text-main)] shadow-lg shadow-primary-500/5' 
                          : isSuspended
                            ? 'bg-red-600/10 border-red-500 text-red-500'
                            : 'bg-surface-ground border-[var(--surface-border)] text-[var(--text-muted)]'
                      }`}>
                        {result}
                      </div>
                      {isFinished && (
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Finalizado</span>
                      )}
                      {isSuspended && (
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest italic animate-pulse">Suspendido</span>
                      )}
                    </div>

                    <div className={`flex-1 text-left space-y-2 ${!isHome ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'} ${isSuspended ? 'opacity-50' : ''}`}>
                      <p className="text-lg md:text-xl font-black italic uppercase tracking-tighter truncate">{match.awayteam}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">{!isHome ? 'Local' : 'Visitante'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {!isFinished && !isSuspended && (
                      <button
                        onClick={() => {
                          setSelectedMatch(match);
                          setShowSquadModal(true);
                        }}
                        className="flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all bg-surface-ground hover:bg-surface-hover text-[var(--text-main)] border border-[var(--surface-border)]"
                      >
                        <Users className="w-4 h-4" />
                        CONVOCATORIA
                      </button>
                    )}
                    <button
                      disabled={isSuspended}
                      onClick={() => setSelectedMatch(match)}
                      className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${
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
                          EDITAR RESULTADO
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          {isSuspended ? 'SUSPENDIDO' : 'CARGAR RESULTADO'}
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
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FixtureView;
