
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
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
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

export interface Member {
  id: string;
  name: string;
  dni: string;
  gender: 'Masculino' | 'Femenino' | 'Otro';
  birthDate: string;
  email: string;
  phone: string;
  photoUrl: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  bloodType?: string;
  medicalInsurance?: string;
  weight?: string;
  height?: string;
  tutor?: Tutor;
  assignments: Assignment[];
  status: 'Active' | 'Inactive' | 'Pending';
  createdAt: string;
  systemRole: 'STAFF' | 'Socio' | 'Externo';
  canLogin: boolean;
  username?: string;
  stats: Record<string, number>;
  overallRating?: number;
}

export interface MedicalHistoryItem {
  id: string;
  date: string;
  isFit: boolean;
  expiryDate: string;
  notes: string;
  professionalName: string;
}

export interface MedicalRecord {
  isFit: boolean;
  lastCheckup: string;
  expiryDate: string;
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
  photoUrl: string;
  email: string;
  overallRating: number;
  stats: Record<string, number>;
  medical?: MedicalRecord;
  status: string;
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
  physicalTrainer: string;
  medicalStaff: string;
  playersCount: number;
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
export type MatchEventType = 'Goal' | 'YellowCard' | 'RedCard' | 'Foul' | 'Substitution';

export interface TournamentSettings {
  hasGroups: boolean;
  groupsCount: number;
  advancingPerGroup: number;
  hasPlayoffs: boolean;
  playoffStart: 'F' | 'SF' | 'QF' | 'R16';
}

export interface TournamentParticipant {
  id: string;
  tournamentid: string;
  name: string;
  memberids: string[];
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  disciplineId: string;
  categoryId: string;
  gender: 'Masculino' | 'Femenino';
  status: 'Open' | 'Finished';
  settings: TournamentSettings;
  created_at: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  homeTeam: string;
  awayTeam: string;
  home_participant_id?: string;
  away_participant_id?: string;
  homeScore?: number;
  awayScore?: number;
  date: string;
  time?: string;
  venue?: string;
  status: MatchStatus;
  group?: string; 
  stage?: string; 
  events?: MatchEvent[];
}

export interface MatchEvent {
  id: string;
  match_id: string;
  playerId: string;
  type: MatchEventType;
  minute?: number;
  notes?: string;
}
