'use client';

import React, { useState, useEffect } from 'react';
import { useTelegram } from './TelegramProvider';
import { supabase } from '@/lib/supabase';
import { Lock, ShieldAlert, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PREDICTIONS = [
  { label: '0/1 Run', mult: 1 },
  { label: '2 Runs', mult: 2 },
  { label: '3 Runs', mult: 3 },
  { label: '4 Runs', mult: 10 },
  { label: '6 Runs', mult: 12 },
  { label: 'Wide', mult: 10 },
  { label: 'Wicket', mult: 15 },
  { label: 'No Ball', mult: 20 },
];

export default function LiveArena() {
  const { user, balance, refreshBalance } = useTelegram();
  const [isLocked, setIsLocked] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<typeof PREDICTIONS[0] | null>(null);
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Subscribe to Global Match State
  useEffect(() => {
    const fetchState = async () => {
       const { data } = await supabase.from('match_state').select('*').eq('id', 1).single();
       if (data) setIsLocked(data.is_locked);
    };
    fetchState();

    const channel = supabase
      .channel('match_state_changes')
      .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'match_state' },
          (payload) => {
             setIsLocked(payload.new.is_locked);
             // If unlocked, it means a ball was settled. Refresh balance to reflect winnings!
             if (!payload.new.is_locked) {
                refreshBalance();
             }
          }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refreshBalance]);

  const handlePredict = async () => {
    if (!user || !selectedOpt || loading) return;
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
       setMessage("Invalid amount"); return;
    }
    if (balance < numAmt) {
       setMessage("Insufficient Units"); return;
    }

    setLoading(true);
    setMessage('');

    try {
      // 1. Deduct Balance instantly for UI/optimistic feel
      const newBal = balance - numAmt;

      // Ensure transaction consistency via RPC or trigger in real-world, here we sequentially double-write for prototype
      const { error: pErr } = await supabase.from('predictions').insert({
          telegram_id: user.id,
          amount: numAmt,
          choice: selectedOpt.label,
          multiplier: selectedOpt.mult,
          potential_win: numAmt * selectedOpt.mult,
          status: 'PENDING'
      });

      if (pErr) throw pErr;

      // 2. Update profiles balance
      await supabase.from('profiles').update({ balance: newBal }).eq('telegram_id', user.id);
      
      refreshBalance();
      setSelectedOpt(null);
      setMessage("Strategy Deployed.");
      setTimeout(() => setMessage(''), 3000);

    } catch (e) {
      console.error(e);
      setMessage("Node Desync. Failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
       <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-red-500 animate-pulse' : 'bg-emerald animate-pulse shadow-[0_0_10px_#00FF41]'}`}></div>
             <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-metallic">
                {isLocked ? 'MARKET LOCKED' : 'MARKET OPEN'}
             </p>
          </div>
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-md flex items-center gap-2">
             <Cpu size={12} className="text-emerald" />
             <span className="text-[10px] font-mono tracking-widest text-white/80">LATENCY: 12ms</span>
          </div>
       </div>

       {/* Safe Lock Overlay */}
       <div className={`transition-all duration-500 relative ${isLocked ? 'blur-md scale-[0.98] opacity-80 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-2 gap-3 mb-6">
             {PREDICTIONS.map((opt) => (
                <button
                   key={opt.label}
                   onClick={() => setSelectedOpt(opt)}
                   className={`glass-panel p-4 flex flex-col items-center justify-center transition-all ${
                      selectedOpt?.label === opt.label 
                      ? 'border-emerald bg-emerald/10 shadow-[inset_0_0_20px_rgba(0,255,65,0.1)]' 
                      : 'hover:bg-white/5 border-white/5'
                   }`}
                >
                   <span className="text-xs uppercase tracking-widest font-black text-metallic mb-1">{opt.label}</span>
                   <span className="text-2xl font-black italic tracking-tighter shadow-black drop-shadow-md">
                      {opt.mult}<span className="text-sm text-emerald">x</span>
                   </span>
                </button>
             ))}
          </div>

          <AnimatePresence>
            {selectedOpt && !isLocked && (
               <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="glass-panel p-5 border-emerald/20">
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-metallic">Execute Strategy: {selectedOpt.label}</span>
                        <span className="text-[10px] font-mono font-bold bg-white/10 px-2 rounded">Est Return: <span className="text-emerald">{(parseFloat(amount || '0') * selectedOpt.mult).toFixed(2)}</span></span>
                     </div>
                     
                     <div className="flex gap-2">
                        <input 
                           type="number" min="10"
                           value={amount} onChange={(e) => setAmount(e.target.value)}
                           className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 font-mono outline-none focus:border-emerald/50"
                        />
                        <button 
                           onClick={handlePredict} disabled={loading}
                           className="bg-emerald text-black font-black uppercase tracking-widest text-[10px] px-6 rounded-xl hover:scale-[0.98] transition-transform shadow-[0_0_15px_rgba(0,255,65,0.2)]"
                        >
                           {loading ? '...' : 'Deploy'}
                        </button>
                     </div>
                  </div>
               </motion.div>
            )}
          </AnimatePresence>
       </div>

       {/* Locked Message Overlay */}
       <AnimatePresence>
         {isLocked && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 z-50 flex items-center justify-center"
            >
               <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-[32px] p-6 rounded-3xl flex flex-col items-center text-center shadow-[0_20px_50px_rgba(239,68,68,0.2)]">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                     <ShieldAlert size={32} className="text-red-500" />
                  </div>
                  <h3 className="text-xl font-black italic tracking-tight text-white uppercase">2-Ball Safety Lock</h3>
                  <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-red-400 mt-2">Prediction Engine Offline</p>
                  <p className="text-xs text-metallic mt-2 max-w-[200px]">Node is synchronizing live field data. Please wait for the next delivery.</p>
               </div>
            </motion.div>
         )}
       </AnimatePresence>

       {message && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 glass-panel border-emerald/50 px-6 py-3 rounded-full z-50 whitespace-nowrap">
             <span className="text-[10px] uppercase font-bold tracking-widest text-emerald">{message}</span>
          </div>
       )}
    </div>
  );
}
