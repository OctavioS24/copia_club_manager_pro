
import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, Shield, Loader2, Save, X, LayoutGrid, ChevronDown, MapPin, Image, ExternalLink
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
  const [editValue, setEditValue] = useState({ name: '', address_url: '', logo_url: '' });
  const [newValue, setNewValue] = useState({ name: '', address_url: '', logo_url: '' });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

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
    if (!newValue.name.trim()) return;
    setIsSaving(true);
    try {
      const newRival = await createRival(
        newValue.name.trim().toUpperCase(), 
        selectedDiscipline,
        newValue.address_url.trim(),
        newValue.logo_url.trim()
      );
      if (newRival) {
        setRivals(prev => [...prev, newRival].sort((a, b) => a.name.localeCompare(b.name)));
        setNewValue({ name: '', address_url: '', logo_url: '' });
      }
    } catch (error) {
      console.error('Error adding rival:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editValue.name.trim()) return;
    setIsSaving(true);
    try {
      const updated = await updateRival(
        id, 
        editValue.name.trim().toUpperCase(),
        editValue.address_url.trim(),
        editValue.logo_url.trim()
      );
      if (updated) {
        setRivals(rivals.map(r => r.id === id ? updated : r).sort((a, b) => a.name.localeCompare(b.name)));
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
      <div className="bg-surface-card p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-[var(--surface-border)] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 shadow-2xl">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-primary-500 shadow-inner shrink-0">
            <LayoutGrid size={20} md:size={24} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">Disciplina Seleccionada</h4>
            <div className="relative group">
              <select 
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                className="w-full bg-transparent font-black text-lg md:text-2xl uppercase tracking-tighter text-[var(--text-main)] outline-none mt-1 cursor-pointer pr-10 appearance-none truncate"
              >
                {disciplines.map(d => (
                  <option key={d.id} value={d.name} className="bg-surface-card text-[var(--text-main)] font-sans text-sm p-4">
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-hover:text-primary-500 transition-colors">
                <ChevronDown size={22} className="md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Rivales */}
      <div className="bg-surface-card rounded-[2.5rem] md:rounded-[3.5rem] border border-[var(--surface-border)] p-6 md:p-12 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 md:mb-10">
          <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-[var(--text-main)] italic flex items-center gap-3">
            <Shield size={20} md:size={24} className="text-primary-500 flex-shrink-0" />
            <span className="truncate">Rivales para {selectedDiscipline}</span>
          </h3>
          <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {rivals.length} Registrados
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary-500" size={40} />
            <p className="text-[var(--text-muted)] font-bold uppercase text-[10px] tracking-widest">Cargando rivales...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rivals.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-[var(--surface-border)] rounded-[2rem]">
                <p className="text-[var(--text-muted)] font-bold uppercase text-xs tracking-widest italic opacity-30">No hay rivales creados para esta disciplina</p>
              </div>
            ) : (
              rivals.map((rival) => (
                <div key={rival.id} className="group flex flex-col md:flex-row md:items-center gap-4 bg-surface-ground p-4 rounded-3xl border border-transparent hover:border-primary-500/30 transition-all">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Logo */}
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-surface-card border border-[var(--surface-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-sm transition-transform group-hover:scale-105">
                      {rival.logo_url ? (
                        <img 
                          src={rival.logo_url} 
                          alt={rival.name} 
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-lg md:text-xl font-black text-primary-500 italic">${getInitials(rival.name)}</span>`;
                          }}
                        />
                      ) : (
                        <span className="text-lg md:text-xl font-black text-primary-500 italic">{getInitials(rival.name)}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {editingId === rival.id ? (
                        <div className="space-y-2">
                          <input 
                            autoFocus
                            value={editValue.name}
                            onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                            placeholder="NOMBRE DEL RIVAL..."
                            className="w-full bg-surface-card px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-widest text-primary-500 outline-none border-2 border-primary-500/50"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              value={editValue.address_url}
                              onChange={(e) => setEditValue({ ...editValue, address_url: e.target.value })}
                              placeholder="URL GOOGLE MAPS..."
                              className="w-full bg-surface-card px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest text-[var(--text-main)] outline-none border border-[var(--surface-border)]"
                            />
                            <input 
                              value={editValue.logo_url}
                              onChange={(e) => setEditValue({ ...editValue, logo_url: e.target.value })}
                              placeholder="URL LOGO/ESCUDO..."
                              className="w-full bg-surface-card px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest text-[var(--text-main)] outline-none border border-[var(--surface-border)]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-black text-sm md:text-base uppercase tracking-widest text-[var(--text-main)] truncate">
                            {rival.name}
                          </span>
                          {rival.address_url && (
                             <a 
                               href={rival.address_url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-[9px] md:text-[10px] font-bold text-primary-600 uppercase tracking-widest flex items-center gap-1.5 mt-1 hover:underline w-fit"
                             >
                                <MapPin size={10} />
                                Ver Ubicación
                                <ExternalLink size={8} />
                             </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    {editingId === rival.id ? (
                      <>
                        <button onClick={() => handleUpdate(rival.id)} className="p-3 text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all flex items-center gap-2 font-black text-[9px] uppercase tracking-widest">
                          <Save size={16} />
                          Guardar
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-3 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] rounded-xl transition-all">
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setEditingId(rival.id);
                            setEditValue({ 
                              name: rival.name, 
                              address_url: rival.address_url || '', 
                              logo_url: rival.logo_url || '' 
                            });
                          }}
                          className="p-2.5 text-[var(--text-muted)] hover:text-primary-500 hover:bg-primary-500/10 rounded-xl transition-all shadow-sm bg-surface-card opacity-0 group-hover:opacity-100"
                          title="Editar Rival"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(rival.id)}
                          className="p-2.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all shadow-sm bg-surface-card opacity-0 group-hover:opacity-100"
                          title="Eliminar Rival"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Input para nuevo rival */}
            <div className="mt-10 pt-10 border-t border-[var(--surface-border)]">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4 px-2">Registrar Nuevo Rival</h4>
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className="xl:col-span-2">
                  <div className="relative group">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input 
                      value={newValue.name}
                      onChange={(e) => setNewValue({ ...newValue, name: e.target.value })}
                      placeholder="NOMBRE DEL CLUB..."
                      className="w-full bg-surface-ground pl-12 pr-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-[var(--text-main)] outline-none border-2 border-transparent focus:border-primary-500/30 transition-all placeholder:opacity-30"
                    />
                  </div>
                </div>
                <div>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-primary-500 transition-colors" size={16} />
                    <input 
                      value={newValue.address_url}
                      onChange={(e) => setNewValue({ ...newValue, address_url: e.target.value })}
                      placeholder="URL GOOGLE MAPS..."
                      className="w-full bg-surface-ground pl-12 pr-6 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-[var(--text-main)] outline-none border-2 border-transparent focus:border-primary-500/20 transition-all placeholder:opacity-30"
                    />
                  </div>
                </div>
                <div>
                  <div className="relative group">
                    <Image className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-primary-500 transition-colors" size={16} />
                    <input 
                      value={newValue.logo_url}
                      onChange={(e) => setNewValue({ ...newValue, logo_url: e.target.value })}
                      placeholder="LINK DIRECTO A IMAGEN (.PNG, .JPG)..."
                      className="w-full bg-surface-ground pl-12 pr-6 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-[var(--text-main)] outline-none border-2 border-transparent focus:border-primary-500/20 transition-all placeholder:opacity-30"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={handleAdd}
                  disabled={!newValue.name.trim() || isSaving}
                  className="w-full md:w-auto bg-primary-500 text-primary-contrast px-12 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Registrar Rival
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
