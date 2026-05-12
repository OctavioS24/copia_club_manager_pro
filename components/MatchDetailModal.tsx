
import React from 'react';
import { X, Trophy, Calendar, MapPin, Clock, AlertTriangle } from 'lucide-react';
import { Match } from '../types';

interface MatchDetailModalProps {
  match: Match;
  onClose: () => void;
}

const MatchDetailModal: React.FC<MatchDetailModalProps> = ({ match, onClose }) => {
  const isFinished = match.status === 'Finished';
  const events = match.events || [];
  
  // Sort events by minute
  const sortedEvents = [...events].sort((a, b) => (a.minute || 0) - (b.minute || 0));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-surface-card rounded-[2rem] border border-[var(--surface-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[85vh] flex flex-col">
        {/* Header Header */}
        <div className="p-4 md:p-5 border-b border-[var(--surface-border)] flex justify-between items-center bg-surface-ground shrink-0">
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-[var(--text-main)] leading-none">Ficha de Partido</h3>
            <p className="text-[8px] font-black text-primary-500 uppercase tracking-widest mt-1">Estadísticas del encuentro</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Marcador Central */}
          <div className="relative p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] bg-surface-ground border border-[var(--surface-border)] overflow-hidden">
            <div className="absolute inset-0 bg-primary-500/5" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center flex-1 order-2 md:order-1">
                <h4 className="text-sm md:text-lg font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-tight mb-1 break-words">
                  {match.hometeam}
                </h4>
                <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-surface-card px-2 py-0.5 rounded-full border border-[var(--surface-border)]">LOCAL</span>
              </div>

              <div className="flex flex-col items-center gap-2 order-1 md:order-2">
                <div className="bg-surface-card px-4 py-2 md:px-6 md:py-3 rounded-[1rem] md:rounded-[1.5rem] flex items-center gap-3 md:gap-5 text-2xl md:text-4xl font-black italic shadow-xl border-2 border-[var(--surface-border)]">
                  <span className={isFinished ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-20'}>
                    {isFinished ? match.homescore : '0'}
                  </span>
                  <div className="flex flex-col items-center gap-0.5 opacity-20">
                    <span className="text-[8px] text-primary-500 uppercase tracking-widest font-black">VS</span>
                  </div>
                  <span className={isFinished ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-20'}>
                    {isFinished ? match.awayscore : '0'}
                  </span>
                </div>
                
                <span className={`px-3 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest italic ${
                  isFinished ? 'bg-emerald-500 text-white' : 
                  match.status === 'Scheduled' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {isFinished ? 'Finalizado' : match.status}
                </span>
              </div>

              <div className="text-center flex-1 order-3">
                <h4 className="text-sm md:text-lg font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-tight mb-1 break-words">
                  {match.awayteam}
                </h4>
                <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-surface-card px-2 py-0.5 rounded-full border border-[var(--surface-border)]">VISITANTE</span>
              </div>
            </div>
          </div>

          {/* Info Básica */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-ground p-3 rounded-xl border border-[var(--surface-border)] flex items-center gap-3">
              <Calendar size={14} className="text-primary-500 shrink-0"/>
              <div className="min-w-0">
                <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Fecha</p>
                <p className="text-[10px] font-black text-[var(--text-main)] italic uppercase truncate">{match.date} {match.time && `• ${match.time}`}</p>
              </div>
            </div>
            <div className="bg-surface-ground p-3 rounded-xl border border-[var(--surface-border)] flex items-center gap-3">
              <MapPin size={14} className="text-emerald-500 shrink-0"/>
              <div className="min-w-0">
                <p className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest">Sede</p>
                <p className="text-[10px] font-black text-[var(--text-main)] italic uppercase truncate">{match.venue || 'No definida'}</p>
              </div>
            </div>
          </div>

          {/* Incidencias / Cronología */}
          {isFinished && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-primary-500" />
                <h5 className="text-base font-black uppercase italic tracking-tighter text-[var(--text-main)]">Cronología</h5>
              </div>

              {sortedEvents.length > 0 ? (
                <div className="space-y-2">
                  {sortedEvents.map((event, idx) => (
                    <div 
                      key={event.id || idx}
                      className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                        event.is_rival ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'
                      }`}
                    >
                      <span className="text-xs font-black italic text-[var(--text-main)] w-8 text-right shrink-0">{event.minute}'</span>
                      
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        event.type.includes('GOL') || event.type === 'GOAL' ? 'bg-emerald-500 text-white' : 
                        event.type.includes('AMARILLA') ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {event.type.includes('GOL') || event.type === 'GOAL' ? <Trophy size={12} /> : <AlertTriangle size={12} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black uppercase text-[var(--text-main)] italic truncate">{event.player_name || 'Desconocido'}</p>
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">{event.type} {event.is_rival ? '(Rival)' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-surface-ground rounded-2xl border-2 border-dashed border-[var(--surface-border)]">
                  <p className="text-[9px] font-black uppercase text-[var(--text-muted)] opacity-30 tracking-widest italic">Sin incidencias registradas</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 bg-surface-ground border-t border-[var(--surface-border)] flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-[var(--text-main)] text-surface-card rounded-xl font-black uppercase italic tracking-widest text-[9px] hover:translate-y-[-1px] transition-all shadow-lg"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchDetailModal;
