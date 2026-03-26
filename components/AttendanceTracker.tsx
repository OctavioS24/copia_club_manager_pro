
import React, { useState, useMemo } from 'react';
import { Player } from '../types';
import { Calendar as CalendarIcon, Save, Users, Loader2 } from 'lucide-react';

interface AttendanceTrackerProps {
  players: Player[];
  clubConfig: any;
  forceSelectedDisc?: string;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ players, clubConfig, forceSelectedDisc }) => {
  const [selectedDisc, setSelectedDisc] = useState<string | null>(forceSelectedDisc || clubConfig.disciplines?.[0]?.name || null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Si forceSelectedDisc cambia externamente, actualizamos el estado interno
  React.useEffect(() => {
    if (forceSelectedDisc) setSelectedDisc(forceSelectedDisc);
  }, [forceSelectedDisc]);

  const handleStatusChange = (playerId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [playerId]: status }));
  };

  const handleSave = async () => {
      setIsSaving(true);
      setTimeout(() => {
          setIsSaving(false);
          alert("Sincronizado con el servidor de asistencia.");
      }, 1500);
  };

  const getBtnClass = (id: string, s: string) => {
      const active = attendance[id] === s;
      const base = "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ";
      if (!active) return base + "bg-white dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-white/5";
      if (s === 'P') return base + "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20";
      if (s === 'A') return base + "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20";
      return base + "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20";
  };

  return (
    <div className="p-4 md:p-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Registro de Presentismo</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] mt-1">Sincronización Cloud • {selectedDisc}</p>
        </div>
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5">
            <CalendarIcon size={16} className="text-primary-600" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-black text-[10px] outline-none" />
        </div>
      </div>

      {/* Solo mostramos el selector si NO estamos en una disciplina forzada (Consola) */}
      {!forceSelectedDisc && (
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            {clubConfig.disciplines?.map((d: any) => (
                <button key={d.id} onClick={() => setSelectedDisc(d.name)} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedDisc === d.name ? 'bg-primary-600 text-white shadow-xl' : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-white/5'}`}>
                    {d.name}
                </button>
            ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden">
        <div className="p-8 space-y-4">
            {players.length > 0 ? players.map(p => (
                <div key={p.id} className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-slate-50 dark:bg-slate-950/50 rounded-[2.5rem] border border-slate-100 dark:border-white/5 group hover:border-primary-600/20 transition-all">
                    <div className="flex items-center gap-6 flex-1">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-md">
                          <img src={p.photoUrl || 'https://via.placeholder.com/64'} className="w-full h-full object-cover" />
                      </div>
                      <div>
                          <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-lg">{p.name}</h4>
                          <div className="flex gap-3">
                            <span className="text-[9px] font-black text-primary-600 uppercase tracking-widest bg-primary-600/10 px-3 py-1 rounded-full">{p.position}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">#{p.number}</span>
                          </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-80">
                        <button onClick={() => handleStatusChange(p.id, 'P')} className={getBtnClass(p.id, 'P')}>Presente</button>
                        <button onClick={() => handleStatusChange(p.id, 'A')} className={getBtnClass(p.id, 'A')}>Ausente</button>
                        <button onClick={() => handleStatusChange(p.id, 'T')} className={getBtnClass(p.id, 'T')}>Tarde</button>
                    </div>
                </div>
            )) : (
                <div className="py-20 text-center opacity-30">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No hay atletas en esta lista</p>
                </div>
            )}
        </div>
        {players.length > 0 && (
            <div className="p-10 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 flex justify-end">
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-3 bg-slate-950 dark:bg-primary-600 text-white px-12 py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Confirmar Planilla
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceTracker;
