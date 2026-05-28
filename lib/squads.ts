
import { supabase } from './supabase';
import { MatchSquad, MatchSquadPlayer } from '../types';

export const getMatchSquad = async (matchId: string): Promise<MatchSquad | null> => {
  const { data, error } = await supabase
    .from('match_squads')
    .select('*, players:match_squad_players(*, player:members(*))')
    .eq('match_id', matchId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching match squad:', error);
    return null;
  }

  return data;
};

export const saveMatchSquad = async (
  squad: Partial<MatchSquad>,
  players: Partial<MatchSquadPlayer>[]
): Promise<MatchSquad | null> => {
  // 1. Save or update the squad header
  const { data: squadData, error: squadError } = await supabase
    .from('match_squads')
    .upsert({
      match_id: squad.match_id,
      tournament_id: squad.tournament_id,
      category_id: squad.category_id,
      discipline: squad.discipline,
      notes: squad.notes,
      appointment_time: squad.appointment_time,
      location: squad.location,
      updated_at: new Date().toISOString()
    }, { onConflict: 'match_id' })
    .select()
    .single();

  if (squadError) {
    console.error('Error saving match squad header:', squadError);
    throw squadError;
  }

  // 2. Delete existing players to replace for simplicity (re-insert)
  // Alternative: use upsert if performance is an issue, but for lineups (11-20 players) this is fine.
  const { error: deleteError } = await supabase
    .from('match_squad_players')
    .delete()
    .eq('squad_id', squadData.id);

  if (deleteError) {
    console.error('Error deleting previous squad players:', deleteError);
    throw deleteError;
  }

  // 3. Insert new players
  if (players.length > 0) {
    const playersToInsert = players.map(p => ({
      squad_id: squadData.id,
      player_id: p.player_id,
      is_starting: p.is_starting,
      minutes_played: p.minutes_played || 0
    }));

    const { error: insertError } = await supabase
      .from('match_squad_players')
      .insert(playersToInsert);

    if (insertError) {
      console.error('Error inserting squad players:', insertError);
      throw insertError;
    }
  }

  return squadData;
};
