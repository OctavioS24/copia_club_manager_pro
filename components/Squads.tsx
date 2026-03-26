
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Player, ClubConfig, Discipline, Category } from '../types';
import { 
  Users, Shield, Star, Search, ChevronRight, ChevronLeft, Settings, Loader2
} from 'lucide-react';
import { db } from '../lib/supabase';

interface SquadsProps {
  clubConfig: ClubConfig;
  onGoToSettings?: () => void;
}

const Squads: React.FC<SquadsProps> = ({ clubConfig, onGoToSettings }) => {
  const [selectedSportId, setSelectedSportId] = useState<string>(clubConfig.disciplines[0]?.id || '');
  const [selectedGender, setSelectedGender] = useState<'Masculino' | 'Femenino'>('Masculino');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeSport = useMemo(() => 
    clubConfig.disciplines.find(s => s.id === selectedSportId), 
  [selectedSportId, clubConfig]);

  const activeBranch = useMemo(() => 
    activeSport?.branches?.find(b => b.gender === selectedGender),
  [activeSport, selectedGender]);

  useEffect(() => {
    if (activeBranch && activeBranch.categories?.length > 0) {
        if (!activeBranch.categories.find(c => c.id === selectedCatId)) {
          setSelectedCatId(activeBranch.categories[0].id);
        }
    } else {
      setSelectedCatId('');
    }
  }, [activeBranch]);

  const fetchPlayers = async () => {
    setIsLoading(true);
    try {
      const { data } = await db.players.getAll();
      if (data) setPlayers(data);
    } catch (error) {
      console.error("Error al cargar planteles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const filteredAthletes = useMemo(() => {
    if (!activeSport) return [];
    
    // Obtenemos el nombre exacto de la categoría seleccionada en el filtro lateral
    const selectedCategoryName = activeBranch?.categories.find(c => c.id === selectedCatId)?.name;

    return players.filter(p => {
        // 1. Filtro por Búsqueda de Texto
        const matchesSearch = searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.dni.includes(searchTerm);
        
        // 2. Filtro por Disciplina (Comparación exacta por nombre normalizado)
        const pDisc = (p.discipline || '').trim().toLowerCase();
        const sDisc = (activeSport.name || '').trim().toLowerCase();
        const matchesSport = pDisc === sDisc;

        // 3. Filtro por Categoría (Comparación exacta por nombre normalizado)
        const pCat = (p.category || '').trim().toLowerCase();
        const sCat = (selectedCategoryName || '').trim().toLowerCase();
        const matchesCategory = !selectedCategoryName || pCat === sCat;
        
        // 4. Filtro por Género (Importante para separar ramas)
        const matchesGender = !p.gender || p.gender.toLowerCase() === selectedGender.toLowerCase();

        return matchesSearch && matchesSport && matchesCategory && matchesGender;
    }).sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0));
  }, [players, activeSport, selectedGender, selectedCatId, searchTerm, activeBranch]);

  if (clubConfig.disciplines.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-10 animate-fade-in py-40">
          <Shield size={64} className="text-slate-200 mb-8" />
          <h2 className="text-3xl font-black uppercase text-center mb-4">No hay disciplinas</h2>
          <button onClick={onGoToSettings} className="bg-primary-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-primary-500/20">Configurar Ahora</button>
        </div>
      );
  }

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-fade-in pb-40">
      <header className="flex flex-col md:flex-row justify-between items-end gap-8 mb-20">
        <div>
          <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none text-slate-900 dark:text-white italic">Planteles</h2>
          <div className="flex items-center gap-4 mt-6">
              <div className="w-16 h-2 bg-primary-600 rounded-full"></div>
              <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">{activeSport?.name} • Rama {selectedGender}</p>
          </div>
        </div>
        <div className="relative w-full md:w-96">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="BUSCAR EN PLANTEL..." 
                className="w-full pl-16 pr-8 py-5 bg-white dark:bg-[#0f1219] rounded-3xl border border-slate-200 dark:border-white/5 outline-none font-black text-xs uppercase tracking-widest shadow-xl focus:border-primary-600/50 transition-all" 
            />
        </div>
      </header>

      <div className="flex gap-12 overflow-x-auto no-scrollbar mb-16 px-4">
        {clubConfig.disciplines.map(sport => (
          <button 
            key={sport.id}
            onClick={() => { setSelectedSportId(sport.id); setSelectedCatId(''); }}
            className={`shrink-0 flex flex-col items-center gap-4 transition-all ${selectedSportId === sport.id ? 'scale-110 opacity-100' : 'opacity-30 grayscale hover:opacity-60'}`}
          >
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center border-4 ${selectedSportId === sport.id ? 'bg-slate-950 border-primary-600 shadow-2xl' : 'bg-slate-100 dark:bg-slate-800 border-transparent'}`}>
              {sport.iconUrl ? <img src={sport.iconUrl} className="w-full h-full object-cover p-1" /> : <Shield size={32} className="text-slate-300" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{sport.name}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
          <aside className="w-full lg:w-80 shrink-0 space-y-8">
              <div className="bg-white dark:bg-[#0f1219] rounded-[3rem] p-8 shadow-2xl border border-slate-200 dark:border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 border-b border-slate-100 dark:border-white/5 pb-4">Filtrar por Rama</h4>
                  <div className="flex flex-col gap-3">
                      {['Masculino', 'Femenino'].map(g => (
                          <button key={g} onClick={() => setSelectedGender(g as any)} className={`flex items-center justify-between p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${selectedGender === g ? 'bg-primary-600 text-white shadow-xl' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                              {g} <ChevronRight size={14} className={selectedGender === g ? 'translate-x-1' : 'opacity-0'} />
                          </button>
                      ))}
                  </div>

                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-12 mb-6 border-b border-slate-100 dark:border-white/5 pb-4">Seleccionar Categoría</h4>
                  <div className="flex flex-col gap-3">
                      {activeBranch?.categories?.map(cat => (
                          <button key={cat.id} onClick={() => setSelectedCatId(cat.id)} className={`flex items-center justify-between p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${selectedCatId === cat.id ? 'bg-slate-950 text-white shadow-xl' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                              {cat.name} <Star size={12} className={selectedCatId === cat.id ? 'fill-primary-500 text-primary-500' : 'opacity-0'} />
                          </button>
                      ))}
                      {(!activeBranch || !activeBranch.categories || activeBranch.categories.length === 0) && (
                          <div className="p-10 text-center opacity-40">
                             <Settings size={20} className="mx-auto mb-2" />
                             <p className="text-[8px] font-black uppercase tracking-widest">Sin categorías</p>
                          </div>
                      )}
                  </div>
              </div>
          </aside>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {isLoading ? (
                  [...Array(6)].map((_, i) => <div key={i} className="h-96 bg-slate-200 dark:bg-white/5 rounded-[4rem] animate-pulse"></div>)
              ) : filteredAthletes.length > 0 ? (
                  filteredAthletes.map(athlete => (
                      <div key={athlete.id} className="bg-white dark:bg-[#0f1219] rounded-[4rem] border border-slate-200 dark:border-white/5 p-10 shadow-xl hover:shadow-3xl transition-all group overflow-hidden relative">
                          <div className="flex flex-col items-center relative z-10">
                              <div className="w-36 h-36 rounded-full border-4 border-slate-50 dark:border-slate-800 p-1.5 mb-8 group-hover:scale-110 transition-transform duration-700 shadow-2xl relative">
                                  <img src={athlete.photoUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover rounded-full" />
                                  <div className="absolute -bottom-2 -right-2 bg-primary-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-black italic text-xl shadow-lg">
                                      {athlete.overallRating || 0}
                                  </div>
                              </div>
                              <h3 className="font-black uppercase tracking-tighter text-3xl text-slate-800 dark:text-white text-center leading-none mb-3 truncate w-full">{athlete.name}</h3>
                              <div className="flex items-center gap-4">
                                 <span className="text-primary-600 font-black text-[9px] uppercase tracking-widest bg-primary-500/10 px-4 py-2 rounded-full">ATLETA</span>
                                 <span className="text-slate-400 font-black text-lg italic">#{athlete.number || '00'}</span>
                              </div>
                          </div>
                      </div>
                  ))
              ) : (
                  <div className="col-span-full py-40 text-center opacity-30 border-4 border-dashed border-slate-100 dark:border-white/5 rounded-[5rem]">
                      <Users size={64} className="mx-auto mb-6 text-slate-300" />
                      <h3 className="font-black uppercase tracking-[0.6em] text-[10px]">Sin atletas en {activeBranch?.categories.find(c => c.id === selectedCatId)?.name || 'esta división'}</h3>
                      <p className="text-[9px] font-bold uppercase tracking-widest mt-4">Asegúrate de asignar el Miembro en "Legajo Maestro" con rol JUGADOR</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Squads;
