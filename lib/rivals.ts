
import { supabase } from './supabase';
import { Rival } from '../types';

const normalizeName = (name: string) => name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const getRivals = async (discipline?: string): Promise<Rival[]> => {
  let query = supabase
    .from('rivals')
    .select('*')
    .order('name', { ascending: true });
  
  if (discipline) {
    query = query.eq('discipline', normalizeName(discipline));
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createRival = async (name: string, discipline: string): Promise<Rival> => {
  const { data, error } = await supabase
    .from('rivals')
    .insert([{ name, discipline: normalizeName(discipline) }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateRival = async (id: string, name: string): Promise<Rival> => {
  const { data, error } = await supabase
    .from('rivals')
    .update({ name })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteRival = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('rivals')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};
