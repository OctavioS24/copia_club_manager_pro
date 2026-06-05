
import React, { useState, useMemo, useEffect } from 'react';
import { Player } from '../types';
import { Calendar as CalendarIcon, Save, Users, Loader2, CheckCircle2, X, DollarSign } from 'lucide-react';
import { db, supabase } from '../lib/supabase';

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
  
  // Rich attendance state tracking status, excuse type, and details
  const [attendance, setAttendance] = useState<Record<string, { status: string; excuse_type: string; excuse_detail: string; }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDisciplineName, setCurrentDisciplineName] = useState<string>('');

  // States for player debts and active commitments
  const [playerDebts, setPlayerDebts] = useState<Set<string>>(new Set());
  const [activeCommitments, setActiveCommitments] = useState<Set<string>>(new Set());
  const [expiredCommitments, setExpiredCommitments] = useState<Set<string>>(new Set());

  // Fetch club config, players, debts, and commitments
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDiscipline || !selectedDivision) return;
      setIsLoading(true);
      try {
        const [configRes, membersRes, debtsRes, commitmentsRes] = await Promise.all([
          db.config.get(),
          db.members.getAll(),
          db.fees.getAllDebts(),
          supabase.from('payment_commitments').select('member_id, commitment_date').eq('fulfilled', false)
        ]);

        if (debtsRes.data) {
          setPlayerDebts(new Set(debtsRes.data.map((d: any) => d.member_id)));
        }

        if (commitmentsRes.data) {
          const todayStr = new Date().toISOString().split('T')[0];
          const activeSet = new Set<string>();
          const expiredSet = new Set<string>();

          commitmentsRes.data.forEach((c: any) => {
            if (c.commitment_date < todayStr) {
              expiredSet.add(c.member_id);
            } else {
              activeSet.add(c.member_id);
            }
          });

          setActiveCommitments(activeSet);
          setExpiredCommitments(expiredSet);
        }

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

  // Cargar asistencia existente incluyendo justificaciones
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!currentDisciplineName || !date || !selectedDivision) return;
      
      setIsLoading(true);
      try {
        // Normalize discipline name for DB lookup
        const normalizedDisc = currentDisciplineName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const { data, error } = await db.attendance.getByDate(date, normalizedDisc, selectedDivision);
        if (error) throw error;
        
        console.log(`Asistencia - Fetched for Date: ${date}, Disc: ${normalizedDisc}, Cat: ${selectedDivision}:`, data);
        
        const records: Record<string, { status: string; excuse_type: string; excuse_detail: string; }> = {};
        data?.forEach((record: any) => {
          records[record.player_id] = {
            status: record.status || 'A',
            excuse_type: record.excuse_type || 'No justificado',
            excuse_detail: record.excuse_detail || ''
          };
        });
        setAttendance(records);
      } catch (err) {
        console.error("Error fetching attendance:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [date, currentDisciplineName, selectedDivision]);


  const handleSave = async () => {
      if (!currentDisciplineName) return;
      
      setIsSaving(true);
      try {
        // Normalize discipline name for DB save
        const normalizedDisc = currentDisciplineName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const recordsToSave = players.map(p => {
          const record = attendance[p.id] || { status: 'A', excuse_type: 'No justificado', excuse_detail: '' };
          return {
            player_id: p.id,
            date: date,
            status: record.status || 'A',
            discipline: normalizedDisc,
            category_id: selectedDivision || '',
            excuse_type: ['A', 'L'].includes(record.status) ? (record.excuse_type || 'No justificado') : null,
            excuse_detail: ['A', 'L'].includes(record.status) ? (record.excuse_detail || null) : null
          };
        });

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

  // Agrupamiento por situación de deuda:
  // Primer grupo: Jugadores con cuota vencida o compromiso de pago vencido
  // Segundo grupo: El resto de los jugadores (al día)
  // Dentro de cada grupo se ordena por apellido
  const playerGroups = useMemo(() => {
    const sortByName = (a: Player, b: Player) => {
      const getLastName = (fullName: string) => {
        const parts = fullName.trim().split(' ');
        return parts.length > 1 ? parts[parts.length - 1] : parts[0];
      };
      const nameA = getLastName(a.name).toLowerCase();
      const nameB = getLastName(b.name).toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return a.name.localeCompare(b.name);
    };

    const sortedAll = [...players].sort(sortByName);
    const adeudan: Player[] = [];
    const alDia: Player[] = [];

    sortedAll.forEach(p => {
      const hasDebt = playerDebts.has(p.id);
      const hasActiveCommitment = activeCommitments.has(p.id);

      if (hasDebt && !hasActiveCommitment) {
        adeudan.push(p);
      } else {
        alDia.push(p);
      }
    });

    return { adeudan, alDia };
  }, [players, playerDebts, activeCommitments]);

  const formatDate = (dateStr: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const d = new Date(dateStr + 'T12:00:00'); // Evitar problemas de zona horaria
    return d.toLocaleDateString('es-ES', options).replace(/^\w/, (c) => c.toUpperCase());
  };

  const getPlayerDebtStatus = (pId: string) => {
    const hasDebt = playerDebts.has(pId);
    const hasExpiredCommitment = expiredCommitments.has(pId);
    if (hasDebt && hasExpiredCommitment) {
      return "Deuda y compromiso vencido";
    }
    if (hasDebt) {
      return "Cuota pendiente";
    }
    return null;
  };

  const renderPlayerRow = (p: Player) => {
    const attRecord = attendance[p.id] || { status: 'A', excuse_type: 'No justificado', excuse_detail: '' };
    const status = attRecord.status;
    const debtReason = getPlayerDebtStatus(p.id);

    return (
      <div 
        key={p.id} 
        className="flex flex-col p-2.5 sm:p-4 md:p-6 hover:bg-surface-hover/50 transition-colors group border-b border-[var(--surface-border)] last:border-b-0"
      >
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* INDICADOR DE ESTADO */}
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center border transition-all shrink-0 ${
              status === 'P' ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' : 
              status === 'L' ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' :
              'bg-red-500 border-red-500 shadow-lg shadow-red-500/20'
            }`}>
              {status === 'P' && <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-white" />}
              {status === 'L' && <span className="text-white font-black text-[10px] md:text-xs">T</span>}
              {status === 'A' && <X className="w-4 h-4 md:w-5 md:h-5 text-white" />}
            </div>

            {/* INFO JUGADOR */}
            <div className="flex flex-col min-w-0">
              <span className="font-black text-slate-800 dark:text-white uppercase tracking-tighter text-xs sm:text-sm md:text-lg leading-tight truncate">
                {p.name}
              </span>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  #{p.number || 'S/N'} • {p.position || 'SIN POSICIÓN'}
                </span>
                {debtReason && (
                  <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[7px] md:text-[8px] font-black uppercase tracking-wider animate-pulse" title={debtReason}>
                    <DollarSign size={8} strokeWidth={4} />
                    <span className="hidden sm:inline">{debtReason}</span>
                    <span className="sm:hidden">DEUDA</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* COMPACT BUTTONS COMPLIANT WITH USER SPECIFICATIONS */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* PRESENTE Button */}
            <button
              type="button"
              onClick={() => {
                setAttendance(prev => {
                  const currentRecord = prev[p.id] || { status: 'A', excuse_type: 'No justificado', excuse_detail: '' };
                  return {
                    ...prev,
                    [p.id]: {
                      ...currentRecord,
                      status: 'P'
                    }
                  };
                });
              }}
              className={`px-2 sm:px-3 py-1.5 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all h-[28px] md:h-[38px] flex items-center justify-center shrink-0 border ${
                status === 'P'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-emerald-500/5 text-emerald-500/70 dark:text-emerald-400/80 border-emerald-500/10 hover:bg-emerald-500/10'
              }`}
            >
              <span className="hidden sm:inline">PRESENTE</span>
              <span className="sm:hidden w-3.5 text-center text-[11px]">P</span>
            </button>

            {/* TARDANZA Button */}
            <button
              type="button"
              onClick={() => {
                setAttendance(prev => {
                  const currentRecord = prev[p.id] || { status: 'A', excuse_type: 'No justificado', excuse_detail: '' };
                  return {
                    ...prev,
                    [p.id]: {
                      ...currentRecord,
                      status: 'L'
                    }
                  };
                });
              }}
              className={`px-2 sm:px-3 py-1.5 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all h-[28px] md:h-[38px] flex items-center justify-center shrink-0 border ${
                status === 'L'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-amber-500/5 text-amber-500/70 dark:text-amber-400/80 border-amber-500/10 hover:bg-amber-500/10'
              }`}
            >
              <span className="hidden sm:inline">TARDANZA</span>
              <span className="sm:hidden w-3.5 text-center text-[11px]">T</span>
            </button>

            {/* AUSENTE Button */}
            <button
              type="button"
              onClick={() => {
                setAttendance(prev => {
                  const currentRecord = prev[p.id] || { status: 'A', excuse_type: 'No justificado', excuse_detail: '' };
                  return {
                    ...prev,
                    [p.id]: {
                      ...currentRecord,
                      status: 'A'
                    }
                  };
                });
              }}
              className={`px-2 sm:px-3 py-1.5 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all h-[28px] md:h-[38px] flex items-center justify-center shrink-0 border ${
                status === 'A'
                  ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20'
                  : 'bg-red-500/5 text-red-500/70 dark:text-red-400/80 border-red-500/10 hover:bg-red-500/10'
              }`}
            >
              <span className="hidden sm:inline">AUSENTE</span>
              <span className="sm:hidden w-3.5 text-center text-[11px]">A</span>
            </button>
          </div>
        </div>

        {/* Detalle de ausencias y tardanzas (Tipo y Detalle libre) */}
        {['A', 'L'].includes(status) && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-500/5 border border-[var(--surface-border)] grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-1 duration-200">
            <div>
              <label className="block text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest mb-1.5">
                Tipo de Falta
              </label>
              <select
                value={attRecord.excuse_type || 'No justificado'}
                onChange={(e) => {
                  const val = e.target.value;
                  setAttendance(prev => {
                    const currentRecord = prev[p.id] || { status: 'A', excuse_type: 'No justificado', excuse_detail: '' };
                    return {
                      ...prev,
                      [p.id]: {
                        ...currentRecord,
                        excuse_type: val
                      }
                    };
                  });
                }}
                className="w-full px-3 py-2 bg-surface-card border-2 border-[var(--surface-border)] rounded-xl text-xs font-bold text-[var(--text-main)] outline-none focus:border-primary-500 transition-colors"
              >
                <option value="No justificado">No justificado</option>
                <option value="Justificado">Justificado</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest mb-1.5">
                Detalle / Motivo de ausencia o tardanza
              </label>
              <input
                type="text"
                placeholder="Ej: Avisó por WhatsApp que está con fiebre, examen..."
                value={attRecord.excuse_detail || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setAttendance(prev => {
                    const currentRecord = prev[p.id] || { status: 'A', excuse_type: 'No justificado', excuse_detail: '' };
                    return {
                      ...prev,
                      [p.id]: {
                        ...currentRecord,
                        excuse_detail: val
                      }
                    };
                  });
                }}
                className="w-full px-4 py-2 bg-surface-card border-2 border-[var(--surface-border)] rounded-xl text-xs font-semibold text-[var(--text-main)] placeholder-slate-400 outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalPlayers = players.length;

  return (
    <div className="w-full max-w-4xl mx-auto px-0 sm:px-4 md:px-10 py-4 md:py-10">
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

      {/* LISTADO VERTICAL */}
      <div className="bg-surface-card rounded-none sm:rounded-[2.5rem] shadow-2xl border-x-0 sm:border border-[var(--surface-border)] overflow-hidden relative min-h-[300px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-[var(--primary-500)] mb-4" size={40} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cargando registros...</p>
          </div>
        )}
        <div className="p-2 sm:p-4 md:p-8">
            {totalPlayers > 0 ? (
              <div className="space-y-8">
                {/* Primer Grupo: Jugadores que Adeudan */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-orange-500/20 pb-3">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase text-orange-500 tracking-[0.2em] italic">
                      Adeudan ({playerGroups.adeudan.length})
                    </h3>
                  </div>
                  {playerGroups.adeudan.length > 0 ? (
                    <div className="border border-orange-500/10 rounded-3xl bg-orange-500/[0.02] divide-y divide-[var(--surface-border)] overflow-hidden">
                      {playerGroups.adeudan.map(renderPlayerRow)}
                    </div>
                  ) : (
                    <div className="p-6 bg-emerald-500/5 text-emerald-500 rounded-2xl border border-dashed border-emerald-500/10 text-center text-xs font-bold uppercase tracking-wider italic">
                      ¡Todos los jugadores están al día con sus pagos! 🎉
                    </div>
                  )}
                </div>

                {/* Segundo Grupo: Jugadores Al Día */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-[var(--surface-border)] pb-3">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-black uppercase text-emerald-500 tracking-[0.2em] italic">
                      Al Día ({playerGroups.alDia.length})
                    </h3>
                  </div>
                  {playerGroups.alDia.length > 0 ? (
                    <div className="border border-[var(--surface-border)] rounded-3xl divide-y divide-[var(--surface-border)] overflow-hidden">
                      {playerGroups.alDia.map(renderPlayerRow)}
                    </div>
                  ) : (
                    <div className="p-6 bg-surface-ground rounded-2xl border border-dashed border-[var(--surface-border)] text-center text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider italic">
                      No hay jugadores sin deudas pendientes.
                    </div>
                  )}
                </div>
              </div>
            ) : (
                <div className="py-24 text-center opacity-30">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No hay atletas en esta lista</p>
                </div>
            )}
        </div>

        {/* BOTON GUARDAR */}
        {totalPlayers > 0 && (
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
