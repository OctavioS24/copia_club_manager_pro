
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MemberFee, Member } from '../types';
import { 
  Search, DollarSign, Check, Plus, X, 
  Trash2, Save, CreditCard, Loader2, History, TrendingUp, 
  ArrowUpRight, AlertTriangle, Clock, Receipt, 
  Camera, ExternalLink, Image as ImageIcon,
  ChevronDown, RefreshCw
} from 'lucide-react';
import { db } from '../lib/supabase';

const FeesManagement: React.FC = () => {
  const [fees, setFees] = useState<MemberFee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [feeConfigs, setFeeConfigs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState<string>('');
  const [filterGender, setFilterGender] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para el buscador de miembros dentro del modal
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form State para nueva cuota
  const [formData, setFormData] = useState<Partial<MemberFee>>({
    status: 'Pending',
    amount: 5000,
    due_date: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
    period: new Date().toISOString().slice(0, 7),
    payment_method: 'Efectivo',
    receipt_url: '',
    reference: ''
  });

  const [viewMode, setViewMode] = useState<'history' | 'registry' | 'settings'>('history');
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [configFormData, setConfigFormData] = useState<any>({
    discipline: '',
    branch: '',
    category_id: '',
    amount: 0,
    due_day: 10,
    is_active: true
  });

  const loadData = async () => {
    try {
      const [
        { data: feesData, error: feesError }, 
        { data: membersData, error: memError }, 
        { data: configData, error: configError },
        { data: feeConfigsData, error: feeConfigsError }
      ] = await Promise.all([
        db.fees.getAll(),
        db.members.getAll(),
        db.config.get(),
        db.feeConfigs.getAll()
      ]);
      
      if (feesError) console.error("Error loading fees:", feesError);
      if (memError) console.error("Error loading members:", memError);
      if (configError) console.error("Error loading config:", configError);
      if (feeConfigsError) console.error("Error loading fee configs:", feeConfigsError);

      if (configData) setConfig(configData);
      if (feeConfigsData) setFeeConfigs(feeConfigsData);
      
      if (feesData && membersData) {
        const enrichedFees = feesData.map(f => ({
          ...f,
          member: membersData.find(m => m.id === f.member_id)
        }));
        setFees(enrichedFees);
      } else if (feesData) {
        setFees(feesData);
      }
      
      if (membersData) setMembers(membersData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const stats = useMemo(() => {
    const total = fees.reduce((acc, f) => acc + (f.amount || 0), 0);
    const paid = fees.filter(f => f.status === 'Paid').reduce((acc, f) => acc + (f.amount || 0), 0);
    const pending = total - paid;
    const lateCount = fees.filter(f => f.status === 'Late' || (new Date(f.due_date) < new Date() && f.status !== 'Paid')).length;
    return { total, paid, pending, lateCount };
  }, [fees]);

  // Registry Mode: List of members with their status for the current period
  const registryData = useMemo(() => {
    let list = members;

    // Filtros de miembros
    if (filterDiscipline) {
      list = list.filter(m => m.assignments?.some(a => a.discipline === filterDiscipline));
    }
    if (filterGender) {
      list = list.filter(m => m.gender === filterGender);
    }
    if (filterCategory) {
      list = list.filter(m => m.assignments?.some(a => a.category_id === filterCategory || a.category === filterCategory));
    }
    if (searchTerm.trim()) {
      const tokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      list = list.filter(m => {
        const name = m.name.toLowerCase();
        const dni = m.dni.toLowerCase();
        return tokens.every(token => name.includes(token) || dni.includes(token));
      });
    }

    return list.map(m => {
      const fee = fees.find(f => f.member_id === m.id && f.period === selectedPeriod);
      return { member: m, fee };
    });
  }, [members, fees, selectedPeriod, filterDiscipline, filterGender, filterCategory, searchTerm]);
  
  const suggestFee = (member: Member) => {
    // Tomar la primera asignación
    const assignment = member.assignments?.[0];
    if (!assignment) return { amount: 5000, due_day: 10 };

    const rate = feeConfigs.find(rc => 
      rc.discipline === assignment.discipline && 
      rc.branch === member.gender && 
      (rc.category_id === assignment.category_id || rc.category_id === assignment.category)
    );

    if (rate) {
      return { amount: rate.amount, due_day: rate.due_day };
    }

    return { amount: 5000, due_day: 10 };
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    console.log("Saving Fee Config:", configFormData);
    try {
      // Validaciones básicas
      if (!configFormData.discipline || !configFormData.branch || !configFormData.category_id) {
        throw new Error("Disciplina, Rama y Categoría son obligatorios.");
      }

      const { error } = await db.feeConfigs.upsert(configFormData);
      if (error) throw error;
      
      await loadData();
      setShowConfigModal(false);
      setConfigFormData({ discipline: '', branch: '', category_id: '', amount: 0, due_day: 10, is_active: true });
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving config:", error);
      alert("Error al guardar: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsSaving(false);
    }
  };

  // BUSCADOR PRINCIPAL (Tabla) con Filtros
  const filteredFees = useMemo(() => {
    let result = fees;

    // Filtro por Disciplina (Solo si member existe)
    if (filterDiscipline) {
      result = result.filter(f => 
        f.member ? f.member.assignments?.some(a => a.discipline === filterDiscipline) : true
      );
    }

    // Filtro por Rama (Género)
    if (filterGender) {
      result = result.filter(f => f.member ? f.member.gender === filterGender : true);
    }

    // Filtro por Categoría
    if (filterCategory) {
      result = result.filter(f => 
        f.member ? f.member.assignments?.some(a => a.category_id === filterCategory || a.category === filterCategory) : true
      );
    }

    // Filtro por Búsqueda (Nombre/DNI)
    if (searchTerm.trim()) {
      const tokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      result = result.filter(f => {
        const memberName = (f.member?.name || 'DESCONOCIDO').toLowerCase();
        const memberDni = (f.member?.dni || '').toLowerCase();
        return tokens.every(token => memberName.includes(token) || memberDni.includes(token));
      });
    }

    return result.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  }, [fees, searchTerm, filterDiscipline, filterGender, filterCategory]);

  const categories = useMemo(() => {
    if (!config) return [];
    if (filterDiscipline) {
      const discipline = config.disciplines.find(d => d.name === filterDiscipline);
      return discipline?.branches.flatMap(b => b.categories) || [];
    }
    return config.disciplines.flatMap(d => d.branches.flatMap(b => b.categories));
  }, [config, filterDiscipline]);

  const categoriesForModal = useMemo(() => {
    if (!config || !configFormData.discipline) return [];
    const discipline = config.disciplines.find(d => d.name === configFormData.discipline);
    return discipline?.branches.flatMap(b => b.categories) || [];
  }, [config, configFormData.discipline]);

  // BUSCADOR DE MIEMBROS (Dentro del Modal)
  const filteredMembersForSelect = useMemo(() => {
    if (!memberSearchQuery.trim()) return members.slice(0, 10); // Mostrar top 10 si no hay búsqueda
    const tokens = memberSearchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return members.filter(m => {
      const name = m.name.toLowerCase();
      const dni = m.dni.toLowerCase();
      return tokens.every(token => name.includes(token) || dni.includes(token));
    }).slice(0, 8); // Limitar resultados para performance y estética
  }, [members, memberSearchQuery]);

  const selectedMemberInModal = useMemo(() => 
    members.find(m => m.id === formData.member_id), 
  [members, formData.member_id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsSaving(true);
      try {
        const url = await db.fees.uploadReceipt(file);
        setFormData(prev => ({ ...prev, receipt_url: url }));
      } catch (error) {
        console.error("Error al subir comprobante:", error);
        alert("Error al subir el archivo");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.member_id) return alert("Selecciona un miembro");
    setIsSaving(true);
    try {
      const finalStatus = formData.receipt_url || formData.payment_date ? 'Paid' : (formData.status || 'Pending');
      const payload = { 
        ...formData, 
        status: finalStatus,
        payment_date: finalStatus === 'Paid' ? (formData.payment_date || new Date().toISOString().split('T')[0]) : null
      };
      
      const { error } = await db.fees.upsert(payload);
      if (error) throw error;
      
      await loadData();
      setShowModal(false);
      setFormData({ 
        status: 'Pending', 
        amount: 5000, 
        due_date: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0], 
        period: new Date().toISOString().slice(0, 7), 
        payment_method: 'Efectivo', 
        receipt_url: '', 
        reference: '' 
      });
      setMemberSearchQuery('');
    } catch (e: any) {
      console.error("Error saving fee:", e);
      alert(`Error al guardar: ${e.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const markAsPaid = async (fee: MemberFee) => {
    const updated = { ...fee, status: 'Paid' as const, payment_date: new Date().toISOString().split('T')[0], payment_method: fee.payment_method || 'Efectivo' };
    delete updated.member;
    await db.fees.upsert(updated);
    await loadData();
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== 'Paid';
    if (status === 'Paid') return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase rounded-full border border-emerald-500/20">Pagado</span>;
    if (isOverdue) return <span className="px-3 py-1 bg-red-500/10 text-red-600 text-[8px] font-black uppercase rounded-full border border-red-500/20 animate-pulse">Vencido</span>;
    return <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[8px] font-black uppercase rounded-full border border-amber-500/20">Pendiente</span>;
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto animate-fade-in pb-40">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="w-full">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none italic">
            Control de <span className="text-primary-600">Cuotas</span>
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[8px] sm:text-[9px] mt-4 ml-1">Administración Financiera Plegma</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="BUSCAR..." 
              className="w-full pl-14 pr-4 py-4 md:py-5 bg-white dark:bg-slate-800/80 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-white/5 outline-none font-black text-[10px] md:text-[11px] uppercase tracking-widest shadow-xl focus:border-primary-600/50 transition-all placeholder:text-slate-300"
            />
          </div>
          {viewMode === 'settings' ? (
            <button 
              onClick={() => {
                setConfigFormData({ discipline: '', branch: '', category_id: '', amount: 0, due_day: 10, is_active: true });
                setShowConfigModal(true);
              }} 
              className="bg-emerald-600 text-white px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center gap-3 w-full sm:w-auto"
            >
              <Plus size={18} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-widest">Nueva Tarifa</span>
            </button>
          ) : (
            <button onClick={() => setShowModal(true)} className="bg-primary-600 text-white px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-xl shadow-primary-600/20 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center gap-3 w-full sm:w-auto">
              <Plus size={18} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-widest">Nueva Cuota</span>
            </button>
          )}
        </div>
      </header>

      {/* Filtros Avanzados */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setViewMode('history')}
            className={`flex-1 min-w-[100px] px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Historial
          </button>
          <button 
            onClick={() => setViewMode('registry')}
            className={`flex-1 min-w-[120px] px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'registry' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Registro Mensual
          </button>
          <button 
            onClick={() => setViewMode('settings')}
            className={`flex-1 min-w-[100px] px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'settings' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Configuración
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {viewMode !== 'settings' && viewMode === 'registry' && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
               <div className="relative flex-1 md:flex-none">
                  <input 
                    type="month" 
                    value={selectedPeriod} 
                    onChange={e => setSelectedPeriod(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800/80 px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-black text-[9px] uppercase tracking-widest appearance-none transition-all cursor-pointer"
                  />
               </div>
               <button 
                 onClick={async () => {
                   if(confirm(`¿Generar cuotas pendientes para ${selectedPeriod}?`)) {
                     setIsSaving(true);
                     try {
                       const missing = registryData.filter(d => !d.fee);
                       if (missing.length === 0) {
                          alert("No hay cuotas pendientes para generar este mes.");
                          return;
                       }
                       
                       const newFees = missing.map(m => {
                          const suggestion = suggestFee(m.member);
                          return {
                             member_id: m.member.id,
                             period: selectedPeriod,
                             amount: suggestion.amount,
                             due_date: `${selectedPeriod}-${suggestion.due_day.toString().padStart(2, '0')}`,
                             status: 'Pending',
                             payment_method: 'Efectivo',
                             created_at: new Date().toISOString()
                          };
                       });
                       
                       const { error } = await db.fees.upsertMany(newFees);
                       if (error) throw error;
                       
                       await loadData();
                       alert(`${newFees.length} cuotas generadas correctamente.`);
                     } catch (error: any) {
                       console.error("Error al generar cuotas:", error);
                       alert("Error al generar: " + (error.message || "Error desconocido"));
                     } finally {
                       setIsSaving(false);
                     }
                   }
                 }}
                 disabled={isSaving}
                 className="flex-1 md:flex-none p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest"
               >
                 <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} /> <span className="inline md:hidden lg:inline">Generar Cuotas</span>
               </button>
            </div>
          )}

          {viewMode !== 'settings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full lg:min-w-[160px]">
                <select 
                  value={filterDiscipline} 
                  onChange={e => { setFilterDiscipline(e.target.value); setFilterCategory(''); }}
                  className="w-full bg-white dark:bg-slate-800/80 pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-black text-[9px] uppercase tracking-widest appearance-none transition-all cursor-pointer"
                >
                  <option value="">DISCIPLINAS</option>
                  {config?.disciplines.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>

              <div className="relative w-full lg:min-w-[160px]">
                <select 
                  value={filterGender} 
                  onChange={e => setFilterGender(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800/80 pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-black text-[9px] uppercase tracking-widest appearance-none transition-all cursor-pointer"
                >
                  <option value="">RAMAS</option>
                  <option value="Masculino">MASCULINO</option>
                  <option value="Femenino">FEMENINO</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>

              <div className="relative w-full lg:min-w-[200px]">
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800/80 pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-black text-[9px] uppercase tracking-widest appearance-none transition-all cursor-pointer"
                >
                  <option value="">CATEGORÍAS</option>
                  {Array.from(new Set(categories.map(c => c.name))).map(catName => {
                    const cat = categories.find(c => c.name === catName);
                    return <option key={cat?.id} value={cat?.id}>{catName}</option>;
                  })}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>

              {(filterDiscipline || filterGender || filterCategory || searchTerm) && (
                <button 
                  onClick={() => { setFilterDiscipline(''); setFilterGender(''); setFilterCategory(''); setSearchTerm(''); }}
                  className="w-full sm:w-auto p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest"
                >
                  <X size={14} /> <span className="inline md:hidden lg:inline">Limpiar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Recaudado', value: `$${stats.paid.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Pendiente Cobro', value: `$${stats.pending.toLocaleString()}`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Socios Morosos', value: stats.lateCount, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Proyección Mes', value: `$${stats.total.toLocaleString()}`, icon: Receipt, color: 'text-primary-600', bg: 'bg-primary-600/10' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm group hover:shadow-lg transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform`}>
                <kpi.icon size={20} />
              </div>
              <ArrowUpRight size={14} className="text-slate-300" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
            <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{kpi.value}</h4>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === 'history' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                  <th className="px-8 py-6">Socio / Miembro</th>
                  <th className="px-8 py-6">Periodo</th>
                  <th className="px-8 py-6">Monto</th>
                  <th className="px-8 py-6 text-center">Estado</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredFees.map(fee => (
                  <tr key={fee.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5">
                          <img src={fee.member?.photourl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{fee.member?.name || 'DESCONOCIDO'}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {fee.member?.dni || '---'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-primary-600 uppercase tracking-widest">{fee.period}</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase">{fee.payment_method || 'Sin definir'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-800 dark:text-white italic">${(fee.amount || 0).toLocaleString()}</span>
                        {fee.receipt_url && <ImageIcon size={12} className="text-primary-600 animate-bounce" />}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {getStatusBadge(fee.status, fee.due_date)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {fee.status !== 'Paid' && (
                          <button onClick={() => markAsPaid(fee)} className="p-2.5 bg-emerald-500 text-white rounded-xl hover:scale-110 transition-all shadow-lg shadow-emerald-500/20"><Check size={16} strokeWidth={3} /></button>
                        )}
                        <button onClick={() => setSelectedMemberHistory(fee.member || null)} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm"><History size={16} /></button>
                        <button onClick={async () => { if(confirm('¿Eliminar registro?')) { await db.fees.delete(fee.id); loadData(); } }} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : viewMode === 'registry' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                  <th className="px-8 py-6">Miembro</th>
                  <th className="px-8 py-6">Vencimiento</th>
                  <th className="px-8 py-6 text-center">Estado para {selectedPeriod}</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {registryData.map(({ member, fee }) => (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5">
                          <img src={member.photourl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{member.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {member.dni}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        {fee ? fee.due_date : 'PENDIENTE GENERAR'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {fee ? getStatusBadge(fee.status, fee.due_date) : (
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-400 text-[8px] font-black uppercase rounded-full border border-slate-200 dark:border-white/5">Sin Registro</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {!fee || fee.status !== 'Paid' ? (
                          <button 
                            onClick={() => {
                              const suggestion = fee ? null : suggestFee(member);
                              const dueDate = fee ? fee.due_date : (
                                suggestion ? `${selectedPeriod}-${suggestion.due_day.toString().padStart(2, '0')}` : new Date().toISOString().split('T')[0]
                              );

                              setFormData({
                                ...formData,
                                ...(fee || {}),
                                member_id: member.id,
                                period: selectedPeriod,
                                amount: fee?.amount || suggestion?.amount || 5000,
                                due_date: dueDate
                              });
                              setShowModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary-600/20"
                          >
                            <Plus size={14} strokeWidth={3} /> {fee ? 'Actualizar' : 'Registrar'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-[9px] font-black uppercase text-emerald-500 tracking-widest pr-4 italic">
                            <Check size={14} strokeWidth={3} /> Pago Confirmado
                          </div>
                        )}
                        <button onClick={() => setSelectedMemberHistory(member)} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm"><History size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                  <th className="px-8 py-6">Disciplina</th>
                  <th className="px-8 py-6">Rama</th>
                  <th className="px-8 py-6">Categoría</th>
                  <th className="px-8 py-6">Monto</th>
                  <th className="px-8 py-6">Vencimiento</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {feeConfigs.length > 0 ? feeConfigs.map(configFee => (
                  <tr key={configFee.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-6">
                       <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-widest">{configFee.discipline}</span>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{configFee.branch}</span>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[11px] font-black text-primary-600 uppercase tracking-widest">{configFee.category_id}</span>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-lg font-black text-slate-800 dark:text-white italic">${configFee.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Día {configFee.due_day}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex justify-end gap-2">
                         <button 
                           onClick={() => {
                             setConfigFormData(configFee);
                             setShowConfigModal(true);
                           }} 
                           className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                         >
                           <ArrowUpRight size={16} />
                         </button>
                         <button 
                           onClick={async () => {
                             if(confirm('¿Eliminar esta tarifa?')) {
                               await db.feeConfigs.delete(configFee.id);
                               loadData();
                             }
                           }} 
                           className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <DollarSign size={48} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">No hay tarifas configuradas</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: Nueva Cuota con Buscador Inteligente */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[500] flex items-center justify-center p-0 md:p-10 animate-fade-in">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg"><DollarSign size={20} /></div>
                 <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Gestión de Cobro</h3>
                    <p className="text-[9px] font-black text-primary-600 uppercase tracking-widest">Emisión de Comprobante</p>
                 </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-red-500 hover:text-white transition-all"><X size={20} /></button>
            </div>

            <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  {/* BUSCADOR INTELIGENTE DE SOCIOS */}
                  <div className="space-y-3 relative" ref={dropdownRef}>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Seleccionar Miembro / Socio</label>
                     
                     {!selectedMemberInModal ? (
                       <div className="relative">
                         <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-primary-600" size={18} />
                         <input 
                           type="text"
                           value={memberSearchQuery}
                           onFocus={() => setIsMemberDropdownOpen(true)}
                           onChange={(e) => { setMemberSearchQuery(e.target.value); setIsMemberDropdownOpen(true); }}
                           placeholder="BUSCAR POR NOMBRE O DNI..."
                           className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 shadow-inner"
                         />
                         
                         {isMemberDropdownOpen && (
                           <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden z-[600] animate-fade-in-up">
                              {filteredMembersForSelect.map(m => (
                                <button 
                                  key={m.id}
                                  onClick={() => { setFormData({...formData, member_id: m.id}); setIsMemberDropdownOpen(false); }}
                                  className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                                    <img src={m.photourl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase italic">{m.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {m.dni}</p>
                                  </div>
                                </button>
                              ))}
                              {filteredMembersForSelect.length === 0 && (
                                <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No hay resultados</div>
                              )}
                           </div>
                         )}
                       </div>
                     ) : (
                       <div className="flex items-center justify-between p-5 bg-primary-600/5 dark:bg-primary-600/10 rounded-3xl border-2 border-primary-600/20 animate-fade-in">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-white shadow-md overflow-hidden p-1">
                                <img src={selectedMemberInModal.photourl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover rounded-xl" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-primary-600 uppercase italic leading-none">{selectedMemberInModal.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">DNI: {selectedMemberInModal.dni}</p>
                             </div>
                          </div>
                          <button 
                            onClick={() => { setFormData({...formData, member_id: ''}); setMemberSearchQuery(''); }}
                            className="p-2 bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-xl transition-all shadow-sm"
                          >
                            <X size={16} />
                          </button>
                       </div>
                     )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Importe ($)</label>
                       <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-xl dark:text-white outline-none border border-transparent dark:border-white/5 shadow-inner" />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Periodo</label>
                       <input type="month" value={formData.period} onChange={e => setFormData({...formData, period: e.target.value})} className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5" />
                    </div>
                  </div>

                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Método de Pago</label>
                     <div className="relative">
                       <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none">
                         {['Efectivo', 'Transferencia Bancaria', 'Tarjeta Débito', 'Tarjeta Crédito', 'QR / Billetera Digital', 'Débito Automático', 'Otro'].map(m => <option key={m} value={m}>{m}</option>)}
                       </select>
                       <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                     </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Adjuntar Comprobante</label>
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                     <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full h-40 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all cursor-pointer overflow-hidden ${formData.receipt_url ? 'bg-primary-600/5 border-primary-600' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/5 hover:border-primary-600'}`}
                     >
                        {formData.receipt_url ? (
                           <div className="flex flex-col items-center gap-2">
                              {formData.receipt_url.includes('images') || formData.receipt_url.startsWith('data:image') ? (
                                <img src={formData.receipt_url} className="w-20 h-20 object-cover rounded-xl shadow-lg" />
                              ) : (
                                <Receipt size={40} className="text-primary-600" />
                              )}
                              <span className="text-[9px] font-black uppercase text-primary-600">Cargado con éxito</span>
                           </div>
                        ) : (
                           <>
                              <Camera size={32} className="text-slate-300" />
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Subir Imagen / PDF</span>
                           </>
                        )}
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Vencimiento</label>
                       <input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-xs dark:text-white outline-none border border-transparent dark:border-white/5" />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Ref. Operación</label>
                       <input value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} placeholder="NRO TRANSF" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-xs dark:text-white outline-none border border-transparent dark:border-white/5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-end gap-4">
               <button onClick={() => setShowModal(false)} className="px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">Cancelar</button>
               <button onClick={handleSave} disabled={isSaving} className="flex items-center justify-center gap-4 bg-primary-600 text-white px-16 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                 {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                 Registrar Pago
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Historial Individual */}
      {selectedMemberHistory && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[501] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white dark:bg-[#0f121a] w-full max-w-3xl rounded-[3rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col h-[80vh]">
              <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-lg"><img src={selectedMemberHistory.photourl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" /></div>
                   <div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">{selectedMemberHistory.name}</h3>
                      <p className="text-[9px] font-black text-primary-600 uppercase tracking-widest">Resumen Histórico de Pagos</p>
                   </div>
                </div>
                <button onClick={() => setSelectedMemberHistory(null)} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-red-500 hover:text-white transition-all"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {fees.filter(f => f.member_id === selectedMemberHistory.id).map(f => (
                  <div key={f.id} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                     <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${f.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                           {f.status === 'Paid' ? <Check size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                           <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{f.period} - {f.payment_method}</p>
                           <p className="text-lg font-black text-slate-800 dark:text-white italic">${f.amount.toLocaleString()}</p>
                        </div>
                     </div>
                     <div className="text-right flex flex-col items-end gap-2">
                        {f.receipt_url && <a href={f.receipt_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[8px] font-black uppercase text-primary-600 bg-primary-600/10 px-3 py-1.5 rounded-full hover:bg-primary-600 hover:text-white transition-all"><ExternalLink size={10} /> Ver Comprobante</a>}
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vto: {f.due_date}</p>
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {/* MODAL: Configuración de Tarifas */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[502] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col">
            <header className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg"><Save size={20} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Configurar Tarifa</h3>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Definir cuota base</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-red-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveConfig} className="p-8 space-y-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Disciplina</label>
                  <select
                    required
                    value={configFormData.discipline}
                    onChange={e => setConfigFormData({ ...configFormData, discipline: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none"
                  >
                    <option value="">Seleccionar...</option>
                    {config?.disciplines.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Rama</label>
                    <select
                      required
                      value={configFormData.branch}
                      onChange={e => setConfigFormData({ ...configFormData, branch: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Mixto">Mixto</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Categoría</label>
                    <select
                      required
                      value={configFormData.category_id}
                      onChange={e => setConfigFormData({ ...configFormData, category_id: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none"
                    >
                      <option value="">Seleccionar...</option>
                      {categoriesForModal.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Monto ($)</label>
                    <input
                      required
                      type="number"
                      value={configFormData.amount}
                      onChange={e => setConfigFormData({ ...configFormData, amount: Number(e.target.value) })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-lg dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Vencimiento (Día)</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="28"
                      value={configFormData.due_day}
                      onChange={e => setConfigFormData({ ...configFormData, due_day: Number(e.target.value) })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-lg dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-emerald-600 text-white px-8 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Guardar Tarifa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesManagement;
