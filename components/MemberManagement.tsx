
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Member, AppRole, ClubConfig, MemberAssignment, DisciplinePosition } from '../types';
import { 
  UserPlus, Search, Trash2, X, Save, Camera, Loader2, PlusCircle, Heart, 
  Fingerprint, ShieldCheck, 
  Contact2, UserCircle, AlertCircle, Shirt, Settings, GraduationCap,
  ExternalLink, FileText, Upload, Trash
} from 'lucide-react';
import { getPositionsByDiscipline } from '../lib/disciplinePositions';
import { db } from '../lib/supabase';

interface MemberManagementProps {
  members: Member[];
  config: ClubConfig;
  onSaveMember: (member: Member) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
}

type ModalTab = 'identity' | 'health' | 'contacts' | 'schooling' | 'sports_data' | 'sports' | 'system';

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const MemberManagement: React.FC<MemberManagementProps> = ({ members, config, onSaveMember, onDeleteMember }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('identity');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [availablePositions, setAvailablePositions] = useState<Record<string, DisciplinePosition[]>>({});
  const [loadingPositions, setLoadingPositions] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Member>>({
    name: '', dni: '', gender: 'Masculino', birthdate: '', email: '', phone: '',
    photourl: '', address: '', city: '', province: '', postalcode: '',
    bloodtype: '', medicalinsurance: '', weight: '', height: '',
    status: 'Active', assignments: [], systemrole: 'Socio', canlogin: false,
    tutor: { name: '', dni: '', relationship: 'Padre', phone: '', email: '' },
    dorsal: '',
    plays_since_year: '',
    frequent_position: '',
    skilled_leg: '',
    injury_history: '',
    training_days_per_week: '',
    gym_attendance: false,
    gym_frequency: '',
    carnet_number: '',
    school_name: '',
    school_shift: '',
    school_schedule: '',
    extra_activity: '',
    extra_activity_schedule: '',
    school_contact: '',
    contacts_list: [],
    has_preexisting_condition: false,
    preexisting_condition_details: '',
    medical_file_url: ''
  });

  const [isUploadingMedicalFile, setIsUploadingMedicalFile] = useState(false);

  // Local states for managing multiple contacts
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    relationship: 'Padre',
    phone: '',
    email: '',
    address: ''
  });
  const [contactError, setContactError] = useState<string | null>(null);

  // Fetch positions for a discipline
  const fetchPositionsForDiscipline = useCallback(async (disciplineName: string) => {
    if (availablePositions[disciplineName] || loadingPositions[disciplineName]) return;
    
    setLoadingPositions(prev => ({ ...prev, [disciplineName]: true }));
    try {
      const positions = await getPositionsByDiscipline(disciplineName);
      setAvailablePositions(prev => ({ ...prev, [disciplineName]: positions }));
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoadingPositions(prev => ({ ...prev, [disciplineName]: false }));
    }
  }, [availablePositions, loadingPositions]);

  useEffect(() => {
    if (activeTab === 'sports' && formData.assignments) {
      formData.assignments.forEach(as => {
        if (as.discipline) {
          fetchPositionsForDiscipline(as.discipline);
        }
      });
    }
  }, [activeTab, formData.assignments, fetchPositionsForDiscipline]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.dni.includes(searchTerm)
    );
  }, [members, searchTerm]);

  const handleEdit = (member: Member) => {
    setSelectedMember(member);
    setSaveError(null);
    let initialContacts = member.contacts_list || [];
    if (initialContacts.length === 0 && member.tutor && member.tutor.name) {
      initialContacts = [{
        id: crypto.randomUUID(),
        name: member.tutor.name,
        relationship: member.tutor.relationship || 'Otro',
        phone: member.tutor.phone || '',
        email: member.tutor.email || '',
        address: member.address || ''
      }];
    }

    setFormData({
      ...member,
      tutor: member.tutor || { name: '', dni: '', relationship: 'Padre', phone: '', email: '' },
      dorsal: member.dorsal || '',
      plays_since_year: member.plays_since_year || '',
      frequent_position: member.frequent_position || '',
      skilled_leg: member.skilled_leg || '',
      injury_history: member.injury_history || '',
      training_days_per_week: member.training_days_per_week || '',
      gym_attendance: member.gym_attendance || false,
      gym_frequency: member.gym_frequency || '',
      carnet_number: member.carnet_number || member.carnetNumber || '',
      school_name: member.school_name || '',
      school_shift: member.school_shift || '',
      school_schedule: member.school_schedule || '',
      extra_activity: member.extra_activity || '',
      extra_activity_schedule: member.extra_activity_schedule || '',
      school_contact: member.school_contact || '',
      contacts_list: initialContacts,
      has_preexisting_condition: member.has_preexisting_condition || false,
      preexisting_condition_details: member.preexisting_condition_details || '',
      medical_file_url: member.medical_file_url || ''
    });
    setActiveTab('identity');
    setShowModal(true);
  };

  const handleNew = () => {
    setSelectedMember(null);
    setSaveError(null);
    setFormData({
      name: '', dni: '', gender: 'Masculino', birthdate: '', email: '', phone: '',
      photourl: '', address: '', city: '', province: '', postalcode: '',
      bloodtype: '', medicalinsurance: '', weight: '', height: '',
      status: 'Active', assignments: [], systemrole: 'Socio', canlogin: false,
      tutor: { name: '', dni: '', relationship: 'Padre', phone: '', email: '' },
      dorsal: '',
      plays_since_year: '',
      frequent_position: '',
      skilled_leg: '',
      injury_history: '',
      training_days_per_week: '',
      gym_attendance: false,
      gym_frequency: '',
      carnet_number: '',
      school_name: '',
      school_shift: '',
      school_schedule: '',
      extra_activity: '',
      extra_activity_schedule: '',
      school_contact: '',
      contacts_list: [],
      has_preexisting_condition: false,
      preexisting_condition_details: '',
      medical_file_url: ''
    });
    setActiveTab('identity');
    setShowModal(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photourl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMedicalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingMedicalFile(true);
    try {
      const publicUrl = await db.medical.uploadAttachment(file);
      setFormData(prev => ({ ...prev, medical_file_url: publicUrl }));
    } catch (err: any) {
      console.error("Error al subir archivo médico:", err);
      alert("Error al subir el archivo. Por favor, reintente.");
    } finally {
       setIsUploadingMedicalFile(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.dni) return alert("Nombre y DNI son obligatorios");
    if (!formData.email && formData.systemrole !== 'Socio') {
      setSaveError("EL EMAIL ES OBLIGATORIO PARA ROLES ADMINISTRATIVOS O DE STAFF");
      setActiveTab('contacts');
      return;
    }
    const duplicateDni = members.find(m => m.dni === formData.dni && m.id !== (selectedMember?.id || ''));
    if (duplicateDni) {
      setSaveError(`ALERTA: EL DNI ${formData.dni} YA PERTENECE A OTRO MIEMBRO (${duplicateDni.name})`);
      setActiveTab('identity');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const dataToSave = { ...formData };
      
      // Backward compatible mapping of tutor object with the first contact if available
      if (dataToSave.contacts_list && dataToSave.contacts_list.length > 0) {
        const firstContact = dataToSave.contacts_list[0];
        dataToSave.tutor = {
          name: firstContact.name,
          dni: '',
          relationship: (firstContact.relationship === 'Padre' || firstContact.relationship === 'Madre' || firstContact.relationship === 'Tutor Legal') ? firstContact.relationship as any : 'Otro',
          phone: firstContact.phone,
          email: firstContact.email
        };
      }

      const memberId = selectedMember?.id || crypto.randomUUID();
      const memberToSave = {
        ...dataToSave,
        id: memberId,
        created_at: selectedMember?.created_at || new Date().toISOString(),
      } as Member;

      await onSaveMember(memberToSave);
      setShowModal(false);
    } catch (e: any) { 
      console.error("Error al guardar:", e);
      if (e.code === '23505' || e.message?.includes('members_dni_key')) {
        setSaveError(`ERROR: YA EXISTE UN MIEMBRO CON EL DNI ${formData.dni}.`);
        setActiveTab('identity');
      } else {
        setSaveError("OCURRIÓ UN ERROR AL GUARDAR. POR FAVOR REINTENTE.");
      }
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleAddContactClick = () => {
    if ((formData.contacts_list || []).length >= 3) {
      alert("No se permiten más de 3 contactos por jugador.");
      return;
    }
    setContactForm({
      name: '',
      relationship: 'Padre',
      phone: '',
      email: '',
      address: ''
    });
    setEditingContactId(null);
    setIsAddingContact(true);
    setContactError(null);
  };

  const handleEditContactClick = (contact: PlayerContact) => {
    setContactForm({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      address: contact.address
    });
    setEditingContactId(contact.id);
    setIsAddingContact(true);
    setContactError(null);
  };

  const handleDeleteContact = (id: string) => {
    setFormData(prev => ({
      ...prev,
      contacts_list: (prev.contacts_list || []).filter(c => c.id !== id)
    }));
  };

  const handleSaveContact = () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim() || !contactForm.email.trim() || !contactForm.address.trim()) {
      setContactError("TODOS LOS CAMPOS: NOMBRE, TELÉFONO, EMAIL Y DIRECCIÓN SON OBLIGATORIOS");
      return;
    }

    const currentContacts = formData.contacts_list || [];

    if (editingContactId) {
      // Editing Mode
      const updated = currentContacts.map(c => 
        c.id === editingContactId ? { ...c, ...contactForm, name: contactForm.name.toUpperCase(), address: contactForm.address.toUpperCase() } : c
      );
      setFormData(prev => ({ ...prev, contacts_list: updated }));
    } else {
      // Create Mode
      if (currentContacts.length >= 3) {
        setContactError("MÁXIMO 3 CONTACTOS PERMITIDOS");
        return;
      }
      const newContact: PlayerContact = {
        id: crypto.randomUUID(),
        name: contactForm.name.toUpperCase(),
        relationship: contactForm.relationship,
        phone: contactForm.phone,
        email: contactForm.email,
        address: contactForm.address.toUpperCase()
      };
      setFormData(prev => ({ ...prev, contacts_list: [...currentContacts, newContact] }));
    }

    setIsAddingContact(false);
    setEditingContactId(null);
    setContactError(null);
  };

  const addAssignment = () => {
    if (config.disciplines.length === 0) return alert("Configura disciplinas primero");
    const newAssignment: MemberAssignment = {
      discipline: config.disciplines[0].name,
      discipline_id: config.disciplines[0].id,
      category: '',
      category_id: '',
      position: '',
      role: 'PLAYER'
    };
    setFormData(prev => ({ ...prev, assignments: [...(prev.assignments || []), newAssignment] }));
  };

  const updateAssignment = (idx: number, field: keyof MemberAssignment, value: string) => {
    const newAss = [...(formData.assignments || [])];
    const current = newAss[idx];
    
    let updated = { ...current, [field]: value };
    
    if (field === 'discipline') {
      const disc = config.disciplines.find(d => d.name === value);
      updated = { 
        ...updated, 
        discipline_id: disc?.id || '',
        category: '', 
        category_id: '',
        position: '' 
      };
      fetchPositionsForDiscipline(value);
    }
    
    if (field === 'category') {
      const disc = config.disciplines.find(d => d.name === current.discipline);
      const cat = disc?.branches.flatMap(b => b.categories).find(c => c.id === value);
      updated = { 
        ...updated, 
        category_id: value,
        category: cat?.name || '',
        position: '' 
      };
    }
    
    newAss[idx] = updated;
    setFormData({ ...formData, assignments: newAss });
  };

  const tabs = [
    { id: 'identity', label: 'Identidad', icon: Fingerprint },
    { id: 'sports_data', label: 'Datos Deportivos', icon: Shirt },
    { id: 'health', label: 'Salud', icon: Heart },
    { id: 'contacts', label: 'Contactos', icon: Contact2 },
    { id: 'schooling', label: 'Escolaridad', icon: GraduationCap },
    { id: 'sports', label: 'Config. Deportiva', icon: Settings },
    { id: 'system', label: 'Sistema', icon: ShieldCheck },
  ];

  const inputClasses = "w-full p-4 bg-surface-ground rounded-xl font-bold text-sm outline-none border border-transparent border-[var(--surface-border)] focus:border-primary-500/50 shadow-inner transition-all text-[var(--text-main)]";
  const selectClasses = "w-full p-4 bg-surface-ground rounded-xl font-bold text-sm outline-none border border-transparent border-[var(--surface-border)] shadow-inner text-[var(--text-main)] cursor-pointer";
  const labelClasses = "text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-3 mb-1.5 block";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-40">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
        <div>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-[var(--text-main)] leading-none italic">
            Miembros <span className="text-[var(--primary-600)]">Plegma</span>
          </h2>
          <p className="text-[var(--text-muted)] font-bold uppercase tracking-[0.3em] text-[9px] mt-4 ml-1">Directorio Institucional</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="BUSCAR..." 
              className="w-full pl-12 pr-4 py-4 bg-surface-card rounded-2xl border border-[var(--surface-border)] outline-none font-bold text-[11px] uppercase tracking-widest shadow-lg text-[var(--text-main)]"
            />
          </div>
          <button onClick={handleNew} className="bg-primary-500 text-primary-contrast px-6 py-4 rounded-2xl shadow-xl shadow-primary-500/20 hover:scale-105 transition-all shrink-0">
            <UserPlus size={20} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.map(member => (
          <div key={member.id} className="bg-surface-card rounded-[2.5rem] p-6 md:p-8 border border-[var(--surface-border)] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-surface-ground overflow-hidden shadow-inner shrink-0 flex items-center justify-center border border-[var(--surface-border)]">
                {member.photourl ? (
                  <img src={member.photourl} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base font-black text-primary-500 italic tracking-tighter">
                    {getInitials(member.name)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-black text-lg uppercase tracking-tight text-[var(--text-main)] leading-none mb-1 truncate">{member.name}</h3>
                  <button 
                    onClick={() => onDeleteMember(member.id)}
                    className="p-2 text-[var(--surface-border)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">DNI: {member.dni}</p>
              </div>
            </div>
            <button onClick={() => handleEdit(member)} className="w-full mt-6 bg-surface-ground p-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:bg-primary-500 hover:text-primary-contrast transition-all">
              Gestionar Legajo
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-0 md:p-10 animate-fade-in">
          <div className="bg-surface-card w-full max-w-6xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl flex flex-col border border-[var(--surface-border)] overflow-hidden">
            <div className="px-6 md:px-10 py-5 flex justify-between items-center border-b border-[var(--surface-border)] shrink-0 bg-surface-hover">
              <div className="flex items-center gap-4">
                <div className="hidden md:flex w-10 h-10 rounded-xl bg-primary-500/10 items-center justify-center text-primary-500">
                  <Fingerprint size={24} />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-[var(--text-main)] uppercase tracking-tight italic">Legajo Maestro</h3>
                  <p className="text-[8px] md:text-[9px] font-black text-primary-500 uppercase tracking-[0.3em]">Gestión de Identidad</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-surface-ground rounded-full hover:bg-red-500 hover:text-white transition-all text-[var(--text-main)] hover:text-white"><X size={20} /></button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="w-full md:w-64 bg-surface-ground border-b md:border-b-0 md:border-r border-[var(--surface-border)] flex flex-col shrink-0 md:overflow-y-auto no-scrollbar">
                <nav className="flex md:flex-col overflow-x-auto no-scrollbar md:overflow-y-visible p-3 md:p-4 gap-2 md:gap-3 shrink-0">
                  {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ModalTab)}
                        className={`flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-5 rounded-xl md:rounded-2xl transition-all relative shrink-0 border-2 ${
                          isActive ? 'bg-primary-500 text-primary-contrast shadow-xl shadow-primary-500/30 border-primary-400' : 'text-[var(--text-muted)] border-transparent hover:bg-surface-hover hover:text-[var(--text-main)]'
                        }`}
                      >
                        <tab.icon size={18} />
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="flex-1 bg-surface-card overflow-y-auto p-6 md:p-10 custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                  {activeTab === 'identity' && (
                    <div className="space-y-10 animate-fade-in">
                       <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                         <div className="w-1 h-4 bg-[var(--primary-600)] rounded-full"></div> Información Personal
                       </h4>

                       <div className="flex flex-col md:flex-row gap-10 items-start">
                          {/* Photo Section */}
                          <div className="flex flex-col items-center gap-4 shrink-0">
                             <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
                             <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-40 h-40 rounded-[2.5rem] bg-surface-ground border-2 border-dashed border-[var(--surface-border)] flex items-center justify-center overflow-hidden cursor-pointer group hover:border-primary-600 transition-all relative"
                             >
                                {formData.photourl ? (
                                   <img src={formData.photourl} className="w-full h-full object-cover" />
                                ) : (
                                   <div className="flex flex-col items-center text-[var(--text-muted)] group-hover:text-primary-600 transition-colors">
                                      <Camera size={32} />
                                      <span className="text-[8px] font-black uppercase mt-2">Subir Foto</span>
                                   </div>
                                )}
                                <div className="absolute inset-0 bg-primary-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                   <Camera className="text-white" size={24} />
                                </div>
                             </div>
                             <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Foto de Perfil</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 w-full">
                            <div className="space-y-2 col-span-1 md:col-span-2">
                              <label className={labelClasses}>Nombre Completo</label>
                              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className={inputClasses} placeholder="EJ: LIONEL MESSI" />
                            </div>
                            <div className="space-y-2">
                              <label className={labelClasses}>Documento (DNI)</label>
                              <input value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className={inputClasses} placeholder="NÚMERO" />
                            </div>
                            <div className="space-y-2">
                              <label className={labelClasses}>Género</label>
                              <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})} className={selectClasses}>
                                <option>Masculino</option>
                                <option>Femenino</option>
                                <option>Otro</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className={labelClasses}>Fecha de Nacimiento</label>
                              <input type="date" value={formData.birthdate} onChange={e => setFormData({...formData, birthdate: e.target.value})} className={inputClasses} />
                            </div>
                            <div className="space-y-2">
                              <label className={labelClasses}>N° Carnet</label>
                              <input value={formData.carnet_number || ''} onChange={e => setFormData({...formData, carnet_number: e.target.value})} className={inputClasses} placeholder="EJ: C-12345" />
                            </div>
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'sports_data' && (
                    <div className="space-y-8 animate-fade-in">
                      <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                          <Shirt size={16} />
                        </div>
                        Datos Deportivos
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className={labelClasses}>Dorsal (No. Camiseta)</label>
                          <input 
                            value={formData.dorsal || ''} 
                            onChange={e => setFormData({...formData, dorsal: e.target.value})} 
                            className={inputClasses} 
                            placeholder="EJ: 10" 
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={labelClasses}>Desde qué año juega en el club</label>
                          <input 
                            value={formData.plays_since_year || ''} 
                            onChange={e => setFormData({...formData, plays_since_year: e.target.value})} 
                            className={inputClasses} 
                            placeholder="EJ: 2018" 
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={labelClasses}>Puesto Frecuente</label>
                          <input 
                            value={formData.frequent_position || ''} 
                            onChange={e => setFormData({...formData, frequent_position: e.target.value.toUpperCase()})} 
                            className={inputClasses} 
                            placeholder="EJ: DELANTERO" 
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={labelClasses}>Pierna Hábil</label>
                          <select 
                            value={formData.skilled_leg || ''} 
                            onChange={e => setFormData({...formData, skilled_leg: e.target.value})} 
                            className={selectClasses}
                          >
                            <option value="">No definido</option>
                            <option value="Derecha">Derecha (Diestro)</option>
                            <option value="Izquierda">Izquierda (Zurdo)</option>
                            <option value="Ambidiestro">Ambidiestro</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className={labelClasses}>Días de entrenamiento por semana</label>
                          <input 
                            value={formData.training_days_per_week || ''} 
                            onChange={e => setFormData({...formData, training_days_per_week: e.target.value})} 
                            className={inputClasses} 
                            placeholder="EJ: 3" 
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={labelClasses}>Asiste al Gimnasio</label>
                          <select 
                            value={formData.gym_attendance ? 'Sí' : 'No'} 
                            onChange={e => setFormData({...formData, gym_attendance: e.target.value === 'Sí'})} 
                            className={selectClasses}
                          >
                            <option value="No">No</option>
                            <option value="Sí">Sí</option>
                          </select>
                        </div>

                        {formData.gym_attendance && (
                          <div className="space-y-2 col-span-1 md:col-span-2">
                            <label className={labelClasses}>Frecuencia del Gimnasio</label>
                            <input 
                              value={formData.gym_frequency || ''} 
                              onChange={e => setFormData({...formData, gym_frequency: e.target.value.toUpperCase()})} 
                              className={inputClasses} 
                              placeholder="EJ: 3 VECES POR SEMANA, 1 HORA" 
                            />
                          </div>
                        )}

                        <div className="space-y-2 col-span-1 md:col-span-2">
                          <label className={labelClasses}>Antecedentes de Lesiones (más de 2 meses inactivo)</label>
                          <textarea 
                            value={formData.injury_history || ''} 
                            onChange={e => setFormData({...formData, injury_history: e.target.value})} 
                            className={inputClasses + " h-24 resize-none py-3"} 
                            placeholder="EJ: DESGARRO DE ISQUIOTIBIALES EN 2024 CON 3 MESES DE BAJA..." 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'health' && (
                    <div className="space-y-6 md:space-y-8 animate-fade-in">
                       <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                         <div className="w-1 h-4 bg-red-500 rounded-full"></div> Perfil de Salud
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className={labelClasses}>Grupo Sanguíneo</label>
                             <select value={formData.bloodtype} onChange={e => setFormData({...formData, bloodtype: e.target.value})} className={selectClasses}>
                                <option value="">No definido</option>
                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map(t => <option key={t} value={t}>{t}</option>)}
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className={labelClasses}>Obra Social / Seguro</label>
                             <input value={formData.medicalinsurance} onChange={e => setFormData({...formData, medicalinsurance: e.target.value.toUpperCase()})} className={inputClasses} placeholder="NOMBRE PREPAGA" />
                          </div>
                          <div className="space-y-2">
                             <label className={labelClasses}>Peso (kg)</label>
                             <input value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className={inputClasses} placeholder="00.0" />
                          </div>
                          <div className="space-y-2">
                             <label className={labelClasses}>Altura (cm)</label>
                             <input value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className={inputClasses} placeholder="000" />
                          </div>
                          <div className="space-y-2 col-span-1 md:col-span-2">
                             <label className={labelClasses}>¿Posee alguna Enfermedad Preexistente o Alergia?</label>
                             <select 
                               value={formData.has_preexisting_condition ? 'Sí' : 'No'} 
                               onChange={e => setFormData({...formData, has_preexisting_condition: e.target.value === 'Sí'})} 
                               className={selectClasses}
                             >
                                <option value="No">No</option>
                                <option value="Sí">Sí</option>
                             </select>
                          </div>
                          <div className="space-y-2 col-span-1 md:col-span-2">
                             <label className={labelClasses}>Detalles a considerar (Enfermedades, Alergias, Medicación, etc.)</label>
                             <textarea 
                               value={formData.preexisting_condition_details || ''} 
                               onChange={e => setFormData({...formData, preexisting_condition_details: e.target.value.toUpperCase()})} 
                               className={inputClasses + " h-24 resize-none py-3"} 
                               placeholder="EJ: ALÉRGICO A LA PENICILINA, MEDICACIÓN DIARIA DE ASMA, DIABETES..." 
                             />
                          </div>
                          <div className="space-y-2 col-span-1 md:col-span-2">
                             <label className={labelClasses}>Adjunto (certificado médico, estudios, etc.)</label>
                             {formData.medical_file_url ? (
                               <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl gap-3">
                                 <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                   <FileText size={18} />
                                   <span className="truncate max-w-[200px] md:max-w-xs block font-bold">Documento Médico Adjunto</span>
                                 </div>
                                 <div className="flex gap-2">
                                   <a 
                                     href={formData.medical_file_url} 
                                     target="_blank" 
                                     rel="noreferrer noopener" 
                                     className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors inline-flex items-center"
                                   >
                                     <ExternalLink size={12} className="mr-1" />
                                     Ver archivo
                                   </a>
                                   <button 
                                     type="button"
                                     onClick={() => setFormData({...formData, medical_file_url: ''})}
                                     className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors cursor-pointer"
                                     title="Eliminar adjunto"
                                   >
                                     <Trash size={14} />
                                   </button>
                                 </div>
                               </div>
                             ) : (
                               <div className="flex items-center justify-center w-full">
                                 <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[var(--surface-border)] rounded-2xl cursor-pointer hover:bg-surface-ground transition-all group">
                                   <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                     {isUploadingMedicalFile ? (
                                       <>
                                         <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                                         <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Subiendo archivo...</p>
                                       </>
                                     ) : (
                                       <>
                                         <Upload className="w-5 h-5 mb-2 text-[var(--text-muted)] group-hover:text-emerald-500" />
                                         <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--text-main)]">Seleccionar Certificado Médico / Estudios (PDF, Imagen)</p>
                                         <p className="text-[9px] text-[var(--text-muted)] mt-1 font-bold">Máximo recomendado: 5MB</p>
                                       </>
                                     )}
                                   </div>
                                   <input 
                                     type="file" 
                                     className="hidden" 
                                     disabled={isUploadingMedicalFile}
                                     onChange={handleMedicalFileUpload} 
                                     accept=".pdf,image/*"
                                   />
                                 </label>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'contacts' && (
                    <div className="space-y-12 animate-fade-in">
                       <section className="space-y-6">
                          <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div> Datos de Contacto
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className={labelClasses}>Teléfono</label>
                                <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputClasses} placeholder="+54 9..." />
                             </div>
                             <div className="space-y-2">
                                <label className={labelClasses}>Email</label>
                                <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputClasses} placeholder="correo@ejemplo.com" />
                             </div>
                             <div className="space-y-2 col-span-1 md:col-span-2">
                                <label className={labelClasses}>Dirección</label>
                                <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} className={inputClasses} placeholder="CALLE, NÚMERO, DPTO" />
                             </div>
                             <div className="space-y-2">
                                <label className={labelClasses}>Ciudad</label>
                                <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} className={inputClasses} />
                             </div>
                             <div className="space-y-2">
                                <label className={labelClasses}>Provincia</label>
                                <input value={formData.province} onChange={e => setFormData({...formData, province: e.target.value.toUpperCase()})} className={inputClasses} />
                             </div>
                          </div>
                       </section>

                       <section className="space-y-6">
                          <div className="flex justify-between items-center">
                             <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                               <div className="w-1 h-4 bg-emerald-500 rounded-full"></div> Contactos de Emergencia / Familiares
                             </h4>
                             {!(formData.contacts_list && formData.contacts_list.length >= 3) && !isAddingContact && (
                                <button
                                  type="button"
                                  onClick={handleAddContactClick}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  <PlusCircle size={12} />
                                  Agregar Contacto
                                </button>
                             )}
                          </div>

                          {/* Interactive Add/Edit Form */}
                          {isAddingContact && (
                             <div className="p-6 bg-surface-ground rounded-3xl border border-emerald-500/20 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex justify-between items-center pb-2 border-b border-[var(--surface-border)]">
                                   <h5 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                      {editingContactId ? "Editar Contacto" : "Nuevo Contacto de Emergencia"}
                                   </h5>
                                   <button
                                      type="button"
                                      onClick={() => { setIsAddingContact(false); setEditingContactId(null); setContactError(null); }}
                                      className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
                                   >
                                      <X size={16} />
                                   </button>
                                </div>

                                {contactError && (
                                   <div className="p-3 bg-red-500/10 border border-red-500/20 text-[10px] font-black text-red-500 uppercase rounded-xl">
                                      {contactError}
                                   </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="space-y-1">
                                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Nombre Completo</label>
                                      <input 
                                         value={contactForm.name} 
                                         onChange={e => setContactForm({...contactForm, name: e.target.value.toUpperCase()})}
                                         className={inputClasses}
                                         placeholder="Ej: MARÍA GÓMEZ"
                                      />
                                   </div>
                                   <div className="space-y-1">
                                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Relación / Vínculo</label>
                                      <select 
                                         value={contactForm.relationship}
                                         onChange={e => setContactForm({...contactForm, relationship: e.target.value})}
                                         className={selectClasses}
                                      >
                                         <option value="Padre">Padre</option>
                                         <option value="Madre">Madre</option>
                                         <option value="Tutor Legal">Tutor Legal</option>
                                         <option value="Familiar">Familiar / Familiar Indirecto</option>
                                         <option value="Otro">Otro</option>
                                      </select>
                                   </div>
                                   <div className="space-y-1">
                                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Teléfono</label>
                                      <input 
                                         value={contactForm.phone} 
                                         onChange={e => setContactForm({...contactForm, phone: e.target.value})}
                                         className={inputClasses}
                                         placeholder="Ej: +54 341 5551234"
                                      />
                                   </div>
                                   <div className="space-y-1">
                                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Email</label>
                                      <input 
                                         value={contactForm.email} 
                                         onChange={e => setContactForm({...contactForm, email: e.target.value})}
                                         className={inputClasses}
                                         placeholder="Ej: marina@correo.com"
                                      />
                                   </div>
                                   <div className="space-y-1 col-span-1 md:col-span-2">
                                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Dirección (Donde reside)</label>
                                      <input 
                                         value={contactForm.address} 
                                         onChange={e => setContactForm({...contactForm, address: e.target.value.toUpperCase()})}
                                         className={inputClasses}
                                         placeholder="Ej: AV. PELLEGRINI 1234, ROSARIO"
                                      />
                                   </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                   <button
                                      type="button"
                                      onClick={() => { setIsAddingContact(false); setEditingContactId(null); setContactError(null); }}
                                      className="px-4 py-2 rounded-xl bg-[var(--surface-border)] hover:bg-opacity-80 font-black text-[9px] uppercase tracking-wider text-[var(--text-main)] transition-all cursor-pointer"
                                   >
                                      Cancelar
                                   </button>
                                   <button
                                      type="button"
                                      onClick={handleSaveContact}
                                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-black text-[9px] uppercase tracking-wider text-white transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
                                   >
                                      {editingContactId ? "Actualizar" : "Agregar"}
                                   </button>
                                 </div>
                             </div>
                          )}

                          {/* Contacts List */}
                          <div className="space-y-3">
                             {(!formData.contacts_list || formData.contacts_list.length === 0) ? (
                                <div className="p-8 text-center bg-surface-ground rounded-3xl border border-dashed border-[var(--surface-border)] text-[var(--text-muted)] italic text-xs">
                                   No hay contactos de emergencia registrados. Haz clic en "+ Agregar contacto" (mínimo 1, máximo 3).
                                </div>
                             ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                   {(formData.contacts_list || []).map((contact, index) => (
                                      <div 
                                         key={contact.id || index}
                                         className="p-5 bg-surface-ground rounded-2xl border border-[var(--surface-border)] relative flex flex-col justify-between hover:border-emerald-500/30 transition-all shadow-sm"
                                      >
                                         <div>
                                            <div className="flex justify-between items-start gap-2 mb-3">
                                               <div>
                                                  <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                                                     {contact.relationship}
                                                  </span>
                                                  <h5 className="font-black text-xs text-[var(--text-main)] mt-1 break-words">{contact.name}</h5>
                                               </div>
                                               <div className="flex gap-1 shrink-0">
                                                  <button
                                                     type="button"
                                                     onClick={() => handleEditContactClick(contact)}
                                                     className="p-1 px-1.5 rounded-lg bg-[var(--surface-border)] hover:bg-opacity-80 text-[var(--text-muted)] hover:text-indigo-500 transition-all text-[9px] font-black cursor-pointer"
                                                     title="Editar"
                                                  >
                                                     Editar
                                                  </button>
                                                  <button
                                                     type="button"
                                                     onClick={() => handleDeleteContact(contact.id || '')}
                                                     className="p-1 px-1.5 rounded-lg bg-[var(--surface-border)] hover:bg-opacity-80 text-[var(--text-muted)] hover:text-red-500 transition-all text-[9px] font-black cursor-pointer"
                                                     title="Eliminar"
                                                  >
                                                     Borrar
                                                  </button>
                                               </div>
                                            </div>

                                            <div className="space-y-1.5 text-[11px] font-bold text-[var(--text-muted)]">
                                               <div className="flex items-center gap-1.5 break-all">
                                                  <span className="font-extrabold text-[var(--text-main)] shrink-0">Tel:</span>
                                                  <span>{contact.phone}</span>
                                               </div>
                                               <div className="flex items-center gap-1.5 break-all">
                                                  <span className="font-extrabold text-[var(--text-main)] shrink-0">Email:</span>
                                                  <span>{contact.email}</span>
                                               </div>
                                               <div className="flex items-start gap-1.5 break-all">
                                                  <span className="font-extrabold text-[var(--text-main)] shrink-0">Dir:</span>
                                                  <span className="leading-tight">{contact.address}</span>
                                               </div>
                                            </div>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             )}
                          </div>
                       </section>
                    </div>
                  )}

                  {activeTab === 'schooling' && (
                    <div className="space-y-8 animate-fade-in">
                       <section className="space-y-6">
                          <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                              <GraduationCap size={16} />
                            </div>
                            Información Escolar / Educativa
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-surface-ground rounded-3xl border border-[var(--surface-border)]">
                             <div className="space-y-2 col-span-1 md:col-span-2">
                                <label className={labelClasses}>Nombre de la Escuela</label>
                                <input 
                                  value={formData.school_name || ''} 
                                  onChange={e => setFormData({...formData, school_name: e.target.value.toUpperCase()})} 
                                  className={inputClasses} 
                                  placeholder="EJ: COLEGIO NACIONAL N° 1..." 
                                />
                             </div>

                             <div className="space-y-2">
                                <label className={labelClasses}>Turno Escolar</label>
                                <select 
                                  value={formData.school_shift || ''} 
                                  onChange={e => setFormData({...formData, school_shift: e.target.value.toUpperCase()})} 
                                  className={selectClasses}
                                >
                                  <option value="">SELECCIONAR TURNO</option>
                                  <option value="MAÑANA">MAÑANA</option>
                                  <option value="TARDE">TARDE</option>
                                  <option value="NOCHE">NOCHE</option>
                                  <option value="DOBLE TURNO">DOBLE TURNO</option>
                                  <option value="OTRO">OTRO</option>
                                </select>
                             </div>

                             <div className="space-y-2">
                                <label className={labelClasses}>Horario Escolar</label>
                                <input 
                                  value={formData.school_schedule || ''} 
                                  onChange={e => setFormData({...formData, school_schedule: e.target.value.toUpperCase()})} 
                                  className={inputClasses} 
                                  placeholder="EJ: 07:30 A 13:00 HS..." 
                                />
                             </div>

                             <div className="space-y-2 col-span-1 md:col-span-2">
                                <label className={labelClasses}>Actividad Extraescolar (si realiza alguna)</label>
                                <input 
                                  value={formData.extra_activity || ''} 
                                  onChange={e => setFormData({...formData, extra_activity: e.target.value.toUpperCase()})} 
                                  className={inputClasses} 
                                  placeholder="EJ: INGLES, COMPUTACION, APOYO ESCOLAR..." 
                                />
                             </div>

                             <div className="space-y-2">
                                <label className={labelClasses}>Horarios de la Actividad Extraescolar</label>
                                <input 
                                  value={formData.extra_activity_schedule || ''} 
                                  onChange={e => setFormData({...formData, extra_activity_schedule: e.target.value.toUpperCase()})} 
                                  className={inputClasses} 
                                  placeholder="EJ: MAR Y JUE - 16:30 A 18:00 HS..." 
                                />
                             </div>

                             <div className="space-y-2">
                                <label className={labelClasses}>Contacto de la Escuela / Teléfono</label>
                                <input 
                                  value={formData.school_contact || ''} 
                                  onChange={e => setFormData({...formData, school_contact: e.target.value.toUpperCase()})} 
                                  className={inputClasses} 
                                  placeholder="EJ: DIRECTOR PEREZ / +54 341 443..." 
                                 />
                              </div>
                           </div>
                        </section>
                     </div>
                  )}

                  {activeTab === 'sports' && (
                    <div className="space-y-6 md:space-y-8 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                            <Settings size={16} />
                          </div>
                          Config. Deportiva
                        </h4>
                        <button onClick={addAssignment} className="flex items-center gap-2 text-[var(--primary-600)] text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                          <PlusCircle size={16} /> Agregar Actividad
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                        {formData.assignments?.map((as, idx) => {
                          const disc = config.disciplines.find(d => d.name === as.discipline);
                          const availableCategories = disc?.branches?.flatMap(b => b.categories) || [];
                          const positions = availablePositions[as.discipline] || [];
                          const isLoadingPos = loadingPositions[as.discipline];
                          
                          return (
                            <div key={idx} className="bg-surface-ground p-5 md:p-6 rounded-2xl border border-[var(--surface-border)] space-y-4 shadow-sm transition-all">
                              <div className="flex justify-between items-center">
                                <select 
                                  value={as.role} 
                                  onChange={e => updateAssignment(idx, 'role', e.target.value as AppRole)}
                                  className="bg-transparent font-black text-[10px] uppercase tracking-widest outline-none text-[var(--primary-600)] cursor-pointer"
                                >
                                  <option value="PLAYER">JUGADOR (Atleta)</option>
                                  <option value="COACH">ENTRENADOR / DT</option>
                                  <option value="PHYSICAL_TRAINER">PREP. FÍSICO</option>
                                </select>
                                <button onClick={() => setFormData({...formData, assignments: formData.assignments?.filter((_, i) => i !== idx)})} className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <label className={labelClasses}>Disciplina</label>
                                  <select value={as.discipline} onChange={e => updateAssignment(idx, 'discipline', e.target.value)} className={selectClasses + " p-3 rounded-xl text-[10px]"}>
                                    {config.disciplines.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                  </select>
                                </div>
                                
                                <div className="space-y-1">
                                  <label className={labelClasses}>Categoría</label>
                                  <select value={as.category_id || as.category} onChange={e => updateAssignment(idx, 'category', e.target.value)} className={selectClasses + " p-3 rounded-xl text-[10px]"}>
                                    <option value="">-- Seleccionar Categoría --</option>
                                    {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className={labelClasses}>Puesto</label>
                                  {isLoadingPos ? (
                                    <div className="flex items-center gap-2 p-3 text-[10px] text-[var(--text-muted)] font-bold uppercase">
                                      <Loader2 size={12} className="animate-spin" /> Cargando puestos...
                                    </div>
                                  ) : positions.length > 0 ? (
                                    <select value={as.position} onChange={e => updateAssignment(idx, 'position', e.target.value)} className={selectClasses + " p-3 rounded-xl text-[10px]"}>
                                      <option value="">-- Seleccionar Puesto --</option>
                                      {positions.map(p => <option key={p.id} value={p.position}>{p.position}</option>)}
                                    </select>
                                  ) : (
                                    <div className="flex items-start gap-2 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                                      <AlertCircle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                                      <p className="text-[9px] text-orange-500 font-bold uppercase leading-tight">
                                        No hay puestos configurados. Ve a ESTRUCTURA {'>'} PUESTOS para crearlos.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'system' && (
                    <div className="space-y-10 animate-fade-in">
                       <h4 className="text-[10px] md:text-xs font-black text-[var(--text-main)] uppercase tracking-[0.2em] flex items-center gap-3">
                         <div className="w-1 h-4 bg-[var(--text-main)] rounded-full"></div> Configuración de Sistema
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                             <label className={labelClasses}>Estado del Miembro</label>
                             <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={selectClasses}>
                                <option value="Active">Activo</option>
                                <option value="Inactive">Inactivo</option>
                                <option value="Pending">Pendiente</option>
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className={labelClasses}>Rol Institucional</label>
                             <select value={formData.systemrole} onChange={e => setFormData({...formData, systemrole: e.target.value as any})} className={selectClasses}>
                                <option value="Socio">Socio / Jugador</option>
                                <option value="Admin">Administrador Total</option>
                                <option value="Administrativo">Personal Administrativo (Pagos)</option>
                                <option value="Entrenador">Director Técnico / Coach</option>
                                <option value="Medico">Médico / Salud</option>
                             </select>
                          </div>
                          <div className="col-span-1 md:col-span-2 p-6 bg-surface-ground rounded-3xl border border-[var(--surface-border)]">
                             <div className="flex items-center justify-between mb-6">
                                <div>
                                   <h5 className="font-black text-sm uppercase text-[var(--text-main)]">Acceso a Plataforma</h5>
                                   <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Permitir login en app móvil / web</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={formData.canlogin} onChange={e => setFormData({...formData, canlogin: e.target.checked})} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-[var(--surface-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-600)]"></div>
                                </label>
                             </div>
                             {formData.canlogin && (
                               <div className="space-y-2 animate-fade-in">
                                  <label className={labelClasses}>Nombre de Usuario</label>
                                  <div className="relative">
                                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary-600)]" size={18} />
                                    <input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className={inputClasses + " pl-12"} placeholder="user.name" />
                                  </div>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {saveError && (
              <div className="px-6 md:px-10 py-3 bg-red-500/10 border-t border-red-500/20 flex items-center gap-3 animate-fade-in">
                <AlertCircle className="text-red-500 shrink-0" size={16} />
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-500 leading-tight">{saveError}</p>
              </div>
            )}
            <div className="px-6 md:px-10 py-5 border-t border-[var(--surface-border)] flex justify-end bg-surface-hover shrink-0">
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full md:w-auto flex items-center justify-center gap-4 bg-primary-500 text-primary-contrast px-10 py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-[11px] tracking-widest shadow-xl shadow-primary-500/20 hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Confirmar y Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManagement;
