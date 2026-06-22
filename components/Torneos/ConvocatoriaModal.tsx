import React, { useState, useEffect } from 'react';
import { Users, Star, Check, X, Loader2, Info, DollarSign, MapPin, ChevronRight, ChevronLeft, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { Match, Member, MatchSquadPlayer } from '../../types';
import { getMatchSquad, saveMatchSquad } from '../../lib/squads';
import { db, supabase } from '../../lib/supabase';
import { getInitials, getInitialsSvg } from '../../lib/playerUtils';

interface ConvocatoriaModalProps {
  match: Match;
  players: Member[];
  onClose: () => void;
  onSuccess: () => void;
  discipline?: string;
}

const ConvocatoriaModal: React.FC<ConvocatoriaModalProps> = ({ 
  match, 
  players, 
  onClose, 
  onSuccess,
  discipline = 'FUTBOL' 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [playerDebts, setPlayerDebts] = useState<Set<string>>(new Set());
  const [activeCommitments, setActiveCommitments] = useState<Set<string>>(new Set());
  const [clubInfo, setClubInfo] = useState<{ name: string; logo_url: string } | null>(null);
  const [rivalLogo, setRivalLogo] = useState<string>('');
  
  // Step navigation: 'convocatoria' (paso 1) or 'titulares' (paso 2)
  const [actionStep, setActionStep] = useState<'convocatoria' | 'titulares'>('convocatoria');

  // State for selected players and starters
  const [selection, setSelection] = useState<Record<string, { selected: boolean, starting: boolean }>>({});
  const [notes, setNotes] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const loadSquadAndDebts = async () => {
      setIsLoading(true);
      try {
        // Cargar convocatoria existente
        const existingSquad = await getMatchSquad(match.id);
        
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
        const matchRival = rivalsData?.find(r => r.name === match.hometeam || r.name === match.awayteam);
        const defaultLocation = matchRival?.address_url || '';
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
        
        const initialSelection: Record<string, { selected: boolean, starting: boolean }> = {};
        
        // Default: If no squad exists, all provided players are pre-selected but not starting
        players.forEach(p => {
          initialSelection[p.id] = { selected: !existingSquad, starting: false };
        });

        if (existingSquad) {
          setNotes(existingSquad.notes || '');
          setAppointmentTime(existingSquad.appointment_time || '');
          setLocation(existingSquad.location || defaultLocation);
          existingSquad.players?.forEach(sp => {
            if (initialSelection[sp.player_id]) {
              initialSelection[sp.player_id] = { selected: true, starting: sp.is_starting };
            }
          });
        } else {
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
  }, [match.id, match.hometeam, match.awayteam, players]);

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

  const handleFinalize = async () => {
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

  const handleSave = async () => {
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
      
      setActionStep('titulares');
    } catch (error) {
      console.error('Error saving squad:', error);
      alert('Error al guardar la convocatoria');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    // 1. Gather all data
    const clubName = clubInfo?.name || 'Club Manager Pro';
    const clubLogo = clubInfo?.logo_url || '';
    
    // Determine local and visitor logos
    const isHome = match.hometeam.toUpperCase() === clubName.toUpperCase();
    const localLogo = isHome ? clubLogo : rivalLogo;
    const visitorLogo = isHome ? rivalLogo : clubLogo;

    // Filter players
    const selectedPlayers = players.filter(p => selection[p.id]?.selected);

    const arqueros: Member[] = [];
    const defensores: Member[] = [];
    const mediocampistas: Member[] = [];
    const delanteros: Member[] = [];
    const otros: Member[] = [];

    selectedPlayers.forEach(p => {
      const matchCategoryId = match.category_id || match.categoryid;
      const assignment = p.assignments?.find((a: any) => {
        const catMatch = matchCategoryId && (a.category_id === matchCategoryId || a.categoryId === matchCategoryId);
        const discNameMatch = discipline && a.discipline?.toUpperCase() === discipline.toUpperCase();
        return catMatch || discNameMatch;
      });
      
      const posStr = (assignment?.position || p.frequent_position || (p as any).position || 'SIN PUESTO').toUpperCase().trim();
      
      if (posStr.includes('ARQ') || posStr.includes('PORTERO') || posStr.includes('GOALKEEPER') || posStr.includes('GK')) {
        arqueros.push(p);
      } else if (posStr.includes('DEF') || posStr.includes('LATERAL') || posStr.includes('CENTRAL') || posStr.includes('ZAGUERO') || posStr === 'DF') {
        defensores.push(p);
      } else if (posStr.includes('MED') || posStr.includes('VOLANTE') || posStr.includes('VOL') || posStr.includes('CENTRO') || posStr.includes('MC') || posStr === 'MED' || posStr.includes('ENGANCHE') || posStr.includes('CINCO')) {
        mediocampistas.push(p);
      } else if (posStr.includes('DEL') || posStr.includes('DELANTERO') || posStr.includes('EXTREMO') || posStr.includes('PUNTA') || posStr.includes('CENTRODELANTERO') || posStr === 'DL' || posStr === 'ST') {
        delanteros.push(p);
      } else {
        otros.push(p);
      }
    });

    const formatPlayerRow = (p: Member) => {
      const matchCategoryId = match.category_id || match.categoryid;
      const assignment = p.assignments?.find((a: any) => {
        const catMatch = matchCategoryId && (a.category_id === matchCategoryId || a.categoryId === matchCategoryId);
        const discNameMatch = discipline && a.discipline?.toUpperCase() === discipline.toUpperCase();
        return catMatch || discNameMatch;
      });
      
      const dorsal = assignment?.dorsal || p.dorsal || 'S/N';
      const posStr = assignment?.position || p.frequent_position || (p as any).position || 'Sin puesto';
      
      const photoHtml = p.photourl 
        ? `<img src="${p.photourl}" class="player-photo" alt="" onerror="this.outerHTML='<div class=\\'player-photo-placeholder\\'>${getInitials(p.name)}</div>'" />`
        : `<div class="player-photo-placeholder">${getInitials(p.name)}</div>`;

      return `
        <div class="player-row">
          <div class="player-info">
            <span class="player-number">${dorsal}</span>
            ${photoHtml}
            <div>
              <span class="player-name">${p.name}</span>
              <div style="font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase;">${posStr}</div>
            </div>
          </div>
        </div>
      `;
    };

    const renderSection = (title: string, playersList: Member[]) => {
      if (playersList.length === 0) return '';
      return `
        <div class="position-section">
          <div class="position-title">${title}</div>
          <div class="players-list">
            ${playersList.map(formatPlayerRow).join('')}
          </div>
        </div>
      `;
    };

    const sectionsHtml = [
      renderSection('Arqueros 🧤', arqueros),
      renderSection('Defensores 🛡️', defensores),
      renderSection('Mediocampistas 🎯', mediocampistas),
      renderSection('Delanteros ⚡', delanteros),
      renderSection('Otros', otros)
    ].join('');

    const venueUrl = location
      ? (location.startsWith('http://') || location.startsWith('https://') ? location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`)
      : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes (pop-ups) para descargar el PDF de la convocatoria.');
      return;
    }

    const localLogoHtml = localLogo 
      ? `<img src="${localLogo}" class="team-logo" alt="" onerror="this.outerHTML='<div class=\\'team-logo-placeholder\\'>${match.hometeam.substring(0, 2).toUpperCase()}</div>'" />` 
      : `<div class="team-logo-placeholder">${match.hometeam.substring(0, 2).toUpperCase()}</div>`;

    const visitorLogoHtml = visitorLogo 
      ? `<img src="${visitorLogo}" class="team-logo" alt="" onerror="this.outerHTML='<div class=\\'team-logo-placeholder\\'>${match.awayteam.substring(0, 2).toUpperCase()}</div>'" />` 
      : `<div class="team-logo-placeholder">${match.awayteam.substring(0, 2).toUpperCase()}</div>`;

    const clubLogoHtml = clubLogo 
      ? `<img src="${clubLogo}" class="club-logo" alt="" onerror="this.outerHTML='<div class=\\'club-logo-placeholder\\'>CP</div>'" />` 
      : `<div class="club-logo-placeholder">${clubName.substring(0, 2).toUpperCase()}</div>`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Convocatoria - ${clubName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #0f172a;
            background-color: #ffffff;
            margin: 0;
            padding: 30px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          
          .club-branding {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          
          .club-logo {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 12px;
          }
          
          .club-logo-placeholder {
            width: 60px;
            height: 60px;
            background-color: #0f172a;
            color: #ffffff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 950;
          }
          
          .club-title {
            margin: 0;
            font-size: 22px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            font-style: italic;
          }
          
          .document-type {
            margin: 2px 0 0 0;
            font-size: 10px;
            color: #4b5563;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          
          .print-actions {
            background-color: #f3f4f6;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 12px;
            margin-bottom: 24px;
          }
          
          .print-btn {
            background-color: #0f172a;
            color: white;
            border: none;
            padding: 10px 20px;
            font-weight: 800;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 8px;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          
          .print-btn:hover {
            opacity: 0.9;
          }
          
          .match-card {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
          }
          
          .vs-container {
            display: flex;
            justify-content: space-around;
            align-items: center;
            margin-bottom: 16px;
          }
          
          .team-block {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 40%;
            text-align: center;
          }
          
          .team-logo {
            width: 54px;
            height: 54px;
            object-fit: cover;
            border-radius: 50%;
            margin-bottom: 6px;
            border: 2px solid #e5e7eb;
          }
          
          .team-logo-placeholder {
            width: 54px;
            height: 54px;
            border-radius: 50%;
            background-color: #f3f4f6;
            color: #374151;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 900;
            margin-bottom: 6px;
            border: 2px solid #e5e7eb;
          }
          
          .team-name {
            margin: 0;
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            font-style: italic;
          }
          
          .vs-badge {
            font-size: 12px;
            font-weight: 900;
            color: #6b7280;
            background-color: #e5e7eb;
            padding: 6px 10px;
            border-radius: 12px;
          }
          
          .match-details-grid {
            display: grid;
            grid-template-cols: repeat(4, 1fr);
            gap: 12px;
            border-top: 1px dashed #d1d5db;
            padding-top: 14px;
          }
          
          .detail-item {
            display: flex;
            flex-direction: column;
          }
          
          .detail-label {
            font-size: 8px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 800;
            letter-spacing: 1px;
            margin-bottom: 2px;
          }
          
          .detail-value {
            font-size: 11px;
            font-weight: 700;
          }
          
          .detail-value.citation {
            color: #2563eb;
            font-weight: 900;
          }
          
          .detail-value.location-link {
            color: #10b981;
            text-decoration: none;
            font-weight: 700;
          }
          
          .sections-container {
            display: grid;
            grid-template-cols: 1fr;
            gap: 20px;
          }
          
          .position-section {
            margin-bottom: 12px;
          }
          
          .position-title {
            font-size: 12px;
            font-weight: 900;
            color: #111827;
            border-left: 4px solid #0f172a;
            padding-left: 8px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-style: italic;
          }
          
          .players-list {
            display: grid;
            grid-template-cols: repeat(2, 1fr);
            gap: 10px;
          }
          
          .player-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
          }
          
          .player-info {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .player-number {
            font-size: 10px;
            font-weight: 900;
            background-color: #e5e7eb;
            color: #1f2937;
            padding: 3px 6px;
            border-radius: 4px;
            min-width: 14px;
            text-align: center;
          }
          
          .player-photo {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            object-fit: cover;
          }
          
          .player-photo-placeholder {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            background-color: #1a2238;
            color: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 900;
          }
          
          .player-name {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
          
          .player-role-badge {
            font-size: 8px;
            font-weight: 900;
            padding: 3px 6px;
            border-radius: 4px;
            text-transform: uppercase;
          }
          
          .player-role-badge.titular {
            background-color: #10b981;
            color: #ffffff;
          }
          
          .player-role-badge.suplente {
            background-color: #f3f4f6;
            color: #4b5563;
          }
          
          .notes-box {
            margin-top: 24px;
            border: 1px dotted #cbcbcb;
            border-radius: 12px;
            padding: 14px;
            background-color: #fafafa;
          }
          
          .notes-title {
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            color: #4b5563;
            margin-bottom: 6px;
            letter-spacing: 1px;
          }
          
          .notes-content {
            font-size: 10px;
            line-height: 1.5;
            color: #1f2937;
            white-space: pre-wrap;
          }
          
          .official-footer {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            font-size: 9px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 1px;
          }
          
          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-actions no-print">
          <div>
            <span style="font-size: 12px; font-weight: 800; text-transform: uppercase;">Vista Previa de Convocatoria</span>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #4b5563;">Revisa la información antes de guardar o compartir como PDF.</p>
          </div>
          <button class="print-btn" onclick="window.print()">Guardar como PDF / Imprimir</button>
        </div>
        
        <div class="header">
          <div class="club-branding">
            ${clubLogoHtml}
            <div>
              <h1 class="club-title">${clubName}</h1>
              <p class="document-type">Convocatoria Deportiva Oficial</p>
            </div>
          </div>
          <div class="match-status-badge">Oficial</div>
        </div>
        
        <div class="match-card">
          <div class="vs-container">
            <div class="team-block">
              ${localLogoHtml}
              <h3 class="team-name">${match.hometeam}</h3>
            </div>
            <div class="vs-badge">VS</div>
            <div class="team-block">
              ${visitorLogoHtml}
              <h3 class="team-name">${match.awayteam}</h3>
            </div>
          </div>
          
          <div class="match-details-grid">
            <div class="detail-item">
              <span class="detail-label">Fecha</span>
              <span class="detail-value">${new Date(match.date).toLocaleDateString()}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Hora Partido</span>
              <span class="detail-value">${match.time || 'A CONFIRMAR'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Hora Citación</span>
              <span class="detail-value citation">${appointmentTime || 'A CONFIRMAR'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Ubicación / Cancha</span>
              <span class="detail-value">
                ${location ? (
                  venueUrl 
                    ? `<a href="${venueUrl}" target="_blank" class="detail-value location-link">Ver en mapa 📍</a>`
                    : location
                ) : 'A CONFIRMAR'}
              </span>
            </div>
          </div>
        </div>
        
        <div class="sections-container">
          ${sectionsHtml || '<div style="text-align: center; font-style: italic; color: #9ca3af; font-size: 12px; padding: 40px 0;">No hay jugadores seleccionados en esta convocatoria.</div>'}
        </div>
        
        ${notes ? `
          <div class="notes-box">
            <div class="notes-title">Instrucciones & Apuntes Tácticos</div>
            <div class="notes-content">${notes}</div>
          </div>
        ` : ''}
        
        <div class="official-footer">
          <span>Generado automáticamente por Club Manager Pro</span>
          <span>Firma Responsable Staff Técnico</span>
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const playersUpToDate = players.filter(player => !(playerDebts.has(player.id) && !activeCommitments.has(player.id)));
  const playersWithDebts = players.filter(player => playerDebts.has(player.id) && !activeCommitments.has(player.id));

  const sortedUpToDate = [...playersUpToDate].sort((a, b) => a.name.localeCompare(b.name));
  const sortedWithDebts = [...playersWithDebts].sort((a, b) => a.name.localeCompare(b.name));

  // Convocados array for Step 2
  const summonedPlayers = players.filter(p => selection[p.id]?.selected);
  const startingLineup = summonedPlayers.filter(p => selection[p.id]?.starting).sort((a, b) => a.name.localeCompare(b.name));
  const substitutesLineup = summonedPlayers.filter(p => !selection[p.id]?.starting).sort((a, b) => a.name.localeCompare(b.name));

  const renderPlayerSelectCard = (player: Member) => {
    const selData = selection[player.id] || { selected: false, starting: false };
    const hasDebt = playerDebts.has(player.id) && !activeCommitments.has(player.id);
    return (
      <div 
        key={player.id}
        className={`p-5 rounded-[2rem] border-2 transition-all flex items-center justify-between gap-4 group cursor-pointer ${
          selData.selected 
            ? 'border-primary-600 bg-primary-600/5 shadow-md shadow-primary-900/5' 
            : 'border-[var(--surface-border)] bg-surface-card hover:border-[var(--surface-border-hover)]'
        }`}
        onClick={() => toggleSelected(player.id)}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="relative">
            {player.photourl ? (
              <img 
                referrerPolicy="no-referrer"
                src={player.photourl}
                alt={player.name}
                className={`w-12 h-12 rounded-2xl object-cover border-2 transition-all ${selData.selected ? 'border-primary-500 shadow-md' : 'border-[var(--surface-border)] opacity-60'}`}
              />
            ) : (
              <div className={`w-12 h-12 rounded-2xl border-2 transition-all flex items-center justify-center font-bold text-sm uppercase ${selData.selected ? 'border-primary-500 bg-primary-500/10 text-primary-500 shadow-md' : 'border-[var(--surface-border)] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-60'}`}>
                {getInitials(player.name)}
              </div>
            )}
            {selData.selected && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-surface-card shadow-lg animate-fade-in">
                <Check size={10} className="text-white" strokeWidth={4} />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
               <p className={`text-xs font-black uppercase italic tracking-tighter ${selData.selected ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{player.name}</p>
               {hasDebt && (
                 <div className="bg-orange-500/10 text-orange-500 p-1 rounded-lg border border-orange-500/20" title="Jugador con deuda pendiente / Compromiso activo acuerda plan de pagos">
                   <DollarSign size={8} strokeWidth={4} />
                 </div>
               )}
            </div>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1 opacity-75">
              {player.dni ? `Documento: ${player.dni}` : 'IDENTIDAD NO REGISTRADA'}
            </p>
          </div>
        </div>
        <div className="pointer-events-none">
          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selData.selected ? 'bg-primary-600 border-primary-600 text-white' : 'border-[var(--surface-border)] text-transparent'}`}>
            <Check size={12} strokeWidth={4} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-surface-ground/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-card border border-[var(--surface-border)] rounded-[2.5rem] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-primary-600/10 rounded-2xl flex items-center justify-center border border-primary-600/20 shadow-inner">
              <Users className="text-primary-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] uppercase italic tracking-tighter leading-none">Planilla de Convocados</h2>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
                {match.hometeam} vs {match.awayteam} • {new Date(match.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={actionStep === 'titulares' ? onSuccess : onClose} className="p-3 text-[var(--text-muted)] hover:text-red-500 hover:bg-surface-hover rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Wizard progress steps indicator */}
        <div className="px-8 py-3 bg-surface-ground border-b border-[var(--surface-border)] flex items-center justify-center gap-5 shrink-0 select-none">
          <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${actionStep === 'convocatoria' ? 'text-primary-600' : 'text-[var(--text-muted)]'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${actionStep === 'convocatoria' ? 'bg-primary-600 text-white' : 'bg-surface-card border border-[var(--surface-border)] text-[var(--text-muted)]'}`}>1</div>
            <span>1. Datos y Convocatoria</span>
          </div>
          
          <div className="h-0.5 w-12 bg-[var(--surface-border)]" />
          
          <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${actionStep === 'titulares' ? 'text-primary-600' : 'text-[var(--text-muted)]'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${actionStep === 'titulares' ? 'bg-primary-600 text-white' : 'bg-surface-card border border-[var(--surface-border)] text-[var(--text-muted)]'}`}>2</div>
            <span>2. Resumen Convocatoria</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-primary-600" size={36} />
              <p className="text-[var(--text-muted)] font-black uppercase text-[10px] tracking-widest opacity-40 italic">Cargando plantel...</p>
            </div>
          ) : actionStep === 'convocatoria' ? (
            /* ================= STEP 1: SELECT SQUAD PLAYERS & INPUT DETAILS ================= */
            <div className="space-y-6">
              {/* Campos de la Convocatoria en Paso 1 */}
              <div className="bg-surface-card border-[3px] border-primary-600/20 rounded-[2.5rem] p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-3 mb-1">
                  <span className="flex h-2 w-2 rounded-full bg-primary-600 animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase text-primary-600 tracking-widest italic">Detalles de la Convocatoria</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          className="flex-1 bg-surface-card border border-[var(--surface-border)] focus:border-emerald-600 rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-main)] outline-none transition-all"
                          required
                        />
                        {location && (
                          <a
                            href={location.startsWith('http://') || location.startsWith('https://') ? location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-xl border border-emerald-500/20 flex items-center justify-center transition-all cursor-pointer"
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
                      className="w-full bg-surface-card border border-[var(--surface-border)] rounded-xl p-3 text-[var(--text-main)] font-semibold text-xs outline-none focus:border-slate-500 transition-all min-h-[110px] resize-none flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Estadísticas Rápidas de Convocatoria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
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

              {/* Listado de Jugadores por Estado de Pago */}
              <div className="space-y-6">
                {/* Primera sección: Jugadores con pagos al día */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <h3 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest italic font-black uppercase tracking-widest">Jugadores al día ({sortedUpToDate.length})</h3>
                  </div>
                  {sortedUpToDate.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sortedUpToDate.map(renderPlayerSelectCard)}
                    </div>
                  ) : (
                    <div className="p-4 bg-surface-ground rounded-xl border border-dashed border-[var(--surface-border)] text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider italic">
                      No hay jugadores sin deudas pendientes.
                    </div>
                  )}
                </div>

                {/* Segunda sección: Jugadores que deben */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-[10px] font-black uppercase text-red-500 tracking-widest italic font-black uppercase tracking-widest">Jugadores con saldos pendientes ({sortedWithDebts.length})</h3>
                  </div>
                  {sortedWithDebts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sortedWithDebts.map(renderPlayerSelectCard)}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-500/5 text-emerald-500 rounded-xl border border-dashed border-emerald-500/20 text-center text-[10px] font-bold uppercase tracking-wider italic">
                      ¡Todos los jugadores están al día con sus pagos! 🎉
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ================= STEP 2: INTERACTIVE ALIGNMENT VIEW ================= */
            <div className="space-y-6 animate-fade-in text-[var(--text-main)]">
              {/* Tactical banner with instructions */}
              <div className="bg-primary-600/10 border border-primary-600/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm select-none">
                <div className="p-2.5 bg-primary-600/15 rounded-xl text-primary-600 shrink-0">
                  <Star size={18} fill="currentColor" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary-600 italic">Pizarra Táctica (Paso 2 de 2)</h4>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5 leading-relaxed">
                    Toca a cualquier jugador convocado para alternar entre <span className="text-emerald-500 font-extrabold">Titulares</span> y <span className="text-amber-500 font-extrabold">Suplentes</span>. Recuerda que solo se permiten un máximo de <span className="text-emerald-600 font-black underline">11 titulares</span> en cancha.
                  </p>
                </div>
              </div>

              {/* Match and convocatoria details board */}
              <div className="bg-surface-ground border border-[var(--surface-border)] rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2 mb-2">
                  <span className="flex h-2 w-2 rounded-full bg-primary-600" />
                  <h4 className="text-[10px] font-black uppercase text-primary-500 tracking-widest italic font-black uppercase tracking-widest">Información Oficial de la Citación</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-card rounded-xl p-4 border border-[var(--surface-border)] flex flex-col justify-center shadow-sm">
                    <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Hora de Citación</span>
                    <span className="text-sm font-black uppercase text-[var(--text-main)] mt-1">{appointmentTime || 'NO DEFINIDA'}</span>
                  </div>

                  <div className="bg-surface-card rounded-xl p-4 border border-[var(--surface-border)] flex items-center justify-between shadow-sm">
                    <div>
                      <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Ubicación del Partido</span>
                      <span className="block text-xs font-black text-[var(--text-main)] mt-1">{location || 'NO DEFINIDA'}</span>
                    </div>
                    {location && (
                      <a
                         href={location.startsWith('http://') || location.startsWith('https://') ? location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-lg border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                        title="Ver en Google Maps"
                      >
                        <MapPin size={12} />
                        <span>Ver mapa</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-surface-card rounded-xl p-4 border border-[var(--surface-border)] shadow-sm">
                  <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Apuntes Tácticos & Observaciones</span>
                  <p className="text-xs font-semibold text-[var(--text-main)] mt-2 whitespace-pre-line italic leading-relaxed">
                    {notes || 'Sin observaciones cargadas.'}
                  </p>
                </div>
              </div>

              {/* Interactive columns layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Column Titulares */}
                <div className="bg-emerald-500/[0.01] border-2 border-emerald-500/20 rounded-[2rem] p-5 space-y-4 shadow-sm min-h-[300px]">
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
                          className="p-3 bg-surface-card hover:bg-surface-hover hover:border-amber-500/30 border border-emerald-500/30 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:translate-x-1 group"
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              referrerPolicy="no-referrer"
                              src={player.photourl || getInitialsSvg(player.name)}
                              alt={player.name}
                              className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-500"
                            />
                            <div>
                              <p className="text-xs font-black uppercase text-emerald-600">{player.name}</p>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">{player.frequent_position || 'Sin puesto'}</span>
                            </div>
                          </div>
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-black flex items-center gap-1 group-hover:text-amber-550 group-hover:bg-amber-500/5 group-hover:border-amber-500/20 transition-all">
                            <Star size={10} fill="currentColor" />
                            Titular
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs font-semibold text-[var(--text-muted)] italic uppercase">No hay titulares designados. Toca jugadores del banco para incluirlos.</div>
                  )}
                </div>

                {/* Column Suplentes */}
                <div className="bg-surface-ground border border-[var(--surface-border)] rounded-[2rem] p-5 space-y-4 shadow-sm min-h-[300px]">
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
                          className="p-3 bg-surface-card hover:bg-emerald-550/5 hover:border-emerald-500/30 border border-[var(--surface-border)] rounded-xl flex items-center justify-between cursor-pointer transition-all hover:translate-x-1 group"
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              referrerPolicy="no-referrer"
                              src={player.photourl || getInitialsSvg(player.name)}
                              alt={player.name}
                              className="w-10 h-10 rounded-lg object-cover border border-[var(--surface-border)] opacity-80"
                            />
                            <div>
                              <p className="text-xs font-black uppercase text-[var(--text-main)] leading-none mb-1">{player.name}</p>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">{player.frequent_position || 'Sin puesto'}</span>
                            </div>
                          </div>
                          <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] border border-[var(--surface-border)] px-2 py-0.5 rounded uppercase font-black group-hover:text-emerald-500 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
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
        <div className="p-6 md:p-8 border-t border-[var(--surface-border)] bg-surface-card/80 backdrop-blur-md flex justify-between items-center sticky bottom-0 shrink-0">
          <div className="flex items-center gap-2">
            {actionStep === 'convocatoria' && !isFormValid ? (
              <div className="flex items-center gap-2 text-rose-500 animate-pulse">
                <Info size={14} className="text-rose-500 shrink-0" />
                <p className="text-[9px] font-black uppercase tracking-widest italic leading-tight max-w-[280px] md:max-w-md">
                  Complete todos los campos requeridos antes de generar el PDF
                </p>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 text-[var(--text-muted)] opacity-75">
                <Info size={14} className="text-primary-500 shrink-0" />
                <p className="text-[8px] font-black uppercase tracking-widest italic leading-tight">
                  Al confirmarse, la plantilla podrá ser visualizada en los reportes de juego.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            {actionStep === 'titulares' ? (
              <button 
                onClick={() => setActionStep('convocatoria')}
                className="px-6 py-4 border border-[var(--surface-border)] hover:border-[var(--text-muted)] hover:bg-surface-hover rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2 transition-all"
              >
                <ChevronLeft size={14} />
                <span>Volver</span>
              </button>
            ) : (
              <button onClick={onClose} className="px-6 py-4 text-[9px] font-black uppercase text-[var(--text-muted)] hover:text-red-500 transition-all tracking-widest">Cerrar</button>
            )}

            {actionStep === 'convocatoria' && (
              <button
                type="button"
                disabled={!isFormValid}
                onClick={handleExportPDF}
                className={`px-6 py-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md italic border ${
                  isFormValid 
                    ? 'bg-emerald-600/10 hover:bg-emerald-650/20 text-emerald-500 border-emerald-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-750 opacity-60 cursor-not-allowed'
                }`}
              >
                <FileText size={14} />
                <span>Exportar PDF</span>
              </button>
            )}

            {actionStep === 'convocatoria' ? (
              <button 
                disabled={isSaving || !isFormValid}
                onClick={handleSave}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-30 disabled:hover:bg-primary-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md italic"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar y ver Resumen</span>
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            ) : (
              <button 
                disabled={isSaving}
                onClick={handleFinalize}
                className="px-10 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-30 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-md italic animate-fade-in"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Finalizar Convocatoria</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConvocatoriaModal;
