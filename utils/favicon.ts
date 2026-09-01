// Helper robusto para actualizar favicon y título de la aplicación en todos los navegadores
export const updateAppFaviconAndTitle = (logoUrl?: string | null, clubName?: string | null) => {
  if (typeof document === 'undefined') return;

  const defaultFavicon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='25' fill='%23ec4899'/><path d='M50 15 L25 25 V50 C25 68 36 80 50 85 C64 80 75 68 75 50 V25 L50 15 Z' fill='white'/><path d='M50 22 L31 30 V48 C31 62 40 73 50 78 C60 73 69 62 69 48 V30 L50 22 Z' fill='%230f172a'/><text x='50' y='58' font-family='system-ui, sans-serif' font-size='32' font-weight='900' fill='white' text-anchor='middle'>P</text></svg>";

  const targetLogo = logoUrl && logoUrl.trim().length > 0 ? logoUrl : defaultFavicon;

  // 1. Guardar en localStorage para disponibilidad instantánea previa al render
  try {
    if (logoUrl && logoUrl.trim().length > 0) {
      localStorage.setItem('club_manager_custom_logo', logoUrl);
    }
    if (clubName && clubName.trim().length > 0) {
      localStorage.setItem('club_manager_custom_name', clubName);
    }
  } catch {
    // Silently ignore storage quota/security errors
  }

  // 2. Función para aplicar el favicon en el DOM reemplazando los nodos viejos (fuerza a Chrome a refrescar)
  const applyFaviconHref = (href: string) => {
    // Remover todos los links existentes de favicon para forzar a Chrome a refrescar la pestaña
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(el => el.remove());

    const head = document.getElementsByTagName('head')[0] || document.documentElement;

    const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
    rels.forEach((rel) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      if (href.startsWith('data:image/svg+xml')) {
        link.type = 'image/svg+xml';
      } else if (href.startsWith('data:image/png')) {
        link.type = 'image/png';
      } else if (href.startsWith('data:image/jpeg') || href.startsWith('data:image/jpg')) {
        link.type = 'image/jpeg';
      }
      head.appendChild(link);
    });
  };

  // 3. Si es una URL externa o base64, dibujarlo en un canvas 64x64 para compatibilidad universal
  if (targetLogo.startsWith('http://') || targetLogo.startsWith('https://') || targetLogo.startsWith('data:image/')) {
    applyFaviconHref(targetLogo);

    // Renderizar en Canvas para garantizar formato PNG 64x64 estándar
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(img, 0, 0, 64, 64);
            const dataUrl = canvas.toDataURL('image/png');
            applyFaviconHref(dataUrl);
            try {
              localStorage.setItem('club_manager_custom_logo', dataUrl);
            } catch {
              // Silently ignore
            }
          }
        } catch {
          // Si hay restricción CORS de canvas, se mantiene el targetLogo original ya aplicado
        }
      };
      img.src = targetLogo;
    } catch {
      // Silently ignore
    }
  } else {
    applyFaviconHref(targetLogo);
  }

  // 4. Título de la pestaña
  if (clubName && clubName.trim().length > 0 && clubName !== 'MI CLUB') {
    document.title = `${clubName} | Club Manager`;
  } else {
    document.title = 'Club Manager Plegma';
  }
};
