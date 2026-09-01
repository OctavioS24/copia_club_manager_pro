
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Trophy, TrendingUp, Activity, Loader2, AlertCircle, 
  TrendingDown, ShieldAlert, ShieldX, Target,
  Award, Calendar, ChevronRight, History, Timer, AlertTriangle, RefreshCw, HeartPulse, Heart, X,
  ArrowUpRight, ChevronDown
} from 'lucide-react';
import { ClubConfig, Match, Member, MatchEvent, Tournament } from '../types';
import { db, supabase } from '../lib/supabase';
import { useCategory } from '../context/useCategory';
import { getDisciplineConfig, DisciplineConfig } from '../lib/disciplineConfig';
import MatchDetailModal from './MatchDetailModal';
import StatsDetailModal, { StatsDetailType } from './StatsDetailModal';

const MatchSkeleton = () => (
  <div className="animate-pulse flex items-center justify-between p-4 md:p-6 bg-surface-ground rounded-2xl md:rounded-3xl border border-[var(--surface-border)]">
    <div className="flex items-center gap-3 md:gap-4">
      <div className="w-10 h-10 md:w-12 md:h-12 bg-surface-hover rounded-xl md:rounded-2xl"></div>
      <div className="space-y-2">
        <div className="w-24 md:w-32 h-3 md:h-4 bg-surface-hover rounded"></div>
        <div className="w-16 md:w-20 h-2 md:h-3 bg-surface-hover rounded"></div>
      </div>
    </div>
    <div className="w-12 md:w-16 h-6 md:h-8 bg-surface-hover rounded-lg md:rounded-xl"></div>
  </div>
);

const PlantelDashboard: React.FC<PlantelDashboardProps> = ({ clubConfig: propClubConfig, members: propMembers }) => {
  const { 
    selectedDiscipline, 
    selectedDivision, 
    selectedGender, 
    selectedTournamentId, 
    setSelectedTournamentId 
  } = useCategory();
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(propClubConfig || null);
  const [members, setMembers] = useState<Member[]>(propMembers || []);
  const [disciplineConfig, setDisciplineConfig] = useState<DisciplineConfig | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  // Fetch initial data if needed
  useEffect(() => {
    const fetchInitialData = async () => {
      if (propClubConfig && propMembers) return;
      
      try {
        const [configRes, membersRes] = await Promise.all([
          db.config.get(),
          db.members.getAll()
        ]);
        if (configRes.data) setClubConfig(configRes.data);
        if (membersRes.data) setMembers(membersRes.data);
      } catch (err) {
        console.error("Error fetching initial data for PlantelDashboard:", err);
      }
    };
    fetchInitialData();
  }, [propClubConfig, propMembers]);

  // Fetch tournaments for category & discipline
  useEffect(() => {
    const fetchCategoryTournaments = async () => {
      if (!selectedDivision || !selectedDiscipline) return;
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
          const normalized: Tournament[] = data.map((t: any) => ({
            ...t,
            discipline_id: t.discipline_id || t.discipline || t.disciplineid,
            category_id: t.category_id || t.categoryid,
            assigned_categories: t.assigned_categories || t.assignedcategories || []
          }));

          const filtered = normalized.filter((t: any) => {
            const matchDisc = !selectedDiscipline || t.discipline_id === selectedDiscipline;
            const matchGender = !t.gender || !selectedGender || t.gender.toLowerCase() === selectedGender.toLowerCase();
            const hasCat = t.assigned_categories?.includes(selectedDivision) || t.category_id === selectedDivision;
            return matchDisc && matchGender && hasCat;
          });

          setTournaments(filtered);
        }
      } catch (err) {
        console.error('Error fetching tournaments in PlantelDashboard:', err);
      }
    };

    fetchCategoryTournaments();
  }, [selectedDivision, selectedDiscipline, selectedGender]);
  
  const selectedCategory = useMemo(() => {
    if (!selectedDiscipline || !selectedDivision || !clubConfig) return null;
    const disc = clubConfig.disciplines.find(d => d.id === selectedDiscipline);
    if (!disc) return null;
    
    for (const branch of disc.branches) {
      const cat = branch.categories.find(c => c.id === selectedDivision);
      if (cat) return { disciplineId: disc.id, category: cat };
    }
    return null;
  }, [clubConfig, selectedDiscipline, selectedDivision]);

  const [matches, setMatches] = useState<Match[]>([]);
  const [playerEvents, setPlayerEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showStatsType, setShowStatsType] = useState<StatsDetailType | null>(null);
  
  // Medical fitness warnings states
  const [showMedicalWarningModal, setShowMedicalWarningModal] = useState(false);
  const [medicalFilter, setMedicalFilter] = useState<'squad' | 'all'>('squad');

  // Jugadores del plantel seleccionado
  const squadPlayers = useMemo(() => {
    if (!selectedCategory || !clubConfig) return [];
    const disc = clubConfig.disciplines.find(d => d.id === selectedCategory.disciplineId);
    const discName = disc?.name || '';
    
    const filtered = members.filter(m => 
      m.assignments?.some(a => {
        const aDisc = (a.discipline || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dName = (discName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const aCat = (a.category || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cName = (selectedCategory.category.name || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const discMatch = a.discipline_id === selectedCategory.disciplineId || aDisc === dName;
        const catMatch = a.category_id === selectedCategory.category.id || a.category === selectedCategory.category.id || aCat === cName;
        
        const role = (a.role || '').toUpperCase();
        const isPlayer = role === 'PLAYER' || role === 'JUGADOR';
        
        return discMatch && catMatch && isPlayer;
      })
    );

    return filtered;
  }, [members, selectedCategory, clubConfig]);

  const disciplinePlayers = useMemo(() => {
    if (!selectedDiscipline || !clubConfig) return [];
    const disc = clubConfig.disciplines.find(d => d.id === selectedDiscipline);
    const discName = disc?.name || '';

    return members.filter(m => 
      m.assignments?.some(a => {
        const aDisc = (a.discipline || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dName = (discName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const discMatch = a.discipline_id === selectedDiscipline || aDisc === dName;
        const role = (a.role || '').toUpperCase();
        const isPlayer = role === 'PLAYER' || role === 'JUGADOR';
        
        return discMatch && isPlayer;
      })
    );
  }, [members, selectedDiscipline, clubConfig]);

  const checkExpiring = (v: string | undefined): boolean => {
    if (!v) return false;
    const expiryDate = new Date(v);
    if (isNaN(expiryDate.getTime())) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    expiryDate.setHours(0,0,0,0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  };

  const expiringOverall = useMemo(() => {
    return disciplinePlayers.filter(p => checkExpiring(p.medical?.expiry_date));
  }, [disciplinePlayers]);

  const expiringInSquad = useMemo(() => {
    return squadPlayers.filter(p => checkExpiring(p.medical?.expiry_date));
  }, [squadPlayers]);

  const displayedMedicalPlayers = useMemo(() => {
    return medicalFilter === 'squad' ? expiringInSquad : expiringOverall;
  }, [medicalFilter, expiringInSquad, expiringOverall]);

  const getPlayerCategoryName = (player: Member) => {
    const assignment = player.assignments?.find(a => {
      if (!selectedDiscipline || !clubConfig) return false;
      const disc = clubConfig.disciplines.find(d => d.id === selectedDiscipline);
      const discName = disc?.name || '';
      const aDisc = (a.discipline || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const dName = (discName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return a.discipline_id === selectedDiscipline || aDisc === dName;
    });
    return assignment?.category || 'Sin Categoría';
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCategory || !selectedDivision || !clubConfig) return;
      
      setIsLoading(true);
      setIsLoadingLists(true);
      setError(null);
      try {
        const disc = clubConfig.disciplines.find(d => d.id === selectedDiscipline);
        const discName = disc?.name || 'FUTBOL';
        const [configData] = await Promise.all([
          getDisciplineConfig(discName)
        ]);

        setDisciplineConfig(configData);

        // Fetch matches for this specific category
        const { data: allMatches, error: matchesError } = await supabase
          .from('matches')
          .select('*, events:match_events(*)')
          .eq('categoryid', selectedDivision)
          .order('date', { ascending: false });

        if (matchesError) throw matchesError;

        setMatches(allMatches || []);
        setPlayerEvents([]);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("No se pudieron cargar las estadísticas del plantel.");
      } finally {
        setIsLoading(false);
        setIsLoadingLists(false);
      }
    };

    fetchStats();
  }, [selectedCategory, selectedDivision, clubConfig, selectedDiscipline]);

  // Current selected tournament object
  const currentSelectedTournament = useMemo(() => {
    if (!selectedTournamentId || selectedTournamentId === 'all') return null;
    return tournaments.find(t => t.id === selectedTournamentId) || null;
  }, [tournaments, selectedTournamentId]);

  // Filter matches by selected tournament if one is chosen
  const filteredMatches = useMemo(() => {
    if (!selectedTournamentId || selectedTournamentId === 'all') {
      return matches;
    }
    return matches.filter(m => {
      const matchTournamentId = m.tournamentid || (m as any).tournament_id || (m as any).tournament;
      return matchTournamentId === selectedTournamentId;
    });
  }, [matches, selectedTournamentId]);

  const finishedMatches = useMemo(() => {
    return filteredMatches.filter(m => m.status === 'Finished');
  }, [filteredMatches]);

  const lastResults = useMemo(() => {
    return finishedMatches.slice(0, 5);
  }, [finishedMatches]);

  const upcomingMatches = useMemo(() => {
    return filteredMatches
      .filter(m => m.status === 'Scheduled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [filteredMatches]);

  const suspendedMatches = useMemo(() => {
    return filteredMatches.filter(m => m.status === 'Suspended');
  }, [filteredMatches]);

  const points = useMemo(() => {
    if (!selectedCategory || !clubConfig) return 0;
    const teamName = clubConfig.name || 'Mi Equipo';
    const rules = disciplineConfig?.scoring_rules || { win: 3, draw: 1, loss: 0 };

    return filteredMatches.reduce((acc, match) => {
      if (match.status !== 'Finished') return acc;
      const isHome = (match.hometeam || match.home_team) === teamName;
      const myScore = isHome ? (match.homescore ?? match.home_score ?? 0) : (match.awayscore ?? match.away_score ?? 0);
      const rivalScore = isHome ? (match.awayscore ?? match.away_score ?? 0) : (match.homescore ?? match.home_score ?? 0);

      if (myScore > rivalScore) return acc + rules.win;
      if (myScore === rivalScore) return acc + rules.draw;
      return acc + rules.loss;
    }, 0);
  }, [filteredMatches, selectedCategory, clubConfig, disciplineConfig]);

  const visualStreak = useMemo(() => {
    if (finishedMatches.length === 0 || !clubConfig) return [];
    const teamName = clubConfig.name || 'Mi Equipo';
    return finishedMatches.slice(0, 5).map(m => {
      const isHome = (m.hometeam || m.home_team) === teamName;
      const myScore = isHome ? (m.homescore ?? m.home_score ?? 0) : (m.awayscore ?? m.away_score ?? 0);
      const rivalScore = isHome ? (m.awayscore ?? m.away_score ?? 0) : (m.homescore ?? m.home_score ?? 0);
      
      if (myScore > rivalScore) return { result: 'G', color: 'bg-emerald-500' };
      if (myScore === rivalScore) return { result: 'E', color: 'bg-amber-500' };
      return { result: 'P', color: 'bg-red-500' };
    });
  }, [finishedMatches, clubConfig]);

  const trend = useMemo(() => {
    if (finishedMatches.length < 3 || !clubConfig) return 'neutral';
    const teamName = clubConfig.name || 'Mi Equipo';
    
    const getPoints = (m: Match) => {
      const isHome = (m.hometeam || m.home_team) === teamName;
      const myScore = isHome ? (m.homescore ?? m.home_score ?? 0) : (m.awayscore ?? m.away_score ?? 0);
      const rivalScore = isHome ? (m.awayscore ?? m.away_score ?? 0) : (m.homescore ?? m.home_score ?? 0);
      const rules = disciplineConfig?.scoring_rules || { win: 3, draw: 1, loss: 0 };
      
      if (myScore > rivalScore) return rules.win;
      if (myScore === rivalScore) return rules.draw;
      return rules.loss;
    };

    const last3 = finishedMatches.slice(0, 3).reduce((acc, m) => acc + getPoints(m), 0);
    const prev3 = finishedMatches.slice(3, 6).reduce((acc, m) => acc + getPoints(m), 0);

    if (last3 > prev3) return 'up';
    if (last3 < prev3) return 'down';
    return 'neutral';
  }, [finishedMatches, clubConfig, disciplineConfig]);

  const goalsConceded = useMemo(() => {
    if (!selectedCategory || !clubConfig) return 0;
    const teamName = clubConfig.name || 'Mi Equipo';

    return filteredMatches.reduce((acc, match) => {
      if (match.status !== 'Finished') return acc;
      const isHome = (match.hometeam || match.home_team) === teamName;
      const conceded = isHome ? (match.awayscore ?? match.away_score ?? 0) : (match.homescore ?? match.home_score ?? 0);
      return acc + conceded;
    }, 0);
  }, [filteredMatches, selectedCategory, clubConfig]);

  const squadStats = useMemo(() => {
    const stats: Record<string, number> = {};
    
    // Inicializar stats según config
    if (disciplineConfig) {
      disciplineConfig.dashboard_stats.forEach(s => stats[s] = 0);
      disciplineConfig.event_types.forEach(et => {
        if (et.statsKey) stats[et.statsKey] = 0;
      });
    }

    // Solo contar eventos de partidos DISPUTADOS del torneo seleccionado (status === 'Finished')
    const finishedMatchIds = new Set(filteredMatches.filter(m => m.status === 'Finished').map(m => m.id));

    // Combinar eventos de playerEvents (por jugador) y de matches (por categoría/torneo)
    const allEvents = [...playerEvents].filter(e => finishedMatchIds.has(e.match_id));
    filteredMatches.forEach(m => {
      if (m.status === 'Finished' && m.events) {
        m.events.forEach(e => {
          if (!allEvents.find(ae => ae.id === e.id)) {
            allEvents.push(e);
          }
        });
      }
    });

    return allEvents.reduce((acc, event) => {
      if (disciplineConfig) {
        const eventType = disciplineConfig.event_types.find(et => 
          et.name.toUpperCase() === event.type.toUpperCase() ||
          (et.name === 'TARJETA AMARILLA' && (event.type === 'T. AMARILLA' || event.type === 'TARJETA AMARILLA')) ||
          (et.name === 'TARJETA ROJA' && (event.type === 'T. ROJA' || event.type === 'TARJETA ROJA')) ||
          (et.name === 'GOL' && (event.type === 'GOAL' || event.type === 'GOL'))
        );
        if (eventType && eventType.statsKey) {
          acc[eventType.statsKey] = (acc[eventType.statsKey] || 0) + 1;
        }
      } else {
        // Fallback a fútbol si no hay config
        const type = event.type.toUpperCase();
        if (type === 'GOAL' || type === 'GOL') acc.GOLES_TOTALES = (acc.GOLES_TOTALES || 0) + 1;
        if (type === 'YELLOWCARD' || type === 'T. AMARILLA' || type === 'TARJETA AMARILLA') acc.TARJETAS_AMARILLAS = (acc.TARJETAS_AMARILLAS || 0) + 1;
        if (type === 'REDCARD' || type === 'T. ROJA' || type === 'TARJETA ROJA') acc.TARJETAS_ROJAS = (acc.TARJETAS_ROJAS || 0) + 1;
      }
      return acc;
    }, stats);
  }, [playerEvents, filteredMatches, disciplineConfig]);

  const goalsFor = useMemo(() => {
    if (!selectedCategory || !clubConfig) return squadStats.GOLES_TOTALES || 0;
    const teamName = clubConfig.name || 'Mi Equipo';

    const matchGoals = filteredMatches.reduce((acc, match) => {
      if (match.status !== 'Finished') return acc;
      const isHome = (match.hometeam || match.home_team) === teamName;
      const scored = isHome ? (match.homescore ?? match.home_score ?? 0) : (match.awayscore ?? match.away_score ?? 0);
      return acc + scored;
    }, 0);

    return Math.max(matchGoals, squadStats.GOLES_TOTALES || 0);
  }, [filteredMatches, selectedCategory, clubConfig, squadStats]);

  const goalDifference = useMemo(() => {
    return goalsFor - goalsConceded;
  }, [goalsFor, goalsConceded]);

  return (
    <div className="space-y-8 animate-fade-in">
      {!selectedCategory ? (
        <div className="py-32 text-center bg-surface-ground rounded-[3rem] border-4 border-dashed border-[var(--surface-border)]">
          <Users size={64} className="mx-auto text-[var(--text-muted)] mb-6 opacity-20" />
          <h3 className="text-xl font-black uppercase text-[var(--text-muted)] italic tracking-widest">Esperando selección de plantel</h3>
        </div>
      ) : isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center bg-surface-card rounded-[3rem]">
          <Loader2 className="animate-spin text-primary-500 mb-4" size={48} />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">Procesando estadísticas...</p>
        </div>
      ) : error ? (
        <div className="py-32 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/10 rounded-[3rem] border border-red-100 dark:border-red-900/20">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <p className="text-sm font-black uppercase tracking-widest text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">
          {/* Header de Filtro por Torneo */}
          <div className="bg-surface-card border border-[var(--surface-border)] rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0">
                <Trophy size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                    Competición Seleccionada
                  </span>
                  {currentSelectedTournament ? (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Torneo Activo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      Todos los Torneos
                    </span>
                  )}
                </div>
                <h3 className="text-base md:text-lg font-black uppercase italic tracking-tight text-[var(--text-main)]">
                  {currentSelectedTournament ? currentSelectedTournament.name : 'Estadísticas Globales de la División'}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <select
                  value={selectedTournamentId || ''}
                  onChange={(e) => setSelectedTournamentId(e.target.value || null)}
                  className="w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-main)] appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer pr-10"
                >
                  <option value="">🏆 Todos los Torneos ({matches.length} partidos)</option>
                  {tournaments.map(t => {
                    const tMatches = matches.filter(m => (m.tournamentid || (m as any).tournament_id || (m as any).tournament) === t.id);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name.toUpperCase()} ({tMatches.length} part.)
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
              </div>

              {selectedTournamentId && (
                <button
                  onClick={() => setSelectedTournamentId(null)}
                  title="Restablecer a todos los torneos"
                  className="px-3 py-2.5 bg-surface-ground hover:bg-surface-hover border border-[var(--surface-border)] rounded-xl text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors whitespace-nowrap"
                >
                  Todos
                </button>
              )}
            </div>
          </div>

          {/* Aviso si el torneo no tiene partidos */}
          {selectedTournamentId && filteredMatches.length === 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  No hay partidos registrados en el torneo <span className="font-extrabold">{currentSelectedTournament?.name}</span> para esta categoría aún.
                </p>
              </div>
              <button
                onClick={() => setSelectedTournamentId(null)}
                className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 underline hover:no-underline whitespace-nowrap"
              >
                Ver todos los partidos
              </button>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('PUNTOS_ACUMULADOS')) && (
              <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group hover:shadow-lg transition-all relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-primary-500/10 text-primary-500 group-hover:scale-110 transition-transform">
                    <Trophy size={20} />
                  </div>
                  <ArrowUpRight size={14} className="text-slate-300 dark:text-[#AAAAAA]" />
                </div>
                <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest leading-none">Puntos Acumulados</p>
                <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">
                  {points} <span className="text-xs font-semibold text-[#888888] dark:text-[#BBBBBB] ml-1">PTS</span>
                </h4>
                <p className="text-[10px] text-[#888888] dark:text-[#BBBBBB] mt-1 font-medium">
                  {currentSelectedTournament ? currentSelectedTournament.name : 'Consolidado en fixture'}
                </p>
              </div>
            )}

            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('RACHA_ACTUAL')) && (
              <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group hover:shadow-lg transition-all relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                    <Activity size={20} />
                  </div>
                  <ArrowUpRight size={14} className="text-slate-300 dark:text-[#AAAAAA]" />
                </div>
                <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest leading-none">Racha Actual</p>
                <div className="flex items-center gap-2 md:gap-3 mt-1.5 h-8">
                  <div className="flex gap-1">
                    {visualStreak.length > 0 ? visualStreak.map((s, i) => (
                      <div key={i} className={`w-6 h-6 rounded-md ${s.color} flex items-center justify-center text-white text-[8px] md:text-[10px] font-black shadow`}>
                        {s.result}
                      </div>
                    )) : (
                      <span className="text-[10px] font-bold text-[#888888] dark:text-[#BBBBBB] opacity-30 uppercase">Sin Datos</span>
                    )}
                  </div>
                  {trend !== 'neutral' && (
                    <div className={`p-1 rounded-full ${trend === 'up' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                      {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[#888888] dark:text-[#BBBBBB] mt-1 font-medium">Últimos encuentros disputados</p>
              </div>
            )}

            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('PARTIDOS_JUGADOS')) && (
              <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group hover:shadow-lg transition-all relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-blue-600/10 text-blue-600 group-hover:scale-110 transition-transform">
                    <Target size={20} />
                  </div>
                  <ArrowUpRight size={14} className="text-slate-300 dark:text-[#AAAAAA]" />
                </div>
                <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest leading-none">Partidos Jugados</p>
                <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{finishedMatches.length}</h4>
                <p className="text-[10px] text-[#888888] dark:text-[#BBBBBB] mt-1 font-medium">
                  {currentSelectedTournament ? `En ${currentSelectedTournament.name}` : 'Historial completado'}
                </p>
              </div>
            )}

            {/* APTOS MÉDICOS POR VENCER (30 DÍAS) */}
            <div 
              onClick={() => { setMedicalFilter('squad'); setShowMedicalWarningModal(true); }}
              className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                  <HeartPulse size={20} className="animate-pulse" />
                </div>
                <ArrowUpRight size={14} className="text-slate-300 dark:text-[#AAAAAA]" />
              </div>
              <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest leading-none">Aptos a Vencer <span className="text-orange-500 font-extrabold">(30d)</span></p>
              <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">
                {expiringInSquad.length}
                <span className="text-xs font-semibold text-[#888888] dark:text-[#BBBBBB] ml-1.5">
                  / {expiringOverall.length} total
                </span>
              </h4>
              <p className="text-[10px] text-[#888888] dark:text-[#BBBBBB] mt-1 font-medium">Revisión médica requerida</p>
            </div>
          </div>

          {/* Estadísticas Secundarias del Plantel (Goles a Favor, Goles en Contra, Diferencia de Goles, Tarjetas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
            {/* 1. GOLES A FAVOR (Con detalle del jugador) */}
            <div 
              onClick={() => setShowStatsType('Goles a Favor')}
              className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-emerald-500/30"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  <Award size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Goles a Favor</p>
                  <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{goalsFor}</h4>
                  <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-tight flex items-center gap-1 mt-0.5">
                    Detalle por jugador
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowStatsType('Goles a Favor'); }}
                title="Ver goleadores por jugador"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-emerald-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 2. GOLES EN CONTRA */}
            <div 
              onClick={() => setShowStatsType('Goles en Contra')}
              className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-rose-500/30"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  <ShieldX size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Goles en Contra</p>
                  <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{goalsConceded}</h4>
                  <span className="text-[8px] font-bold text-rose-500 uppercase tracking-tight flex items-center gap-1 mt-0.5">
                    Ver partidos
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowStatsType('Goles en Contra'); }}
                title="Ver goles recibidos"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 3. DIFERENCIA DE GOLES */}
            <div 
              onClick={() => setShowStatsType('Diferencia de Goles')}
              className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-blue-500/30"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform ${
                  goalDifference > 0 
                    ? 'bg-emerald-500/10 text-emerald-500' 
                    : goalDifference < 0 
                    ? 'bg-rose-500/10 text-rose-500' 
                    : 'bg-slate-500/10 text-slate-400'
                }`}>
                  <Activity size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Diferencia de Goles</p>
                  <h4 className={`text-2xl font-black mt-1.5 ${
                    goalDifference > 0 
                      ? 'text-emerald-500' 
                      : goalDifference < 0 
                      ? 'text-rose-500' 
                      : 'text-[#333333] dark:text-[#E0E0E0]'
                  }`}>
                    {goalDifference > 0 ? `+${goalDifference}` : goalDifference}
                  </h4>
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tight flex items-center gap-1 mt-0.5">
                    GF: {goalsFor} | GC: {goalsConceded}
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowStatsType('Diferencia de Goles'); }}
                title="Ver balance de goles"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 4. TARJETAS AMARILLAS */}
            <div 
              onClick={() => setShowStatsType('Amarillas')}
              className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-amber-500/30"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  <ShieldAlert size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Tarjetas Amarillas</p>
                  <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{squadStats.TARJETAS_AMARILLAS || 0}</h4>
                  <span className="text-[8px] font-bold text-amber-500 uppercase tracking-tight flex items-center gap-1 mt-0.5">
                    Ver amonestados
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowStatsType('Amarillas'); }}
                title="Ver amonestados"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 5. TARJETAS ROJAS */}
            <div 
              onClick={() => setShowStatsType('Rojas')}
              className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-red-500/30"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  <ShieldAlert size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Tarjetas Rojas</p>
                  <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{squadStats.TARJETAS_ROJAS || 0}</h4>
                  <span className="text-[8px] font-bold text-red-500 uppercase tracking-tight flex items-center gap-1 mt-0.5">
                    Ver expulsados
                  </span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowStatsType('Rojas'); }}
                title="Ver expulsados"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Match History & Upcoming Matches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ÚLTIMOS 5 RESULTADOS */}
            <div className="bg-surface-card p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] shadow-sm border border-[var(--surface-border)]">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h3 className="text-xs md:text-sm font-black text-[var(--text-main)] uppercase tracking-widest flex items-center gap-2 md:gap-3">
                    <History size={16} md:size={18} className="text-primary-500" />
                    Últimos 5 Resultados
                  </h3>
                  <p className="text-[7px] md:text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">
                    {currentSelectedTournament ? `Partidos en ${currentSelectedTournament.name}` : 'Historial de encuentros disputados'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                {isLoadingLists ? (
                  Array(5).fill(0).map((_, i) => <MatchSkeleton key={i} />)
                ) : lastResults.length > 0 ? (
                  lastResults.map((m) => {
                    const teamName = clubConfig.name || 'Mi Equipo';
                    const isHome = m.hometeam === teamName;
                    const rival = isHome ? m.awayteam : m.hometeam;
                    const myScore = isHome ? m.homescore : m.awayscore;
                    const rivalScore = isHome ? m.awayscore : m.homescore;
                    const isWin = (myScore || 0) > (rivalScore || 0);
                    const isDraw = (myScore || 0) === (rivalScore || 0);

                    return (
                      <div 
                        key={m.id} 
                        onClick={() => setSelectedMatch(m)}
                        className="group flex items-center justify-between p-4 md:p-6 bg-surface-ground rounded-2xl md:rounded-3xl border border-[var(--surface-border)] hover:border-primary-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-[10px] md:text-xs text-white shrink-0 ${isWin ? 'bg-emerald-500' : isDraw ? 'bg-amber-500' : 'bg-red-500'}`}>
                            {isWin ? 'G' : isDraw ? 'E' : 'P'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs md:text-sm font-black text-[var(--text-main)] uppercase truncate">vs {rival}</h4>
                            <p className="text-[8px] md:text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5 md:gap-2 mt-0.5">
                              <Calendar size={10} md:size={12} />
                              {new Date(m.date).toLocaleDateString()}
                              <span className="opacity-30">•</span>
                              {isHome ? 'Local' : 'Visitante'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="text-right">
                            <span className="text-sm md:text-lg font-black text-[var(--text-main)] tracking-tight">
                              {myScore} - {rivalScore}
                            </span>
                          </div>
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-surface-card flex items-center justify-center text-[var(--text-muted)] group-hover:text-primary-500 transition-colors">
                            <ChevronRight size={14} md:size={16} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-[var(--surface-border)] rounded-2xl md:rounded-3xl">
                    <p className="text-[10px] md:text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                      {currentSelectedTournament ? 'No hay partidos disputados en este torneo' : 'No hay partidos finalizados'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* PRÓXIMOS ENCUENTROS */}
            <div className="bg-surface-card p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] shadow-sm border border-[var(--surface-border)]">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h3 className="text-xs md:text-sm font-black text-[var(--text-main)] uppercase tracking-widest flex items-center gap-2 md:gap-3">
                    <Timer size={16} md:size={18} className="text-primary-500" />
                    Próximos Partidos
                  </h3>
                  <p className="text-[7px] md:text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">
                    {currentSelectedTournament ? `Fixture de ${currentSelectedTournament.name}` : 'Calendario de partidos programados'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                {isLoadingLists ? (
                  Array(5).fill(0).map((_, i) => <MatchSkeleton key={i} />)
                ) : upcomingMatches.length > 0 ? (
                  upcomingMatches.map((m) => {
                    const teamName = clubConfig.name || 'Mi Equipo';
                    const isHome = m.hometeam === teamName;
                    const rival = isHome ? m.awayteam : m.hometeam;

                    return (
                      <div 
                        key={m.id}
                        onClick={() => setSelectedMatch(m)}
                        className="group flex items-center justify-between p-4 md:p-6 bg-surface-ground rounded-2xl md:rounded-3xl border border-[var(--surface-border)] hover:border-primary-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-[10px] md:text-xs shrink-0">
                            <Calendar size={16} md:size={20} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs md:text-sm font-black text-[var(--text-main)] uppercase truncate">vs {rival}</h4>
                            <p className="text-[8px] md:text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5 md:gap-2 mt-0.5">
                              <span>{new Date(m.date).toLocaleDateString()}</span>
                              <span className="opacity-30">•</span>
                              <span>{m.time || 'Horario a confirmar'}</span>
                              <span className="opacity-30">•</span>
                              <span className="text-primary-500 font-extrabold">{isHome ? 'Local' : 'Visitante'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 md:px-3 md:py-1.5 bg-surface-card rounded-lg md:rounded-xl text-[var(--text-muted)] border border-[var(--surface-border)]">
                            Programado
                          </span>
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-surface-card flex items-center justify-center text-[var(--text-muted)] group-hover:text-primary-500 transition-colors">
                            <ChevronRight size={14} md:size={16} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-[var(--surface-border)] rounded-2xl md:rounded-3xl">
                    <p className="text-[10px] md:text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                      {currentSelectedTournament ? 'No hay partidos próximos para este torneo' : 'No hay partidos programados'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PARTIDOS SUSPENDIDOS / REPROGRAMADOS */}
          {suspendedMatches.length > 0 && (
            <div className="bg-surface-card p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] shadow-sm border border-[var(--surface-border)] border-amber-500/30">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h3 className="text-xs md:text-sm font-black text-[var(--text-main)] uppercase tracking-widest flex items-center gap-2 md:gap-3">
                    <AlertTriangle size={16} md:size={18} className="text-amber-500" />
                    Partidos Suspendidos / Postergados
                  </h3>
                  <p className="text-[7px] md:text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">
                    Atención técnica requerida para reprogramación
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suspendedMatches.map((m) => {
                  const teamName = clubConfig.name || 'Mi Equipo';
                  const isHome = m.hometeam === teamName;
                  const rival = isHome ? m.awayteam : m.hometeam;
                  const newMatch = matches.find(nm => nm.original_match_id === m.id);

                  return (
                    <div 
                      key={m.id}
                      onClick={() => setSelectedMatch(m)}
                      className="p-5 bg-amber-500/5 rounded-2xl border border-amber-500/20 flex items-center justify-between group hover:border-amber-500/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black shrink-0">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-[var(--text-main)] uppercase truncate">vs {rival}</h4>
                            <span className="px-2 py-0.5 rounded text-[7px] font-black uppercase bg-amber-500 text-white">
                              Suspendido
                            </span>
                          </div>
                          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1">
                            Fecha original: {new Date(m.date).toLocaleDateString()}
                          </p>
                          {newMatch ? (
                            <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                              <RefreshCw size={10} /> Reprogramado: {new Date(newMatch.date).toLocaleDateString()} {newMatch.time || ''}
                            </p>
                          ) : (
                            <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest mt-1">
                              Pendiente de reprogramar
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-amber-500 transition-colors" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {selectedMatch && (
        <MatchDetailModal 
          match={selectedMatch} 
          onClose={() => setSelectedMatch(null)} 
        />
      )}

      {showStatsType && (
        <StatsDetailModal 
          type={showStatsType} 
          matches={filteredMatches} 
          teamName={clubConfig?.name || 'Mi Equipo'}
          goalsFor={goalsFor}
          goalsConceded={goalsConceded}
          onClose={() => setShowStatsType(null)} 
        />
      )}

      {showMedicalWarningModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl" onClick={() => setShowMedicalWarningModal(false)} />
          
          <div className="relative w-full max-w-2xl bg-surface-card rounded-[2.5rem] border border-[var(--surface-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-[var(--surface-border)] flex justify-between items-center bg-surface-ground shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-[var(--text-main)] leading-none flex items-center gap-2">
                  <HeartPulse className="text-orange-500 animate-pulse" size={24} />
                  Controles de Apto Médico
                </h3>
                <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mt-1">
                  Jugadores con apto vencido o por vencer en 30 días
                </p>
              </div>
              <button 
                onClick={() => setShowMedicalWarningModal(false)}
                className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 transition-colors"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selector de Filtro */}
            <div className="p-5 border-b border-[var(--surface-border)] bg-surface-card shrink-0">
              <div className="flex gap-2 bg-surface-ground p-1.5 rounded-2xl border border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setMedicalFilter('squad')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    medicalFilter === 'squad'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Plantel Actual ({expiringInSquad.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMedicalFilter('all')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    medicalFilter === 'all'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Todos los Planteles ({expiringOverall.length})
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto p-6 space-y-4 flex-1 bg-surface-ground/30">
              {displayedMedicalPlayers.length > 0 ? (
                displayedMedicalPlayers.map((player) => {
                  const getInitials = (name: string) => {
                    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  };
                  
                  // Calculate remaining days details
                  const getRemainingDaysLabel = (expiryDateStr: string) => {
                    const expiry = new Date(expiryDateStr);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    expiry.setHours(0,0,0,0);
                    const diffTime = expiry.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                      return {
                        text: `Venció hace ${Math.abs(diffDays)} días`,
                        style: 'bg-red-500/10 text-red-500 border border-red-500/20'
                      };
                    } else if (diffDays === 0) {
                      return {
                        text: 'Vence hoy',
                        style: 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-orange-500/10'
                      };
                    } else {
                      return {
                        text: `Vence en ${diffDays} días`,
                        style: 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      };
                    }
                  };

                  const remainingDays = getRemainingDaysLabel(player.medical!.expiry_date);

                  return (
                    <div 
                      key={player.id}
                      className="flex items-center justify-between p-4 bg-surface-card rounded-2xl border border-[var(--surface-border)] hover:border-primary-500/20 transition-all gap-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-surface-hover overflow-hidden shrink-0 relative border border-[var(--surface-border)] flex items-center justify-center">
                          {player.photourl ? (
                            <img src={player.photourl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-xs font-black text-primary-600 italic">
                              {getInitials(player.name)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[var(--text-main)] uppercase truncate">
                            {player.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                            <span>DNI: {player.dni || 'N/A'}</span>
                            <span className="opacity-30">•</span>
                            <span className="text-primary-500 font-extrabold">{getPlayerCategoryName(player)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1 text-right">
                        <span className="text-[9px] font-black uppercase text-[var(--text-main)] tracking-wider">
                          VTO: {player.medical!.expiry_date.split('-').reverse().join('/')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${remainingDays.style}`}>
                          {remainingDays.text}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center border-2 border-dashed border-[var(--surface-border)] rounded-3xl bg-surface-card">
                  <Heart className="mx-auto text-emerald-500 mb-4 opacity-50 h-12 w-12 animate-pulse" />
                  <p className="text-xs font-black uppercase text-[var(--text-main)] tracking-widest">
                    ¡Todo bajo control!
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">
                    No hay jugadores con vencimientos en los próximos 30 días.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantelDashboard;
