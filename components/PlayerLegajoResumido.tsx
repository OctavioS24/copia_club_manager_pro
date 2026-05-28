import React, { useState, useEffect } from 'react';
import { X, User, HeartPulse, ShieldCheck, Mail, Phone, MapPin, Droplets, Activity, Ruler, Weight, Users, Star, Save, Loader2, Shirt, Fingerprint, GraduationCap, PlusCircle, Trash2, Edit2, FileText, ExternalLink } from 'lucide-react';
import { Member, PlayerContact } from '../types';
import { supabase } from '../lib/supabase';

interface PlayerLegajoResumidoProps {
  player: Member;
  onClose: () => void;
  onPlayerUpdated?: () => void;
}

const PlayerLegajoResumido: React.FC<PlayerLegajoResumidoProps> = ({ player, onClose, onPlayerUpdated }) => {
  const [activeTab, setActiveTab] = useState<'ID' | 'DEPORTIVO' | 'SALUD' | 'CONTACTO' | 'ESCOLARIDAD'>('ID');
  const [titularityCount, setTitularityCount] = useState<number | null>(null);

  // State for editable sports form
  const [sportsForm, setSportsForm] = useState({
    dorsal: player.dorsal || '',
    plays_since_year: player.plays_since_year || '',
    frequent_position: player.frequent_position || '',
    skilled_leg: player.skilled_leg || '',
    injury_history: player.injury_history || '',
    training_days_per_week: player.training_days_per_week || '',
    gym_attendance: player.gym_attendance || false,
    gym_frequency: player.gym_frequency || ''
  });

  // State for editable schooling form
  const [schoolingForm, setSchoolingForm] = useState({
    school_name: player.school_name || '',
    school_shift: player.school_shift || '',
    school_schedule: player.school_schedule || '',
    extra_activity: player.extra_activity || '',
    extra_activity_schedule: player.extra_activity_schedule || '',
    school_contact: player.school_contact || ''
  });

  const [isSavingSports, setIsSavingSports] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isSavingSchooling, setIsSavingSchooling] = useState(false);
  const [schoolingSaveSuccess, setSchoolingSaveSuccess] = useState(false);

  // Local state for contacts list
  const [contactsList, setContactsList] = useState<PlayerContact[]>(() => {
    if (player.contacts_list && player.contacts_list.length > 0) {
      return player.contacts_list;
    }
    // Handle migration of legacy tutor if present
    if (player.tutor && player.tutor.name) {
      return [{
         id: crypto.randomUUID(),
         name: player.tutor.name.toUpperCase(),
         relationship: player.tutor.relationship || 'Otro',
         phone: player.tutor.phone || '',
         email: player.tutor.email || '',
         address: player.tutor.dni ? `DNI: ${player.tutor.dni}` : ''
      }];
    }
    return [];
  });

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactForm, setContactForm] = useState<Omit<PlayerContact, 'id'>>({
    name: '',
    relationship: 'Padre',
    phone: '',
    email: '',
    address: ''
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [contactsSaveSuccess, setContactsSaveSuccess] = useState(false);

  const handleSaveContacts = async (updatedList?: PlayerContact[]) => {
    setIsSavingContacts(true);
    try {
      const listToSave = updatedList !== undefined ? updatedList : contactsList;

      // Fetch latest state to avoid overwrite
      const { data: currentMember, error: fetchErr } = await supabase
        .from('members')
        .select('*')
        .eq('id', player.id)
        .single();
      
      if (fetchErr) throw fetchErr;

      // Map first element back to tutor for backward compatibility
      let tutorObj = null;
      if (listToSave.length > 0) {
        const first = listToSave[0];
        let extractedDni = '';
        if (first.address && first.address.startsWith("DNI: ")) {
          extractedDni = first.address.replace("DNI: ", "");
        }
        tutorObj = {
          name: first.name,
          relationship: first.relationship as any,
          phone: first.phone,
          email: first.email,
          dni: extractedDni
        };
      }

      const updatedMember = {
        ...currentMember,
        contacts_list: listToSave,
        tutor: tutorObj
      };

      const { error: saveErr } = await supabase
        .from('members')
        .upsert(updatedMember);

      if (saveErr) throw saveErr;

      setContactsSaveSuccess(true);
      setTimeout(() => setContactsSaveSuccess(false), 3000);

      if (onPlayerUpdated) {
        onPlayerUpdated();
      }
    } catch (err) {
      console.error('Error saving contacts list inside legajo:', err);
      alert('Error al guardar datos de contactos.');
    } finally {
      setIsSavingContacts(false);
    }
  };

  const handleAddContactClick = () => {
    if (contactsList.length >= 3) {
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

  const handleDeleteContact = async (id: string) => {
    const updated = contactsList.filter(c => c.id !== id);
    setContactsList(updated);
    await handleSaveContacts(updated);
  };

  const handleSaveContactLocal = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim() || !contactForm.email.trim() || !contactForm.address.trim()) {
      setContactError("TODOS LOS CAMPOS: NOMBRE, TELÉFONO, EMAIL Y DIRECCIÓN SON OBLIGATORIOS");
      return;
    }

    let updated: PlayerContact[] = [];
    if (editingContactId) {
      updated = contactsList.map(c => 
        c.id === editingContactId ? { ...c, ...contactForm, name: contactForm.name.toUpperCase(), address: contactForm.address.toUpperCase() } : c
      );
    } else {
      if (contactsList.length >= 3) {
        setContactError("MÁXIMO 3 CONTACTOS MÁXIMO PERMITIDOS");
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
      updated = [...contactsList, newContact];
    }

    setContactsList(updated);
    setIsAddingContact(false);
    setEditingContactId(null);
    setContactError(null);
    
    await handleSaveContacts(updated);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count, error } = await supabase
          .from('match_squad_players')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', player.id)
          .eq('is_starting', true);
        
        if (!error) setTitularityCount(count || 0);
      } catch (err) {
        console.error('Error fetching titularities:', err);
      }
    };
    fetchStats();
  }, [player.id]);


  const handleSaveSports = async () => {
    setIsSavingSports(true);
    try {
      const { data: currentMember, error: fetchErr } = await supabase
        .from('members')
        .select('*')
        .eq('id', player.id)
        .single();

      if (fetchErr) throw fetchErr;

      const updatedMember = {
        ...currentMember,
        dorsal: sportsForm.dorsal,
        plays_since_year: sportsForm.plays_since_year,
        frequent_position: sportsForm.frequent_position,
        skilled_leg: sportsForm.skilled_leg,
        injury_history: sportsForm.injury_history,
        training_days_per_week: sportsForm.training_days_per_week,
        gym_attendance: sportsForm.gym_attendance,
        gym_frequency: sportsForm.gym_frequency
      };

      const { error: saveErr } = await supabase
        .from('members')
        .upsert(updatedMember);

      if (saveErr) throw saveErr;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onPlayerUpdated) {
        onPlayerUpdated();
      }
    } catch (err) {
      console.error('Error saving sports data in legajo:', err);
      alert('Error al guardar datos deportivos.');
    } finally {
      setIsSavingSports(false);
    }
  };

  const handleSaveSchooling = async () => {
    setIsSavingSchooling(true);
    try {
      const { data: currentMember, error: fetchErr } = await supabase
        .from('members')
        .select('*')
        .eq('id', player.id)
        .single();

      if (fetchErr) throw fetchErr;

      const updatedMember = {
        ...currentMember,
        school_name: schoolingForm.school_name,
        school_shift: schoolingForm.school_shift,
        school_schedule: schoolingForm.school_schedule,
        extra_activity: schoolingForm.extra_activity,
        extra_activity_schedule: schoolingForm.extra_activity_schedule,
        school_contact: schoolingForm.school_contact
      };

      const { error: saveErr } = await supabase
        .from('members')
        .upsert(updatedMember);

      if (saveErr) throw saveErr;

      setSchoolingSaveSuccess(true);
      setTimeout(() => setSchoolingSaveSuccess(false), 3000);

      if (onPlayerUpdated) {
        onPlayerUpdated();
      }
    } catch (err) {
      console.error('Error saving schooling data in legajo:', err);
      alert('Error al guardar datos escolares.');
    } finally {
      setIsSavingSchooling(false);
    }
  };

  const tabs = [
    { id: 'ID', label: 'ID', icon: User },
    { id: 'DEPORTIVO', label: 'Deportivo', icon: Shirt },
    { id: 'SALUD', label: 'Salud', icon: HeartPulse },
    { id: 'CONTACTO', label: 'Contacto', icon: Users },
    { id: 'ESCOLARIDAD', label: 'Escolaridad', icon: GraduationCap },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-start md:items-center justify-center p-2 md:p-4 overflow-y-auto custom-scrollbar">
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-surface-card rounded-[2rem] md:rounded-[3.5rem] border border-[var(--surface-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-400 my-4 md:my-0">
        {/* Banner de Perfil */}
        <div className="relative h-28 md:h-48 bg-surface-ground">
          <div className="absolute inset-0 bg-primary-500/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-20 md:h-32 bg-primary-500/10 rounded-full blur-xl" />
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 w-8 h-8 md:w-10 md:h-10 rounded-xl bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all z-20"
          >
            <X size={18} />
          </button>

          <div className="absolute -bottom-12 md:-bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 md:gap-4 w-full">
            <div className="w-24 h-24 md:w-40 md:h-40 rounded-[2rem] md:rounded-[3rem] bg-surface-card border-4 md:border-8 border-surface-card shadow-2xl overflow-hidden relative group shrink-0">
              {player.photourl ? (
                <img 
                  src={player.photourl} 
                  alt={player.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-surface-hover flex items-center justify-center">
                  <span className="text-2xl md:text-5xl font-black text-primary-600 italic tracking-tighter">{getInitials(player.name)}</span>
                </div>
              )}
            </div>
            <div className="text-center w-full px-4 md:px-6">
              <h3 className="text-xl md:text-5xl font-black uppercase italic tracking-tighter text-[var(--text-main)] leading-none mb-1 md:mb-3">{player.name}</h3>
              <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-3">
                <span className="text-[8px] md:text-[10px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-3 md:px-4 py-1 rounded-full border border-primary-500/20 italic">JUGADOR</span>
                <span className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic opacity-50 px-3 md:px-4 py-1 bg-surface-ground rounded-full">DNI: {player.dni}</span>
                {sportsForm.dorsal && (
                  <span className="text-[8px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 md:px-4 py-1 rounded-full border border-emerald-500/20 italic">DORSAL: {sportsForm.dorsal}</span>
                )}
                {titularityCount !== null && titularityCount > 0 && (
                  <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 shadow-lg shadow-amber-500/5">
                    <Star size={10} md:size={12} fill="currentColor" />
                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">{titularityCount} TITULARIDADES</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="mt-24 md:mt-32 px-4 md:px-10 pb-6 md:pb-10 space-y-6 md:space-y-8">
          {/* Tabs */}
          <div className="flex gap-1 md:gap-2 p-1 md:p-1.5 bg-surface-ground rounded-xl md:rounded-2xl border border-[var(--surface-border)] shadow-inner">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-2 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] transition-all ${
                  activeTab === tab.id 
                    ? 'bg-surface-card text-primary-500 shadow-xl shadow-black/5' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <tab.icon size={12} md:size={14} />
                <span className="hidden xs:inline">{tab.label}</span>
                <span className="xs:hidden">{tab.id}</span>
              </button>
            ))}
          </div>

          <div className="min-h-[220px] md:min-h-[300px]">
            {activeTab === 'ID' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                <InfoCard icon={User} label="Género" value={player.gender} />
                <InfoCard icon={ShieldCheck} label="Fecha de Nacimiento" value={player.birthdate} />
                <InfoCard icon={Fingerprint} label="N° Carnet" value={player.carnet_number || 'No asignado'} />
                <InfoCard icon={Mail} label="Email" value={player.email || 'No registrado'} />
                <InfoCard icon={Phone} label="Teléfono" value={player.phone || 'No registrado'} />
                <div className="md:col-span-2">
                  <InfoCard icon={MapPin} label="Dirección Completa" value={`${player.address || ''}, ${player.city || ''} (${player.province || ''})`} />
                </div>
              </div>
            )}

            {activeTab === 'DEPORTIVO' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Dorsal (No. Camiseta)</label>
                    <input 
                      value={sportsForm.dorsal} 
                      onChange={e => setSportsForm({...sportsForm, dorsal: e.target.value})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: 10"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Juega en el Club Desde (Año)</label>
                    <input 
                      value={sportsForm.plays_since_year} 
                      onChange={e => setSportsForm({...sportsForm, plays_since_year: e.target.value})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: 2018"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Puesto Frecuente</label>
                    <input 
                      value={sportsForm.frequent_position} 
                      onChange={e => setSportsForm({...sportsForm, frequent_position: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: VOLANTE"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Pierna Hábil</label>
                    <select 
                      value={sportsForm.skilled_leg} 
                      onChange={e => setSportsForm({...sportsForm, skilled_leg: e.target.value})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)] cursor-pointer"
                    >
                      <option value="">No definido</option>
                      <option value="Derecha">Derecha</option>
                      <option value="Izquierda">Izquierda</option>
                      <option value="Ambidiestro">Ambidiestro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Días de Entrenamiento Semanal</label>
                    <input 
                      value={sportsForm.training_days_per_week} 
                      onChange={e => setSportsForm({...sportsForm, training_days_per_week: e.target.value})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: 3"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Asiste al Gimnasio</label>
                    <select 
                      value={sportsForm.gym_attendance ? 'Sí' : 'No'} 
                      onChange={e => setSportsForm({...sportsForm, gym_attendance: e.target.value === 'Sí'})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)] cursor-pointer"
                    >
                      <option value="No">No</option>
                      <option value="Sí">Sí</option>
                    </select>
                  </div>

                  {sportsForm.gym_attendance && (
                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Frecuencia del Gimnasio</label>
                      <input 
                        value={sportsForm.gym_frequency} 
                        onChange={e => setSportsForm({...sportsForm, gym_frequency: e.target.value.toUpperCase()})}
                        className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                        placeholder="Ej: 3 VECES POR SEMANA, 1 HORA"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Antecedentes de Lesiones (más de 2 meses inactivo)</label>
                    <textarea 
                      value={sportsForm.injury_history} 
                      onChange={e => setSportsForm({...sportsForm, injury_history: e.target.value})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)] h-20 resize-none py-2" 
                      placeholder="Describa lesiones con más de 2 meses de inactividad..."
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveSports}
                    disabled={isSavingSports}
                    className="flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 active:scale-95 text-white px-6 py-3 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg shadow-primary-500/10 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isSavingSports ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {saveSuccess ? '¡Guardado Correctamente!' : 'Guardar Datos Deportivos'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'SALUD' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                <InfoCard icon={Droplets} label="Grupo Sanguíneo" value={player.bloodtype || 'No informado'} />
                <InfoCard icon={ShieldCheck} label="Obra Social" value={player.medicalinsurance || 'No registrada'} />
                <InfoCard icon={Weight} label="Peso Actual" value={player.weight ? `${player.weight} kg` : 'Sin datos'} />
                <InfoCard icon={Ruler} label="Altura" value={player.height ? `${player.height} cm` : 'Sin datos'} />
                
                <div className="md:col-span-2 p-5 bg-red-500/5 border border-red-500/10 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-red-500/10">
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-500">¿Posee Enfermedades Preexistentes u Alergias?</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl ${player.has_preexisting_condition ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-500/20 text-[var(--text-main)]'}`}>
                      {player.has_preexisting_condition ? 'SÍ' : 'NO'}
                    </span>
                  </div>
                  
                  {player.has_preexisting_condition && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">Detalle Médico / Alergias / Medicación</span>
                      <p className="text-xs font-bold text-[var(--text-main)] uppercase whitespace-pre-wrap bg-surface-ground/30 p-3 rounded-2xl border border-[var(--surface-border)]">
                        {player.preexisting_condition_details || 'SIN ESPECIFICAR'}
                      </p>
                    </div>
                  )}

                  {player.medical_file_url && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">Documentación de Respaldo</span>
                      <a 
                        href={player.medical_file_url} 
                        target="_blank" 
                        rel="noreferrer noopener"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors inline-flex cursor-pointer"
                      >
                        <FileText size={12} />
                        <span>Ver Certificado / Estudio</span>
                        <ExternalLink size={10} className="opacity-70" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4">
                  <Activity className="text-emerald-500" size={24} />
                  <div>
                    <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 italic">Estado de Salud</h5>
                    <p className="text-xs font-bold text-[var(--text-muted)] italic leading-relaxed">Información médica básica para uso institucional rápido en caso de emergencias.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'CONTACTO' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex justify-between items-center bg-surface-ground p-4 rounded-3xl border border-[var(--surface-border)]">
                  <div>
                    <h4 className="text-[10.5px] font-black uppercase tracking-widest text-[var(--text-main)]">Contactos de Emergencia</h4>
                    <p className="text-[9.5px] text-[var(--text-muted)] mt-1 font-bold">Máximo 3 contactos por jugador</p>
                  </div>
                  {contactsList.length < 3 && !isAddingContact && (
                    <button
                      type="button"
                      onClick={handleAddContactClick}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <PlusCircle size={12} />
                      Agregar Contacto
                    </button>
                  )}
                </div>

                {contactsSaveSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase rounded-2xl tracking-widest text-center animate-in fade-in duration-300">
                    ✓ ¡CONTACTOS ACTUALIZADOS CORRECTAMENTE!
                  </div>
                )}

                {/* Adding / Editing Panel inside Trainer Legajo */}
                {isAddingContact && (
                  <div className="p-5 bg-surface-ground rounded-3xl border border-emerald-500/20 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-[var(--surface-border)]">
                      <h5 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                        {editingContactId ? "Editar Contacto" : "Nuevo Contacto"}
                      </h5>
                      <button
                        type="button"
                        onClick={() => { setIsAddingContact(false); setEditingContactId(null); setContactError(null); }}
                        className="text-[var(--text-muted)] hover:text-red-500 transition-all cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {contactError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 uppercase rounded-xl">
                        {contactError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Nombre</label>
                        <input
                          value={contactForm.name}
                          onChange={e => setContactForm({ ...contactForm, name: e.target.value.toUpperCase() })}
                          className="w-full p-2.5 bg-surface-ground rounded-xl font-bold text-xs border border-[var(--surface-border)] text-[var(--text-main)] outline-none"
                          placeholder="EJ: CARLOS GÓMEZ"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Relación</label>
                        <select
                          value={contactForm.relationship}
                          onChange={e => setContactForm({ ...contactForm, relationship: e.target.value })}
                          className="w-full p-2.5 bg-surface-ground rounded-xl font-bold text-xs border border-[var(--surface-border)] text-[var(--text-main)] outline-none cursor-pointer"
                        >
                          <option value="Padre">Padre</option>
                          <option value="Madre">Madre</option>
                          <option value="Tutor Legal">Tutor Legal</option>
                          <option value="Familiar">Familiar</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1 font-extrabold text-[var(--text-muted)]">Teléfono</label>
                        <input
                          value={contactForm.phone}
                          onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="w-full p-2.5 bg-surface-ground rounded-xl font-bold text-xs border border-[var(--surface-border)] text-[var(--text-main)] outline-none"
                          placeholder="CORREO O TELÉFONO"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Email</label>
                        <input
                          value={contactForm.email}
                          onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                          className="w-full p-2.5 bg-surface-ground rounded-xl font-bold text-xs border border-[var(--surface-border)] text-[var(--text-main)] outline-none"
                          placeholder="ejemplo@email.com"
                        />
                      </div>
                      <div className="space-y-1 col-span-1 md:col-span-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider pl-1">Dirección (Donde Reside)</label>
                        <input
                          value={contactForm.address}
                          onChange={e => setContactForm({ ...contactForm, address: e.target.value.toUpperCase() })}
                          className="w-full p-2.5 bg-surface-ground rounded-xl font-bold text-xs border border-[var(--surface-border)] text-[var(--text-main)] outline-none"
                          placeholder="Dirección del contacto"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => { setIsAddingContact(false); setEditingContactId(null); setContactError(null); }}
                        className="px-4 py-2 rounded-xl bg-[var(--surface-border)] hover:bg-opacity-80 font-black text-[9px] uppercase tracking-wider text-[var(--text-main)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveContactLocal}
                        disabled={isSavingContacts}
                        className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 font-black text-[9px] uppercase tracking-wider text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingContacts ? <Loader2 className="animate-spin" size={10} /> : <Save size={10} />}
                        {editingContactId ? "Actualizar" : "Agregar"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contacts List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contactsList.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 py-10 bg-surface-ground rounded-3xl border border-dashed border-[var(--surface-border)] text-center text-xs text-[var(--text-muted)]">
                      No hay contactos registrados para este jugador. Presiona '+ Agregar contacto' en la esquina superior para agregar el primero (madre, padre, tutor, etc.).
                    </div>
                  ) : (
                    contactsList.map((contact, index) => (
                      <div 
                        key={contact.id || index}
                        className="p-5 bg-surface-ground rounded-3xl border border-[var(--surface-border)] relative flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <div>
                              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                                {contact.relationship}
                              </span>
                              <h5 className="font-black text-xs text-[var(--text-main)] mt-1.5 break-words uppercase">{contact.name}</h5>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditContactClick(contact)}
                                className="p-1.5 rounded-lg bg-[var(--surface-border)] hover:bg-emerald-500/10 hover:text-emerald-500 text-[var(--text-muted)] transition-all cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteContact(contact.id)}
                                className="p-1.5 rounded-lg bg-[var(--surface-border)] hover:bg-red-500/10 hover:text-red-500 text-[var(--text-muted)] transition-all cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 text-[11px] font-bold text-[var(--text-muted)] pt-1 border-t border-[var(--surface-border)]/50">
                            <div className="flex items-center gap-1.5 break-all">
                              <Phone size={10} className="text-[var(--text-muted)] shrink-0" />
                              <span>{contact.phone}</span>
                            </div>
                            <div className="flex items-center gap-1.5 break-all">
                              <Mail size={10} className="text-[var(--text-muted)] shrink-0" />
                              <span>{contact.email}</span>
                            </div>
                            <div className="flex items-start gap-1.5 break-all">
                              <MapPin size={10} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                              <span className="leading-tight">{contact.address}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'ESCOLARIDAD' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Nombre de la Escuela</label>
                    <input 
                      value={schoolingForm.school_name} 
                      onChange={e => setSchoolingForm({...schoolingForm, school_name: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: COLEGIO NACIONAL N° 1"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Turno Escolar</label>
                    <select 
                      value={schoolingForm.school_shift} 
                      onChange={e => setSchoolingForm({...schoolingForm, school_shift: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)] cursor-pointer"
                    >
                      <option value="">Seleccionar turno</option>
                      <option value="MAÑANA">Mañana</option>
                      <option value="TARDE">Tarde</option>
                      <option value="NOCHE">Noche</option>
                      <option value="DOBLE TURNO">Doble Turno</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Horario Escolar</label>
                    <input 
                      value={schoolingForm.school_schedule} 
                      onChange={e => setSchoolingForm({...schoolingForm, school_schedule: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: 07:30 a 13:00 hs"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Actividad Extraescolar (si realiza alguna)</label>
                    <input 
                      value={schoolingForm.extra_activity} 
                      onChange={e => setSchoolingForm({...schoolingForm, extra_activity: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: Inglés, Computación..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Horarios de la Actividad Extraescolar</label>
                    <input 
                      value={schoolingForm.extra_activity_schedule} 
                      onChange={e => setSchoolingForm({...schoolingForm, extra_activity_schedule: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: Lun y Mié - 16:30 a 18:00 hs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Contacto de la Escuela / Teléfono</label>
                    <input 
                      value={schoolingForm.school_contact} 
                      onChange={e => setSchoolingForm({...schoolingForm, school_contact: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-surface-ground rounded-xl font-bold text-xs outline-none border border-[var(--surface-border)] text-[var(--text-main)]" 
                      placeholder="Ej: Alumnos / +54 341..."
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveSchooling}
                    disabled={isSavingSchooling}
                    className="flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white px-6 py-3 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg shadow-indigo-500/10 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isSavingSchooling ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {schoolingSaveSuccess ? '¡Guardado Correctamente!' : 'Guardar Datos Escolares'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-10 py-8 bg-surface-ground border-t border-[var(--surface-border)] flex justify-end">
           <button 
            onClick={onClose}
            className="px-8 py-3 bg-[var(--text-main)] text-surface-card rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:translate-y-[-1px] transition-all"
          >
            Cerrar Legajo
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
  <div className="p-5 rounded-3xl bg-surface-ground border border-[var(--surface-border)] flex items-center gap-4 hover:border-primary-500/30 transition-all group">
    <div className="w-10 h-10 rounded-xl bg-surface-card flex items-center justify-center text-[var(--text-muted)] group-hover:text-primary-500 transition-colors shadow-sm">
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest truncate">{label}</p>
      <p className="text-xs md:text-sm font-black text-[var(--text-main)] italic truncate">{value}</p>
    </div>
  </div>
);

export default PlayerLegajoResumido;
