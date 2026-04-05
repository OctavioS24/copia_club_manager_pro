
import React, { useState, useMemo, useEffect } from 'react';
import { Player } from '../types';
import { Calendar as CalendarIcon, Save, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/supabase';

interface AsistenciaProps {
  players: Player[];
  clubConfig: any;
  forceSelectedDisc?: string;
}

import { useCategory } from '../context/useCategory';

const Asistencia: React.FC<AsistenciaProps> = ({ players: propPlayers, clubConfig: propClubConfig, forceSelectedDisc }) => {
  const { selectedDiscipline, selectedDivision } = useCategory();
  const [clubConfig, setClubConfig] = useState(propClubConfig || { disciplines: [] });
  const [players, setPlayers] = useState<Player[]>(propPlayers || []);
  const [selectedDisc, setSelectedDisc] = useState<string | null>(forceSelectedDisc || null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch club config and players if needed
  useEffect(() => {
    const fetchData = async () => {
      if (propPlayers && propClubConfig) return;

      setIsLoading(true);
      try {
        const [configRes, membersRes] = await Promise.all([
          db.config.get(),
          db.members.getAll()
        ]);

        if (configRes.data) {
          setClubConfig(configRes.data);
          if (!selectedDisc && !forceSelectedDisc) {
            const disc = configRes.data.disciplines.find((d: any) => d.id === selectedDiscipline);
            if (disc) setSelectedDisc(disc.name);
          }
        }

        if (membersRes.data && selectedDivision && selectedDiscipline) {
          const filtered = membersRes.data.filter((m: any) => 
            m.assignments?.some((a: any) => 
              a.discipline_id === selectedDiscipline && 
              a.category_id === selectedDivision &&
              a.role === 'PLAYER'
            )
          );
          setPlayers(filtered);
        }
      } catch (err) {
        console.error("Error fetching data for Asistencia:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [propPlayers, propClubConfig, selectedDiscipline, selectedDivision, forceSelectedDisc, selectedDisc]);

  // Cargar asistencia existente cuando cambia la fecha o disciplina
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!selectedDisc || !date) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await db.attendance.getByDate(date, selectedDisc);
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
  }, [date, selectedDisc]);

  const handleStatusToggle = (playerId: string) => {
    setAttendance(prev => {
      const current = prev[playerId] || 'A';
      return { ...prev, [playerId]: current === 'P' ? 'A' : 'P' };
    });
  };

  const handleSave = async () => {
      if (!selectedDisc) return;
      
      setIsSaving(true);
      try {
        const recordsToSave = players.map(p => ({
          player_id: p.id,
          date: date,
          status: attendance[p.id] || 'A',
          discipline: selectedDisc
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
        
        <div className="relative w-full md:w-auto md:min-w-[320px] group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-primary-600">
            <CalendarIcon size={20} />
          </div>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            className="w-full bg-white dark:bg-slate-900 p-4 pl-12 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 font-black text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer appearance-none"
          />
          <div className="mt-3 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            {formatDate(date)}
          </div>
        </div>
      </div>

      {/* SELECTOR DE DISCIPLINA (Si no es forzada) */}
      {!forceSelectedDisc && (
        <div className="flex gap-3 mb-10 overflow-x-auto pb-2 scrollbar-hide justify-center">
            {clubConfig.disciplines?.map((d: any) => (
                <button 
                  key={d.id} 
                  onClick={() => setSelectedDisc(d.name)} 
                  className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedDisc === d.name ? 'bg-primary-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-white/5'}`}
                >
                    {d.name}
                </button>
            ))}
        </div>
      )}

      {/* LISTADO VERTICAL */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden relative min-h-[300px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-primary-600 mb-4" size={40} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cargando registros...</p>
          </div>
        )}
        <div className="p-2 md:p-4">
            {sortedPlayers.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {sortedPlayers.map(p => {
                  const isPresent = attendance[p.id] === 'P';
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleStatusToggle(p.id)}
                      className="flex items-center gap-4 p-4 md:p-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                        {/* CHECKBOX PERSONALIZADO */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 ${isPresent ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-200 dark:border-white/10'}`}>
                          {isPresent && <CheckCircle2 size={18} className="text-white" />}
                        </div>

                        {/* INFO JUGADOR */}
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-base md:text-lg truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Dorsal: #{p.number} • {p.position}
                            </span>
                          </div>

                          {/* ESTADO ACTUAL */}
                          <div className="flex items-center gap-2 ml-4">
                            {isPresent ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                                <span className="text-[9px] font-black uppercase tracking-widest">Presente</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 rounded-full">
                                <span className="text-[9px] font-black uppercase tracking-widest">Ausente</span>
                              </div>
                            )}
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
            <div className="p-8 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 flex justify-center">
                <button 
                  onClick={handleSave} 
                  disabled={isSaving} 
                  className="w-full md:w-auto flex items-center justify-center gap-3 bg-slate-950 dark:bg-primary-600 text-white px-16 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl disabled:opacity-50"
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
