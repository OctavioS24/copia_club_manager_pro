
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
    <div className="p-8 space-y-8 animate-fade-in max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="text-5xl font-black text-[var(--text-main)] uppercase tracking-tighter italic flex items-center gap-6">
             <div className="p-4 bg-primary-600/10 rounded-[2rem] border border-primary-600/20 shadow-inner">
               <Trophy size={48} className="text-primary-600" />
             </div>
             Módulo de Campeonatos
          </h2>
          <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.4em] text-[10px] mt-4 ml-2 flex items-center gap-3">
            <span className="w-8 h-[2px] bg-primary-600/30 rounded-full" />
            Gestión Integral de Ligas & Fixtures
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="group relative bg-primary-600 text-white px-12 py-6 rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-primary-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-4 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Plus size={20} strokeWidth={4} className="relative z-10" />
            <span className="relative z-10">Generar Temporada</span>
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text"
            placeholder="REPRESENTAR TORNEO POR NOMBRE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-6 bg-surface-card border-2 border-[var(--surface-border)] rounded-[2.5rem] text-[var(--text-main)] font-black text-xs uppercase tracking-widest outline-none focus:border-primary-500 transition-all shadow-sm placeholder:opacity-20"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-48 gap-6">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-primary-600/20 animate-pulse rounded-full" />
            <Loader2 className="animate-spin text-primary-600 relative" size={56} strokeWidth={3} />
          </div>
          <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.3em] text-[10px] italic opacity-40">Accediendo a la base de datos de torneos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredTournaments.map(tournament => (
            <motion.div 
              key={tournament.id}
              whileHover={{ y: -8, scale: 1.01 }}
              className="bg-surface-card border-2 border-[var(--surface-border)] rounded-[3.5rem] p-10 flex flex-col gap-8 group hover:border-primary-600/30 transition-all shadow-lg hover:shadow-2xl hover:shadow-primary-900/5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex justify-between items-start relative z-10">
                <div className="p-4 bg-surface-ground rounded-3xl border border-[var(--surface-border)] shadow-inner">
                  <Trophy className="text-primary-600" size={28} />
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${
                    tournament.status === 'Open' 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg shadow-emerald-900/5' 
                      : 'bg-surface-ground text-[var(--text-muted)] border-[var(--surface-border)]'
                  }`}>
                    {tournament.status === 'Open' ? 'Transmisión Activa' : 'Ciclo Finalizado'}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTournamentToDelete({ id: tournament.id, name: tournament.name });
                    }}
                    disabled={isDeleting === tournament.id}
                    className="p-3 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all disabled:opacity-50 border border-transparent hover:border-red-500/20 shadow-sm"
                    title="Eliminar Torneo"
                  >
                    {isDeleting === tournament.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </div>

              <div className="relative z-10">
                <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em] mb-2">Competición Oficial</p>
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-[var(--text-main)] group-hover:text-primary-600 transition-colors leading-[0.9]">
                  {tournament.name}
                </h3>
                <div className="flex items-center gap-3 mt-6 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest opacity-60">
                  <Calendar size={14} className="text-primary-500" />
                  Alta: {new Date(tournament.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 relative z-10">
                <span className="bg-surface-ground border border-[var(--surface-border)] text-[var(--text-muted)] px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">
                  {tournament.type === 'Internal' ? 'Copa Interna' : 'Liga Profesional'}
                </span>
                <span className="bg-surface-ground border border-[var(--surface-border)] text-[var(--text-muted)] px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">
                  Rama {tournament.gender}
                </span>
                <span className="bg-primary-600/5 border border-primary-600/20 text-primary-600 px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">
                  {(tournament.assigned_categories || tournament.assignedcategories)?.length || 0} Niveles
                </span>
              </div>

              <button 
                onClick={() => setSelectedTournament(tournament)}
                className="mt-4 w-full py-6 bg-surface-ground hover:bg-primary-600 border border-[var(--surface-border)] hover:border-primary-600 text-[var(--text-muted)] hover:text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-sm hover:shadow-xl hover:shadow-primary-900/20 group/btn"
              >
                Acceder al Gestión <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ))}

          {filteredTournaments.length === 0 && (
            <div className="col-span-full py-64 text-center bg-surface-ground rounded-[5rem] border-4 border-dashed border-[var(--surface-border)] flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary-600/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="w-24 h-24 bg-surface-card rounded-[2.5rem] flex items-center justify-center mb-8 border-2 border-[var(--surface-border)] shadow-2xl relative z-10">
                <Trophy size={48} className="text-[var(--text-muted)] opacity-20" />
              </div>
              <h3 className="text-3xl font-black uppercase text-[var(--text-muted)] italic tracking-[0.3em] opacity-30 relative z-10">Sin Registros en el Módulo</h3>
              <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-widest mt-4 opacity-20 relative z-10">Comience por generar una nueva temporada de campeonatos</p>
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-surface-card border-2 border-red-500/20 rounded-[3rem] p-12 max-w-xl w-full shadow-[0_32px_128px_-32px_rgba(220,38,38,0.3)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
            
            <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-8 mx-auto border border-red-500/20">
              <Trash2 className="w-10 h-10 text-red-500" />
            </div>
            
            <h3 className="text-4xl font-black text-[var(--text-main)] text-center mb-4 uppercase tracking-tighter italic">
              Protocolo de Baja
            </h3>
            
            <p className="text-[var(--text-muted)] text-center mb-12 leading-relaxed font-bold uppercase text-[10px] tracking-[0.2em] opacity-60">
              ¿Confirmar eliminación absoluta de <span className="text-[var(--text-main)] italic underline decoration-red-500 decoration-2 underline-offset-4">"{tournamentToDelete.name}"</span>? 
              <br/><br/>
              Toda la data histórica, fixtures y resultados de este ciclo serán <span className="text-red-500">eliminados irrevocablemente</span> de los servidores centrales.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setTournamentToDelete(null)}
                className="flex-1 px-8 py-5 bg-surface-ground hover:bg-surface-hover text-[var(--text-muted)] rounded-2xl font-black transition-all uppercase text-[11px] tracking-widest border border-[var(--surface-border)]"
              >
                Abortar Operación
              </button>
              <button
                onClick={handleDelete}
                disabled={!!isDeleting}
                className="flex-1 px-8 py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black transition-all uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-red-900/40"
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Confirmar Purga'
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
