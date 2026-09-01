
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, Users, CalendarCheck, Trophy, Activity, Loader2, DollarSign, UserCheck, BarChart3 } from 'lucide-react';
import { db, supabase } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Discipline, ClubConfig, Member } from '../../types';

// Import child components
import PlantelDashboard from '../PlantelDashboard';
import PlantelLista from '../PlantelLista';
import Asistencia from '../Asistencia';
import FixtureView from '../Torneos/FixtureView';
import MedicalDashboard from '../MedicalDashboard';
import SquadsTab from './SquadsTab';
import PaymentCommitments from './PaymentCommitments';
import PlayerPermits from './PlayerPermits';
import SquadReports from './SquadReports';

interface SquadConfigViewProps {
  config?: ClubConfig;
  members?: Member[];
}

const SquadConfigView: React.FC<SquadConfigViewProps> = ({ config: propConfig, members: propMembers }) => {
  const { disciplineId } = useParams<{ disciplineId: string }>();
  const navigate = useNavigate();
  const { 
    selectedGender, 
    setSelectedGender, 
    selectedDivision, 
    setSelectedDivision,
    setSelectedDiscipline,
    selectedTournamentId,
    setSelectedTournamentId
  } = useCategory();

  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('squad_active_tab') || 'dashboard';
  });
  const [targetFixtureMatchId, setTargetFixtureMatchId] = useState<string | null>(() => {
    return localStorage.getItem('open_fixture_match_id') || null;
  });
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('squad_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const fetchTourneys = async () => {
      try {
        const { data } = await supabase.from('tournaments').select('*');
        if (data) {
          const normalized = data.map(t => ({
            ...t,
            discipline_id: t.discipline_id || t.discipline,
            category_id: t.category_id || t.categoryid,
            assigned_categories: t.assigned_categories || t.assignedcategories || []
          }));
          setTournaments(normalized);
        }
      } catch (err) {
        console.error('Error fetching tournaments in SquadConfigView:', err);
      }
    };
    fetchTourneys();
  }, []);

  const filteredTournaments = useMemo(() => {
    if (!selectedDivision || !discipline) return [];
    return tournaments.filter(t => {
      const matchDisc = (t.discipline_id === discipline.id || t.disciplineid === discipline.id);
      const matchGender = !t.gender || !selectedGender || t.gender.toLowerCase() === selectedGender.toLowerCase();
      const hasCat = t.assigned_categories?.includes(selectedDivision) || t.assignedcategories?.includes(selectedDivision);
      return matchDisc && matchGender && hasCat;
    });
  }, [tournaments, selectedDivision, discipline, selectedGender]);

  // Sync effect to reset tournament if division/gender becomes invalid or null
  useEffect(() => {
    if (!selectedDivision || !selectedGender) {
      setSelectedTournamentId(null);
    }
  }, [selectedDivision, selectedGender, setSelectedTournamentId]);

  useEffect(() => {
    const fetchDiscipline = async () => {
      setLoading(true);
      try {
        // Use prop config if available and has disciplines
        if (propConfig && propConfig.disciplines && propConfig.disciplines.length > 0) {
          const matched = propConfig.disciplines.find(d => d.id === disciplineId);
          if (matched) {
            const normalized: Discipline = {
              ...matched,
              branches: matched.branches || [
                { gender: 'Masculino', enabled: true, categories: (matched as any).categories || [] },
                { gender: 'Femenino', enabled: false, categories: [] }
              ]
            };
            setDiscipline(normalized);
            setSelectedDiscipline(normalized.id);
            setLoading(false);
            return;
          }
        }

        // Fallback to fetching from DB if not found in props or props not provided
        const { data, error } = await db.config.get();
        if (error) throw error;
        
        if (data) {
          const rawDisciplines: any[] = data.disciplines || [];
          const matched = rawDisciplines.find(d => d.id === disciplineId);
          if (matched) {
            // Normalizar si no tiene ramas
            const normalized: Discipline = {
              ...matched,
              branches: matched.branches || [
                { gender: 'Masculino', enabled: true, categories: matched.categories || [] },
                { gender: 'Femenino', enabled: false, categories: [] }
              ]
            };
            setDiscipline(normalized);
            setSelectedDiscipline(normalized.id);
          }
        }
      } catch (err) {
        console.error('Error fetching discipline:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscipline();
  }, [disciplineId, propConfig, setSelectedDiscipline]);

  // Separate effect for validating gender/division to avoid infinite loops
  useEffect(() => {
    if (discipline) {
      // Validate and reset gender/division if they don't belong to this discipline
      const isGenderValid = discipline.branches.some(b => b.gender === selectedGender && b.enabled);
      if (!isGenderValid) {
        const firstEnabledBranch = discipline.branches.find(b => b.enabled);
        if (firstEnabledBranch) {
          setSelectedGender(firstEnabledBranch.gender);
          setSelectedDivision(null);
        } else {
          setSelectedGender(null);
          setSelectedDivision(null);
        }
      } else {
        // Gender is valid, check if division is valid within this gender
        const branch = discipline.branches.find(b => b.gender === selectedGender);
        const isDivisionValid = branch?.categories.some(c => c.id === selectedDivision);
        if (!isDivisionValid) {
          setSelectedDivision(null);
        }
      }
    }
  }, [discipline, selectedGender, selectedDivision, setSelectedGender, setSelectedDivision]);

  const handleGenderChange = (gender: string) => {
    setSelectedGender(gender);
    setSelectedDivision(null); // Reset division when gender changes
    setSelectedTournamentId(null); // Reset tournament when gender changes
  };

  const handleDivisionChange = (divisionId: string) => {
    setSelectedDivision(divisionId);
    setSelectedTournamentId(null); // Reset tournament when division changes
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-ground flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!discipline) {
    return (
      <div className="min-h-screen bg-surface-ground flex flex-col items-center justify-center text-[var(--text-main)] p-4">
        <h1 className="text-2xl font-bold mb-4">Disciplina no encontrada</h1>
        <button 
          onClick={() => navigate('/')}
          className="bg-primary-500 text-primary-contrast px-6 py-2 rounded-xl transition-colors"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  const currentBranch = discipline.branches.find(b => b.gender === selectedGender);
  const categories = currentBranch?.categories || [];

  const renderContent = () => {
    if (!selectedGender || !selectedDivision) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] opacity-30">
          <Activity size={64} className="mb-4" />
          <h3 className="text-xl font-bold uppercase tracking-widest">
            SELECCIONA UNA CATEGORÍA PARA VER RENDIMIENTO
          </h3>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <PlantelDashboard clubConfig={propConfig!} members={propMembers || []} />;
      case 'plantel':
        return <PlantelLista />;
      case 'asistencia':
        return <Asistencia />;
      case 'fixture':
        return (
          <FixtureView 
            initialMatchId={targetFixtureMatchId} 
            onOpenMatchIdCleared={() => {
              setTargetFixtureMatchId(null);
              localStorage.removeItem('open_fixture_match_id');
            }} 
          />
        );
      case 'squads':
        return (
          <SquadsTab 
            onNavigateToFixture={(matchId?: string) => {
              if (matchId) {
                setTargetFixtureMatchId(matchId);
                localStorage.setItem('open_fixture_match_id', matchId);
              }
              setActiveTab('fixture');
            }} 
          />
        );
      case 'medico':
        return <MedicalDashboard readOnly={true} />;
      case 'compromisos':
        return <PaymentCommitments />;
      case 'permisos':
        return <PlayerPermits />;
      case 'informes':
        return <SquadReports />;
      default:
        return <PlantelDashboard />;
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'plantel', label: 'PLANTEL', icon: Users },
    { id: 'asistencia', label: 'ASISTENCIA', icon: CalendarCheck },
    { id: 'fixture', label: 'FIXTURE', icon: Trophy },
    { id: 'squads', label: 'CONVOCATORIAS', icon: Users },
    { id: 'medico', label: 'MÉDICO', icon: Activity },
    { id: 'compromisos', label: 'COMPROMISOS', icon: DollarSign },
    { id: 'permisos', label: 'PERMISOS', icon: UserCheck },
    { id: 'informes', label: 'INFORMES', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-surface-ground text-[var(--text-main)] font-sans pt-24">
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          {/* Left Section: Selectors */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface-card border border-[var(--surface-border)] rounded-[2rem] p-8 shadow-xl">
              <div className="mb-8">
                <button
                  onClick={() => {
                    localStorage.removeItem('last_squads_path');
                    navigate('/');
                  }}
                  className="mb-4 text-[9px] font-black uppercase text-primary-500 hover:text-primary-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  ← Cambiar Disciplina
                </button>
                <p className="text-[10px] text-[var(--text-muted)] font-black tracking-[0.3em] uppercase mb-2">Disciplina Seleccionada</p>
                <h2 className="text-[var(--text-main)] font-black text-3xl italic uppercase tracking-tighter">{discipline.name}</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] font-black tracking-[0.2em] uppercase mb-3 block">Rama / Género</label>
                  <div className="relative">
                    <select 
                      value={selectedGender || ''}
                      onChange={(e) => handleGenderChange(e.target.value)}
                      className="w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-4 py-4 text-[var(--text-main)] font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer"
                    >
                      <option value="" disabled>Seleccionar Rama</option>
                      {discipline.branches.filter(b => b.enabled).map(branch => (
                        <option key={branch.gender} value={branch.gender}>
                          {branch.gender.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={20} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-muted)] font-black tracking-[0.2em] uppercase mb-3 block">División / Categoría</label>
                  <div className="relative">
                    <select 
                      disabled={!selectedGender}
                      value={selectedDivision || ''}
                      onChange={(e) => handleDivisionChange(e.target.value)}
                      className={`w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-4 py-4 text-[var(--text-main)] font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer ${!selectedGender ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="" disabled>Seleccionar División</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={20} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-muted)] font-black tracking-[0.2em] uppercase mb-3 block">Torneo Actual de Selección</label>
                  <div className="relative">
                    <select 
                      disabled={!selectedDivision || filteredTournaments.length === 0}
                      value={selectedTournamentId || ''}
                      onChange={(e) => setSelectedTournamentId(e.target.value || null)}
                      className={`w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-4 py-4 text-[var(--text-main)] font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer ${(!selectedDivision || filteredTournaments.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="" disabled={filteredTournaments.length > 0}>
                        {!selectedDivision 
                          ? 'SELECCIONE CATEGORÍA PRIMERO' 
                          : filteredTournaments.length === 0 
                            ? 'SIN TORNEOS PARA ESTA CATEGORÍA' 
                            : 'SELECCIONAR TORNEO'}
                      </option>
                      {filteredTournaments.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section: Tabs */}
          <div className="lg:col-span-8 bg-surface-card border border-[var(--surface-border)] rounded-[2rem] p-6 shadow-xl flex flex-col justify-center">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-4">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 group ${
                        isActive 
                          ? 'bg-primary-500 shadow-lg shadow-primary-500/20 text-primary-contrast' 
                          : 'bg-surface-ground hover:bg-surface-hover text-[var(--text-muted)] hover:text-primary-500'
                      }`}
                    >
                      <Icon size={24} className={`mb-3 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-black tracking-widest uppercase">{tab.label}</span>
                      {isActive && (
                        <div className="mt-2 w-8 h-1 bg-current opacity-50 rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        {/* Main Content Area */}
        <div className="bg-surface-card border border-[var(--surface-border)] rounded-[3rem] p-8 min-h-[500px] animate-fade-in">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default SquadConfigView;
