
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Player } from '../types';
import { db } from '../lib/supabase';
import { Users, Loader2, AlertCircle, Shield, Briefcase } from 'lucide-react';

interface PlantelListaProps {
  disciplineId: string; 
  categoryId: string;
  disciplineName: string;
  categoryName: string;
}

import { useCategory } from '../context/useCategory';
import PlayerLegajoResumido from './PlayerLegajoResumido';

const PlantelLista: React.FC<PlantelListaProps> = ({ 
  disciplineId: propDisciplineId, 
  categoryId: propCategoryId,
  disciplineName: propDisciplineName,
  categoryName: propCategoryName
}) => {
  const { selectedDiscipline, selectedDivision } = useCategory();
  
  // Use props if provided, otherwise use context
  const disciplineId = propDisciplineId || selectedDiscipline || '';
  const categoryId = propCategoryId || selectedDivision || '';
  
  const [members, setMembers] = useState<Member[]>([]);
  const [persistedPlayers, setPersistedPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disciplineName, setDisciplineName] = useState(propDisciplineName || '');
  const [categoryName, setCategoryName] = useState(propCategoryName || '');

  useEffect(() => {
    const fetchData = async () => {
      if (!disciplineId || !categoryId) return;
      
      setIsLoading(true);
      setError(null);
      try {
        const [membersRes, playersRes, configRes] = await Promise.all([
          db.members.getAll(),
          db.players.getAll(),
          db.config.get()
        ]);

        if (membersRes.error) throw membersRes.error;
        if (playersRes.error) throw playersRes.error;

        setMembers(membersRes.data || []);
        setPersistedPlayers(playersRes.data || []);
        
        if (configRes.data && !propDisciplineName) {
          const disc = configRes.data.disciplines.find((d: any) => d.id === disciplineId);
          if (disc) {
            setDisciplineName(disc.name);
            const branch = disc.branches.find((b: any) => b.categories.some((c: any) => c.id === categoryId));
            const cat = branch?.categories.find((c: any) => c.id === categoryId);
            if (cat) setCategoryName(cat.name);
          }
        }
      } catch (err) {
        console.error("Error fetching plantel data:", err);
        setError("No se pudo cargar la lista del plantel.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [disciplineId, categoryId, propDisciplineName, propCategoryName]);

  // Separar y agrupar miembros por rol y categoría
  const { coachingStaffGroups, playersList } = useMemo(() => {
    const staffGroups: Record<string, Member[]> = {};
    const players: (Member & { number: string; position: string })[] = [];

    members.forEach(m => {
      const assignment = m.assignments?.find(a => {
        const aDisc = (a.discipline || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dName = (disciplineName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const aCat = (a.category || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cName = (categoryName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const discMatch = a.discipline_id === disciplineId || aDisc === dName;
        const catMatch = a.category_id === categoryId || a.category === categoryId || aCat === cName;
        
        return discMatch && catMatch;
      });

      if (!assignment) return;

      // Normalizar el rol para la comparación (manejar inglés/español y mayúsculas)
      const role = (assignment.role || '').toUpperCase();
      const isPlayer = role === 'PLAYER' || role === 'JUGADOR';

      if (isPlayer) {
        const savedData = persistedPlayers.find(p => p.dni === m.dni || p.id === m.id);
        players.push({
          ...m,
          number: m.dorsal || savedData?.number || '00',
          position: assignment.position || savedData?.position || '',
        });
      } else {
        // Agrupar técnicos por su rol
        const roleKey = role || 'STAFF';
        if (!staffGroups[roleKey]) staffGroups[roleKey] = [];
        staffGroups[roleKey].push(m);
      }
    });

    // Ordenar técnicos dentro de cada grupo
    Object.keys(staffGroups).forEach(key => {
      staffGroups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return {
      coachingStaffGroups: staffGroups,
      playersList: players.sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [members, persistedPlayers, disciplineId, categoryId, disciplineName, categoryName]);

  // Agrupación de jugadores por posición
  const groupedPlayers = useMemo(() => {
    const groups: Record<string, typeof playersList> = {};

    playersList.forEach(p => {
      const pos = (p.position || 'SIN PUESTO').trim().toUpperCase();
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(p);
    });

    // Ordenar grupos: Poner "SIN PUESTO" al final si existe
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'SIN PUESTO') return 1;
      if (b === 'SIN PUESTO') return -1;
      return a.localeCompare(b);
    });

    const sortedGroups: Record<string, typeof playersList> = {};
    sortedGroupKeys.forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [playersList]);

  const [selectedPlayer, setSelectedPlayer] = useState<Member | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role.toUpperCase()) {
      case 'COACH':
      case 'ENTRENADOR': return 'ENTRENADOR';
      case 'PHYSICAL_TRAINER':
      case 'PREPARADOR FÍSICO':
      case 'PREP. FÍSICO': return 'PREPARADOR FÍSICO';
      case 'MEDICAL':
      case 'MÉDICO': return 'MÉDICO';
      case 'DELEGATE':
      case 'DELEGADO': return 'DELEGADO';
      case 'COORDINATOR':
      case 'COORDINADOR': return 'COORDINADOR';
      case 'ADMIN':
      case 'ADMINISTRADOR': return 'ADMINISTRADOR';
      default: return role.toUpperCase();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-[var(--primary-500)] mb-4" size={40} />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">Cargando plantel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 bg-red-500/10 border border-red-500/20 rounded-[2rem] text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h3 className="text-xl font-black uppercase text-red-500 mb-2">Error</h3>
        <p className="text-[var(--text-muted)] font-bold text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-fade-in">
      {/* CUERPO TÉCNICO */}
      <section>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-500)]/10 flex items-center justify-center text-[var(--primary-500)]">
            <Briefcase size={20} />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-main)] italic">Cuerpo Técnico</h3>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Responsables del Plantel</p>
          </div>
        </div>

        {Object.entries(coachingStaffGroups).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(coachingStaffGroups).map(([role, staffList]) => (
              <div key={role} className="space-y-4">
                <div className="flex items-center gap-2 px-4">
                  <span className="text-[10px] font-black text-[var(--primary-500)] uppercase tracking-[0.2em]">
                    {getRoleDisplayName(role)} ({staffList.length})
                  </span>
                  <div className="flex-1 h-px bg-[var(--primary-500)]/10"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {staffList.map(staff => (
                    <div key={staff.id} className="bg-surface-card hover:bg-surface-hover border border-[var(--surface-border)] rounded-[2.5rem] p-6 flex items-center gap-5 transition-all group">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[var(--surface-border)] shadow-lg shrink-0 flex items-center justify-center bg-surface-ground">
                        {staff.photourl ? (
                          <img 
                            src={staff.photourl} 
                            alt={staff.name}
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xl font-black text-primary-500 italic">{getInitials(staff.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-lg uppercase tracking-tight text-[var(--text-main)] truncate">{staff.name}</h4>
                        <span className="text-[9px] font-black text-[var(--primary-500)] uppercase tracking-widest bg-[var(--primary-soft)] px-3 py-1 rounded-full mt-2 inline-block">
                          {getRoleDisplayName(role)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center bg-surface-ground rounded-[2.5rem] border border-dashed border-[var(--surface-border)]">
            <p className="text-xs font-black text-[var(--text-muted)] opacity-30 uppercase tracking-widest italic">Sin técnico asignado</p>
          </div>
        )}
      </section>

      {/* JUGADORES POR POSICIÓN */}
      {Object.entries(groupedPlayers).map(([position, playersInPos]) => (
        playersInPos.length > 0 && (
          <section key={position}>
            <div className="flex items-center justify-between mb-8 border-b border-[var(--surface-border)] pb-4">
              <h3 className="text-xl font-black uppercase tracking-tighter text-[var(--text-main)] italic flex items-center gap-3">
                <div className="w-1 h-4 bg-[var(--primary-500)] rounded-full"></div>
                {position} <span className="text-[var(--text-muted)] text-sm ml-2">({playersInPos.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {playersInPos.map(player => (
                <div 
                  key={player.id} 
                  onClick={() => setSelectedPlayer(player as any)}
                  className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] p-6 hover:bg-surface-hover transition-all group relative overflow-hidden cursor-pointer"
                >
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-[var(--surface-border)] shadow-xl group-hover:scale-105 transition-transform duration-500 shrink-0 flex items-center justify-center bg-surface-ground">
                      {player.photourl ? (
                        <img 
                          src={player.photourl} 
                          alt={player.name}
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-2xl font-black text-primary-500 italic">{getInitials(player.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[var(--primary-500)] font-black text-xl italic">#{player.number}</span>
                      </div>
                      <h4 className="font-black text-lg uppercase tracking-tight text-[var(--text-main)] leading-tight truncate">{player.name}</h4>
                      <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">{player.position || 'SIN PUESTO'}</p>
                    </div>
                  </div>
                  
                  {/* Decoración de fondo */}
                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
                    <Shield size={120} className="text-[var(--text-main)]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      ))}

      {selectedPlayer && (
        <PlayerLegajoResumido 
          player={selectedPlayer} 
          onClose={() => setSelectedPlayer(null)} 
          onPlayerUpdated={async () => {
             try {
               const membersRes = await db.members.getAll();
               if (!membersRes.error) {
                 setMembers(membersRes.data || []);
               }
             } catch (err) {
               console.error("Error refreshing members in PlantelLista:", err);
             }
          }}
        />
      )}

      {playersList.length === 0 && !isLoading && (
        <div className="py-20 text-center opacity-30 border-4 border-dashed border-[var(--surface-border)] rounded-[4rem]">
          <Users size={64} className="mx-auto mb-6 text-[var(--text-muted)]" />
          <h3 className="font-black uppercase tracking-[0.6em] text-[10px] text-[var(--text-main)]">Sin jugadores en este plantel</h3>
          <p className="text-[9px] font-bold uppercase tracking-widest mt-4 text-[var(--text-muted)]">Asigna miembros a la disciplina {disciplineName} - {categoryName} desde el Legajo Maestro</p>
        </div>
      )}
    </div>
  );
};

export default PlantelLista;
