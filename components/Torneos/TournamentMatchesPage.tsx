
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tournament, ClubConfig } from '../../types';
import { supabase } from '../../lib/supabase';
import VerPartidos from './VerPartidos';
import { Loader2 } from 'lucide-react';

interface TournamentMatchesPageProps {
  clubConfig: ClubConfig;
}

const TournamentMatchesPage: React.FC<TournamentMatchesPageProps> = ({ clubConfig }) => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTournament = async () => {
      if (!tournamentId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', tournamentId)
          .single();
        
        if (error) throw error;
        setTournament(data);
      } catch (error) {
        console.error('Error fetching tournament:', error);
        navigate('/torneos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournament();
  }, [tournamentId, navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin text-primary-600" size={40} />
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando torneo...</p>
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <VerPartidos 
      tournament={tournament} 
      onBack={() => navigate('/torneos')} 
      clubName={clubConfig.name}
      clubConfig={clubConfig}
    />
  );
};

export default TournamentMatchesPage;
