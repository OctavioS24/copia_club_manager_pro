import React, { useState } from 'react';
import { Trophy, X, Calendar, Hash, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/supabase';
import { ClubConfig, TournamentType, Tournament } from '../../types';

interface CrearTorneoProps {
  onClose: () => void;
  onSuccess: () => void;
  clubConfig: ClubConfig;
  defaultDisciplineId?: string;
  defaultGender?: 'Masculino' | 'Femenino';
}

const CrearTorneo: React.FC<CrearTorneoProps> = ({ onClose, onSuccess, clubConfig, defaultDisciplineId, defaultGender }) => {
  const [name, setName] = useState('');
  const [datesCount, setDatesCount] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [type, setType] = useState<TournamentType>('Internal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flatten all categories from all disciplines and branches
  const allCategories = clubConfig.disciplines.flatMap(d => 
    d.branches.flatMap(b => 
      b.categories.map(c => ({
        id: c.id,
        displayName: `${d.name} - ${b.gender} - ${c.name}`,
        disciplineName: d.name,
        categoryName: c.name,
        gender: b.gender
      }))
    )
  );

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!name.trim()) {
      setError('El nombre del torneo es obligatorio');
      return;
    }

    if (selectedCategories.length === 0) {
      setError('Debes seleccionar al menos una categoría participante');
      return;
    }

    setIsSubmitting(true);
    try {
      const tournamentId = crypto.randomUUID();
      const newTournament: Partial<Tournament> = {
        id: tournamentId,
        name: name.toUpperCase(),
        type,
        disciplineid: defaultDisciplineId || '',
        categoryid: '', // Will be assigned categories
        gender: defaultGender || 'Masculino',
        status: 'Open',
        settings: {
          has_groups: false,
          groups_count: 1,
          advancing_per_group: 2,
          has_playoffs: false,
          playoff_start: 'F',
          dates_count: datesCount
        },
        assignedcategories: selectedCategories,
        fixturebase: [],
        created_at: new Date().toISOString()
      };

      const { error: dbError } = await db.tournaments.upsert(newTournament as any);
      if (dbError) throw dbError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error al crear torneo:', err);
      setError(err.message || 'Error al crear el torneo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl font-bold text-sm outline-none border border-transparent dark:border-white/5 focus:border-primary-600 shadow-inner dark:text-white transition-all";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block";

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white dark:bg-[#0f121a] w-full max-w-2xl rounded-[3rem] shadow-2xl border border-secondary-500/30 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-600/10 rounded-2xl">
                <Trophy className="text-primary-600" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white">Nuevo Torneo</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuración de competencia</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-10 space-y-10 overflow-y-auto max-h-[70vh] custom-scrollbar">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest text-center"
              >
                {error}
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Nombre */}
              <div className="space-y-2">
                <label className={labelClasses}>Nombre del Torneo</label>
                <div className="relative">
                  <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="EJ: COPA PLEGMA 2026"
                    className={inputClasses}
                  />
                </div>
              </div>

              {/* Cantidad de fechas */}
              <div className="space-y-2">
                <label className={labelClasses}>Cantidad de Fechas</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number"
                    min="1"
                    value={datesCount}
                    onChange={e => setDatesCount(parseInt(e.target.value) || 1)}
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>

            {/* Categorías Participantes */}
            <div className="space-y-4">
              <label className={labelClasses}>Categorías Participantes</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allCategories.map(cat => {
                  const isSelected = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`group relative p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border-2 text-left flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-600/20 scale-[1.02]'
                          : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:border-primary-600/50'
                      }`}
                    >
                      <span className="opacity-60 text-[8px]">{cat.disciplineName}</span>
                      <span className="truncate w-full">{cat.categoryName}</span>
                      <span className="opacity-60 text-[8px] italic">{cat.gender}</span>
                      
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipo de Torneo */}
            <div className="space-y-4">
              <label className={labelClasses}>Tipo de Torneo</label>
              <div className="grid grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => setType('Internal')}
                  className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 ${
                    type === 'Internal' ? 'border-primary-600 bg-primary-600/5' : 'border-slate-100 dark:border-white/5 opacity-40'
                  }`}
                >
                  <Calendar size={32} className={type === 'Internal' ? 'text-primary-600' : 'text-slate-400'} />
                  <span className="text-sm font-black uppercase italic dark:text-white">Interno</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('Professional')}
                  className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 ${
                    type === 'Professional' ? 'border-primary-600 bg-primary-600/5' : 'border-slate-100 dark:border-white/5 opacity-40'
                  }`}
                >
                  <Trophy size={32} className={type === 'Professional' ? 'text-primary-600' : 'text-slate-400'} />
                  <span className="text-sm font-black uppercase italic dark:text-white">Profesional</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-10 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/40 flex gap-6">
            <button 
              onClick={onClose}
              className="flex-1 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] py-5 bg-secondary-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-secondary-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Check size={20} strokeWidth={3} />
                  Crear Torneo
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CrearTorneo;
