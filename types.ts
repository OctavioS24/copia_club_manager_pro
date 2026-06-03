
export type AppRole = 'ADMIN' | 'COORDINATOR' | 'COACH' | 'PHYSICAL_TRAINER' | 'MEDICAL' | 'PLAYER' | 'DELEGATE';

export interface Metric {
  id: string;
  name: string;
  weight: number;
}

export interface Category {
  id: string;
  name: string;
  metrics: Metric[];
}

export interface Branch {
  gender: 'Masculino' | 'Femenino';
  enabled: boolean;
  categories: Category[];
}

export interface Discipline {
  id: string;
  name: string;
  sportType: 'Fútbol' | 'Básquet' | 'Rugby' | 'Vóley' | 'Hockey' | 'Tenis' | 'Otro';
  iconUrl: string;
  branches: Branch[];
}

export interface ClubConfig {
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  disciplines: Discipline[];
}

export interface Tutor {
  name: string;
  dni: string;
  relationship: 'Padre' | 'Madre' | 'Tutor Legal' | 'Otro';
  phone: string;
  email?: string;
}

export interface PlayerContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
}

export interface Assignment {
  id: string;
  discipline_id: string;
  category_id: string;
  role: AppRole;
}

export interface MemberAssignment {
  discipline: string;
  category: string;
  position: string;
  role?: AppRole;
  discipline_id?: string;
  category_id?: string;
  dorsal?: string;
  plays_since_year?: string;
  skilled_leg?: string;
  training_days_per_week?: string;
  gym_attendance?: boolean;
  gym_frequency?: string;
  is_main?: boolean;
}

export interface DisciplinePosition {
  id: string;
  discipline: string;
  categoryId?: string;
  position: string;
  order: number;
  created_at?: string;
}

export interface Member {
  id: string;
  name: string;
  dni: string;
  gender: 'Masculino' | 'Femenino' | 'Otro';
  birthdate: string;
  email: string;
  phone: string;
  photourl: string;
  address?: string;
  city?: string;
  province?: string;
  postalcode?: string;
  bloodtype?: string;
  medicalinsurance?: string;
  weight?: string;
  height?: string;
  tutor?: Tutor;
  assignments: MemberAssignment[];
  status: 'Active' | 'Inactive' | 'Pending';
  created_at: string;
  systemrole: 'STAFF' | 'Socio' | 'Externo';
  canlogin: boolean;
  username?: string;
  stats: Record<string, number>;
  overallrating?: number;
  dorsal?: string;
  plays_since_year?: string;
  frequent_position?: string;
  skilled_leg?: string;
  injury_history?: string;
  training_days_per_week?: string;
  gym_attendance?: boolean;
  gym_frequency?: string;
  assigned_categories_sports?: string[];
  carnet_number?: string;
  school_name?: string;
  school_shift?: string;
  school_schedule?: string;
  extra_activity?: string;
  extra_activity_schedule?: string;
  school_contact?: string;
  contacts_list?: PlayerContact[];
  has_preexisting_condition?: boolean;
  preexisting_condition_details?: string;
  medical_file_url?: string;
  has_scholarship?: boolean;
  scholarship_type_id?: string;
  scholarship_details?: string;
  scholarship_attachment_url?: string;
  scholarship_start_date?: string;
  scholarship_end_date?: string;
}

export interface MedicalHistoryItem {
  id: string;
  date: string;
  is_fit: boolean;
  expiry_date: string;
  notes: string;
  professional_name: string;
  emac_date?: string;
  process_number?: string;
}

export interface MedicalRecord {
  is_fit: boolean;
  last_checkup: string;
  expiry_date: string;
  notes: string;
  emac_date?: string;
  process_number?: string;
  history: MedicalHistoryItem[];
}

export interface InjuryType {
  id: string;
  name: string;
}

export interface PlayerInjury {
  id: string;
  player_id: string;
  type_id: string;
  injury_date: string;
  comment?: string;
  attachments?: string[];
  estimated_recovery?: string;
  release_date?: string;
  injury_type?: InjuryType;
}

export interface PlayerPhysiotherapy {
  id?: string;
  member_id: string;
  in_physiotherapy: boolean;
  sessions_requested: number;
  sessions_completed: number;
  status: 'cumplidas' | 'no cumplidas';
  medical_order_url?: string;
  discharge_url?: string;
  treatment_date: string;
  notes?: string;
}

export interface Player {
  id: string;
  name: string;
  dni: string;
  number: string;
  position: string;
  discipline: string;
  gender: string;
  category: string;
  photourl: string;
  email: string;
  overallrating: number;
  stats: Record<string, number>;
  medical?: MedicalRecord;
  status: string;
  created_at: string;
}

export interface Fixture {
  id: string;
  discipline: string;
  category: string;
  opponent: string;
  date: string;
  venue: string;
  competition: string;
  result: string;
}

export interface TeamStructure {
  id: string;
  discipline: string;
  gender: string;
  category: string;
  coach: string;
  physical_trainer: string;
  medical_staff: string;
  players_count: number;
}

export interface MemberFee {
  id: string;
  member_id: string;
  member?: Member;
  amount: number;
  period: string;
  status: 'Paid' | 'Pending' | 'Late' | 'Anulado';
  due_date: string;
  payment_date?: string | null;
  payment_method?: string;
  receipt_url?: string;
  reference?: string;
  concept?: string;
  comment?: string;
  void_reason?: string;
  is_voided?: boolean;
}

export type TournamentType = 'Professional' | 'Internal';
export type MatchStatus = 'Scheduled' | 'Finished' | 'Canceled' | 'Suspended';
export type MatchEventType = string;

export interface TournamentSettings {
  has_groups: boolean;
  groups_count: number;
  advancing_per_group: number;
  has_playoffs: boolean;
  playoff_start: 'F' | 'SF' | 'QF' | 'R16';
  dates_count?: number;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  name: string;
  member_ids: string[];
}

export interface MatchFixture {
  id: string;
  rival: string;
  date: string;
  condition: 'Local' | 'Visitante';
}

export interface PlayerStats {
  goals: number;
  yellow_cards: number;
  red_cards: number;
}

export interface Tournament {
  id: string;
  name: string;
  type?: TournamentType;
  discipline?: string;
  discipline_id?: string;
  category_id?: string;
  gender?: 'Masculino' | 'Femenino';
  status?: 'Open' | 'Finished';
  settings?: TournamentSettings;
  fixture_base?: MatchFixture[];
  assigned_categories?: string[];
  category_conditions?: Record<string, 'Normal' | 'Inverted'>;
  created_at: string;
  // Alias for backward compatibility
  disciplineid?: string;
  categoryid?: string;
  assignedcategories?: string[];
}

export interface Rival {
  id: string;
  name: string;
  discipline: string;
  address_url?: string;
  logo_url?: string;
  created_at: string;
}

export interface Match {
  id: string;
  tournamentid: string;
  categoryid?: string;
  hometeam: string;
  awayteam: string;
  home_participant_id?: string;
  away_participant_id?: string;
  homescore?: number;
  awayscore?: number;
  date: string;
  time?: string;
  venue?: string;
  status: MatchStatus;
  group?: string; 
  stage?: string; 
  is_overridden?: boolean;
  original_match_id?: string;
  suspension_reason?: string;
  original_date?: string;
  events?: MatchEvent[];
  // Alias for backward compatibility
  home_team?: string;
  away_team?: string;
  home_score?: number;
  away_score?: number;
  tournament_id?: string;
  category_id?: string;
}

export interface MatchSquad {
  id: string;
  match_id: string;
  tournament_id?: string;
  category_id?: string;
  discipline: string;
  notes?: string;
  players?: MatchSquadPlayer[];
  appointment_time?: string;
  location?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MatchSquadPlayer {
  id: string;
  squad_id: string;
  player_id: string;
  is_starting: boolean;
  minutes_played: number;
  player?: Member;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  player_id?: string;
  player_name?: string;
  type: MatchEventType;
  minute?: number;
  notes?: string;
  is_rival?: boolean;
  squad_player_id?: string;
  additional_data?: Record<string, any>;
}

export interface ScholarshipType {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  created_at?: string;
}

export interface InscriptionConfig {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  category_ids?: string[]; // IDs de categorías asociadas (opcional)
  created_at?: string;
}

