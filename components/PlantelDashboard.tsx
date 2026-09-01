
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Trophy, TrendingUp, Activity, Loader2, AlertCircle, 
  TrendingDown, ShieldAlert, ShieldX, Target,
  Award, Calendar, ChevronRight, History, Timer, AlertTriangle, RefreshCw, HeartPulse, Heart, X,
  ArrowUpRight
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
  const [showStatsType, setShowStatsType] = useState<'Goles' | 'Amarillas' | 'Rojas' | 'Goles en Contra' | null>(null);
  
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

    if (filtered.length === 0 && members.length > 0) {
      console.log(`Dashboard: No se encontraron jugadores para ${discName} - ${selectedCategory.category.name}`);
      console.log(`Buscando: DiscID=${selectedCategory.disciplineId}, CatID=${selectedCategory.category.id}, DiscName=${discName}, CatName=${selectedCategory.category.name}`);
    }

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

  const goalsConceded = useMemo(() => {
    if (!selectedCategory || !clubConfig) return 0;
    const teamName = clubConfig.name || 'Mi Equipo';

    return matches.reduce((acc, match) => {
      if (match.status !== 'Finished') return acc;
      const isHome = (match.hometeam || match.home_team) === teamName;
      // If our team is home, goals conceded is away score; if our team is away, goals conceded is home score
      const conceded = isHome ? (match.awayscore ?? match.away_score ?? 0) : (match.homescore ?? match.home_score ?? 0);
      return acc + conceded;
    }, 0);
  }, [matches, selectedCategory, clubConfig]);

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
                <p className="text-[10px] text-[#888888] dark:text-[#BBBBBB] mt-1 font-medium">Consolidado en fixture</p>
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
                <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{matches.filter(m => m.status === 'Finished').length}</h4>
                <p className="text-[10px] text-[#888888] dark:text-[#BBBBBB] mt-1 font-medium">Historial completado</p>
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

          {/* Estadísticas Secundarias del Plantel (Goles a Favor, Goles en Contra, Tarjetas Amarillas y Rojas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {disciplineConfig?.event_types.filter(et => disciplineConfig.dashboard_stats.includes(et.statsKey)).map(et => {
              const isGoal = et.name === 'GOL' || et.statsKey === 'GOLES_TOTALES';
              return (
                <React.Fragment key={et.id}>
                  <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner shrink-0" style={{ backgroundColor: `${et.color}10`, color: et.color }}>
                        <Award size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">{et.name}S TOTALES</p>
                        <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{squadStats[et.statsKey] || 0}</h4>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowStatsType(et.name === 'GOL' ? 'Goles' : et.name.includes('AMARILLA') ? 'Amarillas' : 'Rojas')}
                      className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-primary-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Card específica de GOLES EN CONTRA inmediatamente al lado de Goles Totales */}
                  {isGoal && (
                    <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all hover:border-rose-500/30">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
                          <ShieldX size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Goles en Contra</p>
                          <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{goalsConceded}</h4>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowStatsType('Goles en Contra')}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0 cursor-pointer"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            
            {!disciplineConfig && (
              <>
                <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-primary-500/30" onClick={() => setShowStatsType('Goles')}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 shrink-0 shadow-inner">
                      <Award size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Goles Totales</p>
                      <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{squadStats.GOLES_TOTALES || 0}</h4>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowStatsType('Goles'); }}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-primary-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Card de Goles en Contra en fallback sin config */}
                <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-rose-500/30" onClick={() => setShowStatsType('Goles en Contra')}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
                      <ShieldX size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Goles en Contra</p>
                      <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{goalsConceded}</h4>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowStatsType('Goles en Contra'); }}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-amber-500/30" onClick={() => setShowStatsType('Amarillas')}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Tarjetas Amarillas</p>
                      <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{squadStats.TARJETAS_AMARILLAS || 0}</h4>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowStatsType('Amarillas'); }}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer hover:border-red-500/30" onClick={() => setShowStatsType('Rojas')}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0 shadow-inner">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest truncate leading-none">Tarjetas Rojas</p>
                      <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{squadStats.TARJETAS_ROJAS || 0}</h4>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowStatsType('Rojas'); }}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#888888] dark:text-[#BBBBBB] hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm shrink-0"
                  >
                    <ChevronRight size={16} />
                  </button>
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
          teamName={clubConfig?.name || 'Mi Equipo'}
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
