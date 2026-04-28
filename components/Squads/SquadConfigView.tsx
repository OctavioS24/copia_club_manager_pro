
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, Users, CalendarCheck, Trophy, Activity, Loader2 } from 'lucide-react';
import { db } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Discipline } from '../../types';

// Import child components
import PlantelDashboard from '../PlantelDashboard';
import PlantelLista from '../PlantelLista';
import Asistencia from '../Asistencia';
import FixtureView from '../Torneos/FixtureView';
import MedicalDashboard from '../MedicalDashboard';
import SquadsTab from './SquadsTab';

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
    setSelectedDiscipline
  } = useCategory();

  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

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
  };

  const handleDivisionChange = (divisionId: string) => {
    setSelectedDivision(divisionId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!discipline) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Disciplina no encontrada</h1>
        <button 
          onClick={() => navigate('/')}
          className="bg-primary-600 hover:bg-primary-700 px-6 py-2 rounded-xl transition-colors"
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
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Activity size={64} className="mb-4 opacity-20" />
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
        return <FixtureView />;
      case 'squads':
        return <SquadsTab />;
      case 'medico':
        return <MedicalDashboard readOnly={true} />;
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
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans pt-24">
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          {/* Left Section: Selectors */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2rem] p-8 shadow-xl">
              <div className="mb-8">
                <p className="text-[10px] text-slate-500 font-black tracking-[0.3em] uppercase mb-2">Disciplina Seleccionada</p>
                <h2 className="text-white font-black text-3xl italic uppercase tracking-tighter">{discipline.name}</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase mb-3 block">Rama / Género</label>
                  <div className="relative">
                    <select 
                      value={selectedGender || ''}
                      onChange={(e) => handleGenderChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer"
                    >
                      <option value="" disabled>Seleccionar Rama</option>
                      {discipline.branches.filter(b => b.enabled).map(branch => (
                        <option key={branch.gender} value={branch.gender}>
                          {branch.gender.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase mb-3 block">División / Categoría</label>
                  <div className="relative">
                    <select 
                      disabled={!selectedGender}
                      value={selectedDivision || ''}
                      onChange={(e) => handleDivisionChange(e.target.value)}
                      className={`w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all cursor-pointer ${!selectedGender ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="" disabled>Seleccionar División</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section: Tabs */}
          <div className="lg:col-span-8">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2rem] p-4 h-full flex flex-col justify-center">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 group ${
                        isActive 
                          ? 'bg-primary-600 shadow-lg shadow-primary-600/20 text-white' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-primary-500'
                      }`}
                    >
                      <Icon size={24} className={`mb-3 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-black tracking-widest uppercase">{tab.label}</span>
                      {isActive && (
                        <div className="mt-2 w-8 h-1 bg-white/50 rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-[3rem] p-8 min-h-[500px] animate-fade-in">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default SquadConfigView;
