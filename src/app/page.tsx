'use client';

import { useState } from 'react';
import LiveArena from '@/components/LiveArena';
import WalletManager from '@/components/WalletManager';
import LiveScoreHeader from '@/components/LiveScoreHeader';
import { useTelegram } from '@/components/TelegramProvider';
import { Target, CircleDollarSign, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { user } = useTelegram();
  const [activeTab, setActiveTab] = useState<'arena' | 'wallet'>('arena');

  // Loading State while waiting for Telegram SDK injecting user data
  if (!user) {
    return (
       <div className="h-screen w-full flex flex-col items-center justify-center bg-obsidian">
          <Loader2 className="animate-spin text-emerald mb-4" size={32} />
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-metallic animate-pulse">
             Authenticating Telegram Node
          </p>
       </div>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-obsidian p-0 font-sans overflow-x-hidden">
      
      {/* Live Context Telemetry Board */}
      <LiveScoreHeader />

      <div className="p-4 flex-1 w-full flex flex-col items-center pb-24 relative">
         {/* Top Header */}
         <header className="flex w-full max-w-sm justify-between items-center mb-6">
            <div>
               <h1 className="text-xl font-black italic tracking-tighter uppercase text-white drop-shadow-md">
                  CRIC<span className="text-emerald">PULSE</span>
               </h1>
               <p className="text-[9px] font-bold text-metallic tracking-[0.3em] uppercase">Strategy Hub</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-1.5 px-3 rounded-full flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald/20 flex items-center justify-center">
                   <div className="w-1.5 h-1.5 bg-emerald rounded-full"></div>
                </div>
                <span className="text-[10px] font-mono tracking-widest text-white/80 uppercase">
                   {user.first_name}
                </span>
            </div>
         </header>

         {/* Dynamic Content */}
         <div className="w-full max-w-sm">
            <AnimatePresence mode="wait">
               {activeTab === 'arena' ? (
                  <motion.div key="arena" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                     <LiveArena />
                  </motion.div>
               ) : (
                  <motion.div key="wallet" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                     <WalletManager />
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>

      {/* Floating Bottom Navigation Tab */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm glass-panel p-2 flex justify-between gap-2 z-50 shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
          <button 
             onClick={() => setActiveTab('arena')}
             className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-all ${
                activeTab === 'arena' ? 'bg-white/10 text-emerald' : 'text-metallic hover:text-white/50'
             }`}
          >
             <Target size={20} className="mb-1" />
             <span className="text-[9px] font-bold uppercase tracking-widest">Live Arena</span>
          </button>
          
          <button 
             onClick={() => setActiveTab('wallet')}
             className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-all ${
                activeTab === 'wallet' ? 'bg-white/10 text-emerald' : 'text-metallic hover:text-white/50'
             }`}
          >
             <CircleDollarSign size={20} className="mb-1" />
             <span className="text-[9px] font-bold uppercase tracking-widest">Vault</span>
          </button>
      </div>

    </main>
  );
}
