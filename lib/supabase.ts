
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
      .eq('tournamentid', tournamentId),
    
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
    
    upsert: async (match: any) => {
      const { incidents, ...matchData } = match;
      
      const { data: mData, error: mErr } = await supabase
        .from('matches')
        .upsert(matchData)
        .select()
        .single();
      
      if (mErr && mErr.code === 'PGRST204') {
        const safeMatchData = { ...matchData };
        delete (safeMatchData as any).home_participant_id;
        delete (safeMatchData as any).away_participant_id;
        delete (safeMatchData as any).homeParticipantId;
        delete (safeMatchData as any).awayParticipantId;

        const { data: mDataSafe, error: mErrSafe } = await supabase
          .from('matches')
          .upsert(safeMatchData)
          .select()
          .single();
          
        if (mErrSafe) throw mErrSafe;
        return { data: mDataSafe };
      }

      if (mErr) throw mErr;

      if (incidents && incidents.length > 0) {
        await supabase.from('match_events').delete().eq('matchId', mData.id);
        const eventsToSave = incidents.map((inc: any) => ({
          matchId: mData.id,
          playerId: inc.playerId,
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
  }
};
