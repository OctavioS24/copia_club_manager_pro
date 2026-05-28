
import React, { useState, useEffect, useMemo } from 'react';
import { Match, Member } from '../../types';
import { db, supabase } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Calendar, Search, Loader2, CheckCircle2, AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import ConvocatoriaModal from '../Torneos/ConvocatoriaModal';
import { getPlayersByCategory } from '../../lib/playerUtils';

const SquadsTab: React.FC = () => {
  const { selectedDiscipline, selectedDivision, selectedGender, selectedTournamentId } = useCategory();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clubName, setClubName] = useState('MI CLUB');
  
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDivision || !selectedDiscipline) return;
      
      setIsLoading(true);
      try {
        // Fetch club config for name
        const { data: clubData } = await supabase.from('club_config').select('name').eq('id', 1).single();
        if (clubData) setClubName(clubData.name);

        // Fetch tournaments to find the correct active tournament filter
        const { data: tourneysData } = await supabase.from('tournaments').select('*');
        const tournaments = (tourneysData || []).map(t => ({
          ...t,
          discipline_id: t.discipline_id || t.discipline,
          category_id: t.category_id || t.categoryid,
          assigned_categories: t.assigned_categories || t.assignedcategories || []
        }));

        const targetTournament = selectedTournamentId 
          ? tournaments.find(t => t.id === selectedTournamentId)
          : tournaments.find(t => 
              (t.discipline_id === selectedDiscipline || t.disciplineid === selectedDiscipline) && 
              t.gender === selectedGender &&
              (t.assigned_categories?.includes(selectedDivision) || t.assignedcategories?.includes(selectedDivision))
            );

        // Fetch matches for this category/discipline/gender and tournament
        // We filter by category_id or category
        let query = supabase
          .from('matches')
          .select('*, squad:match_squads(id, appointment_time, location)')
          .eq('categoryid', selectedDivision);

        if (targetTournament) {
          query = query.eq('tournamentid', targetTournament.id);
        }

        const { data: matchesData, error: matchesError } = await query.order('date', { ascending: true });

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
  }, [selectedDivision, selectedDiscipline, selectedGender, selectedTournamentId, refreshTrigger]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchName = `${m.hometeam} vs ${m.awayteam}`.toLowerCase();
      const searchMatch = matchName.includes(searchTerm.toLowerCase());
      // Show scheduled or suspended matches, finished might be less relevant here but we can show them
      return searchMatch && !m.is_overridden;
    });
  }, [matches, searchTerm]);

  const processedMatches = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find all matches that fit the "próximo partido" description:
    // - Date is today or later
    // - Has no squad, OR has squad but is not finished (match is not Finished status)
    const upcomingCandidates = filteredMatches.filter(m => {
      const hasSquad = m.squad && m.squad.length > 0;
      const isFinished = m.status === 'Finished';
      return m.date >= todayStr && (!hasSquad || !isFinished);
    });

    // The single "upcoming" match is the earliest chronologically among candidates
    const sortedUpcomingCandidates = [...upcomingCandidates].sort((a, b) => a.date.localeCompare(b.date));
    const upcomingMatch = sortedUpcomingCandidates.length > 0 ? sortedUpcomingCandidates[0] : null;

    // The rest of the matches go to the history list
    const historyMatches = filteredMatches.filter(m => {
      if (upcomingMatch && m.id === upcomingMatch.id) return false;
      const hasSquad = m.squad && m.squad.length > 0;
      const isPastOrFinished = m.date < todayStr || m.status === 'Finished';
      return hasSquad || isPastOrFinished;
    });

    // History is ordered in descending date order (most recent first)
    const sortedHistory = [...historyMatches].sort((a, b) => b.date.localeCompare(a.date));

    return {
      upcomingMatch,
      historyMatches: sortedHistory
    };
  }, [filteredMatches]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
        <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px]">Cargando partidos...</p>
      </div>
    );
  }

  const renderMatchCard = (m: Match, isUpcoming: boolean) => {
    const hasSquad = (m as any).squad && (m as any).squad.length > 0;
    const isFinished = m.status === 'Finished';
    
    return (
      <div 
        key={m.id}
        onClick={() => { setSelectedMatch(m); setShowSquadModal(true); }}
        className={`group relative bg-surface-card p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer overflow-hidden shadow-sm ${
          isUpcoming 
            ? 'border-amber-500/80 bg-amber-500/[0.02] hover:bg-amber-500/[0.04] shadow-xl shadow-amber-500/5 scale-[1.01]'
            : hasSquad 
              ? 'border-green-500/20 hover:border-green-500/50' 
              : 'border-[var(--surface-border)] hover:border-primary-500/50'
        } ${isFinished ? 'opacity-70' : ''}`}
      >
        {isUpcoming && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[8px] uppercase tracking-[0.2em] rounded-full shadow-lg shadow-orange-500/20 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
            PRÓXIMO
          </div>
        )}

        {hasSquad && (
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="text-green-500" size={20} />
          </div>
        )}
        
        <div className={`flex items-center gap-3 mb-6 flex-wrap ${isUpcoming ? 'mt-4' : ''}`}>
          <div className="px-3 py-1 bg-surface-ground border border-[var(--surface-border)] rounded-lg text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            {new Date(m.date).toLocaleDateString()}
          </div>
          {hasSquad && (m as any).squad?.[0]?.appointment_time && (
            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
              CITACIÓN: {(m as any).squad[0].appointment_time.slice(0, 5)} HS
            </div>
          )}
          {hasSquad && (m as any).squad?.[0]?.location && (() => {
            const loc = (m as any).squad[0].location;
            const mapsUrl = loc.startsWith('http://') || loc.startsWith('https://') 
              ? loc 
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
            return (
              <a 
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 max-w-[150px] truncate transition-colors cursor-pointer" 
                title={`Sede: ${loc} - Click para abrir mapa`}
                onClick={(e) => e.stopPropagation()}
              >
                Sede: {loc}
                <ExternalLink size={10} className="shrink-0" />
              </a>
            );
          })()}
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
  };

  const hasAnyMatches = processedMatches.upcomingMatch || processedMatches.historyMatches.length > 0;

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

      {hasAnyMatches ? (
        <div className="space-y-12">
          {/* PRÓXIMO ENCUENTRO SECCIÓN */}
          {processedMatches.upcomingMatch && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-amber-500/20 pb-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase text-amber-500 tracking-[0.2em] italic">
                  Próximo Partido
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {renderMatchCard(processedMatches.upcomingMatch, true)}
              </div>
            </div>
          )}

          {/* HISTORIAL SECCIÓN */}
          {processedMatches.historyMatches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-[var(--surface-border)] pb-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--text-muted)] opacity-30" />
                <h3 className="text-xs font-black uppercase text-[var(--text-muted)] tracking-[0.2em] italic">
                  Historial de Convocatorias ({processedMatches.historyMatches.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {processedMatches.historyMatches.map(m => renderMatchCard(m, false))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="col-span-full py-20 text-center bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
           <Calendar size={48} className="mx-auto text-[var(--text-muted)] mb-4 opacity-20" />
           <h3 className="text-xl font-black uppercase text-[var(--text-muted)] italic tracking-widest">No hay partidos para esta categoría</h3>
        </div>
      )}


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
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
};

export default SquadsTab;
