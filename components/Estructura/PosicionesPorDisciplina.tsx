
import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, ChevronUp, ChevronDown, 
  Shield, Loader2, Save, X, LayoutGrid
} from 'lucide-react';
import { Discipline, DisciplinePosition } from '../../types';
import { 
  getPositionsByDiscipline, 
  createPosition, 
  updatePosition, 
  deletePosition, 
  reorderPositions 
} from '../../lib/disciplinePositions';

interface PosicionesPorDisciplinaProps {
  disciplines: Discipline[];
}

const PosicionesPorDisciplina: React.FC<PosicionesPorDisciplinaProps> = ({ disciplines }) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>(disciplines[0]?.name || '');
  const [positions, setPositions] = useState<DisciplinePosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    let active = true;
    const fetchPositions = async () => {
      setIsLoading(true);
      const data = await getPositionsByDiscipline(selectedDiscipline);
      if (active) {
        setPositions(data);
        setIsLoading(false);
      }
    };

    if (selectedDiscipline) {
      fetchPositions();
    }

    return () => { active = false; };
  }, [selectedDiscipline]);

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setIsSaving(true);
    const newPos = await createPosition(selectedDiscipline, newValue.trim().toUpperCase(), positions.length);
    if (newPos) {
      setPositions([...positions, newPos]);
      setNewValue('');
    }
    setIsSaving(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editValue.trim()) return;
    setIsSaving(true);
    const success = await updatePosition(id, editValue.trim().toUpperCase());
    if (success) {
      setPositions(positions.map(p => p.id === id ? { ...p, position: editValue.trim().toUpperCase() } : p));
      setEditingId(null);
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este puesto?')) return;
    setIsSaving(true);
    const success = await deletePosition(id);
    if (success) {
      setPositions(positions.filter(p => p.id !== id));
    }
    setIsSaving(false);
  };

  const movePosition = async (index: number, direction: 'up' | 'down') => {
    const newPositions = [...positions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newPositions.length) return;

    [newPositions[index], newPositions[targetIndex]] = [newPositions[targetIndex], newPositions[index]];
    
    setPositions(newPositions);
    await reorderPositions(newPositions);
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Selector de Disciplina */}
      <div className="bg-white dark:bg-[#0f1219] p-8 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary-600/10 rounded-2xl flex items-center justify-center text-primary-600 shadow-inner">
            <LayoutGrid size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Disciplina Seleccionada</h4>
            <select 
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              className="w-full bg-transparent font-black text-2xl uppercase tracking-tighter dark:text-white outline-none mt-1 cursor-pointer"
            >
              {disciplines.map(d => (
                <option key={d.id} value={d.name} className="bg-slate-900 text-white font-sans text-sm p-4">
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Puestos */}
      <div className="bg-white dark:bg-[#0f1219] rounded-[3.5rem] border border-slate-200 dark:border-white/5 p-12 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-2xl font-black uppercase tracking-tighter dark:text-white italic flex items-center gap-3">
            <Shield size={24} className="text-primary-600" />
            Puestos para {selectedDiscipline}
          </h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {positions.length} Puestos Configurados
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary-600" size={40} />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando puestos...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2rem]">
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest italic">No hay puestos creados para esta disciplina</p>
              </div>
            ) : (
              positions.map((pos, index) => (
                <div key={pos.id} className="group flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-transparent hover:border-primary-500/30 transition-all">
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => movePosition(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-500 hover:text-primary-500 disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button 
                      onClick={() => movePosition(index, 'down')}
                      disabled={index === positions.length - 1}
                      className="p-1 text-slate-500 hover:text-primary-500 disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  <div className="flex-1">
                    {editingId === pos.id ? (
                      <input 
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(pos.id)}
                        className="w-full bg-white dark:bg-slate-800 px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-widest text-primary-500 outline-none border-2 border-primary-500/50"
                      />
                    ) : (
                      <span className="font-black text-sm uppercase tracking-widest dark:text-white px-4">
                        {pos.position}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === pos.id ? (
                      <>
                        <button onClick={() => handleUpdate(pos.id)} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all">
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
                            setEditingId(pos.id);
                            setEditValue(pos.position);
                          }}
                          className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(pos.id)}
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

            {/* Input para nuevo puesto */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-4">
                <input 
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="NUEVO PUESTO (EJ: ARQUERO)"
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

export default PosicionesPorDisciplina;
