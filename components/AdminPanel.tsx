
import React, { useState } from 'react';
import { Fixture, Discipline, TeamStructure } from '../types.ts';
import { Plus, Trash2, Edit2, Users, Activity, ChevronRight, X, Save, Trophy, AlertTriangle, Stethoscope } from 'lucide-react';

interface AdminPanelProps {
  activeTab: 'fixtures' | 'staff';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ activeTab }) => {
  // --- STATES FOR FIXTURES ---
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('Todas');
  const [showFixtureModal, setShowFixtureModal] = useState(false);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);

  const [fixtures] = useState<Fixture[]>([
    { id: '1', discipline: 'Fútbol', category: 'Primera', opponent: 'Real Madrid CF', date: '2023-11-15', venue: 'Home', competition: 'La Liga', result: 'Pending' },
    { id: '2', discipline: 'Básquet', category: 'Sub-20', opponent: 'Barcelona Basket', date: '2023-11-22', venue: 'Away', competition: 'Liga Endesa', result: 'Pending' },
    { id: '3', discipline: 'Vóley', category: 'Femenino', opponent: 'Club Vóley', date: '2023-11-08', venue: 'Home', competition: 'Torneo Local', result: '3-1' },
  ]);

  // --- STATES FOR STAFF/TEAMS ---
  const [selectedTeam, setSelectedTeam] = useState<TeamStructure | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamStructure | null>(null);

  const [teams, setTeams] = useState<TeamStructure[]>([
      { id: 't1', discipline: 'Fútbol', gender: 'Masculino', category: 'Primera', coach: 'Carlo Ancelotti', physicalTrainer: 'Antonio Pintus', medicalStaff: 'Dr. House', playersCount: 24 },
      { id: 't2', discipline: 'Fútbol', gender: 'Masculino', category: 'Reserva', coach: 'Marcelo Gallardo', physicalTrainer: 'Pablo Dolce', medicalStaff: 'Dr. Rossi', playersCount: 18 },
      { id: 't3', discipline: 'Básquet', gender: 'Masculino', category: 'Primera', coach: 'Steve Kerr', physicalTrainer: 'Ron Adams', medicalStaff: 'Dr. Smith', playersCount: 12 },
  ]);

  const handleFixtureEdit = (fixture: Fixture) => {
    setEditingFixture(fixture);
    setShowFixtureModal(true);
  };

  const handleNewFixture = () => {
    setEditingFixture(null);
    setShowFixtureModal(true);
  };

  const handleCreateTeam = () => {
      setEditingTeam(null);
      setShowTeamModal(true);
  }

  const handleEditTeam = (team: TeamStructure, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingTeam(team);
      setShowTeamModal(true);
  }

  const handleDeleteTeam = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm('¿Eliminar cuerpo técnico?')) {
          setTeams(prev => prev.filter(t => t.id !== id));
      }
  }

  const TeamHierarchy = ({ team, onBack }: { team: TeamStructure, onBack: () => void }) => (
    <div className="animate-fade-in">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-primary-600 mb-6 font-medium transition-colors">
            <ChevronRight className="rotate-180" size={18} /> Volver a Equipos
        </button>
        
        <div className="flex flex-col items-center space-y-8 relative">
            <div className="absolute inset-0 z-0 flex justify-center pointer-events-none">
                 <div className="w-px h-full bg-slate-300 dark:bg-slate-700"></div>
            </div>

            <div className="z-10 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border-t-4 border-primary-500 w-72 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Director Técnico</div>
                <div className="w-20 h-20 rounded-full bg-slate-200 mx-auto mb-3 border-4 border-white dark:border-slate-700 shadow-md">
                     <span className="flex items-center justify-center h-full text-2xl">👨‍🏫</span>
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{team.coach}</h3>
                <p className="text-slate-500 text-sm">{team.discipline} - {team.category}</p>
                <button 
                    onClick={(e) => { e.stopPropagation(); setEditingTeam(team); setShowTeamModal(true); }}
                    className="mt-3 text-xs text-primary-600 font-bold hover:underline"
                >
                    <Edit2 size={12} className="inline mr-1"/>Editar
                </button>
            </div>

            <div className="z-10 w-full flex justify-center gap-8 flex-wrap">
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border-l-4 border-blue-500 w-56 text-center">
                    <div className="flex justify-center mb-2 text-blue-500"><Activity /></div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Prep. Físico</h4>
                    <p className="text-sm text-slate-500">{team.physicalTrainer || 'No asignado'}</p>
                 </div>
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border-l-4 border-emerald-500 w-56 text-center">
                    <div className="flex justify-center mb-2 text-emerald-500"><Stethoscope /></div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Cuerpo Médico</h4>
                    <p className="text-sm text-slate-500">{team.medicalStaff || 'No asignado'}</p>
                 </div>
            </div>

             <div className="z-10 w-full pt-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Users size={18}/> Plantel de Jugadores</h4>
                        <button className="text-sm text-primary-600 font-bold">Gestionar</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                         {[...Array(11)].map((_, i) => (
                             <div key={i} className="bg-white dark:bg-slate-800 p-2 rounded-lg text-center shadow-sm border border-slate-100 dark:border-slate-700">
                                 <div className="w-10 h-10 rounded-full bg-slate-200 mx-auto mb-2"></div>
                                 <p className="text-xs font-bold text-slate-800 dark:text-white">Jugador {i+1}</p>
                                 <p className="text-[10px] text-slate-500">Titular</p>
                             </div>
                         ))}
                    </div>
                </div>
             </div>
        </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">
                {activeTab === 'fixtures' ? 'Calendario de Temporada' : 'Cuerpo Técnico y Estructura'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
                {activeTab === 'fixtures' ? 'Gestión de partidos y competencias' : 'Organigrama deportivo por disciplina'}
            </p>
        </div>
        
        {activeTab === 'fixtures' && (
            <div className="flex gap-3">
                 <select 
                    value={selectedDiscipline}
                    onChange={(e) => setSelectedDiscipline(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none dark:text-white"
                 >
                    <option value="Todas" className="dark:bg-slate-800 dark:text-white">Todas Disciplinas</option>
                    <option value="Fútbol" className="dark:bg-slate-800 dark:text-white">Fútbol</option>
                    <option value="Básquet" className="dark:bg-slate-800 dark:text-white">Básquet</option>
                    <option value="Vóley" className="dark:bg-slate-800 dark:text-white">Vóley</option>
                 </select>
                <button 
                    onClick={handleNewFixture}
                    className="flex items-center gap-2 bg-slate-900 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                >
                    <Plus size={18} />
                    <span>Nuevo Partido</span>
                </button>
            </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[60vh]">
        {activeTab === 'fixtures' && (
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-400 font-black uppercase tracking-widest text-[10px] border-b border-slate-100 dark:border-white/5">
              <tr>
                <th className="p-4">Disciplina</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Rival</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Lugar</th>
                <th className="p-4">Competición</th>
                <th className="p-4 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {fixtures.filter(f => selectedDiscipline === 'Todas' || f.discipline === selectedDiscipline).map((fixture) => (
                <tr key={fixture.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-4 text-sm font-bold text-slate-800 dark:text-white">{fixture.discipline}</td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{fixture.category}</td>
                  <td className="p-4 text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-white">{fixture.opponent}</td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{fixture.date}</td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{fixture.venue}</td>
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{fixture.competition}</td>
                  <td className="p-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${fixture.result === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'}`}>
                      {fixture.result === 'Pending' ? 'Pendiente' : fixture.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {activeTab === 'staff' && !selectedTeam && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {teams.map(team => (
              <div 
                key={team.id} 
                onClick={() => setSelectedTeam(team)}
                className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-primary-500/30 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-primary-600 group-hover:scale-110 transition-transform">
                    <Users size={20} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={(e) => handleEditTeam(team, e)} className="p-2 text-slate-400 hover:text-primary-600 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={(e) => handleDeleteTeam(team.id, e)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="font-black text-lg uppercase tracking-tighter text-slate-800 dark:text-white">{team.discipline}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{team.category}</p>
                <div className="space-y-2">
                   <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">DT:</span>
                      <span className="text-slate-800 dark:text-slate-200">{team.coach}</span>
                   </div>
                   <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">Plantel:</span>
                      <span className="text-primary-600">{team.playersCount} Atletas</span>
                   </div>
                </div>
              </div>
            ))}
            <button onClick={handleCreateTeam} className="border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center p-8 text-slate-400 hover:border-primary-500 hover:text-primary-500 transition-all gap-4">
               <Plus size={32} />
               <span className="text-xs font-black uppercase tracking-widest">Añadir Cuerpo Técnico</span>
            </button>
          </div>
        )}

        {activeTab === 'staff' && selectedTeam && (
          <div className="p-8">
            <TeamHierarchy team={selectedTeam} onBack={() => setSelectedTeam(null)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
