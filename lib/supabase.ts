
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
      dorsal: member.dorsal,
      plays_since_year: member.plays_since_year || member.playsSinceYear,
      frequent_position: member.frequent_position || member.frequentPosition,
      skilled_leg: member.skilled_leg || member.skilledLeg,
      injury_history: member.injury_history || member.injuryHistory,
      training_days_per_week: member.training_days_per_week || member.trainingDaysPerWeek,
      gym_attendance: member.gym_attendance !== undefined ? member.gym_attendance : member.gymAttendance,
      gym_frequency: member.gym_frequency || member.gymFrequency,
      assigned_categories_sports: member.assigned_categories_sports || member.assignedCategoriesSports,
      carnet_number: member.carnet_number !== undefined ? member.carnet_number : (member.carnetNumber || null),
      school_name: member.school_name || member.schoolName || '',
      school_shift: member.school_shift || member.schoolShift || '',
      school_schedule: member.school_schedule || member.schoolSchedule || '',
          extra_activity: member.extra_activity || member.extraActivity || '',
      extra_activity_schedule: member.extra_activity_schedule || member.extraActivitySchedule || '',
      school_contact: member.school_contact || member.schoolContact || '',
      contacts_list: member.contacts_list || member.contactsList || [],
      has_preexisting_condition: member.has_preexisting_condition !== undefined ? member.has_preexisting_condition : (member.hasPreexistingCondition || false),
      preexisting_condition_details: member.preexisting_condition_details || member.preexistingConditionDetails || '',
      medical_file_url: member.medical_file_url || member.medicalFileUrl || '',
      has_scholarship: member.has_scholarship !== undefined ? member.has_scholarship : (member.hasScholarship || false),
      scholarship_type_id: member.scholarship_type_id !== null ? (member.scholarship_type_id || member.scholarshipTypeId || null) : null,
      scholarship_details: member.scholarship_details || member.scholarshipDetails || '',
      scholarship_attachment_url: member.scholarship_attachment_url || member.scholarshipAttachmentUrl || '',
      scholarship_start_date: member.scholarship_start_date || member.scholarshipStartDate || null,
      scholarship_end_date: member.scholarship_end_date || member.scholarshipEndDate || null,
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
medical: {
  getInjuryTypes: () => supabase
    .from('injury_types')
    .select('*')
    .order('name', { ascending: true }),
  
  upsertInjuryType: (type: any) => supabase
    .from('injury_types')
    .upsert(type),
  
  getPlayerInjuries: (playerId: string) => supabase
    .from('player_injuries')
    .select('*, injury_type:injury_types(*)')
    .eq('player_id', playerId)
    .order('injury_date', { ascending: false }),
  
  upsertInjury: async (injury: any) => {
    const cleanInjury = { ...injury };
    delete cleanInjury.injury_type;
    if (cleanInjury.release_date === '') cleanInjury.release_date = null;
    return supabase.from('player_injuries').upsert(cleanInjury);
  },

  deleteInjury: (id: string) => supabase
    .from('player_injuries')
    .delete()
    .eq('id', id),

  uploadAttachment: async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `medical/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('medical_attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('medical_attachments')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  getPhysiotherapyByPlayer: (playerId: string) => supabase
    .from('player_physiotherapy')
    .select('*')
    .eq('member_id', playerId)
    .order('treatment_date', { ascending: false }),

  upsertPhysiotherapy: (physio: any) => supabase
    .from('player_physiotherapy')
    .upsert(physio),

  deletePhysiotherapy: (id: string) => supabase
    .from('player_physiotherapy')
    .delete()
    .eq('id', id)
},
tournaments: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) return { data: null, error };
      
      // Normalización para Cuenta B
      const normalizedData = (data || []).map(t => ({
        ...t,
        discipline_id: t.discipline_id || t.discipline,
        category_id: t.category_id || t.categoryid,
        type: t.type || 'Professional',
        status: t.status || 'Open',
        settings: t.settings || { has_groups: false, groups_count: 1, advancing_per_group: 2, has_playoffs: false, playoff_start: 'F' }
      }));
      
      return { data: normalizedData, error: null };
    },
    
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
    getAll: async (tournamentId: string) => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          events:match_events (
            id,
            playerid,
            player_name,
            type,
            minute,
            notes,
            is_rival,
            additional_data
          )
        `)
        .eq('tournamentid', tournamentId)
        .order('date', { ascending: true });

      if (error) return { data: null, error };

      // Normalización para Cuenta B
      const normalizedData = (data || []).map(m => ({
        ...m,
        home_score: m.home_score !== undefined ? m.home_score : m.homescore,
        away_score: m.away_score !== undefined ? m.away_score : m.awayscore,
        home_team: m.home_team || m.hometeam,
        away_team: m.away_team || m.awayteam,
        tournament_id: m.tournament_id || m.tournamentid,
        category_id: m.category_id || m.categoryid
      }));

      return { data: normalizedData, error: null };
    },
    
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
          player_name: inc.player_name || inc.playerName,
          type: inc.type,
          minute: parseInt(inc.minute || inc.additional_data?.minuto) || 0,
          notes: inc.notes || '',
          is_rival: inc.is_rival || false,
          additional_data: inc.additional_data || {}
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
    
    upsert: (player: any) => db.members.upsert(player),
      
    delete: (id: string) => supabase
      .from('members')
      .delete()
      .eq('id', id)
  },
  fees: {
    getAll: () => supabase
      .from('fees')
      .select('*')
      .order('due_date', { ascending: false }),
    
    getDebtsByPlayer: (playerId: string) => {
      const today = new Date().toISOString().split('T')[0];
      return supabase
        .from('fees')
        .select('*')
        .eq('member_id', playerId)
        .eq('status', 'Pending')
        .lt('due_date', today);
    },

    getAllDebts: () => {
      const today = new Date().toISOString().split('T')[0];
      return supabase
        .from('fees')
        .select('member_id')
        .eq('status', 'Pending')
        .lt('due_date', today);
    },
    
    upsert: (fee: any) => {
      const cleanFee = { ...fee };
      delete cleanFee.member;
      delete cleanFee.player;
      return supabase
        .from('fees')
        .upsert(cleanFee);
    },

    upsertMany: (fees: any[]) => {
      const cleanFees = fees.map(f => {
        const cf = { ...f };
        delete cf.member;
        delete cf.player;
        return cf;
      });
      return supabase
        .from('fees')
        .upsert(cleanFees);
    },

    uploadReceipt: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `comprobantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pagos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('pagos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    },
    
    delete: (id: string) => supabase
      .from('fees')
      .delete()
      .eq('id', id)
  },
  feeConfigs: {
    getAll: () => supabase
      .from('fee_configs')
      .select('*')
      .order('discipline', { ascending: true }),
    
    upsert: (config: any) => supabase
      .from('fee_configs')
      .upsert(config),

    upsertMany: (configs: any[]) => supabase
      .from('fee_configs')
      .upsert(configs),
    
    delete: (id: string) => supabase
      .from('fee_configs')
      .delete()
      .eq('id', id)
  },
  attendance: {
    getByDate: (date: string, discipline: string, categoryId?: string) => {
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('date', date)
        .eq('discipline', discipline);
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      return query;
    },
    
    upsert: (records: any[]) => supabase
      .from('attendance')
      .upsert(records, { onConflict: 'player_id,date,discipline,category_id' }),
      
    delete: (id: string) => supabase
      .from('attendance')
      .delete()
      .eq('id', id)
  },
  medicalDocuments: {
    getAll: () => supabase
      .from('medical_documents')
      .select('*')
      .order('created_at', { ascending: false }),

    getBySection: (section: string) => supabase
      .from('medical_documents')
      .select('*')
      .eq('section', section)
      .order('created_at', { ascending: false }),

    insert: (doc: { title: string; section: string; attachments: { name: string; url: string }[]; uploaded_by: string }) => supabase
      .from('medical_documents')
      .insert([doc])
      .select(),

    delete: (id: string) => supabase
      .from('medical_documents')
      .delete()
      .eq('id', id),

    uploadDocument: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `documentation/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('medical_attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('medical_attachments')
        .getPublicUrl(filePath);

      return {
        name: file.name,
        url: data.publicUrl
      };
    }
  },
  scholarshipTypes: {
    getAll: () => supabase
      .from('scholarship_types')
      .select('*')
      .order('name', { ascending: true }),
    
    upsert: (record: any) => supabase
      .from('scholarship_types')
      .upsert(record),
    
    delete: (id: string) => supabase
      .from('scholarship_types')
      .delete()
      .eq('id', id),

    uploadAttachment: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `becas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pagos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('pagos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    }
  },
  inscriptionConfigs: {
    getAll: () => supabase
      .from('inscription_configs')
      .select('*')
      .order('name', { ascending: true }),
    
    upsert: (record: any) => supabase
      .from('inscription_configs')
      .upsert(record),
    
    delete: (id: string) => supabase
      .from('inscription_configs')
      .delete()
      .eq('id', id)
  }
};
