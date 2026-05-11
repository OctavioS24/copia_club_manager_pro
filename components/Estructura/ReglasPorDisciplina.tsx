import React, { useState, useEffect } from 'react';
import { 
  Trophy, Plus, Trash2, Save, CheckCircle, Loader2, 
  BarChart3, Target, Settings2, Info, ChevronDown,
  Goal, Square, AlertTriangle, Activity, Star
} from 'lucide-react';
import { Discipline } from '../../types';
import { 
  getDisciplineConfig, 
  saveDisciplineConfig, 
  DisciplineConfig, 
  DEFAULT_CONFIGS,
  EventType
} from '../../lib/disciplineConfig';

interface ReglasPorDisciplinaProps {
  disciplines: Discipline[];
}

const STATS_OPTIONS = [
  { key: 'PUNTOS_ACUMULADOS', label: 'Puntos Acumulados' },
  { key: 'PARTIDOS_JUGADOS', label: 'Partidos Jugados' },
  { key: 'RACHA_ACTUAL', label: 'Racha Actual' },
  { key: 'GOLES_TOTALES', label: 'Goles Totales' },
  { key: 'TARJETAS_AMARILLAS', label: 'Tarjetas Amarillas' },
  { key: 'TARJETAS_ROJAS', label: 'Tarjetas Rojas' },
  { key: 'FALTAS_TOTALES', label: 'Faltas Totales' },
  { key: 'PUNTOS_TOTALES', label: 'Puntos Totales' },
  { key: 'ENSAYOS', label: 'Ensayos' },
  { key: 'ASISTENCIAS', label: 'Asistencias' },
  { key: 'REBOTES', label: 'Rebotes' },
  { key: 'BLOQUEOS', label: 'Bloqueos' },
  { key: 'MINUTOS_JUGADOS', label: 'Minutos Jugados' },
];

const ICON_OPTIONS = [
  { name: 'Goal', icon: Goal },
  { name: 'Square', icon: Square },
  { name: 'AlertTriangle', icon: AlertTriangle },
  { name: 'Activity', icon: Activity },
  { name: 'Star', icon: Star },
  { name: 'Target', icon: Target },
  { name: 'Trophy', icon: Trophy },
];

const ADDITIONAL_FIELDS_OPTIONS = [
  { key: 'minuto', label: 'Minuto' },
  { key: 'cuarto', label: 'Cuarto' },
  { key: 'set', label: 'Set' },
  { key: 'game', label: 'Game' },
  { key: 'tiempo', label: 'Tiempo' },
  { key: 'periodo', label: 'Período' },
];

const ReglasPorDisciplina: React.FC<ReglasPorDisciplinaProps> = ({ disciplines }) => {
  const [selectedDisc, setSelectedDisc] = useState<string>(disciplines[0]?.name || 'FUTBOL');
  const [config, setConfig] = useState<DisciplineConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      const data = await getDisciplineConfig(selectedDisc);
      if (data) {
        setConfig(data);
      } else {
        // Si no hay config, usar default o crear una vacía
        const defaultData = DEFAULT_CONFIGS[selectedDisc] || {
          scoring_rules: { win: 3, draw: 1, loss: 0 },
          event_types: [],
          dashboard_stats: []
        };
        setConfig({
          discipline: selectedDisc,
          scoring_rules: defaultData.scoring_rules as any,
          event_types: defaultData.event_types as any,
          dashboard_stats: defaultData.dashboard_stats as any
        });
      }
      setIsLoading(false);
    };
    loadConfig();
  }, [selectedDisc]);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await saveDisciplineConfig(config);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const addEventType = () => {
    if (!config) return;
    const newEvent: EventType = {
      id: crypto.randomUUID(),
      name: 'NUEVO EVENTO',
      icon: 'Activity',
      color: '#3b82f6',
      statsKey: 'GOLES_TOTALES',
      affects_score: false,
      score_value: 1,
      scope: 'BOTH'
    };
    setConfig({
      ...config,
      event_types: [...config.event_types, newEvent]
    });
  };

  const removeEventType = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      event_types: config.event_types.filter(e => e.id !== id)
    });
  };

  const toggleStat = (key: string) => {
    if (!config) return;
    const exists = config.dashboard_stats.includes(key);
    if (exists) {
      setConfig({
        ...config,
        dashboard_stats: config.dashboard_stats.filter(s => s !== key)
      });
    } else {
      setConfig({
        ...config,
        dashboard_stats: [...config.dashboard_stats, key]
      });
    }
  };

  const toggleAdditionalField = (field: string) => {
    if (!config) return;
    const currentFields = config.additional_fields || [];
    const exists = currentFields.includes(field);
    if (exists) {
      setConfig({
        ...config,
        additional_fields: currentFields.filter(f => f !== field)
      });
    } else {
      setConfig({
        ...config,
        additional_fields: [...currentFields, field]
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary-600" size={40} />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Selector de Disciplina */}
      <div className="bg-surface-card p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-[var(--surface-border)] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 shadow-2xl">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-primary-500 shadow-inner shrink-0">
            <Settings2 size={20} md:size={24} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Disciplina a Configurar</h4>
            <div className="relative group min-w-0">
              <select 
                value={selectedDisc}
                onChange={e => setSelectedDisc(e.target.value)}
                className="w-full bg-transparent font-black text-lg md:text-2xl uppercase tracking-tighter dark:text-white outline-none mt-1 cursor-pointer pr-10 appearance-none truncate"
              >
                {disciplines.map(d => (
                  <option key={d.id} value={d.name} className="bg-surface-card dark:text-white font-sans text-sm p-4 uppercase tracking-widest font-bold">
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-primary-500 transition-colors">
                <ChevronDown size={22} />
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full md:w-auto flex items-center justify-center gap-3 md:gap-4 px-6 md:px-10 py-4 rounded-xl md:rounded-[1.5rem] font-bold uppercase text-[9px] md:text-[10px] tracking-widest transition-all shadow-2xl ${showSaved ? 'bg-emerald-500 text-white' : 'bg-primary-500 text-primary-contrast hover:scale-105 active:scale-95 disabled:opacity-30'}`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={16} md:size={18} /> : (showSaved ? <CheckCircle size={16} md:size={18} /> : <Save size={16} md:size={18} />)}
          <span>{isSaving ? 'Guardando' : (showSaved ? 'Guardado' : 'Guardar')}</span>
        </button>
      </div>

      {config && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 md:gap-10">
          {/* REGLAS DE PUNTUACIÓN */}
          <div className="bg-surface-card rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 border border-[var(--surface-border)] shadow-sm">
            <div className="flex items-center gap-4 mb-8 md:mb-10">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Trophy size={18} md:size={20} />
              </div>
              <h3 className="font-black text-xl md:text-2xl uppercase tracking-tighter dark:text-white italic">Puntuación</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-6">
              {[
                { key: 'win', label: 'Victor.', color: 'text-emerald-500' },
                { key: 'draw', label: 'Empat.', color: 'text-amber-500' },
                { key: 'loss', label: 'Derrot.', color: 'text-red-500' }
              ].map(rule => (
                <div key={rule.key} className="space-y-2 md:space-y-3">
                  <label className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest ${rule.color} ml-1`}>{rule.label}</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={config.scoring_rules[rule.key as keyof typeof config.scoring_rules]}
                      onChange={e => setConfig({
                        ...config,
                        scoring_rules: {
                          ...config.scoring_rules,
                          [rule.key]: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full bg-surface-ground p-4 md:p-6 rounded-xl md:rounded-2xl font-black text-xl md:text-2xl text-center dark:text-white outline-none border-2 border-transparent focus:border-primary-500/30 transition-all shadow-inner"
                    />
                    <span className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">pts</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 md:mt-8 text-[8px] md:text-[9px] text-slate-400 flex items-center gap-2 italic">
              <Info size={12} /> Cálculo automático de posiciones.
            </p>
          </div>

          {/* ESTADÍSTICAS DASHBOARD */}
          <div className="bg-surface-card rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 border border-[var(--surface-border)] shadow-sm">
            <div className="flex items-center gap-4 mb-8 md:mb-10">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500">
                <BarChart3 size={18} md:size={20} />
              </div>
              <h3 className="font-black text-xl md:text-2xl uppercase tracking-tighter dark:text-white italic">KPIs Dashboard</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 md:gap-3 max-h-[180px] md:max-h-[200px] overflow-y-auto pr-2 no-scrollbar">
              {STATS_OPTIONS.map(stat => {
                const isActive = config.dashboard_stats.includes(stat.key);
                return (
                  <button 
                    key={stat.key}
                    onClick={() => toggleStat(stat.key)}
                    className={`flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all text-left ${isActive ? 'bg-primary-500 border-primary-500 text-primary-contrast shadow-lg shadow-primary-500/20' : 'bg-surface-ground border-transparent text-slate-500 hover:border-slate-300'}`}
                  >
                    <div className={`w-5 h-5 md:w-6 md:h-6 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'}`}>
                      {isActive && <CheckCircle size={10} md:size={12} />}
                    </div>
                    <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest truncate">{stat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CAMPOS ADICIONALES (GLOBAL) */}
          <div className="lg:col-span-2 bg-surface-card rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 border border-[var(--surface-border)] shadow-sm">
            <div className="flex items-center gap-4 mb-8 md:mb-10">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-500">
                <Settings2 size={18} md:size={20} />
              </div>
              <h3 className="font-black text-xl md:text-2xl uppercase tracking-tighter dark:text-white italic">Campos Adicionales</h3>
            </div>

            <div className="flex flex-wrap gap-2 md:gap-4">
              {ADDITIONAL_FIELDS_OPTIONS.map(field => {
                const isActive = config.additional_fields?.includes(field.key);
                return (
                  <button 
                    key={field.key}
                    onClick={() => toggleAdditionalField(field.key)}
                    className={`flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border transition-all ${isActive ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-surface-ground border-transparent text-slate-500 hover:border-slate-200'}`}
                  >
                    <div className={`w-4 h-4 md:w-5 md:h-5 rounded flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'}`}>
                      {isActive && <CheckCircle size={10} md:size={12} />}
                    </div>
                    <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em]">{field.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TIPOS DE EVENTO */}
          <div className="lg:col-span-2 bg-surface-card rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 border border-[var(--surface-border)] shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 md:mb-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Activity size={18} md:size={20} />
                </div>
                <h3 className="font-black text-xl md:text-2xl uppercase tracking-tighter dark:text-white italic">Eventos</h3>
              </div>
              <button 
                onClick={addEventType}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
              >
                <Plus size={14} /> Agregar Evento
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {config.event_types.map(event => (
                <div key={event.id} className="bg-slate-50 dark:bg-white/5 p-5 md:p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 relative group">
                  <button 
                    onClick={() => removeEventType(event.id)}
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} md:size={16} />
                  </button>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-inner shrink-0" style={{ backgroundColor: `${event.color}20`, color: event.color }}>
                        {(() => {
                          const IconComp = ICON_OPTIONS.find(i => i.name === event.icon)?.icon || Activity;
                          return <IconComp size={20} md:size={24} />;
                        })()}
                      </div>
                      <input 
                        value={event.name}
                        onChange={e => setConfig({
                          ...config,
                          event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, name: e.target.value.toUpperCase() } : ev)
                        })}
                        className="flex-1 bg-transparent font-black text-base md:text-lg uppercase tracking-tighter dark:text-white outline-none border-b border-transparent focus:border-primary-600 truncate px-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Icono</label>
                        <select 
                          value={event.icon}
                          onChange={e => setConfig({
                            ...config,
                            event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, icon: e.target.value } : ev)
                          })}
                          className="w-full bg-white dark:bg-slate-800 p-2 rounded-lg text-[8px] md:text-[9px] font-bold outline-none border border-slate-200 dark:border-white/5 appearance-none"
                        >
                          {ICON_OPTIONS.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Alcance</label>
                        <select 
                          value={event.scope || 'BOTH'}
                          onChange={e => setConfig({
                            ...config,
                            event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, scope: e.target.value as any } : ev)
                          })}
                          className="w-full bg-white dark:bg-slate-800 p-2 rounded-lg text-[8px] md:text-[9px] font-bold outline-none border border-slate-200 dark:border-white/5 appearance-none"
                        >
                          <option value="BOTH">TODOS</option>
                          <option value="OWN">JUGADOR</option>
                          <option value="RIVAL">RIVAL</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Color</label>
                        <input 
                          type="color"
                          value={event.color}
                          onChange={e => setConfig({
                            ...config,
                            event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, color: e.target.value } : ev)
                          })}
                          className="w-full h-8 rounded-lg cursor-pointer bg-transparent border-none p-0"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Marcador</label>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => setConfig({
                               ...config,
                               event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, affects_score: !ev.affects_score } : ev)
                             })}
                             className={`flex-1 py-2 rounded-lg text-[7px] md:text-[8px] font-bold uppercase transition-all ${event.affects_score ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-200 dark:bg-white/5 text-slate-400'}`}
                           >
                             {event.affects_score ? 'SÍ' : 'NO'}
                           </button>
                           {event.affects_score && (
                             <input 
                               type="number"
                               value={event.score_value || 0}
                               onChange={e => setConfig({
                                 ...config,
                                 event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, score_value: parseInt(e.target.value) || 0 } : ev)
                               })}
                               className="w-12 bg-white dark:bg-slate-800 p-2 rounded-lg text-[8px] md:text-[9px] font-bold outline-none border border-slate-200 dark:border-white/5 text-center"
                             />
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Estadística</label>
                      <select 
                        value={event.statsKey}
                        onChange={e => setConfig({
                          ...config,
                          event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, statsKey: e.target.value } : ev)
                        })}
                        className="w-full bg-white dark:bg-slate-800 p-2.5 rounded-lg text-[8px] md:text-[9px] font-bold outline-none border border-slate-200 dark:border-white/5 appearance-none"
                      >
                        {STATS_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReglasPorDisciplina;
