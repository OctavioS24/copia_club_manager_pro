
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MemberFee, Member, ScholarshipType, InscriptionConfig } from '../types';
import { 
  Search, DollarSign, Check, Plus, X, 
  Trash2, Save, CreditCard, Loader2, History, TrendingUp, 
  ArrowUpRight, AlertTriangle, Clock, Receipt, 
  ExternalLink, Image as ImageIcon,
  ChevronDown, RefreshCw, Calendar, FileText, Upload
} from 'lucide-react';
import { db, supabase } from '../lib/supabase';

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const formatPeriodToMonthYear = (pStr: string) => {
  if (!pStr) return '---';
  const parts = pStr.split('-');
  if (parts.length !== 2) return pStr;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
  const name = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const FeesManagement: React.FC = () => {
  const [fees, setFees] = useState<MemberFee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [feeConfigs, setFeeConfigs] = useState<any[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<Member | null>(null);
  
  // Custom enhanced state variables
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  
  // Custom file input refs for specific attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para compromisos de pago
  const [commitments, setCommitments] = useState<any[]>([]);
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [selectedPlayerIdForCommitment, setSelectedPlayerIdForCommitment] = useState('');
  const [commitmentDate, setCommitmentDate] = useState('');
  const [commitmentDetail, setCommitmentDetail] = useState('');
  const [isSavingCommitment, setIsSavingCommitment] = useState(false);
  const [selectedCommitment, setSelectedCommitment] = useState<any | null>(null);
  const [commitmentSearchMemberQuery, setCommitmentSearchMemberQuery] = useState('');
  const [isCommitmentMemberDropdownOpen, setIsCommitmentMemberDropdownOpen] = useState(false);
  const commitmentDropdownRef = useRef<HTMLDivElement>(null);

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
    reference: '',
    concept: 'Cuota Mensual'
  });

  const [viewMode, setViewMode] = useState<'history' | 'registry' | 'settings' | 'commitments'>('history');
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [configFormData, setConfigFormData] = useState<any>({
    discipline: '',
    branch: '',
    category_id: '',
    amount: 0,
    due_day: 10,
    is_active: true,
    apply_surcharge: false,
    surcharge_percentage: 0
  });

  const [settingsSubTab, setSettingsSubTab] = useState<'rates' | 'scholarships' | 'inscriptions'>('rates');
  const [registrySubTab, setRegistrySubTab] = useState<'monthly' | 'inscriptions'>('monthly');
  const [conceptFilter, setConceptFilter] = useState<'all' | 'monthly' | 'inscriptions'>('all');
  const [scholarships, setScholarships] = useState<ScholarshipType[]>([]);
  const [showScholarshipModal, setShowScholarshipModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genPeriod, setGenPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [genCategoryIds, setGenCategoryIds] = useState<string[]>([]);
  const [scholarshipFormData, setScholarshipFormData] = useState<Partial<ScholarshipType>>({
    name: '',
    type: 'percentage',
    value: 0
  });

  const [inscriptions, setInscriptions] = useState<InscriptionConfig[]>([]);
  const [showInscriptionModal, setShowInscriptionModal] = useState(false);
  const [inscriptionFormData, setInscriptionFormData] = useState<Partial<InscriptionConfig>>({
    name: '',
    amount: 0,
    due_date: '',
    category_ids: []
  });

  const loadData = async () => {
    try {
      const [
        { data: feesData, error: feesError }, 
        { data: membersData, error: memError }, 
        { data: configData, error: configError },
        { data: feeConfigsData, error: feeConfigsError },
        { data: commitmentsData, error: commitmentsError }
      ] = await Promise.all([
        db.fees.getAll(),
        db.members.getAll(),
        db.config.get(),
        db.feeConfigs.getAll(),
        supabase.from('payment_commitments').select('*').order('created_at', { ascending: false })
      ]);
      
      let scholarshipTypesData: ScholarshipType[] = [];
      try {
        const { data, error } = await db.scholarshipTypes.getAll();
        if (error) {
          console.warn("Table scholarship_types might not exist yet:", error.message);
        } else {
          scholarshipTypesData = data || [];
        }
      } catch (err) {
        console.warn("Could not fetch scholarship types gracefully:", err);
      }
      setScholarships(scholarshipTypesData);

      let inscriptionsData: InscriptionConfig[] = [];
      try {
        const { data, error } = await db.inscriptionConfigs.getAll();
        if (error) {
          console.warn("Table inscription_configs might not exist yet:", error.message);
        } else {
          inscriptionsData = data || [];
        }
      } catch (err) {
        console.warn("Could not fetch inscription configs gracefully:", err);
      }
      setInscriptions(inscriptionsData);
      
      if (feesError) console.error("Error loading fees:", feesError);
      if (memError) console.error("Error loading members:", memError);
      if (configError) console.error("Error loading config:", configError);
      if (feeConfigsError) console.error("Error loading fee configs:", feeConfigsError);
      if (commitmentsError) console.error("Error loading commitments:", commitmentsError);

      if (configData) setConfig(configData);
      if (feeConfigsData) setFeeConfigs(feeConfigsData);
      if (commitmentsData) setCommitments(commitmentsData);
      
      if (feesData && membersData) {
        const enrichedFees = feesData.map(f => ({
          ...f,
          member: membersData.find(m => m.id === f.member_id)
        }));
        setFees(enrichedFees);
      } else if (feesData) {
        setFees(feesData);
      }
      
      if (membersData) {
        const filteredMembers = membersData.filter(m => {
          const role = m.systemrole;
          // Se incluye por defecto a Socios, o si no tienen rol institucional asignado asumimos Socio/Jugador.
          // Se excluyen explícitamente los roles directivos, técnicos y médicos.
          return role === 'Socio' || !role || (role !== 'Admin' && role !== 'Administrativo' && role !== 'Entrenador' && role !== 'Medico');
        });
        setMembers(filteredMembers);
      }
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
      if (commitmentDropdownRef.current && !commitmentDropdownRef.current.contains(event.target as Node)) {
        setIsCommitmentMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMembersForCommitmentSelect = useMemo(() => {
    if (!commitmentSearchMemberQuery.trim()) return members.slice(0, 10);
    const tokens = commitmentSearchMemberQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return members.filter(m => {
      const name = m.name.toLowerCase();
      const dni = m.dni.toLowerCase();
      return tokens.every(token => name.includes(token) || dni.includes(token));
    }).slice(0, 8);
  }, [members, commitmentSearchMemberQuery]);

  const selectedMemberInCommitmentModal = useMemo(() => 
    members.find(m => m.id === selectedPlayerIdForCommitment), 
  [members, selectedPlayerIdForCommitment]);

  const handleSaveCommitment = async () => {
    if (!selectedPlayerIdForCommitment) return alert("Selecciona un miembro");
    if (!commitmentDate) return alert("Selecciona una fecha");
    if (!commitmentDetail.trim()) return alert("Ingresa un detalle");

    setIsSavingCommitment(true);
    try {
      const { error } = await supabase
        .from('payment_commitments')
        .insert({
          member_id: selectedPlayerIdForCommitment,
          commitment_date: commitmentDate,
          detail: commitmentDetail,
          fulfilled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      await loadData();
      setShowCommitmentModal(false);
      setSelectedPlayerIdForCommitment('');
      setCommitmentDate('');
      setCommitmentDetail('');
      setCommitmentSearchMemberQuery('');
      alert("Compromiso de pago guardado correctamente");
    } catch (e: any) {
      console.error("Error saving commitment:", e);
      alert("Error al guardar: " + (e.message || JSON.stringify(e)));
    } finally {
      setIsSavingCommitment(false);
    }
  };

  const toggleCommitmentFulfilled = async (commitmentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('payment_commitments')
        .update({ fulfilled: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', commitmentId);
      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error("Error toggling commitment:", err);
      alert("Error al cambiar estado: " + err.message);
    }
  };

  const deleteCommitment = async (commitmentId: string) => {
    if (!confirm("¿Eliminar este compromiso de pago?")) return;
    try {
      const { error } = await supabase
        .from('payment_commitments')
        .delete()
        .eq('id', commitmentId);
      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error("Error deleting commitment:", err);
      alert("Error al eliminar compromiso: " + err.message);
    }
  };

  // Helper for finding a player's main payment category context
  const getMainAssignment = useCallback((m: Member) => {
    const playerAssignments = m.assignments?.filter(a => !a.role || a.role === 'PLAYER') || [];
    let main = m.assignments?.find(a => a.is_main);
    if (!main && playerAssignments.length === 1) {
      main = playerAssignments[0];
    }
    return main;
  }, []);

  const getFeeConfigForFee = useCallback((f: any) => {
    if (!f || !f.member) return null;
    const member = f.member;
    const assignment = getMainAssignment(member);
    if (!assignment) return null;
    
    return feeConfigs.find(rc => 
      rc.discipline === assignment.discipline && 
      (rc.branch === member.gender || (rc as any).branch === member.gender) && 
      rc.category_id === (assignment.category_id || assignment.category)
    );
  }, [feeConfigs, getMainAssignment]);

  const isScholarshipActive = useCallback((member: Member, dateStr?: string) => {
    if (!member || !member.has_scholarship || !member.scholarship_type_id) return false;
    
    const todayStr = dateStr || new Date().toISOString().split('T')[0];
    
    // Check start date
    if (member.scholarship_start_date && member.scholarship_start_date > todayStr) {
      return false;
    }
    
    // Check end date
    if (member.scholarship_end_date && member.scholarship_end_date < todayStr) {
      return false;
    }
    
    return true;
  }, []);

  const getDiscountedAmount = useCallback((baseAmount: number, member: Member, referenceDate?: string, concept?: string) => {
    // La beca (descuento) solo aplica para Cuotas Mensuales ("Cuota Mensual" o vacío/indefinido)
    const isMonthly = !concept || concept === 'Cuota Mensual';
    if (!isMonthly) return baseAmount;

    if (!member || !isScholarshipActive(member, referenceDate)) return baseAmount;
    
    const scholarship = scholarships.find(s => s.id === member.scholarship_type_id);
    if (!scholarship) return baseAmount;
    
    if (scholarship.type === 'percentage') {
      const discount = baseAmount * (scholarship.value / 100);
      return Math.max(0, baseAmount - discount);
    } else if (scholarship.type === 'fixed') {
      return Math.max(0, baseAmount - scholarship.value);
    }
    
    return baseAmount;
  }, [scholarships, isScholarshipActive]);

  const getFeeAmountWithSurcharge = useCallback((fee: any) => {
    if (!fee) return 0;
    
    // Si la cuota ya está paga, devolvemos el monto que se pagó (histórico y guardado)
    if (fee.status === 'Paid') {
      return fee.amount || 0;
    }
    
    // Obtener miembro asociado a la cuota
    const member = fee.member || members.find(m => m.id === fee.member_id);
    
    // Aplicar descuento por beca si corresponde (comprobando concepto)
    const baseAmount = member ? getDiscountedAmount(fee.amount || 0, member, fee.due_date, fee.concept) : (fee.amount || 0);

    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr <= fee.due_date) {
      return baseAmount;
    }
    const configObj = getFeeConfigForFee(fee);
    if (configObj && configObj.apply_surcharge && configObj.surcharge_percentage > 0) {
      const surcharge = baseAmount * (configObj.surcharge_percentage / 100);
      return baseAmount + surcharge;
    }
    return baseAmount;
  }, [members, getDiscountedAmount, getFeeConfigForFee]);

  const suggestFee = useCallback((member: Member) => {
    // Buscar la asignación principal
    const playerAssignments = member.assignments?.filter(a => !a.role || a.role === 'PLAYER') || [];
    let assignment = member.assignments?.find(a => a.is_main);
    
    // Si no tiene una principal marcada explícitamente, pero sólo tiene una asignación de jugador, la usamos
    if (!assignment && playerAssignments.length === 1) {
      assignment = playerAssignments[0];
    }
    
    if (!assignment) {
      return { amount: 0, due_day: 10, error: 'Sin categoría principal' };
    }

    const rate = feeConfigs.find(rc => 
      rc.discipline === assignment.discipline && 
      rc.branch === member.gender && 
      (rc.category_id === assignment.category_id || rc.category_id === assignment.category)
    );

    const refDate = `${selectedPeriod}-10`;

    if (rate) {
      const discountedAmount = getDiscountedAmount(rate.amount, member, refDate, 'Cuota Mensual');
      return { amount: discountedAmount, due_day: rate.due_day };
    }

    const discountedDefault = getDiscountedAmount(5000, member, refDate, 'Cuota Mensual');
    return { amount: discountedDefault, due_day: 10, error: 'Tarifa no configurada' };
  }, [feeConfigs, selectedPeriod, getDiscountedAmount]);

  // BUSCADOR PRINCIPAL (Tabla) con Filtros
  const filteredFees = useMemo(() => {
    let result = fees;

    // Filtro por Concepto
    if (conceptFilter === 'monthly') {
      result = result.filter(f => !f.concept || f.concept === 'Cuota Mensual');
    } else if (conceptFilter === 'inscriptions') {
      result = result.filter(f => f.concept && f.concept.startsWith('Inscripción'));
    }

    // Filtro por Categoría
    if (filterCategory) {
      result = result.filter(f => {
        if (!f.member) return true;
        const main = getMainAssignment(f.member);
        return main ? (main.category_id === filterCategory || main.category === filterCategory) : false;
      });
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

    // Filtro por Periodo
    if (selectedPeriod) {
      result = result.filter(f => {
        if (!f.period) return true;
        if (f.period === selectedPeriod) return true;
        if (f.concept && f.concept.startsWith('Inscripción')) {
          const year = selectedPeriod.split('-')[0];
          return f.period.startsWith(year);
        }
        return false;
      });
    }

    return result.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  }, [fees, searchTerm, filterCategory, conceptFilter, selectedPeriod, getMainAssignment]);

  // Registry Mode: List of members with their status for the current period
  const registryData = useMemo(() => {
    let list = members;

    if (filterCategory) {
      list = list.filter(m => {
        const main = getMainAssignment(m);
        return main ? (main.category_id === filterCategory || main.category === filterCategory) : false;
      });
    }
    if (searchTerm.trim()) {
      const tokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      list = list.filter(m => {
        const name = m.name.toLowerCase();
        const dni = m.dni.toLowerCase();
        return tokens.every(token => name.includes(token) || dni.includes(token));
      });
    }

    const mapped = list.map(m => {
      const fee = fees.find(f => f.member_id === m.id && f.period === selectedPeriod && (!f.concept || f.concept === 'Cuota Mensual'));
      return { member: m, fee };
    }).filter(item => {
      const m = item.member;
      const memberFees = fees.filter(f => f.member_id === m.id && f.status !== 'Anulado' && (!f.concept || f.concept === 'Cuota Mensual'));
      const feePeriods = memberFees.map(f => f.period).filter(Boolean);
      const earliestFeePeriod = feePeriods.length > 0 ? feePeriods.sort()[0] : null;
      const memberCreatedPeriod = m.created_at ? m.created_at.slice(0, 7) : selectedPeriod;
      const currentPeriodStr = new Date().toISOString().slice(0, 7);
      const startingPeriod = earliestFeePeriod ? (earliestFeePeriod < memberCreatedPeriod ? earliestFeePeriod : memberCreatedPeriod) : currentPeriodStr;
      
      return selectedPeriod >= startingPeriod;
    });

    if (showDebtorsOnly) {
      return mapped.filter(item => {
        if (!item.fee) {
          return !!getMainAssignment(item.member);
        }
        return item.fee.status !== 'Paid' && item.fee.status !== 'Anulado';
      });
    }

    return mapped;
  }, [members, fees, selectedPeriod, filterCategory, searchTerm, showDebtorsOnly, getMainAssignment]);

  const registryInscriptionsData = useMemo(() => {
    let list = members;

    if (filterCategory) {
      list = list.filter(m => {
        const main = getMainAssignment(m);
        return main ? (main.category_id === filterCategory || main.category === filterCategory) : false;
      });
    }
    if (searchTerm.trim()) {
      const tokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      list = list.filter(m => {
        const name = m.name.toLowerCase();
        const dni = m.dni.toLowerCase();
        return tokens.every(token => name.includes(token) || dni.includes(token));
      });
    }

    const rows: { member: Member; inscription: InscriptionConfig; fee?: MemberFee }[] = [];

    list.forEach(m => {
      const main = getMainAssignment(m);
      if (!main) return;

      const applicable = inscriptions.filter(ins => {
        if (!ins.category_ids || ins.category_ids.length === 0) return true;
        return ins.category_ids.includes(main.category_id) || ins.category_ids.includes(main.category);
      });

      applicable.forEach(ins => {
        const matchingFee = fees.find(f => 
          f.member_id === m.id && 
          f.concept === `Inscripción: ${ins.name}`
        );
        rows.push({
          member: m,
          inscription: ins,
          fee: matchingFee
        });
      });
    });

    return rows;
  }, [members, inscriptions, fees, filterCategory, searchTerm, getMainAssignment]);

  const contextStats = useMemo(() => {
    if (viewMode === 'history') {
      const activeFees = filteredFees.filter(f => f.status !== 'Anulado');
      const paid = activeFees.filter(f => f.status === 'Paid').reduce((acc, f) => acc + (f.amount || 0), 0);
      const total = activeFees.reduce((acc, f) => acc + getFeeAmountWithSurcharge(f), 0);
      const pending = Math.max(0, total - paid);
      
      const periods = Array.from(new Set(activeFees.filter(f => f.status === 'Paid').map(f => f.period)));
      const averagePerMonth = periods.length > 0 ? paid / periods.length : paid;
      
      const lateUniqueMembers = new Set(
        activeFees
          .filter(f => f.status !== 'Paid' && (f.status === 'Late' || new Date(f.due_date) < new Date()))
          .map(f => f.member_id)
      ).size;
  
      return {
        paid,
        pending,
        lateCount: lateUniqueMembers,
        averagePerMonth,
        total
      };
    } else if (viewMode === 'registry') {
      if (registrySubTab === 'monthly') {
        let total = 0;
        let paid = 0;
        let pending = 0;
        let lateCount = 0;
  
        registryData.forEach(({ member, fee }) => {
          if (fee && fee.status === 'Anulado') return; // Excluir anulados de las proyecciones
          const baseAmount = fee ? fee.amount : suggestFee(member).amount;
          const finalAmount = fee ? getFeeAmountWithSurcharge(fee) : baseAmount;
          total += finalAmount;
          if (fee && fee.status === 'Paid') {
            paid += fee.amount || 0;
          } else {
            pending += finalAmount;
            const dueDateStr = fee ? fee.due_date : `${selectedPeriod}-${suggestFee(member).due_day.toString().padStart(2, '0')}`;
            if (new Date(dueDateStr) < new Date()) {
              lateCount += 1;
            }
          }
        });

        return {
          total,
          paid,
          pending,
          lateCount,
          averagePerMonth: 0
        };
      } else {
        let total = 0;
        let paid = 0;
        let pending = 0;
        let lateCount = 0;

        registryInscriptionsData.forEach(({ inscription, fee }) => {
          const finalAmount = fee ? getFeeAmountWithSurcharge(fee) : inscription.amount;
          total += finalAmount;
          if (fee && fee.status === 'Paid') {
            paid += fee.amount || 0;
          } else {
            pending += finalAmount;
            if (new Date(inscription.due_date) < new Date()) {
              lateCount += 1;
            }
          }
        });

        return {
          total,
          paid,
          pending,
          lateCount,
          averagePerMonth: 0
        };
      }
    }
    return { paid: 0, pending: 0, lateCount: 0, averagePerMonth: 0, total: 0 };
  }, [viewMode, registrySubTab, filteredFees, registryData, registryInscriptionsData, selectedPeriod, suggestFee, getFeeAmountWithSurcharge]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    console.log("Saving Fee Config:", configFormData, "Selected Class IDs:", selectedCategoryIds);
    try {
      if (!configFormData.discipline || !configFormData.branch) {
        throw new Error("Disciplina y Rama son obligatorios.");
      }
      if (selectedCategoryIds.length === 0) {
        throw new Error("Debe seleccionar al menos una categoría.");
      }

      const configsToSave = selectedCategoryIds.map(catId => {
        const isEditingOriginal = configFormData.id && catId === configFormData.category_id;
        const payload: any = {
          discipline: configFormData.discipline,
          branch: configFormData.branch,
          category_id: catId,
          amount: Number(configFormData.amount),
          due_day: Number(configFormData.due_day),
          is_active: configFormData.is_active === undefined ? true : configFormData.is_active,
          apply_surcharge: !!configFormData.apply_surcharge,
          surcharge_percentage: Number(configFormData.surcharge_percentage || 0)
        };
        if (isEditingOriginal) {
          payload.id = configFormData.id;
        }
        return payload;
      });

      const { error } = await db.feeConfigs.upsert(configsToSave);
      if (error) throw error;
      
      await loadData();
      setShowConfigModal(false);
      setConfigFormData({ 
        discipline: '', 
        branch: '', 
        category_id: '', 
        amount: 0, 
        due_day: 10, 
        is_active: true,
        apply_surcharge: false,
        surcharge_percentage: 0
      });
      setSelectedCategoryIds([]);
      alert("Configuración de tarifa guardada correctamente");
    } catch (error: any) {
      console.error("Error saving config:", error);
      alert("Error al guardar: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const saveScholarshipType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scholarshipFormData.name) {
      alert("El nombre de la beca es obligatorio.");
      return;
    }
    if (scholarshipFormData.value === undefined || scholarshipFormData.value < 0) {
      alert("El valor debe ser mayor o igual a cero.");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        id: scholarshipFormData.id || undefined,
        name: scholarshipFormData.name,
        type: scholarshipFormData.type || 'percentage',
        value: Number(scholarshipFormData.value || 0)
      };
      
      const { error } = await db.scholarshipTypes.upsert(payload);
      if (error) throw error;
      
      await loadData();
      setShowScholarshipModal(false);
      setScholarshipFormData({
        name: '',
        type: 'percentage',
        value: 0
      });
      alert("Tipo de beca guardado correctamente");
    } catch (error: any) {
      console.error("Error saving scholarship type:", error);
      alert("Error al guardar: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteScholarshipType = async (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar este tipo de beca?")) {
      try {
        const { error } = await db.scholarshipTypes.delete(id);
        if (error) throw error;
        await loadData();
        alert("Tipo de beca eliminado");
      } catch (error: any) {
        console.error("Error deleting scholarship type:", error);
        alert("Error al eliminar: " + (error.message || JSON.stringify(error)));
      }
    }
  };

  const saveInscriptionConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inscriptionFormData.name) {
      alert("El nombre del tipo de inscripción es obligatorio.");
      return;
    }
    if (inscriptionFormData.amount === undefined || inscriptionFormData.amount < 0) {
      alert("El monto debe ser mayor o igual a cero.");
      return;
    }
    if (!inscriptionFormData.due_date) {
      alert("La fecha de vencimiento es obligatoria.");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        id: inscriptionFormData.id || undefined,
        name: inscriptionFormData.name,
        amount: Number(inscriptionFormData.amount || 0),
        due_date: inscriptionFormData.due_date,
        category_ids: inscriptionFormData.category_ids || []
      };
      
      const { error } = await db.inscriptionConfigs.upsert(payload);
      if (error) throw error;
      
      await loadData();
      setShowInscriptionModal(false);
      setInscriptionFormData({
        name: '',
        amount: 0,
        due_date: '',
        category_ids: []
      });
      alert("Tipo de inscripción guardado correctamente");
    } catch (error: any) {
      console.error("Error saving inscription config:", error);
      alert("Error al guardar: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteInscriptionConfig = async (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar este tipo de inscripción?")) {
      try {
        const { error } = await db.inscriptionConfigs.delete(id);
        if (error) throw error;
        await loadData();
        alert("Tipo de inscripción eliminado");
      } catch (error: any) {
        console.error("Error deleting inscription config:", error);
        alert("Error al eliminar: " + (error.message || JSON.stringify(error)));
      }
    }
  };

  const categories = useMemo(() => {
    if (!config) return [];
    return config.disciplines.flatMap(d => d.branches.flatMap(b => b.categories));
  }, [config]);

  // Seleccionar la primera categoría por defecto si está vacía
  useEffect(() => {
    if (categories.length > 0 && !filterCategory) {
      setFilterCategory(categories[0].id || categories[0].name);
    }
  }, [categories, filterCategory]);

  const categoryNamesMap = useMemo(() => {
    if (!config) return {};
    const map: Record<string, string> = {};
    config.disciplines.forEach(d => {
      d.branches.forEach(b => {
        b.categories.forEach(c => {
          map[c.id] = c.name;
        });
      });
    });
    return map;
  }, [config]);

  const categoriesForModal = useMemo(() => {
    if (!config || !configFormData.discipline || !configFormData.branch) return [];
    const discipline = config.disciplines.find(d => d.name === configFormData.discipline);
    if (!discipline) return [];

    const branchObj = discipline.branches.find(b => b.gender === configFormData.branch || (b as any).name === configFormData.branch);
    const categoriesList = branchObj?.categories || [];

    // Excluir categorías que ya tengan una configuración para esta disciplina + rama
    // EXCEPTO si es la categoría en edición
    return categoriesList.filter(cat => {
      const alreadyConfigured = feeConfigs.some(fc => 
        fc.discipline === configFormData.discipline &&
        fc.branch === configFormData.branch &&
        fc.category_id === cat.id &&
        (!configFormData.id || fc.id !== configFormData.id)
      );
      return !alreadyConfigured;
    });
  }, [config, configFormData.discipline, configFormData.branch, feeConfigs, configFormData.id]);

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

  const getNetRealAmountForPeriodObj = useCallback((p: string, member: Member, fee?: MemberFee) => {
    if (!member) return 0;

    if (fee) {
      if (fee.status === 'Paid') {
        return fee.amount || 0;
      }
      // If Pending or Late, we calculate the dynamic discounted amount + surcharge
      const baseAmount = fee.amount || 0; // The stored base amount
      // Apply scholarship/discount based on the due date of this fee
      const discountedAmount = getDiscountedAmount(baseAmount, member, fee.due_date, fee.concept);
      
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr <= fee.due_date) {
        return discountedAmount;
      }
      
      // Look up configObj
      const tempFee = { ...fee, member };
      const configObj = getFeeConfigForFee(tempFee);
      if (configObj && configObj.apply_surcharge && configObj.surcharge_percentage > 0) {
        const surcharge = discountedAmount * (configObj.surcharge_percentage / 100);
        return discountedAmount + surcharge;
      }
      return discountedAmount;
    } else {
      // Suggestion: find configuration rate
      const main = getMainAssignment(member);
      if (!main) return 5000;

      const rate = feeConfigs.find(rc => 
        rc.discipline === main.discipline && 
        rc.branch === member.gender && 
        rc.category_id === (main.category_id || main.category)
      );

      const baseAmount = rate ? rate.amount : 5000;
      const dueDay = rate ? rate.due_day : 10;
      const dueDate = `${p}-${dueDay.toString().padStart(2, '0')}`;
      
      const discountedAmount = getDiscountedAmount(baseAmount, member, dueDate, 'Cuota Mensual');
      
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr <= dueDate) {
        return discountedAmount;
      }
      
      // Look up configObj
      const tempFee = { member_id: member.id, member, due_date: dueDate };
      const configObj = getFeeConfigForFee(tempFee);
      if (configObj && configObj.apply_surcharge && configObj.surcharge_percentage > 0) {
        const surcharge = discountedAmount * (configObj.surcharge_percentage / 100);
        return discountedAmount + surcharge;
      }
      return discountedAmount;
    }
  }, [getDiscountedAmount, getFeeConfigForFee, getMainAssignment, feeConfigs]);

  const getNetRealAmountForPeriod = useCallback((p: string, fee?: MemberFee) => {
    if (!selectedMemberInModal) return 0;
    return getNetRealAmountForPeriodObj(p, selectedMemberInModal, fee);
  }, [selectedMemberInModal, getNetRealAmountForPeriodObj]);

  const getFeeBreakdown = useCallback((fee: any) => {
    const member = fee.member || members.find(m => m.id === fee.member_id);
    if (!member) {
      return { base: fee.amount || 0, discount: 0, scholarshipName: '', surcharge: 0, surchargePercentage: 0, total: fee.amount || 0, isDirect: true };
    }
    
    // Find original rate if possible (to derive the original base amount)
    const assignment = getMainAssignment(member);
    let originalBase = fee.amount || 0;
    if (assignment) {
      const rate = feeConfigs.find(rc => 
        rc.discipline === assignment.discipline && 
        rc.branch === member.gender && 
        rc.category_id === (assignment.category_id || assignment.category)
      );
      if (rate) {
        originalBase = rate.amount;
      }
    }
    
    // Non-monthly/custom concepts have no scholarship/surcharge by default (unless specified)
    const isMonthly = !fee.concept || fee.concept === 'Cuota Mensual';
    if (!isMonthly) {
      return { base: fee.amount || 0, discount: 0, scholarshipName: '', surcharge: 0, surchargePercentage: 0, total: fee.amount || 0, isDirect: true };
    }

    // Scholarship calculation
    let discount = 0;
    const scholarshipActive = isScholarshipActive(member, fee.due_date);
    let scholarshipName = '';
    if (scholarshipActive && member.scholarship_type_id) {
      const scholarship = scholarships.find(s => s.id === member.scholarship_type_id);
      if (scholarship) {
        scholarshipName = scholarship.name;
        if (scholarship.type === 'percentage') {
          discount = originalBase * (scholarship.value / 100);
        } else if (scholarship.type === 'fixed') {
          discount = Math.min(originalBase, scholarship.value);
        }
      }
    }
    
    const baseWithDiscount = Math.max(0, originalBase - discount);
    
    // Surcharge calculation
    let surcharge = 0;
    let surchargePercentage = 0;
    
    // Determine if surcharge should apply:
    // If PAID, check if paid_date was after due_date. If PENDING, check if today is after due_date.
    const refDate = fee.payment_date || new Date().toISOString().split('T')[0];
    const isLate = refDate > fee.due_date;
    
    if (isLate) {
      const configObj = getFeeConfigForFee(fee);
      if (configObj && configObj.apply_surcharge && configObj.surcharge_percentage > 0) {
        surchargePercentage = configObj.surcharge_percentage;
        surcharge = baseWithDiscount * (surchargePercentage / 100);
      }
    }
    
    const computedTotal = baseWithDiscount + surcharge;
    
    return {
      base: originalBase,
      discount,
      scholarshipName,
      surcharge,
      surchargePercentage,
      total: fee.status === 'Paid' ? (fee.amount || computedTotal) : computedTotal,
      isDirect: false
    };
  }, [members, scholarships, feeConfigs, getFeeConfigForFee, getMainAssignment, isScholarshipActive]);

  const outstandingPeriods = useMemo(() => {
    if (!selectedMemberInModal) return [];

    const list: { period: string; label: string; fee?: MemberFee; type: 'due' | 'current' | 'future' }[] = [];
    const now = new Date();
    const currentPeriodStr = now.toISOString().slice(0, 7); // 'YYYY-MM'
    
    // Find dynamic starting period for member
    const memberFees = fees.filter(f => f.member_id === selectedMemberInModal.id && f.status !== 'Anulado');
    const feePeriods = memberFees.map(f => f.period).filter(Boolean);
    const earliestFeePeriod = feePeriods.length > 0 ? feePeriods.sort()[0] : null;
    const memberCreatedPeriod = selectedMemberInModal.created_at ? selectedMemberInModal.created_at.slice(0, 7) : currentPeriodStr;
    const startingPeriod = earliestFeePeriod || memberCreatedPeriod;

    // Check if there is any unpaid (no Fee, or Fee is not Paid/Anulado) period <= currentPeriodStr
    let hasUnpaidCurrentOrPast = false;
    const startYear = parseInt(startingPeriod.slice(0, 4));
    const startMonth = parseInt(startingPeriod.slice(5, 7)) - 1;
    const currYear = parseInt(currentPeriodStr.slice(0, 4));
    const currMonth = parseInt(currentPeriodStr.slice(5, 7)) - 1;

    const diffMonths = (currYear - startYear) * 12 + (currMonth - startMonth);
    for (let i = 0; i <= diffMonths; i++) {
      const d = new Date(startYear, startMonth + i, 1);
      const p = d.toISOString().slice(0, 7);
      const existingFee = fees.find(f => 
        f.member_id === selectedMemberInModal.id && 
        f.period === p && 
        (!f.concept || f.concept === 'Cuota Mensual')
      );
      const isPaidOrVoided = existingFee && (existingFee.status === 'Paid' || existingFee.status === 'Anulado');
      if (!isPaidOrVoided) {
        hasUnpaidCurrentOrPast = true;
        break;
      }
    }

    // Generar últimos 12 meses y próximos 3 meses
    for (let i = -12; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const p = d.toISOString().slice(0, 7); // 'YYYY-MM'
      
      if (p < startingPeriod) continue;

      // Si el usuario tiene deudas pendientes del mes actual o pasados, ocultar meses futuros
      if (hasUnpaidCurrentOrPast && p > currentPeriodStr) {
        continue;
      }

      const existingFee = fees.find(f => 
        f.member_id === selectedMemberInModal.id && 
        f.period === p && 
        (!f.concept || f.concept === 'Cuota Mensual')
      );
      
      let type: 'due' | 'current' | 'future' = 'due';
      if (p === currentPeriodStr) {
        type = 'current';
      } else if (p > currentPeriodStr) {
        type = 'future';
      }
      
      const monthName = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      const feeStatus = existingFee?.status;
      const isVoided = existingFee?.status === 'Anulado';
      
      if (!existingFee || (feeStatus !== 'Paid' && !isVoided)) {
        list.push({
          period: p,
          label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          fee: existingFee,
          type
        });
      }
    }
    return list;
  }, [selectedMemberInModal, fees]);

  const selectedPeriodsDetail = useMemo(() => {
    if (!selectedMemberInModal) return [];
    const validPeriods = selectedPeriods.filter(p => outstandingPeriods.some(op => op.period === p));
    return validPeriods.map(p => {
      const existingFee = fees.find(f => 
        f.member_id === selectedMemberInModal.id && 
        f.period === p && 
        (!f.concept || f.concept === 'Cuota Mensual')
      );
      const amount = getNetRealAmountForPeriod(p, existingFee);
      return { period: p, amount, fee: existingFee };
    });
  }, [selectedPeriods, selectedMemberInModal, fees, outstandingPeriods, getNetRealAmountForPeriod]);

  const totalAmountForSelectedPeriods = useMemo(() => {
    return selectedPeriodsDetail.reduce((acc, curr) => acc + curr.amount, 0);
  }, [selectedPeriodsDetail]);

  // Form Validation Computations
  const isMemberMissing = !formData.member_id;
  
  const isPeriodMissing = formData.concept === 'Cuota Mensual' 
    ? (selectedPeriods.length === 0) 
    : (!formData.period || !formData.period.trim());
    
  const isAmountMissing = formData.concept === 'Cuota Mensual'
    ? (totalAmountForSelectedPeriods <= 0)
    : (formData.amount === undefined || formData.amount === null || isNaN(formData.amount) || formData.amount <= 0);
    
  const isPaymentMethodMissing = !formData.payment_method || !formData.payment_method.trim();
  
  const isReferenceMissing = !formData.reference || !formData.reference.trim();

  const hasValidationErrors = isMemberMissing || isPeriodMissing || isAmountMissing || isPaymentMethodMissing || isReferenceMissing;

  // Sincronizar periodos seleccionados cuando cambia el miembro o se abre el modal
  useEffect(() => {
    if (showModal) {
      if (formData.member_id && formData.concept === 'Cuota Mensual' && formData.period) {
        if (!selectedPeriods.includes(formData.period)) {
          setSelectedPeriods([formData.period]);
        }
      } else {
        setSelectedPeriods([]);
      }
      setComment(formData.comment || '');
      setSelectedFile(null);
    } else {
      setSelectedPeriods([]);
      setComment('');
      setSelectedFile(null);
    }
  }, [showModal, formData.member_id, formData.concept]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSave = async () => {
    if (hasValidationErrors) {
      alert("⚠️ Por favor completa todos los campos obligatorios.");
      return;
    }

    if (formData.concept === 'Cuota Mensual') {
      const parentMember = members.find(m => m.id === formData.member_id);
      if (!parentMember) {
        alert("⚠️ Selecciona un socio válido.");
        return;
      }
      const main = getMainAssignment(parentMember);
      if (!main) {
        alert("⚠️ No se puede registrar una cuota mensual para un socio sin categoría principal asignada.");
        return;
      }
      if (selectedPeriods.length === 0) {
        alert("⚠️ Selecciona al menos un periodo / mes para registrar el pago.");
        return;
      }
    }

    // VALIDACIÓN DE REFERENCIA O TRANSF DUPLICADA
    const trimmedReference = formData.reference?.trim();
    if (trimmedReference) {
      // Normalizamos el número de transferencia quitando espacios, guiones, comas, etc. y pasándolo a mayúsculas
      const cleanRef = trimmedReference.replace(/[\s-,.]+/g, '').toUpperCase();
      const isDuplicate = fees.some(f => 
        f.status !== 'Anulado' && 
        f.member_id !== formData.member_id &&
        f.reference && 
        f.reference.trim().replace(/[\s-,.]+/g, '').toUpperCase() === cleanRef &&
        f.id !== formData.id
      );
      if (isDuplicate) {
        alert(`⚠️ Número de transferencia duplicado: La referencia "${trimmedReference}" ya se encuentra registrada en otro pago activo. Por favor verifique el comprobante.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      let uploadedUrl = formData.receipt_url || '';
      if (selectedFile) {
        try {
          uploadedUrl = await db.fees.uploadReceipt(selectedFile);
        } catch (uploadErr) {
          console.error("Error al subir comprobante:", uploadErr);
          alert("Error al subir el archivo comprobante. Verifique la configuración de Supabase.");
          setIsSaving(false);
          return;
        }
      }

      const finalStatus = 'Paid';
      const paymentDate = formData.payment_date || new Date().toISOString().split('T')[0];

      if (formData.concept === 'Cuota Mensual' && selectedPeriods.length > 0) {
        // REGISTRO DE MÚLTIPLES MESES SELECCIONADOS
        const dbPayloads = selectedPeriods.map(p => {
          const detail = selectedPeriodsDetail.find(x => x.period === p);
          const existing = detail?.fee;
          const memberObj = members.find(m => m.id === formData.member_id)!;
          const suggestion = suggestFee(memberObj);
          const dueDate = existing ? existing.due_date : `${p}-${suggestion.due_day.toString().padStart(2, '0')}`;
          
          // Guardar el importe neto real pagado con becas y recargos aplicados
          const finalAmount = finalStatus === 'Paid' ? (detail?.amount || (existing ? existing.amount : (suggestion.amount || 5000))) : (existing ? existing.amount : (suggestion.amount || 5000));

          return {
            id: existing?.id || generateUUID(),
            member_id: formData.member_id,
            period: p,
            amount: finalAmount,
            due_date: dueDate,
            status: finalStatus,
            payment_method: formData.payment_method || 'Efectivo',
            receipt_url: uploadedUrl || '',
            reference: formData.reference || '',
            comment: comment || '',
            concept: 'Cuota Mensual',
            payment_date: paymentDate
          };
        });

        const { error } = await db.fees.upsertMany(dbPayloads);
        if (error) throw error;
      } else {
        // REGISTRO INDIVIDUAL (Inscripciones, matrículas, manuales)
        const cleanPayload = { ...formData };
        delete cleanPayload.member;
        delete cleanPayload.player;
        const payload = { 
          ...cleanPayload, 
          id: formData.id || generateUUID(),
          status: finalStatus,
          payment_date: paymentDate,
          receipt_url: uploadedUrl || '',
          comment: comment || ''
        };
        const { error } = await db.fees.upsert(payload);
        if (error) throw error;
      }
      
      await loadData();
      setShowModal(false);
      setSelectedFile(null);
      setFormData({ 
        status: 'Pending', 
        amount: 5000, 
        due_date: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0], 
        period: new Date().toISOString().slice(0, 7), 
        payment_method: 'Efectivo', 
        receipt_url: '', 
        reference: '',
        concept: 'Cuota Mensual'
      });
      setSelectedPeriods([]);
      setComment('');
      setMemberSearchQuery('');
    } catch (e: any) {
      console.error("Error saving fee:", e);
      if (e.code === 'PGRST204' || (e.message && (e.message.includes('concept') || e.message.includes('column')))) {
        setShowMigrationModal(true);
      } else {
        alert(`Error al registrar cobro: ${e.message || 'Error desconocido'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleVoidFee = async (fee: MemberFee) => {
    const reason = prompt('Por favor ingrese el motivo de la anulación (Obligatorio/Mandatorio):');
    if (!reason || !reason.trim()) {
      alert('⚠️ Para anular un cobro debe ingresar un motivo válido.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = { 
        ...fee, 
        status: 'Anulado' as const, 
        void_reason: reason,
        is_voided: true,
        comment: fee.comment ? `${fee.comment} (Anulado: ${reason})` : `Anulado: ${reason}`
      };
      delete updated.member;
      
      const { error } = await db.fees.upsert(updated);
      if (error) throw error;

      await loadData();
      alert('🎉 El cobro fue anulado exitosamente.');
    } catch (e: any) {
      console.error("Error voiding fee:", e);
      alert("Error al anular cobro: " + (e.message || "Error desconocido"));
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== 'Paid' && status !== 'Anulado';
    if (status === 'Anulado') {
      return (
        <span className="px-3 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-full border border-red-500/10 tracking-wider">
          Anulado
        </span>
      );
    }
    if (status === 'Paid') {
      const todayStr = new Date().toISOString().slice(0, 7); // YYYY-MM
      const isAnticipated = dueDate && dueDate.slice(0, 7) > todayStr;
      return (
        <span className={`px-3 py-1 ${isAnticipated ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/10 dark:bg-indigo-550/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10'} text-[10px] font-black uppercase rounded-full border tracking-wider`}>
          {isAnticipated ? 'Pagado (anticipado)' : 'Pagado'}
        </span>
      );
    }
    if (status === 'Partial') {
      return (
        <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase rounded-full border border-amber-500/10 tracking-wider">
          Parcial
        </span>
      );
    }
    if (isOverdue || status === 'Late') {
      return (
        <span className="px-3 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-full border border-red-500/10 tracking-wider animate-pulse">
          Vencido
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-slate-500/10 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase rounded-full border border-slate-500/10 tracking-wider">
        Pendiente
      </span>
    );
  };

  const handleBulkGenerateFees = async () => {
    setIsSaving(true);
    try {
      const missing = members.filter(member => {
        const main = getMainAssignment(member);
        if (!main) return false;
        const catVal = main.category_id || main.category;
        if (!genCategoryIds.includes(catVal)) return false;
        
        const hasFee = fees.some(f => f.member_id === member.id && f.period === genPeriod && (!f.concept || f.concept === 'Cuota Mensual'));
        return !hasFee && !suggestFee(member).error;
      });

      if (missing.length === 0) {
        alert("No hay cuotas pendientes para generar con la selección actual.");
        setIsSaving(false);
        return;
      }

      const newFees = missing.map(member => {
        const suggestion = suggestFee(member);
        return {
          id: generateUUID(),
          member_id: member.id,
          period: genPeriod,
          amount: suggestion.amount,
          due_date: `${genPeriod}-${suggestion.due_day.toString().padStart(2, '0')}`,
          status: 'Pending',
          payment_method: 'Efectivo',
          concept: 'Cuota Mensual',
          created_at: new Date().toISOString()
        };
      });

      const { error } = await db.fees.upsertMany(newFees);
      if (error) throw error;

      await loadData();
      setShowGenerateModal(false);
      alert(`🎉 ¡Generación Masiva Exitosa!\n\nSe han generado ${newFees.length} cuotas para el periodo ${genPeriod} de forma correcta.`);
    } catch (error: any) {
      console.error("Error al generar cuotas masivas:", error);
      if (error.code === 'PGRST204' || (error.message && (error.message.includes('concept') || error.message.includes('column')))) {
        setShowMigrationModal(true);
        setShowGenerateModal(false);
      } else {
        alert("Error al generar cuotas: " + (error.message || "Error desconocido"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const missingGenerateCount = useMemo(() => {
    if (!showGenerateModal) return 0;
    return members.filter(member => {
      const main = getMainAssignment(member);
      if (!main) return false;
      const catVal = main.category_id || main.category;
      if (!genCategoryIds.includes(catVal)) return false;
      
      const hasFee = fees.some(f => f.member_id === member.id && f.period === genPeriod && (!f.concept || f.concept === 'Cuota Mensual'));
      return !hasFee && !suggestFee(member).error;
    }).length;
  }, [showGenerateModal, genPeriod, genCategoryIds, members, fees, getMainAssignment, suggestFee]);

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto animate-fade-in pb-40">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="w-full">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none italic">
            Control de <span className="text-[var(--primary-600)]">Cuotas</span>
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[8px] sm:text-[9px] mt-4 ml-1">Administración Financiera Plegma</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {viewMode === 'settings' ? (
            settingsSubTab === 'scholarships' ? (
              <button 
                onClick={() => {
                  setScholarshipFormData({
                    name: '',
                    type: 'percentage',
                    value: 0
                  });
                  setShowScholarshipModal(true);
                }} 
                className="bg-emerald-600 text-white px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center gap-3 w-full sm:w-auto"
              >
                <Plus size={18} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-widest">Nueva Beca</span>
              </button>
            ) : settingsSubTab === 'inscriptions' ? (
              <button 
                onClick={() => {
                  setInscriptionFormData({
                    name: '',
                    amount: 0,
                    due_date: '',
                    category_ids: []
                  });
                  setShowInscriptionModal(true);
                }} 
                className="bg-emerald-600 text-white px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center gap-3 w-full sm:w-auto"
              >
                <Plus size={18} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-widest">Nueva Inscripción</span>
              </button>
            ) : (
              <button 
                onClick={() => {
                  setConfigFormData({ 
                    discipline: '', 
                    branch: '', 
                    category_id: '', 
                    amount: 0, 
                    due_day: 10, 
                    is_active: true,
                    apply_surcharge: false,
                    surcharge_percentage: 0
                  });
                  setSelectedCategoryIds([]);
                  setShowConfigModal(true);
                }} 
                className="bg-emerald-600 text-white px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-xl shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center gap-3 w-full sm:w-auto"
              >
                <Plus size={18} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-widest">Nueva Tarifa</span>
              </button>
            )
          ) : viewMode === 'commitments' ? (
            <button 
              onClick={() => {
                setSelectedPlayerIdForCommitment('');
                setCommitmentDate(new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]);
                setCommitmentDetail('');
                setShowCommitmentModal(true);
              }} 
              className="bg-amber-500 text-white px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center gap-3 w-full sm:w-auto mt-2 sm:mt-0"
            >
              <Plus size={18} strokeWidth={3} /> <span className="text-[10px] font-black uppercase tracking-widest">Nuevo Compromiso</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Navegación de Paneles */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 overflow-x-auto no-scrollbar mb-8">
        <button 
          onClick={() => { setViewMode('history'); setConceptFilter('all'); }}
          className={`flex-1 min-w-[100px] px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-primary-500 text-primary-contrast shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Historial
        </button>
        <button 
          onClick={() => { setViewMode('registry'); setRegistrySubTab('monthly'); }}
          className={`flex-1 min-w-[120px] px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'registry' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Registro Mensual
        </button>
        <button 
          onClick={() => setViewMode('commitments')}
          className={`flex-1 min-w-[120px] px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'commitments' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Compromisos
        </button>
        <button 
          onClick={() => setViewMode('settings')}
          className={`flex-1 min-w-[100px] px-4 md:px-6 py-2.5 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'settings' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Configuración
        </button>
      </div>

      {/* Panel Unificado de Filtros */}
      {viewMode !== 'settings' && (
        <div className="bg-white dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm mb-8 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end animate-fade-in">
            
            {/* Filtro 1: Buscador */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 ml-1">Socio / DNI</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar socio o DNI..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-bold text-xs uppercase tracking-wider leading-none h-[46px]"
                />
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Filtro 2: Concepto */}
            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 ml-1">Concepto</label>
              <select
                value={viewMode === 'registry' ? (registrySubTab === 'monthly' ? 'monthly' : 'inscriptions') : conceptFilter}
                onChange={e => {
                  const val = e.target.value as any;
                  if (viewMode === 'registry') {
                    if (val === 'all') {
                      setConceptFilter('all');
                      setRegistrySubTab('monthly');
                    } else if (val === 'monthly') {
                      setConceptFilter('monthly');
                      setRegistrySubTab('monthly');
                    } else {
                      setConceptFilter('inscriptions');
                      setRegistrySubTab('inscriptions');
                    }
                  } else {
                    setConceptFilter(val);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-900/50 pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-bold text-xs uppercase tracking-wider appearance-none cursor-pointer border-l-4 border-l-primary-500 h-[46px]"
              >
                {viewMode === 'history' && <option value="all">TODOS LOS CONCEPTOS</option>}
                <option value="monthly">CUOTAS MENSUALES</option>
                <option value="inscriptions">INSCRIPCIONES / MATRÍCULAS</option>
              </select>
              <ChevronDown className="absolute right-4 top-[24px] text-slate-400 pointer-events-none" size={14} />
            </div>

            {/* Filtro 3: Categoría */}
            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 ml-1">Categoría</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/50 pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-bold text-xs uppercase tracking-wider appearance-none cursor-pointer border-l-4 border-l-primary-500 h-[46px]"
              >
                <option value="">TODAS LAS CATEGORÍAS</option>
                {Array.from(new Set(categories.map(c => c.name))).map(catName => {
                  const cat = categories.find(c => c.name === catName);
                  return <option key={cat?.id || catName} value={cat?.id || catName}>{catName}</option>;
                })}
              </select>
              <ChevronDown className="absolute right-4 top-[24px] text-slate-400 pointer-events-none" size={14} />
            </div>

            {/* Filtro 4: Período / Mes */}
            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 ml-1">Periodo / Mes</label>
              <input
                type="month"
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-bold text-xs uppercase tracking-wider cursor-pointer border-l-4 border-l-primary-500 h-[46px]"
              />
            </div>

          </div>

          {/* Botones de Acción Masiva */}
          {viewMode === 'registry' && (
            <div className="flex flex-wrap items-center justify-between gap-4 mt-2 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-6">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Viendo: <span className="text-primary-600 font-black">{registrySubTab === 'monthly' ? 'PLANILLA MENSUAL' : 'FICHA DE INSCRIPCIONES'}</span> ({selectedPeriod})
                </p>
                
                {registrySubTab === 'monthly' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 px-4 py-1.5 rounded-full text-[10px] text-rose-500 font-bold uppercase tracking-wider transition-colors">
                    <input 
                      type="checkbox"
                      checked={showDebtorsOnly}
                      onChange={e => setShowDebtorsOnly(e.target.checked)}
                      className="accent-rose-500 cursor-pointer"
                    />
                    <span>Solo Deudores</span>
                  </label>
                )}
              </div>
              
              {registrySubTab === 'monthly' ? (
                <button
                  type="button"
                  onClick={() => {
                    setGenPeriod(selectedPeriod);
                    setGenCategoryIds(Array.from(new Set(categories.map(c => c.id || c.name))));
                    setShowGenerateModal(true);
                  }}
                  className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-2xl border border-emerald-500/10 hover:border-transparent font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow"
                >
                  <RefreshCw size={14} /> <span>Generar cuotas del mes</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('¿Generar deudas de inscripción pendientes de forma masiva?')) {
                      setIsSaving(true);
                      try {
                        const missingIns = registryInscriptionsData.filter(r => !r.fee);
                        if (missingIns.length === 0) {
                          alert("No hay inscripciones pendientes por generar.");
                          return;
                        }
                        
                        const newFees = missingIns.map(r => ({
                          id: generateUUID(),
                          member_id: r.member.id,
                          period: r.inscription.due_date.slice(0, 4) + ' (Anual)',
                          amount: r.inscription.amount,
                          due_date: r.inscription.due_date,
                          status: 'Pending',
                          concept: `Inscripción: ${r.inscription.name}`,
                          payment_method: 'Efectivo',
                          created_at: new Date().toISOString()
                        }));
                        
                        const { error } = await db.fees.upsertMany(newFees);
                        if (error) throw error;
                        
                        await loadData();
                        alert(`${newFees.length} deudas de inscripción generadas correctamente.`);
                      } catch (error: any) {
                        console.error("Error al generar inscripciones:", error);
                        if (error.code === 'PGRST204' || (error.message && (error.message.includes('concept') || error.message.includes('column')))) {
                          setShowMigrationModal(true);
                        } else {
                          alert("Error al generar: " + (error.message || "Error desconocido"));
                        }
                      } finally {
                        setIsSaving(false);
                      }
                    }
                  }}
                  className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-2xl border border-emerald-500/10 hover:border-transparent font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow"
                >
                  <RefreshCw size={14} /> <span>Generar Inscripciones Masivas</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sección KPI */}
      {viewMode !== 'settings' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-fade-in">
          {[
            { 
              label: viewMode === 'history' ? 'Total Recaudado (Histórico)' : (registrySubTab === 'monthly' ? 'Total Cobrado (Cuotas)' : 'Total Cobrado (Inscripciones)'), 
              value: `$${contextStats.paid.toLocaleString()}`, 
              desc: viewMode === 'history' ? 'Consolidado acumulado' : `Recaudado en ${selectedPeriod}`,
              icon: TrendingUp, 
              color: 'text-emerald-500', 
              bg: 'bg-emerald-500/10' 
            },
            { 
              label: viewMode === 'history' ? 'Pendiente Cobro (Histórico)' : 'Pendiente de Cobro', 
              value: `$${contextStats.pending.toLocaleString()}`, 
              desc: viewMode === 'history' ? 'Monto restante' : 'Pendiente de cobro total',
              icon: Clock, 
              color: 'text-amber-500', 
              bg: 'bg-amber-500/10' 
            },
            { 
              label: viewMode === 'history' ? 'Socios Morosos (Histórico)' : 'Morosos del Periodo', 
              value: contextStats.lateCount, 
              desc: 'Socios con deuda vencida',
              icon: AlertTriangle, 
              color: 'text-red-500', 
              bg: 'bg-red-500/10' 
            },
            { 
              label: viewMode === 'history' ? 'Promedio por Mes' : (registrySubTab === 'monthly' ? 'Proyección Mensual' : 'Facturación Total'), 
              value: viewMode === 'history' ? `$${Math.round(contextStats.averagePerMonth).toLocaleString()}` : `$${contextStats.total.toLocaleString()}`, 
              desc: viewMode === 'history' ? 'Recaudación promedio' : 'Ingresos estimados totales',
              icon: Receipt, 
              color: 'text-primary-600', 
              bg: 'bg-primary-600/10' 
            },
          ].map((kpi, i) => (
            <div key={i} className="bg-white dark:bg-[#161C28] p-5 md:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-primary-500/10 text-primary-500 group-hover:scale-110 transition-transform">
                  <kpi.icon size={20} />
                </div>
                <ArrowUpRight size={14} className="text-slate-300 dark:text-[#AAAAAA]" />
              </div>
              <p className="text-[10px] font-bold text-[#666666] dark:text-[#AAAAAA] uppercase tracking-widest leading-none">{kpi.label}</p>
              <h4 className="text-2xl font-black text-[#333333] dark:text-[#E0E0E0] mt-1.5">{kpi.value}</h4>
              <p className="text-[10px] text-[#888888] dark:text-[#BBBBBB] mt-1 font-medium">{kpi.desc}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl overflow-hidden">
        {viewMode === 'settings' && (
          <div className="flex border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30 p-4 gap-2">
            <button
              onClick={() => setSettingsSubTab('rates')}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsSubTab === 'rates' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              Tarifas por Categoría
            </button>
            <button
              onClick={() => setSettingsSubTab('scholarships')}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsSubTab === 'scholarships' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              Tipos de Beca
            </button>
            <button
              onClick={() => setSettingsSubTab('inscriptions')}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsSubTab === 'inscriptions' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              Inscripciones
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          {viewMode === 'history' ? (
            !filterCategory || !selectedPeriod ? (
              <div className="p-16 text-center bg-slate-50 dark:bg-slate-800/10 text-slate-400 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/5 my-8">
                <p className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
                  🔍 Por favor seleccione los filtros para buscar
                </p>
                <p className="text-xs font-bold uppercase mt-2 text-slate-400/80 leading-relaxed">
                  Debe especificar una categoría y un periodo para visualizar el historial.
                </p>
              </div>
            ) : filteredFees.length === 0 ? (
              <div className="p-16 text-center bg-slate-50 dark:bg-slate-800/10 text-slate-400 rounded-[2rem] border border-slate-200 dark:border-white/5 my-8">
                <p className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
                  📭 Sin registros encontrados
                </p>
                <p className="text-xs font-bold uppercase mt-2 text-slate-400/80 leading-relaxed">
                  No hay pagos o deudas registradas para los filtros aplicados.
                </p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                    <th className="px-8 py-6">Socio / Miembro</th>
                    <th className="px-8 py-6">Periodo</th>
                    <th className="px-8 py-6">Monto</th>
                    <th className="px-8 py-6 text-center">Estado</th>
                    <th className="px-8 py-6 text-right">Comprobantes / Historial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredFees.map(fee => (
                    <tr key={fee.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5 flex items-center justify-center">
                            {fee.member?.photourl ? (
                              <img src={fee.member.photourl} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-primary-600 italic tracking-tighter">
                                {getInitials(fee.member?.name || 'DESCONOCIDO')}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center flex-wrap gap-2">
                              <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{fee.member?.name || 'DESCONOCIDO'}</p>
                              {(() => {
                                const activeCommitment = commitments.find(c => c.member_id === fee.member_id && !c.fulfilled);
                                return activeCommitment ? (
                                  <span 
                                    className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[8px] font-black uppercase tracking-wider"
                                    title="Compromiso Activo"
                                  >
                                    <Calendar size={8} />
                                    <span>Compromiso</span>
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">DNI: {fee.member?.dni || '---'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-primary-600 uppercase tracking-widest">
                            {formatPeriodToMonthYear(fee.period)}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{fee.payment_method || 'Sin definir'}</span>
                          {(() => {
                            if (!fee.receipt_url) return null;
                            const shared = fees.filter(f => f.member_id === fee.member_id && f.receipt_url === fee.receipt_url && f.status !== 'Anulado');
                            if (shared.length > 1) {
                              const listPeriods = shared.map(s => s.period.slice(5)).sort().join(', ');
                              return (
                                <span className="inline-block mt-1 self-start px-2 py-0.5 bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 text-[7px] font-black uppercase rounded tracking-wider leading-none" title={`Pago grupal que incluye periodos: ${shared.map(sf => sf.period).join(', ')}`}>
                                  📦 Pago Grupal ({listPeriods})
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-slate-800 dark:text-white italic">
                              ${getFeeAmountWithSurcharge(fee).toLocaleString()}
                            </span>
                            {fee.receipt_url && <ImageIcon size={12} className="text-primary-600 animate-bounce" />}
                          </div>
                          {(() => {
                            const bd = getFeeBreakdown(fee);
                            if (bd.isDirect) return null;
                            if (bd.discount > 0 || bd.surcharge > 0) {
                              return (
                                <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-1 space-y-0.5" id={`fee-breakdown-${fee.id}`}>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span>Base: ${bd.base.toLocaleString()}</span>
                                    {bd.discount > 0 && <span className="text-emerald-500 font-extrabold" title={bd.scholarshipName}>-Beca: ${bd.discount.toLocaleString()}</span>}
                                    {bd.surcharge > 0 && <span className="text-amber-500 font-extrabold">+{bd.surchargePercentage}% Recargo: ${bd.surcharge.toLocaleString()}</span>}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        {getStatusBadge(fee.status, fee.due_date)}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end items-center gap-3">
                          {fee.receipt_url ? (
                            <a 
                              href={fee.receipt_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                              title="Ver Comprobante"
                            >
                              <FileText size={14} /> Ver Comprobante
                            </a>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider italic">
                              Sin comprobante
                            </span>
                          )}
                          <button 
                            onClick={() => setSelectedMemberHistory(fee.member || null)} 
                            className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm cursor-pointer" 
                            title="Ver Historial Completo"
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : viewMode === 'registry' ? (
            registrySubTab === 'monthly' ? (
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
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5 flex items-center justify-center">
                            {member.photourl ? (
                              <img src={member.photourl} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-primary-600 italic tracking-tighter">
                                {getInitials(member.name)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center flex-wrap gap-2">
                              <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{member.name}</p>
                              {(() => {
                                const activeCommitment = commitments.find(c => c.member_id === member.id && !c.fulfilled);
                                return activeCommitment ? (
                                  <button 
                                    type="button" 
                                    onClick={(e) => { e.stopPropagation(); setSelectedCommitment(activeCommitment); }}
                                    className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white border border-amber-500/20 rounded-full text-[8px] font-black uppercase tracking-wider transition-all"
                                    title="Ver Compromiso de Pago"
                                  >
                                    <Calendar size={8} />
                                    <span>Compromiso</span>
                                  </button>
                                ) : null;
                              })()}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {member.dni}</p>
                              {(() => {
                                const main = member.assignments?.find(a => a.is_main);
                                return main ? (
                                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 text-[8px] font-black uppercase rounded-full">
                                    {main.category} ({main.discipline})
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/10 text-[8px] font-black uppercase rounded-full">
                                    Sin Cat. Principal
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {(() => {
                          const suggestion = suggestFee(member);
                          return fee ? (
                            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                              {fee.due_date}
                            </span>
                          ) : !suggestion.error ? (
                            <span className="font-mono text-xs text-slate-400 italic font-medium" title="Fecha sugerida según configuración de categoría">
                              {selectedPeriod}-{suggestion.due_day.toString().padStart(2, '0')} <span className="text-[10px] tracking-tight font-sans font-black uppercase">(Sug.)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                              Sin Configurar
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-8 py-6 text-center">
                        {fee ? getStatusBadge(fee.status, fee.due_date) : (
                          <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase rounded-full border border-amber-500/10 tracking-widest">
                            No Generado
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {!fee || fee.status !== 'Paid' ? (
                            <>
                              {(() => {
                                const sigErr = fee ? null : suggestFee(member).error;
                                if (sigErr) {
                                  return (
                                    <span className="px-2.5 py-1 bg-red-500/5 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-500/10" title={sigErr === 'Sin categoría principal' ? 'Configura la categoría principal en el módulo Miembros' : 'No hay tarifa de cuota configurada para este miembro'}>
                                      ⚠️ {sigErr}
                                    </span>
                                  );
                                }
                                return (
                                  <div className="flex items-center gap-1.5">
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
                                          amount: fee ? getFeeAmountWithSurcharge(fee) : (suggestion?.amount || 5000),
                                          due_date: dueDate,
                                          concept: 'Cuota Mensual'
                                        });
                                        setShowModal(true);
                                      }}
                                      className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                                    >
                                      <Check size={14} strokeWidth={3} /> Registrar Pago
                                    </button>
                                  </div>
                                );
                              })()}
                              <button 
                                onClick={() => {
                                  setSelectedPlayerIdForCommitment(member.id);
                                  setCommitmentDate(new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]);
                                  setCommitmentDetail('');
                                  setShowCommitmentModal(true);
                                }}
                                className="p-2.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl border border-amber-500/10 hover:border-transparent transition-all shadow-sm cursor-pointer"
                                title="Registrar Compromiso de Pago"
                              >
                                <Calendar size={16} />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-emerald-500 tracking-widest pr-4 italic">
                              <Check size={14} strokeWidth={3} /> Pago Registrado
                            </div>
                          )}
                          {fee && fee.status !== 'Anulado' && (
                            <button 
                              onClick={() => handleVoidFee(fee)} 
                              className="p-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/10 hover:border-transparent rounded-xl transition-all shadow-sm text-[9px] font-black uppercase tracking-wider cursor-pointer"
                              title="Anular Pago / Cobro"
                            >
                              Anular
                            </button>
                          )}
                          <button onClick={() => setSelectedMemberHistory(member)} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm cursor-pointer" title="Ver Historial"><History size={16} /></button>
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
                    <th className="px-8 py-6">Miembro</th>
                    <th className="px-8 py-6">Inscripción Aplicable</th>
                    <th className="px-8 py-6">Monto</th>
                    <th className="px-8 py-6">Vencimiento</th>
                    <th className="px-8 py-6 text-center">Estado de Cobro</th>
                    <th className="px-8 py-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {registryInscriptionsData.map(({ member, inscription, fee }) => (
                    <tr key={`${member.id}-${inscription.id}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5 flex items-center justify-center">
                            {member.photourl ? (
                              <img src={member.photourl} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-primary-600 italic tracking-tighter">
                                {getInitials(member.name)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{member.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {member.dni}</p>
                              {(() => {
                                const main = member.assignments?.find(a => a.is_main);
                                return main ? (
                                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 text-[8px] font-black uppercase rounded-full">
                                    {main.category} ({main.discipline})
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[11px] font-black text-primary-600 uppercase tracking-widest-wider">
                          {inscription.name}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-slate-800 dark:text-slate-100 font-extrabold text-sm italic">
                        ${inscription.amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        {inscription.due_date}
                      </td>
                      <td className="px-8 py-6 text-center">
                        {fee ? getStatusBadge(fee.status, fee.due_date) : (
                          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-400 text-[8px] font-black uppercase rounded-full border border-slate-200 dark:border-white/5">Sin Registro</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {!fee || fee.status !== 'Paid' ? (
                            <button 
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  ...(fee || {}),
                                  member_id: member.id,
                                  period: inscription.due_date.slice(0, 4) + ' (Anual)',
                                  amount: fee ? getFeeAmountWithSurcharge(fee) : inscription.amount,
                                  due_date: inscription.due_date,
                                  concept: `Inscripción: ${inscription.name}`
                                });
                                setShowModal(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary-600/20"
                            >
                              <Plus size={14} strokeWidth={3} /> {fee ? 'Actualizar' : 'Cobrar'}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-emerald-500 tracking-widest pr-4 italic">
                              <Check size={14} strokeWidth={3} /> Pago Cobrado
                            </div>
                          )}
                          <button onClick={() => setSelectedMemberHistory(member)} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm" title="Historial"><History size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {registryInscriptionsData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-bold uppercase text-xs tracking-widest bg-slate-50/50 dark:bg-slate-900/10">
                        No hay inscripciones aplicables a los jugadores filtados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )
          ) : viewMode === 'commitments' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                  <th className="px-8 py-6">Socio / Miembro</th>
                  <th className="px-8 py-6">Fecha Límite</th>
                  <th className="px-8 py-6">Detalles / Compromiso</th>
                  <th className="px-8 py-6 text-center">Estado</th>
                  <th className="px-8 py-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {commitments.filter(c => {
                  if (!searchTerm.trim()) return true;
                  const member = members.find(m => m.id === c.member_id);
                  if (!member) return false;
                  const tokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
                  const name = member.name.toLowerCase();
                  const dni = member.dni.toLowerCase();
                  return tokens.every(token => name.includes(token) || dni.includes(token));
                }).map(commitment => {
                  const member = members.find(m => m.id === commitment.member_id);
                  return (
                    <tr key={commitment.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5 flex items-center justify-center">
                            {member?.photourl ? (
                              <img src={member.photourl} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-primary-600 italic tracking-tighter">
                                {getInitials(member?.name || 'DESCONOCIDO')}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{member?.name || 'DESCONOCIDO'}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {member?.dni || '---'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">{commitment.commitment_date}</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase">Límite acordado</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-2">{commitment.detail}</span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        {commitment.fulfilled ? (
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase rounded-full border border-emerald-500/20">Cumplido</span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[8px] font-black uppercase rounded-full border border-amber-500/20 animate-pulse">Pendiente</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => toggleCommitmentFulfilled(commitment.id, commitment.fulfilled)} 
                            className={`p-2.5 rounded-xl hover:scale-110 transition-all shadow-lg ${commitment.fulfilled ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'}`}
                            title={commitment.fulfilled ? 'Marcar como Pendiente' : 'Marcar como Cumplido'}
                          >
                            {commitment.fulfilled ? <X size={16} strokeWidth={3} /> : <Check size={16} strokeWidth={3} />}
                          </button>
                          <button 
                            onClick={() => setSelectedCommitment(commitment)} 
                            className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                            title="Ver Detalles de Ficha"
                          >
                            <Receipt size={16} />
                          </button>
                          <button 
                            onClick={() => deleteCommitment(commitment.id)} 
                            className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"
                            title="Eliminar Compromiso"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {commitments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Calendar size={48} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">No hay compromisos registrados</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            settingsSubTab === 'scholarships' ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                    <th className="px-8 py-6">Nombre de la Beca</th>
                    <th className="px-8 py-6">Tipo</th>
                    <th className="px-8 py-6">Valor / Descuento</th>
                    <th className="px-8 py-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {scholarships.length > 0 ? scholarships.map(scholarship => (
                    <tr key={scholarship.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6">
                        <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-widest">{scholarship.name}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                          {scholarship.type === 'percentage' ? 'Porcentaje' : 'Monto Fijo'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-lg font-black text-slate-800 dark:text-white italic">
                          {scholarship.type === 'percentage' ? `${scholarship.value}%` : `$${scholarship.value.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setScholarshipFormData(scholarship);
                              setShowScholarshipModal(true);
                            }} 
                            className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                          >
                            <ArrowUpRight size={16} />
                          </button>
                          <button 
                            onClick={() => deleteScholarshipType(scholarship.id)} 
                            className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <DollarSign size={48} className="text-slate-400" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">No hay becas configuradas</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : settingsSubTab === 'inscriptions' ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                    <th className="px-8 py-6">Tipo / Nombre</th>
                    <th className="px-8 py-6">Monto</th>
                    <th className="px-8 py-6">Vencimiento</th>
                    <th className="px-8 py-6">Categorías Asociadas</th>
                    <th className="px-8 py-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {inscriptions.length > 0 ? inscriptions.map(ins => (
                    <tr key={ins.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6">
                        <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-widest">{ins.name}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-lg font-black text-slate-800 dark:text-white italic">${ins.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{ins.due_date}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ins.category_ids && ins.category_ids.length > 0 ? ins.category_ids.map(catId => (
                            <span key={catId} className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[8px] font-black uppercase tracking-wider rounded-md border border-primary-200 dark:border-primary-800/50">
                              {categoryNamesMap[catId] || catId}
                            </span>
                          )) : (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[8px] font-extrabold uppercase tracking-wider rounded-md">
                              Todas las categorías
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setInscriptionFormData(ins);
                              setShowInscriptionModal(true);
                            }} 
                            className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                          >
                            <ArrowUpRight size={16} />
                          </button>
                          <button 
                            onClick={() => deleteInscriptionConfig(ins.id)} 
                            className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <CreditCard size={48} className="text-slate-400" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">No hay inscripciones configuradas</p>
                        </div>
                      </td>
                    </tr>
                  )}
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
                         <span className="text-[11px] font-black text-primary-600 uppercase tracking-widest">{categoryNamesMap[configFee.category_id] || configFee.category_id}</span>
                      </td>
                      <td className="px-8 py-6">
                         <span className="text-lg font-black text-slate-800 dark:text-white italic">${configFee.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Día {configFee.due_day}</span>
                          {configFee.apply_surcharge ? (
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-0.5">+{configFee.surcharge_percentage}% Recargo</span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-0.5">Sin recargo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex justify-end gap-2">
                           <button 
                             onClick={() => {
                               setConfigFormData({
                                 ...configFee,
                                 apply_surcharge: configFee.apply_surcharge || false,
                                 surcharge_percentage: configFee.surcharge_percentage || 0
                               });
                               setSelectedCategoryIds([configFee.category_id]);
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
            )
          )}
        </div>
      </div>

      {/* MODAL: Nueva Cuota con Buscador Inteligente */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-0 md:p-10 animate-fade-in">
          <div className="bg-surface-card w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] shadow-2xl border border-[var(--surface-border)] overflow-hidden flex flex-col">
            <div className="p-8 border-b border-[var(--surface-border)] flex justify-between items-center bg-surface-hover">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg"><DollarSign size={20} /></div>
                 <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Gestión de Cobro</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[9px] font-black text-primary-600 uppercase tracking-widest leading-none">Emisión de Comprobante</p>
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md">* Campos obligatorios</span>
                    </div>
                 </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-red-500 hover:text-white transition-all"><X size={20} /></button>
            </div>

            <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  {/* BUSCADOR INTELIGENTE DE SOCIOS */}
                  <div className="space-y-3 relative" ref={dropdownRef}>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 flex items-center gap-1">
                       Seleccionar Miembro / Socio <span className="text-red-500 font-black text-xs">*</span>
                     </label>
                     
                     {!selectedMemberInModal ? (
                       <div className="relative">
                         <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-primary-600" size={18} />
                         <input 
                           type="text"
                           value={memberSearchQuery}
                           onFocus={() => setIsMemberDropdownOpen(true)}
                           onChange={(e) => { setMemberSearchQuery(e.target.value); setIsMemberDropdownOpen(true); }}
                           placeholder="BUSCAR POR NOMBRE O DNI..."
                           className={`w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border ${
                             isMemberMissing ? 'border-red-500/50 focus:border-red-500' : 'border-transparent dark:border-white/5 focus:border-primary-500'
                           } shadow-inner`}
                         />
                         {isMemberMissing && (
                           <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider mt-1.5 ml-3">Este campo es obligatorio</p>
                         )}
                         
                         {isMemberDropdownOpen && (
                           <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden z-[600] animate-fade-in-up">
                              {filteredMembersForSelect.map(m => (
                                <button 
                                  key={m.id}
                                  onClick={() => { setFormData({...formData, member_id: m.id}); setIsMemberDropdownOpen(false); }}
                                  className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                    {m.photourl ? (
                                      <img src={m.photourl} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-black text-primary-600 italic tracking-tighter">
                                        {getInitials(m.name)}
                                      </span>
                                    )}
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
                             <div className="w-12 h-12 rounded-2xl bg-white shadow-md overflow-hidden p-1 flex items-center justify-center">
                                {selectedMemberInModal.photourl ? (
                                   <img src={selectedMemberInModal.photourl} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                   <span className="text-sm font-black text-primary-600 italic tracking-tighter">
                                      {getInitials(selectedMemberInModal.name)}
                                   </span>
                                )}
                             </div>
                             <div>
                                <p className="text-sm font-black text-primary-600 uppercase italic leading-none">{selectedMemberInModal.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">DNI: {selectedMemberInModal.dni}</p>
                                {(() => {
                                  const main = getMainAssignment(selectedMemberInModal);
                                  return main ? (
                                    <p className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mt-1.5 bg-emerald-500/10 px-2.5 py-0.5 rounded shadow-sm inline-block">
                                      Categoría Principal: {main.discipline} - {main.category}
                                    </p>
                                  ) : (
                                    <p className="text-[9px] font-black uppercase text-rose-500 dark:text-rose-450 tracking-wider mt-1.5 bg-rose-500/10 px-2.5 py-0.5 rounded shadow-sm inline-block">
                                      ⚠️ Sin Categoría Principal
                                    </p>
                                  );
                                })()}
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

                  {/* SELECTOR DE CONCEPTO DE COBRO */}
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Concepto de Cobro</label>
                     <div className="relative">
                       <FileText className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <select 
                         value={formData.concept || 'Cuota Mensual'} 
                         onChange={e => {
                           const val = e.target.value;
                           if (val === 'Cuota Mensual') {
                             setFormData({
                               ...formData,
                               concept: 'Cuota Mensual',
                               amount: 5000,
                               period: new Date().toISOString().slice(0, 7)
                             });
                           } else {
                             const selectedInsc = inscriptions.find(ins => `Inscripción: ${ins.name}` === val);
                             if (selectedInsc) {
                               setFormData({
                                 ...formData,
                                 concept: val,
                                 amount: selectedInsc.amount,
                                 due_date: selectedInsc.due_date,
                                 period: selectedInsc.due_date.slice(0, 4) + ' (Anual)'
                               });
                             }
                           }
                         }} 
                         className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none"
                       >
                         <option value="Cuota Mensual">Cuota Mensual</option>
                         <optgroup label="Inscripciones Anuales / Matrículas">
                           {inscriptions.map(ins => (
                             <option key={ins.id} value={`Inscripción: ${ins.name}`}>{ins.name}</option>
                           ))}
                         </optgroup>
                       </select>
                       <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                     </div>
                  </div>

                  {formData.concept !== 'Cuota Mensual' ? (
                    <div className="grid grid-cols-2 gap-6 animate-fade-in">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 flex items-center gap-1">
                           Importe ($) <span className="text-red-500 font-black text-xs">*</span>
                         </label>
                         <input 
                           type="number" 
                           value={formData.amount ?? ''} 
                           onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} 
                           className={`w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-xl dark:text-white outline-none border ${
                             isAmountMissing ? 'border-red-500/50 focus:border-red-500' : 'border-transparent dark:border-white/5 focus:border-primary-500'
                           } shadow-inner`} 
                         />
                         {isAmountMissing && (
                           <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider mt-1.5 ml-3">Este campo es obligatorio</p>
                         )}
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 flex items-center gap-1">
                           Periodo <span className="text-red-500 font-black text-xs">*</span>
                         </label>
                         <input 
                           type="text" 
                           value={formData.period || ''} 
                           onChange={e => setFormData({...formData, period: e.target.value})} 
                           className={`w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border ${
                             isPeriodMissing ? 'border-red-500/50 focus:border-red-500' : 'border-transparent dark:border-white/5 focus:border-primary-500'
                           }`} 
                         />
                         {isPeriodMissing && (
                           <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider mt-1.5 ml-3">Este campo es obligatorio</p>
                         )}
                      </div>
                    </div>
                  ) : (
                    /* SELECCIÓN FLEXIBLE DE MÚLTIPLES MESES */
                    selectedMemberInModal ? (
                      !getMainAssignment(selectedMemberInModal) ? (
                        <div className="p-8 text-center bg-rose-500/5 dark:bg-rose-500/10 text-rose-500 rounded-3xl border border-rose-500/20 shadow-sm">
                          <p className="text-xs font-black uppercase tracking-widest leading-relaxed">
                            ⚠️ Sin Categoría Principal
                          </p>
                          <p className="text-[10px] font-bold uppercase mt-2 text-slate-500 dark:text-slate-400/90 leading-relaxed">
                            Este socio no cuenta con una categoría principal asignada para pagos. Defina una categoría principal en el perfil del miembro para continuar con la generación de este pago.
                          </p>
                        </div>
                      ) : (
                        <div className={`space-y-4 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border ${
                          isPeriodMissing ? 'border-red-500/50' : 'border-slate-100 dark:border-white/5'
                        }`}>
                          <div className="flex justify-between items-center border-b border-slate-150/50 dark:border-white/5 pb-3">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">Historial de Periodos Disponibles <span className="text-red-500 font-black text-xs">*</span></h4>
                            <span className="text-[8px] font-bold text-primary-500 uppercase tracking-widest bg-primary-500/10 px-2 py-1 rounded">Pago Multi-Mes</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 max-h-[170px] overflow-y-auto pr-2 custom-scrollbar">
                            {outstandingPeriods.map(({ period: p, label, fee, type }) => {
                              const isChecked = selectedPeriods.includes(p);

                              let typeColorClasses = '';
                              let typeLabel = '';
                              if (isChecked) {
                                if (type === 'due') {
                                  typeColorClasses = 'bg-rose-500/10 border-rose-500 text-rose-600 font-extrabold shadow-sm dark:bg-rose-500/20';
                                } else if (type === 'current') {
                                  typeColorClasses = 'bg-amber-500/10 border-amber-500 text-amber-600 font-extrabold shadow-sm dark:bg-amber-500/20';
                                } else {
                                  typeColorClasses = 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-extrabold shadow-sm dark:bg-emerald-500/20';
                                }
                              } else {
                                if (type === 'due') {
                                  typeColorClasses = 'bg-white dark:bg-slate-900 border-rose-200/50 dark:border-rose-950/20 text-rose-600 dark:text-rose-450 hover:border-rose-400';
                                } else if (type === 'current') {
                                  typeColorClasses = 'bg-white dark:bg-slate-900 border-amber-300/50 dark:border-amber-950/20 text-amber-600 dark:text-amber-450 hover:border-amber-500';
                                } else {
                                  typeColorClasses = 'bg-white dark:bg-slate-900 border-emerald-200/50 dark:border-emerald-950/20 text-emerald-600 dark:text-emerald-450 hover:border-emerald-400';
                                }
                              }

                              if (type === 'due') typeLabel = 'Pendiente / Atrasado';
                              else if (type === 'current') typeLabel = 'Mes Actual';
                              else if (type === 'future') typeLabel = 'Adelantado';

                              return (
                                <label 
                                  key={p}
                                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${typeColorClasses}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedPeriods(selectedPeriods.filter(x => x !== p));
                                        } else {
                                          setSelectedPeriods([...selectedPeriods, p]);
                                        }
                                      }}
                                      className="accent-primary-600 rounded"
                                    />
                                    <div className="text-left">
                                      <p className="text-[10px] font-black uppercase tracking-tight">{label}</p>
                                      <p className="text-[7px] font-extrabold uppercase mt-0.5 tracking-wider opacity-85">
                                        {typeLabel}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black">
                                    ${getNetRealAmountForPeriod(p, fee).toLocaleString()}
                                  </span>
                                </label>
                              );
                            })}
                            {outstandingPeriods.length === 0 && (
                              <div className="col-span-2 p-6 text-center text-[10px] text-slate-400 font-black uppercase tracking-widest italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-100">
                                🎉 Sin deudas pendientes para este socio
                              </div>
                            )}
                          </div>

                          {isPeriodMissing && (
                            <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider mt-1.5 ml-1">Este campo es obligatorio (debe seleccionar al menos un período)</p>
                          )}

                          <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-white/5">
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Cant. Meses</p>
                              <p className="text-[10px] font-black text-primary-500 uppercase mt-1">{selectedPeriods.length} Seleccionado(s)</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none flex items-center justify-end gap-1">Monto Neto <span className="text-red-500 font-black text-xs">*</span></p>
                              <p className="text-base font-black text-emerald-500 italic leading-none mt-1">${totalAmountForSelectedPeriods.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="p-8 text-center text-[10px] font-black tracking-widest uppercase text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-white/5">
                        ⚠️ Selecciona un socio para cargar sus periodos disponibles
                      </div>
                    )
                  )}
 
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 flex items-center gap-1">
                        Método de Pago <span className="text-red-500 font-black text-xs">*</span>
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                          value={formData.payment_method || ''} 
                          onChange={e => setFormData({...formData, payment_method: e.target.value})} 
                          className={`w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border ${
                            isPaymentMethodMissing ? 'border-red-500/50 focus:border-red-500' : 'border-transparent dark:border-white/5 focus:border-primary-500'
                          } appearance-none`}
                        >
                          <option value="">Seleccionar método de pago...</option>
                          {['Efectivo', 'Transferencia Bancaria', 'Tarjeta Débito', 'Tarjeta Crédito', 'QR / Billetera Digital', 'Débito Automático', 'Otro'].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                      </div>
                      {isPaymentMethodMissing && (
                        <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider mt-1.5 ml-3">Este campo es obligatorio</p>
                      )}
                   </div>
                 </div>
 
                 <div className="space-y-8">
                   {/* OPCIONES DE CARGA Y SELECCIÓN DE COMPROBANTES */}
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Adjuntar Comprobante de Pago</label>
                      
                      {/* Input Único de Subida */}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" 
                      />
 
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-slate-800/20 text-slate-500 hover:text-primary-600 hover:border-primary-500 hover:bg-slate-100/30 dark:hover:bg-slate-800/40 transition-all gap-2 cursor-pointer text-center"
                      >
                        <Upload className="text-slate-400 group-hover:text-primary-500 group-hover:scale-110 transition-transform" size={24} />
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest block font-bold text-slate-750 dark:text-slate-200">Seleccionar o Arrastrar Archivo</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 block">Imágenes (*.jpg, *.png) y Documentos (*.pdf, *.doc, *.xlsx, etc.)</span>
                        </div>
                      </div>

                      {/* Previsualización del archivo seleccionado LOCALMENTE antes de guardar */}
                      {selectedFile && (
                        <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl mt-1 animate-fade-in shadow-inner">
                          {selectedFile.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(selectedFile)} className="w-10 h-10 object-cover rounded-lg border border-blue-500/10" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-600"><FileText size={18} /></div>
                          )}
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-[9px] font-black uppercase text-blue-500 tracking-wider">Archivo por registrar</p>
                            <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate mt-0.5">{selectedFile.name}</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setSelectedFile(null)} 
                            className="p-1 text-slate-300 hover:text-red-500"
                            title="Quitar archivo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
 
                      {/* Previsualización del archivo cargado */}
                      {formData.receipt_url && (
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl mt-1 animate-fade-in shadow-inner">
                          {formData.receipt_url.includes('images') || formData.receipt_url.startsWith('data:image') || formData.receipt_url.includes('receipts') || formData.receipt_url.includes('comprobantes') || /\.(jpg|jpeg|png|webp|gif|svg)/i.test(formData.receipt_url) ? (
                            <img src={formData.receipt_url} className="w-10 h-10 object-cover rounded-lg border border-emerald-500/10" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-600"><FileText size={18} /></div>
                          )}
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-[9px] font-black uppercase text-emerald-600">Comprobante guardado</p>
                            <p className="text-[8px] text-slate-400 truncate mt-0.5">{formData.receipt_url}</p>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setFormData(prev => ({ ...prev, receipt_url: '' }))} 
                            className="p-1 text-slate-300 hover:text-red-500"
                            title="Eliminar archivo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                   </div>
 
                   <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Vencimiento</label>
                        <input type="date" value={formData.due_date || ''} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-xs dark:text-white outline-none border border-transparent dark:border-white/5" />
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 flex items-center gap-1">Ref. Operación <span className="text-red-500 font-black text-xs">*</span></label>
                        <input 
                          value={formData.reference || ''} 
                          onChange={e => setFormData({...formData, reference: e.target.value})} 
                          placeholder="NRO TRANSF" 
                          className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-xs dark:text-white outline-none border ${
                            isReferenceMissing ? 'border-red-500/50 focus:border-red-500' : 'border-transparent dark:border-white/5 focus:border-primary-500'
                          }`} 
                        />
                        {isReferenceMissing && (
                          <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider mt-1.5 ml-3">Este campo es obligatorio</p>
                        )}
                     </div>
                   </div>
 
                   {/* COMENTARIO / OBSERVACIÓN */}
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Comentarios / Observaciones</label>
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Agregar notas del pago, detalles adicionales..."
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-xs dark:text-white outline-none border border-transparent dark:border-white/5 h-24 resize-none"
                      />
                   </div>
              </div>
            </div>
          </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-end gap-4">
               <button onClick={() => setShowModal(false)} className="px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">Cancelar</button>
               <button onClick={handleSave} disabled={isSaving || hasValidationErrors} className="flex items-center justify-center gap-4 bg-primary-600 text-white px-16 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                 {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                 Registrar Pago
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Historial Individual */}
      {selectedMemberHistory && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-surface-card w-full max-w-3xl rounded-[3rem] shadow-2xl border border-[var(--surface-border)] overflow-hidden flex flex-col h-[80vh]">
              <div className="p-8 border-b border-[var(--surface-border)] flex justify-between items-center bg-surface-hover">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[var(--surface-border)] shadow-lg flex items-center justify-center bg-surface-ground">
                     {selectedMemberHistory.photourl ? (
                       <img src={selectedMemberHistory.photourl} className="w-full h-full object-cover" />
                     ) : (
                       <span className="text-lg font-black text-primary-500 italic">
                         {getInitials(selectedMemberHistory.name)}
                       </span>
                     )}
                   </div>
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
                        <div className="flex flex-col gap-1">
                           <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{f.period} - {f.payment_method}</p>
                           <div className="flex flex-wrap items-center gap-2">
                             <p className="text-lg font-black text-slate-800 dark:text-white italic">${getFeeAmountWithSurcharge(f).toLocaleString()}</p>
                             {(() => {
                               const bd = getFeeBreakdown(f);
                               if (bd.isDirect) return null;
                               if (bd.discount > 0 || bd.surcharge > 0) {
                                 return (
                                   <span className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-slate-400 dark:text-slate-500" id={`history-breakdown-${f.id}`}>
                                     <span>(Base: ${bd.base.toLocaleString()})</span>
                                     {bd.discount > 0 && <span className="text-emerald-500 font-extrabold">-Beca: ${bd.discount.toLocaleString()}</span>}
                                     {bd.surcharge > 0 && <span className="text-amber-500 font-extrabold">+{bd.surchargePercentage}% Recargo: ${bd.surcharge.toLocaleString()}</span>}
                                   </span>
                                 );
                               }
                               return null;
                             })()}
                           </div>
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

      {/* MODAL: Tipos de Beca */}
      {showScholarshipModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col">
            <header className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg"><Plus size={20} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">
                    {scholarshipFormData.id ? 'Editar Tipo de Beca' : 'Crear Tipo de Beca'}
                  </h3>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest font-bold">Definición centralizada</p>
                </div>
              </div>
              <button 
                onClick={() => setShowScholarshipModal(false)}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-neutral-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={saveScholarshipType}>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Nombre de la Beca</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Beca Completa, Beca 50%, Rendimiento..."
                      value={scholarshipFormData.name || ''}
                      onChange={e => setScholarshipFormData({ ...scholarshipFormData, name: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 block">Tipo de Valor</label>
                    <select
                      value={scholarshipFormData.type || 'percentage'}
                      onChange={e => setScholarshipFormData({ ...scholarshipFormData, type: e.target.value as 'percentage' | 'fixed' })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto Fijo ($)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 block">
                      {scholarshipFormData.type === 'percentage' ? 'Porcentaje de Descuento (%)' : 'Monto de Descuento ($)'}
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      max={scholarshipFormData.type === 'percentage' ? "100" : undefined}
                      value={scholarshipFormData.value || ''}
                      onChange={e => setScholarshipFormData({ ...scholarshipFormData, value: Number(e.target.value) })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-lg dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-white/5 flex gap-4 bg-slate-50/50 dark:bg-slate-800/20">
                <button
                  type="button"
                  onClick={() => setShowScholarshipModal(false)}
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
                  Guardar Beca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tipos de Inscripción */}
      {showInscriptionModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col my-8">
            <header className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg"><Plus size={20} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">
                    {inscriptionFormData.id ? 'Editar Inscripción' : 'Crear Inscripción'}
                  </h3>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest font-bold">Configuración de Inscripciones</p>
                </div>
              </div>
              <button 
                onClick={() => setShowInscriptionModal(false)}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-neutral-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={saveInscriptionConfig}>
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Nombre del Tipo de Inscripción</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Inscripción General, Matrícula 2026, Fútbol Infantil..."
                      value={inscriptionFormData.name || ''}
                      onChange={e => setInscriptionFormData({ ...inscriptionFormData, name: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 block">Monto de Inscripción ($)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={inscriptionFormData.amount || ''}
                      onChange={e => setInscriptionFormData({ ...inscriptionFormData, amount: Number(e.target.value) })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-lg dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 block">Fecha Límite/Vencimiento</label>
                    <input
                      required
                      type="date"
                      value={inscriptionFormData.due_date || ''}
                      onChange={e => setInscriptionFormData({ ...inscriptionFormData, due_date: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 block">Asociar a Categorías (Opcional)</label>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mb-2 ml-3">Si no seleccionas ninguna, se considerará aplicable a todas las categorías.</p>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-white/5 max-h-48 overflow-y-auto space-y-2">
                      {config?.disciplines.flatMap(d => d.branches.flatMap(b => b.categories)).map(cat => {
                        const isChecked = inscriptionFormData.category_ids?.includes(cat.id);
                        return (
                          <label key={cat.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const currentIds = inscriptionFormData.category_ids || [];
                                const nextIds = isChecked
                                  ? currentIds.filter(id => id !== cat.id)
                                  : [...currentIds, cat.id];
                                setInscriptionFormData({ ...inscriptionFormData, category_ids: nextIds });
                              }}
                              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              {cat.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-white/5 flex gap-4 bg-slate-50/50 dark:bg-slate-800/20">
                <button
                  type="button"
                  onClick={() => setShowInscriptionModal(false)}
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
                  Guardar Inscripción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Configuración de Tarifas */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in">
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
                    onChange={e => {
                      setConfigFormData({ ...configFormData, discipline: e.target.value, branch: '' });
                      setSelectedCategoryIds([]);
                    }}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none"
                  >
                    <option value="">Seleccionar...</option>
                    {config?.disciplines.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6 animate-fade-in">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Rama</label>
                    <select
                      required
                      disabled={!configFormData.discipline}
                      value={configFormData.branch}
                      onChange={e => {
                        setConfigFormData({ ...configFormData, branch: e.target.value });
                        setSelectedCategoryIds([]);
                      }}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5 appearance-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="">
                        {!configFormData.discipline ? "Escribir disciplina..." : "Seleccionar..."}
                      </option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Mixto">Mixto</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 block">Categorías</label>
                    <div className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-transparent dark:border-white/5 max-h-36 overflow-y-auto space-y-2 custom-scrollbar">
                      {categoriesForModal.map(c => {
                        const isChecked = selectedCategoryIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-3 cursor-pointer p-0.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedCategoryIds([...selectedCategoryIds, c.id]);
                                } else {
                                  setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== c.id));
                                }
                              }}
                              className="rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              {c.name}
                            </span>
                          </label>
                        );
                      })}
                      {!configFormData.discipline && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic p-1">
                          Selecciona disciplina primero
                        </p>
                      )}
                      {configFormData.discipline && !configFormData.branch && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic p-1">
                          Selecciona rama primero
                        </p>
                      )}
                      {configFormData.discipline && configFormData.branch && categoriesForModal.length === 0 && (
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest italic p-1">
                          Todas las categorías ya están configuradas
                        </p>
                      )}
                    </div>
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

                {/* Sección Recargo */}
                <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Aplicar Recargo por Pago Fuera de Término</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Suma un porcentaje si se paga luego de la fecha de vencimiento</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configFormData.apply_surcharge || false}
                        onChange={e => setConfigFormData({ ...configFormData, apply_surcharge: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {configFormData.apply_surcharge && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Porcentaje de Recargo (%)</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="100"
                        value={configFormData.surcharge_percentage || ''}
                        onChange={e => setConfigFormData({ ...configFormData, surcharge_percentage: Number(e.target.value) })}
                        placeholder="Ej: 10"
                        className="w-full px-6 py-4 bg-white dark:bg-slate-800 rounded-2xl font-black text-lg dark:text-white outline-none border border-slate-200 dark:border-white/5"
                      />
                    </div>
                  )}
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

      {/* MODAL: Nuevo Compromiso de Pago */}
      {showCommitmentModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col">
            <header className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20"><Calendar size={20} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Crear Compromiso de Pago</h3>
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest font-bold">Plan acordado</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCommitmentModal(false)}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-neutral-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </header>

            <div className="p-8 space-y-6">
              <div className="space-y-6">
                <div className="space-y-2 relative" ref={commitmentDropdownRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Seleccionar Miembro / Jugador</label>
                  {selectedMemberInCommitmentModal ? (
                    <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                          {selectedMemberInCommitmentModal.photourl ? (
                            <img src={selectedMemberInCommitmentModal.photourl} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-black text-primary-600 italic">{getInitials(selectedMemberInCommitmentModal.name)}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{selectedMemberInCommitmentModal.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {selectedMemberInCommitmentModal.dni}</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setSelectedPlayerIdForCommitment('')}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          placeholder="BUSCAR MIEMBRO POR NOMBRE O DNI..."
                          value={commitmentSearchMemberQuery}
                          onFocus={() => setIsCommitmentMemberDropdownOpen(true)}
                          onChange={e => {
                            setCommitmentSearchMemberQuery(e.target.value);
                            setIsCommitmentMemberDropdownOpen(true);
                          }}
                          className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm dark:text-white outline-none border border-transparent dark:border-white/5"
                        />
                      </div>
                      {isCommitmentMemberDropdownOpen && (
                        <div className="absolute z-[503] left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl shadow-2xl custom-scrollbar divide-y divide-slate-100 dark:divide-white/5 animate-fade-in">
                          {filteredMembersForCommitmentSelect.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedPlayerIdForCommitment(m.id);
                                setIsCommitmentMemberDropdownOpen(false);
                                setCommitmentSearchMemberQuery('');
                              }}
                              className="w-full px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-left flex items-center gap-4"
                            >
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                                {m.photourl ? <img src={m.photourl} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-primary-600 italic">{getInitials(m.name)}</span>}
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{m.name}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">DNI: {m.dni}</p>
                              </div>
                            </button>
                          ))}
                          {filteredMembersForCommitmentSelect.length === 0 && (
                            <div className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              No se encontraron socios
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Fecha Límite</label>
                    <input
                      required
                      type="date"
                      value={commitmentDate}
                      onChange={e => setCommitmentDate(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-sm dark:text-white outline-none border border-transparent dark:border-white/5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Detalle / Notas del acuerdo</label>
                  <textarea
                    required
                    rows={4}
                    value={commitmentDetail}
                    onChange={e => setCommitmentDetail(e.target.value)}
                    placeholder="Escribe los detalles del compromiso o plan de pago..."
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-medium text-sm dark:text-white outline-none border border-transparent dark:border-white/5 resize-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowCommitmentModal(false)}
                  className="flex-1 px-8 py-5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCommitment}
                  disabled={isSavingCommitment}
                  className="flex-1 bg-amber-500 text-white px-8 py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingCommitment ? <Loader2 className="animate-spin" size={18} /> : <Calendar size={18} />}
                  Crear Compromiso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ficha / Detalles de Compromiso */}
      {selectedCommitment && (() => {
        const member = members.find(m => m.id === selectedCommitment.member_id);
        return (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0f121a] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col">
              <header className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20"><Calendar size={20} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Ficha de Compromiso</h3>
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Detalle del acuerdo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCommitment(null)}
                  className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-neutral-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </header>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 rounded-2xl">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                    {member?.photourl ? (
                      <img src={member.photourl} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-primary-600 italic">{getInitials(member?.name || 'DESCONOCIDO')}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-white uppercase italic tracking-tight">{member?.name || 'DESCONOCIDO'}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {member?.dni || '---'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fecha Compromiso</p>
                    <p className="text-xs font-black text-slate-800 dark:text-white mt-1 uppercase tracking-wider">{selectedCommitment.commitment_date}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${selectedCommitment.fulfilled ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                      <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{selectedCommitment.fulfilled ? 'Cumplido' : 'Pendiente'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Detalle del compromiso de pago</p>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-white/5 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 min-h-[100px] whitespace-pre-wrap">
                    {selectedCommitment.detail}
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={async () => {
                      await toggleCommitmentFulfilled(selectedCommitment.id, selectedCommitment.fulfilled);
                      setSelectedCommitment(null);
                    }}
                    className={`flex-1 px-8 py-5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-white shadow-xl ${
                      selectedCommitment.fulfilled 
                        ? 'bg-amber-500 shadow-amber-500/20' 
                        : 'bg-emerald-500 shadow-emerald-500/20'
                    }`}
                  >
                    {selectedCommitment.fulfilled ? (
                      <>
                        <X size={14} strokeWidth={3} /> Reabrir Compromiso
                      </>
                    ) : (
                      <>
                        <Check size={14} strokeWidth={3} /> Marcar como Cumplido
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedCommitment(null)}
                    className="px-8 py-5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all hover:bg-slate-200"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE GENERACIÓN MASIVA DE CUOTAS */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col">
            <header className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-600/20">
                  <RefreshCw size={20} className={isSaving ? 'animate-spin' : ''} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Generación Masiva de Cuotas</h3>
                  <p className="text-[9px] font-black text-primary-500 uppercase tracking-widest font-bold">Generar cuotas mensuales en un paso</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGenerateModal(false)}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-neutral-500 hover:text-white transition-all cursor-pointer"
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </header>

            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
              {/* Selector de Periodo */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 ml-1">Periodo / Mes a Generar</label>
                <input
                  type="month"
                  value={genPeriod}
                  onChange={e => setGenPeriod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/30 px-5 py-4 rounded-2xl border border-slate-200 dark:border-white/5 outline-none font-bold text-sm tracking-wider text-slate-800 dark:text-slate-100 h-[52px]"
                  disabled={isSaving}
                />
              </div>

              {/* Checkboxes de Categorías */}
              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Seleccionar Categorías</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setGenCategoryIds(Array.from(new Set(categories.map(c => c.id || c.name))))}
                      className="text-[9px] font-black text-primary-600 uppercase tracking-wider hover:underline"
                      disabled={isSaving}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenCategoryIds([])}
                      className="text-[9px] font-black text-slate-400 uppercase tracking-wider hover:underline"
                      disabled={isSaving}
                    >
                      Ninguna
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 max-h-[180px] overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/10 rounded-2xl border border-slate-150 dark:border-white/5">
                  {categories.map(cat => {
                    const identifier = cat.id || cat.name;
                    const isChecked = genCategoryIds.includes(identifier);
                    return (
                      <label 
                        key={identifier}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked 
                            ? 'bg-primary-500/5 border-primary-500/20 text-primary-700 dark:text-primary-400 font-bold' 
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setGenCategoryIds([...genCategoryIds, identifier]);
                            } else {
                              setGenCategoryIds(genCategoryIds.filter(id => id !== identifier));
                            }
                          }}
                          className="accent-primary-500 rounded"
                          disabled={isSaving}
                        />
                        <span className="text-xs font-black uppercase tracking-tight truncate">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Dinámico en Caja de Advertencia */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 flex gap-4 items-start">
                <div className="p-2 bg-primary-500/10 text-primary-500 rounded-lg shrink-0">
                  <Receipt size={16} />
                </div>
                <div>
                  <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Estimación de Generación</h5>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Siguiendo los criterios seleccionados, <strong className="text-primary-600 dark:text-primary-400">{missingGenerateCount} cuotas</strong> serán creadas para el periodo <strong>{genPeriod}</strong>.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold leading-tight">
                    * El cálculo solo incluye miembros activos que no cuenten con una cuota mensual creada de este concepto para dicho periodo.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-white/5 flex gap-3 justify-end bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={handleBulkGenerateFees}
                disabled={isSaving || missingGenerateCount === 0}
                className={`flex-1 sm:flex-none px-8 py-4 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isSaving || missingGenerateCount === 0
                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none text-slate-400 border border-slate-250 dark:border-white/5'
                    : 'bg-primary-600 hover:bg-primary-500 hover:scale-105 active:scale-95 shadow-primary-600/20'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} /> Creando Cuotas...
                  </>
                ) : (
                  <>
                    <Check size={14} strokeWidth={3} /> Confirmar Generación
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                disabled={isSaving}
                className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showMigrationModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col">
            <header className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Actualización de BD Requerida</h3>
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest font-bold">Columna 'concept' Faltante</p>
                </div>
              </div>
              <button 
                onClick={() => setShowMigrationModal(false)}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-neutral-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </header>

            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                Para poder registrar y diferenciar los pagos de <strong>Cuotas Mensuales</strong> de las <strong>Inscripciones / Matrículas Anuales</strong>, es necesario aplicar una actualización a la estructura de la base de datos en Supabase.
              </p>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instrucciones de Aplicación</p>
                <ol className="list-decimal list-inside space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <li>Ingresa a tu panel de <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline inline-flex items-center gap-1">Supabase Dashboard <ExternalLink size={10} /></a>.</li>
                  <li>Dirígete a la sección <strong>SQL Editor</strong> en el menú lateral izquierdo.</li>
                  <li>Crea una nueva consulta (New Query), pega el código SQL de abajo y haz clic en <strong>Run</strong>.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código SQL de Migración</p>
                  <button
                    onClick={() => {
                      const sql = `-- MIGRACIÓN DE BD V12: INCORPORACIÓN DE CONCEPTO EN SEGREGACIÓN DE COBROS\nALTER TABLE public.fees ADD COLUMN IF NOT EXISTS concept TEXT DEFAULT 'Cuota Mensual';\nUPDATE public.fees SET concept = 'Cuota Mensual' WHERE concept IS NULL;\nCREATE INDEX IF NOT EXISTS idx_fees_concept ON public.fees (concept);`;
                      navigator.clipboard.writeText(sql);
                      alert('¡Código SQL copiado al portapapeles!');
                    }}
                    className="text-[9px] font-black uppercase text-primary-600 hover:underline tracking-wider"
                  >
                    Copiar Código SQL
                  </button>
                </div>
                <pre className="p-5 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto whitespace-pre border border-slate-800">
{`-- V12: INCORPORACIÓN DE CONCEPTO
ALTER TABLE public.fees 
ADD COLUMN IF NOT EXISTS concept TEXT DEFAULT 'Cuota Mensual';

UPDATE public.fees 
SET concept = 'Cuota Mensual' 
WHERE concept IS NULL;

CREATE INDEX IF NOT EXISTS idx_fees_concept ON public.fees (concept);`}
                </pre>
              </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
              <button
                onClick={() => {
                  const sql = `-- MIGRACIÓN DE BD V12: INCORPORACIÓN DE CONCEPTO EN SEGREGACIÓN DE COBROS\nALTER TABLE public.fees ADD COLUMN IF NOT EXISTS concept TEXT DEFAULT 'Cuota Mensual';\nUPDATE public.fees SET concept = 'Cuota Mensual' WHERE concept IS NULL;\nCREATE INDEX IF NOT EXISTS idx_fees_concept ON public.fees (concept);`;
                  navigator.clipboard.writeText(sql);
                  alert('¡Código SQL copiado! Pégalo en el SQL Editor de Supabase y haz clic en Run.');
                  setShowMigrationModal(false);
                }}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all"
              >
                Copiar SQL y Cerrar
              </button>
              <button 
                onClick={() => setShowMigrationModal(false)}
                className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesManagement;
