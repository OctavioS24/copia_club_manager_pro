
import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, Shield, Loader2, Save, X, LayoutGrid
} from 'lucide-react';
import { Discipline, Rival } from '../../types';
import { getRivals, createRival, updateRival, deleteRival } from '../../lib/rivals';

interface RivalesPorDisciplinaProps {
  disciplines: Discipline[];
}

const RivalesPorDisciplina: React.FC<RivalesPorDisciplinaProps> = ({ disciplines }) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>(disciplines[0]?.name || '');
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    let active = true;
    const fetchRivals = async () => {
      setIsLoading(true);
      try {
        const data = await getRivals(selectedDiscipline);
        if (active) {
          setRivals(data);
        }
      } catch (error) {
        console.error('Error fetching rivals:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    if (selectedDiscipline) {
      fetchRivals();
    }

    return () => { active = false; };
  }, [selectedDiscipline]);

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setIsSaving(true);
    try {
      const newRival = await createRival(newValue.trim().toUpperCase(), selectedDiscipline);
      if (newRival) {
        setRivals(prev => [...prev, newRival].sort((a, b) => a.name.localeCompare(b.name)));
        setNewValue('');
      }
    } catch (error) {
      console.error('Error adding rival:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editValue.trim()) return;
    setIsSaving(true);
    try {
      const updated = await updateRival(id, editValue.trim().toUpperCase());
      if (updated) {
        setRivals(rivals.map(r => r.id === id ? { ...r, name: editValue.trim().toUpperCase() } : r).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error updating rival:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este rival?')) return;
    setIsSaving(true);
    try {
      await deleteRival(id);
      setRivals(rivals.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting rival:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Selector de Disciplina */}
      <div className="bg-white dark:bg-[#0f1219] p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 shadow-2xl">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary-600/10 rounded-xl md:rounded-2xl flex items-center justify-center text-primary-600 shadow-inner shrink-0">
            <LayoutGrid size={20} md:size={24} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Disciplina Seleccionada</h4>
            <div className="relative group">
              <select 
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                className="w-full bg-transparent font-black text-lg md:text-2xl uppercase tracking-tighter dark:text-white outline-none mt-1 cursor-pointer pr-10 appearance-none truncate"
              >
                {disciplines.map(d => (
                  <option key={d.id} value={d.name} className="bg-slate-900 text-white font-sans text-sm p-4">
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-primary-600 transition-colors">
                <ChevronDown size={22} className="md:size-24" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Rivales */}
      <div className="bg-white dark:bg-[#0f1219] rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 dark:border-white/5 p-6 md:p-12 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 md:mb-10">
          <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter dark:text-white italic flex items-center gap-3">
            <Shield size={20} md:size={24} className="text-primary-600 flex-shrink-0" />
            <span className="truncate">Rivales para {selectedDiscipline}</span>
          </h3>
          <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {rivals.length} Registrados
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary-600" size={40} />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando rivales...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rivals.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2rem]">
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest italic">No hay rivales creados para esta disciplina</p>
              </div>
            ) : (
              rivals.map((rival) => (
                <div key={rival.id} className="group flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-transparent hover:border-primary-500/30 transition-all">
                  <div className="flex-1">
                    {editingId === rival.id ? (
                      <input 
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(rival.id)}
                        className="w-full bg-white dark:bg-slate-800 px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-widest text-primary-500 outline-none border-2 border-primary-500/50"
                      />
                    ) : (
                      <span className="font-black text-sm uppercase tracking-widest dark:text-white px-4">
                        {rival.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === rival.id ? (
                      <>
                        <button onClick={() => handleUpdate(rival.id)} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all">
                          <Save size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-400/10 rounded-lg transition-all">
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setEditingId(rival.id);
                            setEditValue(rival.name);
                          }}
                          className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(rival.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Input para nuevo rival */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-4">
                <input 
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="NOMBRE DEL CLUB RIVAL..."
                  className="flex-1 bg-slate-50 dark:bg-white/5 px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest dark:text-white outline-none border-2 border-transparent focus:border-primary-500/30 transition-all"
                />
                <button 
                  onClick={handleAdd}
                  disabled={!newValue.trim() || isSaving}
                  className="bg-primary-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RivalesPorDisciplina;
