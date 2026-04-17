
import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Loader2, Edit3, Plus, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, Player } from '../../types';
import { getFixturesByCategory, getTournaments } from '../../lib/torneos';
import { supabase } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { getPlayersByCategory } from '../../lib/playerUtils';
import CargarResultadoModal from './CargarResultadoModal';

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
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
        <p className="font-black text-xs tracking-widest uppercase">Cargando Fixture...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-800/10 rounded-[3rem] border border-dashed border-slate-700/50">
        <Trophy size={64} className="mb-6 opacity-20 text-pink-500" />
        <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2">No hay fixture asignado</h3>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Crea un torneo y asigna esta categoría para ver el fixture</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-800/40 border border-slate-700/50 rounded-[2.5rem] p-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-pink-600 rounded-3xl flex items-center justify-center shadow-lg shadow-pink-600/20">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Fixture de Competencia</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-1">
              Temporada 2024 <span className="text-pink-500 mx-2">|</span> {matches.length} Fechas Programadas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-700/50 text-center">
            <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Partidos Jugados</p>
            <p className="text-xl font-black text-white">{matches.filter(m => m.status === 'Finished').length}</p>
          </div>
          <div className="bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-700/50 text-center">
            <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Pendientes</p>
            <p className="text-xl font-black text-pink-500">{matches.filter(m => m.status === 'Scheduled').length}</p>
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
              className={`group relative bg-slate-800/30 border rounded-[2rem] overflow-hidden transition-all duration-500 ${
                isSuspended ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/30 hover:border-pink-500/30'
              }`}
            >
              <div className="p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  {/* Date & Round */}
                  <div className="flex flex-col items-center md:items-start gap-2 min-w-[120px]">
                    <span className="text-[10px] font-black text-pink-500 uppercase tracking-[0.3em]">Fecha {index + 1}</span>
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
                      <Calendar className="w-4 h-4" />
                      {new Date(match.date).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Teams & Score */}
                  <div className="flex-1 flex items-center justify-center gap-4 md:gap-12">
                    <div className={`flex-1 text-right space-y-2 ${isHome ? 'text-white' : 'text-slate-400'} ${isSuspended ? 'opacity-50' : ''}`}>
                      <p className="text-lg md:text-xl font-black italic uppercase tracking-tighter truncate">{match.hometeam}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">{isHome ? 'Local' : 'Visitante'}</p>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <div className={`px-6 py-3 rounded-2xl font-black text-2xl md:text-3xl italic tracking-tighter border-2 transition-all duration-500 ${
                        isFinished 
                          ? 'bg-pink-600/10 border-pink-500 text-white shadow-lg shadow-pink-500/10' 
                          : isSuspended
                            ? 'bg-red-600/10 border-red-500 text-red-500'
                            : 'bg-slate-900 border-slate-700 text-slate-500'
                      }`}>
                        {result}
                      </div>
                      {isFinished && (
                        <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Finalizado</span>
                      )}
                      {isSuspended && (
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest italic animate-pulse">Suspendido</span>
                      )}
                    </div>

                    <div className={`flex-1 text-left space-y-2 ${!isHome ? 'text-white' : 'text-slate-400'} ${isSuspended ? 'opacity-50' : ''}`}>
                      <p className="text-lg md:text-xl font-black italic uppercase tracking-tighter truncate">{match.awayteam}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">{!isHome ? 'Local' : 'Visitante'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      disabled={isSuspended}
                      onClick={() => setSelectedMatch(match)}
                      className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${
                        isFinished
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : isSuspended
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-600/20'
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
                  <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-wrap gap-4 justify-center">
                    {match.events.map((event, eIdx) => {
                      const player = players.find(p => p.id === event.playerid);
                      return (
                        <div key={eIdx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-full border border-slate-700/50">
                          <Activity className={`w-3 h-3 ${
                            event.type === 'Goal' ? 'text-green-400' : 
                            event.type === 'YellowCard' ? 'text-yellow-400' : 'text-red-400'
                          }`} />
                          <span className="text-[10px] font-bold text-slate-400">{player?.name || 'Jugador'} ({event.minute}')</span>
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
        {selectedMatch && (
          <CargarResultadoModal
            match={selectedMatch}
            players={players}
            onClose={() => setSelectedMatch(null)}
            onSuccess={() => {
              setSelectedMatch(null);
              fetchData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FixtureView;
