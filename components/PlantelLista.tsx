
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Player } from '../types';
import { db } from '../lib/supabase';
import { Users, Loader2, AlertCircle, Shield, Briefcase } from 'lucide-react';

interface PlantelListaProps {
  disciplineId: string; 
  categoryId: string;
  disciplineName: string;
  categoryName: string;
  onPlayerClick?: (player: Player) => void;
}

import { useCategory } from '../context/useCategory';

const PlantelLista: React.FC<PlantelListaProps> = ({ 
  disciplineId: propDisciplineId, 
  categoryId: propCategoryId,
  disciplineName: propDisciplineName,
  categoryName: propCategoryName,
  onPlayerClick
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

  // Cuerpo Técnico
  const coachingStaff = useMemo(() => {
    return members.filter(m => 
      m.assignments?.some(a => {
        const aDiscId = a.discipline_id;
        const aCatId = a.category_id;
        return aDiscId === disciplineId && aCatId === categoryId && a.role === 'COACH';
      })
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, disciplineId, categoryId]);

  // Jugadores combinados con su data de posición/dorsal
  const players = useMemo(() => {
    const assignedPlayers = members.filter(m => 
      m.assignments?.some(a => {
        const aDiscId = a.discipline_id;
        const aCatId = a.category_id;
        return aDiscId === disciplineId && aCatId === categoryId && a.role === 'PLAYER';
      })
    );

    return assignedPlayers.map(m => {
      const savedData = persistedPlayers.find(p => p.dni === m.dni || p.id === m.id);
      return {
        ...m,
        number: savedData?.number || '00',
        position: savedData?.position || '',
      };
    });
  }, [members, persistedPlayers, disciplineId, categoryId]);

  // Agrupación por posición
  const groupedPlayers = useMemo(() => {
    const groups: Record<string, typeof players> = {
      'Arqueros': [],
      'Defensores': [],
      'Mediocampistas': [],
      'Delanteros': [],
      'Sin puesto': []
    };

    players.forEach(p => {
      const pos = (p.position || '').trim().toUpperCase();
      
      if (!pos) {
        groups['Sin puesto'].push(p);
      } else if (pos.includes('ARQUERO') || pos.includes('PORTERO') || pos.includes('ARQ')) {
        groups['Arqueros'].push(p);
      } else if (pos.includes('DEF') || pos.includes('ZAGUERO') || pos.includes('LATERAL')) {
        groups['Defensores'].push(p);
      } else if (pos.includes('MED') || pos.includes('VOLANTE') || pos.includes('CENTRO') || pos.includes('VOL')) {
        groups['Mediocampistas'].push(p);
      } else if (pos.includes('DEL') || pos.includes('ATACANTE') || pos.includes('PUNTA')) {
        groups['Delanteros'].push(p);
      } else {
        groups['Sin puesto'].push(p);
      }
    });

    // Orden alfabético por nombre dentro de cada sección
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [players]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary-600 mb-4" size={40} />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Cargando plantel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 bg-red-500/10 border border-red-500/20 rounded-[2rem] text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h3 className="text-xl font-black uppercase text-red-500 mb-2">Error</h3>
        <p className="text-slate-400 font-bold text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-fade-in">
      {/* CUERPO TÉCNICO */}
      <section>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary-600/10 flex items-center justify-center text-primary-600">
            <Briefcase size={20} />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter dark:text-white italic">Cuerpo Técnico</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsables del Plantel</p>
          </div>
        </div>

        {coachingStaff.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {coachingStaff.map(staff => (
              <div key={staff.id} className="bg-primary-600/5 dark:bg-primary-600/10 border border-primary-600/20 rounded-[2.5rem] p-6 flex items-center gap-5 hover:bg-primary-600/15 transition-all group">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary-600/20 shadow-lg shrink-0">
                  <img 
                    src={staff.photoUrl || 'https://via.placeholder.com/150'} 
                    alt={staff.name}
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-white truncate">{staff.name}</h4>
                  <span className="text-[9px] font-black text-primary-600 uppercase tracking-widest bg-primary-600/10 px-3 py-1 rounded-full mt-2 inline-block">ENTRENADOR</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/10">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Sin técnico asignado</p>
          </div>
        )}
      </section>

      {/* JUGADORES POR POSICIÓN */}
      {Object.entries(groupedPlayers).map(([position, playersInPos]) => (
        playersInPos.length > 0 && (
          <section key={position}>
            <div className="flex items-center justify-between mb-8 border-b border-slate-100 dark:border-white/5 pb-4">
              <h3 className="text-xl font-black uppercase tracking-tighter dark:text-white italic flex items-center gap-3">
                <div className="w-1 h-4 bg-primary-600 rounded-full"></div>
                {position} <span className="text-slate-400 text-sm ml-2">({playersInPos.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {playersInPos.map(player => (
                <div 
                  key={player.id} 
                  onClick={() => onPlayerClick?.(player as any)}
                  className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all group relative overflow-hidden cursor-pointer"
                >
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 shadow-xl group-hover:scale-105 transition-transform duration-500 shrink-0">
                      <img 
                        src={player.photoUrl || 'https://via.placeholder.com/150'} 
                        alt={player.name}
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-primary-600 font-black text-xl italic">#{player.number}</span>
                      </div>
                      <h4 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-white leading-tight truncate">{player.name}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{player.position || 'SIN PUESTO'}</p>
                    </div>
                  </div>
                  
                  {/* Decoración de fondo */}
                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
                    <Shield size={120} className="text-slate-900 dark:text-white" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      ))}

      {players.length === 0 && !isLoading && (
        <div className="py-20 text-center opacity-30 border-4 border-dashed border-slate-100 dark:border-white/5 rounded-[4rem]">
          <Users size={64} className="mx-auto mb-6 text-slate-300" />
          <h3 className="font-black uppercase tracking-[0.6em] text-[10px]">Sin jugadores en este plantel</h3>
          <p className="text-[9px] font-bold uppercase tracking-widest mt-4">Asigna miembros con rol JUGADOR a {disciplineName} - {categoryName}</p>
        </div>
      )}
    </div>
  );
};

export default PlantelLista;
