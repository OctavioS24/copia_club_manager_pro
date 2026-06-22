import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Fingerprint, 
  Coins,
  History,
  Trash2,
  Lock,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Member, MemberFee } from '../types';

interface CheckedInMember {
  id: string;
  dni: string;
  name: string;
  photoUrl?: string;
  categoryName?: string;
  disciplineName?: string;
  status: 'HABILITADO' | 'PROXIMO_A_VENCER' | 'NO_HABILITADO' | 'SIN_DATOS';
  notes: string;
  timestamp: string;
}

const formatPeriodToMonthYear = (pStr: string) => {
  if (!pStr) return '---';
  const parts = pStr.split('-');
  if (parts.length !== 2) return pStr;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
  const name = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const isPastPeriod = (p: string, currentPeriod: string) => {
  if (!p) return false;
  // If format is YYYY-MM
  if (p.includes('-') && p.length === 7) {
    return p < currentPeriod;
  }
  // If format is YYYY (Anual) or similar custom format
  const yearMatch = p.match(/^(\d{4})/);
  if (yearMatch) {
    const year = yearMatch[1];
    const currentYear = currentPeriod.split('-')[0];
    return year < currentYear;
  }
  return false;
};

const isCurrentPeriod = (p: string, currentPeriod: string) => {
  if (!p) return false;
  if (p === currentPeriod) return true;
  // If it's same-year annual
  const yearMatch = p.match(/^(\d{4})/);
  if (yearMatch) {
    const year = yearMatch[1];
    const currentYear = currentPeriod.split('-')[0];
    if (year === currentYear && p.includes('(Anual)')) return true;
  }
  return false;
};

export const ControlAcceso: React.FC = () => {
  const [dniInput, setDniInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Resultado de búsqueda actual
  const [searchedMember, setSearchedMember] = useState<Member | null>(null);
  const [searchStatus, setSearchStatus] = useState<
    'IDLE' | 'HABILITADO' | 'PROXIMO_A_VENCER' | 'NO_HABILITADO' | 'NOT_FOUND' | 'SIN_DATOS'
  >('IDLE');
  const [unpaidFees, setUnpaidFees] = useState<MemberFee[]>([]);
  const [mainCategory, setMainCategory] = useState<{ category: string; discipline: string } | null>(null);

  // Registro de accesos en la sesión actual
  const [recentChecks, setRecentChecks] = useState<CheckedInMember[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Foco automático en el input al cargar la pantalla
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const searchDni = dniInput.trim();
    if (!searchDni) return;

    setIsSearching(true);
    setSearchedMember(null);
    setSearchStatus('IDLE');
    setUnpaidFees([]);
    setMainCategory(null);

    try {
      // 1. Buscar miembro por DNI (exacto o ignorando puntos)
      const sanitizedDni = searchDni.replace(/\./g, '');
      const { data: members, error: memberError } = await supabase
        .from('members')
        .select('*')
        .or(`dni.eq.${sanitizedDni},dni.eq.${searchDni}`);

      if (memberError) {
        console.error('Error al buscar miembro:', memberError);
        setSearchStatus('NOT_FOUND');
        setIsSearching(false);
        return;
      }

      if (!members || members.length === 0) {
        setSearchStatus('NOT_FOUND');
        addSessionCheck({
          id: 'not-found-' + Date.now(),
          dni: searchDni,
          name: 'DNI No Encontrado',
          status: 'NO_HABILITADO',
          notes: 'Miembro no encontrado en el sistema',
          timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        setIsSearching(false);
        return;
      }

      const member = members[0] as Member;
      setSearchedMember(member);

      // 2. Identificar categoría principal de pagos
      const playerAssignments = member.assignments?.filter(a => !a.role || a.role === 'PLAYER') || [];
      let primaryAssignment = member.assignments?.find(a => a.is_main);
      
      // Si no tiene marcada como principal una pero es la única de jugador, la tomamos de respaldo
      if (!primaryAssignment && playerAssignments.length === 1) {
        primaryAssignment = playerAssignments[0];
      }

      if (primaryAssignment) {
        setMainCategory({
          category: primaryAssignment.category,
          discipline: primaryAssignment.discipline
        });
      }

      // 3. Obtener cuotas/feecards del miembro
      const { data: feesData, error: feesError } = await supabase
        .from('fees')
        .select('*')
        .eq('member_id', member.id);

      if (feesError) {
        console.error('Error al cargar cuotas:', feesError);
      }

      const fees = (feesData || []) as MemberFee[];
      
      // Se consideran pagas únicamente las que tienen estado 'Paid' o 'Anulado'
      const pendingFees = fees.filter(f => f.status !== 'Paid' && f.status !== 'Anulado');
      setUnpaidFees(pendingFees);

      const now = new Date();
      const currentPeriodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const pastMonthsPending = pendingFees.filter(f => isPastPeriod(f.period, currentPeriodStr));
      const currentMonthPending = pendingFees.filter(f => isCurrentPeriod(f.period, currentPeriodStr));

      // Determinar situación de habilitación
      let finalStatus: 'HABILITADO' | 'PROXIMO_A_VENCER' | 'NO_HABILITADO' | 'SIN_DATOS' = 'HABILITADO';
      let checkNotes = 'Puede ingresar';

      if (!primaryAssignment) {
        finalStatus = 'SIN_DATOS';
        setSearchStatus('SIN_DATOS');
        checkNotes = 'Sin categoría principal asignada';
      } else if (pastMonthsPending.length > 0) {
        finalStatus = 'NO_HABILITADO';
        setSearchStatus('NO_HABILITADO');
        checkNotes = `Debe: ${pastMonthsPending.map(f => formatPeriodToMonthYear(f.period)).join(', ')}`;
      } else if (currentMonthPending.length > 0) {
        finalStatus = 'PROXIMO_A_VENCER';
        setSearchStatus('PROXIMO_A_VENCER');
        checkNotes = 'Mes actual pendiente de pago';
      } else {
        finalStatus = 'HABILITADO';
        setSearchStatus('HABILITADO');
        checkNotes = 'Puede ingresar';
      }

      // 4. Agregar al historial acumulativo de accesos recientes
      addSessionCheck({
        id: member.id,
        dni: member.dni,
        name: member.name,
        photoUrl: member.photourl,
        categoryName: primaryAssignment?.category,
        disciplineName: primaryAssignment?.discipline,
        status: finalStatus,
        notes: checkNotes,
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

    } catch (err) {
      console.error('Error en proceso de validación:', err);
      setSearchStatus('NOT_FOUND');
    } finally {
      setIsSearching(false);
    }
  };

  const addSessionCheck = (check: CheckedInMember) => {
    setRecentChecks(prev => [check, ...prev].slice(0, 30)); // límite superior de 30 para no saturar memoria
  };

  const clearSearch = () => {
    setDniInput('');
    setSearchedMember(null);
    setSearchStatus('IDLE');
    setUnpaidFees([]);
    setMainCategory(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleClearHistory = () => {
    setRecentChecks([]);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-40">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h2 id="control-ingreso-title" className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-[var(--text-main)] leading-none italic">
            Control de <span className="text-primary-500">Ingreso</span>
          </h2>
          <div className="flex items-center gap-4 mt-4">
            <div className="w-16 h-2 bg-primary-500 rounded-full shadow-[0_0_15px_var(--primary-glow)]"></div>
            <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.4em] text-[10px]">Validación Rápida por DNI</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Lado Izquierdo: Campo de Búsqueda y Estado en tiempo real (8 columnas) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-surface-card p-6 md:p-8 rounded-[2.5rem] border border-[var(--surface-border)] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-bl-full pointer-events-none"></div>
            
            <form onSubmit={handleSearch} className="space-y-6">
              <label htmlFor="dni-search-input" className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Ingresar DNI del Miembro
              </label>
              
              <div className="flex flex-col sm:flex-row gap-4 relative">
                <div className="relative flex-1">
                  <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                  <input
                    id="dni-search-input"
                    ref={inputRef}
                    type="text"
                    value={dniInput}
                    onChange={e => setDniInput(e.target.value)}
                    placeholder="Escribí el número de DNI..."
                    className="w-full pl-14 pr-12 py-5 bg-surface-ground rounded-2xl outline-none border border-[var(--surface-border)] font-black text-lg uppercase tracking-wider text-[var(--text-main)] focus:border-primary-500/50 shadow-inner transition-all"
                  />
                  {dniInput && (
                    <button
                      id="clear-input-btn"
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-surface-card hover:bg-surface-border text-slate-400 hover:text-red-500 rounded-full transition-colors font-bold text-xs"
                      title="Limpiar búsqueda"
                    >
                      <XCircle size={18} />
                    </button>
                  )}
                </div>

                <button
                  id="search-verify-btn"
                  type="submit"
                  disabled={isSearching || !dniInput.trim()}
                  className="sm:w-44 bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 px-6 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  {isSearching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                  Verificar
                </button>
              </div>
            </form>
          </div>

          {/* ESTADOS Y RESULTADOS */}
          {searchStatus !== 'IDLE' && (
            <div className="animate-in fade-in duration-300">
              
              {/* 1. HABILITADO */}
              {searchStatus === 'HABILITADO' && searchedMember && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-[3rem] p-8 md:p-10 text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/5 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-10">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
                  
                  {/* Avatar / Foto */}
                  <div className="w-32 h-32 rounded-3xl bg-emerald-500/10 border-4 border-emerald-500/20 overflow-hidden shrink-0 flex items-center justify-center shadow-lg relative">
                    {searchedMember.photourl ? (
                      <img src={searchedMember.photourl} className="w-full h-full object-cover" alt={searchedMember.name} />
                    ) : (
                      <span className="text-3xl font-black italic tracking-tighter text-emerald-500">
                        {searchedMember.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
                      <Check className="text-white" size={12} />
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-4">
                    <div>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest rounded-full">
                        ✅ HABILITADO
                      </span>
                      <h3 className="text-3xl font-black uppercase tracking-tight text-[var(--text-main)] mt-3 leading-none italic">
                        {searchedMember.name}
                      </h3>
                      <p className="text-xs font-bold text-[var(--text-muted)] mt-1 tracking-wider uppercase">
                        DNI: <span className="font-mono">{searchedMember.dni}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--surface-border)]">
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Categoría Principal</p>
                        <p className="text-sm font-black text-[var(--text-main)] uppercase tracking-wide mt-1">
                          {mainCategory ? `${mainCategory.category} (${mainCategory.discipline})` : '---'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Acceso al Club</p>
                        <p className="text-sm font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-wide mt-1 animate-pulse">
                          🟢 Puede ingresar
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PRÓXIMO A VENCER */}
              {searchStatus === 'PROXIMO_A_VENCER' && searchedMember && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-[3rem] p-8 md:p-10 text-amber-600 dark:text-amber-400 shadow-xl shadow-amber-500/5 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-10">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>
                  
                  {/* Avatar / Foto */}
                  <div className="w-32 h-32 rounded-3xl bg-amber-500/10 border-4 border-amber-500/20 overflow-hidden shrink-0 flex items-center justify-center shadow-lg relative">
                    {searchedMember.photourl ? (
                      <img src={searchedMember.photourl} className="w-full h-full object-cover" alt={searchedMember.name} />
                    ) : (
                      <span className="text-3xl font-black italic tracking-tighter text-amber-500">
                        {searchedMember.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
                      <AlertTriangle className="text-white" size={12} />
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-4">
                    <div>
                      <span className="px-3 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-widest rounded-full">
                        ⚠️ PRÓXIMO A VENCER
                      </span>
                      <h3 className="text-3xl font-black uppercase tracking-tight text-[var(--text-main)] mt-3 leading-none italic">
                        {searchedMember.name}
                      </h3>
                      <p className="text-xs font-bold text-[var(--text-muted)] mt-1 tracking-wider uppercase">
                        DNI: <span className="font-mono">{searchedMember.dni}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--surface-border)]">
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Categoría Principal</p>
                        <p className="text-sm font-black text-[var(--text-main)] uppercase tracking-wide mt-1">
                          {mainCategory ? `${mainCategory.category} (${mainCategory.discipline})` : '---'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Acceso al Club</p>
                        <p className="text-sm font-black text-amber-500 dark:text-amber-400 uppercase tracking-wide mt-1 animate-pulse">
                          🟡 Mes actual pendiente de pago
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. NO HABILITADO */}
              {searchStatus === 'NO_HABILITADO' && searchedMember && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-[3rem] p-8 md:p-10 text-red-600 dark:text-red-400 shadow-xl shadow-red-500/5 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-10">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-bl-full pointer-events-none"></div>
                  
                  {/* Avatar / Foto */}
                  <div className="w-32 h-32 rounded-3xl bg-red-500/10 border-4 border-red-500/20 overflow-hidden shrink-0 flex items-center justify-center shadow-lg relative">
                    {searchedMember.photourl ? (
                      <img src={searchedMember.photourl} className="w-full h-full object-cover" alt={searchedMember.name} />
                    ) : (
                      <span className="text-3xl font-black italic tracking-tighter text-red-500">
                        {searchedMember.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
                      <Lock className="text-white" size={12} />
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-4">
                    <div>
                      <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[9px] font-black uppercase tracking-widest rounded-full">
                        ❌ NO HABILITADO
                      </span>
                      <h3 className="text-3xl font-black uppercase tracking-tight text-[var(--text-main)] mt-3 leading-none italic">
                        {searchedMember.name}
                      </h3>
                      <p className="text-xs font-bold text-[var(--text-muted)] mt-1 tracking-wider uppercase">
                        DNI: <span className="font-mono">{searchedMember.dni}</span>
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[var(--surface-border)]">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="text-red-500" size={14} />
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                          INGRESO DENEGADO - CUOTAS PENDIENTES
                        </p>
                      </div>
                      
                      <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 mt-2 max-h-36 overflow-y-auto">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Periodos adeudados anteriores:</p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {unpaidFees.filter(f => isPastPeriod(f.period, `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)).map(fee => (
                            <li key={fee.id} className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/10">
                              <Coins size={12} className="shrink-0" />
                              <span className="truncate">{formatPeriodToMonthYear(fee.period)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--surface-border)]">
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Categoría Principal</p>
                        <p className="text-sm font-black text-[var(--text-main)] uppercase tracking-wide mt-1">
                          {mainCategory ? `${mainCategory.category} (${mainCategory.discipline})` : '---'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. SIN CATEGORÍA PRINCIPAL / SIN DATOS */}
              {searchStatus === 'SIN_DATOS' && searchedMember && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-[3rem] p-8 md:p-10 text-amber-600 dark:text-amber-400 shadow-xl shadow-amber-500/5 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-10">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>
                  
                  {/* Avatar / Foto */}
                  <div className="w-32 h-32 rounded-3xl bg-amber-500/10 border-4 border-amber-500/20 overflow-hidden shrink-0 flex items-center justify-center shadow-lg relative">
                    {searchedMember.photourl ? (
                      <img src={searchedMember.photourl} className="w-full h-full object-cover" alt={searchedMember.name} />
                    ) : (
                      <span className="text-3xl font-black italic tracking-tighter text-amber-500">
                        {searchedMember.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
                      <AlertTriangle className="text-white" size={12} />
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-4">
                    <div>
                      <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest rounded-full">
                        ⚠️ SIN DATOS
                      </span>
                      <h3 className="text-3xl font-black uppercase tracking-tight text-[var(--text-main)] mt-3 leading-none italic">
                        {searchedMember.name}
                      </h3>
                      <p className="text-xs font-bold text-[var(--text-muted)] mt-1 tracking-wider uppercase">
                        DNI: <span className="font-mono">{searchedMember.dni}</span>
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[var(--surface-border)]">
                      <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
                        <AlertTriangle className="text-amber-500 animate-bounce" size={14} />
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                          Sin categoría principal asignada
                        </p>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                        Este socio existe en el sistema, pero no posee una categoría principal marcada en su legajo para el cálculo de cuotas y controles. Debe configurarse en el panel de Miembros.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. MIEMBRO NO ENCONTRADO */}
              {searchStatus === 'NOT_FOUND' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-[3rem] p-10 text-center shadow-xl relative overflow-hidden space-y-6">
                  <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
                    <AlertTriangle size={36} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-main)]">
                      Miembro no encontrado
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] font-black uppercase tracking-widest">
                      DNI Buscado: {dniInput}
                    </p>
                  </div>
                  <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto font-medium">
                    No existe ningún socio registrado con el DNI ingresado. Por favor, verificá los dígitos e intentalo nuevamente o registrá al jugador en el módulo de Miembros.
                  </p>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Lado Derecho: Historial de la Sesión en tiempo real (4 columnas) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface-card p-6 md:p-8 rounded-[2.5rem] border border-[var(--surface-border)] shadow-xl flex flex-col h-[520px]">
            <div className="flex justify-between items-center border-b border-[var(--surface-border)] pb-4 mb-4">
              <div className="flex items-center gap-3">
                <History className="text-primary-500" size={18} />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)]">Lecturas Recientes</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Registros de esta sesión ({recentChecks.length})</p>
                </div>
              </div>
              {recentChecks.length > 0 && (
                <button
                  id="clear-history-btn"
                  onClick={handleClearHistory}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  title="Vaciar historial"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
              {recentChecks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-4">
                  <Fingerprint className="text-slate-300 dark:text-slate-700 animate-pulse" size={48} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider">Historial vacío</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Las lecturas de DNI que realices aparecerán aquí para control.</p>
                  </div>
                </div>
              ) : (
                recentChecks.map((check) => (
                  <div
                    key={check.id + check.timestamp}
                    onClick={() => {
                      if (!check.id.startsWith('not-found')) {
                        setDniInput(check.dni);
                        // trigger light search directly with the item
                        const tempInput = check.dni;
                        setTimeout(() => {
                          if (inputRef.current) {
                            inputRef.current.value = tempInput;
                          }
                        }, 50);
                      }
                    }}
                    className="p-3 bg-surface-ground rounded-2xl border border-[var(--surface-border)] hover:border-slate-400/30 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface-card overflow-hidden shrink-0 flex items-center justify-center border border-[var(--surface-border)]">
                        {check.photoUrl ? (
                          <img src={check.photoUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-xs font-black uppercase text-primary-500 italic">
                            {check.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-[var(--text-main)] truncate uppercase leading-none mb-1 group-hover:text-primary-500 transition-colors">
                          {check.name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider font-mono">DNI: {check.dni}</p>
                          {check.categoryName && (
                            <span className="px-1.5 py-0.5 bg-slate-500/10 text-[7px] text-slate-400 font-extrabold uppercase rounded-md tracking-wider">
                              {check.categoryName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-block px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider rounded-full mb-1 ${
                        check.status === 'HABILITADO' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' 
                          : check.status === 'PROXIMO_A_VENCER'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10'
                          : check.status === 'SIN_DATOS'
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/15'
                          : 'bg-red-500/10 text-red-500 border border-red-500/10'
                      }`}>
                        {check.status === 'HABILITADO' 
                          ? '🟢 OK' 
                          : check.status === 'PROXIMO_A_VENCER' 
                          ? '⚠️ PROXIMO' 
                          : check.status === 'SIN_DATOS' 
                          ? '⚠️ SIN CAT' 
                          : '🔴 DENEGADO'}
                      </span>
                      <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest">{check.timestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ControlAcceso;
