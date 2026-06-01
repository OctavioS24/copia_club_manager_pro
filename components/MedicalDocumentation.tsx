import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Trash2, User, Calendar, 
  Loader2, CloudUpload, FileText, ClipboardList, 
  Award, AlertCircle, X, FileDown
} from 'lucide-react';
import { db } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

interface FileAttachment {
  name: string;
  url: string;
}

interface MedicalDoc {
  id: string;
  title: string;
  section: 'procedures' | 'templates' | 'reports';
  attachments: FileAttachment[];
  uploaded_by: string;
  created_at: string;
}

const MedicalDocumentation: React.FC = () => {
  const { user, role } = useAuth();
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'procedures' | 'templates' | 'reports'>('procedures');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // List of documents
  const [documents, setDocuments] = useState<MedicalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Logged-in user's automated name
  const [loggedInName, setLoggedInName] = useState('');
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string }[]>([]);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUploadedBy, setNewUploadedBy] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current user has management permissions
  const hasPermission = role === 'Admin' || role === 'Medico';

  // Fetch documents
  const fetchDocs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await db.medicalDocuments.getAll();
      if (error) throw error;
      setDocuments((data || []) as MedicalDoc[]);
    } catch (err) {
      console.error('Error fetching medical docs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch logged-in professional's name & list of staff for selector
  useEffect(() => {
    const fetchUserDataAndStaff = async () => {
      if (!user?.email) return;

      try {
        // Find corresponding member
        const { data: currentMember } = await db.members.getAll();
        if (currentMember) {
          // Populate staff for selector (only Medico or Admin roles)
          const staff = currentMember
            .filter((m: any) => m.systemrole && (m.systemrole === 'Admin' || m.systemrole === 'Medico'))
            .map((m: any) => ({ id: m.id, name: m.name }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
          setStaffMembers(staff);

          const matched = currentMember.find(
            (m: any) => m.email?.toLowerCase() === user.email?.toLowerCase()
          );
          if (matched) {
            setLoggedInName(matched.name);
            // Default select to matched professional only if they are one of the filtered staff members
            const isStaff = staff.some((s: any) => s.name === matched.name);
            if (isStaff) {
              setNewUploadedBy(matched.name);
            } else {
              setNewUploadedBy('');
            }
          } else {
            // Fallback to empty context
            const nameFromMeta = user.user_metadata?.full_name || '';
            setLoggedInName(nameFromMeta);
            const isStaff = staff.some((s: any) => s.name === nameFromMeta);
            setNewUploadedBy(isStaff ? nameFromMeta : '');
          }
        }
      } catch (err) {
        console.error('Error loading session user name / staff:', err);
      }
    };

    fetchUserDataAndStaff();
    fetchDocs();
  }, [user]);

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle Drag Leave
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  // File selection from input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  // Remove selected file from list before upload
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setUploadError('Por favor ingresa un título/nombre para el documento.');
      return;
    }
    if (selectedFiles.length === 0) {
      setUploadError('Por favor selecciona al menos un archivo adjunto.');
      return;
    }
    if (!newUploadedBy.trim()) {
      setUploadError('Por favor especifica quién carga el documento.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadedAttachments: FileAttachment[] = [];

      // Upload each file to Supabase Storage
      for (const file of selectedFiles) {
        const result = await db.medicalDocuments.uploadDocument(file);
        uploadedAttachments.push(result);
      }

      // Insert document meta in DB
      const { error } = await db.medicalDocuments.insert({
        title: newTitle.trim(),
        section: activeTab,
        attachments: uploadedAttachments,
        uploaded_by: newUploadedBy.trim()
      });

      if (error) throw error;

      // Reset Form & Refresh list
      setNewTitle('');
      setNewUploadedBy(loggedInName || user?.email || '');
      setSelectedFiles([]);
      setShowUploadModal(false);
      await fetchDocs();
    } catch (err: any) {
      console.error('Error during document creation:', err);
      setUploadError(err.message || 'Error al cargar el documento. Por favor intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Deletion
  const handleDeleteDoc = async (id: string, title: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el documento "${title}"?`)) {
      return;
    }

    try {
      const { error } = await db.medicalDocuments.delete(id);
      if (error) throw error;
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('No se pudo eliminar el documento.');
    }
  };

  // Filter documents by tab and search bar
  const displayedDocs = documents.filter(doc => {
    const belongsToTab = doc.section === activeTab;
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    return belongsToTab && matchesSearch;
  });

  // Helper to get descriptive tab name
  const getTabLabel = (tab: typeof activeTab) => {
    switch (tab) {
      case 'procedures': return 'Procedimientos de Trabajo';
      case 'templates': return 'Planillas y Evaluación';
      case 'reports': return 'Informes de Liga y Asociación';
    }
  };

  return (
    <div className="w-full">
      {/* Upper Navigation Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 w-full md:w-auto overflow-x-auto no-scrollbar">
          {(['procedures', 'templates', 'reports'] as const).map(tab => {
            const isActive = activeTab === tab;
            let Icon = FileText;
            if (tab === 'templates') Icon = ClipboardList;
            if (tab === 'reports') Icon = Award;

            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchTerm('');
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-wider transition-all whitespace-nowrap ${isActive ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <Icon size={14} />
                <span>{tab === 'procedures' ? 'Procedimientos' : tab === 'templates' ? 'Planillas' : 'Informes de Liga'}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            setUploadError(null);
            setShowUploadModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg hover:scale-105 active:scale-95 w-full md:w-auto justify-center"
        >
          <Plus size={16} />
          <span>Subir Documento</span>
        </button>
      </div>

      {/* Search Header Inside Section */}
      <div className="bg-white dark:bg-[#0f1219] p-5 md:p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
        <div className="shrink-0 flex items-center gap-3">
          <div className="w-2.5 h-6 bg-primary-600 rounded-full" />
          <div>
            <h3 className="text-sm md:text-base font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none italic">
              {getTabLabel(activeTab)}
            </h3>
            <p className="text-[9px] md:text-xs text-slate-400 uppercase tracking-widest mt-1 opacity-70">
              {displayedDocs.length} {displayedDocs.length === 1 ? 'documento cargado' : 'documentos cargados'}
            </p>
          </div>
        </div>

        <div className="w-full md:w-96 relative">
          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título o palabra clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-white/5 p-4 pl-12 rounded-2xl font-bold text-xs uppercase tracking-wider dark:text-white outline-none border border-transparent focus:border-primary-600/30 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Main Grid View */}
      {isLoading ? (
        <div className="py-40 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Cargando repositorios...</p>
        </div>
      ) : displayedDocs.length === 0 ? (
        <div className="py-24 md:py-40 text-center bg-white dark:bg-white/5 rounded-[2.5rem] border-4 border-dashed border-slate-200 dark:border-white/5">
          <FileText size={48} className="mx-auto mb-6 text-slate-200 dark:text-white/10" />
          <h3 className="text-base md:text-lg font-black uppercase text-slate-400 tracking-widest px-4 leading-relaxed">
            No se encontraron documentos en esta sección
          </h3>
          <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-widest mt-2">
            {searchTerm ? `Ningún archivo coincide con "${searchTerm}"` : 'Comienza subiendo un nuevo archivo regulatorio, modelo u informe.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {displayedDocs.map(doc => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                id={`doc-${doc.id}`}
                className="group bg-white dark:bg-[#0f1219] rounded-3xl p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all text-left flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary-600/10 text-primary-600 rounded-2xl">
                      {doc.section === 'procedures' && <FileText size={20} />}
                      {doc.section === 'templates' && <ClipboardList size={20} />}
                      {doc.section === 'reports' && <Award size={20} />}
                    </div>

                    {hasPermission && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id, doc.title)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        title="Eliminar Documento"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight italic line-clamp-2 leading-snug group-hover:text-primary-600 transition-colors mb-4">
                    {doc.title}
                  </h4>

                  <div className="space-y-2 mb-6 pt-4 border-t border-slate-50 dark:border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <User size={12} className="text-primary-600/80" />
                      <span>Cargado por: </span>
                      <span className="text-slate-800 dark:text-slate-300 italic truncate max-w-[120px]" title={doc.uploaded_by}>
                        {doc.uploaded_by}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <Calendar size={12} className="text-primary-600/80" />
                      <span>Fecha: </span>
                      <span className="text-slate-800 dark:text-slate-300 italic">
                        {new Date(doc.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attachments Area */}
                <div className="space-y-2 mt-auto">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Archivos Adjuntos:</span>
                  <div className="divide-y divide-slate-100 dark:divide-white/5 border border-slate-100 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-white/5 overflow-hidden">
                    {doc.attachments && doc.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="referrer noopener"
                        className="flex items-center justify-between p-3.5 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs text-slate-700 dark:text-slate-300 group/link"
                        title={`Ver o descargar ${file.name}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-slate-400 shrink-0 group-hover/link:text-primary-600" />
                          <span className="font-bold truncate max-w-[150px]">{file.name}</span>
                        </div>
                        <span className="p-1 px-2.5 bg-primary-600/10 text-primary-600 text-[9px] font-black uppercase rounded-lg flex items-center gap-1 group-hover/link:bg-primary-600 group-hover/link:text-white transition-all">
                          <FileDown size={11} /> Descargar
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Upload Document Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#0f1219] w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10"
            >
              <div className="bg-slate-50 dark:bg-white/5 p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <CloudUpload className="text-primary-600" size={24} />
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">
                      Subir Documento
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Subiendo a sección: {getTabLabel(activeTab)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="p-6 md:p-8 space-y-6">
                {uploadError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-2xl flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Document Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Nombre / Título del Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Protocolo ante Conmociones Cerebrales o Evaluación Médica Inicial"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 p-4 rounded-xl font-bold text-xs uppercase tracking-wider dark:text-white outline-none border border-transparent focus:border-primary-600/30 transition-all shadow-inner"
                  />
                </div>

                {/* Who Uploads (Quién lo carga) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Quién lo carga (Responsable) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[8px] font-black text-primary-500 uppercase tracking-widest">
                      Solo Médicos o Administradores
                    </span>
                  </div>

                  <div className="w-full">
                    {staffMembers.length > 0 ? (
                      <div className="relative w-full">
                        <select
                          required
                          value={newUploadedBy}
                          onChange={(e) => setNewUploadedBy(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-white/5 p-4 pr-10 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest dark:text-white outline-none border border-transparent focus:border-primary-600/30 transition-all cursor-pointer shadow-inner appearance-none"
                        >
                          <option value="">Seleccionar del Personal...</option>
                          {staffMembers.map(staff => (
                            <option key={staff.id} value={staff.name} className="dark:bg-slate-900 font-sans font-bold">
                              {staff.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl text-[10px] font-bold uppercase text-slate-400">
                        No hay lista de personal disponible (Médicos o Administradores)
                      </div>
                    )}
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Archivos Adjuntos <span className="text-red-500">*</span>
                  </label>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${isDragging ? 'border-primary-600 bg-primary-600/5' : 'border-slate-200 dark:border-white/10 hover:border-primary-600 dark:hover:border-primary-600/50 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <CloudUpload size={32} className="text-slate-400 mb-2.5" />
                    <span className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wide">
                      {isDragging ? '¡Suelta tus archivos aquí!' : 'Arrastra tus archivos aquí o haz clic para subir'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Soporta PDFs, Imágenes, Excel, etc.
                    </span>
                  </div>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Archivos seleccionados:</span>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 custom-scrollbar">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 text-xs text-slate-700 dark:text-slate-300 font-bold">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[300px]">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Descartar archivo"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit Panel */}
                <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    disabled={isUploading}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black uppercase text-xs tracking-widest rounded-2xl transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg hover:shadow-primary-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <span>Cargar Documento</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MedicalDocumentation;
