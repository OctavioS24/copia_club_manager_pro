
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Trophy, TrendingUp, Activity, Loader2, AlertCircle, 
  TrendingDown, MoveRight, ShieldAlert, Target,
  Award, Calendar, ChevronRight, History, Timer
} from 'lucide-react';
import { ClubConfig, Match, Member, MatchEvent } from '../types';
import { db } from '../lib/supabase';

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

const PlantelDashboard: React.FC<PlantelDashboardProps> = ({ clubConfig: propClubConfig, members: propMembers }) => {
  const navigate = useNavigate();
  const { selectedDiscipline, selectedDivision } = useCategory();
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(propClubConfig || null);
  const [members, setMembers] = useState<Member[]>(propMembers || []);

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
  const [playerEvents, setPlayerEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Jugadores del plantel seleccionado
  const squadPlayers = useMemo(() => {
    if (!selectedCategory) return [];
    return members.filter(m => 
      m.assignments?.some(a => 
        a.discipline_id === selectedCategory.disciplineId && 
        a.category_id === selectedCategory.category.id &&
        a.role === 'PLAYER'
      )
    );
  }, [members, selectedCategory]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCategory || !selectedDivision) return;
      
      setIsLoading(true);
      setIsLoadingLists(true);
      setError(null);
      try {
        const teamName = selectedCategory.category.name;
        const playerIds = squadPlayers.map(p => p.id);

        // Fetch tournaments that include this category
        const tourRes = await db.tournaments.getAll();
        const categoryTournaments = tourRes.data?.filter((t: any) => {
          const assigned = t.assigned_categories || t.assignedcategories || [];
          return assigned.includes(selectedDivision);
        }) || [];
        
        const tournamentIds = categoryTournaments.map(t => t.id);

        // Fetch matches for these tournaments OR by team name for external matches
        let allMatches: Match[] = [];
        if (tournamentIds.length > 0) {
          const matchesPromises = tournamentIds.map(id => db.matches.getAll(id));
          const matchesResults = await Promise.all(matchesPromises);
          matchesResults.forEach(res => {
            if (res.data) allMatches = [...allMatches, ...res.data];
          });
        }

        // Also fetch by team name to be sure
        const nameMatchesRes = await db.matches.getByTeamName(teamName);
        if (nameMatchesRes.data) {
          const newMatches = nameMatchesRes.data.filter(nm => !allMatches.some(am => am.id === nm.id));
          allMatches = [...allMatches, ...newMatches];
        }

        const [eventsRes, lastRes, upcomingRes] = await Promise.all([
          playerIds.length > 0 ? db.matchEvents.getByPlayerIds(playerIds) : Promise.resolve({ data: [] }),
          db.matches.getLastResults(teamName, 5),
          db.matches.getUpcomingMatches(teamName, 3)
        ]);

        if (eventsRes.error) throw eventsRes.error;
        if (lastRes.error) throw lastRes.error;
        if (upcomingRes.error) throw upcomingRes.error;

        setMatches(allMatches);
        setPlayerEvents(eventsRes.data || []);
        setLastResults(lastRes.data || []);
        setUpcomingMatches(upcomingRes.data || []);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("No se pudieron cargar las estadísticas del plantel.");
      } finally {
        setIsLoading(false);
        setIsLoadingLists(false);
      }
    };

    fetchStats();
  }, [selectedCategory, squadPlayers, selectedDivision]);

  const points = useMemo(() => {
    if (!selectedCategory) return 0;
    const teamName = selectedCategory.category.name;
    return matches.reduce((acc, match) => {
      const isHome = match.homeTeam === teamName;
      const myScore = isHome ? (match.homeScore || 0) : (match.awayScore || 0);
      const rivalScore = isHome ? (match.awayScore || 0) : (match.homeScore || 0);

      if (myScore > rivalScore) return acc + 3;
      if (myScore === rivalScore) return acc + 1;
      return acc;
    }, 0);
  }, [matches, selectedCategory]);

  const visualStreak = useMemo(() => {
    if (matches.length === 0) return [];
    const teamName = selectedCategory?.category.name;
    return matches.slice(0, 5).map(m => {
      const isHome = m.homeTeam === teamName;
      const myScore = isHome ? (m.homeScore || 0) : (m.awayScore || 0);
      const rivalScore = isHome ? (m.awayScore || 0) : (m.homeScore || 0);
      
      if (myScore > rivalScore) return { result: 'G', color: 'bg-emerald-500' };
      if (myScore === rivalScore) return { result: 'E', color: 'bg-amber-500' };
      return { result: 'P', color: 'bg-red-500' };
    });
  }, [matches, selectedCategory]);

  const trend = useMemo(() => {
    if (matches.length < 3) return 'neutral';
    const teamName = selectedCategory?.category.name;
    
    const getPoints = (m: Match) => {
      const isHome = m.homeTeam === teamName;
      const myScore = isHome ? (m.homeScore || 0) : (m.awayScore || 0);
      const rivalScore = isHome ? (m.awayScore || 0) : (m.homeScore || 0);
      if (myScore > rivalScore) return 3;
      if (myScore === rivalScore) return 1;
      return 0;
    };

    const last3 = matches.slice(0, 3).reduce((acc, m) => acc + getPoints(m), 0);
    const prev3 = matches.slice(3, 6).reduce((acc, m) => acc + getPoints(m), 0);

    if (last3 > prev3) return 'up';
    if (last3 < prev3) return 'down';
    return 'neutral';
  }, [matches, selectedCategory]);

  const squadStats = useMemo(() => {
    return playerEvents.reduce((acc, event) => {
      if (event.type === 'Goal') acc.goals++;
      if (event.type === 'YellowCard') acc.yellowCards++;
      if (event.type === 'RedCard') acc.redCards++;
      return acc;
    }, { goals: 0, yellowCards: 0, redCards: 0 });
  }, [playerEvents]);

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

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-white/5 hover:border-blue-600/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-bl-full"></div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Partidos Jugados</p>
                  <h3 className="text-5xl font-black text-slate-800 dark:text-white italic tracking-tighter">{matches.length}</h3>
                </div>
                <div className="p-5 rounded-2xl bg-blue-600/10 text-blue-600 group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/5">
                  <Target size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Estadísticas Personales del Plantel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                <Award size={32} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Goles Totales</p>
                <h4 className="text-3xl font-black text-slate-800 dark:text-white italic">{squadStats.goals}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <ShieldAlert size={32} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tarjetas Amarillas</p>
                <h4 className="text-3xl font-black text-slate-800 dark:text-white italic">{squadStats.yellowCards}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                <ShieldAlert size={32} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tarjetas Rojas</p>
                <h4 className="text-3xl font-black text-slate-800 dark:text-white italic">{squadStats.redCards}</h4>
              </div>
            </div>
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
                    const isHome = m.homeTeam === selectedCategory.category.name;
                    const rival = isHome ? m.awayTeam : m.homeTeam;
                    const myScore = isHome ? m.homeScore : m.awayScore;
                    const rivalScore = isHome ? m.awayScore : m.homeScore;
                    const isWin = (myScore || 0) > (rivalScore || 0);
                    const isDraw = (myScore || 0) === (rivalScore || 0);

                    return (
                      <div 
                        key={m.id} 
                        onClick={() => navigate(`/match/${m.id}`)}
                        className="group flex items-center justify-between p-6 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-primary-600/30 transition-all cursor-pointer"
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
                            {m.homeScore} - {m.awayScore}
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
                    const isHome = m.homeTeam === selectedCategory.category.name;
                    const rival = isHome ? m.awayTeam : m.homeTeam;

                    return (
                      <div 
                        key={m.id} 
                        onClick={() => navigate(`/match/${m.id}`)}
                        className="group flex items-center justify-between p-6 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-primary-600/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary-600/10 rounded-2xl flex items-center justify-center text-primary-600">
                            <Calendar size={24} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[120px]">{rival}</p>
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
        </div>
      )}
    </div>
  );
};

export default PlantelDashboard;
