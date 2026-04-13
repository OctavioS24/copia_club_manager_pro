
import { supabase } from './supabase';
import { DisciplinePosition } from '../types';

const normalizeName = (name: string) => name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const getPositionsByDiscipline = async (discipline: string): Promise<DisciplinePosition[]> => {
  const normalized = normalizeName(discipline);
  const { data, error } = await supabase
    .from('discipline_positions')
    .select('*')
    .eq('discipline', normalized)
    .order('order', { ascending: true });

  if (error) {
    console.error('Error fetching positions:', error);
    return [];
  }
  return data || [];
};

export const createPosition = async (discipline: string, position: string, order: number = 0): Promise<DisciplinePosition | null> => {
  const normalized = normalizeName(discipline);
  const { data, error } = await supabase
    .from('discipline_positions')
    .insert([{ discipline: normalized, position, order }])
    .select()
    .single();

  if (error) {
    console.error('Error creating position:', error);
    return null;
  }
  return data;
};

export const updatePosition = async (id: string, position: string): Promise<boolean> => {
  const { error } = await supabase
    .from('discipline_positions')
    .update({ position })
    .eq('id', id);

  if (error) {
    console.error('Error updating position:', error);
    return false;
  }
  return true;
};

export const deletePosition = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('discipline_positions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting position:', error);
    return false;
  }
  return true;
};

export const reorderPositions = async (positions: DisciplinePosition[]): Promise<boolean> => {
  const updates = positions.map((p, index) => ({
    id: p.id,
    discipline: p.discipline,
    position: p.position,
    order: index
  }));

  const { error } = await supabase
    .from('discipline_positions')
    .upsert(updates);

  if (error) {
    console.error('Error reordering positions:', error);
    return false;
  }
  return true;
};
