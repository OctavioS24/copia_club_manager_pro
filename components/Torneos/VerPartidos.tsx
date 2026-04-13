
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Filter, Plus, Edit3, Calendar, Trophy, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Tournament, Match, Rival, Player, ClubConfig } from '../../types';
import { getPartidosByTorneo } from '../../lib/torneos';
import { getRivals } from '../../lib/rivals';
import { db } from '../../lib/supabase';
import { getPlayersByCategory } from '../../lib/playerUtils';
import CargarResultadoModal from './CargarResultadoModal';
import AgregarFechaModal from './AgregarFechaModal';

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
  const [showAddFechaModal, setShowAddFechaModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [categoryPlayers, setCategoryPlayers] = useState<Player[]>([]);

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
    : matches.filter(m => m.categoryid === selectedCategory);

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
          getCategoryName(match.categoryid || ''),
          tournament.discipline_id,
          match.categoryid
        );
        setCategoryPlayers(filtered as any);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    }
    setShowResultModal(true);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-pink-500 transition-colors uppercase font-black text-[10px] tracking-widest"
          >
            <ArrowLeft size={14} /> Volver
          </button>
          <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
             <Trophy size={32} className="text-pink-600" />
             {tournament.name} - Partidos
          </h2>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
          <Filter size={16} className="text-slate-500 ml-2" />
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent text-white font-bold text-xs outline-none pr-4"
          >
            <option value="TODAS">TODAS LAS CATEGORÍAS</option>
            {tournament.assigned_categories?.map(catId => (
              <option key={catId} value={catId}>{getCategoryName(catId)}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Matches List */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-pink-600" size={32} />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando partidos...</p>
          </div>
        ) : sortedDates.length > 0 ? (
          sortedDates.map((date, index) => (
            <div key={date} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-pink-600/20 rounded-lg flex items-center justify-center text-pink-500 font-black italic text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase italic tracking-tight">Fecha {index + 1}</h3>
                    <p className="text-slate-500 font-bold text-[9px] uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar size={10} /> {new Date(date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-400 text-[10px] uppercase font-black tracking-widest text-left">
                      <th className="px-3 py-2 border-b border-slate-700">Categoría</th>
                      <th className="px-3 py-2 border-b border-slate-700 text-right">Local</th>
                      <th className="px-3 py-2 border-b border-slate-700 text-center w-8"></th>
                      <th className="px-3 py-2 border-b border-slate-700">Visitante</th>
                      <th className="px-3 py-2 border-b border-slate-700 text-center w-20">R</th>
                      <th className="px-3 py-2 border-b border-slate-700 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedMatches[date].map(match => (
                      <tr key={match.id} className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors group">
                        <td className="px-3 py-2">
                          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tight">
                            {getCategoryName(match.categoryid || '')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm font-medium text-white uppercase italic">{match.hometeam}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-[10px] text-slate-600 font-bold lowercase italic">vs</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium text-white uppercase italic">{match.awayteam}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1.5 text-sm font-black italic">
                            <span className={match.status === 'Finished' ? 'text-pink-500' : 'text-slate-600'}>
                              {match.status === 'Finished' ? match.homescore : '0'}
                            </span>
                            <span className="text-slate-800">-</span>
                            <span className={match.status === 'Finished' ? 'text-pink-500' : 'text-slate-600'}>
                              {match.status === 'Finished' ? match.awayscore : '0'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button 
                            onClick={() => handleOpenResultModal(match)}
                            className={`p-1 rounded-md transition-all ${
                              match.status === 'Finished' 
                                ? 'text-slate-500 hover:text-pink-500' 
                                : 'text-pink-500 hover:bg-pink-500 hover:text-white'
                            }`}
                            title={match.status === 'Finished' ? 'Editar Resultado' : 'Cargar Resultado'}
                          >
                            <Edit3 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center">
            <Calendar size={40} className="text-slate-700 mb-4" />
            <h3 className="text-xl font-black uppercase text-slate-500 italic tracking-widest">No hay partidos programados</h3>
          </div>
        )}

        <button 
          onClick={() => setShowAddFechaModal(true)}
          className="w-full py-6 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 hover:text-pink-500 hover:border-pink-500/50 transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <Plus size={24} className="group-hover:scale-110 transition-transform" />
          <span className="font-black uppercase tracking-widest text-[10px]">Agregar Nueva Fecha</span>
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showResultModal && selectedMatch && (
          <CargarResultadoModal 
            match={selectedMatch}
            players={categoryPlayers}
            onClose={() => setShowResultModal(false)}
            onSuccess={() => {
              setShowResultModal(false);
              loadMatches();
            }}
          />
        )}
        {showAddFechaModal && (
          <AgregarFechaModal 
            tournamentId={tournament.id}
            categories={tournament.assigned_categories || []}
            rivals={rivals}
            clubName={clubName}
            onClose={() => setShowAddFechaModal(false)}
            onSuccess={() => {
              setShowAddFechaModal(false);
              loadMatches();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VerPartidos;
