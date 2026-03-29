'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Clock, ShieldAlert, CircleDollarSign, ArrowRight, Check } from 'lucide-react';

export default function TutorialOverlay({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const slides = [
    {
       title: "Welcome to the Arena",
       desc: "Predict the exact outcome of the next delivery. Play smart, leverage the multipliers, and build your Cric-Credits portfolio.",
       icon: <Target size={64} className="text-emerald drop-shadow-[0_0_20px_#00FF41]" />,
       accent: "text-emerald"
    },
    {
       title: "The 30-Second Window",
       desc: "When the market opens, a green line will start moving at the top of your screen. You have EXACTLY 30 seconds to lock in your strategy before it freezes.",
       icon: <Clock size={64} className="text-blue-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]" />,
       accent: "text-blue-500"
    },
    {
       title: "The Jackpot Trap",
       desc: "Hitting '6 Runs' pays a massive 12x return! WARNING: If you win the Jackpot and guess it wrong again later, you face a severe 12x penalty! Use it wisely.",
       icon: <ShieldAlert size={64} className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" />,
       accent: "text-red-500"
    },
    {
       title: "The Vault",
       desc: "Access your Vault from the bottom menu to instantly deposit via UPI or withdraw your winnings straight to your bank account.",
       icon: <CircleDollarSign size={64} className="text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" />,
       accent: "text-yellow-500"
    }
  ];

  const handleNext = () => {
     if (step < slides.length - 1) setStep(step + 1);
     else onComplete();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-obsidian/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
       
       <AnimatePresence mode="wait">
          <motion.div
             key={step}
             initial={{ opacity: 0, scale: 0.9, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 1.1, y: -20 }}
             transition={{ duration: 0.3 }}
             className="w-full max-w-sm flex flex-col items-center"
          >
             <div className="mb-10 w-32 h-32 rounded-full glass-panel flex flex-col items-center justify-center animate-bounce-slow">
                {slides[step].icon}
             </div>

             <h2 className="text-2xl font-black italic uppercase tracking-wider text-white drop-shadow-md mb-4">
                {slides[step].title}
             </h2>

             <p className="text-sm font-mono text-metallic leading-relaxed max-w-[280px]">
                {slides[step].desc}
             </p>
          </motion.div>
       </AnimatePresence>

       {/* Pagination Dots */}
       <div className="flex gap-3 my-12">
          {slides.map((_, i) => (
             <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${step === i ? 'bg-white w-6' : 'bg-white/20'}`} />
          ))}
       </div>

       <button
          onClick={handleNext}
          className="w-full max-w-[280px] bg-emerald text-black font-black uppercase tracking-widest p-4 rounded-full flex items-center justify-center gap-2 hover:scale-[0.98] transition-transform shadow-[0_10px_30px_rgba(0,255,65,0.2)]"
       >
          {step === slides.length - 1 ? (
             <>START PLAYING <Check size={18} /></>
          ) : (
             <>CONTINUE <ArrowRight size={18} /></>
          )}
       </button>
    </div>
  );
}
