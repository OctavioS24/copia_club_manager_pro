
import React, { useState, useMemo, useEffect } from 'react';
import { Player } from '../types';
import { Calendar as CalendarIcon, Save, Users, Loader2, CheckCircle2, X } from 'lucide-react';
import { db } from '../lib/supabase';

interface AsistenciaProps {
  players: Player[];
  forceSelectedDisc?: string;
}

import { useCategory } from '../context/useCategory';
import { getPlayersByCategory } from '../lib/playerUtils';

const Asistencia: React.FC<AsistenciaProps> = ({ players: propPlayers }) => {
  const { selectedDiscipline, selectedDivision, selectedGender } = useCategory();
  const [players, setPlayers] = useState<Player[]>(propPlayers || []);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDisciplineName, setCurrentDisciplineName] = useState<string>('');

  // Fetch club config and players
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDiscipline || !selectedDivision) return;
      setIsLoading(true);
      try {
        const [configRes, membersRes] = await Promise.all([
          db.config.get(),
          db.members.getAll()
        ]);

        let discName = '';
        let categoryName = '';
        if (configRes.data) {
          const disc = configRes.data.disciplines.find((d: any) => d.id === selectedDiscipline);
          if (disc) {
            discName = disc.name;
            setCurrentDisciplineName(disc.name);
            
            // Find category name
            const branch = disc.branches.find((b: any) => b.categories.some((c: any) => c.id === selectedDivision));
            const cat = branch?.categories.find((c: any) => c.id === selectedDivision);
            if (cat) categoryName = cat.name;
          }
        }

        if (membersRes.data) {
          const filtered = getPlayersByCategory(
            membersRes.data,
            discName,
            selectedGender || '',
            categoryName,
            selectedDiscipline,
            selectedDivision
          );
          setPlayers(filtered as any);
        }
      } catch (err) {
        console.error("Error fetching data for Asistencia:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedDiscipline, selectedDivision, selectedGender]);

  // Cargar asistencia existente
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!currentDisciplineName || !date) return;
      
      setIsLoading(true);
      try {
        // Normalize discipline name for DB lookup
        const normalizedDisc = currentDisciplineName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const { data, error } = await db.attendance.getByDate(date, normalizedDisc);
        if (error) throw error;
        
        const records: Record<string, string> = {};
        data?.forEach((record: any) => {
          records[record.player_id] = record.status;
        });
        setAttendance(records);
      } catch (err) {
        console.error("Error fetching attendance:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [date, currentDisciplineName]);


  const handleSave = async () => {
      if (!currentDisciplineName) return;
      
      setIsSaving(true);
      try {
        // Normalize discipline name for DB save
        const normalizedDisc = currentDisciplineName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const recordsToSave = players.map(p => ({
          player_id: p.id,
          date: date,
          status: attendance[p.id] || 'A',
          discipline: normalizedDisc
        }));

        const { error } = await db.attendance.upsert(recordsToSave);
        if (error) throw error;
        
        alert("Planilla de asistencia guardada correctamente.");
      } catch (err) {
        console.error("Error saving attendance:", err);
        alert("Error al guardar la planilla.");
      } finally {
        setIsSaving(false);
      }
  };

  // Ordenar jugadores por apellido (asumiendo que el apellido es la última palabra o el formato es Apellido Nombre)
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const getLastName = (fullName: string) => {
        const parts = fullName.trim().split(' ');
        return parts.length > 1 ? parts[parts.length - 1] : parts[0];
      };
      const nameA = getLastName(a.name).toLowerCase();
      const nameB = getLastName(b.name).toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [players]);

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const d = new Date(dateStr + 'T12:00:00'); // Evitar problemas de zona horaria
    return d.toLocaleDateString('es-ES', options).replace(/^\w/, (c) => c.toUpperCase());
  };

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto">
      {/* HEADER CON TITULO Y SELECTOR DE FECHA */}
      <div className="flex flex-col items-center mb-12 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic mb-8">
          Asistencia
        </h2>
        
        <div className="relative group w-full max-w-sm mx-auto">
          <div className="absolute inset-0 bg-primary-500/5 rounded-[2.5rem] blur-2xl group-hover:bg-primary-500/10 transition-all"></div>
          <div className="relative bg-surface-card border-2 border-[var(--surface-border)] rounded-[2.2rem] p-3 md:p-4 flex items-center gap-4 shadow-2xl group-hover:border-primary-500/30 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500 shrink-0 shadow-inner">
              <CalendarIcon size={28} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] mb-1 italic">Fecha de Sesión</p>
              <div className="relative">
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="bg-transparent border-none p-0 font-black text-xl md:text-2xl text-[var(--text-main)] outline-none cursor-pointer w-full uppercase italic tracking-tighter"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-primary-500/20" />
            <p className="text-[9px] md:text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] italic">
              {formatDate(date)}
            </p>
            <div className="h-px w-8 bg-primary-500/20" />
          </div>
        </div>
      </div>

      {/* SELECTOR DE DISCIPLINA REMOVIDO POR SOLICITUD - SE USA LA DEL CONTEXTO */}

      {/* LISTADO VERTICAL */}
      <div className="bg-surface-card rounded-[2.5rem] shadow-2xl border border-[var(--surface-border)] overflow-hidden relative min-h-[300px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-[var(--primary-500)] mb-4" size={40} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cargando registros...</p>
          </div>
        )}
        <div className="p-2 md:p-4">
            {sortedPlayers.length > 0 ? (
              <div className="divide-y divide-[var(--surface-border)]">
                {sortedPlayers.map(p => {
                  const status = attendance[p.id] || 'A';
                  return (
                    <div 
                      key={p.id} 
                      className="flex items-center gap-3 p-4 md:p-6 hover:bg-surface-hover transition-colors group"
                    >
                        {/* INDICADOR DE ESTADO */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 ${
                          status === 'P' ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' : 
                          status === 'L' ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' :
                          'bg-red-500 border-red-500 shadow-lg shadow-red-500/20'
                        }`}>
                          {status === 'P' && <CheckCircle2 size={20} className="text-white" />}
                          {status === 'L' && <span className="text-white font-black text-xs">T</span>}
                          {status === 'A' && <X size={20} className="text-white" />}
                        </div>

                        {/* INFO JUGADOR */}
                        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between min-w-0 gap-4">
                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-sm md:text-lg leading-tight break-words">
                              {p.name}
                            </span>
                            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              #{p.number} • {p.position}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={status}
                              onChange={(e) => {
                                setAttendance(prev => ({ ...prev, [p.id]: e.target.value }));
                              }}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all outline-none cursor-pointer ${
                                status === 'P' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                status === 'L' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}
                            >
                              <option value="A" className="bg-white text-slate-800">AUSENTE</option>
                              <option value="P" className="bg-white text-slate-800">PRESENTE</option>
                              <option value="L" className="bg-white text-slate-800">TARDANZA</option>
                            </select>
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            ) : (
                <div className="py-24 text-center opacity-30">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No hay atletas en esta lista</p>
                </div>
            )}
        </div>

        {/* BOTON GUARDAR */}
        {players.length > 0 && (
            <div className="p-8 bg-surface-ground border-t border-[var(--surface-border)] flex justify-center">
                <button 
                  onClick={handleSave} 
                  disabled={isSaving} 
                  className="w-full md:w-auto flex items-center justify-center gap-3 bg-[var(--primary-500)] text-primary-contrast px-16 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl disabled:opacity-50"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Confirmar Planilla
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Asistencia;
