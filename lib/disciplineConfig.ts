import { supabase } from './supabase';

export interface ScoringRules {
  win: number;
  draw: number;
  loss: number;
}

export interface EventType {
  id: string;
  name: string;
  icon: string;
  color: string;
  statsKey: string;
}

export interface DisciplineConfig {
  id?: string;
  discipline: string;
  scoring_rules: ScoringRules;
  event_types: EventType[];
  dashboard_stats: string[];
  updated_at?: string;
}

export const DEFAULT_CONFIGS: Record<string, Partial<DisciplineConfig>> = {
  'FUTBOL': {
    scoring_rules: { win: 3, draw: 1, loss: 0 },
    event_types: [
      { id: '1', name: 'GOL', icon: 'Goal', color: '#10b981', statsKey: 'GOLES_TOTALES' },
      { id: '2', name: 'TARJETA AMARILLA', icon: 'Square', color: '#f59e0b', statsKey: 'TARJETAS_AMARILLAS' },
      { id: '3', name: 'TARJETA ROJA', icon: 'Square', color: '#ef4444', statsKey: 'TARJETAS_ROJAS' },
    ],
    dashboard_stats: ['PUNTOS_ACUMULADOS', 'GOLES_TOTALES', 'PARTIDOS_JUGADOS', 'RACHA_ACTUAL', 'TARJETAS_AMARILLAS', 'TARJETAS_ROJAS']
  },
  'BASQUET': {
    scoring_rules: { win: 2, draw: 1, loss: 1 }, // En básquet suele ser 2 por ganar, 1 por perder
    event_types: [
      { id: '1', name: 'PUNTO', icon: 'Target', color: '#f59e0b', statsKey: 'PUNTOS_TOTALES' },
      { id: '2', name: 'FALTA', icon: 'AlertTriangle', color: '#ef4444', statsKey: 'FALTAS_TOTALES' },
    ],
    dashboard_stats: ['PUNTOS_TOTALES', 'PARTIDOS_JUGADOS', 'RACHA_ACTUAL', 'FALTAS_TOTALES']
  },
  'RUGBY': {
    scoring_rules: { win: 4, draw: 2, loss: 0 },
    event_types: [
      { id: '1', name: 'ENSAYO', icon: 'Trophy', color: '#10b981', statsKey: 'ENSAYOS' },
      { id: '2', name: 'CONVERSIÓN', icon: 'Target', color: '#3b82f6', statsKey: 'PUNTOS_TOTALES' },
      { id: '3', name: 'PENAL', icon: 'Target', color: '#f59e0b', statsKey: 'PUNTOS_TOTALES' },
    ],
    dashboard_stats: ['PUNTOS_ACUMULADOS', 'ENSAYOS', 'PARTIDOS_JUGADOS', 'RACHA_ACTUAL']
  }
};

export async function getDisciplineConfig(discipline: string): Promise<DisciplineConfig | null> {
  const normalizedName = discipline.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const { data, error } = await supabase
    .from('discipline_config')
    .select('*')
    .eq('discipline', normalizedName)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      // Fallback to default if exists
      const defaultConfig = DEFAULT_CONFIGS[normalizedName];
      if (defaultConfig) {
        return {
          discipline: normalizedName,
          scoring_rules: defaultConfig.scoring_rules || { win: 3, draw: 1, loss: 0 },
          event_types: defaultConfig.event_types || [],
          dashboard_stats: defaultConfig.dashboard_stats || []
        } as DisciplineConfig;
      }
      return null;
    }
    console.error('Error fetching discipline config:', error);
    return null;
  }

  return data as DisciplineConfig;
}

export async function saveDisciplineConfig(config: DisciplineConfig): Promise<void> {
  const { error } = await supabase
    .from('discipline_config')
    .upsert(config, { onConflict: 'discipline' });

  if (error) {
    console.error('Error saving discipline config:', error);
    throw error;
  }
}

export async function getAllDisciplineConfigs(): Promise<DisciplineConfig[]> {
  const { data, error } = await supabase
    .from('discipline_config')
    .select('*');

  if (error) {
    console.error('Error fetching all discipline configs:', error);
    return [];
  }

  return data as DisciplineConfig[];
}
