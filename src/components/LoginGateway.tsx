'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Target, Loader2 } from 'lucide-react';

interface LoginGatewayProps {
  onSuccess: (user: { id: number; first_name: string; username: string }) => void;
}

export default function LoginGateway({ onSuccess }: LoginGatewayProps) {
  const [tgId, setTgId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgId || isNaN(Number(tgId))) return alert("Enter a valid numeric ID!");
    
    setLoading(true);
    const mockUser = {
      id: Number(tgId),
      first_name: `User_${tgId.substring(0,4)}`,
      username: `shadow_${tgId}`
    };

    // Upsert into Supabase to assure Foreign Keys won't fail
    await supabase.from('profiles').upsert(
      { 
         telegram_id: mockUser.id,
         username: mockUser.username,
         first_name: mockUser.first_name,
      },
      { onConflict: 'telegram_id' }
    );

    setLoading(false);
    onSuccess(mockUser);
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-obsidian text-white p-6 relative overflow-hidden">
      
      {/* Background Ornaments */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="glass-panel p-8 w-full max-w-sm flex flex-col items-center border border-white/10 z-10 shadow-2xl">
         <div className="w-16 h-16 rounded-2xl bg-black/50 border border-emerald/20 flex flex-col items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,65,0.1)]">
            <Target size={32} className="text-emerald animate-pulse" />
         </div>

         <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white drop-shadow-md mb-2 focus:outline-none">
            CRIC<span className="text-emerald">PULSE</span>
         </h1>
         <p className="text-[10px] font-bold tracking-[0.2em] text-metallic uppercase mb-8 text-center">
            DevMode Identity Protocol
         </p>

         <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
               <label className="text-[9px] font-bold text-metallic uppercase tracking-widest pl-1">Telegram UID</label>
               <input 
                  type="text" 
                  autoFocus
                  placeholder="e.g. 1010" 
                  value={tgId} 
                  onChange={e => setTgId(e.target.value)}
                  className="w-full bg-black/80 border border-white/20 p-4 rounded-xl text-center text-emerald font-mono tracking-widest outline-none focus:border-emerald/50 transition-all mt-1"
               />
            </div>

            <button 
               type="submit" 
               disabled={loading}
               className="w-full bg-white text-black font-black uppercase tracking-widest p-4 rounded-xl shadow-[0_10px_20px_rgba(255,255,255,0.1)] hover:bg-emerald transition-all flex justify-center items-center gap-2"
            >
               {loading ? <Loader2 className="animate-spin" size={18} /> : <><ShieldCheck size={18} /> Authenticate</>}
            </button>
         </form>

         <div className="mt-6 text-center">
            <p className="text-[8px] text-metallic uppercase tracking-widest">
               Warning: Unmatched Web Context Detected.<br/>Manual Override Active.
            </p>
         </div>
      </div>
    </div>
  );
}
