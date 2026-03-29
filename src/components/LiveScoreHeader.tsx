'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, ShieldCheck } from 'lucide-react';

export default function LiveScoreHeader() {
  const [matchData, setMatchData] = useState({
    teamA: 'IND', teamB: 'AUS', score: '0/0', overs: '0.0', target: '---', status: 'Waiting for feed...'
  });

  const [isLocked, setIsLocked] = useState(true);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchScore = async () => {
       const { data } = await supabase.from('match_state').select('*').eq('id', 1).single();
       if (data) {
           if (data.live_score) setMatchData(data.live_score);
           setIsLocked(data.is_locked);
           if (data.market_opened_at) setOpenedAt(data.market_opened_at);
       }
    };
    fetchScore();

    const channel = supabase
      .channel('match_state_score')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_state' },
          (payload) => {
             if (payload.new.live_score) setMatchData(payload.new.live_score);
             setIsLocked(payload.new.is_locked);
             setOpenedAt(payload.new.market_opened_at);
          }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 30 Seconds Synchronized Countdown Engine
  useEffect(() => {
     if (isLocked || !openedAt) {
         setProgress(0);
         return;
     }

     const intervalId = setInterval(() => {
         const now = Date.now();
         const start = new Date(openedAt).getTime();
         const elapsed = now - start;
         
         const maxDurationMs = 30000; // Exact 30 seconds
         let pct = (elapsed / maxDurationMs) * 100;
         
         if (pct >= 100) {
             pct = 100;
             clearInterval(intervalId); // Stop ticking once it hits 100%
         }
         
         setProgress(pct);
     }, 100); // 100ms smoothness tick

     return () => clearInterval(intervalId);
  }, [isLocked, openedAt]);

  return (
    <div className="w-full bg-black/60 border-b border-white/5 backdrop-blur-3xl sticky top-0 z-50 overflow-hidden">
      
      {/* 30 SECOND PROGRESS BAR */}
      <div 
         className={`absolute top-0 left-0 h-1 bg-emerald shadow-[0_0_15px_#00FF41] z-50 ${progress < 100 ? 'transition-all duration-100 ease-linear' : ''}`}
         style={{ width: `${progress}%`, opacity: progress > 0 ? 1 : 0 }}
      />

      {/* Top micro-header */}
      <div className="flex justify-between items-center px-4 py-1.5 bg-emerald/10 border-b border-emerald/20 mt-[2px]">
         <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-emerald flex items-center gap-1">
            <Activity size={10} className="animate-pulse" /> Live Telemetry
         </span>
         {(progress >= 100 && !isLocked) ? (
            <span className="text-[9px] font-mono font-black text-red-500 uppercase flex items-center gap-1 animate-pulse">
               Closing Market...
            </span>
         ) : (
            <span className="text-[9px] font-mono font-bold text-metallic uppercase flex items-center gap-1">
               <ShieldCheck size={10} /> Encrypted Feed
            </span>
         )}
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
