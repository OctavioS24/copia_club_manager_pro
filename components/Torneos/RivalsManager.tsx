
import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getRivals } from '../../lib/torneos';
import { Rival } from '../../types';
import { supabase } from '../../lib/supabase';

interface RivalsManagerProps {
  onClose: () => void;
}

const RivalsManager: React.FC<RivalsManagerProps> = ({ onClose }) => {
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newRivalName, setNewRivalName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRivals = async () => {
    setIsLoading(true);
    try {
      const data = await getRivals();
      setRivals(data);
    } catch (error) {
      console.error('Error loading rivals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRivals();
  }, []);

  const handleAddRival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRivalName.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('rivals')
        .insert([{ name: newRivalName.toUpperCase() }]);
      
      if (error) throw error;
      
      setNewRivalName('');
      loadRivals();
    } catch (error) {
      console.error('Error adding rival:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRival = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este rival?')) return;

    try {
      const { error } = await supabase
        .from('rivals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      loadRivals();
    } catch (error) {
      console.error('Error deleting rival:', error);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white dark:bg-[#0f121a] w-full max-w-xl rounded-[3rem] shadow-2xl border border-secondary-500/30 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-600/10 rounded-2xl">
                <Shield className="text-primary-600" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white">Gestión de Rivales</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base de datos de clubes externos</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-10 space-y-8 flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {/* Add Form */}
            <form onSubmit={handleAddRival} className="flex gap-4">
              <input 
                value={newRivalName}
                onChange={e => setNewRivalName(e.target.value.toUpperCase())}
                placeholder="NOMBRE DEL CLUB RIVAL..."
                className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl font-bold text-sm outline-none border border-transparent dark:border-white/5 focus:border-primary-600 shadow-inner dark:text-white transition-all"
              />
              <button 
                type="submit"
                disabled={isSubmitting || !newRivalName.trim()}
                className="bg-secondary-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-secondary-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} strokeWidth={3} />}
                Agregar
              </button>
            </form>

            {/* Rivals List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-primary-600" size={32} />
                </div>
              ) : rivals.length > 0 ? (
                rivals.map(rival => (
                  <div 
                    key={rival.id}
                    className="flex items-center justify-between p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-secondary-500/10 group hover:border-primary-600/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                        <Shield size={18} className="text-slate-400 group-hover:text-primary-600 transition-colors" />
                      </div>
                      <span className="font-black uppercase italic text-sm dark:text-white">{rival.name}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteRival(rival.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-white/10">
                  <Shield size={40} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No hay rivales registrados</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/40 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">Total: {rivals.length} rivales registrados</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RivalsManager;
