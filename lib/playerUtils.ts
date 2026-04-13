
import { Member, MemberAssignment } from '../types';

export interface Assignment extends MemberAssignment {
  gender: string;
  number?: number;
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
