
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
    
    upsert: async (member: any) => {
      // Mapeamos las claves de camelCase a lowercase para coincidir con la DB
      const mappedMember = {
        id: member.id,
        name: member.name,
        dni: member.dni,
        gender: member.gender,
        birthdate: member.birthDate || member.birthdate,
        email: member.email,
        phone: member.phone,
        photourl: member.photoUrl || member.photourl,
        address: member.address,
        city: member.city,
        province: member.province,
        postalcode: member.postalCode || member.postalcode,
        bloodtype: member.bloodType || member.bloodtype,
        medicalinsurance: member.medicalInsurance || member.medicalinsurance,
        weight: member.weight,
        height: member.height,
        tutor: member.tutor,
        assignments: member.assignments,
        status: member.status,
        systemrole: member.systemRole || member.systemrole,
        canlogin: member.canLogin || member.canlogin,
        username: member.username,
        overallrating: member.overallRating || member.overallrating,
        stats: member.stats,
        medical: member.medical,
        created_at: member.created_at
      };

      // Limpiamos campos undefined
      const cleanMember = Object.fromEntries(
        Object.entries(mappedMember).filter(([, v]) => v !== undefined)
      );
      
      const { data, error } = await supabase
        .from('members')
        .upsert(cleanMember);
      
      if (error) {
        console.error("Error detallado de Supabase (Members):", error.message);
        throw error;
      }
      return { data, error: null };
    },
      
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
    
    upsert: async (tournament: any) => {
      // Mapear campos a lowercase para la DB
      const mappedTournament = {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        discipline_id: tournament.discipline_id || tournament.disciplineid,
        gender: tournament.gender,
        categoryid: tournament.category_id || tournament.categoryid,
        assigned_categories: tournament.assigned_categories || tournament.assignedcategories,
        fixture_base: tournament.fixture_base || tournament.fixturebase,
        status: tournament.status,
        settings: tournament.settings,
        created_at: tournament.created_at
      };

      // Limpiar campos undefined
      const cleanTournament = Object.fromEntries(
        Object.entries(mappedTournament).filter(([, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .from('tournaments')
        .upsert(cleanTournament);

      if (error) {
        console.error("Error detallado de Supabase (Tournaments):", error.message);
        throw error;
      }
      return { data, error: null };
    },
      
    delete: async (id: string) => {
      // 1. Get matches for this tournament to delete their events
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournamentid', id);
      
      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        // 2. Delete match events
        await supabase
          .from('match_events')
          .delete()
          .in('match_id', matchIds);
      }

      // 3. Delete matches
      await supabase
        .from('matches')
        .delete()
        .eq('tournamentid', id);

      // 4. Delete participants
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournamentid', id);

      // 5. Delete tournament
      return supabase
        .from('tournaments')
        .delete()
        .eq('id', id);
    }
  },
  participants: {
    getAll: (tournamentId: string) => supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournamentid', tournamentId),
    
    upsert: (participant: any) => {
      const mappedParticipant = {
        id: participant.id,
        tournamentid: participant.tournament_id || participant.tournamentid,
        name: participant.name,
        member_ids: participant.member_ids || participant.memberids || participant.memberIds,
        categoryid: participant.category_id || participant.categoryid
      };

      // Limpiar campos undefined
      const cleanParticipant = Object.fromEntries(
        Object.entries(mappedParticipant).filter(([, v]) => v !== undefined)
      );

      return supabase
        .from('tournament_participants')
        .upsert(cleanParticipant);
    },
      
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
          playerid,
          type,
          minute,
          notes
        )
      `)
      .eq('tournamentid', tournamentId)
      .order('date', { ascending: true }),
    
    getByTeamName: (teamName: string) => supabase
      .from('matches')
      .select('*')
      .or(`hometeam.eq."${teamName}",awayteam.eq."${teamName}"`)
      .eq('status', 'Finished')
      .order('date', { ascending: false }),
    
    getLastResults: (teamName: string, limit: number = 5) => {
      const today = new Date().toISOString().split('T')[0];
      return supabase
        .from('matches')
        .select('*')
        .or(`hometeam.eq."${teamName}",awayteam.eq."${teamName}"`)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(limit);
    },

    getUpcomingMatches: (teamName: string, limit: number = 3) => {
      const today = new Date().toISOString().split('T')[0];
      return supabase
        .from('matches')
        .select('*')
        .or(`hometeam.eq."${teamName}",awayteam.eq."${teamName}"`)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(limit);
    },
    
    upsert: async (match: any) => {
      const { incidents, ...matchData } = match;
      
      // Mapear campos a lowercase para la DB
      const mappedMatch = {
        id: matchData.id,
        tournamentid: matchData.tournamentId || matchData.tournamentid,
        categoryid: matchData.category_id || matchData.categoryid || matchData.categoryId,
        date: matchData.date,
        hometeam: matchData.home_team || matchData.hometeam || matchData.homeTeam,
        awayteam: matchData.away_team || matchData.awayteam || matchData.awayTeam,
        homescore: matchData.home_score || matchData.homescore || matchData.homeScore,
        awayscore: matchData.away_score || matchData.awayscore || matchData.awayScore,
        status: matchData.status,
        location: matchData.location,
        referee: matchData.referee,
        notes: matchData.notes
      };

      const { data: mData, error: mErr } = await supabase
        .from('matches')
        .upsert(mappedMatch)
        .select()
        .single();
      
      if (mErr) throw mErr;

      if (incidents && incidents.length > 0) {
        await supabase.from('match_events').delete().eq('match_id', mData.id);
        const eventsToSave = incidents.map((inc: any) => ({
          match_id: mData.id,
          playerid: inc.player_id || inc.playerId || inc.playerid,
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
      .in('playerid', playerIds)
  },
  rivals: {
    getAll: (discipline?: string) => {
      let query = supabase
        .from('rivals')
        .select('*')
        .order('name', { ascending: true });
      if (discipline) {
        query = query.eq('discipline', discipline);
      }
      return query;
    },
    
    upsert: (rival: any) => supabase
      .from('rivals')
      .upsert(rival),
      
    delete: (id: string) => supabase
      .from('rivals')
      .delete()
      .eq('id', id)
  },
  players: {
    getAll: () => supabase
      .from('members')
      .select('*')
      .order('name', { ascending: true }),
    
    upsert: (player: any) => supabase
      .from('members')
      .upsert(player),
      
    delete: (id: string) => supabase
      .from('members')
      .delete()
      .eq('id', id)
  },
  fees: {
    getAll: () => supabase
      .from('fees')
      .select('*, player:members(*)'),
    
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
