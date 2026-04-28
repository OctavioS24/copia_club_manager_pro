
import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Search, Loader2, Shield, Calendar, ChevronRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tournament, ClubConfig } from '../../types';
import { getTournaments } from '../../lib/torneos';
import { useNavigate } from 'react-router-dom';
import CrearTorneoModal from './CrearTorneoModal';
import { db } from '../../lib/supabase';

const TorneosPrincipal: React.FC = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<{id: string, name: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(null);

  useEffect(() => {
    fetchData();
    fetchClubConfig();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const tData = await getTournaments();
      setTournaments(tData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClubConfig = async () => {
    const { data } = await db.config.get();
    if (data) setClubConfig(data);
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

  const filteredTournaments = tournaments.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary-500" />
            MÓDULO DE TORNEOS
          </h1>
          <p className="text-slate-400 mt-1">Gestión de competencias y fixtures para todas las categorías</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-900/20"
        >
          <Plus className="w-5 h-5" />
          CREAR NUEVO TORNEO
        </button>
      </div>

      {/* Search and Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="BUSCAR TORNEO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Tournaments List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
                <p className="font-medium">Cargando torneos...</p>
              </div>
            ) : filteredTournaments.length > 0 ? (
              filteredTournaments.map((tournament) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:border-primary-500/30 transition-all group"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-white group-hover:text-primary-400 transition-colors">
                          {tournament.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs font-bold rounded uppercase tracking-wider">
                          {tournament.type}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(tournament.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4" />
                          {tournament.assigned_categories?.length || 0} CATEGORÍAS
                        </span>
                        <span className="text-primary-500/80 font-medium uppercase tracking-tight">
                          {tournament.gender || 'MASCULINO'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-center">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full text-xs font-bold border border-green-500/20">
                        <Trophy className="w-3.5 h-3.5" />
                        ACTIVO
                      </div>
                      <button 
                        onClick={() => navigate(`/torneos/${tournament.id}/partidos`)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-colors"
                      >
                        VER PARTIDOS
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setTournamentToDelete({ id: tournament.id, name: tournament.name })}
                        disabled={isDeleting === tournament.id}
                        className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all disabled:opacity-50"
                        title="Eliminar Torneo"
                      >
                        {isDeleting === tournament.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
                <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">No se encontraron torneos</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-600/20 to-primary-800/20 border border-primary-500/20 rounded-3xl p-6">
            <h3 className="text-white font-bold mb-2">Estadísticas Rápidas</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-slate-900/40 rounded-2xl p-3 border border-white/5">
                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Torneos Totales</p>
                <p className="text-2xl font-black text-white">{tournaments.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <CrearTorneoModal 
            key="crear-torneo-modal"
            onClose={() => setShowCreateModal(false)} 
            onSuccess={() => {
              setShowCreateModal(false);
              fetchData();
            }}
            clubName={clubConfig?.name || 'Mi Club'}
          />
        )}
        
        {tournamentToDelete && (
          <div key="delete-confirmation-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
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
      </AnimatePresence>
    </div>
  );
};

export default TorneosPrincipal;
