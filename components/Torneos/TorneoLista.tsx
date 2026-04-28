
import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Calendar, ChevronRight, Loader2, Search, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getTournaments } from '../../lib/torneos';
import { Tournament, ClubConfig } from '../../types';
import CrearTorneo from './CrearTorneo';
import TournamentManagement from '../TournamentManagement';
import { db } from '../../lib/supabase';

const TorneoLista: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<{id: string, name: string} | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tData, configRes] = await Promise.all([
        getTournaments(),
        db.config.get()
      ]);
      setTournaments(tData);
      if (configRes.data) setClubConfig(configRes.data);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tournamentToDelete) return;

    setIsDeleting(tournamentToDelete.id);
    try {
      const { error } = await db.tournaments.delete(tournamentToDelete.id);
      if (error) throw error;
      
      setTournaments(prev => prev.filter(t => t.id !== tournamentToDelete.id));
      setTournamentToDelete(null);
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert('Error al eliminar el torneo. Por favor, intenta de nuevo.');
    } finally {
      setIsDeleting(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTournaments = tournaments.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedTournament && clubConfig) {
    return (
      <div className="p-6">
        <button 
          onClick={() => setSelectedTournament(null)}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors uppercase font-black text-[10px] tracking-widest"
        >
          <ChevronRight className="rotate-180" size={16} /> Volver al listado
        </button>
        <TournamentManagement 
          discipline={clubConfig.disciplines.find(d => d.id === (selectedTournament.discipline_id || selectedTournament.disciplineid))!}
          category={null}
          gender={selectedTournament.gender}
          players={[]}
          clubConfig={clubConfig}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic flex items-center gap-4">
             <Trophy size={40} className="text-primary-600" />
             Módulo de Torneos
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-1 ml-1">Gestión de competencias y fixtures</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-primary-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
          >
            <Plus size={18} strokeWidth={3} /> Crear nuevo torneo
          </button>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text"
          placeholder="BUSCAR TORNEO..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:border-primary-600 transition-all"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="animate-spin text-primary-600" size={40} />
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando torneos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map(tournament => (
            <motion.div 
              key={tournament.id}
              whileHover={{ y: -5 }}
              className="bg-slate-800 border border-secondary-500/20 rounded-[2.5rem] p-8 flex flex-col gap-6 group hover:border-primary-600/50 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 bg-primary-600/10 rounded-2xl">
                  <Trophy className="text-primary-600" size={24} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    tournament.status === 'Open' ? 'bg-green-500/10 text-green-500' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {tournament.status === 'Open' ? 'Activo' : 'Finalizado'}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTournamentToDelete({ id: tournament.id, name: tournament.name });
                    }}
                    disabled={isDeleting === tournament.id}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                    title="Eliminar Torneo"
                  >
                    {isDeleting === tournament.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-white group-hover:text-primary-600 transition-colors">
                  {tournament.name}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <Calendar size={12} />
                  {new Date(tournament.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="bg-slate-700/50 text-slate-400 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">
                  {tournament.type === 'Internal' ? 'Interno' : 'Profesional'}
                </span>
                <span className="bg-slate-700/50 text-slate-400 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">
                  {tournament.gender}
                </span>
                <span className="bg-slate-700/50 text-slate-400 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">
                  {(tournament.assigned_categories || tournament.assignedcategories)?.length || 0} Categorías
                </span>
              </div>

              <button 
                onClick={() => setSelectedTournament(tournament)}
                className="mt-auto w-full py-4 bg-slate-700 hover:bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2"
              >
                Ver partidos <ChevronRight size={14} />
              </button>
            </motion.div>
          ))}

          {filteredTournaments.length === 0 && (
            <div className="col-span-full py-40 text-center bg-slate-800/30 rounded-[4rem] border-4 border-dashed border-slate-700 flex flex-col items-center justify-center">
              <Trophy size={60} className="text-slate-700 mb-6" />
              <h3 className="text-2xl font-black uppercase text-slate-500 italic tracking-[0.2em]">No se encontraron torneos</h3>
            </div>
          )}
        </div>
      )}

      {showCreateModal && clubConfig && (
        <CrearTorneo 
          clubConfig={clubConfig}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => loadData()}
        />
      )}

      {tournamentToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-secondary-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-2xl font-black text-white text-center mb-2 uppercase tracking-tight italic">
              Eliminar torneo
            </h3>
            
            <p className="text-slate-400 text-center mb-8 leading-relaxed">
              ¿Estás seguro que deseas eliminar <span className="text-white font-bold">"{tournamentToDelete.name}"</span>? 
              Esta acción eliminará también todos sus partidos asociados y no se puede deshacer.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setTournamentToDelete(null)}
                className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors uppercase text-sm tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={!!isDeleting}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors uppercase text-sm tracking-wider flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TorneoLista;
