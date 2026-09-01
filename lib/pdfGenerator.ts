import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Match, ClubConfig, Member } from '../types';
import { getInitials } from './playerUtils';

export interface ConvocatoriaPdfData {
  match: Match;
  clubInfo: ClubConfig | null;
  rivalLogo?: string;
  discipline?: string;
  appointmentTime?: string;
  location?: string;
  notes?: string;
  selectedPlayers: Member[];
  startersMap?: Record<string, boolean>;
}

export const generateConvocatoriaHtml = (data: ConvocatoriaPdfData, isForPrintWindow: boolean = false): string => {
  const {
    match,
    clubInfo,
    rivalLogo,
    discipline,
    appointmentTime,
    location,
    notes,
    selectedPlayers,
    startersMap = {}
  } = data;

  const clubName = clubInfo?.name || 'Club Manager Pro';
  const clubLogo = clubInfo?.logo_url || '';
  
  // Determine local and visitor logos
  const isHome = match.hometeam.toUpperCase() === clubName.toUpperCase();
  const localLogo = isHome ? clubLogo : rivalLogo;
  const visitorLogo = isHome ? rivalLogo : clubLogo;

  const arqueros: Member[] = [];
  const defensores: Member[] = [];
  const mediocampistas: Member[] = [];
  const delanteros: Member[] = [];
  const otros: Member[] = [];

  selectedPlayers.forEach(p => {
    const matchCategoryId = match.category_id || (match as any).categoryid;
    const assignment = p.assignments?.find((a: any) => {
      const catMatch = matchCategoryId && (a.category_id === matchCategoryId || a.categoryId === matchCategoryId);
      const discNameMatch = discipline && a.discipline?.toUpperCase() === discipline.toUpperCase();
      return catMatch || discNameMatch;
    });
    
    const posStr = (assignment?.position || p.frequent_position || (p as any).position || 'SIN PUESTO').toUpperCase().trim();
    
    if (posStr.includes('ARQ') || posStr.includes('PORTERO') || posStr.includes('GOALKEEPER') || posStr === 'GK' || posStr === 'PO') {
      arqueros.push(p);
    } else if (posStr.includes('DEF') || posStr.includes('LATERAL') || posStr.includes('CENTRAL') || posStr.includes('ZAGUERO') || posStr.includes('LIBERO') || posStr.includes('LÍBERO') || posStr === 'DF' || posStr === 'CB' || posStr === 'LB' || posStr === 'RB') {
      defensores.push(p);
    } else if (posStr.includes('MED') || posStr.includes('VOLANTE') || posStr.includes('VOL') || posStr.includes('CENTRO') || posStr.includes('ENGANCHE') || posStr.includes('CINCO') || posStr.includes('PIVOTE') || posStr.includes('INTERIOR') || posStr === 'MC' || posStr === 'MF' || posStr === 'CM' || posStr === 'DM' || posStr === 'AM' || posStr === 'MED') {
      mediocampistas.push(p);
    } else if (posStr.includes('DEL') || posStr.includes('DELANTERO') || posStr.includes('EXTREMO') || posStr.includes('PUNTA') || posStr.includes('CENTRODELANTERO') || posStr === 'DL' || posStr === 'ST' || posStr === 'FW') {
      delanteros.push(p);
    } else {
      otros.push(p);
    }
  });

  const formatPlayerRow = (p: Member) => {
    const matchCategoryId = match.category_id || (match as any).categoryid;
    const assignment = p.assignments?.find((a: any) => {
      const catMatch = matchCategoryId && (a.category_id === matchCategoryId || a.categoryId === matchCategoryId);
      const discNameMatch = discipline && a.discipline?.toUpperCase() === discipline.toUpperCase();
      return catMatch || discNameMatch;
    });
    
    const dorsal = assignment?.dorsal || p.dorsal || 'S/N';
    const posStr = assignment?.position || p.frequent_position || (p as any).position || 'Sin puesto';
    const playerName = (p.name || `${(p as any).first_name || ''} ${(p as any).last_name || ''}`).trim() || 'Jugador';
    const isStarting = startersMap[p.id];
    
    const initials = getInitials(playerName);
    const photoHtml = p.photourl 
      ? `<img src="${p.photourl}" class="player-photo" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="player-photo-placeholder" style="display:none;">${initials}</div>`
      : `<div class="player-photo-placeholder">${initials}</div>`;

    return `
      <div class="player-row">
        <div class="player-info">
          <span class="player-number">${dorsal}</span>
          ${photoHtml}
          <div class="player-text">
            <span class="player-name">${playerName}</span>
            <span class="player-position">${posStr}</span>
          </div>
        </div>
        ${isStarting !== undefined ? `
          <span class="player-role-badge ${isStarting ? 'titular' : 'suplente'}">
            ${isStarting ? 'Titular' : 'Suplente'}
          </span>
        ` : ''}
      </div>
    `;
  };

  const renderSection = (title: string, playersList: Member[]) => {
    if (playersList.length === 0) return '';
    return `
      <div class="position-section">
        <div class="position-title">${title} (${playersList.length})</div>
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
    renderSection('Otros Convocados', otros)
  ].join('');

  const isLocationUrl = location && (location.startsWith('http://') || location.startsWith('https://') || location.includes('maps.google') || location.includes('maps.app'));
  const locationDisplayText = isLocationUrl ? 'Ver en Google Maps 📍' : (location || 'A CONFIRMAR');
  const locationUrl = isLocationUrl ? location : (location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '');

  const localInitial = match.hometeam ? match.hometeam.substring(0, 2).toUpperCase() : 'L';
  const visitorInitial = match.awayteam ? match.awayteam.substring(0, 2).toUpperCase() : 'V';
  const clubInitial = clubName ? clubName.substring(0, 2).toUpperCase() : 'CP';

  const localLogoHtml = localLogo 
    ? `<img src="${localLogo}" class="team-logo" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="team-logo-placeholder" style="display:none;">${localInitial}</div>` 
    : `<div class="team-logo-placeholder">${localInitial}</div>`;

  const visitorLogoHtml = visitorLogo 
    ? `<img src="${visitorLogo}" class="team-logo" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="team-logo-placeholder" style="display:none;">${visitorInitial}</div>` 
    : `<div class="team-logo-placeholder">${visitorInitial}</div>`;

  const clubLogoHtml = clubLogo 
    ? `<img src="${clubLogo}" class="club-logo" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="club-logo-placeholder" style="display:none;">${clubInitial}</div>` 
    : `<div class="club-logo-placeholder">${clubInitial}</div>`;

  const formattedDate = match.date 
    ? new Date(match.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : 'A CONFIRMAR';

  const formattedTime = match.time ? `${match.time.slice(0, 5)} hs` : 'A CONFIRMAR';
  const formattedAppointment = appointmentTime ? `${appointmentTime.slice(0, 5)} hs` : 'A CONFIRMAR';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Convocatoria - ${clubName}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: Arial, Helvetica, -apple-system, sans-serif;
          color: #0f172a;
          background-color: #ffffff;
          padding: ${isForPrintWindow ? '24px 30px' : '20px 24px'};
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          width: ${isForPrintWindow ? 'auto' : '794px'};
          max-width: 100%;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        
        .club-branding {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        
        .club-logo {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        
        .club-logo-placeholder {
          width: 48px;
          height: 48px;
          background-color: #0f172a;
          color: #ffffff;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
        }
        
        .club-title {
          font-size: 20px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          line-height: 1.1;
          letter-spacing: 0.2px;
        }
        
        .document-type {
          margin-top: 3px;
          font-size: 10px;
          color: #475569;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .match-status-badge {
          background-color: #059669;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .print-actions {
          background-color: #f1f5f9;
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 10px;
          margin-bottom: 18px;
          border: 1px solid #e2e8f0;
        }
        
        .print-btn {
          background-color: #0f172a;
          color: white;
          border: none;
          padding: 8px 18px;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 6px;
          cursor: pointer;
        }
        
        .match-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 18px;
          margin-bottom: 18px;
        }
        
        .vs-container {
          display: flex;
          justify-content: space-around;
          align-items: center;
          margin-bottom: 14px;
        }
        
        .team-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 44%;
          text-align: center;
        }
        
        .team-logo {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 50%;
          margin-bottom: 6px;
          border: 1.5px solid #cbd5e1;
        }
        
        .team-logo-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: #e2e8f0;
          color: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 6px;
          border: 1.5px solid #cbd5e1;
        }
        
        .team-name {
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          line-height: 18px;
        }

        .team-label {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
          line-height: 12px;
        }
        
        .vs-badge {
          font-size: 12px;
          font-weight: 800;
          color: #475569;
          background-color: #e2e8f0;
          padding: 6px 10px;
          border-radius: 8px;
          line-height: 14px;
        }
        
        .match-details-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 14px;
        }
        
        .detail-item {
          display: flex;
          flex-direction: column;
          justify-content: center;
          background-color: #ffffff;
          padding: 10px 12px;
          min-height: 58px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          box-sizing: border-box;
        }
        
        .detail-label {
          font-size: 8.5px;
          line-height: 12px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.4px;
          margin-bottom: 4px;
          display: block;
        }
        
        .detail-value {
          font-size: 11px;
          line-height: 16px;
          font-weight: 800;
          color: #0f172a;
          display: block;
          word-break: break-word;
        }

        .detail-link {
          color: #059669;
          text-decoration: none;
          font-weight: 800;
          line-height: 16px;
          display: inline-block;
        }
        
        .detail-item.citation-item {
          background-color: #ecfdf5;
          border: 1px solid #a7f3d0;
        }

        .detail-value.citation {
          color: #059669;
          font-weight: 900;
          line-height: 16px;
        }
        
        .sections-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        
        .position-section {
          margin-bottom: 4px;
        }
        
        .position-title {
          font-size: 12px;
          line-height: 16px;
          font-weight: 800;
          color: #0f172a;
          border-left: 4px solid #0f172a;
          padding-left: 8px;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .players-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 10px;
        }
        
        .player-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          min-height: 50px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-sizing: border-box;
        }
        
        .player-info {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }
        
        .player-number {
          font-size: 10px;
          line-height: 14px;
          font-weight: 800;
          background-color: #e2e8f0;
          color: #0f172a;
          padding: 4px 6px;
          border-radius: 5px;
          min-width: 26px;
          text-align: center;
          flex-shrink: 0;
        }
        
        .player-photo {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid #cbd5e1;
        }
        
        .player-photo-placeholder {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background-color: #1e293b;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .player-text {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 4px;
        }
        
        .player-name {
          font-size: 11px;
          line-height: 15px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          display: block;
          margin-bottom: 2px;
        }

        .player-position {
          font-size: 8.5px;
          line-height: 12px;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          display: block;
        }
        
        .player-role-badge {
          font-size: 8px;
          line-height: 12px;
          font-weight: 800;
          padding: 3px 7px;
          border-radius: 4px;
          text-transform: uppercase;
          flex-shrink: 0;
          margin-left: 6px;
        }
        
        .player-role-badge.titular {
          background-color: #059669;
          color: #ffffff;
        }
        
        .player-role-badge.suplente {
          background-color: #e2e8f0;
          color: #475569;
        }
        
        .notes-box {
          margin-top: 14px;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          background-color: #f8fafc;
        }
        
        .notes-title {
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
          margin-bottom: 3px;
          letter-spacing: 0.3px;
        }
        
        .notes-content {
          font-size: 9.5px;
          line-height: 1.35;
          color: #1e293b;
          white-space: pre-wrap;
        }
        
        .official-footer {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
          font-size: 8px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.3px;
        }
        
        @media print {
          body {
            padding: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      ${isForPrintWindow ? `
        <div class="print-actions no-print">
          <div>
            <span style="font-size: 12px; font-weight: 800; text-transform: uppercase;">Vista Previa de Convocatoria</span>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #475569;">Revisa la información antes de guardar o compartir como PDF.</p>
          </div>
          <button class="print-btn" onclick="window.print()">Guardar como PDF / Imprimir</button>
        </div>
      ` : ''}
      
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
            <span class="team-label">Local</span>
          </div>
          <div class="vs-badge">VS</div>
          <div class="team-block">
            ${visitorLogoHtml}
            <h3 class="team-name">${match.awayteam}</h3>
            <span class="team-label">Visitante</span>
          </div>
        </div>
        
        <div class="match-details-grid">
          <div class="detail-item">
            <span class="detail-label">Fecha</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Hora Partido</span>
            <span class="detail-value">${formattedTime}</span>
          </div>
          <div class="detail-item citation-item">
            <span class="detail-label" style="color: #059669;">Citación DT</span>
            <span class="detail-value citation">${formattedAppointment}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ubicación / Cancha</span>
            <span class="detail-value" title="${location || 'A CONFIRMAR'}">
              ${isLocationUrl && locationUrl ? `<a href="${locationUrl}" target="_blank" class="detail-link">${locationDisplayText}</a>` : locationDisplayText}
            </span>
          </div>
        </div>
      </div>
      
      <div class="sections-container">
        ${sectionsHtml || '<div style="text-align: center; font-style: italic; color: #94a3b8; font-size: 11px; padding: 24px 0;">No hay jugadores seleccionados en esta convocatoria.</div>'}
      </div>
      
      ${notes && notes.trim() ? `
        <div class="notes-box">
          <div class="notes-title">Instrucciones & Apuntes Tácticos</div>
          <div class="notes-content">${notes.trim()}</div>
        </div>
      ` : ''}
      
      <div class="official-footer">
        <span>${clubName} • Sistema de Gestión Deportiva</span>
        <span>Firma Responsable Staff Técnico</span>
      </div>
      
      ${isForPrintWindow ? `
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          }
        </script>
      ` : ''}
    </body>
    </html>
  `;
};

export const generateConvocatoriaPdfBlob = async (data: ConvocatoriaPdfData): Promise<{ blob: Blob; file: File; filename: string }> => {
  const html = generateConvocatoriaHtml(data, false);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.visibility = 'visible';
  iframe.style.opacity = '1';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('No se pudo acceder al documento del iframe');
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for fonts & images inside the iframe
    if ((iframeDoc as any).fonts && (iframeDoc as any).fonts.ready) {
      try {
        await (iframeDoc as any).fonts.ready;
      } catch {
        // ignore font ready errors
      }
    }

    const images = Array.from(iframeDoc.images);
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 500);
      });
    }));

    await new Promise(resolve => setTimeout(resolve, 150));

    const targetElement = iframeDoc.body;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const printableWidth = pageWidth - (margin * 2);
    const printableHeight = pageHeight - (margin * 2);

    const imgHeight = (canvas.height * printableWidth) / canvas.width;

    if (imgHeight <= printableHeight) {
      pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
      heightLeft -= printableHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
        heightLeft -= printableHeight;
      }
    }

    const blob = pdf.output('blob');
    const cleanHome = (data.match.hometeam || 'Local').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanAway = (data.match.awayteam || 'Visitante').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Convocatoria_${cleanHome}_vs_${cleanAway}.pdf`;

    const file = new File([blob], filename, { type: 'application/pdf' });

    return { blob, file, filename };
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
};

export interface AttendancePdfPlayer {
  id: string;
  name: string;
  dorsal?: string;
  position?: string;
  records: Record<string, string>; // date string -> 'P' | 'A' | 'J' | 'L'
  presentes: number;
  ausentes: number;
  justificados: number;
  lesionados: number;
  totalSessions: number;
  percentage: number;
}

export interface AttendancePdfData {
  clubInfo: ClubConfig | null;
  discipline: string;
  categoryName: string;
  gender?: string;
  periodLabel: string;
  dateRangeText: string;
  dates: string[];
  players: AttendancePdfPlayer[];
  overallPercentage: number;
  totalSessions: number;
  totalPlayers: number;
}

export const generateAttendanceHtml = (data: AttendancePdfData): string => {
  const {
    clubInfo,
    discipline,
    categoryName,
    gender,
    periodLabel,
    dateRangeText,
    dates,
    players,
    overallPercentage,
    totalSessions,
    totalPlayers
  } = data;

  const clubName = clubInfo?.name || 'Club Manager Pro';
  const clubLogo = clubInfo?.logo_url || '';
  const clubInitial = clubName ? clubName.substring(0, 2).toUpperCase() : 'CP';

  const clubLogoHtml = clubLogo 
    ? `<img src="${clubLogo}" class="club-logo" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="club-logo-placeholder" style="display:none;">${clubInitial}</div>` 
    : `<div class="club-logo-placeholder">${clubInitial}</div>`;

  const formatShortDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      const d = new Date(dateStr + 'T00:00:00');
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'P') {
      return '<span class="status-cell status-p">P</span>';
    }
    if (s === 'A') {
      return '<span class="status-cell status-a">A</span>';
    }
    if (s === 'J') {
      return '<span class="status-cell status-j">J</span>';
    }
    if (s === 'L') {
      return '<span class="status-cell status-l">L</span>';
    }
    return '<span class="status-cell status-dash">-</span>';
  };

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return a.name.localeCompare(b.name);
  });

  const nowFormatted = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Informe de Asistencia - ${discipline} ${categoryName}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: Arial, Helvetica, -apple-system, sans-serif;
          color: #0f172a;
          background-color: #ffffff;
          padding: 24px 28px;
          margin: 0 auto;
          width: 100%;
          max-width: 1000px;
          -webkit-font-smoothing: antialiased;
        }

        .report-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .club-logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          border-radius: 8px;
        }

        .club-logo-placeholder {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          background-color: #0f172a;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 900;
        }

        .club-details h1 {
          font-size: 18px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: -0.5px;
          color: #0f172a;
          line-height: 22px;
        }

        .club-details p {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-right {
          text-align: right;
        }

        .report-badge {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-block;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }

        .report-timestamp {
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
        }

        .summary-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
        }

        .summary-label {
          font-size: 8.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 2px;
        }

        .summary-value {
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
        }

        .summary-value.highlight {
          color: #059669;
        }

        .attendance-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
          font-size: 10px;
        }

        .attendance-table th {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          padding: 6px 4px;
          border: 1px solid #1e293b;
          text-align: center;
        }

        .attendance-table th.player-col {
          text-align: left;
          padding-left: 8px;
          width: 22%;
        }

        .attendance-table td {
          border: 1px solid #e2e8f0;
          padding: 5px 4px;
          text-align: center;
          font-weight: 700;
          vertical-align: middle;
        }

        .attendance-table td.player-col {
          text-align: left;
          padding-left: 8px;
        }

        .attendance-table tr:nth-child(even) {
          background-color: #f8fafc;
        }

        .player-info-cell {
          display: flex;
          flex-direction: column;
        }

        .player-name-text {
          font-size: 10px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .player-sub-text {
          font-size: 8px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-cell {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          font-size: 8.5px;
          font-weight: 900;
        }

        .status-p {
          background-color: #dcfce7;
          color: #15803d;
          border: 1px solid #86efac;
        }

        .status-a {
          background-color: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
        }

        .status-j {
          background-color: #fef3c7;
          color: #b45309;
          border: 1px solid #fcd34d;
        }

        .status-l {
          background-color: #e0f2fe;
          color: #0369a1;
          border: 1px solid #7dd3fc;
        }

        .status-dash {
          color: #cbd5e1;
          font-weight: 400;
        }

        .pct-badge {
          font-size: 9.5px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
          display: inline-block;
        }

        .pct-high {
          background-color: #dcfce7;
          color: #15803d;
        }

        .pct-mid {
          background-color: #fef3c7;
          color: #b45309;
        }

        .pct-low {
          background-color: #fee2e2;
          color: #b91c1c;
        }

        .legend-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 24px;
          font-size: 9px;
          font-weight: 700;
          color: #475569;
        }

        .legend-items {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 30px;
          padding-top: 10px;
        }

        .signature-box {
          border-top: 1px dashed #94a3b8;
          padding-top: 8px;
          text-align: center;
        }

        .signature-title {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #1e293b;
        }

        .signature-sub {
          font-size: 8px;
          color: #64748b;
        }

        .official-footer {
          margin-top: 24px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          color: #94a3b8;
          font-weight: 700;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="header-left">
          ${clubLogoHtml}
          <div class="club-details">
            <h1>${clubName}</h1>
            <p>${discipline} • ${categoryName} ${gender ? `(${gender})` : ''}</p>
          </div>
        </div>
        <div class="header-right">
          <div class="report-badge">Planilla de Asistencias</div>
          <div class="report-timestamp">${nowFormatted}</div>
        </div>
      </div>

      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">Período Seleccionado</span>
          <span class="summary-value" style="font-size: 11px;">${periodLabel}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Entrenamientos Realizados</span>
          <span class="summary-value">${totalSessions} Sesiones</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Plantel Evaluado</span>
          <span class="summary-value">${totalPlayers} Atletas</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Asistencia Promedio</span>
          <span class="summary-value highlight">${overallPercentage}%</span>
        </div>
      </div>

      <table class="attendance-table">
        <thead>
          <tr>
            <th class="player-col">Jugador</th>
            ${dates.length > 0 ? dates.map(d => `<th>${formatShortDate(d)}</th>`).join('') : '<th>Sin fechas</th>'}
            <th style="width: 32px;">P</th>
            <th style="width: 32px;">A</th>
            <th style="width: 32px;">J</th>
            <th style="width: 48px;">% Asist</th>
          </tr>
        </thead>
        <tbody>
          ${sortedPlayers.length > 0 ? sortedPlayers.map((p) => {
            const pctClass = p.percentage >= 80 ? 'pct-high' : p.percentage >= 60 ? 'pct-mid' : 'pct-low';
            return `
              <tr>
                <td class="player-col">
                  <div class="player-info-cell">
                    <span class="player-name-text">${p.name}</span>
                    <span class="player-sub-text">${p.position || 'Jugador'} ${p.dorsal ? `• #${p.dorsal}` : ''}</span>
                  </div>
                </td>
                ${dates.length > 0 ? dates.map(d => `
                  <td>${getStatusBadge(p.records[d])}</td>
                `).join('') : '<td>-</td>'}
                <td style="font-weight: 900; color: #15803d;">${p.presentes}</td>
                <td style="font-weight: 900; color: #b91c1c;">${p.ausentes}</td>
                <td style="font-weight: 900; color: #b45309;">${p.justificados}</td>
                <td>
                  <span class="pct-badge ${pctClass}">${p.percentage}%</span>
                </td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="${dates.length + 5}" style="padding: 20px; color: #64748b;">
                No se registraron atletas ni asistencias en este período.
              </td>
            </tr>
          `}
        </tbody>
      </table>

      <div class="legend-container">
        <div class="legend-items">
          <div class="legend-item"><span class="status-cell status-p">P</span> Presente</div>
          <div class="legend-item"><span class="status-cell status-a">A</span> Ausente</div>
          <div class="legend-item"><span class="status-cell status-j">J</span> Justificado</div>
          <div class="legend-item"><span class="status-cell status-l">L</span> Lesionado</div>
        </div>
        <div>
          Rango: <strong>${dateRangeText}</strong>
        </div>
      </div>

      <div class="signatures-grid">
        <div class="signature-box">
          <div class="signature-title">Director Técnico / Entrenador</div>
          <div class="signature-sub">Firma y Aclaración</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">Preparador Físico / Coordinador</div>
          <div class="signature-sub">Firma y Aclaración</div>
        </div>
      </div>

      <div class="official-footer">
        <span>${clubName} • Reporte Oficial de Asistencias</span>
        <span>Página 1 de 1</span>
      </div>
    </body>
    </html>
  `;
};

export const generateAttendancePdfBlob = async (data: AttendancePdfData): Promise<{ blob: Blob; file: File; filename: string }> => {
  const html = generateAttendanceHtml(data);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  // Use a wide canvas (landscape A4 equivalent or wide portrait) for attendance matrices
  const isWide = data.dates.length > 8;
  iframe.style.width = isWide ? '1123px' : '794px';
  iframe.style.height = isWide ? '794px' : '1123px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.visibility = 'visible';
  iframe.style.opacity = '1';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('No se pudo acceder al documento del iframe');
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    if ((iframeDoc as any).fonts && (iframeDoc as any).fonts.ready) {
      try {
        await (iframeDoc as any).fonts.ready;
      } catch {
        // ignore font ready error
      }
    }

    const images = Array.from(iframeDoc.images);
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 500);
      });
    }));

    await new Promise(resolve => setTimeout(resolve, 150));

    const targetElement = iframeDoc.body;
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: isWide ? 1123 : 794,
      scrollX: 0,
      scrollY: 0
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: isWide ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const printableWidth = pageWidth - (margin * 2);
    const printableHeight = pageHeight - (margin * 2);

    const imgHeight = (canvas.height * printableWidth) / canvas.width;

    if (imgHeight <= printableHeight) {
      pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
      heightLeft -= printableHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
        heightLeft -= printableHeight;
      }
    }

    const blob = pdf.output('blob');
    const cleanDisc = (data.discipline || 'Disciplina').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanCat = (data.categoryName || 'Categoria').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanPeriod = (data.periodLabel || 'Reporte').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Asistencias_${cleanDisc}_${cleanCat}_${cleanPeriod}.pdf`;

    const file = new File([blob], filename, { type: 'application/pdf' });

    return { blob, file, filename };
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
};
