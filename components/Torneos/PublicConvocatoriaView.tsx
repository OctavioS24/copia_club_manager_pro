import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, MapPin, CheckCircle2, 
  Share2, Shield, ExternalLink, Loader2, Sparkles, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/supabase';
import { Match, ClubConfig, Member } from '../../types';
import { generateConvocatoriaPdfBlob } from '../../lib/pdfGenerator';

export const PublicConvocatoriaView: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [squad, setSquad] = useState<any | null>(null);
  const [players, setPlayers] = useState<Member[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubConfig | null>(null);
  const [tournamentName, setTournamentName] = useState<string>('');

  useEffect(() => {
    const fetchConvocatoria = async () => {
      if (!matchId) {
        setError('Identificador de partido no válido');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // 1. Cargar datos del club
        const configRes = await db.config.get();
        if (configRes.data) {
          setClubInfo(configRes.data);
        }

        // 2. Cargar datos del partido
        const { data: matchData, error: matchErr } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (matchErr || !matchData) {
          throw new Error('No se encontró el partido o la convocatoria');
        }

        setMatch(matchData);

        // 3. Cargar nombre del torneo
        if (matchData.tournamentid) {
          const { data: tourneyData } = await supabase
            .from('tournaments')
            .select('name')
            .eq('id', matchData.tournamentid)
            .single();
          if (tourneyData) setTournamentName(tourneyData.name);
        }

        // 4. Cargar la convocatoria
        const { data: squadData, error: squadErr } = await supabase
          .from('match_squads')
          .select('*, players:match_squad_players(*)')
          .eq('match_id', matchId)
          .single();

        if (squadErr || !squadData) {
          throw new Error('La convocatoria aún no ha sido publicada para este partido.');
        }

        setSquad(squadData);

        // 5. Cargar detalles de los jugadores convocados
        const playerIds = (squadData.players || []).map((p: any) => p.player_id);
        if (playerIds.length > 0) {
          const { data: membersData } = await supabase
            .from('members')
            .select('*')
            .in('id', playerIds);
          if (membersData) {
            setPlayers(membersData);
          }
        }
      } catch (err: any) {
        console.error('Error al cargar la convocatoria pública:', err);
        setError(err.message || 'Error al cargar la información');
      } finally {
        setLoading(false);
      }
    };

    fetchConvocatoria();
  }, [matchId]);

  // Jugadores estructurados por titulares y suplentes
  const { starters, substitutes } = useMemo(() => {
    if (!squad || !players.length) return { starters: [], substitutes: [] };

    const squadPlayerMap = new Map();
    (squad.players || []).forEach((sp: any) => {
      squadPlayerMap.set(sp.player_id, sp);
    });

    const startersList: { member: Member; isStarting: boolean }[] = [];
    const subsList: { member: Member; isStarting: boolean }[] = [];

    players.forEach(p => {
      const sp = squadPlayerMap.get(p.id);
      if (sp) {
        if (sp.is_starting) {
          startersList.push({ member: p, isStarting: true });
        } else {
          subsList.push({ member: p, isStarting: false });
        }
      }
    });

    return { starters: startersList, substitutes: subsList };
  }, [squad, players]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Generar y descargar el archivo PDF directo
  const handleDownloadPdf = async () => {
    if (!match) return;
    setIsGeneratingPdf(true);
    try {
      const startersMap: Record<string, boolean> = {};
      starters.forEach(s => {
        startersMap[s.member.id] = true;
      });

      const { blob, filename } = await generateConvocatoriaPdfBlob({
        match,
        clubInfo,
        discipline: match.discipline,
        appointmentTime: squad?.appointment_time,
        location: squad?.location,
        notes: squad?.notes,
        selectedPlayers: players,
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
      console.error('Error al generar PDF:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    if (!match) return;
    setIsGeneratingPdf(true);
    try {
      const startersMap: Record<string, boolean> = {};
      starters.forEach(s => {
        startersMap[s.member.id] = true;
      });

      const { file } = await generateConvocatoriaPdfBlob({
        match,
        clubInfo,
        discipline: match.discipline,
        appointmentTime: squad?.appointment_time,
        location: squad?.location,
        notes: squad?.notes,
        selectedPlayers: players,
        startersMap
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Convocatoria: ${match.hometeam} vs ${match.awayteam}`,
          files: [file]
        });
        return;
      }
      
      if (navigator.share) {
        await navigator.share({
          title: `Convocatoria: ${match.hometeam} vs ${match.awayteam}`,
          text: `Convocatoria oficial para el partido ${match.hometeam} vs ${match.awayteam}`,
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert('¡Enlace de la convocatoria copiado al portapapeles!');
      }
    } catch {
      // Cancelado por el usuario o error
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cargando Convocatoria Oficial...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4">
          <Shield size={32} />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2">Convocatoria No Disponible</h2>
        <p className="text-slate-400 text-xs font-medium max-w-sm mb-6">{error || 'El partido seleccionado no tiene una convocatoria activa.'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  const clubName = clubInfo?.name || 'Club Manager';
  const isClubHome = match.hometeam.toUpperCase() === clubName.toUpperCase();
  const mapsUrl = squad?.location 
    ? (squad.location.startsWith('http') ? squad.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(squad.location)}`)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-primary-500 selection:text-white pb-20">
      {/* Barra superior de acciones (no se imprime) */}
      <div className="print:hidden sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {clubInfo?.logo_url ? (
            <img src={clubInfo.logo_url} alt={clubName} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center font-black text-xs text-white">
              {clubName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xs font-black uppercase tracking-wider text-white truncate max-w-[180px] sm:max-w-xs">{clubName}</h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Convocatoria Oficial</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={isGeneratingPdf}
            onClick={handleShare}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border border-slate-700"
          >
            <Share2 size={13} />
            <span className="hidden sm:inline">Compartir</span>
          </button>
          <button
            disabled={isGeneratingPdf}
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-md shadow-primary-600/30"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Descargar PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contenido principal de la planilla */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl overflow-hidden print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
          
          {/* Header oficial del Club */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-slate-800 print:border-slate-300 pb-8">
            <div className="flex items-center gap-4 text-center sm:text-left">
              {clubInfo?.logo_url && (
                <img src={clubInfo.logo_url} alt={clubName} className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700 print:border-slate-300 shadow-md" />
              )}
              <div>
                <span className="px-3 py-1 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded-full text-[9px] font-black uppercase tracking-widest inline-block mb-1.5 print:border-slate-400 print:text-slate-700">
                  {tournamentName || 'Torneo Oficial'} • {match.discipline || 'Fútbol'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white print:text-black">{clubName}</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 print:text-slate-600">Planilla Oficial de Citación</p>
              </div>
            </div>

            <div className="text-center sm:text-right bg-slate-950/60 print:bg-slate-100 border border-slate-800 print:border-slate-300 rounded-2xl px-5 py-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Estado</span>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center justify-center sm:justify-end gap-1.5">
                <CheckCircle2 size={13} />
                CONFIRMADA
              </span>
            </div>
          </div>

          {/* Tarjeta del Partido (VS) */}
          <div className="mt-8 bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 rounded-3xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-center">
                <div className={`text-base sm:text-lg font-black uppercase italic truncate ${isClubHome ? 'text-primary-400 print:text-black font-extrabold' : 'text-slate-200 print:text-black'}`}>
                  {match.hometeam}
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mt-1">Local</span>
              </div>

              <div className="px-3.5 py-1.5 bg-slate-800 print:bg-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-300 print:text-slate-800 tracking-widest">
                VS
              </div>

              <div className="flex-1 text-center">
                <div className={`text-base sm:text-lg font-black uppercase italic truncate ${!isClubHome ? 'text-primary-400 print:text-black font-extrabold' : 'text-slate-200 print:text-black'}`}>
                  {match.awayteam}
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mt-1">Visitante</span>
              </div>
            </div>

            {/* Grilla de Datos de Citación */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 print:border-slate-200">
              <div className="bg-slate-900/60 print:bg-white p-3 rounded-2xl border border-slate-800/50 print:border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-400 text-[8px] font-black uppercase tracking-wider mb-1">
                  <Calendar size={11} className="text-primary-400" />
                  <span>Fecha</span>
                </div>
                <span className="text-xs font-black text-white print:text-black block truncate">
                  {new Date(match.date).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                </span>
              </div>

              <div className="bg-slate-900/60 print:bg-white p-3 rounded-2xl border border-slate-800/50 print:border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-400 text-[8px] font-black uppercase tracking-wider mb-1">
                  <Clock size={11} className="text-primary-400" />
                  <span>Partido</span>
                </div>
                <span className="text-xs font-black text-white print:text-black block truncate">
                  {match.time ? `${match.time.slice(0, 5)} hs` : 'A confirmar'}
                </span>
              </div>

              <div className="bg-emerald-500/10 print:bg-emerald-50 p-3 rounded-2xl border border-emerald-500/20 print:border-emerald-200">
                <div className="flex items-center gap-1.5 text-emerald-400 print:text-emerald-700 text-[8px] font-black uppercase tracking-wider mb-1">
                  <Sparkles size={11} />
                  <span>Citación DT</span>
                </div>
                <span className="text-xs font-black text-emerald-400 print:text-emerald-800 block truncate">
                  {squad?.appointment_time ? `${squad.appointment_time.slice(0, 5)} hs` : 'A confirmar'}
                </span>
              </div>

              <div className="bg-slate-900/60 print:bg-white p-3 rounded-2xl border border-slate-800/50 print:border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-400 text-[8px] font-black uppercase tracking-wider mb-1">
                  <MapPin size={11} className="text-primary-400" />
                  <span>Cancha / Sede</span>
                </div>
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-black text-primary-400 hover:text-primary-300 print:text-blue-600 block truncate flex items-center gap-1"
                  >
                    <span>{squad?.location || 'Ver mapa'}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs font-black text-white print:text-black block truncate">
                    {squad?.location || 'A confirmar'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Lista de Convocados: Titulares y Suplentes */}
          <div className="mt-8 space-y-6">
            {/* Titulares */}
            {starters.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 print:text-emerald-700 italic">
                    Equipo Titular ({starters.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {starters.map(({ member }, idx) => (
                    <div 
                      key={member.id}
                      className="bg-slate-950/60 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 print:bg-emerald-100 print:text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-black uppercase text-white print:text-black truncate">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600 truncate">
                            {member.frequent_position || (member as any).position || 'Jugador'}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 print:border-emerald-300">
                        Titular
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suplentes / Resto de Convocados */}
            {substitutes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 print:text-amber-700 italic">
                    {starters.length > 0 ? `Suplentes / Relevos (${substitutes.length})` : `Convocados (${substitutes.length})`}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {substitutes.map(({ member }, idx) => (
                    <div 
                      key={member.id}
                      className="bg-slate-950/60 print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 print:bg-slate-200 print:text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {starters.length + idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-black uppercase text-white print:text-black truncate">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600 truncate">
                            {member.frequent_position || (member as any).position || 'Jugador'}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 print:border-slate-300">
                        {starters.length > 0 ? 'Suplente' : 'Convocado'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notas tácticas / Instrucciones */}
          {squad?.notes && (
            <div className="mt-8 bg-slate-950/60 print:bg-slate-50 border border-dashed border-slate-800 print:border-slate-300 rounded-3xl p-5">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Instrucciones & Apuntes del Cuerpo Técnico
              </h4>
              <p className="text-xs text-slate-200 print:text-black whitespace-pre-wrap leading-relaxed">
                {squad.notes}
              </p>
            </div>
          )}

          {/* Footer institucional */}
          <div className="mt-10 pt-6 border-t border-slate-800 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <span>{clubName} • Sistema de Gestión Deportiva</span>
            <span>Documento Oficial de Citación</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicConvocatoriaView;
