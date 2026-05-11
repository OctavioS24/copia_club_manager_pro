
/**
 * Utilidades para el manejo dinámico de colores y temas.
 * Cumple con estándares WCAG y permite variaciones inteligentes.
 */

export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

export const getLuminance = (r: number, g: number, b: number) => {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

/**
 * Retorna si el color es "brillante" o "claro".
 */
export const isBright = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.6; // Umbral de brillo
};

/**
 * Calcula si el texto sobre este fondo debe ser blanco o negro.
 */
export const getContrastText = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

/**
 * Genera una variante más clara o más oscura.
 * @param hex Color hex
 * @param factor 0 a 1 para aclarar, -1 a 0 para oscurecer
 */
export const adjustColor = (hex: string, factor: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = factor > 0 ? Math.round(rgb.r + (255 - rgb.r) * factor) : Math.round(rgb.r * (1 + factor));
  const g = factor > 0 ? Math.round(rgb.g + (255 - rgb.g) * factor) : Math.round(rgb.g * (1 + factor));
  const b = factor > 0 ? Math.round(rgb.b + (255 - rgb.b) * factor) : Math.round(rgb.b * (1 + factor));
  
  const clamp = (val: number) => Math.max(0, Math.min(255, val));
  
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
};

/**
 * Genera string rgba.
 */
export const hexToRgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};
