
import React, { useState, useEffect, useMemo } from 'react';
import { Match, Member } from '../../types';
import { db, supabase } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Calendar, Search, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import ConvocatoriaModal from '../Torneos/ConvocatoriaModal';
import { getPlayersByCategory } from '../../lib/playerUtils';

const SquadsTab: React.FC = () => {
  const { selectedDiscipline, selectedDivision, selectedGender } = useCategory();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clubName, setClubName] = useState('MI CLUB');
  
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showSquadModal, setShowSquadModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDivision || !selectedDiscipline) return;
      
      setIsLoading(true);
      try {
        // Fetch club config for name
        const { data: clubData } = await supabase.from('club_config').select('name').eq('id', 1).single();
        if (clubData) setClubName(clubData.name);

        // Fetch matches for this category/discipline/gender
        // We filter by category_id or category
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*, squad:match_squads(id)')
          .eq('categoryid', selectedDivision)
          .order('date', { ascending: true });

        if (matchesError) throw matchesError;
        if (matchesData) setMatches(matchesData);
        
        // Fetch all members to filter for this category
        const { data: membersRes } = await db.members.getAll();

        if (membersRes) {
          const filtered = getPlayersByCategory(
            membersRes as any,
            '', // disciplineName fallback
            selectedGender || '',
            '', // categoryName fallback
            selectedDiscipline,
            selectedDivision
          );
          setPlayers(filtered);
        }
      } catch (err) {
        console.error("Error fetching squads tab data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDivision, selectedDiscipline, selectedGender]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchName = `${m.hometeam} vs ${m.awayteam}`.toLowerCase();
      const searchMatch = matchName.includes(searchTerm.toLowerCase());
      // Show scheduled or suspended matches, finished might be less relevant here but we can show them
      return searchMatch && !m.is_overridden;
    });
  }, [matches, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
        <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px]">Cargando partidos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">Gestión de Convocatorias</h2>
          <p className="text-[var(--text-muted)] font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
            Planifica las plantillas para los próximos encuentros
          </p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
          <input 
            type="text" 
            placeholder="Buscar partido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[var(--surface-ground)] border border-[var(--surface-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 ring-primary-500/20 text-[var(--text-main)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredMatches.length > 0 ? (
          filteredMatches.map(m => {
            const hasSquad = (m as any).squad && (m as any).squad.length > 0;
            const isFinished = m.status === 'Finished';
            
            return (
              <div 
                key={m.id}
                onClick={() => { setSelectedMatch(m); setShowSquadModal(true); }}
                className={`group relative bg-surface-card p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer overflow-hidden ${
                  hasSquad 
                    ? 'border-green-500/20 hover:border-green-500/50' 
                    : 'border-[var(--surface-border)] hover:border-primary-500/50'
                } ${isFinished ? 'opacity-70' : ''}`}
              >
                {hasSquad && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="text-green-500" size={20} />
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-3 py-1 bg-surface-ground border border-[var(--surface-border)] rounded-lg text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                    {new Date(m.date).toLocaleDateString()}
                  </div>
                  {!hasSquad && !isFinished && (
                    <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-orange-500 animate-pulse">
                      <AlertCircle size={12} /> Pendiente
                    </div>
                  )}
                  {isFinished && (
                    <div className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Finalizado
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-black uppercase italic text-[var(--text-main)] truncate max-w-[120px]">{m.hometeam}</span>
                    <span className="text-[10px] font-black text-primary-500 shrink-0">VS</span>
                    <span className="text-sm font-black uppercase italic text-[var(--text-main)] truncate max-w-[120px] text-right">{m.awayteam}</span>
                  </div>
                  <div className="h-1 bg-surface-ground rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${hasSquad ? 'w-full bg-green-500' : 'w-0 bg-primary-600'}`}></div>
                  </div>
                </div>

                <button className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all ${
                  hasSquad 
                    ? 'bg-green-600/10 text-green-600 group-hover:bg-green-600 group-hover:text-white' 
                    : 'bg-primary-600 text-white shadow-xl shadow-primary-600/20 group-hover:scale-[1.02]'
                }`}>
                  {hasSquad ? 'Revisar Plantilla' : 'Armar Convocatoria'}
                  <ChevronRight size={14} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
             <Calendar size={48} className="mx-auto text-[var(--text-muted)] mb-4 opacity-20" />
             <h3 className="text-xl font-black uppercase text-[var(--text-muted)] italic tracking-widest">No hay partidos para esta categoría</h3>
          </div>
        )}
      </div>

      {selectedMatch && showSquadModal && (
        <ConvocatoriaModal 
          match={selectedMatch}
          players={players}
          discipline={clubName} 
          onClose={() => {
            setSelectedMatch(null);
            setShowSquadModal(false);
          }}
          onSuccess={() => {
            setSelectedMatch(null);
            setShowSquadModal(false);
            // Refresh local matches list
            const fetchData = async () => {
               const { data: matchesData } = await supabase
                .from('matches')
                .select('*, squad:match_squads(id)')
                .eq('categoryid', selectedDivision)
                .order('date', { ascending: true });
               if (matchesData) setMatches(matchesData);
            };
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default SquadsTab;
