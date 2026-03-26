
import React from 'react';
import { TrendingUp, Trophy, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardProps {
  showFilter?: boolean;
  currentCategory?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ showFilter = true, currentCategory = "General" }) => {
  // Simulamos datos (esto debería venir de las estadísticas reales de la categoría seleccionada)
  const performanceData = [
    { match: 'J1', goals: 2, conceded: 1 },
    { match: 'J2', goals: 3, conceded: 0 },
    { match: 'J3', goals: 1, conceded: 1 },
    { match: 'J4', goals: 4, conceded: 2 },
    { match: 'J5', goals: 2, conceded: 0 },
  ];

  const stats = [
    { label: 'Ranking División', value: '2º', icon: Trophy, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
    { label: 'Racha Actual', value: '3G - 1E', icon: TrendingUp, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-100 dark:bg-primary-900/20' },
    { label: 'Disponibilidad', value: '92%', icon: Activity, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
           <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">Panel de Rendimiento</h2>
           <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
             Análisis de Datos: <span className="text-primary-600 font-black">{currentCategory}</span>
           </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-white/5 hover:border-primary-600/30 transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                  <h3 className="text-3xl font-black text-slate-800 dark:text-white italic">{stat.value}</h3>
                </div>
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 p-8 rounded-[3rem] shadow-sm border border-slate-200 dark:border-white/5">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-8">Evolución de Marcadores</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.1} />
                <XAxis dataKey="match" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)', backgroundColor: '#0f172a', color: '#fff' }}
                  itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                  cursor={{fill: 'rgba(236, 72, 153, 0.05)'}}
                />
                <Bar dataKey="goals" name="A Favor" fill="#ec4899" radius={[10, 10, 0, 0]} />
                <Bar dataKey="conceded" name="En Contra" fill="#94a3b8" radius={[10, 10, 0, 0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Match Card */}
        <div className="bg-slate-950 p-8 rounded-[3rem] shadow-2xl text-white flex flex-col justify-between border border-white/5 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/10 rounded-full blur-3xl group-hover:bg-primary-600/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Próximo Match</h3>
              <span className="px-4 py-1.5 bg-primary-600 text-[9px] font-black rounded-full uppercase tracking-widest animate-pulse">Live Soon</span>
            </div>
            
            <div className="flex items-center justify-between text-center mb-12">
              <div className="flex-1">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-xl font-black mx-auto mb-3 border border-white/10 italic">L</div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Local</p>
              </div>
              <div className="text-2xl font-black text-primary-600 italic">VS</div>
              <div className="flex-1">
                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-xl font-black text-slate-950 mx-auto mb-3 italic">R</div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rival</p>
              </div>
            </div>
            
            <div className="text-center space-y-2">
                <p className="text-xl font-black uppercase italic tracking-tighter">Estadio Olímpico</p>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-600">Sábado 18:30 HS</p>
            </div>
          </div>
          
          <button className="w-full mt-10 bg-white text-slate-950 font-black uppercase text-[10px] tracking-widest py-5 rounded-[1.5rem] hover:bg-primary-600 hover:text-white transition-all relative z-10">
            Ficha Técnica
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
