
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
}

export interface MedicalHistoryItem {
  id: string;
  date: string;
  is_fit: boolean;
  expiry_date: string;
  notes: string;
  professional_name: string;
}

export interface MedicalRecord {
  is_fit: boolean;
  last_checkup: string;
  expiry_date: string;
  notes: string;
  history: MedicalHistoryItem[];
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
  status: 'Paid' | 'Pending' | 'Late';
  due_date: string;
  payment_date?: string | null;
  payment_method?: string;
  receipt_url?: string;
  reference?: string;
}

export type TournamentType = 'Professional' | 'Internal';
export type MatchStatus = 'Scheduled' | 'Finished' | 'Canceled';
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
  type: TournamentType;
  discipline_id: string;
  category_id?: string;
  gender: 'Masculino' | 'Femenino';
  status: 'Open' | 'Finished';
  settings: TournamentSettings;
  fixture_base?: MatchFixture[];
  assigned_categories?: string[];
  created_at: string;
  // Alias for backward compatibility if needed
  disciplineid?: string;
  categoryid?: string;
  assignedcategories?: string[];
}

export interface Rival {
  id: string;
  name: string;
  discipline: string;
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
  events?: MatchEvent[];
  // Alias for backward compatibility
  home_team?: string;
  away_team?: string;
  home_score?: number;
  away_score?: number;
  tournament_id?: string;
  category_id?: string;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string;
  type: MatchEventType;
  minute?: number;
  notes?: string;
}
