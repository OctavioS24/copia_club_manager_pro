
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Trophy, TrendingUp, Activity, Loader2, AlertCircle, 
  TrendingDown, MoveRight, ShieldAlert, Target,
  Award, Calendar, ChevronRight, History, Timer, AlertTriangle, RefreshCw
} from 'lucide-react';
import { ClubConfig, Match, Member, MatchEvent } from '../types';
import { db, supabase } from '../lib/supabase';

interface PlantelDashboardProps {
  clubConfig: ClubConfig;
  members: Member[];
}

const MatchSkeleton = () => (
  <div className="animate-pulse flex items-center justify-between p-6 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      <div className="space-y-2">
        <div className="w-32 h-4 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="w-20 h-3 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>
    </div>
    <div className="w-16 h-8 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
  </div>
);

import { useCategory } from '../context/useCategory';
import { getDisciplineConfig, DisciplineConfig } from '../lib/disciplineConfig';

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
        const [configData, playerIds] = await Promise.all([
          getDisciplineConfig(discName),
          Promise.resolve(squadPlayers.map(p => p.id))
        ]);

        setDisciplineConfig(configData);

        // Fetch matches for this specific category
        // We check by ID primarily
        const { data: allMatches, error: matchesError } = await supabase
          .from('matches')
          .select('*, events:match_events(*)')
          .eq('categoryid', selectedDivision)
          .order('date', { ascending: false });

        if (matchesError) throw matchesError;

        const [eventsRes] = await Promise.all([
          playerIds.length > 0 ? db.matchEvents.getByPlayerIds(playerIds) : Promise.resolve({ data: [] })
        ]);

        if (eventsRes.error) throw eventsRes.error;

        const finishedMatches = (allMatches || []).filter(m => m.status === 'Finished');
        const upcomingFiltered = (allMatches || []).filter(m => m.status === 'Scheduled');
        const suspendedFiltered = (allMatches || []).filter(m => m.status === 'Suspended');

        setMatches(allMatches || []);
        setPlayerEvents(eventsRes.data || []);
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
        <div className="py-32 text-center bg-white/50 dark:bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-200 dark:border-white/5">
          <Users size={64} className="mx-auto text-slate-200 dark:text-slate-800 mb-6" />
          <h3 className="text-xl font-black uppercase text-slate-400 italic tracking-widest">Esperando selección de plantel</h3>
        </div>
      ) : isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3rem]">
          <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Procesando estadísticas...</p>
        </div>
      ) : error ? (
        <div className="py-32 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/10 rounded-[3rem] border border-red-100 dark:border-red-900/20">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <p className="text-sm font-black uppercase tracking-widest text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('PUNTOS_ACUMULADOS')) && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-white/5 hover:border-primary-600/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-600/5 rounded-bl-full"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Puntos Acumulados</p>
                    <h3 className="text-5xl font-black text-slate-800 dark:text-white italic tracking-tighter">{points} <span className="text-xs not-italic text-slate-400 ml-1">PTS</span></h3>
                  </div>
                  <div className="p-5 rounded-2xl bg-primary-600/10 text-primary-600 group-hover:scale-110 transition-transform shadow-lg shadow-primary-600/5">
                    <Trophy size={24} />
                  </div>
                </div>
              </div>
            )}

            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('RACHA_ACTUAL')) && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-white/5 hover:border-emerald-600/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-bl-full"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Racha Actual</p>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {visualStreak.length > 0 ? visualStreak.map((s, i) => (
                          <div key={i} className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-black/10`}>
                            {s.result}
                          </div>
                        )) : (
                          <span className="text-xs font-black text-slate-300">SIN DATOS</span>
                        )}
                      </div>
                      {trend !== 'neutral' && (
                        <div className={`p-2 rounded-full ${trend === 'up' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                          {trend === 'up' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        </div>
                      )}
                      {trend === 'neutral' && visualStreak.length > 0 && (
                        <div className="p-2 rounded-full bg-slate-500/20 text-slate-500">
                          <MoveRight size={18} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-600/10 text-emerald-600 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-600/5">
                    <Activity size={24} />
                  </div>
                </div>
              </div>
            )}

            {(!disciplineConfig || disciplineConfig.dashboard_stats.includes('PARTIDOS_JUGADOS')) && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-white/5 hover:border-blue-600/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-bl-full"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Partidos Jugados</p>
                    <h3 className="text-5xl font-black text-slate-800 dark:text-white italic tracking-tighter">{matches.filter(m => m.status === 'Finished').length}</h3>
                  </div>
                  <div className="p-5 rounded-2xl bg-blue-600/10 text-blue-600 group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/5">
                    <Target size={24} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Estadísticas Personales del Plantel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {disciplineConfig?.event_types.filter(et => disciplineConfig.dashboard_stats.includes(et.statsKey)).map(et => (
              <div key={et.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${et.color}10`, color: et.color }}>
                  <Award size={32} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{et.name}S TOTALES</p>
                  <h4 className="text-3xl font-black text-slate-800 dark:text-white italic">{squadStats[et.statsKey] || 0}</h4>
                </div>
              </div>
            ))}
            
            {!disciplineConfig && (
              <>
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                    <Award size={32} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Goles Totales</p>
                    <h4 className="text-3xl font-black text-slate-800 dark:text-white italic">{squadStats.GOLES_TOTALES || 0}</h4>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <ShieldAlert size={32} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tarjetas Amarillas</p>
                    <h4 className="text-3xl font-black text-slate-800 dark:text-white italic">{squadStats.TARJETAS_AMARILLAS || 0}</h4>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                    <ShieldAlert size={32} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tarjetas Rojas</p>
                    <h4 className="text-3xl font-black text-slate-800 dark:text-white italic">{squadStats.TARJETAS_ROJAS || 0}</h4>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Match History & Upcoming Matches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ÚLTIMOS 5 RESULTADOS */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-sm border border-slate-200 dark:border-white/5">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-3">
                    <History size={18} className="text-primary-600" />
                    Últimos 5 Resultados
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Historial de encuentros disputados</p>
                </div>
              </div>
              
              <div className="space-y-4">
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
                        className="group flex items-center justify-between p-6 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-primary-600/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg ${isWin ? 'bg-emerald-500' : isDraw ? 'bg-amber-500' : 'bg-red-500'}`}>
                            {isWin ? 'G' : isDraw ? 'E' : 'P'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[120px]">{rival}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-xl font-black italic text-slate-800 dark:text-white">
                            {m.homescore} - {m.awayscore}
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-600 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl">
                    <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Sin resultados registrados</p>
                  </div>
                )}
              </div>
            </div>

            {/* PRÓXIMOS PARTIDOS */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-sm border border-slate-200 dark:border-white/5">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-3">
                    <Timer size={18} className="text-primary-600" />
                    Próximos Partidos
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Agenda de competiciones</p>
                </div>
              </div>
              
              <div className="space-y-4">
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
                        className="group flex items-center justify-between p-6 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-primary-600/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary-600/10 rounded-2xl flex items-center justify-center text-primary-600">
                            <Calendar size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[120px]">{rival}</p>
                              {m.original_match_id && (
                                <span className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-blue-500/20">
                                  Reprogramado
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${isHome ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-400'}`}>
                            {isHome ? 'Local' : 'Visitante'}
                          </span>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-600 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl">
                    <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Sin partidos programados</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PARTIDOS SUSPENDIDOS / REPROGRAMADOS */}
          {suspendedMatches.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-sm border border-slate-200 dark:border-white/5">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-3">
                    <AlertTriangle size={18} className="text-orange-500" />
                    Partidos Suspendidos / Reprogramados
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de incidencias en el fixture</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      className="bg-slate-50/50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5 relative overflow-hidden group"
                    >
                      <div className={`absolute top-0 right-0 w-16 h-16 ${isRescheduled ? 'bg-blue-500/5' : 'bg-orange-500/5'} rounded-bl-full`}></div>
                      
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRescheduled ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                          {isRescheduled ? <RefreshCw size={20} /> : <AlertTriangle size={20} />}
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                             {isRescheduled ? 'Reprogramado' : 'Suspendido'}
                          </p>
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{rival}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] bg-white/50 dark:bg-black/20 p-3 rounded-2xl">
                          <span className="text-slate-400 font-bold uppercase tracking-wider italic">Original:</span>
                          <span className="text-slate-800 dark:text-white font-black">{m.original_date || m.date}</span>
                        </div>

                        {newMatch && (
                          <div className="flex justify-between items-center text-[10px] bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
                            <span className="text-blue-500 font-bold uppercase tracking-wider italic">Nueva Fecha:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-black">{newMatch.date}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[10px] pt-2">
                           <span className={`px-3 py-1 rounded-lg font-black uppercase tracking-widest ${isHome ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'}`}>
                             {isHome ? 'L' : 'V'}
                           </span>
                           {!isRescheduled && (
                             <span className="text-orange-500 font-black uppercase text-[8px] animate-pulse italic">Pendiente de Fecha</span>
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
    </div>
  );
};

export default PlantelDashboard;
