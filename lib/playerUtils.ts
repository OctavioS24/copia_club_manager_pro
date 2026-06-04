
import { Member, MemberAssignment } from '../types';

export interface Assignment extends MemberAssignment {
  gender: string;
  number?: number;
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getInitialsSvg(name: string): string {
  const initials = getInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="100%" height="100%" fill="#161C28"/>
    <text x="50%" y="54%" font-size="75" font-family="system-ui, -apple-system, sans-serif" font-weight="900" fill="#e7567b" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Filtra los miembros activos que tengan una asignación que coincida con la disciplina, género y categoría.
 */
export function getPlayersByCategory(
  members: Member[], 
  discipline: string, 
  gender: string, 
  category: string,
  disciplineId?: string,
  categoryId?: string
): Member[] {
  return members.filter(member => {
    // Solo miembros activos
    if (member.status !== 'Active') return false;
    
    const assignments = member.assignments as unknown as Assignment[];
    if (!Array.isArray(assignments)) return false;
    
    return assignments.some(assignment => {
      // Normalización básica para comparación robusta
      const aDisc = (assignment.discipline || '').trim().toUpperCase();
      const dTarget = (discipline || '').trim().toUpperCase();
      
      const mGender = (member.gender || '').trim().toUpperCase();
      const gTarget = (gender || '').trim().toUpperCase();
      
      const aCat = (assignment.category || '').trim().toUpperCase();
      const cTarget = (category || '').trim().toUpperCase();

      // Verificación por ID (más robusta)
      const aDiscId = (assignment as any).discipline_id || (assignment as any).disciplineId;
      const aCatId = (assignment as any).category_id || (assignment as any).categoryId;

      const matchesDisc = (disciplineId && aDiscId === disciplineId) || (aDisc === dTarget && dTarget !== '');
      const matchesGender = mGender === gTarget;
      const matchesCat = (categoryId && aCatId === categoryId) || (aCat === cTarget && cTarget !== '');
      
      return matchesDisc && matchesGender && matchesCat;
    });
  });
}
