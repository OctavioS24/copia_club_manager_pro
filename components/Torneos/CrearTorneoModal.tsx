
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
    setFixtureBase([...fixturebase, {
      id: crypto.randomUUID(),
      rival: '',
      date: new Date().toISOString().split('T')[0],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/10 rounded-xl">
              <Trophy className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">Crear Nuevo Torneo</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Paso {step} de 4</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Nombre del Torneo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Liga Cordobesa 2024"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-pink-500/50 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Tipo de Torneo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-pink-500/50 outline-none"
                  >
                    <option value="Professional">Liga / Oficial</option>
                    <option value="Internal">Copa / Interno</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Disciplina</label>
                  <select
                    value={disciplineId}
                    onChange={(e) => setDisciplineId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-pink-500/50 outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {disciplines.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Rama / Género</label>
                <div className="grid grid-cols-2 gap-4">
                  {(['Masculino', 'Femenino'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-3 rounded-xl font-bold transition-all border ${
                        gender === g 
                          ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-900/20' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Categorías Participantes</label>
                <span className="text-xs font-bold text-pink-500 bg-pink-500/10 px-2 py-1 rounded">
                  {assignedcategories.length} Seleccionadas
                </span>
              </div>
              
              {!disciplineId ? (
                <div className="p-8 text-center bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
                  <p className="text-slate-500">Primero selecciona una disciplina en el paso anterior</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {availableCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-4 rounded-xl font-bold text-sm transition-all border flex flex-col items-center gap-2 ${
                        assignedcategories.includes(cat.id)
                          ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-900/20'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Shield className={`w-5 h-5 ${assignedcategories.includes(cat.id) ? 'text-white' : 'text-slate-500'}`} />
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Equilibrio Local/Visitante</h3>
                <p className="text-xs text-slate-500">Selecciona qué categorías arrancan con la condición opuesta al fixture base. Por ejemplo, si el fixture base dice que la Fecha 1 es Local, las categorías marcadas como "Invertida" jugarán de Visitante.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {assignedcategories.map(catId => {
                  const cat = availableCategories.find(c => c.id === catId);
                  const isInverted = categoryConditions[catId] === 'Inverted';
                  return (
                    <div key={catId} className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-slate-500" />
                        <span className="font-bold text-white uppercase tracking-tight">{cat?.name}</span>
                      </div>
                      <button
                        onClick={() => toggleCategoryCondition(catId)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          isInverted 
                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fixture Base</label>
                <button
                  onClick={handleAddFixture}
                  className="flex items-center gap-2 text-xs font-bold text-pink-500 hover:text-pink-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  AGREGAR FECHA
                </button>
              </div>

              <div className="space-y-4">
                {fixturebase.length > 0 ? (
                  fixturebase.map((fixture, index) => (
                    <div key={fixture.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Fecha {index + 1}</span>
                        <button 
                          onClick={() => handleRemoveFixture(fixture.id)}
                          className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Rival</label>
                          <select
                            value={fixture.rival}
                            onChange={(e) => handleUpdateFixture(fixture.id, 'rival', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-pink-500"
                          >
                            <option value="">Seleccionar Rival...</option>
                            {rivals
                              .filter(r => !fixturebase.some((f, i) => i !== index && f.rival === r.name))
                              .map(r => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                              ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha</label>
                          <input
                            type="date"
                            value={fixture.date}
                            onChange={(e) => handleUpdateFixture(fixture.id, 'date', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Condición</label>
                          <select
                            value={fixture.condition}
                            onChange={(e) => handleUpdateFixture(fixture.id, 'condition', e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none"
                          >
                            <option value="Local">Local</option>
                            <option value="Visitante">Visitante</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                    <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No has agregado fechas al fixture base</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-between bg-slate-900/50 rounded-b-3xl">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              step === 1 ? 'opacity-0 pointer-events-none' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            ANTERIOR
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!name || (step === 1 && !disciplineId) || (step === 2 && assignedcategories.length === 0)}
              className="flex items-center gap-2 px-8 py-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:hover:bg-pink-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-pink-900/20"
            >
              SIGUIENTE
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || fixturebase.length === 0}
              className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-900/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  CREANDO...
                </>
              ) : (
                <>
                  CREAR TORNEO
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
