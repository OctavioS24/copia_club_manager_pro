import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, db } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Member } from '../../types';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Calendar, 
  Check, 
  X, 
  AlertCircle 
} from 'lucide-react';

interface PaymentCommitment {
  id: string;
  member_id: string;
  commitment_date: string;
  detail: string;
  fulfilled: boolean;
  created_at: string;
  member?: {
    name: string;
    photourl?: string;
  };
}

const PaymentCommitments: React.FC = () => {
  const { selectedDiscipline, selectedDivision } = useCategory();
  
  const [commitments, setCommitments] = useState<PaymentCommitment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  
  const [disciplineName, setDisciplineName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add form states
  const [showForm, setShowForm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [commitmentDate, setCommitmentDate] = useState('');
  const [detail, setDetail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize dynamic fulfillments in backend
  const syncFulfillment = useCallback(async (commitmentsList: any[], feesList: any[]) => {
    const updates: Promise<any>[] = [];
    const updated = commitmentsList.map(item => {
      if (item.fulfilled) return item;

      // Find if this specific player has any paid fee after commitment date
      const playerFees = feesList.filter(f => f.member_id === item.member_id);
      const hasPaymentAfter = playerFees.some(f => {
        if (!f.payment_date) return false;
        // Compare dates (YYYY-MM-DD)
        return new Date(f.payment_date) >= new Date(item.commitment_date);
      });

      if (hasPaymentAfter) {
        // Queue database update to persist the check
        updates.push(
          supabase
            .from('payment_commitments')
            .update({ fulfilled: true, updated_at: new Date().toISOString() })
            .eq('id', item.id)
        );
        return { ...item, fulfilled: true };
      }
      return item;
    });

    if (updates.length > 0) {
      try {
        await Promise.all(updates);
        console.log(`Synced ${updates.length} fulfilled payment commitments to database.`);
      } catch (err) {
        console.error('Failed to sync payment commitments in background:', err);
      }
    }

    return updated;
  }, []);

  // Fetch all required data
  const loadData = useCallback(async () => {
    if (!selectedDiscipline || !selectedDivision) return;
    
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch raw config/data
      const [membersRes, playersRes, configRes, commitmentsRes, feesRes] = await Promise.all([
        db.members.getAll(),
        db.players.getAll(),
        db.config.get(),
        supabase.from('payment_commitments').select('*, member:members(name, photourl)'),
        supabase.from('fees').select('*').eq('status', 'Paid')
      ]);

      if (membersRes.error) throw membersRes.error;
      if (playersRes.error) throw playersRes.error;
      if (commitmentsRes.error) throw commitmentsRes.error;
      if (feesRes.error) throw feesRes.error;

      // Set baseline values
      setMembers(membersRes.data || []);
      const rawCommitments = commitmentsRes.data || [];
      const paidFeesData = feesRes.data || [];

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

      // Check for automatic fulfillment and sync in database if needed
      const syncedCommitments = await syncFulfillment(rawCommitments, paidFeesData);
      setCommitments(syncedCommitments);

    } catch (err: any) {
      console.error('Error loading payment commitments:', err);
      setError('Ocurrió un error al cargar la información de pagos y compromisos.');
    } finally {
      setLoading(false);
    }
  }, [selectedDiscipline, selectedDivision, syncFulfillment]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract players assigned to this category/discipline
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

  // Filter existing commitments to only show members that are part of this division/squad
  const filteredCommitments = useMemo(() => {
    const playerIds = new Set(currentCategoryPlayers.map(p => p.id));
    return commitments.filter(c => playerIds.has(c.member_id));
  }, [commitments, currentCategoryPlayers]);

  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || !commitmentDate || !detail.trim()) {
      alert('Por favor completa todos los campos del compromiso.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Direct insertion in Supabase
      const { error: insertError } = await supabase
        .from('payment_commitments')
        .insert({
          member_id: selectedPlayerId,
          commitment_date: commitmentDate,
          detail: detail.trim(),
          fulfilled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*, member:members(name, photourl)');

      if (insertError) throw insertError;

      // Close Form and reload list
      setShowForm(false);
      setSelectedPlayerId('');
      setCommitmentDate('');
      setDetail('');
      
      // Reload everything to trigger sync verification
      await loadData();
    } catch (err: any) {
      console.error('Error creating payment commitment:', err);
      alert('Error al guardar el compromiso de pago');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCommitment = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este compromiso de pago?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('payment_commitments')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setCommitments(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting commitment:', err);
      alert('No se pudo eliminar el compromiso de pago.');
    }
  };

  const handleToggleFulfilled = async (commitment: PaymentCommitment) => {
    const nextVal = !commitment.fulfilled;
    try {
      const { error: updateError } = await supabase
        .from('payment_commitments')
        .update({ fulfilled: nextVal, updated_at: new Date().toISOString() })
        .eq('id', commitment.id);

      if (updateError) throw updateError;
      
      setCommitments(prev => prev.map(c => 
        c.id === commitment.id ? { ...c, fulfilled: nextVal } : c
      ));
    } catch (err) {
      console.error('Error updating commitment status:', err);
      alert('Ocurrió un error al actualizar el estado.');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
        <p className="text-[var(--text-muted)] font-black uppercase text-xs tracking-widest italic">Cargando compromisos de pago...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--surface-border)] pb-6">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">Compromisos de Pago</h2>
          <p className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)] mt-1">
            Gestión y seguimiento de acuerdos con jugadores con cuotas pendientes en {categoryName}
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary-500 text-primary-contrast px-6 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-primary-500/10"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          <span>{showForm ? 'Cancelar' : 'Nuevo Compromiso'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-3xl flex items-center gap-4 text-sm font-bold uppercase tracking-wide">
          <AlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Compromiso form panel */}
      {showForm && (
        <form onSubmit={handleCreateCommitment} className="bg-surface-ground p-8 md:p-10 rounded-[2.5rem] border border-[var(--surface-border)] shadow-xl max-w-2xl animate-fade-in space-y-6">
          <div className="border-b border-[var(--surface-border)] pb-4 mb-4">
            <h3 className="text-lg font-black text-primary-500 uppercase italic tracking-wider">Registrar Acuerdo de Pago</h3>
            <p className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest mt-1">
              La advertencia en convocatorias se suspenderá automáticamente para este jugador.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="pcommit-player" className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
                Seleccionar Miembro/Jugador
              </label>
              <select
                id="pcommit-player"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-surface-card border-2 border-[var(--surface-border)] hover:border-primary-500/50 focus:border-primary-600 rounded-2xl px-5 py-4 text-sm font-black uppercase text-[var(--text-main)] outline-none transition-all cursor-pointer"
              >
                <option value="">-- Seleccionar Jugador --</option>
                {currentCategoryPlayers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name.toUpperCase()} (DNI: {p.dni || 'S/D'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pcommit-date" className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
                Fecha de Compromiso
              </label>
              <input
                id="pcommit-date"
                type="date"
                value={commitmentDate}
                onChange={(e) => setCommitmentDate(e.target.value)}
                className="w-full bg-surface-card border-2 border-[var(--surface-border)] hover:border-primary-500/50 focus:border-primary-600 rounded-2xl px-5 py-3.5 text-sm font-black uppercase text-[var(--text-main)] outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pcommit-detail" className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
              Detalle del Acuerdo
            </label>
            <textarea
              id="pcommit-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Ej. Prometió abonar la cuota de abril y mayo el próximo viernes en administración..."
              rows={3}
              className="w-full bg-surface-card border-2 border-[var(--surface-border)] hover:border-primary-500/50 focus:border-primary-600 rounded-2xl px-5 py-4 text-sm font-bold text-[var(--text-main)] outline-none transition-all resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all duration-300 disabled:opacity-40"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={16} />}
              <span>Registrar Compromiso</span>
            </button>
          </div>
        </form>
      )}

      {/* Commitments list */}
      {filteredCommitments.length === 0 ? (
        <div className="bg-surface-ground rounded-[3rem] p-16 text-center border border-[var(--surface-border)]">
          <Calendar size={48} className="mx-auto text-[var(--text-muted)] opacity-20 mb-4" />
          <p className="text-lg font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 italic">No hay compromisos registrados</p>
          <p className="text-xs font-bold text-[var(--text-muted)] opacity-40 max-w-md mx-auto mt-2">
            Los entrenadores pueden registrar promesas de pago para suspender temporalmente la sugerencia de deuda en convocatorias.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-surface-ground">
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Miembro</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Fecha Límite</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Detalle / Notas</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Cumplido</th>
                  <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {filteredCommitments.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-surface-ground/40 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <img
                            src={item.member?.photourl || `https://api.dicebear.com/7.x/initials/svg?seed=${item.member?.name || 'S'}`}
                            alt={item.member?.name}
                            className="w-10 h-10 rounded-xl object-cover border border-[var(--surface-border)]"
                          />
                          <div>
                            <span className="font-black uppercase text-sm text-[var(--text-main)] italic tracking-tight block">
                              {item.member?.name || 'Desconocido'}
                            </span>
                            <span className="text-[8px] font-black uppercase text-[var(--text-muted)] opacity-50 tracking-widest block">
                              Jugador Plantel
                            </span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-6">
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                          <Calendar size={14} className="text-primary-500" />
                          <span>{new Date(item.commitment_date).toLocaleDateString()}</span>
                        </div>
                      </td>
                      
                      <td className="p-6 max-w-md">
                        <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed bg-surface-ground/30 p-4 rounded-2xl border border-[var(--surface-border)]/50">
                          {item.detail}
                        </p>
                      </td>
                      
                      <td className="p-6">
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => handleToggleFulfilled(item)}
                            className={`flex items-center gap-2 border-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                              item.fulfilled
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                            }`}
                          >
                            {item.fulfilled ? (
                              <>
                                <Check size={12} strokeWidth={4} />
                                <span>SÍ</span>
                              </>
                            ) : (
                              <>
                                <X size={12} strokeWidth={4} />
                                <span>NO</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      
                      <td className="p-6 text-right">
                        <button
                          onClick={() => handleDeleteCommitment(item.id)}
                          className="p-3 text-[var(--text-muted)] hover:text-red-500 bg-surface-ground/50 hover:bg-red-500/10 rounded-2xl border border-[var(--surface-border)]/50 transition-all hover:scale-105 active:scale-95"
                          title="Eliminar Compromiso"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="bg-surface-ground p-4 border-t border-[var(--surface-border)] text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 text-center">
            * El estado se actualiza automáticamente a "SÍ" si se registra una cuota paga desde el portal de Caja con fecha posterior al compromiso.
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCommitments;
