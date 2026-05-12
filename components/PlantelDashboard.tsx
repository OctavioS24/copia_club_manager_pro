
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Trophy, TrendingUp, Activity, Loader2, AlertCircle, 
  TrendingDown, ShieldAlert, Target,
  Award, Calendar, ChevronRight, History, Timer, AlertTriangle, RefreshCw
} from 'lucide-react';
import { ClubConfig, Match, Member, MatchEvent } from '../types';
import { db, supabase } from '../lib/supabase';

interface PlantelDashboardProps {
  clubConfig: ClubConfig;
  members: Member[];
}

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

import { useCategory } from '../context/useCategory';
import { getDisciplineConfig, DisciplineConfig } from '../lib/disciplineConfig';
import MatchDetailModal from './MatchDetailModal';
import StatsDetailModal from './StatsDetailModal';

const PlantelDashboard: React.FC<PlantelDashboardProps> = ({ clubConfig: propClubConfig, members: propMembers }) => {
  const { selectedDiscipline, selectedDivision } = useCategory();
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(propClubConfig || null);
  const [members, setMembers] = useState<Member[]>(propMembers || []);
  const [disciplineConfig, setDisciplineConfig] = useState<DisciplineConfig | null>(null);

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
  const [lastResults, setLastResults] = useState<Match[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [suspendedMatches, setSuspendedMatches] = useState<Match[]>([]);
  const [playerEvents, setPlayerEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showStatsType, setShowStatsType] = useState<'Goles' | 'Amarillas' | 'Rojas' | null>(null);

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

    if (filtered.length === 0 && members.length > 0) {
      console.log(`Dashboard: No se encontraron jugadores para ${discName} - ${selectedCategory.category.name}`);
      console.log(`Buscando: DiscID=${selectedCategory.disciplineId}, CatID=${selectedCategory.category.id}, DiscName=${discName}, CatName=${selectedCategory.category.name}`);
    }

    return filtered;
  }, [members, selectedCategory, clubConfig]);

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

        const finishedMatches = (allMatches || []).filter(m => m.status === 'Finished');
        const upcomingFiltered = (allMatches || []).filter(m => m.status === 'Scheduled');
        const suspendedFiltered = (allMatches || []).filter(m => m.status === 'Suspended');

        setMatches(allMatches || []);
        setPlayerEvents([]); // We will use match events instead
        setLastResults(finishedMatches.slice(0, 5));
        setUpcomingMatches(upcomingFiltered.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5));
        setSuspendedMatches(suspendedFiltered);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("No se pudieron cargar las estadísticas del plantel.");
      } finally {
        setIsLoading(false);
        setIsLoadingLists(false);
      }
    };

    fetchStats();
  }, [selectedCategory, squadPlayers, selectedDivision, clubConfig, selectedDiscipline]);

  const points = useMemo(() => {
    if (!selectedCategory || !clubConfig) return 0;
    const teamName = clubConfig.name || 'Mi Equipo';
    const rules = disciplineConfig?.scoring_rules || { win: 3, draw: 1, loss: 0 };

    return matches.reduce((acc, match) => {
      if (match.status !== 'Finished') return acc;
      const isHome = (match.hometeam || match.home_team) === teamName;
      const myScore = isHome ? (match.homescore ?? match.home_score ?? 0) : (match.awayscore ?? match.away_score ?? 0);
      const rivalScore = isHome ? (match.awayscore ?? match.away_score ?? 0) : (match.homescore ?? match.home_score ?? 0);

      if (myScore > rivalScore) return acc + rules.win;
      if (myScore === rivalScore) return acc + rules.draw;
      return acc + rules.loss;
    }, 0);
  }, [matches, selectedCategory, clubConfig, disciplineConfig]);

  const visualStreak = useMemo(() => {
    const finishedMatches = matches.filter(m => m.status === 'Finished');
    if (finishedMatches.length === 0 || !clubConfig) return [];
    const teamName = clubConfig.name || 'Mi Equipo';
    return finishedMatches.slice(0, 5).map(m => {
      const isHome = m.hometeam === teamName;
      const myScore = isHome ? (m.homescore || 0) : (m.awayscore || 0);
      const rivalScore = isHome ? (m.awayscore || 0) : (m.homescore || 0);
      
      if (myScore > rivalScore) return { result: 'G', color: 'bg-emerald-500' };
      if (myScore === rivalScore) return { result: 'E', color: 'bg-amber-500' };
      return { result: 'P', color: 'bg-red-500' };
    });
  }, [matches, clubConfig]);

  const trend = useMemo(() => {
    const finishedMatches = matches.filter(m => m.status === 'Finished');
    if (finishedMatches.length < 3 || !clubConfig) return 'neutral';
    const teamName = clubConfig.name || 'Mi Equipo';
    
    const getPoints = (m: Match) => {
      const isHome = m.hometeam === teamName;
      const myScore = isHome ? (m.homescore || 0) : (m.awayscore || 0);
      const rivalScore = isHome ? (m.awayscore || 0) : (m.homescore || 0);
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
  }, [matches, clubConfig, disciplineConfig]);

  const squadStats = useMemo(() => {
    const stats: Record<string, number> = {};
    
    // Inicializar stats según config
    if (disciplineConfig) {
      disciplineConfig.dashboard_stats.forEach(s => stats[s] = 0);
      // También inicializar las que vienen de eventos
      disciplineConfig.event_types.forEach(et => {
        if (et.statsKey) stats[et.statsKey] = 0;
      });
    }

    // Solo contar eventos de partidos DISPUTADOS (status === 'Finished')
    const finishedMatchIds = new Set(matches.filter(m => m.status === 'Finished').map(m => m.id));

    // Combinar eventos de playerEvents (por jugador) y de matches (por categoría)
    const allEvents = [...playerEvents].filter(e => finishedMatchIds.has(e.match_id));
    matches.forEach(m => {
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
  }, [playerEvents, matches, disciplineConfig]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Selector de Plantel - ELIMINADO PORQUE YA ESTÁ EN EL PADRE */}
      
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
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('PUNTOS_ACUMULADOS')) && (
              <div className="bg-surface-card p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-[var(--surface-border)] hover:border-primary-500/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-primary-500/5 rounded-bl-full"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 md:mb-3">Puntos Acumulados</p>
                    <h3 className="text-2xl md:text-5xl font-black text-[var(--text-main)] italic tracking-tighter">{points} <span className="text-[10px] md:text-xs not-italic text-[var(--text-muted)] ml-1">PTS</span></h3>
                  </div>
                  <div className="p-3 md:p-5 rounded-xl md:rounded-2xl bg-primary-500/10 text-primary-500 group-hover:scale-110 transition-transform shadow-lg shadow-primary-500/5">
                    <Trophy size={18} md:size={24} />
                  </div>
                </div>
              </div>
            )}

            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('RACHA_ACTUAL')) && (
              <div className="bg-surface-card p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-[var(--surface-border)] hover:border-emerald-600/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-emerald-600/5 rounded-bl-full"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex-1">
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 md:mb-3">Racha Actual</p>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex gap-1">
                        {visualStreak.length > 0 ? visualStreak.map((s, i) => (
                          <div key={i} className={`w-6 h-6 md:w-8 md:h-8 rounded-md md:rounded-lg ${s.color} flex items-center justify-center text-white text-[8px] md:text-[10px] font-black shadow-lg shadow-black/10`}>
                            {s.result}
                          </div>
                        )) : (
                          <span className="text-[10px] font-black text-[var(--text-muted)] opacity-30 uppercase">Sin Datos</span>
                        )}
                      </div>
                      {trend !== 'neutral' && (
                        <div className={`p-1 md:p-2 rounded-full ${trend === 'up' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                          {trend === 'up' ? <TrendingUp size={14} md:size={18} /> : <TrendingDown size={14} md:size={18} />}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 md:p-5 rounded-xl md:rounded-2xl bg-emerald-600/10 text-emerald-600 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-600/5">
                    <Activity size={18} md:size={24} />
                  </div>
                </div>
              </div>
            )}

            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('PARTIDOS_JUGADOS')) && (
              <div className="bg-surface-card p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-[var(--surface-border)] hover:border-blue-600/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-blue-600/5 rounded-bl-full"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 md:mb-3">Partidos Jugados</p>
                    <h3 className="text-2xl md:text-5xl font-black text-[var(--text-main)] italic tracking-tighter">{matches.filter(m => m.status === 'Finished').length}</h3>
                  </div>
                  <div className="p-3 md:p-5 rounded-xl md:rounded-2xl bg-blue-600/10 text-blue-600 group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/5">
                    <Target size={18} md:size={24} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Estadísticas Personales del Plantel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {disciplineConfig?.event_types.filter(et => disciplineConfig.dashboard_stats.includes(et.statsKey)).map(et => (
              <div key={et.id} className="bg-surface-card p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-[var(--surface-border)] flex items-center gap-3 md:gap-6">
                <div className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-2xl flex items-center justify-center shadow-inner shrink-0" style={{ backgroundColor: `${et.color}10`, color: et.color }}>
                  <Award size={20} md:size={32} />
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest truncate">{et.name}S TOTALES</p>
                  <h4 className="text-xl md:text-3xl font-black text-[var(--text-main)] italic">{squadStats[et.statsKey] || 0}</h4>
                </div>
                <button 
                  onClick={() => setShowStatsType(et.name === 'GOL' ? 'Goles' : et.name.includes('AMARILLA') ? 'Amarillas' : 'Rojas')}
                  className="ml-auto w-7 h-7 md:w-8 md:h-8 rounded-full bg-surface-ground flex items-center justify-center text-[var(--text-muted)] hover:text-primary-500 hover:bg-white transition-all shadow-sm shrink-0"
                >
                  <ChevronRight size={12} md:size={14} />
                </button>
              </div>
            ))}
            
            {!disciplineConfig && (
              <>
                <div className="bg-surface-card p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-[var(--surface-border)] flex items-center gap-3 md:gap-6 cursor-pointer hover:border-primary-500/50 transition-all" onClick={() => setShowStatsType('Goles')}>
                  <div className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500 shrink-0">
                    <Award size={20} md:size={32} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest truncate">Goles Totales</p>
                    <h4 className="text-xl md:text-3xl font-black text-[var(--text-main)] italic">{squadStats.GOLES_TOTALES || 0}</h4>
                  </div>
                </div>

                <div className="bg-surface-card p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-[var(--surface-border)] flex items-center gap-3 md:gap-6 cursor-pointer hover:border-amber-500/50 transition-all" onClick={() => setShowStatsType('Amarillas')}>
                  <div className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <ShieldAlert size={20} md:size={32} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest truncate">Tarjetas Amarillas</p>
                    <h4 className="text-xl md:text-3xl font-black text-[var(--text-main)] italic">{squadStats.TARJETAS_AMARILLAS || 0}</h4>
                  </div>
                </div>

                <div className="bg-surface-card p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-[var(--surface-border)] flex items-center gap-3 md:gap-6 cursor-pointer hover:border-red-500/50 transition-all" onClick={() => setShowStatsType('Rojas')}>
                  <div className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                    <ShieldAlert size={20} md:size={32} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest truncate">Tarjetas Rojas</p>
                    <h4 className="text-xl md:text-3xl font-black text-[var(--text-main)] italic">{squadStats.TARJETAS_ROJAS || 0}</h4>
                  </div>
                </div>
              </>
            )}
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
                  <p className="text-[7px] md:text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Historial de encuentros disputados</p>
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
                          <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg shrink-0 text-xs md:text-base ${isWin ? 'bg-emerald-500' : isDraw ? 'bg-amber-500' : 'bg-red-500'}`}>
                            {isWin ? 'G' : isDraw ? 'E' : 'P'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase truncate max-w-[80px] sm:max-w-[120px]">{rival}</p>
                            <p className="text-[7px] md:text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{m.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:gap-6 shrink-0">
                          <div className="text-sm md:text-xl font-black italic text-[var(--text-main)]">
                            {m.homescore} - {m.awayscore}
                          </div>
                          <ChevronRight size={14} md:size={16} className="text-[var(--text-muted)] group-hover:text-primary-500 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-[var(--surface-border)] rounded-3xl">
                    <p className="text-[10px] font-black uppercase text-[var(--text-muted)] opacity-30 tracking-widest">Sin resultados registrados</p>
                  </div>
                )}
              </div>
            </div>

            {/* PRÓXIMOS PARTIDOS */}
            <div className="bg-surface-card p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] shadow-sm border border-[var(--surface-border)]">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h3 className="text-xs md:text-sm font-black text-[var(--text-main)] uppercase tracking-widest flex items-center gap-2 md:gap-3">
                    <Timer size={16} md:size={18} className="text-primary-500" />
                    Próximos Partidos
                  </h3>
                  <p className="text-[7px] md:text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Agenda de competiciones</p>
                </div>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                {isLoadingLists ? (
                  Array(3).fill(0).map((_, i) => <MatchSkeleton key={i} />)
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
                          <div className="w-9 h-9 md:w-12 md:h-12 bg-primary-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-primary-500 shrink-0">
                            <Calendar size={18} md:size={24} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase truncate max-w-[70px] sm:max-w-[120px]">{rival}</p>
                              {m.original_match_id && (
                                <span className="bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded text-[5px] md:text-[7px] font-black uppercase tracking-widest border border-blue-500/20 shrink-0">
                                  Reprog.
                                </span>
                              )}
                            </div>
                            <p className="text-[7px] md:text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{m.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-6 shrink-0">
                          <span className={`px-2 md:px-4 py-1 rounded-full text-[6px] md:text-[8px] font-black uppercase tracking-widest ${isHome ? 'bg-blue-500/10 text-blue-500' : 'bg-surface-hover text-[var(--text-muted)]'}`}>
                            {isHome ? 'Local' : 'Visit.'}
                          </span>
                          <ChevronRight size={12} md:size={16} className="text-[var(--text-muted)] group-hover:text-primary-500 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-[var(--surface-border)] rounded-3xl">
                    <p className="text-[10px] font-black uppercase text-[var(--text-muted)] opacity-30 tracking-widest">Sin partidos programados</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PARTIDOS SUSPENDIDOS / REPROGRAMADOS */}
          {suspendedMatches.length > 0 && (
            <div className="bg-surface-card p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] shadow-sm border border-[var(--surface-border)]">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h3 className="text-xs md:text-sm font-black text-[var(--text-main)] uppercase tracking-widest flex items-center gap-2 md:gap-3">
                    <AlertTriangle size={16} md:size={18} className="text-orange-500" />
                    Partidos Suspendidos / Reprogramados
                  </h3>
                  <p className="text-[7px] md:text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Gestión de incidencias en el fixture</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {suspendedMatches.map((m) => {
                  const teamName = clubConfig.name || 'Mi Equipo';
                  const isHome = m.hometeam === teamName;
                  const rival = isHome ? m.awayteam : m.hometeam;
                  // A match is "rescheduled" if there exists another match referencing this one as original
                  const newMatch = matches.find(nm => nm.original_match_id === m.id);
                  const isRescheduled = !!newMatch;

                  return (
                    <div 
                      key={m.id} 
                      className="bg-surface-ground p-4 md:p-6 rounded-2xl md:rounded-3xl border border-[var(--surface-border)] relative overflow-hidden group"
                    >
                      <div className={`absolute top-0 right-0 w-12 h-12 md:w-16 md:h-16 ${isRescheduled ? 'bg-blue-500/5' : 'bg-orange-500/5'} rounded-bl-full`}></div>
                      
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${isRescheduled ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'} shrink-0`}>
                          {isRescheduled ? <RefreshCw size={18} md:size={20} /> : <AlertTriangle size={18} md:size={20} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                             {isRescheduled ? 'Reprogramado' : 'Suspendido'}
                          </p>
                          <p className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase truncate">{rival}</p>
                        </div>
                      </div>

                      <div className="space-y-2 md:space-y-3">
                        <div className="flex justify-between items-center text-[9px] md:text-[10px] bg-surface-card p-2 md:p-3 rounded-xl md:rounded-2xl border border-[var(--surface-border)]">
                          <span className="text-[var(--text-muted)] font-bold uppercase tracking-wider italic">Original:</span>
                          <span className="text-[var(--text-main)] font-black">{m.original_date || m.date}</span>
                        </div>

                        {newMatch && (
                          <div className="flex justify-between items-center text-[9px] md:text-[10px] bg-blue-500/10 p-2 md:p-3 rounded-xl md:rounded-2xl border border-blue-500/20">
                            <span className="text-blue-500 font-bold uppercase tracking-wider italic">Nueva Fecha:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-black">{newMatch.date}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[9px] md:text-[10px] pt-1 md:pt-2">
                           <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg font-black uppercase tracking-widest ${isHome ? 'bg-surface-hover text-[var(--text-muted)]' : 'bg-[var(--secondary-600)] text-white shadow-sm'}`}>
                             {isHome ? 'L' : 'V'}
                           </span>
                           {!isRescheduled && (
                             <span className="text-orange-500 font-black uppercase text-[7px] md:text-[8px] animate-pulse italic">Pendiente de Fecha</span>
                           )}
                        </div>
                      </div>
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
          matches={matches} 
          onClose={() => setShowStatsType(null)} 
        />
      )}
    </div>
  );
};

export default PlantelDashboard;
