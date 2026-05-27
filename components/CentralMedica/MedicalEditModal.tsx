import React, { useState, useEffect } from "react";
import {
  Member,
  MedicalRecord,
  MedicalHistoryItem,
  InjuryType,
  PlayerInjury,
} from "../../types";
import {
  X,
  Save,
  Loader2,
  Calendar,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  History,
  Stethoscope,
  Clock,
  Plus,
  Trash2,
  Paperclip,
  FileText,
  ExternalLink,
  Heart,
  Upload,
} from "lucide-react";
import { db } from "../../lib/supabase";

interface MedicalEditModalProps {
  player: Member;
  onClose: () => void;
  onSave: () => void;
  readOnly?: boolean;
}

// Lista de respaldo con UUIDs consistentes para evitar errores de llave foránea
const FALLBACK_TYPES: InjuryType[] = [
  { id: "550e8400-e29b-41d4-a716-446655440001", name: "Desgarro (S)" },
  { id: "550e8400-e29b-41d4-a716-446655440002", name: "Esguince (S)" },
  { id: "550e8400-e29b-41d4-a716-446655440003", name: "Fractura (S)" },
  { id: "550e8400-e29b-41d4-a716-446655440004", name: "Contusión (S)" },
  { id: "550e8400-e29b-41d4-a716-446655440005", name: "Luxación (S)" },
  { id: "550e8400-e29b-41d4-a716-446655440006", name: "Tendinitis (S)" },
  { id: "550e8400-e29b-41d4-a716-446655440007", name: "Sobrecarga (S)" },
  { id: "550e8400-e29b-41d4-a716-446655440008", name: "Otro (S)" },
];

const getInitials = (name: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

const MedicalEditModal: React.FC<MedicalEditModalProps> = ({
  player,
  onClose,
  onSave,
  readOnly = false,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<
    "ficha" | "enfermeria" | "salud"
  >("ficha");

  // Section 1: Ficha Médica
  const [fichaData, setFichaData] = useState<MedicalRecord>({
    is_fit: player.medical?.is_fit ?? true,
    last_checkup:
      player.medical?.last_checkup ?? new Date().toISOString().split("T")[0],
    expiry_date: player.medical?.expiry_date ?? "",
    notes: player.medical?.notes ?? "",
    emac_date: player.medical?.emac_date ?? "",
    process_number: player.medical?.process_number ?? "",
    history: player.medical?.history ?? [],
  });

  // Section 3: Datos de Salud / Antecedentes
  const [saludData, setSaludData] = useState({
    bloodtype: player.bloodtype ?? "",
    medicalinsurance: player.medicalinsurance ?? "",
    weight: player.weight ?? "",
    height: player.height ?? "",
    has_preexisting_condition: player.has_preexisting_condition ?? false,
    preexisting_condition_details: player.preexisting_condition_details ?? "",
    medical_file_url: player.medical_file_url ?? "",
  });

  const [isUploadingMedicalFile, setIsUploadingMedicalFile] = useState(false);

  const handleMedicalFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedicalFile(true);
    try {
      const publicUrl = await db.medical.uploadAttachment(file);
      setSaludData((prev) => ({ ...prev, medical_file_url: publicUrl }));
    } catch (err: any) {
      console.error("Error al subir archivo médico:", err);
      alert("Error al subir el archivo, reintente.");
    } finally {
      setIsUploadingMedicalFile(false);
    }
  };

  const handleSaveSalud = async () => {
    setIsSaving(true);
    try {
      const updatedPlayer = {
        ...player,
        bloodtype: saludData.bloodtype,
        medicalinsurance: saludData.medicalinsurance,
        weight: saludData.weight,
        height: saludData.height,
        has_preexisting_condition: saludData.has_preexisting_condition,
        preexisting_condition_details: saludData.preexisting_condition_details,
        medical_file_url: saludData.medical_file_url,
      };

      await db.members.upsert(updatedPlayer);
      alert("Datos de Salud guardados correctamente.");
      onSave();
    } catch (err) {
      console.error(err);
      alert("Error al guardar los datos de salud");
    } finally {
      setIsSaving(false);
    }
  };

  // Section 2: Enfermería (Injuries)
  const [injuryTypes, setInjuryTypes] = useState<InjuryType[]>([]);
  const [injuries, setInjuries] = useState<PlayerInjury[]>([]);
  const [isAddingInjury, setIsAddingInjury] = useState(false);
  const [injuryForm, setInjuryForm] = useState<Partial<PlayerInjury>>({
    type_id: FALLBACK_TYPES[0].id,
    injury_date: new Date().toISOString().split("T")[0],
    comment: "",
    estimated_recovery: "",
    release_date: "",
    attachments: [],
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchMedicalData = async () => {
      try {
        const [typesRes, injuriesRes] = await Promise.all([
          db.medical.getInjuryTypes(),
          db.medical.getPlayerInjuries(player.id),
        ]);

        if (typesRes.error) {
          console.error(
            "Error cargando Tipos de Lesión (Usando Fallback):",
            typesRes.error.message,
          );
          setInjuryTypes(FALLBACK_TYPES);
        } else if (typesRes.data && typesRes.data.length > 0) {
          setInjuryTypes(typesRes.data);
        } else {
          console.warn(
            "La tabla injury_types parece vacía o inaccesible (posible RLS). Usando lista por defecto.",
          );
          setInjuryTypes(FALLBACK_TYPES);
          // Intentar inicializar solo si estamos en un entorno donde esperamos poder escribir
          try {
            // Solo intentamos uno para probar permisos
            const { error: initError } = await db.medical.upsertInjuryType(
              FALLBACK_TYPES[0],
            );
            if (initError && initError.code === "42501") {
              console.warn(
                "No hay permisos de escritura para auto-inicializar injury_types.",
              );
            } else if (!initError) {
              // Si funcionó el primero, intentamos el resto
              for (let i = 1; i < FALLBACK_TYPES.length; i++) {
                await db.medical.upsertInjuryType(FALLBACK_TYPES[i]);
              }
            }
          } catch (e) {
            console.error("Error al intentar inicializar tipos:", e);
          }
        }

        if (injuriesRes.error) {
          console.error(
            "Error cargando historial de lesiones:",
            injuriesRes.error.message,
          );
        } else if (injuriesRes.data) {
          setInjuries(injuriesRes.data);
        }
      } catch (err) {
        console.error("Error crítico en fetchMedicalData:", err);
        setInjuryTypes(FALLBACK_TYPES);
      }
    };
    fetchMedicalData();
  }, [player.id]);

  const handleSaveFicha = async () => {
    setIsSaving(true);
    try {
      const newHistoryItem: MedicalHistoryItem = {
        id: crypto.randomUUID(),
        date: fichaData.last_checkup || new Date().toISOString().split("T")[0],
        is_fit: fichaData.is_fit,
        expiry_date: fichaData.expiry_date,
        notes: fichaData.notes,
        emac_date: fichaData.emac_date,
        process_number: fichaData.process_number,
        professional_name: "Staff Médico Club",
      };

      const updatedMedical: MedicalRecord = {
        ...fichaData,
        history: [newHistoryItem, ...(fichaData.history || [])],
      };

      // REGRE DE NEGOCIO: Recalcular estado basado en ficha Y lesiones
      const { data: currentInjuries } = await db.medical.getPlayerInjuries(
        player.id,
      );
      const hasActiveInjuries = currentInjuries?.some(
        (i) => i.injury_date && !i.release_date,
      );

      let newStatus: "Active" | "Injured" | "NotFit" = "Active";
      if (hasActiveInjuries) {
        newStatus = "Injured";
      } else if (!fichaData.is_fit) {
        newStatus = "NotFit";
      } else {
        newStatus = "Active";
      }

      const updatedPlayer = {
        ...player,
        medical: updatedMedical,
        status: newStatus,
      };

      await db.members.upsert(updatedPlayer);
      onSave();
    } catch (e) {
      console.error(e);
      alert("Error al guardar la ficha médica");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddInjury = async () => {
    if (!injuryForm.type_id) {
      alert("Selecciona un tipo de lesión");
      return;
    }
    setIsSaving(true);
    try {
      // 1. Registrar la lesión en la tabla de lesiones
      const injuryToSave = {
        ...injuryForm,
        release_date: injuryForm.release_date || null,
        injury_date:
          injuryForm.injury_date || new Date().toISOString().split("T")[0],
        player_id: player.id,
        id: crypto.randomUUID(),
      };

      const { error: injuryError } =
        await db.medical.upsertInjury(injuryToSave);

      if (injuryError) {
        console.error("Error detailed saving injury:", injuryError);
        // Si es un error de RLS (42501)
        if (injuryError.code === "42501") {
          alert(
            "Error de permisos (RLS): No tienes permisos para guardar lesiones en la base de datos. Por favor, revisa las políticas de Supabase.",
          );
        } else if (injuryError.code === "23503") {
          alert(
            "Error de integridad: El tipo de lesión seleccionado no existe en la base de datos.",
          );
        } else {
          alert(
            "No se pudo guardar la lesión: " +
              (injuryError.message || injuryError.code),
          );
        }
        setIsSaving(false);
        return;
      }

      // 2. Forzar estado local a Injured ya que acabamos de agregar una activa
      const updatedMedical: MedicalRecord = {
        ...fichaData,
        is_fit: fichaData.is_fit, // Mantenemos su estado base de ficha
        history: fichaData.history || [],
      };

      setFichaData(updatedMedical);

      // 3. Persistir el cambio en la tabla de miembros con status 'Injured' (Prioridad 1)
      const updatedPlayer = {
        ...player,
        medical: updatedMedical,
        status: "Injured",
      };

      const { error: playerError } = await db.members.upsert(updatedPlayer);
      if (playerError) {
        console.error("Error updating player status:", playerError);
      }

      // 4. Refrescar lista de lesiones local
      const { data, error: fetchError } = await db.medical.getPlayerInjuries(
        player.id,
      );
      if (fetchError) console.error("Error refreshing injuries:", fetchError);
      if (data) setInjuries(data);

      onSave(); // Notificar al padre
      setIsAddingInjury(false);
      setInjuryForm({
        type_id: "",
        injury_date: new Date().toISOString().split("T")[0],
        comment: "",
        estimated_recovery: "",
        release_date: "",
        attachments: [],
      });
    } catch (e) {
      console.error("Catch block in handleAddInjury:", e);
      alert("Error crítico al registrar la lesión");
    } finally {
      setIsSaving(false);
    }
  };

  const syncPlayerStatusAfterInjuryUpdate = async () => {
    // Recalcular estado basado en todas las lesiones
    const { data: currentInjuries } = await db.medical.getPlayerInjuries(
      player.id,
    );
    const hasActiveInjuries = currentInjuries?.some(
      (i) => i.injury_date && !i.release_date,
    );

    let newStatus: "Active" | "Injured" | "NotFit" = "Active";

    if (hasActiveInjuries) {
      newStatus = "Injured";
    } else if (!fichaData.is_fit) {
      newStatus = "NotFit";
    } else {
      newStatus = "Active";
    }

    const updatedPlayer = {
      ...player,
      medical: fichaData,
      status: newStatus,
    };

    await db.members.upsert(updatedPlayer);
    if (currentInjuries) setInjuries(currentInjuries);
    onSave(); // Notificar al padre
  };

  const handleDeleteHistoryItem = async (itemId: string) => {
    if (!confirm("¿Eliminar este registro del historial médico?")) return;

    setIsSaving(true);
    try {
      const updatedHistory =
        fichaData.history?.filter((item) => item.id !== itemId) || [];
      const updatedMedical: MedicalRecord = {
        ...fichaData,
        history: updatedHistory,
      };

      // Recalcular estado después de borrar del historial por si el estado actual dependía de ese registro
      // Nota: El estado principal del jugador suele depender del registro más reciente o de lesiones activas
      // Aquí simplemente actualizamos el historial y el objeto médico

      const updatedPlayer = {
        ...player,
        medical: updatedMedical,
      };

      await db.members.upsert(updatedPlayer);
      setFichaData(updatedMedical);
      onSave();
    } catch (e) {
      console.error(e);
      alert("Error al eliminar el registro del historial");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [...(injuryForm.attachments || [])];
      for (let i = 0; i < files.length; i++) {
        const url = await db.medical.uploadAttachment(files[i]);
        uploadedUrls.push(url);
      }
      setInjuryForm((prev) => ({ ...prev, attachments: uploadedUrls }));
    } catch (err) {
      console.error("Error uploading files:", err);
      alert(
        "Error al subir los archivos. Asegúrate de tener el bucket 'medical_attachments' configurado.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const inputClasses =
    "w-full p-4 md:p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-widest outline-none border border-transparent dark:border-slate-700 focus:border-primary-600/50 transition-all dark:text-slate-200 shadow-inner";
  const labelClasses =
    "text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 md:mb-3 block";

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[500] flex items-center justify-center p-0 md:p-10 animate-fade-in">
      <div className="bg-white dark:bg-[#0f121a] rounded-none md:rounded-[4rem] shadow-2xl w-full max-w-7xl border border-secondary-600/30 dark:border-secondary-400/20 flex flex-col h-full md:h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 md:px-16 py-6 md:py-10 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 dark:bg-white/5 shrink-0 relative gap-4 sm:gap-8">
          <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 md:gap-8 w-full sm:w-auto">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-[2rem] bg-slate-200 overflow-hidden shadow-2xl border-4 border-white dark:border-slate-700 shrink-0 flex items-center justify-center">
              {player.photourl ? (
                <img
                  src={player.photourl}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl md:text-3xl font-black text-primary-600 italic tracking-tighter">
                  {getInitials(player.name)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl md:text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none italic truncate max-w-[250px] sm:max-w-none">
                {player.name}
              </h3>
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 md:gap-4 mt-3">
                <span className="px-3 md:px-4 py-1 bg-primary-600 text-white text-[8px] md:text-[9px] font-black rounded-full uppercase tracking-[0.15em] md:tracking-[0.2em] shadow-lg shadow-primary-600/20">
                  Ficha Médico-Deportiva
                </span>
                <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] md:tracking-[0.2em]">
                  DNI: {player.dni}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute sm:relative top-6 right-6 sm:top-0 sm:right-0 p-3 md:p-4 bg-white dark:bg-white/5 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-xl"
          >
            <X size={20} md:size={24} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 dark:bg-white/[0.02] px-6 md:px-16 py-3 md:py-4 border-b border-slate-100 dark:border-white/5 flex gap-2 md:gap-4 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab("ficha")}
            className={`px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 shrink-0 ${activeSubTab === "ficha" ? "bg-primary-600 text-white shadow-xl shadow-primary-600/20" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5"}`}
          >
            <ShieldCheck size={16} md:size={18} />{" "}
            <span className="hidden sm:inline">Sección 1:</span> Ficha Médica
          </button>
          <button
            onClick={() => setActiveSubTab("enfermeria")}
            className={`px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 shrink-0 ${activeSubTab === "enfermeria" ? "bg-primary-600 text-white shadow-xl shadow-primary-600/20" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5"}`}
          >
            <Stethoscope size={16} md:size={18} />{" "}
            <span className="hidden sm:inline">Sección 2:</span> Enfermería
          </button>
          <button
            onClick={() => setActiveSubTab("salud")}
            className={`px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 shrink-0 ${activeSubTab === "salud" ? "bg-primary-600 text-white shadow-xl shadow-primary-600/25" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5"}`}
          >
            <Heart size={16} md:size={18} />{" "}
            <span className="hidden sm:inline">Sección 3:</span> Salud /
            Antecedentes
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeSubTab === "ficha" && (
            <div className="p-6 md:p-16 flex flex-col lg:flex-row gap-10 md:gap-16">
              {/* Left Column: Form */}
              <div className="flex-1 space-y-8 md:space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="md:col-span-2 space-y-3 md:space-y-4">
                    <label className={labelClasses}>Estado de Aptitud</label>
                    <div className="grid grid-cols-2 gap-3 md:gap-4 p-1.5 md:p-2 bg-slate-100 dark:bg-white/5 rounded-2xl md:rounded-[2.5rem] border border-secondary-600/20 dark:border-secondary-400/10 shadow-inner">
                      <button
                        disabled={readOnly}
                        onClick={() =>
                          setFichaData({ ...fichaData, is_fit: true })
                        }
                        className={`py-4 md:py-6 rounded-xl md:rounded-3xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] transition-all flex items-center justify-center gap-2 md:gap-3 ${fichaData.is_fit ? "bg-emerald-500 text-white shadow-2xl scale-105" : "text-slate-400 opacity-60 hover:opacity-100"} ${readOnly ? "cursor-default" : ""}`}
                      >
                        <ShieldCheck size={16} md:size={18} /> Apto Médico
                      </button>
                      <button
                        disabled={readOnly}
                        onClick={() =>
                          setFichaData({ ...fichaData, is_fit: false })
                        }
                        className={`py-4 md:py-6 rounded-xl md:rounded-3xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em] transition-all flex items-center justify-center gap-2 md:gap-3 ${!fichaData.is_fit ? "bg-red-500 text-white shadow-2xl scale-105" : "text-slate-400 opacity-60 hover:opacity-100"} ${readOnly ? "cursor-default" : ""}`}
                      >
                        <AlertTriangle size={16} md:size={18} /> No Apto
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className={labelClasses}>Fecha Revisión EMAC</label>
                    <div className="relative group">
                      <Calendar
                        className="absolute left-6 top-1/2 -translate-y-1/2 text-primary-600 transition-transform group-focus-within:scale-110"
                        size={18}
                      />
                      <input
                        type="date"
                        readOnly={readOnly}
                        value={fichaData.emac_date}
                        onChange={(e) =>
                          setFichaData({
                            ...fichaData,
                            emac_date: e.target.value,
                          })
                        }
                        className={inputClasses + " pl-16"}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className={labelClasses}>Fecha Vencimiento</label>
                    <div className="relative group">
                      <Calendar
                        className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500 transition-transform group-focus-within:scale-110"
                        size={18}
                      />
                      <input
                        type="date"
                        readOnly={readOnly}
                        value={fichaData.expiry_date}
                        onChange={(e) =>
                          setFichaData({
                            ...fichaData,
                            expiry_date: e.target.value,
                          })
                        }
                        className={inputClasses + " pl-16"}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <label className={labelClasses}>
                      N° Trámite / Referencia
                    </label>
                    <div className="relative group">
                      <ClipboardList
                        className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary-600"
                        size={18}
                      />
                      <input
                        type="text"
                        readOnly={readOnly}
                        value={fichaData.process_number}
                        onChange={(e) =>
                          setFichaData({
                            ...fichaData,
                            process_number: e.target.value,
                          })
                        }
                        className={inputClasses + " pl-16"}
                        placeholder="ID DE TRÁMITE O CERTIFICADO"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-3 md:space-y-4">
                    <label className={labelClasses}>
                      Observaciones Médicas
                    </label>
                    <textarea
                      rows={4}
                      readOnly={readOnly}
                      value={fichaData.notes}
                      onChange={(e) =>
                        setFichaData({ ...fichaData, notes: e.target.value })
                      }
                      className={
                        inputClasses +
                        " min-h-[120px] md:min-h-[150px] p-6 md:p-8 leading-relaxed resize-none"
                      }
                      placeholder="Hallazgos específicos, contraindicaciones, etc."
                    />
                  </div>
                </div>

                {!readOnly && (
                  <div className="pt-4 md:pt-8">
                    <button
                      onClick={handleSaveFicha}
                      disabled={isSaving}
                      className="w-full py-5 md:py-6 bg-primary-600 text-white rounded-2xl md:rounded-3xl font-black uppercase text-[10px] md:text-[11px] tracking-[0.25em] md:tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      {isSaving ? (
                        <Loader2
                          className="animate-spin"
                          size={18}
                          md:size={20}
                        />
                      ) : (
                        <Save size={18} md:size={20} className="mr-2 inline" />
                      )}
                      Guardar Ficha
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: History */}
              <div className="w-full lg:w-96 space-y-8 md:space-y-10">
                <div className="flex items-center gap-3">
                  <History
                    size={18}
                    md:size={20}
                    className="text-primary-600"
                  />
                  <h4 className="text-[10px] md:text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">
                    Historial
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
                  {fichaData.history && fichaData.history.length > 0 ? (
                    fichaData.history.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-white/[0.03] p-5 md:p-6 rounded-[1.5rem] md:rounded-3xl border border-slate-100 dark:border-white/5 animate-fade-in shadow-sm relative group/history"
                      >
                        <button
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full opacity-0 group-hover/history:opacity-100 transition-all flex items-center justify-center shadow-lg transform hover:scale-110 z-10"
                          title="Eliminar registro"
                        >
                          <Trash2 size={12} />
                        </button>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full">
                            {item.date}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${item.is_fit ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}
                          >
                            {item.is_fit ? "Apto" : "No Apto"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed line-clamp-3 italic">
                          "{item.notes || "Sin observaciones"}"
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center border-4 border-dashed border-slate-100 dark:border-white/5 rounded-[2.5rem] opacity-30">
                      <p className="text-[9px] font-black uppercase tracking-widest">
                        Sin registros previos
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "enfermeria" && (
            <div className="p-6 md:p-16 space-y-10 md:space-y-12">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6 md:gap-8">
                <div className="text-center sm:text-left">
                  <h4 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">
                    Lesiones y Bajas
                  </h4>
                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
                    Control de integridad física
                  </p>
                </div>
                {!isAddingInjury && (
                  <button
                    onClick={() => setIsAddingInjury(true)}
                    className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-slate-950 dark:bg-white/5 rounded-full font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-3 text-white"
                  >
                    <Plus size={16} /> Notificar Lesión
                  </button>
                )}
              </div>

              {isAddingInjury && (
                <div className="bg-slate-50 dark:bg-white/[0.03] p-6 md:p-16 rounded-[2rem] md:rounded-[4rem] border-2 border-secondary-600/30 shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center mb-8 md:mb-12">
                    <h5 className="text-base md:text-lg font-black uppercase tracking-widest text-primary-600 flex items-center gap-3">
                      <Stethoscope size={20} md:size={24} /> Entrada de
                      Enfermería
                    </h5>
                    <button
                      onClick={() => setIsAddingInjury(false)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X size={20} md:size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
                    <div className="space-y-4">
                      <label className={labelClasses}>Tipo de Lesión</label>
                      <select
                        value={injuryForm.type_id}
                        onChange={(e) =>
                          setInjuryForm({
                            ...injuryForm,
                            type_id: e.target.value,
                          })
                        }
                        className={inputClasses}
                      >
                        <option value="">Seleccionar Tipo...</option>
                        {injuryTypes.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className={labelClasses}>Fecha de Lesión</label>
                      <input
                        type="date"
                        value={injuryForm.injury_date}
                        onChange={(e) =>
                          setInjuryForm({
                            ...injuryForm,
                            injury_date: e.target.value,
                          })
                        }
                        className={inputClasses}
                      />
                    </div>
                    <div className="space-y-4">
                      <label className={labelClasses}>
                        Fecha Alta Estimada
                      </label>
                      <input
                        type="date"
                        value={injuryForm.release_date}
                        onChange={(e) =>
                          setInjuryForm({
                            ...injuryForm,
                            release_date: e.target.value,
                          })
                        }
                        className={inputClasses}
                      />
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                      <label className={labelClasses}>
                        Comentario / Diagnóstico
                      </label>
                      <textarea
                        rows={4}
                        value={injuryForm.comment}
                        onChange={(e) =>
                          setInjuryForm({
                            ...injuryForm,
                            comment: e.target.value,
                          })
                        }
                        className={
                          inputClasses + " min-h-[100px] py-4 resize-none"
                        }
                        placeholder="Descripción de la lesión y tratamiento inicial..."
                      />
                    </div>
                    <div className="space-y-4">
                      <label className={labelClasses}>
                        Recuperación Estimada
                      </label>
                      <input
                        type="text"
                        value={injuryForm.estimated_recovery}
                        onChange={(e) =>
                          setInjuryForm({
                            ...injuryForm,
                            estimated_recovery: e.target.value,
                          })
                        }
                        className={inputClasses}
                        placeholder="EJ: 3 SEMANAS"
                      />
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                      <label className={labelClasses}>
                        Documentación Adjunta (Informes, Placas, etc.)
                      </label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-600 transition-all cursor-pointer group bg-white dark:bg-slate-800">
                          {isUploading ? (
                            <Loader2 className="animate-spin text-primary-600" />
                          ) : (
                            <Paperclip className="text-slate-400 group-hover:text-primary-600" />
                          )}
                          <span className="text-[7px] font-black uppercase mt-2 text-slate-400">
                            Subir
                          </span>
                          <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                        {injuryForm.attachments?.map((url, i) => (
                          <div
                            key={i}
                            className="w-24 h-24 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 flex items-center justify-center relative p-2 shadow-inner"
                          >
                            <FileText
                              size={24}
                              className="text-primary-600 opacity-50"
                            />
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-primary-600/10 transition-opacity rounded-2xl"
                            >
                              <ExternalLink
                                size={16}
                                className="text-primary-600"
                              />
                            </a>
                            <button
                              onClick={() =>
                                setInjuryForm((prev) => ({
                                  ...prev,
                                  attachments: prev.attachments?.filter(
                                    (_, idx) => idx !== i,
                                  ),
                                }))
                              }
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center items-center group shadow-lg"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 md:mt-12 flex flex-col sm:flex-row justify-end gap-3 md:gap-6">
                    <button
                      onClick={() => setIsAddingInjury(false)}
                      className="order-2 sm:order-1 px-6 md:px-10 py-4 md:py-5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddInjury}
                      disabled={isSaving}
                      className="order-1 sm:order-2 px-8 md:px-14 py-4 md:py-5 bg-secondary-600 text-white rounded-xl md:rounded-3xl font-black uppercase text-[9px] md:text-[10px] tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2
                          className="animate-spin"
                          size={14}
                          md:size={16}
                        />
                      ) : (
                        <Save size={14} md:size={16} />
                      )}
                      Archivar Lesión
                    </button>
                  </div>
                </div>
              )}

              {/* Injury List */}
              <div className="space-y-6 md:space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardList
                      size={18}
                      md:size={22}
                      className="text-primary-600"
                    />
                    <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-400">
                      Historial de Lesiones
                    </h4>
                  </div>
                  <button
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        const { data, error } =
                          await db.medical.getPlayerInjuries(player.id);
                        if (error)
                          console.error("Error manual refresh:", error);
                        if (data) {
                          console.log(
                            "Lesiones recuperadas para",
                            player.name,
                            data,
                          );
                          setInjuries(data);
                        }
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-400 hover:text-primary-600 transition-all shadow-inner"
                    title="Actualizar Historial"
                  >
                    <History
                      size={16}
                      className={isSaving ? "animate-spin" : ""}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {injuries.length > 0 ? (
                    injuries.map((injury) => (
                      <div
                        key={injury.id}
                        className="bg-white dark:bg-[#0f121a] p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-secondary-600/20 dark:border-secondary-400/10 shadow-xl hover:border-primary-600/30 transition-all flex flex-col group/injury relative"
                      >
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                "¿Estás seguro de eliminar este registro de lesión? Esta acción no se puede deshacer.",
                              )
                            ) {
                              try {
                                await db.medical.deleteInjury(injury.id);
                                await syncPlayerStatusAfterInjuryUpdate();
                              } catch (err) {
                                console.error("Error deleting injury:", err);
                                alert("No se pudo eliminar la lesión");
                              }
                            }
                          }}
                          className="absolute top-4 right-4 md:top-6 md:right-6 p-1.5 md:p-2 bg-red-50 dark:bg-red-500/10 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg md:rounded-xl transition-all shadow-sm z-10"
                          title="Eliminar lesión"
                        >
                          <Trash2 size={14} md:size={16} />
                        </button>

                        <div className="flex items-center gap-4 md:gap-5 mb-6 md:mb-8">
                          <div className="w-12 h-12 md:w-14 md:h-14 bg-red-600/10 rounded-xl md:rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                            <AlertTriangle size={20} md:size={24} />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-black text-lg md:text-xl uppercase tracking-tighter text-slate-800 dark:text-white italic leading-none truncate">
                              {injury.injury_type?.name || "LESION"}
                            </h5>
                            <div className="flex items-center gap-2 md:gap-3 mt-1.5 md:mt-2">
                              <Calendar
                                size={10}
                                md:size={12}
                                className="text-slate-400"
                              />
                              <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                {injury.injury_date}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-white/[0.02] p-4 md:p-6 rounded-xl md:rounded-2xl mb-6 md:mb-8 flex-1">
                          <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                            {injury.comment || "Sin comentarios registrados."}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6 border-t border-slate-50 dark:border-white/5">
                          <div>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                              Recuperación
                            </span>
                            <div className="flex items-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] font-black text-slate-800 dark:text-white">
                              <Clock
                                size={10}
                                md:size={12}
                                className="text-primary-600"
                              />
                              {injury.estimated_recovery || "N/A"}
                            </div>
                          </div>
                          <div>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                              Alta Médica
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={injury.release_date || ""}
                                onChange={async (e) => {
                                  const val = e.target.value || null;
                                  const newInjury = {
                                    ...injury,
                                    release_date: val,
                                  };
                                  await db.medical.upsertInjury(newInjury);
                                  await syncPlayerStatusAfterInjuryUpdate();
                                }}
                                className="text-[10px] font-black bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/10 rounded-lg px-1.5 py-1 outline-none focus:border-emerald-500 transition-colors w-full"
                              />
                            </div>
                          </div>
                        </div>

                        {injury.attachments &&
                          injury.attachments.length > 0 && (
                            <div className="mt-8 flex flex-wrap gap-2">
                              {injury.attachments.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-8 h-8 rounded-lg bg-primary-600/10 flex items-center justify-center text-primary-600 hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                                >
                                  <Paperclip size={14} />
                                </a>
                              ))}
                            </div>
                          )}
                      </div>
                    ))
                  ) : (
                    <div className="md:col-span-2 py-32 text-center border-4 border-dashed border-slate-100 dark:border-white/5 rounded-[4rem] opacity-30">
                      <Stethoscope size={48} className="mx-auto mb-6" />
                      <p className="font-black uppercase tracking-widest text-xs">
                        Sin lesiones registradas anteriormente
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "salud" && (
            <div className="p-6 md:p-16 animate-fade-in max-w-4xl mx-auto space-y-10">
              <div className="flex items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                  <Heart size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-black uppercase text-slate-800 dark:text-white italic tracking-tight">
                    Antecedentes Médicos y Clínicos
                  </h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                    Registrar enfermedades preexistentes, alergias, seguros y
                    adjuntos.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className={labelClasses}>Grupo Sanguíneo</label>
                  <select
                    disabled={readOnly}
                    value={saludData.bloodtype}
                    onChange={(e) =>
                      setSaludData({ ...saludData, bloodtype: e.target.value })
                    }
                    className="w-full p-4 md:p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-widest outline-none border border-transparent dark:border-slate-700 focus:border-primary-600/50 transition-all dark:text-slate-200 shadow-inner"
                  >
                    <option value="">No definido</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className={labelClasses}>
                    Obra Social / Seguro Médico
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={saludData.medicalinsurance}
                    onChange={(e) =>
                      setSaludData({
                        ...saludData,
                        medicalinsurance: e.target.value.toUpperCase(),
                      })
                    }
                    className={inputClasses}
                    placeholder="NOMBRE PREPAGA O SEGURO"
                  />
                </div>

                <div className="space-y-3">
                  <label className={labelClasses}>Peso (kg)</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={saludData.weight}
                    onChange={(e) =>
                      setSaludData({ ...saludData, weight: e.target.value })
                    }
                    className={inputClasses}
                    placeholder="00.0"
                  />
                </div>

                <div className="space-y-3">
                  <label className={labelClasses}>Altura (cm)</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={saludData.height}
                    onChange={(e) =>
                      setSaludData({ ...saludData, height: e.target.value })
                    }
                    className={inputClasses}
                    placeholder="000"
                  />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className={labelClasses}>
                    ¿Posee alguna Enfermedad Preexistente o Alergia?
                  </label>
                  <select
                    disabled={readOnly}
                    value={saludData.has_preexisting_condition ? "Sí" : "No"}
                    onChange={(e) =>
                      setSaludData({
                        ...saludData,
                        has_preexisting_condition: e.target.value === "Sí",
                      })
                    }
                    className="w-full p-4 md:p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-widest outline-none border border-transparent dark:border-slate-700 focus:border-primary-600/50 transition-all dark:text-slate-200 shadow-inner"
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className={labelClasses}>
                    Detalles a considerar (Enfermedades, Alergias, Medicación,
                    etc.)
                  </label>
                  <textarea
                    rows={3}
                    disabled={readOnly}
                    value={saludData.preexisting_condition_details || ""}
                    onChange={(e) =>
                      setSaludData({
                        ...saludData,
                        preexisting_condition_details:
                          e.target.value.toUpperCase(),
                      })
                    }
                    className={
                      inputClasses +
                      " min-h-[100px] h-24 resize-none p-6 leading-relaxed"
                    }
                    placeholder="ALERGIAS O ENFERMEDADES RELEVANTES..."
                  />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className={labelClasses}>
                    Documento Adjunto (Certificados, Estudios, etc.)
                  </label>
                  {saludData.medical_file_url ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <FileText size={18} />
                        <span className="truncate max-w-xs block font-bold">
                          Documento Médico Adjunto
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={saludData.medical_file_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider transition-all inline-flex items-center"
                        >
                          <ExternalLink size={12} className="mr-1" />
                          Ver archivo
                        </a>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() =>
                              setSaludData({
                                ...saludData,
                                medical_file_url: "",
                              })
                            }
                            className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors cursor-pointer"
                            title="Eliminar adjunto"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full">
                      <label
                        className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[var(--surface-border)] rounded-2xl transition-all group ${
                          readOnly
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploadingMedicalFile ? (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500">
                                Subiendo archivo...
                              </p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 mb-2 text-slate-400 group-hover:text-emerald-500" />
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white">
                                Seleccionar Certificado Médico / Estudios (PDF,
                                Imagen)
                              </p>
                              <p className="text-[9px] text-slate-400 mt-1 font-bold">
                                Máximo recomendado: 5MB
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          disabled={isUploadingMedicalFile || readOnly}
                          onChange={handleMedicalFileUpload}
                          accept=".pdf,image/*"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {!readOnly && (
                <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                  <button
                    onClick={handleSaveSalud}
                    disabled={isSaving}
                    className="w-full py-5 md:py-6 bg-primary-600 text-white rounded-2xl md:rounded-3xl font-black uppercase text-[10px] md:text-[11px] tracking-[0.25em] md:tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin mr-2 inline" size={18} />
                    ) : (
                      <Save size={18} className="mr-2 inline" />
                    )}
                    Guardar Datos de Salud
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalEditModal;
