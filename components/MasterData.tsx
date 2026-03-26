
import React, { useState, useEffect, useRef } from 'react';
import { ClubConfig, Discipline, Branch, Category, Metric } from '../types';
import { 
  Save, Plus, Trash2, Shield, Palette, Database, ChevronDown, 
  User, Users, Activity, CheckCircle, Loader2, Camera, Sparkles, 
  X, Image as ImageIcon, LayoutGrid, Settings2, Search, Lock, Unlock, Edit3,
  ChevronUp, BarChart3, Target
} from 'lucide-react';

interface MasterDataProps {
  config: ClubConfig;
  onSave: (config: ClubConfig) => Promise<void>;
}

const MasterData: React.FC<MasterDataProps> = ({ config, onSave }) => {
  const [activeTab, setActiveTab] = useState<'disciplines' | 'matrix' | 'identity'>('disciplines');
  const [localConfig, setLocalConfig] = useState<ClubConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isEditingEnabled, setIsEditingEnabled] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // States for Matrix View
  const [selectedDiscId, setSelectedDiscId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const discIconRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setLocalConfig(config);
    if (config.disciplines.length > 0 && !selectedDiscId) {
      setSelectedDiscId(config.disciplines[0].id);
    }
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(localConfig);
    setIsSaving(false);
    setShowSaved(true);
    setIsEditingEnabled(false);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // --- DISCIPLINE ACTIONS ---
  const addDiscipline = () => {
    const id = crypto.randomUUID();
    const newDisc: Discipline = {
      id,
      name: 'NUEVA DISCIPLINA',
      sportType: 'Otro',
      iconUrl: '',
      branches: [
        { gender: 'Masculino', enabled: true, categories: [] },
        { gender: 'Femenino', enabled: false, categories: [] }
      ]
    };
    setLocalConfig({ ...localConfig, disciplines: [...localConfig.disciplines, newDisc] });
    setSelectedDiscId(id);
  };

  const updateDiscIcon = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalConfig({
          ...localConfig,
          disciplines: localConfig.disciplines.map(d => d.id === id ? { ...d, iconUrl: reader.result as string } : d)
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- MATRIX ACTIONS ---
  const addCategory = (discId: string, gender: string) => {
    const newId = crypto.randomUUID();
    setLocalConfig({
      ...localConfig,
      disciplines: localConfig.disciplines.map(d => d.id === discId ? {
        ...d,
        branches: d.branches.map(b => b.gender === gender ? {
          ...b,
          categories: [...b.categories, { id: newId, name: 'NUEVA CATEGORÍA', metrics: [] }]
        } : b)
      } : d)
    });
    setExpandedCategories(prev => ({ ...prev, [newId]: true }));
  };

  const addMetric = (discId: string, gender: string, catId: string) => {
    setLocalConfig({
      ...localConfig,
      disciplines: localConfig.disciplines.map(d => d.id === discId ? {
        ...d,
        branches: d.branches.map(b => b.gender === gender ? {
          ...b,
          categories: b.categories.map(c => c.id === catId ? {
            ...c,
            metrics: [...c.metrics, { id: crypto.randomUUID(), name: 'MÉTRICA', weight: 1 }]
          } : c)
        } : b)
      } : d)
    });
  };

  const selectedDiscipline = localConfig.disciplines.find(d => d.id === selectedDiscId);

  return (
    <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in pb-40">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
        <div>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none italic">
            Configuración <span className="text-primary-600">Pro</span>
          </h2>
          <div className="flex gap-6 mt-10 overflow-x-auto no-scrollbar pb-2">
            {[
              { id: 'disciplines', label: '1. Disciplinas', icon: Shield },
              { id: 'matrix', label: '2. Matriz Deportiva', icon: Database },
              { id: 'identity', label: '3. Identidad Club', icon: Palette }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all pb-3 border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'text-primary-600 border-primary-600' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <button 
            onClick={() => setIsEditingEnabled(!isEditingEnabled)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all ${isEditingEnabled ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-200 dark:bg-white/5 text-slate-500'}`}
          >
            {isEditingEnabled ? <Unlock size={16} /> : <Lock size={16} />}
            <span>{isEditingEnabled ? 'Edición Habilitada' : 'Modo Lectura'}</span>
          </button>
          
          <button 
            onClick={handleSave} 
            disabled={isSaving || !isEditingEnabled}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-4 px-10 py-4 rounded-[1.5rem] font-bold uppercase text-[10px] tracking-widest transition-all shadow-2xl ${showSaved ? 'bg-emerald-500 text-white' : 'bg-primary-600 text-white hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:scale-100'}`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : (showSaved ? <CheckCircle size={18} /> : <Save size={18} />)}
            <span>{isSaving ? 'Guardando' : (showSaved ? 'Guardado' : 'Guardar Cambios')}</span>
          </button>
        </div>
      </header>

      {/* --- TAB 1: DISCIPLINAS --- */}
      {activeTab === 'disciplines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
          {localConfig.disciplines.map(disc => (
            <div key={disc.id} className="bg-white dark:bg-[#0f1219] rounded-[3rem] border border-slate-200 dark:border-white/5 p-10 shadow-sm relative group hover:border-primary-500/30 transition-all flex flex-col items-center">
              {isEditingEnabled && (
                <button 
                  onClick={() => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.filter(d => d.id !== disc.id)})}
                  className="absolute top-8 right-8 text-slate-300 hover:text-red-500 transition-colors animate-fade-in z-10"
                >
                  <Trash2 size={18} />
                </button>
              )}
              
              <div className="flex flex-col items-center mb-8 w-full relative">
                <input 
                  type="file" 
                  ref={(el) => { discIconRefs.current[disc.id] = el; }}
                  onChange={(e) => updateDiscIcon(disc.id, e)}
                  className="hidden" 
                  accept="image/*"
                />
                <div 
                  onClick={() => isEditingEnabled && discIconRefs.current[disc.id]?.click()}
                  className={`w-32 h-32 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-white/10 transition-all shadow-inner relative ${isEditingEnabled ? 'cursor-pointer border-dashed hover:border-primary-600' : 'cursor-default border-solid opacity-80'}`}
                >
                  {disc.iconUrl ? (
                    <img src={disc.iconUrl} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={40} className="text-slate-300" />
                  )}
                  {isEditingEnabled && (
                    <div className="absolute inset-0 bg-primary-600/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Camera size={24} className="text-primary-600" />
                    </div>
                  )}
                </div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-4">Logo Disciplina</p>
              </div>

              <div className="w-full relative z-10 px-2">
                {isEditingEnabled ? (
                  <input 
                    value={disc.name}
                    onChange={e => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === disc.id ? {...d, name: e.target.value.toUpperCase()} : d)})}
                    placeholder="NOMBRE"
                    className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-2xl font-black text-2xl uppercase tracking-tighter text-center dark:text-white outline-none border-2 border-transparent focus:border-primary-600/30 transition-all"
                  />
                ) : (
                  <h3 className="w-full font-black text-2xl uppercase tracking-tighter text-center dark:text-white py-4 truncate px-4">{disc.name}</h3>
                )}
              </div>
            </div>
          ))}
          
          {isEditingEnabled && (
            <button onClick={addDiscipline} className="border-4 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] p-16 flex flex-col items-center justify-center gap-6 text-slate-400 hover:text-primary-600 hover:border-primary-600 transition-all bg-white/5 group animate-fade-in">
               <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={40} />
               </div>
               <span className="font-bold uppercase text-[10px] tracking-[0.2em]">Nueva Disciplina</span>
            </button>
          )}
        </div>
      )}

      {/* --- TAB 2: MATRIZ DEPORTIVA --- */}
      {activeTab === 'matrix' && (
        <div className="space-y-12 animate-fade-in">
          {/* Header de selección de disciplina */}
          <div className="bg-white dark:bg-[#0f1219] p-6 md:p-8 rounded-[3rem] border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="w-16 h-16 bg-primary-600/10 rounded-2xl flex items-center justify-center text-primary-600 shadow-inner shrink-0">
                    <LayoutGrid size={24} />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Disciplina Activa</h4>
                    <div className="relative group min-w-0">
                      <select 
                        value={selectedDiscId || ''}
                        onChange={e => setSelectedDiscId(e.target.value)}
                        className="w-full bg-transparent font-black text-xl md:text-2xl uppercase tracking-tighter dark:text-white outline-none mt-1 cursor-pointer pr-10 appearance-none truncate"
                      >
                        {localConfig.disciplines.length === 0 && (
                          <option value="" className="bg-white dark:bg-slate-900 dark:text-white font-sans text-sm p-4 text-slate-500">
                            No hay disciplinas
                          </option>
                        )}
                        {localConfig.disciplines.map(d => (
                          <option 
                            key={d.id} 
                            value={d.id} 
                            className="bg-white dark:bg-[#1a1f2b] dark:text-white font-sans text-sm p-4 uppercase tracking-widest font-bold"
                          >
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
              {selectedDiscipline && (
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-3xl border border-slate-100 dark:border-white/5 w-full md:w-auto overflow-hidden">
                   <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shadow-sm border border-slate-100 p-1 flex items-center justify-center shrink-0">
                      {selectedDiscipline.iconUrl ? (
                        <img src={selectedDiscipline.iconUrl} className="w-full h-full object-contain" />
                      ) : (
                        <Shield size={20} className="text-slate-300" />
                      )}
                   </div>
                   <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[10px] uppercase tracking-widest text-primary-600 leading-none truncate">Configuración Técnica</span>
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest mt-1 truncate">Sincronizado</span>
                   </div>
                </div>
              )}
          </div>

          {selectedDiscipline ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               {selectedDiscipline.branches.map(branch => (
                 <div key={branch.gender} className={`rounded-[3.5rem] p-6 md:p-8 lg:p-12 border transition-all overflow-hidden ${branch.enabled ? 'bg-white dark:bg-[#0f1219] border-slate-200 dark:border-white/5' : 'bg-slate-100/30 dark:bg-white/5 border-transparent opacity-40 grayscale pointer-events-none'}`}>
                    <div className="flex flex-wrap justify-between items-center mb-10 gap-4">
                        <label className={`flex items-center gap-4 ${isEditingEnabled ? 'cursor-pointer' : 'cursor-default'}`}>
                          <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${branch.enabled ? 'bg-primary-600 border-primary-600 shadow-lg shadow-primary-500/30' : 'border-slate-300'}`}>
                              <input 
                                type="checkbox" 
                                checked={branch.enabled} 
                                disabled={!isEditingEnabled}
                                onChange={() => setLocalConfig({
                                  ...localConfig,
                                  disciplines: localConfig.disciplines.map(d => d.id === selectedDiscId ? {
                                    ...d,
                                    branches: d.branches.map(b => b.gender === branch.gender ? {...b, enabled: !b.enabled} : b)
                                  } : d)
                                })}
                                className="hidden"
                              />
                              {branch.enabled && <CheckCircle size={16} className="text-white" />}
                          </div>
                          <h4 className="font-black uppercase text-2xl tracking-tighter dark:text-white flex items-center gap-3 italic truncate">
                             <User size={24} className={branch.gender === 'Masculino' ? 'text-blue-500' : 'text-pink-500'} />
                             Rama {branch.gender}
                          </h4>
                        </label>
                        {branch.enabled && isEditingEnabled && (
                          <button onClick={() => addCategory(selectedDiscipline.id, branch.gender)} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl whitespace-nowrap">
                             <Plus size={14} /> Nueva Categoría
                          </button>
                        )}
                    </div>

                    {branch.enabled && (
                      <div className="space-y-4">
                        {branch.categories.map(cat => {
                          const isExpanded = expandedCategories[cat.id];
                          return (
                            <div key={cat.id} className={`group/cat transition-all duration-500 w-full ${isExpanded ? 'bg-slate-50 dark:bg-white/[0.03] rounded-[2.5rem] p-4 md:p-6' : 'bg-transparent'}`}>
                              {/* Header Acordeón */}
                              <div className="flex items-center gap-4 w-full overflow-hidden">
                                <button 
                                  onClick={() => toggleCategory(cat.id)}
                                  className={`w-full flex items-center justify-between p-4 md:p-6 rounded-3xl transition-all border overflow-hidden ${isExpanded ? 'bg-white dark:bg-slate-800 border-primary-600/30 shadow-xl' : 'bg-slate-50 dark:bg-white/5 border-transparent hover:border-slate-300 dark:hover:border-white/10'}`}
                                >
                                  <div className="flex items-center gap-4 md:gap-6 min-w-0 flex-1">
                                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shrink-0 ${isExpanded ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                        <Target size={20} />
                                     </div>
                                     <div className="flex flex-col items-start min-w-0 flex-1">
                                        {isEditingEnabled ? (
                                          <input 
                                            value={cat.name}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === selectedDiscipline.id ? {...d, branches: d.branches.map(b => b.gender === branch.gender ? {...b, categories: b.categories.map(c => c.id === cat.id ? {...c, name: e.target.value.toUpperCase()} : c)} : b)} : d)})}
                                            className="w-full bg-transparent font-black uppercase text-base md:text-lg tracking-tighter text-slate-900 dark:text-white outline-none focus:border-b-2 border-primary-600 truncate"
                                          />
                                        ) : (
                                          <span className="w-full font-black uppercase text-base md:text-lg tracking-tighter text-slate-900 dark:text-white leading-none truncate text-left">{cat.name}</span>
                                        )}
                                        <span className="text-[9px] font-bold uppercase text-slate-400 tracking-[0.3em] mt-2 truncate w-full text-left">{cat.metrics.length} Parámetros Técnicos</span>
                                     </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-2">
                                     {isEditingEnabled && (
                                       <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if(confirm('¿Eliminar categoría y sus métricas?')) {
                                              setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === selectedDiscipline.id ? {...d, branches: d.branches.map(b => b.gender === branch.gender ? {...b, categories: b.categories.filter(c => c.id !== cat.id)} : b)} : d)});
                                            }
                                          }}
                                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                       >
                                          <Trash2 size={16} />
                                       </button>
                                     )}
                                     <div className={`transition-transform duration-500 ${isExpanded ? 'rotate-180 text-primary-600' : 'text-slate-400'}`}>
                                        <ChevronDown size={20} />
                                     </div>
                                  </div>
                                </button>
                              </div>

                              {/* Body Acordeón (Métricas) */}
                              <div className={`grid transition-all duration-500 ease-in-out w-full ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 pointer-events-none overflow-hidden'}`}>
                                <div className="overflow-hidden w-full">
                                   <div className="space-y-3 mb-6 w-full">
                                      {cat.metrics.map(metric => (
                                        <div key={metric.id} className="flex items-center gap-4 bg-white dark:bg-[#1a1f2b] p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 group/row w-full overflow-hidden">
                                           <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover/row:text-primary-600 transition-colors shrink-0">
                                              <BarChart3 size={14} />
                                           </div>
                                           <div className="min-w-0 flex-1">
                                             {isEditingEnabled ? (
                                               <input 
                                                  value={metric.name}
                                                  onChange={e => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === selectedDiscipline.id ? {...d, branches: d.branches.map(b => b.gender === branch.gender ? {...b, categories: b.categories.map(c => c.id === cat.id ? {...c, metrics: c.metrics.map(m => m.id === metric.id ? {...m, name: e.target.value.toUpperCase()} : m)} : c)} : b)} : d)})}
                                                  className="w-full bg-transparent text-[11px] font-bold uppercase tracking-widest dark:text-slate-200 outline-none truncate"
                                                  placeholder="EJ: VELOCIDAD"
                                               />
                                             ) : (
                                               <span className="w-full block text-[11px] font-bold uppercase tracking-widest dark:text-slate-300 truncate">{metric.name}</span>
                                             )}
                                           </div>
                                           
                                           <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                              <div className="flex flex-col items-end shrink-0">
                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Impacto</span>
                                                <input 
                                                  type="number" 
                                                  disabled={!isEditingEnabled}
                                                  value={metric.weight}
                                                  onChange={e => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === selectedDiscipline.id ? {...d, branches: d.branches.map(b => b.gender === branch.gender ? {...b, categories: b.categories.map(c => c.id === cat.id ? {...c, metrics: c.metrics.map(m => m.id === metric.id ? {...m, weight: parseInt(e.target.value) || 1} : m)} : c)} : b)} : d)})}
                                                  className={`w-10 md:w-12 text-center font-black text-xs py-1.5 rounded-lg outline-none transition-colors ${isEditingEnabled ? 'bg-slate-100 dark:bg-slate-700' : 'bg-transparent'}`} 
                                                />
                                              </div>
                                              {isEditingEnabled && (
                                                <button 
                                                  onClick={() => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === selectedDiscipline.id ? {...d, branches: d.branches.map(b => b.gender === branch.gender ? {...b, categories: b.categories.map(c => c.id === cat.id ? {...c, metrics: c.metrics.filter(m => m.id !== metric.id)} : c)} : b)} : d)})}
                                                  className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-all"
                                                >
                                                  <X size={14} />
                                                </button>
                                              )}
                                           </div>
                                        </div>
                                      ))}
                                   </div>

                                   {isEditingEnabled && (
                                      <button 
                                        onClick={() => addMetric(selectedDiscipline.id, branch.gender, cat.id)}
                                        className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:text-primary-600 hover:border-primary-600 transition-all group/addkpi"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover/addkpi:bg-primary-600 group-hover/addkpi:text-white transition-all shrink-0">
                                          <Activity size={16} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] truncate px-2">Agregar Métrica KPI</span>
                                      </button>
                                   )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                 </div>
               ))}
            </div>
          ) : (
            <div className="py-32 text-center bg-white dark:bg-[#0f1219] rounded-[4rem] border border-slate-200 dark:border-white/5 shadow-inner">
               <Shield size={64} className="mx-auto mb-6 text-slate-100 dark:text-white/5" />
               <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Selecciona una disciplina para gestionar su matriz</p>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: IDENTIDAD --- */}
      {activeTab === 'identity' && (
        <div className="bg-white dark:bg-[#0f1219] rounded-[4rem] border border-slate-200 dark:border-white/5 p-16 animate-fade-in shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div className="space-y-12">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 ml-4">Nombre de la Institución</label>
                {isEditingEnabled ? (
                  <input 
                    value={localConfig.name}
                    onChange={e => setLocalConfig({...localConfig, name: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-50 dark:bg-white/5 p-8 rounded-[2.5rem] font-black text-4xl uppercase tracking-tighter dark:text-white outline-none border-2 border-transparent focus:border-primary-600/30 transition-all shadow-inner"
                    placeholder="NOMBRE DEL CLUB"
                  />
                ) : (
                  <div className="p-8 rounded-[2.5rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                    <h3 className="font-black text-4xl uppercase tracking-tighter dark:text-white leading-none">{localConfig.name}</h3>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 ml-4">Color Principal</label>
                  <div className={`flex items-center gap-6 p-6 rounded-3xl shadow-inner border transition-all ${isEditingEnabled ? 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5' : 'bg-transparent border-transparent'}`}>
                    <input 
                      type="color" 
                      disabled={!isEditingEnabled}
                      value={localConfig.primaryColor} 
                      onChange={e => setLocalConfig({...localConfig, primaryColor: e.target.value})} 
                      className={`w-16 h-16 rounded-2xl border-none p-0 bg-transparent ${isEditingEnabled ? 'cursor-pointer' : 'cursor-default opacity-80'}`} 
                    />
                    <span className="font-mono text-sm font-bold text-slate-500 uppercase">{localConfig.primaryColor}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 ml-4">Color Fondo</label>
                  <div className={`flex items-center gap-6 p-6 rounded-3xl shadow-inner border transition-all ${isEditingEnabled ? 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5' : 'bg-transparent border-transparent'}`}>
                    <input 
                      type="color" 
                      disabled={!isEditingEnabled}
                      value={localConfig.secondaryColor} 
                      onChange={e => setLocalConfig({...localConfig, secondaryColor: e.target.value})} 
                      className={`w-16 h-16 rounded-2xl border-none p-0 bg-transparent ${isEditingEnabled ? 'cursor-pointer' : 'cursor-default opacity-80'}`} 
                    />
                    <span className="font-mono text-sm font-bold text-slate-500 uppercase">{localConfig.secondaryColor}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex flex-col items-center justify-center p-16 rounded-[4rem] border-4 border-dashed relative group transition-all ${isEditingEnabled ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10' : 'bg-transparent border-transparent'}`}>
              <input type="file" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setLocalConfig({...localConfig, logoUrl: reader.result as string});
                  reader.readAsDataURL(file);
                }
              }} accept="image/*" className="hidden" />
              
              <div className="w-64 h-64 rounded-full bg-white dark:bg-slate-900 shadow-3xl flex items-center justify-center overflow-hidden mb-12 border-8 border-white dark:border-slate-800 relative group">
                {localConfig.logoUrl ? (
                  <img src={localConfig.logoUrl} className="w-full h-full object-contain p-8" />
                ) : (
                  <Shield size={80} className="text-slate-100 dark:text-slate-800" />
                )}
                {isEditingEnabled && (
                  <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-primary-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera size={48} className="text-white" />
                  </div>
                )}
              </div>
              
              {isEditingEnabled && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-12 py-5 bg-slate-900 dark:bg-primary-600 text-white rounded-full font-bold uppercase text-[10px] tracking-widest shadow-2xl hover:scale-105 transition-all"
                >
                  Actualizar Escudo Club
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterData;
