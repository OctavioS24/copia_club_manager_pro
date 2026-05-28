
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Shield, Trophy, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { Tournament, Rival, Discipline, MatchFixture } from '../../types';
import { getRivals } from '../../lib/rivals';
import { createTournament } from '../../lib/torneos';
import { db } from '../../lib/supabase';

interface CrearTorneoModalProps {
  onClose: () => void;
  onSuccess: () => void;
  clubName: string;
}

const CrearTorneoModal: React.FC<CrearTorneoModalProps> = ({ onClose, onSuccess, clubName }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  
  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'Professional' | 'Internal'>('Professional');
  const [disciplineId, setDisciplineId] = useState('');
  const [gender, setGender] = useState<'Masculino' | 'Femenino'>('Masculino');
  const [assignedcategories, setAssignedCategories] = useState<string[]>([]);
  const [categoryConditions, setCategoryConditions] = useState<Record<string, 'Normal' | 'Inverted'>>({});
  const [fixturebase, setFixtureBase] = useState<MatchFixture[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: dData } = await db.config.get();
      if (dData?.disciplines) setDisciplines(dData.disciplines);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  useEffect(() => {
    if (disciplineId) {
      const disc = disciplines.find(d => d.id === disciplineId);
      if (disc) {
        getRivals(disc.name).then(setRivals).catch(console.error);
      }
    } else {
      setRivals([]);
    }
  }, [disciplineId, disciplines]);

  const handleAddFixture = () => {
    let nextDate = new Date().toISOString().split('T')[0];
    
    if (fixturebase.length > 0) {
      const lastDate = new Date(fixturebase[fixturebase.length - 1].date);
      lastDate.setDate(lastDate.getDate() + 7); // Default to next week
      nextDate = lastDate.toISOString().split('T')[0];
    }

    setFixtureBase([...fixturebase, {
      id: crypto.randomUUID(),
      rival: '',
      date: nextDate,
      condition: 'Local'
    }]);
  };

  const handleRemoveFixture = (id: string) => {
    setFixtureBase(fixturebase.filter(f => f.id !== id));
  };

  const handleUpdateFixture = (id: string, field: keyof MatchFixture, value: any) => {
    setFixtureBase(fixturebase.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const toggleCategory = (catId: string) => {
    setAssignedCategories(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const toggleCategoryCondition = (catId: string) => {
    setCategoryConditions(prev => ({
      ...prev,
      [catId]: prev[catId] === 'Inverted' ? 'Normal' : 'Inverted'
    }));
  };

  const handleSubmit = async () => {
    if (!name || !disciplineId || assignedcategories.length === 0) return;

    // Validate fixture base
    if (fixturebase.length === 0) {
      alert('DEBES AGREGAR AL MENOS UNA FECHA AL FIXTURE.');
      return;
    }

    const invalidEntries = fixturebase.some(f => !f.rival || !f.date);
    if (invalidEntries) {
      alert('TODAS LAS FECHAS DEBEN TENER UN RIVAL Y UNA FECHA ASIGNADA.');
      return;
    }

    // Validate duplicate dates
    const dates = fixturebase.map(f => f.date.trim());
    const hasDuplicates = dates.some((date, index) => dates.indexOf(date) !== index);
    
    if (hasDuplicates) {
      const duplicateDate = dates.find((date, index) => dates.indexOf(date) !== index);
      alert('NO PUEDES TENER DOS FECHAS PROGRAMADAS PARA EL MISMO DÍA (Detección de Duplicados en: ' + duplicateDate + '). POR FAVOR CORRIGE LAS FECHAS.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const tournamentData: Partial<Tournament> = {
        name,
        type,
        discipline_id: disciplineId,
        gender,
        assigned_categories: assignedcategories,
        category_conditions: categoryConditions,
        fixture_base: fixturebase,
        status: 'Open',
        settings: {
          has_groups: false,
          groups_count: 0,
          advancing_per_group: 0,
          has_playoffs: false,
          playoff_start: 'F',
          dates_count: fixturebase.length
        }
      };

      await createTournament(tournamentData, clubName);
      onSuccess();
    } catch (error) {
      console.error('Error creating tournament:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDiscipline = disciplines.find(d => d.id === disciplineId);
  const availableCategories = selectedDiscipline?.branches.find(b => b.gender === gender)?.categories || [];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-[var(--surface-border)]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-500/10 rounded-2xl">
              <Trophy className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Nuevo Campeonato</h2>
              <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] mt-1">Configuración del Sistema • Paso {step} de 4</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-ground rounded-xl transition-all">
            <X className="w-6 h-6 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-4">Identificación del Torneo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: LIGA NACIONAL DE PROFESIONALES 2024"
                  className="w-full px-6 py-5 bg-surface-ground border-2 border-[var(--surface-border)] rounded-3xl text-[var(--text-main)] font-bold text-sm focus:border-primary-500 outline-none transition-all placeholder:opacity-30 uppercase tracking-widest"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-4">Sistema de Competencia</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-6 py-5 bg-surface-ground border-2 border-[var(--surface-border)] rounded-3xl text-[var(--text-main)] font-black text-xs uppercase tracking-widest focus:border-primary-500 outline-none transition-all appearance-none"
                  >
                    <option value="Professional" className="bg-surface-card">Liga Oficial / AFA</option>
                    <option value="Internal" className="bg-surface-card">Copa Interna / Amistoso</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-4">Disciplina Deportiva</label>
                  <select
                    value={disciplineId}
                    onChange={(e) => setDisciplineId(e.target.value)}
                    className="w-full px-6 py-5 bg-surface-ground border-2 border-[var(--surface-border)] rounded-3xl text-[var(--text-main)] font-black text-xs uppercase tracking-widest focus:border-primary-500 outline-none transition-all appearance-none"
                  >
                    <option value="" className="bg-surface-card">Seleccionar Disciplina...</option>
                    {disciplines.map(d => (
                      <option key={d.id} value={d.id} className="bg-surface-card">{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-4">Rama Competitiva</label>
                <div className="grid grid-cols-2 gap-4">
                  {(['Masculino', 'Femenino'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-5 rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] transition-all border-2 ${
                        gender === g 
                          ? 'bg-primary-600 border-primary-500 text-white shadow-xl shadow-primary-900/20' 
                          : 'bg-surface-ground border-[var(--surface-border)] text-[var(--text-muted)] hover:border-primary-500/50'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between ml-4">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Categorías de la Disciplina</label>
                <span className="text-[10px] font-black text-primary-500 bg-primary-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest border border-primary-500/20">
                  {assignedcategories.length} Habilitadas
                </span>
              </div>
              
              {!disciplineId ? (
                <div className="p-12 text-center bg-surface-ground rounded-[2.5rem] border-2 border-dashed border-[var(--surface-border)]">
                  <p className="text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest opacity-40">Regresa al paso anterior para seleccionar una disciplina</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {availableCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-6 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all border-2 flex flex-col items-center gap-4 ${
                        assignedcategories.includes(cat.id)
                          ? 'bg-surface-ground border-primary-500 text-primary-500 shadow-xl shadow-primary-900/5'
                          : 'bg-surface-ground border-[var(--surface-border)] text-[var(--text-muted)] hover:border-primary-500/30'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${assignedcategories.includes(cat.id) ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'bg-surface-card text-[var(--text-muted)]'}`}>
                        <Shield className="w-6 h-6" />
                      </div>
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-3 px-4">
                <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-tighter italic">Sincronización de localía</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest leading-relaxed opacity-60">Configura qué categorías invierten su condición respecto al fixture base para optimizar la logística del club.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {assignedcategories.map(catId => {
                  const cat = availableCategories.find(c => c.id === catId);
                  const isInverted = categoryConditions[catId] === 'Inverted';
                  return (
                    <div key={catId} className="flex items-center justify-between p-6 bg-surface-ground border-2 border-[var(--surface-border)] rounded-3xl hover:border-primary-500/20 transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-surface-card rounded-2xl shadow-inner">
                          <Shield className="w-6 h-6 text-primary-500" />
                        </div>
                        <span className="font-black text-[var(--text-main)] uppercase tracking-[0.1em] text-sm">{cat?.name}</span>
                      </div>
                      <button
                        onClick={() => toggleCategoryCondition(catId)}
                        className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          isInverted 
                            ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/20' 
                            : 'bg-surface-card text-[var(--text-muted)] hover:text-primary-500 border border-[var(--surface-border)]'
                        }`}
                      >
                        {isInverted ? 'Condición Invertida' : 'Condición Normal'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between px-4">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Fixture Base de Referencia</label>
                <button
                  onClick={handleAddFixture}
                  className="flex items-center gap-2 text-[9px] font-black bg-primary-600/10 text-primary-500 px-4 py-2 rounded-full hover:bg-primary-600 hover:text-white transition-all uppercase tracking-widest border border-primary-500/20 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  AGREGAR FECHA
                </button>
              </div>

              <div className="space-y-6">
                {fixturebase.length > 0 ? (
                  fixturebase.map((fixture, index) => (
                    <div key={fixture.id} className="bg-surface-ground border-2 border-[var(--surface-border)] rounded-[2rem] p-8 space-y-6 shadow-sm hover:border-primary-500/20 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-primary-500 uppercase tracking-[0.3em] italic">FECHA {index + 1}</span>
                        <button 
                          onClick={() => handleRemoveFixture(fixture.id)}
                          className="p-2.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Institución Rival</label>
                          <select
                            value={fixture.rival}
                            onChange={(e) => handleUpdateFixture(fixture.id, 'rival', e.target.value)}
                            className="w-full px-4 py-3 bg-surface-card border border-[var(--surface-border)] rounded-2xl text-[var(--text-main)] font-black text-[10px] uppercase tracking-widest outline-none focus:border-primary-500 transition-all appearance-none"
                          >
                            <option value="">Seleccionar...</option>
                            {rivals
                              .filter(r => !fixturebase.some((f, i) => i !== index && f.rival === r.name))
                              .map(r => (
                                <option key={r.id} value={r.name} className="bg-surface-card">{r.name}</option>
                              ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Calendario</label>
                          <input
                            type="date"
                            value={fixture.date}
                            onChange={(e) => handleUpdateFixture(fixture.id, 'date', e.target.value)}
                            className="w-full px-4 py-3 bg-surface-card border border-[var(--surface-border)] rounded-2xl text-[var(--text-main)] font-black text-[10px] uppercase tracking-widest outline-none focus:border-primary-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Condición Base</label>
                          <select
                            value={fixture.condition}
                            onChange={(e) => handleUpdateFixture(fixture.id, 'condition', e.target.value as any)}
                            className="w-full px-4 py-3 bg-surface-card border border-[var(--surface-border)] rounded-2xl text-[var(--text-main)] font-black text-[10px] uppercase tracking-widest outline-none focus:border-primary-500 transition-all appearance-none"
                          >
                            <option value="Local" className="bg-surface-card">Sede Local</option>
                            <option value="Visitante" className="bg-surface-card">Sede Visitante</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
                    <Calendar className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
                    <p className="text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest opacity-40">Define el calendario de encuentros oficial</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-[var(--surface-border)] flex items-center justify-between bg-surface-ground">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest ${
              step === 1 ? 'opacity-0 pointer-events-none' : 'bg-surface-card text-[var(--text-muted)] hover:text-primary-500 border border-[var(--surface-border)] shadow-sm'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Retroceder
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!name || (step === 1 && !disciplineId) || (step === 2 && assignedcategories.length === 0)}
              className="flex items-center gap-3 px-10 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600 text-white rounded-2xl font-black transition-all shadow-xl shadow-primary-900/20 uppercase text-[10px] tracking-widest"
            >
              Siguiente Fase
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || fixturebase.length === 0}
              className="flex items-center gap-3 px-10 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black transition-all shadow-xl shadow-emerald-500/20 uppercase text-[10px] tracking-widest"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  Lanzar Torneo
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CrearTorneoModal;
