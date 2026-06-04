
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClubConfig, Discipline } from '../types';
import { 
  Save, Plus, Trash2, Shield, Palette, Database, ChevronDown, 
  Activity, CheckCircle, Loader2, Camera, 
  X, Image as ImageIcon, LayoutGrid, Lock, Unlock,
  BarChart3, Target, User, Settings2
} from 'lucide-react';

import PosicionesPorDisciplina from './Estructura/PosicionesPorDisciplina';
import ReglasPorDisciplina from './Estructura/ReglasPorDisciplina';
import RivalesPorDisciplina from './Estructura/RivalesPorDisciplina';

interface MasterDataProps {
  config: ClubConfig;
  onSave: (config: ClubConfig) => Promise<void>;
}

const MasterData: React.FC<MasterDataProps> = ({ config, onSave }) => {
  const [activeTab, setActiveTab] = useState<'disciplines' | 'matrix' | 'identity' | 'positions' | 'rules' | 'rivals'>('identity');
  const [localConfig, setLocalConfig] = useState<ClubConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isEditingEnabled, setIsEditingEnabled] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'discipline' | 'category';
    id: string;
    name: string;
    discId?: string;
    gender?: string;
  } | null>(null);

  // NORMALIZACIÓN: Aseguramos que todas las disciplinas tengan la estructura de ramas
  // Esto es vital para datos antiguos que no tenían la propiedad 'branches'
  React.useEffect(() => {
    let changed = false;
    const migratedDisciplines = localConfig.disciplines.map(d => {
      const hasBranches = d.branches && Array.isArray(d.branches);
      
      if (!hasBranches) {
        changed = true;
        // Si no tiene ramas, migramos las categorías viejas a la rama masculina
        return {
          ...d,
          branches: [
            { gender: 'Masculino' as const, enabled: true, categories: (d as any).categories || [] },
            { gender: 'Femenino' as const, enabled: false, categories: [] }
          ]
        };
      }
      
      // Si tiene ramas pero falta alguna (ej: solo masculino)
      if (d.branches.length < 2) {
        changed = true;
        const genders = d.branches.map(b => b.gender);
        const missing = ['Masculino', 'Femenino'].filter(g => !genders.includes(g as any));
        const newBranches = [...d.branches];
        missing.forEach(m => {
          newBranches.push({ gender: m as any, enabled: false, categories: [] });
        });
        return { 
          ...d, 
          branches: newBranches.sort((a, b) => a.gender === 'Masculino' ? -1 : (b.gender === 'Masculino' ? 1 : 0)) 
        };
      }
      
      return d;
    });

    if (changed) {
      setLocalConfig(prev => ({ ...prev, disciplines: migratedDisciplines }));
    }
  }, [localConfig.disciplines]);
  
  // States for Matrix View
  const [selectedDiscId, setSelectedDiscId] = useState<string | null>(config.disciplines[0]?.id || null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const discIconRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const executeDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'discipline') {
      setLocalConfig({
        ...localConfig,
        disciplines: localConfig.disciplines.filter(d => d.id !== deleteConfirm.id)
      });
      if (selectedDiscId === deleteConfirm.id) {
        setSelectedDiscId(localConfig.disciplines.find(d => d.id !== deleteConfirm.id)?.id || null);
      }
    } else if (deleteConfirm.type === 'category' && deleteConfirm.discId && deleteConfirm.gender) {
      setLocalConfig({
        ...localConfig,
        disciplines: localConfig.disciplines.map(d => d.id === deleteConfirm.discId ? {
          ...d,
          branches: d.branches.map(b => b.gender === deleteConfirm.gender ? {
            ...b,
            categories: b.categories.filter(c => c.id !== deleteConfirm.id)
          } : b)
        } : d)
      });
    }
    setDeleteConfirm(null);
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
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 lg:gap-8 mb-10 md:mb-16">
        <div className="w-full">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-[var(--text-main)] leading-none italic">
            Configuración <span className="text-[var(--primary-600)]">Pro</span>
          </h2>
          <div className="flex gap-4 md:gap-6 mt-8 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 md:mx-0 md:px-0">
            {[
              { id: 'identity', label: '1. Identidad', icon: Palette },
              { id: 'disciplines', label: '2. Disciplinas', icon: Shield },
              { id: 'rules', label: '3. Reglas', icon: Settings2 },
              { id: 'matrix', label: '4. Matriz', icon: Database },
              { id: 'rivals', label: '5. Rivales', icon: Shield },
              { id: 'positions', label: '6. Puestos', icon: LayoutGrid }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] transition-all pb-3 border-b-2 whitespace-nowrap shrink-0 ${activeTab === tab.id ? 'text-[var(--primary-600)] border-[var(--primary-600)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)]'}`}
              >
                <tab.icon size={14} className="shrink-0" /> {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-row items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={() => setIsEditingEnabled(!isEditingEnabled)}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-4 rounded-xl md:rounded-2xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest transition-all ${isEditingEnabled ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-surface-hover text-[var(--text-muted)]'}`}
          >
            {isEditingEnabled ? <Unlock size={14} /> : <Lock size={14} />}
            <span>{isEditingEnabled ? 'Edición Habilitada' : 'Modo Lectura'}</span>
          </button>
          
          <button 
            onClick={handleSave} 
            disabled={isSaving || !isEditingEnabled}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-3 md:gap-4 px-6 md:px-10 py-4 rounded-xl md:rounded-[1.5rem] font-bold uppercase text-[9px] md:text-[10px] tracking-widest transition-all shadow-2xl ${showSaved ? 'bg-emerald-500 text-white' : 'bg-[var(--secondary-600)] text-white hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:scale-100'}`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : (showSaved ? <CheckCircle size={16} /> : <Save size={16} />)}
            <span>{isSaving ? 'Guardando' : (showSaved ? 'Guardado' : 'Guardar')}</span>
          </button>
        </div>
      </header>

      {/* --- TAB 1: IDENTIDAD --- */}
      {activeTab === 'identity' && (
        <div className="bg-surface-card rounded-[2.5rem] md:rounded-[4rem] border border-[var(--surface-border)] p-6 md:p-10 lg:p-16 animate-fade-in shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            <div className="space-y-8 md:space-y-12">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)] ml-4">Nombre de la Institución</label>
                {isEditingEnabled ? (
                  <input 
                    value={localConfig.name}
                    onChange={e => setLocalConfig({...localConfig, name: e.target.value.toUpperCase()})}
                    className="w-full bg-surface-ground p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] font-black text-2xl md:text-4xl uppercase tracking-tighter text-[var(--text-main)] outline-none border-2 border-transparent focus:border-[var(--primary-500)]/30 transition-all shadow-inner"
                    placeholder="NOMBRE DEL CLUB"
                  />
                ) : (
                  <div className="p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] bg-surface-ground border border-[var(--surface-border)]">
                    <h3 className="font-black text-2xl md:text-4xl uppercase tracking-tighter text-[var(--text-main)] leading-none">{localConfig.name}</h3>
                  </div>
                )}
              </div>
            </div>

            <div className={`flex flex-col items-center justify-center p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] border-4 border-dashed relative group transition-all ${isEditingEnabled ? 'bg-surface-ground border-[var(--surface-border)]' : 'bg-transparent border-transparent'}`}>
              <input type="file" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setLocalConfig({...localConfig, logo_url: reader.result as string});
                  reader.readAsDataURL(file);
                }
              }} accept="image/*" className="hidden" />
              
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-surface-card shadow-3xl flex items-center justify-center overflow-hidden mb-8 md:mb-12 border-8 border-[var(--surface-border)] relative group">
                {localConfig.logo_url ? (
                  <img src={localConfig.logo_url} className="w-full h-full object-contain p-8" />
                ) : (
                  <Shield size={64} className="text-[var(--surface-border)]" />
                )}
                {isEditingEnabled && (
                  <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-primary-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera size={40} className="text-primary-contrast" />
                  </div>
                )}
              </div>
              
              {isEditingEnabled && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-8 md:px-12 py-4 md:py-5 bg-primary-500 text-primary-contrast rounded-full font-bold uppercase text-[9px] md:text-[10px] tracking-widest shadow-2xl hover:scale-105 transition-all"
                >
                  Actualizar Escudo Club
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: DISCIPLINAS --- */}
      {activeTab === 'disciplines' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 animate-fade-in">
          {localConfig.disciplines.map(disc => (
            <div key={disc.id} className="bg-surface-card rounded-[2rem] md:rounded-[3rem] border border-[var(--surface-border)] p-6 md:p-10 shadow-sm relative group hover:border-primary-500/30 transition-all flex flex-col items-center">
              {isEditingEnabled && (
                <button 
                  onClick={() => setDeleteConfirm({ type: 'discipline', id: disc.id, name: disc.name })}
                  className="absolute top-6 right-6 md:top-8 md:right-8 text-slate-300 hover:text-red-500 transition-colors animate-fade-in z-10"
                >
                  <Trash2 size={16} md:size={18} />
                </button>
              )}
              
              <div className="flex flex-col items-center mb-6 md:mb-8 w-full relative">
                <input 
                  type="file" 
                  ref={(el) => { discIconRefs.current[disc.id] = el; }}
                  onChange={(e) => updateDiscIcon(disc.id, e)}
                  className="hidden" 
                  accept="image/*"
                />
                <div 
                  onClick={() => isEditingEnabled && discIconRefs.current[disc.id]?.click()}
                  className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl md:rounded-3xl bg-surface-ground flex items-center justify-center overflow-hidden border-2 border-[var(--surface-border)] transition-all shadow-inner relative ${isEditingEnabled ? 'cursor-pointer border-dashed hover:border-primary-500' : 'cursor-default border-solid opacity-80'}`}
                >
                  {disc.iconUrl ? (
                    <img src={disc.iconUrl} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} md:size={40} className="text-slate-300" />
                  )}
                  {isEditingEnabled && (
                    <div className="absolute inset-0 bg-primary-500/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Camera size={20} md:size={24} />
                    </div>
                  )}
                </div>
                <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-3 md:mt-4">Logo Disciplina</p>
              </div>

              <div className="w-full relative z-10 px-0 md:px-2">
                {isEditingEnabled ? (
                  <input 
                    value={disc.name}
                    onChange={e => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === disc.id ? {...d, name: e.target.value.toUpperCase()} : d)})}
                    placeholder="NOMBRE"
                    className="w-full bg-surface-ground p-3 md:p-4 rounded-xl md:rounded-2xl font-black text-xl md:text-2xl uppercase tracking-tighter text-center text-[var(--text-main)] outline-none border-2 border-transparent focus:border-primary-500/30 transition-all"
                  />
                ) : (
                  <h3 className="w-full font-black text-xl md:text-2xl uppercase tracking-tighter text-center text-[var(--text-main)] py-3 md:py-4 truncate px-2">{disc.name}</h3>
                )}
              </div>
            </div>
          ))}
          
          {isEditingEnabled && (
            <button onClick={addDiscipline} className="border-4 border-dashed border-[var(--surface-border)] rounded-[2rem] md:rounded-[3rem] p-10 md:p-16 flex flex-col items-center justify-center gap-4 md:gap-6 text-slate-400 hover:text-primary-500 hover:border-primary-500 transition-all bg-surface-card/50 group animate-fade-in min-h-[250px]">
               <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-surface-ground flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={32} md:size={40} />
               </div>
               <span className="font-bold uppercase text-[9px] md:text-[10px] tracking-[0.2em]">Nueva Disciplina</span>
            </button>
          )}
        </div>
      )}

      {/* --- TAB 3: REGLAS POR DISCIPLINA --- */}
      {activeTab === 'rules' && (
        <ReglasPorDisciplina disciplines={localConfig.disciplines} />
      )}

      {/* --- TAB 4: MATRIZ DEPORTIVA --- */}
      {activeTab === 'matrix' && (
        <div className="space-y-12 animate-fade-in">
          {/* Header de selección de disciplina */}
          <div className="bg-surface-card p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-[var(--surface-border)] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-primary-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-primary-500 shadow-inner shrink-0">
                    <LayoutGrid size={20} md:size={24} />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h4 className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">Disciplina Activa</h4>
                    <div className="relative group min-w-0">
                      <select 
                        value={selectedDiscId || ''}
                        onChange={e => setSelectedDiscId(e.target.value)}
                        className="w-full bg-transparent font-black text-lg md:text-2xl uppercase tracking-tighter text-[var(--text-main)] outline-none mt-1 cursor-pointer pr-10 appearance-none truncate"
                      >
                        {localConfig.disciplines.length === 0 && (
                          <option value="" className="bg-surface-card text-[var(--text-main)] font-sans text-sm p-4 text-[var(--text-muted)]">
                            No hay disciplinas
                          </option>
                        )}
                        {localConfig.disciplines.map(d => (
                          <option 
                            key={d.id} 
                            value={d.id} 
                            className="bg-surface-card text-[var(--text-main)] font-sans text-sm p-4 uppercase tracking-widest font-bold"
                          >
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-hover:text-primary-500 transition-colors">
                        <ChevronDown size={22} />
                      </div>
                    </div>
                  </div>
              </div>
              {selectedDiscipline && (
                <div className="flex items-center gap-4 bg-surface-ground p-4 rounded-3xl border border-[var(--surface-border)] w-full md:w-auto overflow-hidden">
                   <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shadow-sm border border-slate-100 p-1 flex items-center justify-center shrink-0">
                      {selectedDiscipline.iconUrl ? (
                        <img src={selectedDiscipline.iconUrl} className="w-full h-full object-contain" />
                      ) : (
                        <Shield size={20} className="text-slate-300" />
                      )}
                   </div>
                   <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[10px] uppercase tracking-widest text-primary-500 leading-none truncate">Configuración Técnica</span>
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest mt-1 truncate">Sincronizado</span>
                   </div>
                </div>
              )}
          </div>

          {selectedDiscipline ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               {selectedDiscipline.branches.map(branch => (
                 <div key={branch.gender} className={`rounded-[3.5rem] p-6 md:p-8 lg:p-12 border transition-all overflow-hidden ${branch.enabled ? 'bg-surface-card border-[var(--surface-border)] shadow-xl' : 'bg-surface-ground/50 border-[var(--surface-border)] opacity-40 grayscale'}`}>
                    <div className="flex flex-wrap justify-between items-center mb-10 gap-4">
                        <label className={`flex items-center gap-4 ${isEditingEnabled ? 'cursor-pointer' : 'cursor-default'}`}>
                          <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${branch.enabled ? 'bg-primary-500 border-primary-500 shadow-lg shadow-primary-500/30' : 'border-slate-300'}`}>
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
                              {branch.enabled && <CheckCircle size={16} className="text-primary-contrast" />}
                          </div>
                          <h4 className="font-black uppercase text-2xl tracking-tighter text-[var(--text-main)] flex items-center gap-3 italic truncate">
                             <User size={24} className={branch.gender === 'Masculino' ? 'text-blue-500' : 'text-primary-500'} />
                             Rama {branch.gender}
                          </h4>
                        </label>
                        {branch.enabled && isEditingEnabled && (
                          <button onClick={() => addCategory(selectedDiscipline.id, branch.gender)} className="flex items-center gap-2 bg-slate-900 dark:bg-primary-500 dark:text-primary-contrast px-6 py-3 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl whitespace-nowrap">
                             <Plus size={14} /> Nueva Categoría
                          </button>
                        )}
                    </div>

                    {branch.enabled && (
                      <div className="space-y-4">
                        {branch.categories.map(cat => {
                          const isExpanded = expandedCategories[cat.id];
                          return (
                            <div key={cat.id} className={`group/cat transition-all duration-500 w-full ${isExpanded ? 'bg-surface-ground rounded-[2rem] md:rounded-[2.5rem] p-3 md:p-6' : 'bg-transparent'}`}>
                              {/* Header Acordeón */}
                              <div className="flex items-center gap-3 md:gap-4 w-full overflow-hidden">
                                <div 
                                  onClick={() => toggleCategory(cat.id)}
                                  className={`w-full flex items-center justify-between p-3 md:p-6 rounded-2xl md:rounded-3xl transition-all border overflow-hidden cursor-pointer ${isExpanded ? 'bg-surface-card border-primary-500/30 shadow-xl' : 'bg-surface-ground border-transparent hover:border-slate-300 dark:hover:border-white/10'}`}
                                >
                                  <div className="flex items-center gap-3 md:gap-6 min-w-0 flex-1">
                                     <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-colors shrink-0 ${isExpanded ? 'bg-primary-500 text-primary-contrast shadow-lg shadow-primary-500/30' : 'bg-surface-ground text-slate-500'}`}>
                                        <Target size={18} md:size={20} />
                                     </div>
                                     <div className="flex flex-col items-start min-w-0 flex-1">
                                        {isEditingEnabled ? (
                                          <input 
                                            value={cat.name}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setLocalConfig({...localConfig, disciplines: localConfig.disciplines.map(d => d.id === selectedDiscipline.id ? {...d, branches: d.branches.map(b => b.gender === branch.gender ? {...b, categories: b.categories.map(c => c.id === cat.id ? {...c, name: e.target.value.toUpperCase()} : c)} : b)} : d)})}
                                            className="w-full bg-transparent font-black uppercase text-sm md:text-lg tracking-tighter text-[var(--text-main)] outline-none focus:border-b-2 border-primary-500 truncate"
                                          />
                                        ) : (
                                          <span className="w-full font-black uppercase text-sm md:text-lg tracking-tighter text-[var(--text-main)] leading-none truncate text-left">{cat.name}</span>
                                        )}
                                        <span className="text-[7px] md:text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-[0.3em] mt-1 md:mt-2 truncate w-full text-left">{cat.metrics.length} Parámetros Técnicos</span>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-2">
                                     {isEditingEnabled && (
                                       <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirm({ 
                                              type: 'category', 
                                              id: cat.id, 
                                              name: cat.name, 
                                              discId: selectedDiscipline.id, 
                                              gender: branch.gender 
                                            });
                                          }}
                                          className="p-1.5 md:p-2 text-slate-300 hover:text-red-500 transition-colors"
                                       >
                                          <Trash2 size={14} md:size={16} />
                                       </button>
                                     )}
                                     <div className={`transition-transform duration-500 ${isExpanded ? 'rotate-180 text-primary-500' : 'text-slate-400'}`}>
                                        <ChevronDown size={18} md:size={20} />
                                     </div>
                                  </div>
                                </div>
                              </div>

                              {/* Body Acordeón (Métricas) */}
                              <div className={`grid transition-all duration-500 ease-in-out w-full ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 pointer-events-none overflow-hidden'}`}>
                                <div className="overflow-hidden w-full">
                                   <div className="space-y-3 mb-6 w-full">
                                      {cat.metrics.map(metric => (
                                        <div key={metric.id} className="flex items-center gap-4 bg-surface-card p-4 md:p-5 rounded-2xl shadow-sm border border-[var(--surface-border)] group/row w-full overflow-hidden">
                                           <div className="w-8 h-8 rounded-lg bg-surface-ground flex items-center justify-center text-slate-400 group-hover/row:text-primary-500 transition-colors shrink-0">
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
                                                  className={`w-10 md:w-12 text-center font-black text-xs py-1.5 rounded-lg outline-none transition-colors ${isEditingEnabled ? 'bg-surface-ground dark:bg-slate-700' : 'bg-transparent'}`} 
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
                                        className="w-full py-4 border-2 border-dashed border-[var(--surface-border)] rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:text-primary-500 hover:border-primary-500 transition-all group/addkpi"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-surface-ground flex items-center justify-center group-hover/addkpi:bg-primary-500 group-hover/addkpi:text-primary-contrast transition-all shrink-0">
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
            <div className="py-32 text-center bg-surface-card rounded-[4rem] border border-[var(--surface-border)] shadow-inner">
               <Shield size={64} className="mx-auto mb-6 text-[var(--surface-border)]" />
               <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">Selecciona una disciplina para gestionar su matriz</p>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 5: RIVALES POR DISCIPLINA --- */}
      {activeTab === 'rivals' && (
        <RivalesPorDisciplina disciplines={localConfig.disciplines} />
      )}

      {/* --- TAB 6: PUESTOS POR DISCIPLINA --- */}
      {activeTab === 'positions' && (
        <PosicionesPorDisciplina disciplines={localConfig.disciplines} />
      )}

      {/* --- MODAL DE ELIMINACIÓN --- */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-12 max-w-md w-full shadow-2xl relative z-10 overflow-hidden"
            >
              {/* Background gradient effect */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
              
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-8 shadow-inner">
                  <Trash2 size={40} md:size={48} />
                </div>
                
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-4 italic text-[var(--text-main)]">
                  Confirmar Eliminación
                </h3>
                
                <div className="space-y-4 mb-10">
                  <p className="text-[var(--text-muted)] text-sm md:text-base leading-relaxed">
                    Estás por eliminar <span className="text-[var(--text-main)] font-black italic">"{deleteConfirm.name}"</span>.
                  </p>
                  
                  <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 md:p-6">
                    <p className="text-red-500 text-[10px] md:text-[11px] font-black uppercase tracking-widest leading-relaxed">
                      ⚠️ Esta acción es irreversible y eliminará en cascada todas las categorías, métricas y datos relacionados vinculados.
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <button 
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-8 py-5 rounded-2xl bg-surface-ground hover:bg-surface-hover text-[var(--text-muted)] font-bold uppercase text-[10px] tracking-widest transition-all"
                  >
                    Mantener
                  </button>
                  <button 
                    onClick={executeDelete}
                    className="flex-1 px-8 py-5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 transition-all hover:scale-105 active:scale-95"
                  >
                    Eliminar Todo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MasterData;
