import React, { useState, useEffect, useMemo } from 'react';
import { Match, Member, Tournament } from '../../types';
import { db, supabase } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Calendar, Search, Loader2, CheckCircle2, AlertCircle, ChevronRight, ExternalLink, Trophy } from 'lucide-react';
import ConvocatoriaModal from '../Torneos/ConvocatoriaModal';
import { getPlayersByCategory } from '../../lib/playerUtils';

const SquadsTab: React.FC = () => {
  const { selectedDiscipline, selectedDivision, selectedGender, selectedTournamentId } = useCategory();
  
  // States
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [localTournamentId, setLocalTournamentId] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTournamentsLoading, setIsTournamentsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clubName, setClubName] = useState('MI CLUB');
  
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Phase 1: Load tournaments matching Category/Discipline
  useEffect(() => {
    const fetchTournaments = async () => {
      if (!selectedDivision || !selectedDiscipline) return;
      setIsTournamentsLoading(true);
      try {
        const { data: tourneysData } = await supabase.from('tournaments').select('*');
        const list = (tourneysData || []).map(t => ({
          ...t,
          discipline_id: t.discipline_id || t.discipline,
          category_id: t.category_id || t.categoryid,
          assigned_categories: t.assigned_categories || t.assignedcategories || []
        }));

        // Filter tournaments belonging to the active Category/Discipline/Gender
        const filtered = list.filter(t => 
          (t.discipline_id === selectedDiscipline || t.disciplineid === selectedDiscipline) && 
          t.gender === selectedGender &&
          (t.assigned_categories?.includes(selectedDivision) || t.assignedcategories?.includes(selectedDivision))
        );

        setTournaments(filtered);
        
        // Default local tournament selection
        if (selectedTournamentId && filtered.some(t => t.id === selectedTournamentId)) {
          setLocalTournamentId(selectedTournamentId);
        } else if (filtered.length > 0) {
          // Do not auto-select, allow user selection explicitly unless we want to preset
          setLocalTournamentId('');
        } else {
          setLocalTournamentId('');
        }
      } catch (err) {
        console.error("Error loading matching tournaments:", err);
      } finally {
        setIsTournamentsLoading(false);
      }
    };

    fetchTournaments();
  }, [selectedDivision, selectedDiscipline, selectedGender, selectedTournamentId]);

  // Phase 2: Load matches and players ONLY when a tournament is selected
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDivision || !selectedDiscipline || !localTournamentId) {
        setMatches([]);
        return;
      }
      
      setIsLoading(true);
      try {
        // Fetch club config for name
        const { data: clubData } = await supabase.from('club_config').select('name').eq('id', 1).single();
        if (clubData) setClubName(clubData.name);

        // Fetch matches for this category/discipline/gender and SELECTED local tournament
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*, squad:match_squads(id, appointment_time, location)')
          .eq('categoryid', selectedDivision)
          .eq('tournamentid', localTournamentId)
          .order('date', { ascending: true });

        if (matchesError) throw matchesError;
        setMatches(matchesData || []);
        
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

          // FILTER: Only include role: 'PLAYER' or 'JUGADOR' / Eliminate Coaches of category
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

          setPlayers(onlyAthletes);
        }
      } catch (err) {
        console.error("Error fetching squads tab data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDivision, selectedDiscipline, localTournamentId, refreshTrigger]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchName = `${m.hometeam} vs ${m.awayteam}`.toLowerCase();
      const searchMatch = matchName.includes(searchTerm.toLowerCase());
      return searchMatch && !m.is_overridden;
    });
  }, [matches, searchTerm]);

  const processedMatches = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const upcomingCandidates = filteredMatches.filter(m => {
      const hasSquad = m.squad && m.squad.length > 0;
      const isFinished = m.status === 'Finished';
      return m.date >= todayStr && (!hasSquad || !isFinished);
    });

    const sortedUpcomingCandidates = [...upcomingCandidates].sort((a, b) => a.date.localeCompare(b.date));
    const upcomingMatch = sortedUpcomingCandidates.length > 0 ? sortedUpcomingCandidates[0] : null;

    const historyMatches = filteredMatches.filter(m => {
      if (upcomingMatch && m.id === upcomingMatch.id) return false;
      const hasSquad = m.squad && m.squad.length > 0;
      const isPastOrFinished = m.date < todayStr || m.status === 'Finished';
      return hasSquad || isPastOrFinished;
    });

    const sortedHistory = [...historyMatches].sort((a, b) => b.date.localeCompare(a.date));

    return {
      upcomingMatch,
      historyMatches: sortedHistory
    };
  }, [filteredMatches]);

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

  if (isTournamentsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
        <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px]">Cargando torneos de la categoría...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">Gestión de Convocatorias</h2>
          <p className="text-[var(--text-muted)] font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
            Planifica las plantillas para los próximos encuentros
          </p>
        </div>
        
        {/* Tournament selection and search */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="flex flex-col gap-1 w-full sm:w-56">
            <select
              value={localTournamentId}
              onChange={(e) => setLocalTournamentId(e.target.value)}
              className="px-4 py-3 bg-[var(--surface-ground)] border border-[var(--surface-border)] rounded-xl text-xs font-black uppercase text-[var(--text-main)] outline-none focus:ring-2 ring-primary-500/20 cursor-pointer"
            >
              <option value="">Seleccionar Torneo</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input 
              type="text" 
              placeholder="Buscar partido..."
              value={searchTerm}
              disabled={!localTournamentId}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--surface-ground)] border border-[var(--surface-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 ring-primary-500/20 text-[var(--text-main)] disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      {/* Condicional screen before tournament selection */}
      {!localTournamentId ? (
        <div className="py-20 text-center bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)] max-w-2xl mx-auto flex flex-col items-center justify-center p-8 space-y-6 animate-fade-in shadow-inner">
          <Trophy size={60} className="text-amber-500 animate-bounce" />
          <div className="space-y-2">
            <h3 className="text-lg font-black uppercase text-[var(--text-main)] italic tracking-widest">Selección de Torneo Requerida</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest leading-relaxed">
              Para poder visualizar y armar planillas de convocatoria, debes elegir un torneo activo de la lista.
            </p>
          </div>
          
          <div className="w-full max-w-sm">
            {tournaments.length > 0 ? (
              <div className="space-y-3">
                <span className="text-[8px] font-black text-primary-500 tracking-widest uppercase block">Torneos disponibles en la categoría:</span>
                <div className="grid grid-cols-1 gap-2">
                  {tournaments.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setLocalTournamentId(t.id)}
                      className="w-full px-5 py-4 bg-surface-card border border-[var(--surface-border)] hover:border-primary-500 rounded-2xl text-xs font-black uppercase text-[var(--text-main)] tracking-widest text-left shadow-sm transition-all hover:translate-y-[-2px] hover:shadow-md flex justify-between items-center"
                    >
                      <span>{t.name}</span>
                      <ChevronRight size={14} className="text-primary-500" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-500/5 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-wider">
                No hay torneos creados para esta categoría/disciplina actualmente.
              </div>
            )}
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
          <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-[10px]">Cargando partidos...</p>
        </div>
      ) : hasAnyMatches ? (
        <div className="space-y-12 animate-fade-in">
          {/* PRÓXIMO ENCUENTRO SECCIÓN */}
          {processedMatches.upcomingMatch && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-amber-500/20 pb-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase text-amber-500 tracking-[0.2em] italic">
                  Próximo Partido
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {processedMatches.historyMatches.map(m => renderMatchCard(m, false))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="col-span-full py-20 text-center bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
           <Calendar size={48} className="mx-auto text-[var(--text-muted)] mb-4 opacity-20" />
           <h3 className="text-xl font-black uppercase text-[var(--text-muted)] italic tracking-widest">No hay partidos registrados en este torneo</h3>
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
