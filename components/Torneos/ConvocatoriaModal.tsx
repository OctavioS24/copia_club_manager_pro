import React, { useState, useEffect } from 'react';
import { 
  Users, Star, Check, X, Loader2, Info, MapPin, 
  ChevronRight, ChevronLeft, FileText, Shield, 
  Activity, Zap, Search, AlertTriangle, CheckCircle2,
  Calendar, CheckSquare, Square, MessageCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { Match, Member, MatchSquadPlayer } from '../../types';
import { getMatchSquad, saveMatchSquad } from '../../lib/squads';
import { db, supabase } from '../../lib/supabase';
import { getInitials, getInitialsSvg } from '../../lib/playerUtils';
import { generateConvocatoriaPdfBlob } from '../../lib/pdfGenerator';

interface ConvocatoriaModalProps {
  match: Match;
  players: Member[];
  onClose: () => void;
  onSuccess: () => void;
  onOpenResultModal?: (match: Match) => void;
  discipline?: string;
}

const ConvocatoriaModal: React.FC<ConvocatoriaModalProps> = ({ 
  match, 
  players, 
  onClose, 
  onSuccess,
  onOpenResultModal,
  discipline = 'FUTBOL' 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [playerDebts, setPlayerDebts] = useState<Set<string>>(new Set());
  const [activeCommitments, setActiveCommitments] = useState<Set<string>>(new Set());
  const [clubInfo, setClubInfo] = useState<{ name: string; logo_url: string } | null>(null);
  const [rivalLogo, setRivalLogo] = useState<string>('');
  
  // Weekly attendance metric per player
  const [weeklyAttendance, setWeeklyAttendance] = useState<Record<string, { attended: number; total: number; percentage: number }>>({});
  const [totalWeekPractices, setTotalWeekPractices] = useState<number>(0);
  
  // Filter and search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  // Step navigation: 'convocatoria' (paso 1) or 'titulares' (paso 2)
  const [actionStep, setActionStep] = useState<'convocatoria' | 'titulares'>('convocatoria');
  const [hasExistingSquad, setHasExistingSquad] = useState<boolean>(false);
  const [hasConfirmedLineup, setHasConfirmedLineup] = useState<boolean>(false);
  const [justConfirmedLineup, setJustConfirmedLineup] = useState<boolean>(false);

  // State for selected players and starters
  const [selection, setSelection] = useState<Record<string, { selected: boolean, starting: boolean }>>({});
  const [notes, setNotes] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [location, setLocation] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [mobileLineupTab, setMobileLineupTab] = useState<'titulares' | 'suplentes'>('titulares');

  const matchId = match.id;
  const matchHome = match.hometeam;
  const matchAway = match.awayteam;
  const matchDate = match.date;
  const matchLoc = (match as any).location || '';
  const matchAddr = (match as any).address || '';

  useEffect(() => {
    const loadSquadAndDebts = async () => {
      setIsLoading(true);
      try {
        // Cargar convocatoria existente
        const existingSquad = await getMatchSquad(matchId);
        
        // Cargar club config
        const { data: configData } = await db.config.get();
        if (configData) {
          setClubInfo({
            name: configData.name || 'Club Manager Pro',
            logo_url: configData.logo_url || ''
          });
        }

        // Cargar rival para obtener la ubicación por defecto y logo del rival
        const { data: rivalsData } = await supabase.from('rivals').select('*');
        const matchRival = rivalsData?.find(r => r.name === matchHome || r.name === matchAway);
        const defaultLocation = matchRival?.address_url || matchLoc || matchAddr || (match as any).venue || '';
        if (matchRival && matchRival.logo_url) {
          setRivalLogo(matchRival.logo_url);
        }

        // Cargar morosos
        const { data: debts } = await db.fees.getAllDebts();
        if (debts) {
          setPlayerDebts(new Set(debts.map(d => d.member_id)));
        }

        // Cargar compromisos de pago activos
        const { data: commitments } = await supabase
          .from('payment_commitments')
          .select('member_id')
          .eq('fulfilled', false);
        if (commitments) {
          setActiveCommitments(new Set(commitments.map(c => c.member_id)));
        }

        // Cargar asistencias de la última semana antes del partido
        const matchDateStr = matchDate ? matchDate.split('T')[0] : new Date().toISOString().split('T')[0];
        const targetDate = new Date(matchDateStr + 'T00:00:00');
        const weekAgo = new Date(targetDate);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const startDateStr = weekAgo.toISOString().split('T')[0];

        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .gte('date', startDateStr)
          .lte('date', matchDateStr);

        const playerIds = new Set(players.map(p => p.id));
        const relevantAtt = attData?.filter(a => playerIds.has(a.player_id)) || [];
        const uniqueDates = Array.from(new Set(relevantAtt.map(a => a.date)));
        const totalPractices = uniqueDates.length;
        setTotalWeekPractices(totalPractices);

        const statsMap: Record<string, { attended: number; total: number; percentage: number }> = {};
        players.forEach(p => {
          const pRecords = relevantAtt.filter(a => a.player_id === p.id);
          const attended = pRecords.filter(a => a.status === 'P' || a.status === 'L').length;
          const total = totalPractices;
          const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
          statsMap[p.id] = { attended, total, percentage };
        });
        setWeeklyAttendance(statsMap);
        
        const initialSelection: Record<string, { selected: boolean, starting: boolean }> = {};
        
        // Default: If no squad exists, all provided players are pre-selected but not starting
        players.forEach(p => {
          initialSelection[p.id] = { selected: !existingSquad, starting: false };
        });

        if (existingSquad) {
          setHasExistingSquad(true);
          setNotes(existingSquad.notes || '');
          setAppointmentTime(existingSquad.appointment_time || '');
          setLocation(existingSquad.location || defaultLocation);
          let startersCount = 0;
          existingSquad.players?.forEach(sp => {
            if (initialSelection[sp.player_id]) {
              initialSelection[sp.player_id] = { selected: true, starting: sp.is_starting };
              if (sp.is_starting) startersCount++;
            }
          });

          if (startersCount > 0) {
            setHasConfirmedLineup(true);
          }

          // Si ya hay convocatoria guardada, abrimos directamente en Paso 2 "Definir Equipo"
          setActionStep('titulares');
        } else {
          setHasExistingSquad(false);
          setHasConfirmedLineup(false);
          setActionStep('convocatoria');
          setLocation(defaultLocation);
        }

        setSelection(initialSelection);
      } catch (error) {
        console.error('Error loading squad:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSquadAndDebts();
  }, [matchId, matchHome, matchAway, matchDate, matchLoc, matchAddr, players]);

  const toggleSelected = (playerId: string) => {
    setSelection(prev => {
      const current = prev[playerId] || { selected: false, starting: false };
      // If we unselect, it cannot be starting either
      return {
        ...prev,
        [playerId]: { 
          selected: !current.selected, 
          starting: false 
        }
      };
    });
  };

  const toggleStarting = (playerId: string) => {
    setSelection(prev => {
      const current = prev[playerId] || { selected: false, starting: false };
      if (!current.selected) return prev; // Cannot be starting if not selected
      
      // Verify starting player limit of 11
      if (!current.starting) {
        const currentStartersCount = Object.values(prev).filter(s => s.selected && s.starting).length;
        if (currentStartersCount >= 11) {
          alert('Solo puedes elegir un máximo de 11 titulares para la alineación inicial.');
          return prev;
        }
      }
      
      return {
        ...prev,
        [playerId]: { ...current, starting: !current.starting }
      };
    });
  };

  const handleFinalize = async (openStatsAfter: boolean = false) => {
    setIsSaving(true);
    try {
      const playersToSave: Partial<MatchSquadPlayer>[] = Object.entries(selection)
        .filter(([, data]) => data.selected)
        .map(([playerId, data]) => ({
          player_id: playerId,
          is_starting: data.starting,
          minutes_played: data.starting ? 90 : 0
        }));

      await saveMatchSquad(
        {
          match_id: match.id,
          tournament_id: match.tournamentid || (match as any).tournament_id || match.tournament_id,
          category_id: match.categoryid || (match as any).category_id,
          discipline: discipline,
          notes: notes,
          appointment_time: appointmentTime || null,
          location: location || null
        },
        playersToSave
      );
      
      const starters = Object.values(selection).filter(s => s.selected && s.starting).length;
      setHasExistingSquad(true);
      setHasConfirmedLineup(starters > 0);
      setJustConfirmedLineup(true);

      if (openStatsAfter && onOpenResultModal) {
        onSuccess();
        onOpenResultModal(match);
      } else {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving lineup:', error);
      alert('Error al guardar la alineación de titulares.');
    } finally {
      setIsSaving(false);
    }
  };

  const startersCount = Object.values(selection).filter(s => s.starting).length;
  const summonedCount = Object.values(selection).filter(s => s.selected).length;
  const isFormValid = 
    appointmentTime.trim() !== '' && 
    location.trim() !== '' && 
    summonedCount >= 1;

  // Guardar convocatoria y avanzar a Definir Equipo
  const handleSaveAndAdvance = async () => {
    setIsSaving(true);
    try {
      const playersToSave: Partial<MatchSquadPlayer>[] = Object.entries(selection)
        .filter(([, data]) => data.selected)
        .map(([playerId, data]) => ({
          player_id: playerId,
          is_starting: data.starting,
          minutes_played: data.starting ? 90 : 0 // Default starting to full match
        }));

      await saveMatchSquad(
        {
          match_id: match.id,
          tournament_id: match.tournamentid || (match as any).tournament_id || match.tournament_id,
          category_id: match.categoryid || (match as any).category_id,
          discipline: discipline,
          notes: notes,
          appointment_time: appointmentTime || null,
          location: location || null
        },
        playersToSave
      );
      
      setHasExistingSquad(true);
      setActionStep('titulares');
    } catch (error) {
      console.error('Error saving squad:', error);
      alert('Error al guardar la convocatoria');
    } finally {
      setIsSaving(false);
    }
  };

  // Guardar convocatoria y salir (para cuando el DT no define el equipo en el momento)
  const handleSaveAndExit = async () => {
    setIsSaving(true);
    try {
      const playersToSave: Partial<MatchSquadPlayer>[] = Object.entries(selection)
        .filter(([, data]) => data.selected)
        .map(([playerId, data]) => ({
          player_id: playerId,
          is_starting: data.starting,
          minutes_played: data.starting ? 90 : 0
        }));

      await saveMatchSquad(
        {
          match_id: match.id,
          tournament_id: match.tournamentid || (match as any).tournament_id || match.tournament_id,
          category_id: match.categoryid || (match as any).category_id,
          discipline: discipline,
          notes: notes,
          appointment_time: appointmentTime || null,
          location: location || null
        },
        playersToSave
      );
      
      onSuccess();
    } catch (error) {
      console.error('Error saving squad:', error);
      alert('Error al guardar la convocatoria');
    } finally {
      setIsSaving(false);
    }
  };

  // Función para compartir por WhatsApp adjuntando el archivo PDF directamente sin texto encima
  const handleShareWhatsApp = async () => {
    setIsGeneratingPdf(true);
    try {
      const selectedPlayers = players.filter(p => selection[p.id]?.selected);
      const startersMap: Record<string, boolean> = {};
      selectedPlayers.forEach(p => {
        startersMap[p.id] = !!selection[p.id]?.starting;
      });

      // Generar el archivo binario PDF real de alta calidad
      const { blob, file, filename } = await generateConvocatoriaPdfBlob({
        match,
        clubInfo,
        rivalLogo,
        discipline,
        appointmentTime,
        location: location || (match as any).location || (match as any).address || '',
        notes,
        selectedPlayers,
        startersMap
      });

      // Compartir únicamente el archivo PDF
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Convocatoria - ${match.hometeam} vs ${match.awayteam}`,
            files: [file]
          });
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            return;
          }
          console.warn('Fallo en Web Share con archivos, aplicando descarga fallback:', shareErr);
        }
      }

      // Fallback para navegadores de escritorio: descarga directa del PDF y acceso a WhatsApp Web
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      window.open('https://web.whatsapp.com/', '_blank');

    } catch (error) {
      console.error('Error al generar PDF y compartir por WhatsApp:', error);
      alert('Hubo un inconveniente al generar el archivo PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const selectedPlayers = players.filter(p => selection[p.id]?.selected);
      const startersMap: Record<string, boolean> = {};
      selectedPlayers.forEach(p => {
        startersMap[p.id] = !!selection[p.id]?.starting;
      });

      const { blob, filename } = await generateConvocatoriaPdfBlob({
        match,
        clubInfo,
        rivalLogo,
        discipline,
        appointmentTime,
        location: location || (match as any).location || (match as any).address || '',
        notes,
        selectedPlayers,
        startersMap
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      alert('Hubo un error al generar el archivo PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Helper: Categorización táctica de puesto
  const getPlayerPositionCategory = (p: Member): { key: string; label: string; shortLabel: string; order: number } => {
    const matchCategoryId = match.category_id || (match as any).categoryid;
    const assignment = p.assignments?.find((a: any) => {
      const catMatch = matchCategoryId && (a.category_id === matchCategoryId || a.categoryId === matchCategoryId);
      const discNameMatch = discipline && a.discipline?.toUpperCase() === discipline.toUpperCase();
      return catMatch || discNameMatch;
    });
    
    const posStr = (assignment?.position || p.frequent_position || (p as any).position || '').toUpperCase().trim();
    
    if (posStr.includes('ARQ') || posStr.includes('PORTERO') || posStr.includes('GOALKEEPER') || posStr === 'GK' || posStr === 'PO') {
      return { key: 'arqueros', label: 'Arqueros / Porteros', shortLabel: 'Arqueros', order: 1 };
    }
    if (posStr.includes('DEF') || posStr.includes('LATERAL') || posStr.includes('CENTRAL') || posStr.includes('ZAGUERO') || posStr.includes('LIBERO') || posStr.includes('LÍBERO') || posStr === 'DF' || posStr === 'CB' || posStr === 'LB' || posStr === 'RB') {
      return { key: 'defensores', label: 'Defensores', shortLabel: 'Defensores', order: 2 };
    }
    if (posStr.includes('MED') || posStr.includes('VOLANTE') || posStr.includes('VOL') || posStr.includes('CENTRO') || posStr.includes('ENGANCHE') || posStr.includes('CINCO') || posStr.includes('PIVOTE') || posStr.includes('INTERIOR') || posStr === 'MC' || posStr === 'MF' || posStr === 'CM' || posStr === 'DM' || posStr === 'AM' || posStr === 'MED') {
      return { key: 'mediocampistas', label: 'Mediocampistas / Volantes', shortLabel: 'Mediocampistas', order: 3 };
    }
    if (posStr.includes('DEL') || posStr.includes('DELANTERO') || posStr.includes('EXTREMO') || posStr.includes('PUNTA') || posStr.includes('CENTRODELANTERO') || posStr.includes('ATACANTE') || posStr === 'DL' || posStr === 'FW' || posStr === 'ST' || posStr === 'CF' || posStr === 'RW' || posStr === 'LW') {
      return { key: 'delanteros', label: 'Delanteros / Atacantes', shortLabel: 'Delanteros', order: 4 };
    }
    return { key: 'otros', label: 'Sin Puesto / Polifuncionales', shortLabel: 'Otros', order: 5 };
  };

  const getPlayerSpecificRole = (p: Member): string => {
    const matchCategoryId = match.category_id || (match as any).categoryid;
    const assignment = p.assignments?.find((a: any) => {
      const catMatch = matchCategoryId && (a.category_id === matchCategoryId || a.categoryId === matchCategoryId);
      const discNameMatch = discipline && a.discipline?.toUpperCase() === discipline.toUpperCase();
      return catMatch || discNameMatch;
    });
    return assignment?.position || p.frequent_position || (p as any).position || 'Sin puesto';
  };

  const getPlayerDorsal = (p: Member): string => {
    const matchCategoryId = match.category_id || (match as any).categoryid;
    const assignment = p.assignments?.find((a: any) => {
      const catMatch = matchCategoryId && (a.category_id === matchCategoryId || a.categoryId === matchCategoryId);
      const discNameMatch = discipline && a.discipline?.toUpperCase() === discipline.toUpperCase();
      return catMatch || discNameMatch;
    });
    return assignment?.dorsal || p.dorsal || '';
  };

  // Posición definitions con estilos
  const positionGroupsConfig = [
    { key: 'arqueros', label: 'Arqueros / Porteros', shortLabel: 'Arqueros', icon: Shield, colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { key: 'defensores', label: 'Defensores', shortLabel: 'Defensores', icon: Shield, colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    { key: 'mediocampistas', label: 'Mediocampistas / Volantes', shortLabel: 'Mediocampistas', icon: Activity, colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { key: 'delanteros', label: 'Delanteros / Atacantes', shortLabel: 'Delanteros', icon: Zap, colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
    { key: 'otros', label: 'Sin Puesto / Polifuncionales', shortLabel: 'Otros', icon: Users, colorClass: 'text-purple-500 bg-purple-500/10 border-purple-500/20' }
  ];

  // Helper para selección grupal rápida
  const handleSelectGroup = (groupPlayers: Member[], selectState: boolean) => {
    setSelection(prev => {
      const next = { ...prev };
      groupPlayers.forEach(p => {
        next[p.id] = {
          selected: selectState,
          starting: selectState ? (prev[p.id]?.starting || false) : false
        };
      });
      return next;
    });
  };

  // Helper para seleccionar / deseleccionar todos los jugadores filtrados
  const handleSelectAll = (selectState: boolean) => {
    setSelection(prev => {
      const next = { ...prev };
      players.forEach(p => {
        next[p.id] = {
          selected: selectState,
          starting: selectState ? (prev[p.id]?.starting || false) : false
        };
      });
      return next;
    });
  };

  // Convocados array for Step 2
  const summonedPlayers = players.filter(p => selection[p.id]?.selected);
  const startingLineup = summonedPlayers.filter(p => selection[p.id]?.starting).sort((a, b) => a.name.localeCompare(b.name));
  const substitutesLineup = summonedPlayers.filter(p => !selection[p.id]?.starting).sort((a, b) => a.name.localeCompare(b.name));

  // Filtrado de jugadores
  const filteredPlayers = players.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      const nameMatch = p.name.toLowerCase().includes(term);
      const dniMatch = p.dni?.toLowerCase().includes(term);
      const roleMatch = getPlayerSpecificRole(p).toLowerCase().includes(term);
      if (!nameMatch && !dniMatch && !roleMatch) return false;
    }

    if (positionFilter !== 'ALL') {
      const cat = getPlayerPositionCategory(p);
      if (cat.key !== positionFilter) return false;
    }

    return true;
  });

  // Agrupamiento y ordenamiento descendente por asistencias
  const groupedPlayers = positionGroupsConfig.map(group => {
    const inGroup = filteredPlayers.filter(p => getPlayerPositionCategory(p).key === group.key);
    
    // Ordenar de forma descendente por presentismo (asistencias), luego por nombre
    const sorted = [...inGroup].sort((a, b) => {
      const statsA = weeklyAttendance[a.id] || { attended: 0, total: 0, percentage: 0 };
      const statsB = weeklyAttendance[b.id] || { attended: 0, total: 0, percentage: 0 };
      
      // Mayor número de asistencias primero
      if (statsB.attended !== statsA.attended) {
        return statsB.attended - statsA.attended;
      }
      // Si empatan en cantidad, mayor porcentaje
      if (statsB.percentage !== statsA.percentage) {
        return statsB.percentage - statsA.percentage;
      }
      // Si empatan, orden alfabético
      return a.name.localeCompare(b.name);
    });

    const selectedCount = sorted.filter(p => selection[p.id]?.selected).length;
    const avgAttendance = sorted.length > 0
      ? Math.round(sorted.reduce((acc, p) => acc + (weeklyAttendance[p.id]?.percentage || 0), 0) / sorted.length)
      : 0;

    return {
      ...group,
      players: sorted,
      selectedCount,
      totalCount: sorted.length,
      avgAttendance
    };
  });

  const renderPlayerSelectCard = (player: Member) => {
    const selData = selection[player.id] || { selected: false, starting: false };
    const hasDebt = playerDebts.has(player.id) && !activeCommitments.has(player.id);
    const hasCommitment = activeCommitments.has(player.id);
    const specificRole = getPlayerSpecificRole(player);
    const dorsal = getPlayerDorsal(player);
    const attStats = weeklyAttendance[player.id] || { attended: 0, total: totalWeekPractices, percentage: 0 };

    return (
      <div 
        key={player.id}
        className={`p-4 md:p-5 rounded-[2rem] border-2 transition-all flex items-center justify-between gap-3 group cursor-pointer select-none ${
          selData.selected 
            ? 'border-primary-600 bg-primary-600/5 shadow-md shadow-primary-900/5' 
            : 'border-[var(--surface-border)] bg-surface-card hover:border-[var(--surface-border-hover)] hover:shadow-sm'
        }`}
        onClick={() => toggleSelected(player.id)}
      >
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* Avatar / Foto */}
          <div className="relative shrink-0">
            {player.photourl ? (
              <img 
                referrerPolicy="no-referrer"
                src={player.photourl}
                alt={player.name}
                className={`w-12 h-12 rounded-2xl object-cover border-2 transition-all ${selData.selected ? 'border-primary-500 shadow-md' : 'border-[var(--surface-border)] opacity-75 group-hover:opacity-100'}`}
              />
            ) : (
              <div className={`w-12 h-12 rounded-2xl border-2 transition-all flex items-center justify-center font-black text-xs uppercase ${selData.selected ? 'border-primary-500 bg-primary-500/10 text-primary-500 shadow-md' : 'border-[var(--surface-border)] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-75'}`}>
                {getInitials(player.name)}
              </div>
            )}
            {selData.selected && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-surface-card shadow-lg animate-fade-in">
                <Check size={10} className="text-white" strokeWidth={4} />
              </div>
            )}
          </div>

          {/* Información y Badges del Jugador */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-xs font-black uppercase italic tracking-tight truncate ${selData.selected ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'}`}>
                {player.name}
              </p>
              {dorsal && (
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] border border-[var(--surface-border)] uppercase">
                  #{dorsal}
                </span>
              )}
            </div>

            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
              {specificRole}
            </p>

            {/* Badges de Presentismo Semanal y Estado Financiero */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {/* Métrica de Presentismo Semanal */}
              {totalWeekPractices > 0 ? (
                <div 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                    attStats.attended === totalWeekPractices 
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' 
                      : attStats.attended > 0
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/25'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/25'
                  }`}
                  title={`${attStats.attended} de ${totalWeekPractices} prácticas asistidas en la última semana (${attStats.percentage}%)`}
                >
                  <Activity size={10} className="shrink-0" />
                  <span>{attStats.attended}/{totalWeekPractices} asistencias</span>
                  <span className="opacity-75 text-[8px]">({attStats.percentage}%)</span>
                </div>
              ) : (
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border bg-slate-500/10 text-slate-400 border-slate-500/20"
                  title="No se registraron prácticas en la semana previa"
                >
                  <Calendar size={10} className="shrink-0 opacity-60" />
                  <span>0/0 prácticas</span>
                </div>
              )}

              {/* Badge de Estado Financiero */}
              {hasDebt ? (
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/25 animate-pulse"
                  title="Jugador con cuotas pendientes vencidas"
                >
                  <AlertTriangle size={10} className="shrink-0" />
                  <span>Cuota pendiente</span>
                </div>
              ) : hasCommitment ? (
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/25"
                  title="Jugador con compromiso de pago activo"
                >
                  <CheckCircle2 size={10} className="shrink-0" />
                  <span>Compromiso de pago</span>
                </div>
              ) : (
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/25"
                  title="Jugador al día con sus cuotas"
                >
                  <CheckCircle2 size={10} className="shrink-0" />
                  <span>Cuota al día</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Checkbox de Selección */}
        <div className="shrink-0">
          <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${selData.selected ? 'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-600/30' : 'border-[var(--surface-border)] text-transparent group-hover:border-primary-500/40'}`}>
            <Check size={14} strokeWidth={4} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-surface-ground/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-card border border-[var(--surface-border)] rounded-3xl sm:rounded-[2.5rem] w-full max-w-5xl h-[94vh] sm:h-auto sm:max-h-[92vh] overflow-hidden flex flex-col shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 md:p-8 border-b border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-primary-600/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-primary-600/20 shadow-inner shrink-0">
              <Users className="text-primary-600" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-none truncate">Planilla de Convocados</h2>
              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1 truncate">
                {match.hometeam} vs {match.awayteam} • {new Date(match.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={actionStep === 'titulares' ? onSuccess : onClose} className="p-2 sm:p-3 text-[var(--text-muted)] hover:text-red-500 hover:bg-surface-hover rounded-xl transition-all shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Wizard progress steps indicator */}
        <div className="px-4 sm:px-8 py-2.5 sm:py-3 bg-surface-ground border-b border-[var(--surface-border)] flex items-center justify-center gap-2 sm:gap-5 shrink-0 select-none overflow-x-auto">
          <button 
            onClick={() => setActionStep('convocatoria')}
            className={`flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-colors shrink-0 ${actionStep === 'convocatoria' ? 'text-primary-600' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${actionStep === 'convocatoria' ? 'bg-primary-600 text-white' : hasExistingSquad ? 'bg-emerald-500 text-white' : 'bg-surface-card border border-[var(--surface-border)] text-[var(--text-muted)]'}`}>
              {hasExistingSquad && actionStep !== 'convocatoria' ? <Check size={10} strokeWidth={3} /> : '1'}
            </div>
            <span className="truncate">1. Armar Convocatoria</span>
          </button>
          
          <div className="h-0.5 w-6 sm:w-12 bg-[var(--surface-border)] shrink-0" />
          
          <button 
            disabled={!hasExistingSquad && summonedCount === 0}
            onClick={() => {
              if (hasExistingSquad || isFormValid) {
                setActionStep('titulares');
              }
            }}
            className={`flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-colors shrink-0 ${
              actionStep === 'titulares' 
                ? 'text-primary-600' 
                : hasExistingSquad 
                  ? 'text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer' 
                  : 'text-[var(--text-muted)] opacity-50 cursor-not-allowed'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${actionStep === 'titulares' ? 'bg-primary-600 text-white' : hasConfirmedLineup ? 'bg-emerald-500 text-white' : 'bg-surface-card border border-[var(--surface-border)] text-[var(--text-muted)]'}`}>
              {hasConfirmedLineup ? <Check size={10} strokeWidth={3} /> : '2'}
            </div>
            <span className="truncate">2. Definir Equipo Titular</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 custom-scrollbar pb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-primary-600" size={36} />
              <p className="text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest opacity-40 italic">Cargando plantel...</p>
            </div>
          ) : actionStep === 'convocatoria' ? (
            /* ================= STEP 1: SELECT SQUAD PLAYERS & INPUT DETAILS ================= */
            <div className="space-y-6">
              {/* Campos de la Convocatoria en Paso 1 */}
              <div className="bg-surface-card border-[2px] sm:border-[3px] border-primary-600/20 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-3 mb-1">
                  <span className="flex h-2 w-2 rounded-full bg-primary-600 animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase text-primary-600 tracking-widest italic">Detalles de la Convocatoria</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Columna Izquierda: Hora y Ubicación */}
                  <div className="space-y-4">
                    {/* Hora de Citación */}
                    <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] hover:border-primary-500/30 transition-all">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="citation-time-field" className="text-[9px] font-black text-primary-500 uppercase tracking-widest block italic">
                          Hora de Citación *
                        </label>
                        <span className="text-[8px] bg-primary-500/10 text-primary-500 font-black px-2 py-0.5 rounded-full uppercase">Estricto</span>
                      </div>
                      <input
                        id="citation-time-field"
                        type="time"
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        className="w-full bg-surface-card border border-[var(--surface-border)] focus:border-primary-600 rounded-xl px-4 py-2.5 text-xs font-black uppercase text-[var(--text-main)] outline-none transition-all"
                        required
                      />
                    </div>

                    {/* Ubicación del Partido */}
                    <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] hover:border-emerald-500/30 transition-all">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="location-field" className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block italic">
                          Ubicación del Partido *
                        </label>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-500 font-black px-2 py-0.5 rounded-full uppercase">Cancha o Sede</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          id="location-field"
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Dirección, cancha o enlace de Google Maps"
                          className="flex-1 min-w-0 bg-surface-card border border-[var(--surface-border)] focus:border-emerald-600 rounded-xl px-3 sm:px-4 py-2.5 text-xs font-bold text-[var(--text-main)] outline-none transition-all truncate"
                          required
                        />
                        {location && (
                          <a
                            href={location.startsWith('http://') || location.startsWith('https://') ? location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 sm:p-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-xl border border-emerald-500/20 flex items-center justify-center transition-all cursor-pointer shrink-0"
                            title="Abrir ubicación en Google Maps"
                          >
                            <MapPin size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: Apuntes Tácticos */}
                  <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] flex flex-col justify-between">
                    <div className="mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="notes-field" className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block italic">
                          Apuntes Tácticos & Observaciones (Opcional)
                        </label>
                        <span className="text-[8px] bg-slate-500/10 text-slate-500 font-black px-2 py-0.5 rounded-full uppercase">Opcional</span>
                      </div>
                      <p className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-2">Instrucciones de indumentaria, juego, vestuario o directivas del cuerpo técnico.</p>
                    </div>
                    <textarea 
                      id="notes-field"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Escribe las directivas tácticas u observaciones aquí..."
                      className="w-full bg-surface-card border border-[var(--surface-border)] rounded-xl p-3 text-[var(--text-main)] font-semibold text-xs outline-none focus:border-slate-500 transition-all min-h-[90px] sm:min-h-[110px] resize-none flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Estadísticas Rápidas de Convocatoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-2">
                <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Efectivos Convocados</p>
                    <span className="text-xl font-black italic text-[var(--text-main)]">
                      {summonedCount} / <span className="opacity-40">{players.length}</span>
                    </span>
                  </div>
                  <div className="p-3 bg-primary-600/10 text-primary-600 rounded-xl">
                    <Users size={18} />
                  </div>
                </div>

                <div className="bg-surface-ground rounded-2xl p-4 border border-[var(--surface-border)] flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Titulares actuales</p>
                    <span className={`text-xl font-black italic ${startersCount === 11 ? 'text-emerald-500' : 'text-[var(--text-main)]'}`}>
                      {startersCount} <span className="text-xs font-normal text-[var(--text-muted)]">titulares</span>
                    </span>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Star size={18} fill={startersCount > 0 ? 'currentColor' : 'none'} />
                  </div>
                </div>
              </div>

              {/* Barra de Filtro, Búsqueda y Acciones Rápidas */}
              <div className="bg-surface-ground border border-[var(--surface-border)] rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Buscador de jugadores */}
                  <div className="relative w-full sm:w-80">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por nombre, DNI o puesto..."
                      className="w-full pl-9 pr-8 py-2 bg-surface-card border border-[var(--surface-border)] focus:border-primary-500 rounded-xl text-xs font-bold text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] placeholder:font-normal transition-all"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Botones de acción masiva */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <button 
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-primary-600/10 hover:bg-primary-600/20 text-primary-600 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-primary-600/20"
                    >
                      <CheckSquare size={12} />
                      <span>Convocar a Todos</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="flex-1 sm:flex-initial px-3 py-2 bg-slate-500/10 hover:bg-slate-500/20 text-[var(--text-muted)] rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-[var(--surface-border)]"
                    >
                      <Square size={12} />
                      <span>Deseleccionar</span>
                    </button>
                  </div>
                </div>

                {/* Tabs de Filtro por Puesto */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => setPositionFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                      positionFilter === 'ALL'
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-surface-card text-[var(--text-muted)] border-[var(--surface-border)] hover:border-slate-400'
                    }`}
                  >
                    Todos ({players.length})
                  </button>
                  {positionGroupsConfig.map(group => {
                    const countInCat = players.filter(p => getPlayerPositionCategory(p).key === group.key).length;
                    if (countInCat === 0) return null;
                    const isSelected = positionFilter === group.key;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setPositionFilter(group.key)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-surface-card text-[var(--text-muted)] border-[var(--surface-border)] hover:border-slate-400'
                        }`}
                      >
                        <group.icon size={11} />
                        <span>{group.shortLabel} ({countInCat})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Listado de Jugadores Agrupados por Posición y Ordenados por Presentismo */}
              <div className="space-y-6">
                {groupedPlayers.filter(g => g.players.length > 0).length > 0 ? (
                  groupedPlayers.map(group => {
                    if (group.players.length === 0) return null;
                    const GroupIcon = group.icon;
                    const allGroupSelected = group.selectedCount === group.players.length && group.players.length > 0;

                    return (
                      <div key={group.key} className="space-y-3">
                        {/* Cabecera del Grupo de Posición */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg border ${group.colorClass}`}>
                              <GroupIcon size={14} />
                            </div>
                            <div>
                              <h3 className="text-xs font-black uppercase text-[var(--text-main)] tracking-wider italic flex items-center gap-2">
                                {group.label}
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] border border-[var(--surface-border)]">
                                  {group.selectedCount} / {group.totalCount} convocados
                                </span>
                              </h3>
                            </div>
                          </div>

                          {/* Métricas y acciones del puesto */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {totalWeekPractices > 0 && (
                              <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                                {group.avgAttendance}% asist. prom.
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSelectGroup(group.players, !allGroupSelected)}
                              className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border ${
                                allGroupSelected
                                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                                  : 'bg-primary-600/10 text-primary-600 border-primary-600/20 hover:bg-primary-600/20'
                              }`}
                            >
                              {allGroupSelected ? 'Deseleccionar grupo' : 'Seleccionar grupo'}
                            </button>
                          </div>
                        </div>

                        {/* Grid de Jugadores del Puesto */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {group.players.map(renderPlayerSelectCard)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 text-center bg-surface-ground rounded-3xl border-2 border-dashed border-[var(--surface-border)] space-y-2">
                    <Users size={32} className="mx-auto text-[var(--text-muted)] opacity-30" />
                    <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                      No se encontraron jugadores con los filtros aplicados
                    </p>
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="text-[10px] font-bold text-primary-600 hover:underline uppercase"
                      >
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= STEP 2: INTERACTIVE ALIGNMENT VIEW ================= */
            <div className="space-y-5 sm:space-y-6 animate-fade-in text-[var(--text-main)]">
              {/* Tactical banner with instructions or success status */}
              {hasConfirmedLineup || justConfirmedLineup ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm select-none">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-500 shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 italic">Equipo Titular Definido</h4>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
                        {startingLineup.length} titulares designados • {substitutesLineup.length} suplentes en banca. ¡Todo listo para el partido!
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      disabled={isGeneratingPdf}
                      onClick={handleShareWhatsApp}
                      className="min-h-[42px] px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
                    >
                      {isGeneratingPdf ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          <span>Adjuntando PDF...</span>
                        </>
                      ) : (
                        <>
                          <MessageCircle size={15} fill="currentColor" />
                          <span>Enviar por WhatsApp</span>
                        </>
                      )}
                    </button>
                    {onOpenResultModal && (
                      <button
                        onClick={() => handleFinalize(true)}
                        className="min-h-[42px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md transition-all shrink-0"
                      >
                        <Zap size={13} fill="currentColor" />
                        <span>Cargar Estadísticas</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-primary-600/10 border border-primary-600/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm select-none">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary-600/15 rounded-xl text-primary-600 shrink-0">
                      <Star size={18} fill="currentColor" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-primary-600 italic">Pizarra Táctica (Definir Equipo)</h4>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5 leading-relaxed">
                        Toca a cualquier jugador convocado para alternar entre <span className="text-emerald-500 font-extrabold">Titulares</span> y <span className="text-amber-500 font-extrabold">Suplentes</span>. Recuerda que solo se permiten un máximo de <span className="text-emerald-600 font-black underline">11 titulares</span> en cancha.
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={isGeneratingPdf}
                    onClick={handleShareWhatsApp}
                    className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        <span>Adjuntando PDF...</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle size={15} fill="currentColor" />
                        <span>Enviar WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Match and convocatoria details board */}
              <div className="bg-surface-ground border border-[var(--surface-border)] rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2 mb-1">
                  <span className="flex h-2 w-2 rounded-full bg-primary-600" />
                  <h4 className="text-[10px] font-black uppercase text-primary-500 tracking-widest italic">Información Oficial de la Citación</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-surface-card rounded-xl p-3.5 sm:p-4 border border-[var(--surface-border)] flex flex-col justify-center shadow-sm">
                    <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Hora de Citación</span>
                    <span className="text-sm font-black uppercase text-[var(--text-main)] mt-1">{appointmentTime || 'NO DEFINIDA'}</span>
                  </div>

                  <div className="bg-surface-card rounded-xl p-3.5 sm:p-4 border border-[var(--surface-border)] flex items-center justify-between gap-2 shadow-sm min-w-0">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Ubicación del Partido</span>
                      {location ? (
                        location.startsWith('http://') || location.startsWith('https://') ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs font-bold text-emerald-600 truncate block">Ubicación en Google Maps</span>
                          </div>
                        ) : (
                          <span className="block text-xs font-bold text-[var(--text-main)] mt-1 truncate">{location}</span>
                        )
                      ) : (
                        <span className="block text-xs font-bold text-[var(--text-muted)] mt-1">NO DEFINIDA</span>
                      )}
                    </div>
                    {location && (
                      <a
                        href={location.startsWith('http://') || location.startsWith('https://') ? location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 sm:p-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shrink-0"
                        title="Ver en Google Maps"
                      >
                        <MapPin size={13} />
                        <span className="hidden sm:inline">Ver mapa</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-surface-card rounded-xl p-3.5 sm:p-4 border border-[var(--surface-border)] shadow-sm">
                  <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Apuntes Tácticos & Observaciones</span>
                  <p className="text-xs font-semibold text-[var(--text-main)] mt-1.5 whitespace-pre-line italic leading-relaxed">
                    {notes || 'Sin observaciones cargadas.'}
                  </p>
                </div>
              </div>

              {/* Selector de pestañas para vista Móvil (Titulares / Suplentes) */}
              <div className="flex md:hidden items-center p-1 bg-surface-ground rounded-2xl border border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setMobileLineupTab('titulares')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    mobileLineupTab === 'titulares'
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Star size={13} fill={mobileLineupTab === 'titulares' ? 'currentColor' : 'none'} />
                  <span>Titulares ({startingLineup.length}/11)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileLineupTab('suplentes')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    mobileLineupTab === 'suplentes'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Users size={13} />
                  <span>Suplentes ({substitutesLineup.length})</span>
                </button>
              </div>

              {/* Interactive columns layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
                {/* Column Titulares (Visible siempre en escritorio o cuando está seleccionada en móvil) */}
                <div className={`${mobileLineupTab === 'titulares' ? 'block' : 'hidden md:block'} bg-emerald-500/[0.01] border-2 border-emerald-500/20 rounded-2xl sm:rounded-[2rem] p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-sm min-h-[300px]`}>
                  <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-emerald-500" fill="currentColor" />
                      <h4 className="text-xs font-black uppercase italic tracking-wider text-[var(--text-main)]">Alineación Titular ({startingLineup.length} / 11)</h4>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[9px] font-black uppercase">{startingLineup.length} Titulares</span>
                  </div>

                  {startingLineup.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {startingLineup.map(player => (
                        <div 
                          key={player.id} 
                          onClick={() => toggleStarting(player.id)}
                          className="p-3 bg-surface-card hover:bg-surface-hover hover:border-amber-500/30 border border-emerald-500/30 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:translate-x-1 group select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <img 
                              referrerPolicy="no-referrer"
                              src={player.photourl || getInitialsSvg(player.name)}
                              alt={player.name}
                              className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-500 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase text-emerald-600 truncate">{player.name}</p>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase block truncate">{player.frequent_position || 'Sin puesto'}</span>
                            </div>
                          </div>
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-1 rounded uppercase font-black flex items-center gap-1 group-hover:text-amber-500 group-hover:bg-amber-500/10 group-hover:border-amber-500/20 transition-all shrink-0">
                            <Star size={10} fill="currentColor" />
                            <span className="hidden sm:inline">Titular</span>
                            <span className="sm:hidden">Quitar</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs font-semibold text-[var(--text-muted)] italic uppercase">No hay titulares designados. Toca jugadores del banco para incluirlos.</div>
                  )}
                </div>

                {/* Column Suplentes (Visible siempre en escritorio o cuando está seleccionada en móvil) */}
                <div className={`${mobileLineupTab === 'suplentes' ? 'block' : 'hidden md:block'} bg-surface-ground border border-[var(--surface-border)] rounded-2xl sm:rounded-[2rem] p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-sm min-h-[300px]`}>
                  <div className="flex justify-between items-center border-b border-[var(--surface-border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-amber-500" />
                      <h4 className="text-xs font-black uppercase italic tracking-wider text-[var(--text-main)]">Banco / Suplentes ({substitutesLineup.length})</h4>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[9px] font-black uppercase">{substitutesLineup.length} Suplentes</span>
                  </div>

                  {substitutesLineup.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {substitutesLineup.map(player => (
                        <div 
                          key={player.id} 
                          onClick={() => toggleStarting(player.id)}
                          className="p-3 bg-surface-card hover:bg-emerald-500/5 hover:border-emerald-500/30 border border-[var(--surface-border)] rounded-xl flex items-center justify-between cursor-pointer transition-all hover:translate-x-1 group select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <img 
                              referrerPolicy="no-referrer"
                              src={player.photourl || getInitialsSvg(player.name)}
                              alt={player.name}
                              className="w-10 h-10 rounded-lg object-cover border border-[var(--surface-border)] opacity-80 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase text-[var(--text-main)] leading-none mb-1 truncate">{player.name}</p>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase block truncate">{player.frequent_position || 'Sin puesto'}</span>
                            </div>
                          </div>
                          <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] border border-[var(--surface-border)] px-2 py-1 rounded uppercase font-black group-hover:text-emerald-500 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all shrink-0">
                            Poner titular ➔
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs font-semibold text-[var(--text-muted)] italic uppercase">No hay suplentes designados.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 md:p-8 border-t border-[var(--surface-border)] bg-surface-card/95 backdrop-blur-md sticky bottom-0 shrink-0 select-none z-10">
          {/* Validation or Info Helper Text */}
          {actionStep === 'convocatoria' && !isFormValid ? (
            <div className="flex items-center gap-2 text-rose-500 mb-3 sm:mb-4 animate-pulse">
              <Info size={14} className="text-rose-500 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-wider leading-tight">
                Selecciona al menos un jugador convocado antes de continuar
              </p>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-[var(--text-muted)] opacity-75 mb-3">
              <Info size={14} className="text-primary-500 shrink-0" />
              <p className="text-[9px] font-bold uppercase tracking-widest italic leading-tight">
                {actionStep === 'convocatoria' 
                  ? 'Al confirmar la convocatoria, podrás definir los titulares y exportar el reporte oficial.'
                  : 'Los cambios tácticos quedarán guardados en el registro del partido.'}
              </p>
            </div>
          )}

          {/* Action Step 1: Convocatoria */}
          {actionStep === 'convocatoria' && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 md:gap-3">
              {/* Left / Secondary Action on Desktop */}
              <div className="flex items-center gap-2 order-2 md:order-1 justify-between md:justify-start">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2.5 text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-red-500 transition-all tracking-widest rounded-xl hover:bg-surface-hover flex items-center justify-center whitespace-nowrap"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={!isFormValid || isGeneratingPdf}
                  onClick={handleExportPDF}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm border whitespace-nowrap ${
                    isFormValid 
                      ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border-emerald-500/30' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <FileText size={15} />
                  <span>Exportar PDF</span>
                </button>
              </div>

              {/* Right / Primary Actions */}
              <div className="flex flex-col sm:flex-row md:flex-nowrap items-stretch sm:items-center gap-2 md:gap-2.5 order-1 md:order-2">
                <button
                  type="button"
                  disabled={isSaving || !isFormValid}
                  onClick={handleSaveAndExit}
                  className="min-h-[44px] px-4 md:px-5 py-2.5 border border-[var(--surface-border)] hover:border-primary-500/50 hover:bg-surface-hover rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-40 whitespace-nowrap"
                  title="Guarda los convocados y cierra la ventana para definir los titulares más tarde"
                >
                  <Check size={15} className="text-emerald-500 shrink-0" />
                  <span>Guardar y Salir</span>
                </button>

                <button 
                  type="button"
                  disabled={isSaving || !isFormValid}
                  onClick={handleSaveAndAdvance}
                  className="min-h-[44px] px-5 md:px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md italic whitespace-nowrap"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={15} />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span>Definir Equipo Titular</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Action Step 2: Titulares & Pizarra */}
          {actionStep === 'titulares' && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 md:gap-3">
              {/* Back button */}
              <div className="flex items-center gap-2 order-2 md:order-1 justify-between md:justify-start">
                <button 
                  type="button"
                  onClick={() => setActionStep('convocatoria')}
                  className="min-h-[44px] w-full md:w-auto px-4 py-2.5 border border-[var(--surface-border)] hover:border-[var(--text-muted)] hover:bg-surface-hover rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
                >
                  <ChevronLeft size={15} />
                  <span>Volver a Convocados</span>
                </button>
              </div>

              {/* Main Sharing & Saving Actions (On mobile only Confirmar Titulares is shown) */}
              <div className="flex flex-col sm:flex-row md:flex-nowrap items-stretch sm:items-center gap-2 md:gap-2.5 order-1 md:order-2">
                {/* WhatsApp button - Desktop only */}
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleShareWhatsApp}
                  className="hidden md:flex min-h-[44px] px-3.5 md:px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest items-center justify-center gap-1.5 transition-all shadow-md shrink-0 whitespace-nowrap"
                  title="Compartir por WhatsApp adjuntando el archivo PDF"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="animate-spin" size={15} />
                      <span>Generando PDF...</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle size={15} fill="currentColor" />
                      <span>Enviar por WhatsApp</span>
                    </>
                  )}
                </button>

                {/* PDF download - Desktop only */}
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleExportPDF}
                  className="hidden md:flex min-h-[44px] px-3.5 md:px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 whitespace-nowrap"
                >
                  <FileText size={15} />
                  <span>Descargar PDF</span>
                </button>

                {/* Save only - Desktop only */}
                <button 
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleFinalize(false)}
                  className="hidden md:flex min-h-[44px] px-3.5 md:px-4 py-2.5 border border-[var(--surface-border)] hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50 shrink-0 whitespace-nowrap"
                >
                  <Check size={15} className="text-emerald-500" />
                  <span>Guardar Equipo</span>
                </button>

                {/* Confirm and open statistics - Always visible (Full width on mobile) */}
                <button 
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleFinalize(true)}
                  className="w-full md:w-auto min-h-[44px] px-4 md:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 italic shrink-0 whitespace-nowrap"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={15} />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={15} fill="currentColor" />
                      <span>Confirmar Titulares</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ConvocatoriaModal;
