
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
          <h1 className="text-3xl font-bold text-[var(--text-main)] flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary-500" />
            MÓDULO DE TORNEOS
          </h1>
          <p className="text-[var(--text-muted)] mt-1 font-bold uppercase tracking-widest text-[10px]">Gestión de competencias y fixtures para todas las categorías</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 md:px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black uppercase text-[10px] md:text-xs transition-all shadow-lg shadow-primary-900/20"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden md:inline">CREAR NUEVO TORNEO</span>
        </button>
      </div>

      {/* Search and Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="BUSCAR TORNEO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-surface-card border border-[var(--surface-border)] rounded-2xl text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-bold text-xs uppercase tracking-widest"
            />
          </div>

          {/* Tournaments List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
                <p className="font-black text-xs uppercase tracking-widest">Cargando torneos...</p>
              </div>
            ) : filteredTournaments.length > 0 ? (
              filteredTournaments.map((tournament) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-card border border-[var(--surface-border)] rounded-3xl p-6 hover:border-primary-500/30 transition-all group shadow-sm"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic group-hover:text-primary-400 transition-colors">
                          {tournament.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-surface-ground text-[var(--text-muted)] text-[9px] font-black rounded uppercase tracking-wider border border-[var(--surface-border)]">
                          {tournament.type}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        <span className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-primary-500" />
                          {new Date(tournament.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-primary-500" />
                          {tournament.assigned_categories?.length || 0} CATEGORÍAS
                        </span>
                        <span className="text-primary-500">
                          {tournament.gender || 'MASCULINO'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-center">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                        <Trophy className="w-3 h-3" />
                        ACTIVO
                      </div>
                      <button 
                        onClick={() => navigate(`/torneos/${tournament.id}/partidos`)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-surface-ground hover:bg-surface-hover text-[var(--text-main)] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-[var(--surface-border)]"
                      >
                        <span className="hidden sm:inline">VER PARTIDOS</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setTournamentToDelete({ id: tournament.id, name: tournament.name })}
                        disabled={isDeleting === tournament.id}
                        className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all disabled:opacity-50"
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
              <div className="text-center py-20 bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
                <Trophy className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
                <p className="text-[var(--text-muted)] font-black uppercase tracking-widest text-xs italic">No se encontraron torneos registrados</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-600/10 to-primary-800/5 border border-primary-500/20 rounded-[2.5rem] p-8">
            <h3 className="text-[var(--text-main)] font-black uppercase tracking-tighter text-xl italic mb-6">Métricas de Control</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-surface-card rounded-2xl p-5 border border-[var(--surface-border)] shadow-sm">
                <p className="text-[var(--text-muted)] text-[9px] uppercase font-black tracking-[0.2em] mb-2">Torneos Vigentes</p>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-[var(--text-main)] italic leading-none">{tournaments.length}</p>
                  <Trophy className="text-primary-500/30" size={32} />
                </div>
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
          <div key="delete-confirmation-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-ground/90 backdrop-blur-xl animate-in fade-in duration-200">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8 mx-auto">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              
              <h3 className="text-3xl font-black text-[var(--text-main)] text-center mb-4 uppercase tracking-tighter italic">
                Confirmar Baja
              </h3>
              
              <p className="text-[var(--text-muted)] text-center mb-10 leading-relaxed font-bold text-sm uppercase tracking-tight">
                ¿Deseas eliminar permanentemente el torneo <span className="text-[var(--text-main)] underline">"{tournamentToDelete.name}"</span>? 
                Esta acción es irreversible y afectará a todo el historial de partidos.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setTournamentToDelete(null)}
                  className="flex-1 px-6 py-4 bg-surface-ground hover:bg-surface-hover text-[var(--text-main)] rounded-2xl font-black transition-all uppercase text-[10px] tracking-[0.2em] border border-[var(--surface-border)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!!isDeleting}
                  className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black transition-all uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
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
