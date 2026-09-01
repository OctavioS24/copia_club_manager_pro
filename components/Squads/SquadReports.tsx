import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, db } from '../../lib/supabase';
import { useCategory } from '../../context/useCategory';
import { Member, ClubConfig } from '../../types';
import { 
  Loader2, 
  Search, 
  Award, 
  ArrowUpDown, 
  User, 
  Calendar,
  CalendarCheck,
  Download,
  Share2,
  FileSpreadsheet,
  AlertTriangle,
  Filter,
  Users,
  TrendingUp
} from 'lucide-react';
import { getPlayersByCategory, getInitials } from '../../lib/playerUtils';
import { generateAttendancePdfBlob, AttendancePdfPlayer } from '../../lib/pdfGenerator';

interface AttendanceRowData {
  id: string;
  name: string;
  dorsal: string;
  position: string;
  photourl?: string;
  records: Record<string, string>; // date -> 'P' | 'A' | 'J' | 'L'
  presentes: number;
  ausentes: number;
  justificados: number;
  lesionados: number;
  totalRecordedSessions: number;
  percentage: number;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const SquadReports: React.FC = () => {
  const { selectedDiscipline, selectedDivision, selectedGender } = useCategory();
  
  // Active Report Subtab
  const [reportType, setReportType] = useState<'asistencias' | 'convocatorias'>('asistencias');

  // General state
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [disciplineName, setDisciplineName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Time filters for Asistencias
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [selectedWeek, setSelectedWeek] = useState<'all' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5'>('all');

  // Raw attendance records
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  // Convocatorias raw data
  const [squads, setSquads] = useState<any[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'pct' | 'name' | 'presentes'>('pct');

  // Load all base category info & attendance
  const loadData = useCallback(async () => {
    if (!selectedDiscipline || !selectedDivision) return;
    
    setLoading(true);
    setError(null);
    try {
      const [membersRes, configRes, matchesRes] = await Promise.all([
        db.members.getAll(),
        db.config.get(),
        supabase.from('matches').select('id, hometeam, awayteam, date').eq('categoryid', selectedDivision)
      ]);

      if (membersRes.error) throw membersRes.error;
      setMembers(membersRes.data || []);
      setClubConfig(configRes.data || null);

      // Resolve discipline and category names
      let discName = '';
      if (configRes.data) {
        const disc = configRes.data.disciplines.find((d: any) => d.id === selectedDiscipline);
        if (disc) {
          discName = disc.name;
          setDisciplineName(disc.name);
          const branch = disc.branches.find((b: any) => b.categories.some((c: any) => c.id === selectedDivision));
          const cat = branch?.categories.find((c: any) => c.id === selectedDivision);
          if (cat) {
            setCategoryName(cat.name);
          }
        }
      }

      // Fetch all attendance for this category/discipline
      const normalizedDisc = (discName || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const { data: attData, error: attError } = await db.attendance.getByCategory(normalizedDisc, selectedDivision);
      if (attError) throw attError;
      setAttendanceRecords(attData || []);

      // Fetch match squads for convocatorias
      const matchIds = (matchesRes.data || []).map((m: any) => m.id);
      let squadsQuery = supabase.from('match_squads').select('*, players:match_squad_players(*)');
      if (matchIds.length > 0) {
        squadsQuery = squadsQuery.or(`category_id.eq.${selectedDivision},match_id.in.(${matchIds.join(',')})`);
      } else {
        squadsQuery = squadsQuery.eq('category_id', selectedDivision);
      }
      const { data: squadsList, error: squadsError } = await squadsQuery;
      if (squadsError) throw squadsError;
      setSquads(squadsList || []);

    } catch (err: any) {
      console.error('Error cargando reportes:', err);
      setError('Ocurrió un error al procesar las estadísticas e informes.');
    } finally {
      setLoading(false);
    }
  }, [selectedDiscipline, selectedDivision]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Squad players in category
  const squadPlayers = useMemo(() => {
    if (!disciplineName || !categoryName) return [];
    return getPlayersByCategory(
      members,
      disciplineName,
      selectedGender || '',
      categoryName,
      selectedDiscipline,
      selectedDivision
    ) as Member[];
  }, [members, disciplineName, categoryName, selectedGender, selectedDiscipline, selectedDivision]);

  // Calculate Date Boundaries for current Month and selected Week
  const { dateRange, dateRangeLabel, weekOptions } = useMemo(() => {
    // Total days in selected month
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    // Weeks configuration
    const weeks = [
      { id: 'all', label: 'Mes Completo', start: 1, end: daysInMonth },
      { id: 'w1', label: 'Semana 1 (1 al 7)', start: 1, end: 7 },
      { id: 'w2', label: 'Semana 2 (8 al 14)', start: 8, end: 14 },
      { id: 'w3', label: 'Semana 3 (15 al 21)', start: 15, end: 21 },
      { id: 'w4', label: 'Semana 4 (22 al 28)', start: 22, end: 28 },
    ];

    if (daysInMonth > 28) {
      weeks.push({
        id: 'w5',
        label: `Semana 5 (29 al ${daysInMonth})`,
        start: 29,
        end: daysInMonth
      });
    }

    const currentWeekObj = weeks.find(w => w.id === selectedWeek) || weeks[0];
    
    const startDayStr = String(currentWeekObj.start).padStart(2, '0');
    const endDayStr = String(currentWeekObj.end).padStart(2, '0');
    const monthStr = String(selectedMonth + 1).padStart(2, '0');

    const startDate = `${selectedYear}-${monthStr}-${startDayStr}`;
    const endDate = `${selectedYear}-${monthStr}-${endDayStr}`;

    const monthName = MONTH_NAMES[selectedMonth];
    const label = `${monthName} ${selectedYear} - ${currentWeekObj.label}`;
    const rangeText = `${currentWeekObj.start} al ${currentWeekObj.end} de ${monthName} de ${selectedYear}`;

    return {
      dateRange: { startDate, endDate, startDay: currentWeekObj.start, endDay: currentWeekObj.end },
      dateRangeLabel: label,
      rangeText,
      weekOptions: weeks
    };
  }, [selectedYear, selectedMonth, selectedWeek]);

  // Filter attendance records by active date range
  const filteredAttendance = useMemo(() => {
    return attendanceRecords.filter(r => {
      if (!r.date) return false;
      return r.date >= dateRange.startDate && r.date <= dateRange.endDate;
    });
  }, [attendanceRecords, dateRange]);

  // Distinct dates in the filtered attendance
  const sessionDates = useMemo(() => {
    const datesSet = new Set<string>();
    filteredAttendance.forEach(r => {
      if (r.date) datesSet.add(r.date);
    });
    return Array.from(datesSet).sort();
  }, [filteredAttendance]);

  // Compute player matrix for attendance
  const attendanceMatrixData = useMemo<AttendanceRowData[]>(() => {
    if (squadPlayers.length === 0) return [];

    const totalSessions = sessionDates.length;

    return squadPlayers.map(p => {
      // Find assignment for dorsal & position
      const assignment = p.assignments?.find((a: any) => {
        const catMatch = a.category_id === selectedDivision || a.category === selectedDivision;
        const discMatch = a.discipline_id === selectedDiscipline;
        return catMatch || discMatch;
      });

      const dorsal = assignment?.dorsal || p.dorsal || 'S/N';
      const position = assignment?.position || p.frequent_position || (p as any).position || 'Sin puesto';

      // Build records mapping
      const records: Record<string, string> = {};
      let presentes = 0;
      let ausentes = 0;
      let justificados = 0;
      let lesionados = 0;

      sessionDates.forEach(date => {
        const found = filteredAttendance.find(r => r.player_id === p.id && r.date === date);
        if (found) {
          const st = (found.status || 'A').toUpperCase();
          records[date] = st;
          if (st === 'P') presentes += 1;
          else if (st === 'A') ausentes += 1;
          else if (st === 'J') justificados += 1;
          else if (st === 'L') lesionados += 1;
        } else {
          records[date] = '-';
        }
      });

      const percentage = totalSessions > 0 
        ? Math.round((presentes / totalSessions) * 100) 
        : 0;

      return {
        id: p.id,
        name: p.name,
        dorsal,
        position,
        photourl: p.photourl,
        records,
        presentes,
        ausentes,
        justificados,
        lesionados,
        totalRecordedSessions: totalSessions,
        percentage
      };
    });
  }, [squadPlayers, sessionDates, filteredAttendance, selectedDivision, selectedDiscipline]);

  // Processed and sorted attendance list
  const processedAttendance = useMemo(() => {
    let result = [...attendanceMatrixData];

    // Search filter
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.dorsal.toLowerCase().includes(q) ||
        r.position.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'high') {
      result = result.filter(r => r.percentage >= 80);
    } else if (statusFilter === 'mid') {
      result = result.filter(r => r.percentage >= 60 && r.percentage < 80);
    } else if (statusFilter === 'low') {
      result = result.filter(r => r.percentage < 60);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'pct') {
        const diff = b.percentage - a.percentage;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'presentes') {
        const diff = b.presentes - a.presentes;
        if (diff !== 0) return diff;
        return b.percentage - a.percentage;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [attendanceMatrixData, searchTerm, statusFilter, sortBy]);

  // Global KPIs for Attendance
  const overallAttendanceMetrics = useMemo(() => {
    if (attendanceMatrixData.length === 0 || sessionDates.length === 0) {
      return {
        globalPercentage: 0,
        totalPresentes: 0,
        totalAusentes: 0,
        totalJustificados: 0,
        perfectAttendanceCount: 0,
        atRiskCount: 0,
        mvp: null as AttendanceRowData | null
      };
    }

    let totalP = 0;
    let totalA = 0;
    let totalJ = 0;
    let perfect = 0;
    let atRisk = 0;

    attendanceMatrixData.forEach(p => {
      totalP += p.presentes;
      totalA += p.ausentes;
      totalJ += p.justificados;
      if (p.percentage >= 85) perfect++;
      if (p.percentage < 60) atRisk++;
    });

    const totalOpportunities = attendanceMatrixData.length * sessionDates.length;
    const globalPercentage = totalOpportunities > 0 
      ? Math.round((totalP / totalOpportunities) * 100) 
      : 0;

    const sortedByPct = [...attendanceMatrixData].sort((a, b) => b.percentage - a.percentage);
    const mvp = sortedByPct.length > 0 && sortedByPct[0].percentage > 0 ? sortedByPct[0] : null;

    return {
      globalPercentage,
      totalPresentes: totalP,
      totalAusentes: totalA,
      totalJustificados: totalJ,
      perfectAttendanceCount: perfect,
      atRiskCount: atRisk,
      mvp
    };
  }, [attendanceMatrixData, sessionDates]);

  // Convocatorias stats computations for secondary tab
  const convocatoriasStats = useMemo(() => {
    if (squadPlayers.length === 0) return [];
    const playerStatsMap = new Map<string, { convocatorias: number; titularidades: number; minutosJugados: number }>();
    
    squadPlayers.forEach(p => {
      playerStatsMap.set(p.id, { convocatorias: 0, titularidades: 0, minutosJugados: 0 });
    });

    squads.forEach(squad => {
      const squadPlayersList = squad.players || [];
      squadPlayersList.forEach((sp: any) => {
        if (playerStatsMap.has(sp.player_id)) {
          const stats = playerStatsMap.get(sp.player_id)!;
          stats.convocatorias += 1;
          if (sp.is_starting) stats.titularidades += 1;
          stats.minutosJugados += sp.minutes_played || 0;
          playerStatsMap.set(sp.player_id, stats);
        }
      });
    });

    return squadPlayers.map(p => {
      const stats = playerStatsMap.get(p.id) || { convocatorias: 0, titularidades: 0, minutosJugados: 0 };
      return {
        id: p.id,
        name: p.name,
        photourl: p.photourl,
        convocatorias: stats.convocatorias,
        titularidades: stats.titularidades,
        minutosJugados: stats.minutosJugados
      };
    }).sort((a, b) => b.convocatorias - a.convocatorias);
  }, [squadPlayers, squads]);

  // Generate & Download PDF
  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);

      const pdfPlayers: AttendancePdfPlayer[] = attendanceMatrixData.map(p => ({
        id: p.id,
        name: p.name,
        dorsal: p.dorsal,
        position: p.position,
        records: p.records,
        presentes: p.presentes,
        ausentes: p.ausentes,
        justificados: p.justificados,
        lesionados: p.lesionados,
        totalSessions: p.totalRecordedSessions,
        percentage: p.percentage
      }));

      const { blob, filename } = await generateAttendancePdfBlob({
        clubInfo: clubConfig,
        discipline: disciplineName || 'Disciplina',
        categoryName: categoryName || 'Categoría',
        gender: selectedGender || '',
        periodLabel: dateRangeLabel,
        dateRangeText: `${dateRange.startDay} al ${dateRange.endDay} de ${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
        dates: sessionDates,
        players: pdfPlayers,
        overallPercentage: overallAttendanceMetrics.globalPercentage,
        totalSessions: sessionDates.length,
        totalPlayers: squadPlayers.length
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error generating attendance PDF:', err);
      alert('Hubo un inconveniente al generar el PDF del reporte de asistencias.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (attendanceMatrixData.length === 0) return;

    const headers = ['Jugador', 'Dorsal', 'Posición', ...sessionDates, 'Presentes', 'Ausentes', 'Justificados', 'Lesionados', '% Asistencia'];
    const rows = attendanceMatrixData.map(p => {
      const dateCols = sessionDates.map(d => p.records[d] || '-');
      return [
        `"${p.name}"`,
        `"${p.dorsal}"`,
        `"${p.position}"`,
        ...dateCols,
        p.presentes,
        p.ausentes,
        p.justificados,
        p.lesionados,
        `"${p.percentage}%"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Asistencias_${disciplineName}_${categoryName}_${selectedYear}_${selectedMonth + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Share summary
  const handleShareWhatsApp = () => {
    const text = `📊 *REPORTE DE ASISTENCIAS - ${clubConfig?.name || 'Club'}*\n` +
      `🏆 *Disciplina:* ${disciplineName} (${categoryName})\n` +
      `📅 *Período:* ${dateRangeLabel}\n` +
      `⚡ *Sesiones evaluadas:* ${sessionDates.length} entrenamientos\n` +
      `📈 *Presentismo Global:* ${overallAttendanceMetrics.globalPercentage}%\n` +
      `👥 *Atletas Evaluados:* ${squadPlayers.length}\n` +
      `🌟 *Mayor Asistencia:* ${overallAttendanceMetrics.mvp ? `${overallAttendanceMetrics.mvp.name} (${overallAttendanceMetrics.mvp.percentage}%)` : 'N/A'}\n\n` +
      `_Generado desde Club Manager Pro_`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const formatShortDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-main)]">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
          Cargando métricas e informes del plantel...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-[var(--text-main)]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-main)]">
              Informes de Rendimiento
            </h2>
            <span className="px-3 py-1 bg-primary-500/10 text-primary-500 text-[10px] font-black uppercase tracking-wider rounded-full border border-primary-500/20">
              {disciplineName} • {categoryName} {selectedGender ? `(${selectedGender})` : ''}
            </span>
          </div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1">
            Generador de reportes de presentismo, métricas de entrenamiento y convocatorias
          </p>
        </div>

        {/* Tab Switcher: Asistencias vs Convocatorias */}
        <div className="flex bg-surface-card border border-[var(--surface-border)] rounded-2xl p-1.5 shadow-sm">
          <button
            onClick={() => setReportType('asistencias')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              reportType === 'asistencias'
                ? 'bg-primary-600 text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <CalendarCheck size={14} />
            <span>Asistencias</span>
          </button>
          <button
            onClick={() => setReportType('convocatorias')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              reportType === 'convocatorias'
                ? 'bg-primary-600 text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Users size={14} />
            <span>Convocatorias y Minutos</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-5 bg-red-500/10 border-2 border-red-500/20 text-red-500 rounded-3xl flex items-center gap-3">
          <AlertTriangle size={20} />
          <p className="text-xs font-bold uppercase">{error}</p>
        </div>
      )}

      {reportType === 'asistencias' ? (
        <>
          {/* FILTER CONTROL CARD: Year, Month, Week segmentation */}
          <div className="bg-surface-card border-2 border-[var(--surface-border)] rounded-[2.5rem] p-6 lg:p-8 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-primary-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-main)]">
                  Filtros de Período y Segmentación
                </h3>
              </div>

              {/* Action buttons: PDF Download, CSV, WhatsApp */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf || squadPlayers.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  title="Descargar reporte oficial en formato PDF"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Generando PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Descargar PDF</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportCsv}
                  disabled={attendanceMatrixData.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-ground hover:bg-surface-hover border border-[var(--surface-border)] text-[var(--text-main)] rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title="Exportar a Excel / CSV"
                >
                  <FileSpreadsheet size={14} className="text-emerald-500" />
                  <span className="hidden sm:inline">Exportar CSV</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  disabled={attendanceMatrixData.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-ground hover:bg-surface-hover border border-[var(--surface-border)] text-[var(--text-main)] rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                  title="Compartir resumen por WhatsApp"
                >
                  <Share2 size={14} className="text-emerald-500" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Selectors Bar: Year, Month, and Week Segment Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-[var(--surface-border)]">
              {/* Year Selector */}
              <div className="sm:col-span-3">
                <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5 block">
                  Año
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-3.5 py-2.5 text-xs font-black text-[var(--text-main)] focus:outline-none focus:border-primary-500 cursor-pointer"
                >
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Month Selector */}
              <div className="sm:col-span-4">
                <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider mb-1.5 block">
                  Mes
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value));
                    setSelectedWeek('all'); // Reset to full month on month switch
                  }}
                  className="w-full bg-surface-ground border border-[var(--surface-border)] rounded-xl px-3.5 py-2.5 text-xs font-black text-[var(--text-main)] focus:outline-none focus:border-primary-500 cursor-pointer"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Current Period Label preview */}
              <div className="sm:col-span-5 flex flex-col justify-end">
                <div className="bg-surface-ground/70 border border-[var(--surface-border)] rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider">Período:</span>
                  <span className="text-xs font-black uppercase text-primary-500 truncate max-w-[200px]">
                    {dateRangeLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Week Segmentation Pills */}
            <div>
              <label className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-wider mb-2 block">
                Segmentación por Semanas
              </label>
              <div className="flex flex-wrap gap-2">
                {weekOptions.map((w) => {
                  const isActive = selectedWeek === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWeek(w.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-primary-600 text-white border-primary-600 shadow-md scale-[1.02]'
                          : 'bg-surface-ground hover:bg-surface-hover text-[var(--text-muted)] hover:text-[var(--text-main)] border-[var(--surface-border)]'
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BENTO KPI SUMMARY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Global Attendance % */}
            <div className="bg-surface-card p-6 border-2 border-[var(--surface-border)] rounded-[2rem] flex flex-col justify-between group hover:border-primary-500/40 transition-all">
              <div>
                <p className="text-[9px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-1 flex items-center justify-between">
                  <span>ASISTENCIA GLOBAL</span>
                  <TrendingUp size={14} className="text-emerald-500" />
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black italic tracking-tighter text-[var(--text-main)]">
                    {overallAttendanceMetrics.globalPercentage}%
                  </h3>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                    promedio
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2 w-full bg-surface-ground rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-primary-600 rounded-full transition-all duration-700"
                    style={{ width: `${overallAttendanceMetrics.globalPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Total Sessions / Dates */}
            <div className="bg-surface-card p-6 border-2 border-[var(--surface-border)] rounded-[2rem] flex flex-col justify-between group hover:border-primary-500/40 transition-all">
              <div>
                <p className="text-[9px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-1 flex items-center justify-between">
                  <span>ENTRENAMIENTOS</span>
                  <Calendar size={14} className="text-primary-500" />
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black italic tracking-tighter text-[var(--text-main)]">
                    {sessionDates.length}
                  </h3>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                    sesiones registradas
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-4">
                {sessionDates.length > 0 ? `${formatShortDate(sessionDates[0])} al ${formatShortDate(sessionDates[sessionDates.length - 1])}` : 'Sin prácticas en el período'}
              </p>
            </div>

            {/* Highest Attendance Player */}
            {overallAttendanceMetrics.mvp ? (
              <div className="bg-surface-card p-6 border-[3px] border-emerald-500/30 rounded-[2rem] flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 bg-emerald-500/10 text-emerald-500 rounded-bl-[1.5rem]">
                  <Award size={16} />
                </div>
                <div>
                  <p className="text-[9px] text-emerald-500 font-black tracking-widest uppercase mb-1">
                    MÁXIMO COMPROMISO
                  </p>
                  <h4 className="text-base font-black truncate text-[var(--text-main)] uppercase">
                    {overallAttendanceMetrics.mvp.name}
                  </h4>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-lg uppercase">
                    {overallAttendanceMetrics.mvp.percentage}% Presente
                  </span>
                  <span className="text-[9px] font-bold text-[var(--text-muted)]">
                    {overallAttendanceMetrics.mvp.presentes} de {sessionDates.length}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-surface-card p-6 border-2 border-[var(--surface-border)] rounded-[2rem] flex flex-col justify-center items-center text-[var(--text-muted)]">
                <Award size={24} className="opacity-30 mb-1" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sin registros aún</p>
              </div>
            )}

            {/* Inasistencias / At Risk */}
            <div className="bg-surface-card p-6 border-2 border-[var(--surface-border)] rounded-[2rem] flex flex-col justify-between group hover:border-amber-500/40 transition-all">
              <div>
                <p className="text-[9px] text-[var(--text-muted)] font-black tracking-widest uppercase mb-1 flex items-center justify-between">
                  <span>ATENCIÓN REQUERIDA</span>
                  <AlertTriangle size={14} className="text-amber-500" />
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black italic tracking-tighter text-amber-500">
                    {overallAttendanceMetrics.atRiskCount}
                  </h3>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                    atletas &lt;60%
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-4">
                {overallAttendanceMetrics.perfectAttendanceCount} atletas con asistencia destacada (≥85%)
              </p>
            </div>
          </div>

          {/* SEARCH, FILTER & SORT BAR */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre, dorsal o posición..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-card border border-[var(--surface-border)] hover:border-primary-500/40 focus:border-primary-500 rounded-2xl pl-11 pr-5 py-3 text-xs font-semibold text-[var(--text-main)] outline-none transition-all placeholder-[var(--text-muted)] shadow-sm"
              />
            </div>

            {/* Filter Pills & Sort Select */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status filter */}
              <div className="flex bg-surface-card border border-[var(--surface-border)] rounded-xl p-1 shadow-sm">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all ${
                    statusFilter === 'all'
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('high')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all ${
                    statusFilter === 'high'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  ≥80%
                </button>
                <button
                  onClick={() => setStatusFilter('low')}
                  className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all ${
                    statusFilter === 'low'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  &lt;60%
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-surface-card border border-[var(--surface-border)] rounded-xl px-3 py-2">
                <ArrowUpDown size={12} className="text-[var(--text-muted)]" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-[10px] font-black text-[var(--text-main)] uppercase outline-none cursor-pointer"
                >
                  <option value="pct">% Asistencia</option>
                  <option value="name">Nombre</option>
                  <option value="presentes">Más Presentes</option>
                </select>
              </div>
            </div>
          </div>

          {/* MAIN ATTENDANCE MATRIX & RESPONSIVE VIEWS */}
          {processedAttendance.length > 0 ? (
            <div className="bg-surface-card border-2 border-[var(--surface-border)] rounded-[2.5rem] overflow-hidden shadow-sm">
              {/* Desktop Table View with Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-surface-ground/70 border-b border-[var(--surface-border)]">
                      <th className="p-5 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider min-w-[220px]">
                        Jugador
                      </th>
                      
                      {/* Session date columns */}
                      {sessionDates.length > 0 ? (
                        sessionDates.map(date => (
                          <th key={date} className="p-3 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap">
                            <span className="block">{formatShortDate(date)}</span>
                          </th>
                        ))
                      ) : (
                        <th className="p-4 text-center text-[9px] font-black text-[var(--text-muted)] uppercase">
                          Sin Fechas Registradas
                        </th>
                      )}

                      {/* Totals & % */}
                      <th className="p-4 text-center text-[10px] font-black text-emerald-500 uppercase tracking-wider">
                        P
                      </th>
                      <th className="p-4 text-center text-[10px] font-black text-rose-500 uppercase tracking-wider">
                        A
                      </th>
                      <th className="p-4 text-center text-[10px] font-black text-amber-500 uppercase tracking-wider">
                        J
                      </th>
                      <th className="p-4 text-center text-[10px] font-black text-primary-500 uppercase tracking-wider min-w-[120px]">
                        % Asistencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {processedAttendance.map((row) => {
                      const pctColor = row.percentage >= 80 
                        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                        : row.percentage >= 60 
                          ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                          : 'text-rose-500 bg-rose-500/10 border-rose-500/20';

                      return (
                        <tr key={row.id} className="hover:bg-surface-hover/30 transition-colors">
                          {/* Jugador Profile Cell */}
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-surface-ground font-black text-[10px] italic text-primary-600 border border-[var(--surface-border)] overflow-hidden shrink-0 flex items-center justify-center">
                                {row.photourl ? (
                                  <img src={row.photourl} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                                ) : (
                                  <span>{getInitials(row.name)}</span>
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-black uppercase text-[var(--text-main)] truncate">
                                  {row.name}
                                </span>
                                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                  {row.position} {row.dorsal !== 'S/N' ? `• #${row.dorsal}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Matrix Dates Status */}
                          {sessionDates.length > 0 ? (
                            sessionDates.map(date => {
                              const st = row.records[date] || '-';
                              let badgeStyle = 'text-[var(--text-muted)] opacity-30';
                              if (st === 'P') badgeStyle = 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-black';
                              else if (st === 'A') badgeStyle = 'bg-rose-500/15 text-rose-500 border border-rose-500/30 font-black';
                              else if (st === 'J') badgeStyle = 'bg-amber-500/15 text-amber-500 border border-amber-500/30 font-black';
                              else if (st === 'L') badgeStyle = 'bg-sky-500/15 text-sky-500 border border-sky-500/30 font-black';

                              return (
                                <td key={date} className="p-3 text-center">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] ${badgeStyle}`}>
                                    {st}
                                  </span>
                                </td>
                              );
                            })
                          ) : (
                            <td className="p-4 text-center text-xs text-[var(--text-muted)]">-</td>
                          )}

                          {/* Totals */}
                          <td className="p-4 text-center font-black text-xs text-emerald-500">
                            {row.presentes}
                          </td>
                          <td className="p-4 text-center font-black text-xs text-rose-500">
                            {row.ausentes}
                          </td>
                          <td className="p-4 text-center font-black text-xs text-amber-500">
                            {row.justificados}
                          </td>

                          {/* Percentage Badge & Mini Bar */}
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border ${pctColor}`}>
                                {row.percentage}%
                              </span>
                              <div className="w-16 h-1.5 bg-surface-ground rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${row.percentage >= 80 ? 'bg-emerald-500' : row.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${row.percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend bar */}
              <div className="p-4 bg-surface-ground/50 border-t border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-4 text-[10px] font-bold text-[var(--text-muted)] uppercase">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-500 font-black inline-flex items-center justify-center text-[9px]">P</span>
                    <span>Presente</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-rose-500/20 text-rose-500 font-black inline-flex items-center justify-center text-[9px]">A</span>
                    <span>Ausente</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-500 font-black inline-flex items-center justify-center text-[9px]">J</span>
                    <span>Justificado</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-sky-500/20 text-sky-500 font-black inline-flex items-center justify-center text-[9px]">L</span>
                    <span>Lesionado</span>
                  </span>
                </div>
                <span>{processedAttendance.length} jugadores en la nómina</span>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center bg-surface-ground rounded-[3rem] border-2 border-dashed border-[var(--surface-border)]">
              <User size={48} className="mx-auto text-[var(--text-muted)] mb-4 opacity-20" />
              <h3 className="text-xl font-black uppercase text-[var(--text-muted)] italic tracking-widest">
                No hay resultados para los filtros seleccionados
              </h3>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mt-2">
                Prueba cambiando el mes, la semana o el término de búsqueda.
              </p>
            </div>
          )}
        </>
      ) : (
        /* CONVOCATORIAS & PARTIDOS VIEW */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase italic tracking-wider text-[var(--text-main)]">
              Estadísticas de Convocatorias y Titularidades
            </h3>
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase">
              {squads.length} Planillas oficiales de partido
            </span>
          </div>

          <div className="bg-surface-card border-2 border-[var(--surface-border)] rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-ground/70 border-b border-[var(--surface-border)]">
                    <th className="p-6 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Jugador</th>
                    <th className="p-6 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Titularidades</th>
                    <th className="p-6 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Convocatorias</th>
                    <th className="p-6 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Minutos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {convocatoriasStats.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-3.5">
                          <div className="w-8 h-8 rounded-xl bg-surface-ground font-black text-[10px] italic text-primary-600 border border-[var(--surface-border)] overflow-hidden shrink-0 flex items-center justify-center">
                            {row.photourl ? (
                              <img src={row.photourl} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                            ) : (
                              <span>{getInitials(row.name)}</span>
                            )}
                          </div>
                          <span className="text-xs font-black uppercase text-[var(--text-main)]">
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-6 text-center font-black text-sm text-emerald-500">
                        {row.titularidades}
                      </td>
                      <td className="p-6 text-center font-black text-sm text-amber-500">
                        {row.convocatorias}
                      </td>
                      <td className="p-6 text-center font-black text-sm text-primary-500">
                        {row.minutosJugados}'
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadReports;
