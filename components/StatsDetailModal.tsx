import React, { useMemo } from 'react';
import { X, Award, User, Trophy } from 'lucide-react';
import { Match } from '../types';

export type StatsDetailType = 'Goles' | 'Goles a Favor' | 'Amarillas' | 'Rojas' | 'Goles en Contra' | 'Diferencia de Goles';

interface StatsDetailModalProps {
  type: StatsDetailType;
  matches: Match[];
  onClose: () => void;
  teamName?: string;
  goalsFor?: number;
  goalsConceded?: number;
}

const StatsDetailModal: React.FC<StatsDetailModalProps> = ({ 
  type, 
  matches, 
  onClose, 
  teamName = 'Mi Equipo',
  goalsFor: propGoalsFor,
  goalsConceded: propGoalsConceded
}) => {
  const isGoalForType = type === 'Goles' || type === 'Goles a Favor';

  // Calculate match differences and totals from matches
  const { totalGF, totalGC, totalDG, matchDifferences } = useMemo(() => {
    const finishedMatches = matches.filter(m => m.status === 'Finished');

    const diffs = finishedMatches
      .map(m => {
        const isHome = (m.hometeam || m.home_team) === teamName;
        const rival = isHome ? (m.awayteam || m.away_team || 'Rival') : (m.hometeam || m.home_team || 'Rival');
        const scored = isHome ? (m.homescore ?? m.home_score ?? 0) : (m.awayscore ?? m.away_score ?? 0);
        const conceded = isHome ? (m.awayscore ?? m.away_score ?? 0) : (m.homescore ?? m.home_score ?? 0);
        const diff = scored - conceded;

        return {
          id: m.id,
          rival,
          date: m.date,
          isHome,
          scored,
          conceded,
          diff,
          scoreLabel: `${scored} - ${conceded}`
        };
      })
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

    const computedGF = diffs.reduce((sum, item) => sum + item.scored, 0);
    const computedGC = diffs.reduce((sum, item) => sum + item.conceded, 0);

    const finalGF = propGoalsFor !== undefined ? propGoalsFor : computedGF;
    const finalGC = propGoalsConceded !== undefined ? propGoalsConceded : computedGC;

    return {
      totalGF: finalGF,
      totalGC: finalGC,
      totalDG: finalGF - finalGC,
      matchDifferences: diffs
    };
  }, [matches, teamName, propGoalsFor, propGoalsConceded]);

  // Player stats breakdown
  const stats = useMemo(() => {
    if (type === 'Goles en Contra') {
      // For goals conceded, group by rival match
      return matches
        .filter(m => m.status === 'Finished')
        .map(m => {
          const isHome = (m.hometeam || m.home_team) === teamName;
          const rival = isHome ? (m.awayteam || m.away_team || 'Rival') : (m.hometeam || m.home_team || 'Rival');
          const conceded = isHome ? (m.awayscore ?? m.away_score ?? 0) : (m.homescore ?? m.home_score ?? 0);
          return {
            name: `vs. ${rival} (${m.date ? new Date(m.date).toLocaleDateString() : 'S/F'})`,
            count: conceded,
            extra: isHome ? 'Local' : 'Visitante'
          };
        })
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);
    }

    if (type === 'Diferencia de Goles') {
      return [];
    }

    const playerStats: Record<string, { name: string; count: number; extra?: string }> = {};
    
    matches.forEach(m => {
      if (m.status !== 'Finished' || !m.events) return;
      
      m.events.forEach(e => {
        const etype = (e.type || '').toUpperCase();
        let isMatch = false;
        
        if (isGoalForType && (etype === 'GOL' || etype === 'GOAL' || etype.includes('GOL'))) isMatch = true;
        if (type === 'Amarillas' && (etype === 'TARJETA AMARILLA' || etype === 'T. AMARILLA' || etype.includes('AMARILL'))) isMatch = true;
        if (type === 'Rojas' && (etype === 'TARJETA ROJA' || etype === 'T. ROJA' || etype.includes('ROJA'))) isMatch = true;
        
        if (isMatch && e.player_name && !e.is_rival) {
          const playerName = e.player_name;
          if (!playerStats[playerName]) {
            playerStats[playerName] = { name: playerName, count: 0 };
          }
          playerStats[playerName].count += 1;
        }
      });
    });
    
    return Object.values(playerStats).sort((a, b) => b.count - a.count);
  }, [matches, type, isGoalForType, teamName]);

  const colorClass = isGoalForType 
    ? 'text-emerald-500' 
    : type === 'Amarillas' 
    ? 'text-amber-500' 
    : type === 'Goles en Contra' 
    ? 'text-rose-500' 
    : type === 'Diferencia de Goles'
    ? totalDG > 0 ? 'text-emerald-500' : totalDG < 0 ? 'text-rose-500' : 'text-slate-400'
    : 'text-red-500';

  const bgClass = isGoalForType 
    ? 'bg-emerald-500/10' 
    : type === 'Amarillas' 
    ? 'bg-amber-500/10' 
    : type === 'Goles en Contra' 
    ? 'bg-rose-500/10' 
    : type === 'Diferencia de Goles'
    ? totalDG > 0 ? 'bg-emerald-500/10' : totalDG < 0 ? 'bg-rose-500/10' : 'bg-slate-500/10'
    : 'bg-red-500/10';

  const titleLabel = isGoalForType
    ? 'Goles a Favor'
    : type === 'Goles en Contra'
    ? 'Goles en Contra'
    : type === 'Diferencia de Goles'
    ? 'Diferencia de Goles'
    : type === 'Amarillas'
    ? 'Tarjetas Amarillas'
    : 'Tarjetas Rojas';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-surface-card rounded-[2rem] border border-[var(--surface-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-[var(--surface-border)] flex justify-between items-center bg-surface-ground shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${bgClass} ${colorClass}`}>
                {type === 'Diferencia de Goles' ? 'Balance General' : 'Estadísticas del Plantel'}
              </span>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-[var(--text-main)] leading-none mt-1">
              Resumen de {titleLabel}
            </h3>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
              {isGoalForType ? 'Goleadores y detalle por jugador' : 'Estadísticas acumuladas en el torneo'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 md:p-5 space-y-4">
          {/* Diferencia de Goles View */}
          {type === 'Diferencia de Goles' ? (
            <div className="space-y-4">
              {/* Balance Summary Header */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-ground p-3.5 rounded-2xl border border-[var(--surface-border)] text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Goles a Favor</p>
                  <h4 className="text-xl font-black text-emerald-500 mt-1">{totalGF}</h4>
                </div>
                <div className="bg-surface-ground p-3.5 rounded-2xl border border-[var(--surface-border)] text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Goles en Contra</p>
                  <h4 className="text-xl font-black text-rose-500 mt-1">{totalGC}</h4>
                </div>
                <div className={`p-3.5 rounded-2xl border text-center ${totalDG > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : totalDG < 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-surface-ground border-[var(--surface-border)]'}`}>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Diferencia</p>
                  <h4 className={`text-xl font-black mt-1 ${totalDG > 0 ? 'text-emerald-500' : totalDG < 0 ? 'text-rose-500' : 'text-[var(--text-main)]'}`}>
                    {totalDG > 0 ? `+${totalDG}` : totalDG}
                  </h4>
                </div>
              </div>

              {/* Match By Match List */}
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] px-1">
                  Detalle por Partido ({matchDifferences.length} jugados)
                </p>
                {matchDifferences.length > 0 ? (
                  matchDifferences.map((m) => (
                    <div 
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-surface-ground rounded-2xl border border-[var(--surface-border)] hover:border-primary-500/30 transition-all"
                    >
                      <div className="min-w-0">
                        <h4 className="font-black text-xs uppercase italic tracking-tight text-[var(--text-main)] truncate">
                          vs. {m.rival}
                        </h4>
                        <div className="flex items-center gap-2 text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                          <span>{m.isHome ? 'Local' : 'Visitante'}</span>
                          <span>•</span>
                          <span>{m.date ? new Date(m.date).toLocaleDateString() : 'S/F'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-[var(--text-main)] px-2.5 py-1 bg-surface-card rounded-lg border border-[var(--surface-border)]">
                          {m.scoreLabel}
                        </span>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${
                          m.diff > 0 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : m.diff < 0 
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          {m.diff > 0 ? `+${m.diff}` : m.diff}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center bg-surface-ground rounded-2xl border-2 border-dashed border-[var(--surface-border)]">
                    <p className="text-[8px] font-black uppercase text-[var(--text-muted)] opacity-40 tracking-widest">
                      Sin partidos disputados aún
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Players List View */
            <div className="space-y-3">
              {/* Summary Pill for Goals */}
              {isGoalForType && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Total Goles a Favor del Plantel
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{totalGF}</span>
                </div>
              )}

              {stats.length > 0 ? (
                <div className="space-y-2">
                  {stats.map((player, idx) => (
                    <div 
                      key={player.name}
                      className="flex items-center justify-between p-3 bg-surface-ground rounded-2xl border border-[var(--surface-border)] hover:border-primary-500/30 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-surface-card border border-[var(--surface-border)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-primary-500 transition-colors shadow-sm">
                            <User size={18} />
                          </div>
                          {idx === 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-black text-[8px] flex items-center justify-center shadow-lg">
                              1º
                            </div>
                          )}
                          {idx === 1 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-300 text-slate-950 font-black text-[8px] flex items-center justify-center shadow-lg">
                              2º
                            </div>
                          )}
                          {idx === 2 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-700 text-white font-black text-[8px] flex items-center justify-center shadow-lg">
                              3º
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm uppercase italic tracking-tighter text-[var(--text-main)] leading-none mb-1 truncate">
                            {player.name}
                          </h4>
                          <div className="flex items-center gap-1">
                            <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest italic opacity-60">
                              {player.extra || `Posición #${idx + 1}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl ${bgClass} ${colorClass} border border-white/10 shadow-lg shrink-0`}>
                        <span className="text-lg font-black italic leading-none">{player.count}</span>
                        <span className="text-[5px] font-black uppercase tracking-widest">
                          {isGoalForType ? 'GOL' : type === 'Goles en Contra' ? 'GC' : 'TARJ'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center bg-surface-ground rounded-2xl border-2 border-dashed border-[var(--surface-border)]">
                  <Award size={32} className="mx-auto text-[var(--text-muted)] opacity-20 mb-3" />
                  <p className="text-[8px] font-black uppercase text-[var(--text-muted)] opacity-30 tracking-widest italic">
                    {isGoalForType ? 'No se han registrado goles de jugadores en este torneo' : 'Sin datos acumulados'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 md:p-5 bg-surface-ground border-t border-[var(--surface-border)] flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[var(--text-main)] text-surface-card rounded-xl font-black uppercase italic tracking-widest text-[8px] hover:translate-y-[-1px] transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsDetailModal;

