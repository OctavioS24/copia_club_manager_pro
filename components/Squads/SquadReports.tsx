import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, db } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Member } from '../../types';
import { 
  Loader2, 
  Search, 
  Award, 
  Flame, 
  ArrowUpDown, 
  User, 
  Calendar
} from 'lucide-react';

interface PlayerReportRow {
  id: string;
  name: string;
  photourl?: string;
  convocatorias: number;
  titularidades: number;
  minutosJugados: number;
}

const SquadReports: React.FC = () => {
  const { selectedDiscipline, selectedDivision } = useCategory();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [squads, setSquads] = useState<any[]>([]);
  const [disciplineName, setDisciplineName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'convocatorias' | 'titularidades'>('convocatorias');

  const loadData = useCallback(async () => {
    if (!selectedDiscipline || !selectedDivision) return;
    
    setLoading(true);
    setError(null);
    try {
      // Fetch matches and configs to locate all correct categories
      const [membersRes, configRes, matchesRes] = await Promise.all([
        db.members.getAll(),
        db.config.get(),
        supabase.from('matches').select('id, hometeam, awayteam, date').eq('categoryid', selectedDivision)
      ]);

      if (membersRes.error) throw membersRes.error;
      
      const membersList = membersRes.data || [];
      setMembers(membersList);
      
      const matchesList = matchesRes.data || [];

      // Resolve discipline and category names for matching assignments
      if (configRes.data) {
        const disc = configRes.data.disciplines.find((d: any) => d.id === selectedDiscipline);
        if (disc) {
          setDisciplineName(disc.name);
          const branch = disc.branches.find((b: any) => b.categories.some((c: any) => c.id === selectedDivision));
          const cat = branch?.categories.find((c: any) => c.id === selectedDivision);
          if (cat) setCategoryName(cat.name);
        }
      }

      // Fetch match squads matching either division or matches
      const matchIds = matchesList.map((m: any) => m.id);
      let squadsQuery = supabase.from('match_squads').select('*, players:match_squad_players(*)');
      
      if (matchIds.length > 0) {
        squadsQuery = squadsQuery.or(`category_id.eq.${selectedDivision},match_id.in.(${matchIds.join(',')})`);
      } else {
        squadsQuery = squadsQuery.eq('category_id', selectedDivision);
      }

      const { data: squadsList, error: squadsError } = await squadsQuery;
      if (squadsError) throw squadsError;
      setSquads(squadsList || []);

    } catch (err: any) {
      console.error('Error loading reports details:', err);
      setError('Ocurrió un error al procesar las estadísticas de convocatorias.');
    } finally {
      setLoading(false);
    }
  }, [selectedDiscipline, selectedDivision]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter squad players assigned to this category/discipline
  const squadPlayers = useMemo(() => {
    if (!selectedDiscipline || !selectedDivision || !disciplineName || !categoryName) return [];

    return members.filter(m => {
      const assignment = m.assignments?.find(a => {
        const aDisc = (a.discipline || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dName = (disciplineName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const aCat = (a.category || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cName = (categoryName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const discMatch = a.discipline_id === selectedDiscipline || aDisc === dName;
        const catMatch = a.category_id === selectedDivision || a.category === selectedDivision || aCat === cName;
        
        return discMatch && catMatch;
      });

      if (!assignment) return false;
      const role = (assignment.role || '').toUpperCase();
      return role === 'PLAYER' || role === 'JUGADOR';
    });
  }, [members, selectedDiscipline, selectedDivision, disciplineName, categoryName]);

  // Map each player to their convocatoria stats
  const calculatedStats = useMemo(() => {
    if (squadPlayers.length === 0) return [];

    // Create lookup map for player rosters
    const playerStatsMap = new Map<string, { convocatorias: number; titularidades: number; minutosJugados: number }>();
    
    // Initialize map
    squadPlayers.forEach(p => {
      playerStatsMap.set(p.id, { convocatorias: 0, titularidades: 0, minutosJugados: 0 });
    });

    squads.forEach(squad => {
      const squadPlayersList = squad.players || [];
      squadPlayersList.forEach((sp: any) => {
        if (playerStatsMap.has(sp.player_id)) {
          const stats = playerStatsMap.get(sp.player_id)!;
          stats.convocatorias += 1;
          if (sp.is_starting) {
            stats.titularidades += 1;
          }
          stats.minutosJugados += sp.minutes_played || 0;
          playerStatsMap.set(sp.player_id, stats);
        }
      });
    });

    // Form final report list
    const reportRows: PlayerReportRow[] = squadPlayers.map(p => {
      const stats = playerStatsMap.get(p.id) || { convocatorias: 0, titularidades: 0, minutosJugados: 0 };
      return {
        id: p.id,
        name: p.name,
        photourl: p.photourl,
        convocatorias: stats.convocatorias,
        titularidades: stats.titularidades,
        minutosJugados: stats.minutosJugados
      };
    });

    return reportRows;
  }, [squadPlayers, squads]);

  // List filter and sorting
  const processedReport = useMemo(() => {
    let result = [...calculatedStats];

    // Filter search
    if (searchTerm.trim() !== '') {
      const search = searchTerm.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(search));
    }

    // Sort descending by selected criteria
    result.sort((a, b) => {
      if (sortBy === 'titularidades') {
        const diff = b.titularidades - a.titularidades;
        if (diff !== 0) return diff;
        return b.convocatorias - a.convocatorias; // Secondary sort by conv
      } else {
        const diff = b.convocatorias - a.convocatorias;
        if (diff !== 0) return diff;
        return b.titularidades - a.titularidades; // Secondary sort by starters
      }
    });

    return result;
  }, [calculatedStats, searchTerm, sortBy]);

  // Highlighting key stats players
  const mvpConvocatorias = useMemo(() => {
    if (calculatedStats.length === 0) return null;
    return [...calculatedStats].sort((a, b) => b.convocatorias - a.convocatorias)[0];
  }, [calculatedStats]);

  const mvpTitularidades = useMemo(() => {
    if (calculatedStats.length === 0) return null;
    return [...calculatedStats].sort((a, b) => b.titularidades - a.titularidades)[0];
  }, [calculatedStats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
          Generando informes de convocatorias...
        </p>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-8 animate-fade-in text-[var(--text-main)]">
      {/* Header and intro */}
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-main)]">
          Informe de Convocatorias y Titularidades
        </h2>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1">
          Estadísticas detalladas de participación para {disciplineName} - {categoryName}
        </p>
      </div>

      {error ? (
        <div className="p-5 bg-red-500/10 border-2 border-red-550/20 text-red-500 rounded-3xl">
          <p className="text-xs font-bold uppercase tracking-wider">Error de carga</p>
          <p className="text-xs mt-1 font-medium">{error}</p>
        </div>
      ) : (
        <>
          {/* Bento highlight stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total partidos convocatorios */}
            <div className="bg-surface-card p-6 border-2 border-[var(--surface-border)] rounded-[2rem] flex flex-col justify-between group">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-1">
                  HISTORIAL DE PARTIDOS
                </p>
                <h3 className="text-2xl font-black italic tracking-tighter text-[var(--text-main)] uppercase">
                  {squads.length} Planillas
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-black uppercase text-[var(--text-muted)] mt-4">
                <Calendar size={14} className="text-primary-500" />
                <span>Rendimiento del Plantel</span>
              </div>
            </div>

            {/* Máxima presencia en convocatorias */}
            {mvpConvocatorias && mvpConvocatorias.convocatorias > 0 ? (
              <div className="bg-surface-card p-6 border-[3px] border-amber-500/30 rounded-[2rem] flex flex-col justify-between hover:shadow-xl hover:shadow-amber-500/2 transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 bg-amber-500/10 text-amber-500 rounded-bl-[1.5rem]">
                  <Flame size={16} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] text-amber-500 font-black tracking-widest uppercase mb-1 flex items-center gap-1">
                    MÁS CONVOCATORIAS
                  </p>
                  <h3 className="text-lg font-black truncate text-[var(--text-main)] uppercase leading-snug">
                    {mvpConvocatorias.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 mt-4">
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-550 text-[10px] font-black rounded uppercase">
                    {mvpConvocatorias.convocatorias} convocatorias
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-surface-card p-6 border-2 border-[var(--surface-border)] rounded-[2rem] flex flex-col justify-center text-[var(--text-muted)] items-center py-8">
                <p className="text-xs font-black uppercase tracking-widest">Sin convocatorias aún</p>
              </div>
            )}

            {/* Máxima titularidad */}
            {mvpTitularidades && mvpTitularidades.titularidades > 0 ? (
              <div className="bg-surface-card p-6 border-[3px] border-emerald-500/30 rounded-[2rem] flex flex-col justify-between hover:shadow-xl hover:shadow-emerald-500/2 transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 bg-emerald-500/10 text-emerald-500 rounded-bl-[1.5rem]">
                  <Award size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-500 font-black tracking-widest uppercase mb-1">
                    MÁS TITULARIDADES
                  </p>
                  <h3 className="text-lg font-black truncate text-[var(--text-main)] uppercase leading-snug">
                    {mvpTitularidades.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 mt-4">
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-555 text-[10px] font-black rounded uppercase">
                    {mvpTitularidades.titularidades} titularidades
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-surface-card p-6 border-2 border-[var(--surface-border)] rounded-[2rem] flex flex-col justify-center text-[var(--text-muted)] items-center py-8">
                <p className="text-xs font-black uppercase tracking-widest">Sin alineaciones aún</p>
              </div>
            )}
          </div>

          {/* Search bar & Sorting Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <input
                type="text"
                placeholder="Buscar jugador por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-card border border-[var(--surface-border)] hover:border-primary-500/30 focus:border-primary-500 rounded-2xl pl-11 pr-5 py-3 text-xs font-semibold text-[var(--text-main)] outline-none transition-all placeholder-[var(--text-muted)] shadow-sm"
              />
            </div>

            {/* Selector de ordenamiento */}
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider flex items-center gap-1 shrink-0">
                <ArrowUpDown size={12} /> Ordenar Por:
              </span>
              <div className="flex bg-surface-ground border border-[var(--surface-border)] rounded-xl p-1 shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setSortBy('convocatorias')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all ${
                    sortBy === 'convocatorias'
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Convocatorias
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('titularidades')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all ${
                    sortBy === 'titularidades'
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Titularidades
                </button>
              </div>
            </div>
          </div>

          {/* Report Data List */}
          {processedReport.length > 0 ? (
            <div className="bg-surface-card border-2 border-[var(--surface-border)] rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-ground/70 border-b border-[var(--surface-border)]">
                      <th className="p-6 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Jugador</th>
                      <th className="p-6 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Titularidades</th>
                      <th className="p-6 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Convocatorias</th>
                      <th className="p-6 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {processedReport.map((row) => {
                      // Stats computations
                      const matchCount = squads.length;
                      const callpercentage = matchCount > 0 
                        ? Math.round((row.convocatorias / matchCount) * 100) 
                        : 0;
                      
                      const startingpercentage = row.convocatorias > 0
                        ? Math.round((row.titularidades / row.convocatorias) * 100)
                        : 0;

                      return (
                        <tr 
                          key={row.id}
                          className="hover:bg-surface-hover/30 transition-colors"
                        >
                          {/* Jugador avatar details */}
                          <td className="p-6">
                            <div className="flex items-center gap-3.5">
                              <div className="w-7 h-7 rounded-lg bg-surface-ground font-black text-[10px] italic text-primary-600 border border-[var(--surface-border)] overflow-hidden shrink-0 flex items-center justify-center">
                                {row.photourl ? (
                                  <img src={row.photourl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span>{getInitials(row.name)}</span>
                                )}
                              </div>
                              <span className="text-xs font-black uppercase text-[var(--text-main)]">
                                {row.name}
                              </span>
                            </div>
                          </td>

                          {/* Titularidades Count */}
                          <td className="p-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`text-sm font-black italic ${row.titularidades > 0 ? 'text-emerald-500' : 'text-[var(--text-muted)] opacity-60'}`}>
                                {row.titularidades}
                              </span>
                              {row.convocatorias > 0 && (
                                <span className="text-[8px] font-bold text-[var(--text-muted)] tracking-wider mt-0.5">
                                  {startingpercentage}% de titular
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Convocatorias Count */}
                          <td className="p-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`text-sm font-black italic ${row.convocatorias > 0 ? 'text-amber-500' : 'text-[var(--text-muted)] opacity-60'}`}>
                                {row.convocatorias}
                              </span>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] tracking-wider mt-0.5">
                                / {matchCount} partidos
                              </span>
                            </div>
                          </td>

                          {/* Call rate visual indicator */}
                          <td className="p-6">
                            <div className="flex items-center gap-4 max-w-[200px] mx-auto justify-end">
                              <div className="flex-1 h-2 bg-surface-ground rounded-full overflow-hidden shrink-0">
                                <div 
                                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-1000"
                                  style={{ width: `${callpercentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-black text-primary-500 font-mono w-10 text-right">
                                {callpercentage}%
                              </span>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
              <User size={48} className="mx-auto text-[var(--text-muted)] mb-4 opacity-20" />
              <h3 className="text-xl font-black uppercase text-[var(--text-muted)] italic tracking-widest">
                No hay resultados para la búsqueda
              </h3>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mt-2">
                Intenta buscar con otros términos o registra convocatorias primero.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SquadReports;
