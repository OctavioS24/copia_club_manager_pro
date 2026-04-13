
import { supabase } from './supabase';
import { Tournament, Match, Rival, MatchFixture, MatchEvent } from '../types';

export const getRivals = async (discipline?: string): Promise<Rival[]> => {
  let query = supabase
    .from('rivals')
    .select('*')
    .order('name', { ascending: true });
  
  if (discipline) {
    query = query.eq('discipline', discipline);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getTournaments = async (): Promise<Tournament[]> => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const getFixturesByCategory = async (tournamentId: string, categoryId: string): Promise<Match[]> => {
  const { data, error } = await supabase
    .from('matches')
    .select('*, events:match_events(*)')
    .eq('tournamentid', tournamentId)
    .eq('categoryid', categoryId)
    .order('date', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const getPartidosByTorneo = async (tournamentId: string): Promise<Match[]> => {
  const { data, error } = await supabase
    .from('matches')
    .select('*, events:match_events(*)')
    .eq('tournamentid', tournamentId)
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const updateMatchResult = async (
  matchId: string, 
  homeScore: number, 
  awayScore: number, 
  events: Partial<MatchEvent>[]
) => {
  // Update match score and status
  const { error: matchError } = await supabase
    .from('matches')
    .update({ 
      homescore: homeScore, 
      awayscore: awayScore, 
      status: 'Finished'
    })
    .eq('id', matchId);

  if (matchError) throw matchError;

  // Delete existing events for this match to replace them
  const { error: deleteError } = await supabase
    .from('match_events')
    .delete()
    .eq('match_id', matchId);

  if (deleteError) throw deleteError;

  // Insert new events
  if (events.length > 0) {
    const eventsToInsert = events.map(e => ({
      match_id: matchId,
      playerid: e.playerid || e.playerId || (e as any).player_id,
      type: e.type,
      minute: e.minute,
      notes: e.notes,
      id: e.id || crypto.randomUUID()
    }));
    const { error: eventsError } = await supabase
      .from('match_events')
      .insert(eventsToInsert);
    
    if (eventsError) throw eventsError;
  }
};

export const agregarFecha = async (
  tournamentId: string, 
  fechaData: MatchFixture, 
  categories: string[],
  clubName: string
): Promise<void> => {
  // 1. Update tournament fixture_base
  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .select('fixture_base')
    .eq('id', tournamentId)
    .single();

  if (tError) throw tError;

  const updatedFixtureBase = [...(tournament.fixture_base || []), fechaData];

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ fixture_base: updatedFixtureBase })
    .eq('id', tournamentId);

  if (updateError) throw updateError;

  // 2. Replicate matches for all categories
  await replicateFixtures(tournamentId, categories, [fechaData], clubName);
};

export const replicateFixtures = async (
  tournamentId: string, 
  categories: string[], 
  fixtureBase: MatchFixture[],
  clubName: string = 'Mi Equipo'
) => {
  const matches: any[] = [];

  for (const categoryId of categories) {
    for (const fixture of fixtureBase) {
      const isHome = fixture.condition === 'Local';
      
      matches.push({
        tournamentid: tournamentId,
        categoryid: categoryId,
        hometeam: isHome ? clubName : fixture.rival,
        awayteam: isHome ? fixture.rival : clubName,
        date: fixture.date,
        status: 'Scheduled'
      });
    }
  }

  if (matches.length > 0) {
    const { error } = await supabase
      .from('matches')
      .insert(matches);
    
    if (error) throw error;
  }
};

export const createTournament = async (tournamentData: Partial<Tournament>, clubName: string) => {
  const { data, error } = await supabase
    .from('tournaments')
    .insert(tournamentData)
    .select()
    .single();

  if (error) throw error;

  if (data && data.assigned_categories && data.fixture_base) {
    await replicateFixtures(data.id, data.assigned_categories, data.fixture_base, clubName);
  }

  return data;
};
