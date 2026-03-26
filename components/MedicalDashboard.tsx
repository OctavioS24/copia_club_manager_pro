
import React, { useState } from 'react';
import { Player, MedicalRecord, MedicalHistoryItem } from '../types';
import { 
  Activity, AlertTriangle, CheckCircle, Search, Calendar, FileText, 
  Plus, X, Save, Trash2, Edit2, Loader2, Heart, ShieldCheck, 
  ClipboardList, History, Clock, ChevronRight, UserCircle
} from 'lucide-react';
import { db } from '../lib/supabase';

interface MedicalDashboardProps {
  players: Player[];
  onRefresh?: () => void;
}

const MedicalDashboard: React.FC<MedicalDashboardProps> = ({ players, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'injured' | 'expired'>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para la nueva evaluación que se está cargando
  const [formData, setFormData] = useState<MedicalRecord>({
    isFit: true,
    lastCheckup: new Date().toISOString().split('T')[0],
    expiryDate: '',
    notes: '',
    history: []
  });

  const handleEditClick = (player: Player) => {
    setSelectedPlayer(player);
    const existingMedical = player.medical || { isFit: true, lastCheckup: '', expiryDate: '', notes: '', history: [] };
    
    setFormData({
      ...existingMedical,
      // Al abrir para editar, preparamos los campos para una "Nueva Evaluación"
      // pero mantenemos el historial existente
      lastCheckup: new Date().toISOString().split('T')[0],
      notes: '',
      history: existingMedical.history || []
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedPlayer) return;
    setIsSaving(true);
    try {
      // Creamos el nuevo item del historial
      const newHistoryItem: MedicalHistoryItem = {
        id: crypto.randomUUID(),
        date: formData.lastCheckup || new Date().toISOString().split('T')[0],
        isFit: formData.isFit,
        expiryDate: formData.expiryDate,
        notes: formData.notes,
        professionalName: 'Staff Médico Club' // Podría ser dinámico en el futuro
      };

      // Actualizamos el objeto médico completo
      const updatedMedical: MedicalRecord = {
        isFit: formData.isFit,
        lastCheckup: formData.lastCheckup,
        expiryDate: formData.expiryDate,
        notes: formData.notes,
        history: [newHistoryItem, ...(formData.history || [])]
      };

      const updatedPlayer = { ...selectedPlayer, medical: updatedMedical };
      if (formData.isFit) updatedPlayer.status = 'Active';
      else updatedPlayer.status = 'Injured';
      
      await db.players.upsert(updatedPlayer);
      if (onRefresh) onRefresh();
      setShowModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const injuredPlayers = players.filter(p => !p.medical?.isFit || p.status === 'Injured');
  const expiredPlayers = players.filter(p => {
      if (!p.medical?.expiryDate) return false;
      return new Date(p.medical.expiryDate) < new Date();
  });

  const displayPlayers = filter === 'injured' ? injuredPlayers : filter === 'expired' ? expiredPlayers : players;

  const inputClasses = "w-full p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl font-bold text-sm outline-none border border-transparent dark:border-slate-700 focus:border-primary-600/50 transition-all dark:text-slate-200 shadow-inner";
  const labelClasses = "text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block";

  return (
    <div className="p-4 md:p-10 h-full overflow-y-auto custom-scrollbar">
      <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
           <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Central Médica</h2>
           <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Control de Salud e Integridad Física</p>
        </div>
        
        <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5">
            <button onClick={() => setFilter('all')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-md scale-105' : 'text-slate-400'}`}>Todos</button>
            <button onClick={() => setFilter('injured')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'injured' ? 'bg-white dark:bg-slate-700 text-red-500 shadow-md scale-105' : 'text-slate-400'}`}>No Aptos</button>
            <button onClick={() => setFilter('expired')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === 'expired' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-md scale-105' : 'text-slate-400'}`}>Vencidos</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bajas Médicas</span>
              <p className="text-5xl font-black text-red-600 italic mt-1">{injuredPlayers.length}</p>
            </div>
            <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <AlertTriangle size={28} />
            </div>
         </div>
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aptos Vencidos</span>
              <p className="text-5xl font-black text-orange-600 italic mt-1">{expiredPlayers.length}</p>
            </div>
            <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
              <Calendar size={28} />
            </div>
         </div>
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between group">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atletas Listos</span>
              <p className="text-5xl font-black text-emerald-600 italic mt-1">{players.length - injuredPlayers.length}</p>
            </div>
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <CheckCircle size={28} />
            </div>
         </div>
      </div>

      <div className="bg-white dark:bg-[#0f1219] rounded-[3.5rem] shadow-xl border border-slate-200 dark:border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-400 font-black uppercase tracking-widest text-[9px] border-b border-slate-100 dark:border-white/5">
                <th className="p-8">Atleta / Identidad</th>
                <th className="p-8">División</th>
                <th className="p-8">Estatus Médico</th>
                <th className="p-8">Vencimiento</th>
                <th className="p-8 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {displayPlayers.map(player => (
                <tr key={player.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-8">
                     <div className="flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner shrink-0">
                          <img src={player.photoUrl || 'https://via.placeholder.com/64'} className="w-full h-full object-cover" />
                       </div>
                       <div>
                          <span className="font-black text-slate-800 dark:text-white uppercase text-sm tracking-tighter block">{player.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {player.dni}</span>
                       </div>
                     </div>
                  </td>
                  <td className="p-8">
                     <div className="flex flex-col">
                        <span className="font-black text-[9px] uppercase text-primary-600 tracking-widest">{player.discipline}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{player.category}</span>
                     </div>
                  </td>
                  <td className="p-8">
                    {player.medical?.isFit ? (
                       <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Apto Competición</span>
                       </div>
                    ) : (
                       <div className="flex items-center gap-2 text-red-600">
                          <Activity size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Baja Médica</span>
                       </div>
                    )}
                  </td>
                  <td className="p-8">
                     <div className="flex items-center gap-3 text-[11px] font-black text-slate-500 italic">
                        <Calendar size={14} className="text-primary-600" />
                        {player.medical?.expiryDate || 'N/A'}
                     </div>
                  </td>
                  <td className="p-8 text-right">
                      <button onClick={() => handleEditClick(player)} className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm border border-transparent dark:border-white/5">
                          <Edit2 size={16} />
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedPlayer && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[500] flex items-center justify-center p-0 md:p-10 animate-fade-in">
            <div className="bg-white dark:bg-[#0f121a] rounded-none md:rounded-[3.5rem] shadow-2xl w-full max-w-6xl border border-slate-200 dark:border-white/5 flex flex-col h-full md:h-[90vh] overflow-hidden">
                
                {/* Header Modal */}
                <div className="px-8 md:px-12 py-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[1.5rem] overflow-hidden bg-slate-200 shadow-2xl border-4 border-white dark:border-slate-700">
                            <img src={selectedPlayer.photoUrl} className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none italic">{selectedPlayer.name}</h3>
                            <div className="flex items-center gap-3 mt-2">
                               <span className="px-3 py-1 bg-primary-600/10 text-primary-600 text-[8px] font-black rounded-full uppercase tracking-widest">Ficha Clínica Digital</span>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DNI: {selectedPlayer.dni}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setShowModal(false)} className="p-3 bg-white dark:bg-slate-700/50 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm"><X size={20} /></button>
                </div>

                {/* Body Modal Split View */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    
                    {/* Left: Historial Timeline */}
                    <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-100 dark:border-white/5 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                        <div className="flex items-center gap-3 mb-10">
                            <History size={20} className="text-primary-600" />
                            <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Historial de Evaluaciones</h4>
                        </div>

                        {formData.history && formData.history.length > 0 ? (
                          <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                            {formData.history.map((item, idx) => (
                              <div key={item.id} className="relative pl-12 animate-fade-in-up">
                                {/* Dot Indicator */}
                                <div className={`absolute left-2.5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm z-10 ${item.isFit ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                                   <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 italic">
                                         <Clock size={12} /> {item.date}
                                      </div>
                                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${item.isFit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                         {item.isFit ? 'Apto' : 'Baja'}
                                      </span>
                                   </div>
                                   <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-4">
                                      {item.notes || 'Sin observaciones registradas.'}
                                   </p>
                                   <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-50 dark:border-white/5 pt-3">
                                      <UserCircle size={10} /> {item.professionalName}
                                      <span className="mx-2">•</span>
                                      Vto: {item.expiryDate || 'N/A'}
                                   </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-20 text-center opacity-30 flex flex-col items-center">
                             <ClipboardList size={40} className="mb-4" />
                             <p className="text-[9px] font-black uppercase tracking-widest">Sin registros históricos previos</p>
                          </div>
                        )}
                    </div>

                    {/* Right: New Entry Form */}
                    <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-3 mb-10">
                            <Plus size={20} className="text-emerald-500" />
                            <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Nueva Evaluación Médica</h4>
                        </div>

                        <div className="space-y-10">
                            {/* Estado de Aptitud */}
                            <div className="space-y-4">
                                <label className={labelClasses}>Dictamen de Aptitud Actual</label>
                                <div className="grid grid-cols-2 gap-4 p-2 bg-slate-100 dark:bg-slate-800/60 rounded-[2rem] border border-slate-200 dark:border-white/5">
                                    <button 
                                      onClick={() => setFormData({...formData, isFit: true})} 
                                      className={`flex items-center justify-center gap-3 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${formData.isFit ? 'bg-emerald-500 text-white shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-white/5'}`}
                                    >
                                      <ShieldCheck size={16} /> Apto Competencia
                                    </button>
                                    <button 
                                      onClick={() => setFormData({...formData, isFit: false})} 
                                      className={`flex items-center justify-center gap-3 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${!formData.isFit ? 'bg-red-500 text-white shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-white/5'}`}
                                    >
                                      <AlertTriangle size={16} /> Baja Médica
                                    </button>
                                </div>
                            </div>

                            {/* Fechas */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className={labelClasses}>Fecha de Evaluación</label>
                                    <div className="relative group">
                                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600 group-focus-within:scale-110 transition-transform" size={18} />
                                      <input 
                                        type="date" 
                                        value={formData.lastCheckup} 
                                        onChange={e => setFormData({...formData, lastCheckup: e.target.value})} 
                                        className={inputClasses + " pl-12"} 
                                      />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClasses}>Vencimiento Sugerido</label>
                                    <div className="relative group">
                                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 group-focus-within:scale-110 transition-transform" size={18} />
                                      <input 
                                        type="date" 
                                        value={formData.expiryDate} 
                                        onChange={e => setFormData({...formData, expiryDate: e.target.value})} 
                                        className={inputClasses + " pl-12"} 
                                      />
                                    </div>
                                </div>
                            </div>

                            {/* Notas y Diagnóstico */}
                            <div className="space-y-4">
                                <label className={labelClasses}>Diagnóstico / Observaciones Clínicas</label>
                                <div className="relative group">
                                  <ClipboardList className="absolute left-4 top-5 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                                  <textarea 
                                    rows={6} 
                                    value={formData.notes} 
                                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                                    className={inputClasses + " pl-12 pt-4 min-h-[180px] resize-none leading-relaxed text-sm"} 
                                    placeholder="Describir lesión, hallazgos clínicos o tratamiento sugerido..." 
                                  />
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic text-right px-4">Este informe quedará archivado permanentemente en el historial.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Modal */}
                <div className="px-8 md:px-12 py-8 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row justify-end items-center gap-4 bg-slate-50 dark:bg-slate-800/40 shrink-0">
                    <button 
                      onClick={() => setShowModal(false)}
                      className="w-full md:w-auto px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cerrar sin Guardar
                    </button>
                    <button 
                      onClick={handleSave} 
                      disabled={isSaving} 
                      className="w-full md:w-auto flex items-center justify-center gap-4 bg-slate-950 dark:bg-primary-600 text-white px-14 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Archivar Evaluación Médico
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MedicalDashboard;
