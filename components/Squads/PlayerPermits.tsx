import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, db } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Member } from '../../types';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Calendar, 
  MapPin, 
  X, 
  AlertCircle,
  Search,
  CheckCircle,
  UserCheck
} from 'lucide-react';

interface PlayerPermit {
  id: string;
  member_id: string;
  permit_date: string;
  club_area: string;
  created_at: string;
  member?: {
    name: string;
    photourl?: string;
  };
}

const PlayerPermits: React.FC = () => {
  const { selectedDiscipline, selectedDivision } = useCategory();
  
  const [permits, setPermits] = useState<PlayerPermit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  
  const [disciplineName, setDisciplineName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add form states
  const [showForm, setShowForm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [permitDate, setPermitDate] = useState(new Date().toISOString().split('T')[0]);
  const [clubArea, setClubArea] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Common area suggestions
  const areaSuggestions = ['GEL', 'Gimnasio', 'Cancha Principal', 'Cancha Auxiliar', 'Cancha 2', 'Vestuario', 'Cancha de Sintético', 'Cancha de Básquet', 'Consultorio Médico'];

  // Fetch all permits and members
  const loadData = useCallback(async () => {
    if (!selectedDiscipline || !selectedDivision) return;
    
    setLoading(true);
    setError(null);
    try {
      const [membersRes, configRes, permitsRes] = await Promise.all([
        db.members.getAll(),
        db.config.get(),
        supabase.from('player_permits').select('*, member:members(name, photourl)').order('permit_date', { ascending: false })
      ]);

      if (membersRes.error) throw membersRes.error;
      if (permitsRes.error) {
        // If table doesn't exist yet, we will log and set empty permits
        console.warn('Could not load permits. If table player_permits is not created yet, please execute migration_v4_player_permits.sql', permitsRes.error);
        setPermits([]);
      } else {
        setPermits(permitsRes.data || []);
      }

      setMembers(membersRes.data || []);

      // Resolve discipline and category names
      if (configRes.data) {
        const disc = configRes.data.disciplines.find((d: any) => d.id === selectedDiscipline);
        if (disc) {
          setDisciplineName(disc.name);
          const branch = disc.branches.find((b: any) => b.categories.some((c: any) => c.id === selectedDivision));
          const cat = branch?.categories.find((c: any) => c.id === selectedDivision);
          if (cat) setCategoryName(cat.name);
        }
      }

    } catch (err: any) {
      console.error('Error loading permits:', err);
      setError('Ocurrió un error al cargar la información de permisos.');
    } finally {
      setLoading(false);
    }
  }, [selectedDiscipline, selectedDivision]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter players assigned to this category/discipline
  const currentCategoryPlayers = useMemo(() => {
    if (!selectedDiscipline || !selectedDivision || !disciplineName || !categoryName) return [];

    return members.filter(m => {
      const assignment = m.assignments?.find(a => {
        const aDisc = (a.discipline || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dName = (disciplineName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const aCat = (a.category || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cName = (categoryName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const discMatch = a.discipline_id === selectedDiscipline || aDisc === dName;
        const catMatch = a.category_id === selectedDivision || a.category === selectedDivision || aCat === cName;
        
        return discMatch && catMatch;
      });

      if (!assignment) return false;
      const role = (assignment.role || '').toUpperCase();
      return role === 'PLAYER' || role === 'JUGADOR';
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, selectedDiscipline, selectedDivision, disciplineName, categoryName]);

  // Filter existing permits to only show members that are part of this division/squad
  const filteredPermits = useMemo(() => {
    const playerIds = new Set(currentCategoryPlayers.map(p => p.id));
    
    return permits.filter(p => {
      const isOfCategory = playerIds.has(p.member_id);
      if (!isOfCategory) return false;
      
      if (searchTerm.trim() !== '') {
        const pName = (p.member?.name || '').toLowerCase();
        const pArea = (p.club_area || '').toLowerCase();
        const search = setSearchTerm ? searchTerm.toLowerCase() : '';
        return pName.includes(search) || pArea.includes(search);
      }
      
      return true;
    });
  }, [permits, currentCategoryPlayers, searchTerm]);

  const handleCreatePermit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || !permitDate || !clubArea.trim()) {
      alert('Por favor completa todos los campos del permiso.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('player_permits')
        .insert({
          member_id: selectedPlayerId,
          permit_date: permitDate,
          club_area: clubArea.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Close Form and reload list
      setShowForm(false);
      setSelectedPlayerId('');
      setPermitDate(new Date().toISOString().split('T')[0]);
      setClubArea('');
      
      // Reload list
      await loadData();

    } catch (err: any) {
      console.error('Error creating permit:', err);
      setError('Error al guardar el permiso. Verifique haber ejecutado la consulta SQL en Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePermit = async (id: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este permiso registrado?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('player_permits')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Update local state directly
      setPermits(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      console.error('Error deleting permit:', err);
      alert('No se pudo eliminar el permiso.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
          Cargando listado de permisos...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-[var(--text-main)]">
      {/* Header and Add Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-main)]">
            Permisos de Jugadores
          </h2>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1">
            Gestión de inasistencias autorizadas y ubicación permitida dentro del club
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all shadow-lg ${
            showForm 
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/10' 
              : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/10'
          }`}
        >
          {showForm ? (
            <>
              <X size={14} />
              Cancelar
            </>
          ) : (
            <>
              <Plus size={14} />
              Registrar Permiso
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-5 bg-red-500/10 border-2 border-red-500/20 text-red-500 rounded-[2rem] flex items-start gap-4 shadow-xl">
          <AlertCircle className="shrink-0 mt-0.5" size={24} />
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider">Error de Sincronización</h4>
            <p className="text-xs font-medium text-red-500/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Accordion inline Registration Form */}
      {showForm && (
        <div className="bg-surface-card border-2 border-primary-500/30 p-8 rounded-[2.5rem] shadow-xl animate-in slide-in-from-top duration-350">
          <h3 className="text-lg font-black uppercase italic tracking-tight text-[var(--text-main)] mb-6 flex items-center gap-2">
            <UserCheck className="text-primary-500" size={22} />
            Nuevo Registro de Permiso
          </h3>

          <form onSubmit={handleCreatePermit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
                Seleccionar Jugador <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-4 py-3.5 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-primary-500 transition-all cursor-pointer"
              >
                <option value="">SELECCIONAR JUGADOR</option>
                {currentCategoryPlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
                Fecha del Permiso <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={permitDate}
                  onChange={(e) => setPermitDate(e.target.value)}
                  className="w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-4 py-3.5 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-primary-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
                Campo del Club / Sector Permitido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Gimnasio, Vestuario, Cancha 2, etc."
                value={clubArea}
                onChange={(e) => setClubArea(e.target.value)}
                className="w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-4 py-3.5 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-primary-500 transition-all mb-2"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {areaSuggestions.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setClubArea(area)}
                    className="px-2 py-1 bg-surface-hover hover:bg-primary-550 hover:text-white rounded text-[8px] font-black uppercase text-[var(--text-muted)] transition-all"
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3 flex justify-end gap-3 mt-4 pt-4 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-4 bg-surface-hover hover:bg-surface-active rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] transition-colors"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary-600/10 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={12} />
                    Guardar Permiso
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List and Search Filter */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input
              type="text"
              placeholder="Buscar por jugador o sector del club..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-card border border-[var(--surface-border)] hover:border-primary-500/30 focus:border-primary-500 rounded-2xl pl-11 pr-5 py-3.5 text-xs font-semibold text-[var(--text-main)] outline-none transition-all placeholder-[var(--text-muted)]"
            />
          </div>

          <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider text-right self-end sm:self-center">
            Mostrando <span className="text-primary-500 font-extrabold">{filteredPermits.length}</span> permisos registrados
          </div>
        </div>

        {/* Permits Grid Cards list */}
        {filteredPermits.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPermits.map((permit) => {
              const getInitials = (name: string) => {
                return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              };

              return (
                <div 
                  key={permit.id}
                  className="group relative bg-surface-card p-6 md:p-8 rounded-[2rem] border-2 border-[var(--surface-border)] hover:border-primary-500/20 hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <button
                    onClick={() => handleDeletePermit(permit.id)}
                    title="Eliminar permiso"
                    className="absolute top-4 right-4 p-2 bg-surface-ground hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="space-y-4">
                    {/* Member header */}
                    <div className="flex items-center gap-3 pr-6">
                      <div className="w-10 h-10 rounded-xl bg-surface-ground overflow-hidden shrink-0 relative border border-[var(--surface-border)] flex items-center justify-center">
                        {permit.member?.photourl ? (
                          <img src={permit.member.photourl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-xs font-black text-primary-600 italic">
                            {getInitials(permit.member?.name || 'Jugador')}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[var(--text-main)] uppercase truncate">
                          {permit.member?.name || 'Jugador no encontrado'}
                        </p>
                        <span className="text-[8px] font-black text-primary-500 uppercase tracking-widest">
                          {categoryName}
                        </span>
                      </div>
                    </div>

                    <hr className="border-[var(--surface-border)]" />

                    {/* Information cards details */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 text-xs text-[var(--text-muted)] font-black uppercase tracking-widest">
                        <Calendar size={14} className="text-primary-500 shrink-0" />
                        <span className="font-mono text-[10px] text-[var(--text-main)]">
                          {permit.permit_date.split('-').reverse().join('/')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-[var(--text-muted)] font-black uppercase tracking-widest">
                        <MapPin size={14} className="text-emerald-500 shrink-0" />
                        <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[9px] font-black uppercase truncate max-w-[190px]">
                          {permit.club_area}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--surface-border)] text-right text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Registrado {new Date(permit.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
            <UserCheck size={48} className="mx-auto text-[var(--text-muted)] mb-4 opacity-20" />
            <h3 className="text-xl font-black uppercase text-[var(--text-muted)] italic tracking-widest">
              No hay permisos registrados
            </h3>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mt-2">
              Haz clic en "Registrar Permiso" para dar de alta el primer registro.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerPermits;
