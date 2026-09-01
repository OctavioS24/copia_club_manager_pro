// Helper unificado para actualizar favicon y título de la aplicación en tiempo real
export const updateAppFaviconAndTitle = (logoUrl?: string | null, clubName?: string | null) => {
  if (typeof document === 'undefined') return;

  // 1. Manejo y actualización de todos los tags de favicon (icon, apple-touch-icon, shortcut icon)
  let iconLink = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (!iconLink) {
    iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  }

  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.id = 'app-favicon';
    iconLink.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(iconLink);
  }

  const defaultFavicon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='25' fill='%23ec4899'/><path d='M50 15 L25 25 V50 C25 68 36 80 50 85 C64 80 75 68 75 50 V25 L50 15 Z' fill='white'/><path d='M50 22 L31 30 V48 C31 62 40 73 50 78 C60 73 69 62 69 48 V30 L50 22 Z' fill='%230f172a'/><text x='50' y='58' font-family='system-ui, sans-serif' font-size='32' font-weight='900' fill='white' text-anchor='middle'>P</text></svg>";

  const targetLogo = logoUrl && logoUrl.trim().length > 0 ? logoUrl : defaultFavicon;

  // Guardar en localStorage para disponibilidad instantánea previa al mount
  try {
    if (logoUrl && logoUrl.trim().length > 0) {
      localStorage.setItem('club_manager_custom_logo', logoUrl);
    }
    if (clubName && clubName.trim().length > 0) {
      localStorage.setItem('club_manager_custom_name', clubName);
    }
  } catch (e) {
    // LocalStorage failover
  }

  iconLink.href = targetLogo;
  if (targetLogo.startsWith('data:image/svg+xml')) {
    iconLink.type = 'image/svg+xml';
  } else if (targetLogo.startsWith('data:image/png')) {
    iconLink.type = 'image/png';
  } else if (targetLogo.startsWith('data:image/jpeg') || targetLogo.startsWith('data:image/jpg')) {
    iconLink.type = 'image/jpeg';
  } else {
    iconLink.removeAttribute('type');
  }

  // 2. Título de la pestaña
  if (clubName && clubName.trim().length > 0 && clubName !== 'MI CLUB') {
    document.title = `${clubName} | Club Manager`;
  } else {
    document.title = 'Club Manager Plegma';
  }
};
