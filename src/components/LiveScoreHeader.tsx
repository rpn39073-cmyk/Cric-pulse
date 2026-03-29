'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, ShieldCheck } from 'lucide-react';

export default function LiveScoreHeader() {
  // Using Mock Data for the prototype. This will be replaced by a Real-time Cricket API later.
  const [matchData, setMatchData] = useState({
    teamA: 'IND', teamB: 'AUS', score: '0/0', overs: '0.0', target: '---', status: 'Waiting for feed...'
  });

  useEffect(() => {
    const fetchScore = async () => {
       const { data } = await supabase.from('match_state').select('live_score').eq('id', 1).single();
       if (data && data.live_score) setMatchData(data.live_score);
    };
    fetchScore();

    const channel = supabase
      .channel('match_state_score')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_state' },
          (payload) => {
             if (payload.new.live_score) setMatchData(payload.new.live_score);
          }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="w-full bg-black/60 border-b border-white/5 backdrop-blur-3xl sticky top-0 z-50">
      {/* Top micro-header */}
      <div className="flex justify-between items-center px-4 py-1.5 bg-emerald/10 border-b border-emerald/20">
         <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-emerald flex items-center gap-1">
            <Activity size={10} className="animate-pulse" /> Live Telemetry
         </span>
         <span className="text-[9px] font-mono font-bold text-metallic uppercase flex items-center gap-1">
            <ShieldCheck size={10} /> Encrypted Feed
         </span>
      </div>

      {/* Main Scoreboard Area */}
      <div className="p-4 flex flex-col items-center justify-center">
         <div className="flex w-full items-center justify-between px-2">
            
            {/* Team A */}
            <div className="flex flex-col items-center">
               <span className="text-xl font-black italic text-white drop-shadow-md">{matchData.teamA}</span>
               <div className="w-6 h-1 mt-1 bg-blue-500 rounded-full"></div>
            </div>

            {/* Central Score */}
            <div className="flex flex-col items-center justify-center mx-4">
               <span className="text-3xl font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  {matchData.score}
               </span>
               <span className="text-xs font-mono font-bold text-metallic mt-1 bg-white/5 px-3 py-0.5 rounded-full border border-white/10">
                  Overs: <span className="text-emerald">{matchData.overs}</span>
               </span>
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center">
               <span className="text-xl font-black italic text-white/50">{matchData.teamB}</span>
               <div className="w-6 h-1 mt-1 bg-yellow-500/30 rounded-full"></div>
            </div>
         </div>
         
         {/* Live Match Context */}
         <div className="mt-4 flex w-full justify-between items-center px-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald bg-emerald/10 border border-emerald/20 px-2 py-1 rounded">
               Target: {matchData.target}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-metallic/80">
               {matchData.status}
            </span>
         </div>
      </div>
    </div>
  );
}
