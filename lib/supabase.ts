
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseKey || 'placeholder-key'
);

export const db = {
  // Función para evitar la pausa del servidor por inactividad
  maintenance: {
    ping: async () => {
      try {
        // Usamos upsert con ID fijo para sobreescribir siempre la misma fila
        const { error } = await supabase
          .from('keep_alive')
          .upsert({ 
            id: 1, 
            last_ping: new Date().toISOString(),
            app_name: 'ClubManager-AutoPulse'
          }, { onConflict: 'id' });
        
        if (error) console.error("Keep-Alive Ping failed:", error);
        return !error;
      } catch (e) {
        console.error("Keep-Alive Error:", e);
        return false;
      }
    }
  },
  config: {
    get: () => supabase
      .from('club_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle(),
    
    update: (data: any) => supabase
      .from('club_config')
      .upsert({ id: 1, ...data }, { onConflict: 'id' })
  },
  members: {
    getAll: () => supabase
      .from('members')
      .select('*')
      .order('name', { ascending: true }),
    
    upsert: (member: any) => supabase
      .from('members')
      .upsert(member),
      
    delete: (id: string) => supabase
      .from('members')
      .delete()
      .eq('id', id)
  },
  tournaments: {
    getAll: () => supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false }),
    
    upsert: (tournament: any) => supabase
      .from('tournaments')
      .upsert(tournament),
      
    delete: (id: string) => supabase
      .from('tournaments')
      .delete()
      .eq('id', id)
  },
  participants: {
    getAll: (tournamentId: string) => supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId),
    
    upsert: (participant: any) => supabase
      .from('tournament_participants')
      .upsert(participant),
      
    delete: (id: string) => supabase
      .from('tournament_participants')
      .delete()
      .eq('id', id)
  },
  matches: {
    getAll: (tournamentId: string) => supabase
      .from('matches')
      .select(`
        *,
        events:match_events (
          id,
          playerId,
          type,
          minute,
          notes
        )
      `)
      .eq('tournamentId', tournamentId)
      .order('date', { ascending: true }),
    
    getByTeamName: (teamName: string) => supabase
      .from('matches')
      .select('*')
      .or(`homeTeam.eq."${teamName}",awayTeam.eq."${teamName}"`)
      .eq('status', 'Finished')
      .order('date', { ascending: false }),
    
    getLastResults: (teamName: string, limit: number = 5) => {
      const today = new Date().toISOString().split('T')[0];
      return supabase
        .from('matches')
        .select('*')
        .or(`homeTeam.eq."${teamName}",awayTeam.eq."${teamName}"`)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(limit);
    },

    getUpcomingMatches: (teamName: string, limit: number = 3) => {
      const today = new Date().toISOString().split('T')[0];
      return supabase
        .from('matches')
        .select('*')
        .or(`homeTeam.eq."${teamName}",awayTeam.eq."${teamName}"`)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(limit);
    },
    
    upsert: async (match: any) => {
      const { incidents, ...matchData } = match;
      
      const { data: mData, error: mErr } = await supabase
        .from('matches')
        .upsert(matchData)
        .select()
        .single();
      
      if (mErr) throw mErr;

      if (incidents && incidents.length > 0) {
        await supabase.from('match_events').delete().eq('match_id', mData.id);
        const eventsToSave = incidents.map((inc: any) => ({
          match_id: mData.id,
          playerId: inc.player_id || inc.playerId,
          type: inc.type,
          minute: parseInt(inc.minute) || 0,
          notes: inc.notes || ''
        }));
        await supabase.from('match_events').insert(eventsToSave);
      }
      
      return { data: mData };
    },
    
    delete: (id: string) => supabase.from('matches').delete().eq('id', id)
  },
  matchEvents: {
    getByPlayerIds: (playerIds: string[]) => supabase
      .from('match_events')
      .select('*')
      .in('playerId', playerIds)
  },
  players: {
    getAll: () => supabase
      .from('players')
      .select('*')
      .order('name', { ascending: true }),
    
    upsert: (player: any) => supabase
      .from('players')
      .upsert(player),
      
    delete: (id: string) => supabase
      .from('players')
      .delete()
      .eq('id', id)
  },
  fees: {
    getAll: () => supabase
      .from('fees')
      .select('*, player:players(*)'),
    
    upsert: (fee: any) => supabase
      .from('fees')
      .upsert(fee),
    
    delete: (id: string) => supabase
      .from('fees')
      .delete()
      .eq('id', id)
  },
  attendance: {
    getByDate: (date: string, discipline: string) => supabase
      .from('attendance')
      .select('*')
      .eq('date', date)
      .eq('discipline', discipline),
    
    upsert: (records: any[]) => supabase
      .from('attendance')
      .upsert(records, { onConflict: 'player_id,date,discipline' }),
      
    delete: (id: string) => supabase
      .from('attendance')
      .delete()
      .eq('id', id)
  }
};
