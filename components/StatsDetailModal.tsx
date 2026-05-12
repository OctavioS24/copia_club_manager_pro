import React, { useMemo } from 'react';
import { X, Award, User } from 'lucide-react';
import { Match } from '../types';

interface StatsDetailModalProps {
  type: 'Goles' | 'Amarillas' | 'Rojas';
  matches: Match[];
  onClose: () => void;
}

const StatsDetailModal: React.FC<StatsDetailModalProps> = ({ type, matches, onClose }) => {
  const stats = useMemo(() => {
    const playerStats: Record<string, { name: string; count: number }> = {};
    
    matches.forEach(m => {
      if (m.status !== 'Finished' || !m.events) return;
      
      m.events.forEach(e => {
        const etype = e.type.toUpperCase();
        let match = false;
        
        if (type === 'Goles' && (etype === 'GOL' || etype === 'GOAL')) match = true;
        if (type === 'Amarillas' && (etype === 'TARJETA AMARILLA' || etype === 'T. AMARILLA')) match = true;
        if (type === 'Rojas' && (etype === 'TARJETA ROJA' || etype === 'T. ROJA')) match = true;
        
        if (match && e.player_name && !e.is_rival) {
          const playerName = e.player_name;
          if (!playerStats[playerName]) {
            playerStats[playerName] = { name: playerName, count: 0 };
          }
          playerStats[playerName].count += 1;
        }
      });
    });
    
    return Object.values(playerStats).sort((a, b) => b.count - a.count);
  }, [matches, type]);

  const colorClass = type === 'Goles' ? 'text-primary-500' : type === 'Amarillas' ? 'text-amber-500' : 'text-red-500';
  const bgClass = type === 'Goles' ? 'bg-primary-500/10' : type === 'Amarillas' ? 'bg-amber-500/10' : 'bg-red-500/10';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-surface-card rounded-[2rem] border border-[var(--surface-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-[var(--surface-border)] flex justify-between items-center bg-surface-ground shrink-0">
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-[var(--text-main)] leading-none">Resumen de {type}</h3>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">Estadísticas acumuladas</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 md:p-5 space-y-3">
          {stats.length > 0 ? (
            <div className="space-y-2">
              {stats.map((player, idx) => (
                <div 
                  key={player.name}
                  className="flex items-center justify-between p-3 bg-surface-ground rounded-2xl border border-[var(--surface-border)] hover:border-primary-500/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-surface-card border border-[var(--surface-border)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-primary-500 transition-colors shadow-sm">
                        <User size={18} />
                      </div>
                      {idx < 3 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg">
                          <Award size={8} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-sm uppercase italic tracking-tighter text-[var(--text-main)] leading-none mb-1 truncate">{player.name}</h4>
                      <div className="flex items-center gap-1">
                        <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest italic opacity-40">Posición #{idx + 1}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl ${bgClass} ${colorClass} border border-white/10 shadow-lg shrink-0`}>
                    <span className="text-lg font-black italic leading-none">{player.count}</span>
                    <span className="text-[5px] font-black uppercase tracking-widest">{type === 'Goles' ? 'GOL' : 'TARJ'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center bg-surface-ground rounded-2xl border-2 border-dashed border-[var(--surface-border)]">
              <Award size={32} className="mx-auto text-[var(--text-muted)] opacity-20 mb-3" />
              <p className="text-[8px] font-black uppercase text-[var(--text-muted)] opacity-30 tracking-widest italic">Sin datos acumulados</p>
            </div>
          )}
        </div>

        <div className="p-4 md:p-5 bg-surface-ground border-t border-[var(--surface-border)] flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[var(--text-main)] text-surface-card rounded-xl font-black uppercase italic tracking-widest text-[8px] hover:translate-y-[-1px] transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsDetailModal;
