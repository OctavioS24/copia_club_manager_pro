import React, { useState, useEffect } from 'react';
import { X, User, HeartPulse, ShieldCheck, Mail, Phone, MapPin, Droplets, Activity, Ruler, Weight, Users, Star } from 'lucide-react';
import { Member } from '../types';
import { supabase } from '../lib/supabase';

interface PlayerLegajoResumidoProps {
  player: Member;
  onClose: () => void;
}

const PlayerLegajoResumido: React.FC<PlayerLegajoResumidoProps> = ({ player, onClose }) => {
  const [activeTab, setActiveTab] = useState<'ID' | 'SALUD' | 'CONTACTO'>('ID');
  const [titularityCount, setTitularityCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count, error } = await supabase
          .from('match_squad_players')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', player.id)
          .eq('is_starting', true);
        
        if (!error) setTitularityCount(count || 0);
      } catch (err) {
        console.error('Error fetching titularities:', err);
      }
    };
    fetchStats();
  }, [player.id]);

  const tabs = [
    { id: 'ID', label: 'Identidad', icon: User },
    { id: 'SALUD', label: 'Salud', icon: HeartPulse },
    { id: 'CONTACTO', label: 'Contactos', icon: Users },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-surface-card rounded-[3.5rem] border border-[var(--surface-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-400">
        {/* Banner de Perfil */}
        <div className="relative h-48 bg-surface-ground">
          <div className="absolute inset-0 bg-primary-500/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-32 bg-primary-500/10 rounded-full blur-xl" />
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all z-20"
          >
            <X size={20} />
          </button>

          <div className="absolute -bottom-16 left-12 flex items-end gap-6">
            <div className="w-32 h-32 rounded-[2.5rem] bg-surface-card border-4 border-surface-card shadow-2xl overflow-hidden relative group">
              <img 
                src={player.photourl || 'https://via.placeholder.com/150'} 
                alt={player.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="mb-4">
              <h3 className="text-3xl font-black uppercase italic tracking-tighter text-[var(--text-main)] leading-none mb-2">{player.name}</h3>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/5 px-3 py-1 rounded-full border border-primary-500/10 italic">Jugador</span>
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic opacity-50">DNI: {player.dni}</span>
                {titularityCount !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
                    <Star size={10} fill="currentColor" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{titularityCount} TITULARIDADES</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="mt-20 px-10 pb-10 space-y-8">
          {/* Tabs */}
          <div className="flex gap-2 p-1.5 bg-surface-ground rounded-2xl border border-[var(--surface-border)]">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${
                  activeTab === tab.id 
                    ? 'bg-surface-card text-primary-500 shadow-xl shadow-black/5' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[300px]">
            {activeTab === 'ID' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                <InfoCard icon={User} label="Género" value={player.gender} />
                <InfoCard icon={ShieldCheck} label="Fecha de Nacimiento" value={player.birthdate} />
                <InfoCard icon={Mail} label="Email" value={player.email || 'No registrado'} />
                <InfoCard icon={Phone} label="Teléfono" value={player.phone || 'No registrado'} />
                <div className="md:col-span-2">
                  <InfoCard icon={MapPin} label="Dirección Completa" value={`${player.address || ''}, ${player.city || ''} (${player.province || ''})`} />
                </div>
              </div>
            )}

            {activeTab === 'SALUD' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                <InfoCard icon={Droplets} label="Grupo Sanguíneo" value={player.bloodtype || 'No informado'} />
                <InfoCard icon={ShieldCheck} label="Obra Social" value={player.medicalinsurance || 'No registrada'} />
                <InfoCard icon={Weight} label="Peso Actual" value={player.weight ? `${player.weight} kg` : 'Sin datos'} />
                <InfoCard icon={Ruler} label="Altura" value={player.height ? `${player.height} cm` : 'Sin datos'} />
                <div className="md:col-span-2 p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4">
                  <Activity className="text-emerald-500" size={24} />
                  <div>
                    <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 italic">Estado de Salud</h5>
                    <p className="text-xs font-bold text-[var(--text-muted)] italic leading-relaxed">Información médica básica para uso institucional rápido en caso de emergencias.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'CONTACTO' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                {player.tutor ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InfoCard icon={User} label="Responsable" value={player.tutor.name} />
                      <InfoCard icon={ShieldCheck} label="Relación" value={player.tutor.relationship} />
                      <InfoCard icon={Phone} label="Teléfono Tutor" value={player.tutor.phone} />
                      <InfoCard icon={Mail} label="Email Tutor" value={player.tutor.email || 'No registrado'} />
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center opacity-30 italic">
                    <Users size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Sin contactos de emergencia registrados</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-10 py-8 bg-surface-ground border-t border-[var(--surface-border)] flex justify-end">
           <button 
            onClick={onClose}
            className="px-8 py-3 bg-[var(--text-main)] text-surface-card rounded-2xl font-black uppercase italic tracking-widest text-[10px] hover:translate-y-[-1px] transition-all"
          >
            Cerrar Legajo
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
  <div className="p-5 rounded-3xl bg-surface-ground border border-[var(--surface-border)] flex items-center gap-4 hover:border-primary-500/30 transition-all group">
    <div className="w-10 h-10 rounded-xl bg-surface-card flex items-center justify-center text-[var(--text-muted)] group-hover:text-primary-500 transition-colors shadow-sm">
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest truncate">{label}</p>
      <p className="text-xs md:text-sm font-black text-[var(--text-main)] italic truncate">{value}</p>
    </div>
  </div>
);

export default PlayerLegajoResumido;
