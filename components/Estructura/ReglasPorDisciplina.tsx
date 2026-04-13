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
      statsKey: 'GOLES_TOTALES'
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
      <div className="bg-white dark:bg-[#0f1219] p-8 rounded-[3rem] border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="w-16 h-16 bg-primary-600/10 rounded-2xl flex items-center justify-center text-primary-600 shadow-inner shrink-0">
            <Settings2 size={24} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Disciplina a Configurar</h4>
            <div className="relative group min-w-0">
              <select 
                value={selectedDisc}
                onChange={e => setSelectedDisc(e.target.value)}
                className="w-full bg-transparent font-black text-xl md:text-2xl uppercase tracking-tighter dark:text-white outline-none mt-1 cursor-pointer pr-10 appearance-none truncate"
              >
                {disciplines.map(d => (
                  <option key={d.id} value={d.name} className="bg-white dark:bg-[#1a1f2b] dark:text-white font-sans text-sm p-4 uppercase tracking-widest font-bold">
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-primary-600 transition-colors">
                <ChevronDown size={22} />
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`flex-1 lg:flex-none flex items-center justify-center gap-4 px-10 py-4 rounded-[1.5rem] font-bold uppercase text-[10px] tracking-widest transition-all shadow-2xl ${showSaved ? 'bg-emerald-500 text-white' : 'bg-primary-600 text-white hover:scale-105 active:scale-95 disabled:opacity-30'}`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : (showSaved ? <CheckCircle size={18} /> : <Save size={18} />)}
          <span>{isSaving ? 'Guardando' : (showSaved ? 'Guardado' : 'Guardar Configuración')}</span>
        </button>
      </div>

      {config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* REGLAS DE PUNTUACIÓN */}
          <div className="bg-white dark:bg-[#0f1219] rounded-[3.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Trophy size={20} />
              </div>
              <h3 className="font-black text-2xl uppercase tracking-tighter dark:text-white italic">Reglas de Puntuación</h3>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {[
                { key: 'win', label: 'Victoria', color: 'text-emerald-500' },
                { key: 'draw', label: 'Empate', color: 'text-amber-500' },
                { key: 'loss', label: 'Derrota', color: 'text-red-500' }
              ].map(rule => (
                <div key={rule.key} className="space-y-3">
                  <label className={`text-[9px] font-bold uppercase tracking-widest ${rule.color} ml-2`}>{rule.label}</label>
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
                      className="w-full bg-slate-50 dark:bg-white/5 p-6 rounded-2xl font-black text-2xl text-center dark:text-white outline-none border-2 border-transparent focus:border-primary-600/30 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">pts</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[9px] text-slate-400 flex items-center gap-2 italic">
              <Info size={12} /> Estos puntos se usarán para calcular la tabla de posiciones automáticamente.
            </p>
          </div>

          {/* ESTADÍSTICAS DASHBOARD */}
          <div className="bg-white dark:bg-[#0f1219] rounded-[3.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-primary-600/10 flex items-center justify-center text-primary-600">
                <BarChart3 size={20} />
              </div>
              <h3 className="font-black text-2xl uppercase tracking-tighter dark:text-white italic">Estadísticas Dashboard</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2 no-scrollbar">
              {STATS_OPTIONS.map(stat => {
                const isActive = config.dashboard_stats.includes(stat.key);
                return (
                  <button 
                    key={stat.key}
                    onClick={() => toggleStat(stat.key)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${isActive ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/20' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-500 hover:border-slate-300'}`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'}`}>
                      {isActive && <CheckCircle size={12} />}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest">{stat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TIPOS DE EVENTO */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0f1219] rounded-[3.5rem] p-10 border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Activity size={20} />
                </div>
                <h3 className="font-black text-2xl uppercase tracking-tighter dark:text-white italic">Tipos de Evento</h3>
              </div>
              <button 
                onClick={addEventType}
                className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
              >
                <Plus size={14} /> Agregar Tipo de Evento
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {config.event_types.map(event => (
                <div key={event.id} className="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5 relative group">
                  <button 
                    onClick={() => removeEventType(event.id)}
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${event.color}20`, color: event.color }}>
                        {(() => {
                          const IconComp = ICON_OPTIONS.find(i => i.name === event.icon)?.icon || Activity;
                          return <IconComp size={24} />;
                        })()}
                      </div>
                      <input 
                        value={event.name}
                        onChange={e => setConfig({
                          ...config,
                          event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, name: e.target.value.toUpperCase() } : ev)
                        })}
                        className="flex-1 bg-transparent font-black text-lg uppercase tracking-tighter dark:text-white outline-none border-b border-transparent focus:border-primary-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Icono</label>
                        <select 
                          value={event.icon}
                          onChange={e => setConfig({
                            ...config,
                            event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, icon: e.target.value } : ev)
                          })}
                          className="w-full bg-white dark:bg-slate-800 p-2 rounded-xl text-[9px] font-bold outline-none border border-slate-200 dark:border-white/5"
                        >
                          {ICON_OPTIONS.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Color</label>
                        <input 
                          type="color"
                          value={event.color}
                          onChange={e => setConfig({
                            ...config,
                            event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, color: e.target.value } : ev)
                          })}
                          className="w-full h-8 rounded-xl cursor-pointer bg-transparent border-none p-0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[7px] font-bold uppercase tracking-widest text-slate-400 ml-1">Suma para Estadística</label>
                      <select 
                        value={event.statsKey}
                        onChange={e => setConfig({
                          ...config,
                          event_types: config.event_types.map(ev => ev.id === event.id ? { ...ev, statsKey: e.target.value } : ev)
                        })}
                        className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl text-[9px] font-bold outline-none border border-slate-200 dark:border-white/5"
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
