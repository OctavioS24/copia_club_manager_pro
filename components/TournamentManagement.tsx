
import React, { useState, useEffect, useMemo } from 'react';
import { Tournament, Match, Player, Category, Discipline, ClubConfig, TournamentParticipant, Member } from '../types';
import { 
  Trophy, Plus, Calendar, Trash2, X, ChevronRight, Edit3, 
  Users, Loader2, CheckCircle2,
  ListOrdered, Search, Layout, UserCircle, 
  GitBranch, Table as TableIcon, Award, ChevronLeft, 
  Settings2, Shield, UserMinus
} from 'lucide-react';
import { db } from '../lib/supabase';
import CrearTorneo from './Torneos/CrearTorneo';

interface TournamentManagementProps {
  discipline: Discipline;
  category: Category | null;
  gender: 'Masculino' | 'Femenino';
  players: Player[];
  clubConfig: ClubConfig;
}

interface TempTeam {
  id: string;
  name: string;
  memberIds: string[];
}

import { useCategory } from '../context/useCategory';

const TournamentManagement: React.FC<TournamentManagementProps> = ({ 
  discipline: propDiscipline, 
  category: propCategory, 
  gender: propGender, 
  clubConfig: propClubConfig 
}) => {
  const { selectedDiscipline, selectedDivision, selectedGender } = useCategory();
  const [discipline, setDiscipline] = useState<Discipline | null>(propDiscipline || null);
  const [category, setCategory] = useState<Category | null>(propCategory || null);
  const [gender, setGender] = useState<'Masculino' | 'Femenino'>(propGender || (selectedGender as any) || 'Masculino');
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(propClubConfig || null);

  // Fetch data if needed
  useEffect(() => {
    const fetchData = async () => {
      if (propDiscipline && propClubConfig) return;

      setIsLoading(true);
      try {
        const configRes = await db.config.get();
        if (configRes.data) {
          setClubConfig(configRes.data);
          const disc = configRes.data.disciplines.find((d: any) => d.id === selectedDiscipline);
          if (disc) {
            setDiscipline(disc);
            if (selectedDivision) {
              const cat = disc.branches.flatMap((b: any) => b.categories).find((c: any) => c.id === selectedDivision);
              if (cat) setCategory(cat);
            }
          }
        }
        if (selectedGender) setGender(selectedGender as any);
      } catch (err) {
        console.error("Error fetching data for TournamentManagement:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [propDiscipline, propClubConfig, selectedDiscipline, selectedDivision, selectedGender]);

  // --- Estados de Datos ---
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  
  // --- Estados de UI ---
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [viewMode, setViewMode] = useState<'fixture' | 'groups' | 'bracket' | 'participants'>('fixture');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);

  // --- Estados de Formulario de Torneo ---
  const [tForm, setTForm] = useState<Partial<Tournament>>({
    name: '', type: 'Professional', settings: { has_groups: false, groups_count: 1, advancing_per_group: 2, has_playoffs: false, playoff_start: 'F' }
  });
  
  // --- Estados para Armado de Equipos ---
  const [tempTeams, setTempTeams] = useState<TempTeam[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  
  const [matchForm, setMatchForm] = useState({
    homeParticipantId: '', 
    awayParticipantId: '', 
    rivalName: '',
    isHome: true, 
    myScore: 0, 
    rivalScore: 0, 
    date: new Date().toISOString().split('T')[0], 
    stage: 'Fase Regular'
  });

  const loadInitialData = React.useCallback(async () => {
    if (!discipline) return;
    setIsLoading(true);
    try {
      const [tourRes, memRes] = await Promise.all([
        db.tournaments.getAll(),
        db.members.getAll()
      ]);
      
      if (tourRes.data) {
        const filtered = tourRes.data.filter((t: any) => {
          const tDiscId = t.discipline_id || t.disciplineid;
          const tGender = t.gender;
          const tAssignedCats = t.assigned_categories || t.assignedcategories || [];

          // Check if the tournament is explicitly for this discipline
          const discMatch = tDiscId === discipline?.id;
          
          // OR if it has assigned_categories that belong to this discipline
          const hasAssignedCategoryInDiscipline = tAssignedCats.some((catId: string) => {
            return discipline?.branches?.some(b => b.categories.some(c => c.id === catId));
          });

          const genderMatch = !gender || (tGender === gender);
          
          return (discMatch || hasAssignedCategoryInDiscipline) && genderMatch;
        });
        setTournaments(filtered);
        if (filtered.length > 0 && !activeTournament) setActiveTournament(filtered[0]);
      }
      if (memRes.data) setAllMembers(memRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [discipline, gender, activeTournament]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    if (activeTournament) {
      db.matches.getAll(activeTournament.id).then(res => res.data && setMatches(res.data));
      db.participants.getAll(activeTournament.id).then(res => res.data && setParticipants(res.data));
    }
  }, [activeTournament]);

  // --- LÓGICA DE EQUIPOS ---
  const addTeam = () => {
    const newTeam: TempTeam = { id: crypto.randomUUID(), name: `EQUIPO ${tempTeams.length + 1}`, memberIds: [] };
    setTempTeams([...tempTeams, newTeam]);
    setActiveTeamId(newTeam.id);
  };

  const removeTeam = (id: string) => {
    setTempTeams(tempTeams.filter(t => t.id !== id));
    if (activeTeamId === id) setActiveTeamId(null);
  };

  const toggleMemberInTeam = (memberId: string) => {
    if (!activeTeamId) return;
    setTempTeams(prev => prev.map(t => {
      if (t.id === activeTeamId) {
        const exists = t.memberIds.includes(memberId);
        return {
          ...t,
          memberIds: exists ? t.memberIds.filter(id => id !== memberId) : [...t.memberIds, memberId]
        };
      }
      return t;
    }));
  };

  const availableMembers = useMemo(() => {
    return allMembers.filter(m => {
      const hasDiscipline = m.assignments?.some(a => (a.discipline_id || (a as any).disciplineId) === discipline?.id);
      const searchMatch = m.name.toLowerCase().includes(participantSearch.toLowerCase()) || m.dni.includes(participantSearch);
      return hasDiscipline && searchMatch;
    });
  }, [allMembers, discipline?.id, participantSearch]);

  const handleFinalizeTournament = async () => {
    if (!tForm.name) return;
    setIsLoading(true);
    try {
      const tournamentId = editingTournamentId || crypto.randomUUID();
      const newTournament: any = {
        id: tournamentId,
        name: tForm.name.toUpperCase(),
        type: tForm.type,
        discipline_id: discipline?.id,
        category_id: category?.id || null,
        gender: gender,
        status: 'Open',
        settings: tForm.settings,
        created_at: new Date().toISOString()
      };
      await db.tournaments.upsert(newTournament);

      if (editingTournamentId) {
        const { data: existingParts } = await db.participants.getAll(editingTournamentId);
        if (existingParts) for (const p of existingParts) await db.participants.delete(p.id);
      }

      if (tForm.type === 'Internal') {
        const promises = tempTeams.map(team => db.participants.upsert({
          id: crypto.randomUUID(),
          tournament_id: tournamentId,
          name: team.name.toUpperCase(),
          member_ids: team.memberIds
        }));
        await Promise.all(promises);
      }

      await loadInitialData();
      setShowWizard(false);
      setEditingTournamentId(null);
      setTempTeams([]);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleEditTournament = async (t: Tournament, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTournamentId(t.id);
    setTForm({ name: t.name, type: t.type, settings: t.settings });
    
    const partRes = await db.participants.getAll(t.id);
    if (partRes.data) {
      setTempTeams(partRes.data.map(p => ({
        id: p.id,
        name: p.name,
        memberIds: p.member_ids || []
      })));
    }
    setWizardStep(1);
    setShowWizard(true);
  };

  const handleDeleteTournament = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar torneo y toda su historia?')) return;
    await db.tournaments.delete(id);
    loadInitialData();
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatchId(match.id);
    setMatchForm({
      homeParticipantId: match.homeParticipantId || '',
      awayParticipantId: match.awayParticipantId || '',
      rivalName: activeTournament?.type === 'Professional' ? (match.homeTeam === clubConfig.name ? match.awayTeam : match.homeTeam) : '',
      isHome: match.homeTeam === clubConfig.name,
      myScore: (match.homeTeam === clubConfig.name ? match.homeScore : match.awayScore) || 0,
      rivalScore: (match.homeTeam === clubConfig.name ? match.awayScore : match.homeScore) || 0,
      date: match.date,
      stage: match.stage || 'Fase Regular'
    });
    setShowMatchModal(true);
  };

  const handleDeleteMatch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar resultado?')) return;
    await db.matches.delete(id);
    if (activeTournament) {
      const res = await db.matches.getAll(activeTournament.id);
      if (res.data) setMatches(res.data);
    }
  };

  const StepIndicator = () => (
    <div className="flex justify-between items-center mb-10 px-12 relative">
      <div className="absolute top-1/2 left-12 right-12 h-1 bg-slate-100 dark:bg-white/5 -translate-y-1/2 -z-10"></div>
      {[1, 2, 3, 4].map(step => (
        <div key={step} className="flex flex-col items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all border-4 ${wizardStep >= step ? 'bg-primary-600 border-primary-100 dark:border-slate-800 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 text-slate-400'}`}>
            {wizardStep > step ? <CheckCircle2 size={16} /> : step}
          </div>
          <span className={`text-[7px] font-black uppercase tracking-widest ${wizardStep >= step ? 'text-primary-600' : 'text-slate-400'}`}>
            {step === 1 ? 'Nombre' : step === 2 ? 'Formato' : step === 3 ? 'Equipos' : 'Confirmar'}
          </span>
        </div>
      ))}
    </div>
  );

  const inputClasses = "w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm outline-none border border-transparent dark:border-white/5 focus:border-primary-600 shadow-inner dark:text-white transition-all";
  const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block";

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic flex items-center gap-4">
             <Trophy size={40} className="text-primary-600" />
             Competiciones
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-1 ml-1">Central de Torneos Plegma Sport</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-primary-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
        >
          <Plus size={18} strokeWidth={3} /> Nuevo Torneo
        </button>
      </header>

      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          <div className="bg-white dark:bg-[#0f1219]/60 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-3">
               <Layout size={14} className="text-primary-600" /> Mis Torneos
             </h4>
             <div className="space-y-3">
                {tournaments.map(t => (
                  <div key={t.id} className="relative group/t">
                    <button 
                      onClick={() => { setActiveTournament(t); setViewMode('fixture'); }}
                      className={`w-full p-5 pr-14 rounded-3xl flex flex-col items-start transition-all relative border-2 ${activeTournament?.id === t.id ? 'bg-primary-600 border-primary-600 text-white shadow-xl scale-[1.02]' : 'bg-transparent border-slate-100 dark:border-white/5 text-slate-500 hover:bg-slate-50'}`}
                    >
                      <span className="text-xs font-black uppercase tracking-tight italic truncate w-full text-left">{t.name}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest mt-2 ${activeTournament?.id === t.id ? 'text-white/60' : 'text-primary-600'}`}>
                        {t.type === 'Professional' ? 'Liga Profesional' : 'Torneo del Club'}
                      </span>
                    </button>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover/t:opacity-100 transition-opacity z-10">
                       <button onClick={(e) => handleEditTournament(t, e)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary-600">
                          <Edit3 size={14} />
                       </button>
                       <button onClick={(e) => handleDeleteTournament(t.id, e)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                       </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
          {activeTournament && (
            <div className="bg-white dark:bg-[#0f1219]/60 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-3">
                  <Settings2 size={14} className="text-primary-600" /> Gestión Activa
                </h4>
                <div className="space-y-2">
                    {[
                      { id: 'fixture', label: 'Resultados', icon: Calendar },
                      { id: 'groups', label: 'Tablas', icon: ListOrdered, show: activeTournament.settings.has_groups },
                      { id: 'bracket', label: 'Playoffs', icon: GitBranch, show: activeTournament.settings.has_playoffs },
                      { id: 'participants', label: 'Equipos', icon: Users, show: true }
                    ].map(item => (item.show !== false) && (
                      <button key={item.id} onClick={() => setViewMode(item.id as any)} className={`w-full p-4 rounded-2xl flex items-center gap-4 text-[11px] font-black uppercase transition-all ${viewMode === item.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <item.icon size={16} /> {item.label}
                      </button>
                    ))}
                </div>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0">
           {activeTournament ? (
             <div className="space-y-8 animate-fade-in">
                {viewMode === 'fixture' && (
                  <>
                     <div className="bg-white dark:bg-[#0f1219]/40 p-10 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8">
                        <div>
                          <span className="px-4 py-1.5 bg-primary-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">{activeTournament.name}</span>
                          <h3 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic mt-3">Fixture de Temporada</h3>
                        </div>
                        <button 
                          onClick={() => { setEditingMatchId(null); setShowMatchModal(true); }}
                          className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl flex items-center gap-3"
                        >
                          <Plus size={18} /> Cargar Partido
                        </button>
                     </div>
                     <div className="grid grid-cols-1 gap-4">
                        {matches.map(m => (
                          <div key={m.id} onClick={() => handleEditMatch(m)} className="bg-white dark:bg-[#0f1219]/60 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 flex items-center justify-between gap-10 group hover:border-primary-600/30 transition-all cursor-pointer relative">
                              <div className="flex-1 text-right">
                                 <p className="text-lg font-black uppercase italic text-slate-800 dark:text-white">{m.homeTeam}</p>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Local</p>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                 <div className="bg-slate-100 dark:bg-white/5 px-6 py-3 rounded-2xl flex items-center gap-5 text-2xl font-black italic shadow-inner">
                                    <span className={m.status === 'Finished' ? 'text-primary-600' : 'text-slate-300'}>{m.status === 'Finished' ? m.homeScore : '-'}</span>
                                    <span className="text-[10px] text-slate-400 not-italic uppercase tracking-widest">VS</span>
                                    <span className={m.status === 'Finished' ? 'text-primary-600' : 'text-slate-300'}>{m.status === 'Finished' ? m.awayScore : '-'}</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><Calendar size={12} /> {m.date}</div>
                              </div>
                              <div className="flex-1 text-left">
                                 <p className="text-lg font-black uppercase italic text-slate-800 dark:text-white">{m.awayTeam}</p>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Visitante</p>
                              </div>
                              <button onClick={(e) => handleDeleteMatch(m.id, e)} className="absolute right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                          </div>
                        ))}
                     </div>
                  </>
                )}
                {viewMode === 'participants' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {participants.map(p => (
                       <div key={p.id} className="bg-white dark:bg-[#0f1219] p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm">
                          <h4 className="text-lg font-black uppercase italic tracking-tighter text-slate-800 dark:text-white mb-4">{p.name}</h4>
                          <div className="space-y-2">
                             {(p.member_ids || []).map(mid => {
                               const m = allMembers.find(mem => mem.id === mid);
                               return <div key={mid} className="text-[10px] font-bold uppercase text-slate-500 bg-slate-50 dark:bg-white/5 p-2 rounded-xl flex items-center gap-2"><UserCircle size={14} /> {m?.name}</div>
                             })}
                          </div>
                       </div>
                     ))}
                  </div>
                )}
             </div>
           ) : (
             <div className="py-40 text-center bg-white dark:bg-[#0f1219]/30 rounded-[4rem] border-4 border-dashed border-slate-200 dark:border-white/5 flex flex-col items-center justify-center">
                <Trophy size={60} className="text-slate-200 mb-6" />
                <h3 className="text-2xl font-black uppercase text-slate-300 italic tracking-[0.2em]">Selecciona un Torneo</h3>
             </div>
           )}
        </div>
      </div>

      {showCreateModal && (
        <CrearTorneo 
          clubConfig={clubConfig}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => loadInitialData()}
          defaultDisciplineId={discipline?.id}
          defaultGender={gender}
        />
      )}

      {showWizard && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[600] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0f121a] w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
               <h3 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white">Configurador de Torneo</h3>
               <button onClick={() => setShowWizard(false)} className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
               <StepIndicator />
               
               {wizardStep === 1 && (
                 <div className="space-y-8 animate-fade-in">
                    <div className="space-y-4">
                       <label className={labelClasses}>Nombre de la Competición</label>
                       <input value={tForm.name} onChange={e => setTForm({...tForm, name: e.target.value.toUpperCase()})} placeholder="EJ: SUPER COPA INTERNA 2026" className={inputClasses + " text-xl p-6"} />
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                       <button onClick={() => setTForm({...tForm, type: 'Internal'})} className={`p-10 rounded-[3rem] border-4 flex flex-col items-center gap-4 transition-all ${tForm.type === 'Internal' ? 'border-primary-600 bg-primary-600/5' : 'border-slate-100 dark:border-white/5 opacity-40'}`}>
                          <Users size={48} className="text-primary-600" />
                          <span className="text-lg font-black uppercase italic dark:text-white">Torneo Interno</span>
                       </button>
                       <button onClick={() => setTForm({...tForm, type: 'Professional'})} className={`p-10 rounded-[3rem] border-4 flex flex-col items-center gap-4 transition-all ${tForm.type === 'Professional' ? 'border-primary-600 bg-primary-600/5' : 'border-slate-100 dark:border-white/5 opacity-40'}`}>
                          <Shield size={48} className="text-primary-600" />
                          <span className="text-lg font-black uppercase italic dark:text-white">Liga Profesional</span>
                       </button>
                    </div>
                 </div>
               )}

               {wizardStep === 2 && (
                 <div className="space-y-8 animate-fade-in">
                    <div 
                      onClick={() => setTForm({...tForm, settings: {...tForm.settings!, has_groups: !tForm.settings?.has_groups}})}
                      className={`flex items-center justify-between p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all ${tForm.settings?.has_groups ? 'border-primary-600 bg-primary-600/5' : 'border-slate-100 dark:border-white/5'}`}
                    >
                       <div className="flex items-center gap-6">
                          <TableIcon size={32} className="text-primary-600" />
                          <div>
                            <p className="text-lg font-black uppercase italic dark:text-white">Fase de Grupos</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ligas divididas por zonas</p>
                          </div>
                       </div>
                       <CheckCircle2 size={24} className={tForm.settings?.has_groups ? 'text-primary-600' : 'text-slate-200'} />
                    </div>
                    <div 
                      onClick={() => setTForm({...tForm, settings: {...tForm.settings!, has_playoffs: !tForm.settings?.has_playoffs}})}
                      className={`flex items-center justify-between p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all ${tForm.settings?.has_playoffs ? 'border-primary-600 bg-primary-600/5' : 'border-slate-100 dark:border-white/5'}`}
                    >
                       <div className="flex items-center gap-6">
                          <GitBranch size={32} className="text-primary-600" />
                          <div>
                            <p className="text-lg font-black uppercase italic dark:text-white">Playoffs (Eliminación)</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Llaves directas hasta la final</p>
                          </div>
                       </div>
                       <CheckCircle2 size={24} className={tForm.settings?.has_playoffs ? 'text-primary-600' : 'text-slate-200'} />
                    </div>
                 </div>
               )}

               {wizardStep === 3 && (
                 <div className="space-y-10 animate-fade-in flex flex-col h-full">
                    <div className="flex flex-col md:flex-row gap-10 flex-1">
                       <div className="w-full md:w-1/2 space-y-6">
                          <div className="flex justify-between items-center">
                             <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Equipos Registrados</h4>
                             <button onClick={addTeam} className="bg-slate-900 text-white p-2 rounded-xl hover:scale-110 transition-all"><Plus size={16} /></button>
                          </div>
                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {tempTeams.map(t => (
                               <div key={t.id} onClick={() => setActiveTeamId(t.id)} className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer ${activeTeamId === t.id ? 'border-primary-600 bg-primary-600/5' : 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5'}`}>
                                  <div className="flex justify-between items-center mb-4">
                                     <input value={t.name} onChange={e => setTempTeams(prev => prev.map(pt => pt.id === t.id ? {...pt, name: e.target.value.toUpperCase()} : pt))} className="bg-transparent font-black uppercase italic text-lg outline-none w-full" />
                                     <button onClick={(e) => { e.stopPropagation(); removeTeam(t.id); }} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                     {t.memberIds.map(mid => {
                                        const m = allMembers.find(mem => mem.id === mid);
                                        return <span key={mid} className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full text-[8px] font-black uppercase text-slate-500 shadow-sm flex items-center gap-2 border border-slate-100 dark:border-white/5">{m?.name} <button onClick={(e) => { e.stopPropagation(); toggleMemberInTeam(mid); }} className="text-red-400"><UserMinus size={10} /></button></span>
                                     })}
                                     {t.memberIds.length === 0 && <p className="text-[9px] font-bold text-slate-400 italic">Sin jugadores asignados</p>}
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                       
                       <div className="w-full md:w-1/2 space-y-6">
                          <div className="relative">
                             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                             <input value={participantSearch} onChange={e => setParticipantSearch(e.target.value)} placeholder="BUSCAR SOCIO (FUTBOL)..." className={inputClasses + " pl-12"} />
                          </div>
                          <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {availableMembers.map(m => {
                               const isInAnyTeam = tempTeams.some(t => t.memberIds.includes(m.id));
                               const isInActive = activeTeamId ? tempTeams.find(t => t.id === activeTeamId)?.memberIds.includes(m.id) : false;
                               return (
                                 <button 
                                  key={m.id} 
                                  disabled={!activeTeamId || (isInAnyTeam && !isInActive)}
                                  onClick={() => toggleMemberInTeam(m.id)} 
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${isInActive ? 'bg-primary-600 border-primary-600 text-white shadow-lg' : isInAnyTeam ? 'opacity-30 grayscale' : 'bg-slate-50 dark:bg-white/5 border-transparent hover:border-primary-600/30'}`}
                                 >
                                    <img src={m.photoUrl} className="w-10 h-10 rounded-xl object-cover" />
                                    <div className="flex-1">
                                       <p className="text-[10px] font-black uppercase truncate">{m.name}</p>
                                       <p className="text-[8px] font-bold opacity-60">DNI: {m.dni}</p>
                                    </div>
                                    {isInActive && <CheckCircle2 size={16} />}
                                 </button>
                               )
                             })}
                          </div>
                       </div>
                    </div>
                 </div>
               )}

               {wizardStep === 4 && (
                 <div className="space-y-10 animate-fade-in text-center py-20">
                    <Award size={80} className="mx-auto text-primary-600 animate-bounce" />
                    <div className="max-w-md mx-auto">
                       <h4 className="text-3xl font-black uppercase italic dark:text-white">{tForm.name}</h4>
                       <div className="flex justify-center gap-4 mt-6">
                          <span className="bg-primary-600/10 text-primary-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{tForm.type}</span>
                          <span className="bg-slate-100 dark:bg-white/5 text-slate-400 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{tempTeams.length} EQUIPOS</span>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <div className="p-10 border-t border-white/5 bg-slate-50/50 dark:bg-slate-800/40 flex justify-between shrink-0">
               <button onClick={() => setWizardStep(prev => prev - 1)} disabled={wizardStep === 1} className="px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 disabled:opacity-0 flex items-center gap-2"><ChevronLeft size={16}/> Anterior</button>
               {wizardStep < 4 ? (
                 <button onClick={() => setWizardStep(prev => prev + 1)} className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-16 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2">Siguiente <ChevronRight size={16}/></button>
               ) : (
                 <button onClick={handleFinalizeTournament} disabled={isLoading} className="bg-primary-600 text-white px-24 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl flex items-center gap-3">
                   {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Award size={20} />}
                   Finalizar Configuración
                 </button>
               )}
            </div>
          </div>
        </div>
      )}

      {showMatchModal && activeTournament && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[600] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white dark:bg-[#0f121a] w-full max-w-2xl max-h-[90vh] rounded-[3.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white">Registrar Score</h3>
                <button onClick={() => setShowMatchModal(false)} className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-full"><X size={24} /></button>
              </div>
              <div className="p-10 space-y-10 overflow-y-auto flex-1 custom-scrollbar">
                 <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-3">
                       <label className={labelClasses}>Equipo Local</label>
                       {activeTournament.type === 'Internal' ? (
                          <select className={inputClasses} value={matchForm.homeParticipantId} onChange={e => setMatchForm({...matchForm, homeParticipantId: e.target.value})}>
                             <option value="">-- EQUIPO --</option>
                             {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                       ) : (
                          <input className={inputClasses} value={matchForm.isHome ? clubConfig.name : matchForm.rivalName} readOnly={matchForm.isHome} onChange={e => !matchForm.isHome && setMatchForm({...matchForm, rivalName: e.target.value.toUpperCase()})} placeholder={matchForm.isHome ? "" : "NOMBRE RIVAL"} />
                       )}
                    </div>
                    <div className="space-y-3">
                       <label className={labelClasses}>Equipo Visitante</label>
                       {activeTournament.type === 'Internal' ? (
                          <select className={inputClasses} value={matchForm.awayParticipantId} onChange={e => setMatchForm({...matchForm, awayParticipantId: e.target.value})}>
                             <option value="">-- EQUIPO --</option>
                             {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                       ) : (
                          <input className={inputClasses} value={!matchForm.isHome ? clubConfig.name : matchForm.rivalName} readOnly={!matchForm.isHome} onChange={e => matchForm.isHome && setMatchForm({...matchForm, rivalName: e.target.value.toUpperCase()})} placeholder={!matchForm.isHome ? "" : "NOMBRE RIVAL"} />
                       )}
                    </div>
                 </div>
                 <div className="flex items-center justify-center gap-10 bg-slate-50 dark:bg-white/5 p-12 rounded-[3.5rem] border border-slate-100 dark:border-white/5 shadow-inner">
                    <div className="text-center space-y-4">
                       <span className="text-[10px] font-black uppercase text-slate-400">Score Local</span>
                       <input type="number" value={matchForm.myScore} onChange={e => setMatchForm({...matchForm, myScore: parseInt(e.target.value) || 0})} className="w-24 text-center font-black text-6xl bg-transparent outline-none dark:text-white" />
                    </div>
                    <div className="text-4xl font-black text-slate-200 italic">VS</div>
                    <div className="text-center space-y-4">
                       <span className="text-[10px] font-black uppercase text-slate-400">Score Visit.</span>
                       <input type="number" value={matchForm.rivalScore} onChange={e => setMatchForm({...matchForm, rivalScore: parseInt(e.target.value) || 0})} className="w-24 text-center font-black text-6xl bg-transparent outline-none dark:text-white" />
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border-t border-white/5">
                 <button 
                  onClick={async () => {
                    const hName = activeTournament.type === 'Internal' ? participants.find(p => p.id === matchForm.homeParticipantId)?.name : (matchForm.isHome ? category?.name : matchForm.rivalName);
                    const vName = activeTournament.type === 'Internal' ? participants.find(p => p.id === matchForm.awayParticipantId)?.name : (!matchForm.isHome ? category?.name : matchForm.rivalName);
                    
                    await db.matches.upsert({
                      id: editingMatchId || crypto.randomUUID(),
                      tournamentId: activeTournament.id,
                      homeTeam: hName || 'Local',
                      awayTeam: vName || 'Visitante',
                      homeScore: matchForm.myScore,
                      awayScore: matchForm.rivalScore,
                      homeParticipantId: matchForm.homeParticipantId,
                      awayParticipantId: matchForm.awayParticipantId,
                      date: matchForm.date,
                      status: 'Finished',
                      stage: matchForm.stage
                    });
                    const res = await db.matches.getAll(activeTournament.id);
                    if (res.data) setMatches(res.data);
                    setShowMatchModal(false);
                  }} 
                  className="w-full py-6 bg-primary-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl"
                 >
                   Confirmar Marcador
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TournamentManagement;
