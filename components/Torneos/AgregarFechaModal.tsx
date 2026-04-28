
import React, { useState } from 'react';
import { X, Calendar, Shield, Loader2, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Rival, MatchFixture } from '../../types';
import { agregarFecha } from '../../lib/torneos';

interface AgregarFechaModalProps {
  tournamentId: string;
  categories: string[];
  rivals: Rival[];
  clubName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AgregarFechaModal: React.FC<AgregarFechaModalProps> = ({ 
  tournamentId, 
  categories, 
  rivals, 
  clubName, 
  onClose, 
  onSuccess 
}) => {
  const [rival, setRival] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [condition, setCondition] = useState<'Local' | 'Visitante'>('Local');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rival) return;

    setIsSubmitting(true);
    try {
      const fechaData: MatchFixture = {
        id: crypto.randomUUID(),
        rival,
        date,
        condition
      };

      await agregarFecha(tournamentId, fechaData, categories, clubName);
      onSuccess();
    } catch (error) {
      console.error('Error adding fecha:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-600/10 rounded-2xl">
                <Calendar className="text-primary-600" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Agregar Nueva Fecha</h2>
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Programar partidos para todas las categorías</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Rival</label>
            <div className="relative">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <select
                value={rival}
                onChange={(e) => setRival(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:border-primary-600 transition-all"
                required
              >
                <option value="">SELECCIONAR RIVAL...</option>
                {rivals.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:border-primary-600 transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3">Condición</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:border-primary-600 transition-all"
              >
                <option value="Local">Local</option>
                <option value="Visitante">Visitante</option>
              </select>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !rival}
              className="w-full py-5 bg-primary-600 hover:bg-pink-700 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg shadow-pink-600/20 flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  PROCESANDO...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  AGREGAR Y REPLICAR FECHA
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AgregarFechaModal;
