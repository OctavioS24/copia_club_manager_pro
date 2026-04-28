
import React, { useState, useEffect, useMemo } from 'react';
import { Player, ClubConfig, Metric, MedicalHistoryItem, PlayerInjury } from '../types.ts';
import { 
  X, Save, Edit3, Heart, 
  Loader2, CheckCircle, Fingerprint, 
  BarChart3, Target, Info, History, Clock, UserCircle,
  AlertTriangle, Stethoscope
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { db } from '../lib/supabase.ts';

interface PlayerCardProps {
  player: Player;
  onClose: () => void;
  onSaveSuccess?: () => void;
  clubConfig: ClubConfig;
}

type PlayerTab = 'stats' | 'sport_profile' | 'medical_record';

const PlayerCard: React.FC<PlayerCardProps> = ({ player: initialPlayer, onClose, onSaveSuccess, clubConfig }) => {
  const [activeTab, setActiveTab] = useState<PlayerTab>('stats'); 
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [player, setPlayer] = useState<Player>(initialPlayer);
  const [injuries, setInjuries] = useState<PlayerInjury[]>([]);
  const [isLoadingInjuries, setIsLoadingInjuries] = useState(false);

  // Resolución robusta de métricas desde la matriz
  const currentMetrics = useMemo(() => {
    if (!clubConfig.disciplines) return [];
    
    const discipline = clubConfig.disciplines.find(d => 
      d.name.toLowerCase() === player.discipline.toLowerCase()
    );
    
    if (!discipline) return [];

    const branch = discipline.branches.find(b => 
      b.gender.toLowerCase() === player.gender.toLowerCase()
    );
    
    if (!branch) return [];

    const category = branch.categories.find(c => 
      c.name.toLowerCase() === player.category.toLowerCase()
    );
    
    return category?.metrics || [];
  }, [clubConfig, player.discipline, player.category, player.gender]);

  const calculateOverall = (stats: Record<string, number>, metrics: Metric[]) => {
    if (metrics.length === 0) return 0;
    let totalWeight = 0;
    let weightedSum = 0;
    metrics.forEach(m => {
        const value = stats[m.name] || 0;
        weightedSum += (value * m.weight);
        totalWeight += m.weight;
    });
    return Math.round(weightedSum / totalWeight);
  };

  useEffect(() => {
    const overall = calculateOverall(player.stats || {}, currentMetrics);
    if (overall !== player.overallrating) {
        setPlayer(prev => ({ ...prev, overallrating: overall }));
    }
  }, [player.stats, currentMetrics, player.overallrating]);

  useEffect(() => {
    const fetchInjuries = async () => {
      if (activeTab === 'medical_record') {
        setIsLoadingInjuries(true);
        try {
          const { data } = await db.medical.getPlayerInjuries(player.id);
          if (data) setInjuries(data);
        } catch (err) {
          console.error("Error fetching injuries in PlayerCard:", err);
        } finally {
          setIsLoadingInjuries(false);
        }
      }
    };
    fetchInjuries();
  }, [player.id, activeTab]);

  const radarData = currentMetrics.map(m => ({
    subject: m.name,
    A: (player.stats && player.stats[m.name]) || 0,
    fullMark: 100
  }));

  const handleStatChange = (metricName: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setPlayer(prev => ({
      ...prev,
      stats: { ...(prev.stats || {}), [metricName]: Math.min(100, Math.max(0, numValue)) }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await db.players.upsert(player);
      setIsEditing(false);
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      console.error(err);
      alert("Error al guardar los cambios en la tabla de jugadores.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInfoChange = (key: keyof Player, value: any) => {
    setPlayer(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'stats', label: 'Rendimiento', icon: BarChart3 },
    { id: 'sport_profile', label: 'Perfil Deportivo', icon: Target },
    { id: 'medical_record', label: 'Ficha Médica', icon: Heart },
  ];

  const inputClasses = "w-full p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-bold text-sm outline-none border border-transparent dark:border-slate-700 focus:border-primary-600/50 dark:focus:border-primary-500 shadow-inner transition-all dark:text-slate-200 disabled:opacity-50";
  const labelClasses = "text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block";

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[500] flex items-center justify-center p-0 md:p-10 animate-fade-in">
      <div className="bg-white dark:bg-[#0f121a] w-full max-w-6xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 md:px-10 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-700/50 shrink-0 bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-4">
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-primary-600/10 items-center justify-center text-primary-600">
              <Fingerprint size={24} />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight italic">Perfil de Atleta</h3>
              <p className="text-[8px] md:text-[9px] font-black text-primary-600 uppercase tracking-[0.3em]">Advanced Talent Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={isSaving}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${isEditing ? 'bg-emerald-600 text-white' : 'bg-primary-600 text-white'}`}
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : (isEditing ? <Save size={16} /> : <Edit3 size={16} />)}
              <span>{isSaving ? 'Guardando' : (isEditing ? 'Guardar' : 'Editar')}</span>
            </button>
            <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-full hover:bg-red-500 hover:text-white transition-all border border-transparent dark:border-white/5">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 bg-slate-50/50 dark:bg-slate-900/40 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700/50 flex flex-col shrink-0 md:overflow-y-auto no-scrollbar">
            
            <div className="hidden md:flex p-8 flex-col items-center border-b border-slate-100 dark:border-slate-700/50 shrink-0">
              <div className="w-32 h-32 rounded-[2rem] bg-slate-200 dark:bg-slate-800 border-2 border-primary-600/20 overflow-hidden shadow-lg relative group mb-5">
                <img src={player.photourl || 'https://via.placeholder.com/400'} className="w-full h-full object-cover" />
                <div className="absolute top-0 right-0 bg-primary-600 text-white w-10 h-10 rounded-bl-2xl flex items-center justify-center font-black italic shadow-lg">
                  {player.overallrating}
                </div>
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight text-center truncate w-full px-2">
                {player.name}
              </h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">DNI: {player.dni}</p>
            </div>

            <nav className="flex md:flex-col overflow-x-auto no-scrollbar md:overflow-y-visible p-3 md:p-4 gap-2 md:gap-3 shrink-0">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as PlayerTab)}
                    className={`flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-5 rounded-xl md:rounded-2xl transition-all relative shrink-0 border-2 ${
                      isActive 
                      ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/30 border-primary-400 scale-[1.02] z-10' 
                      : 'text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <tab.icon size={18} className={isActive ? 'text-white' : 'opacity-30'} />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white dark:bg-[#0f121a] overflow-y-auto p-6 md:p-10 custom-scrollbar">
            <div className="max-w-3xl mx-auto">
              
              {activeTab === 'stats' && (
                <div className="space-y-10 animate-fade-in">
                  <h4 className="text-[10px] md:text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                     <div className="w-1 h-4 bg-primary-600 rounded-full"></div> Análisis de Rendimiento
                  </h4>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="aspect-square bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] p-6 border border-slate-100 dark:border-white/5 shadow-inner">
                      {radarData.length > 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: '900' }} />
                            <Radar name={player.name} dataKey="A" stroke="#ec4899" strokeWidth={4} fill="#ec4899" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 font-black uppercase text-[10px] text-center p-12 tracking-widest">Requiere al menos 3 métricas configuradas en la matriz</div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {currentMetrics.map((m) => (
                        <div key={m.id} className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{m.name}</span>
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={(player.stats && player.stats[m.name]) || 0}
                                onChange={e => handleStatChange(m.name, e.target.value)}
                                className="w-16 p-1 bg-white dark:bg-slate-700 text-center font-black rounded-lg text-primary-600 outline-none border border-primary-500/20 shadow-sm"
                              />
                            ) : (
                              <span className="text-lg font-black text-slate-800 dark:text-white italic">{(player.stats && player.stats[m.name]) || 0}</span>
                            )}
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-primary-600 rounded-full transition-all duration-500" style={{ width: `${(player.stats && player.stats[m.name]) || 0}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sport_profile' && (
                <div className="space-y-10 animate-fade-in">
                  <h4 className="text-[10px] md:text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                     <div className="w-1 h-4 bg-violet-500 rounded-full"></div> Definición Táctica
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className={labelClasses}>Posición en el Campo</label>
                      <input 
                        disabled={!isEditing}
                        value={player.position}
                        onChange={e => handleInfoChange('position', e.target.value.toUpperCase())}
                        className={inputClasses}
                        placeholder="EJ: DELANTERO CENTRO"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Dorsal / Número</label>
                      <input 
                        disabled={!isEditing}
                        type="number"
                        value={player.number}
                        onChange={e => handleInfoChange('number', e.target.value)}
                        className={inputClasses}
                        placeholder="EJ: 10"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'medical_record' && (
                <div className="space-y-10 animate-fade-in pb-10">
                  <h4 className="text-[10px] md:text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
                     <div className="w-1 h-4 bg-rose-500 rounded-full"></div> Historia Clínica
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className={labelClasses}>Estado Actual</label>
                      <div className={`p-6 rounded-[2rem] border flex items-center gap-6 transition-all ${player.medical?.is_fit ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600' : 'bg-red-500/5 border-red-500/10 text-red-600'}`}>
                        {player.medical?.is_fit ? <CheckCircle size={32} /> : <Info size={32} />}
                        <div>
                          <h5 className="text-[11px] font-black uppercase tracking-widest">
                            {player.medical?.is_fit ? 'Apto Competencia' : 'Baja Médica'}
                          </h5>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            Vto: {player.medical?.expiry_date || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <label className={labelClasses}>Última Evaluación</label>
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Fecha: {player.medical?.last_checkup || 'Sin fecha'}</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-2 line-clamp-2 italic">
                          "{player.medical?.notes || 'Sin observaciones.'}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Listado de Lesiones (Enfermería) */}
                  <div className="mt-16">
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                           <Stethoscope size={18} className="text-rose-500" />
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historial de Lesiones (Enfermería)</h5>
                        </div>
                        {isLoadingInjuries && <Loader2 size={14} className="animate-spin text-primary-600" />}
                     </div>

                     <div className="space-y-4">
                        {injuries.length > 0 ? (
                          injuries.map(injury => (
                            <div key={injury.id} className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 relative group/injury">
                               <div className="flex items-center gap-4 mb-4">
                                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 shrink-0">
                                     <AlertTriangle size={18} />
                                  </div>
                                  <div>
                                     <h6 className="text-[11px] font-black uppercase text-slate-800 dark:text-white leading-none">
                                        {injury.injury_type?.name || 'Lesión'}
                                     </h6>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        Inicio: {injury.injury_date} {injury.release_date ? `| Alta: ${injury.release_date}` : '| EN TRATAMIENTO'}
                                     </p>
                                  </div>
                               </div>
                               <p className="text-xs text-slate-600 dark:text-slate-400 font-medium italic px-2">
                                  "{injury.comment || 'Sin descripción detallada'}"
                                </p>
                               <div className="mt-4 flex items-center justify-between px-2 text-[9px] font-black uppercase text-slate-400">
                                  <span className="flex items-center gap-1"><Clock size={12} /> Recup: {injury.estimated_recovery || 'N/A'}</span>
                                  {!injury.release_date && <span className="text-red-500 animate-pulse">BAJA ACTIVA</span>}
                               </div>
                            </div>
                          ))
                        ) : !isLoadingInjuries && (
                          <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2.5rem] opacity-30">
                             <p className="text-[9px] font-black uppercase tracking-widest">Sin registro de lesiones en enfermería</p>
                          </div>
                        )}
                     </div>
                  </div>

                  {/* Historial Timeline en la ficha del jugador */}
                  <div className="mt-16">
                     <div className="flex items-center gap-3 mb-8">
                        <History size={18} className="text-primary-600" />
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historial Médico de Aptitud</h5>
                     </div>
                     
                     <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                        {player.medical?.history && player.medical.history.length > 0 ? (
                          player.medical.history.map((item: MedicalHistoryItem) => (
                            <div key={item.id} className="relative pl-12">
                               <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${item.is_fit ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                               <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                                  <div className="flex justify-between items-start mb-2">
                                     <span className="text-[9px] font-black uppercase text-slate-400 italic flex items-center gap-2">
                                        <Clock size={10} /> {item.date}
                                     </span>
                                     <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${item.is_fit ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                        {item.is_fit ? 'Apto' : 'Baja'}
                                     </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic">"{item.notes || 'Sin notas'}"</p>
                                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 text-[8px] font-bold text-slate-400 uppercase tracking-widest flex justify-between">
                                     <span>Vto: {item.expiry_date || 'N/A'}</span>
                                     <span className="flex items-center gap-1"><UserCircle size={10} /> {item.professional_name}</span>
                                  </div>
                               </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center py-10 text-[9px] font-black uppercase text-slate-400 tracking-[0.3em]">Sin registros históricos archivados</p>
                        )}
                     </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 md:px-10 py-5 border-t border-slate-100 dark:border-slate-700/50 flex justify-end bg-slate-50 dark:bg-slate-800/40 shrink-0">
          <button 
            onClick={onClose}
            className="w-full md:w-auto flex items-center justify-center gap-4 bg-slate-900 text-white px-10 py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-[11px] tracking-widest shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
