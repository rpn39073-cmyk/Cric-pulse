'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, Shield, User, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SecurityLockScreen({
  telegramId,
  isSetupMode,
  onUnlock,
}: {
  telegramId: number;
  isSetupMode: boolean;
  onUnlock: () => void;
}) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mobile.length !== 10) {
       setError("Enter a valid 10-digit mobile number.");
       return;
    }
    if (password.length < 4) {
       setError("Password must be at least 4 characters.");
       return;
    }

    setLoading(true);

    if (isSetupMode) {
       if (password !== confirmPassword) {
           setError("Passwords do not match.");
           setLoading(false);
           return;
       }
       // Save Mobile & Password to DB
       const { error: dbErr } = await supabase
         .from('profiles')
         .update({ mobile_number: mobile, password_hash: password }) 
         .eq('telegram_id', telegramId);
       
       setLoading(false);
       if (!dbErr) onUnlock();
       else setError('Registration failed. Try again.');
    } else {
       // Login Phase - Verify credentials against their linked TWA profile
       const { data, error: dbErr } = await supabase
         .from('profiles')
         .select('mobile_number, password_hash')
         .eq('telegram_id', telegramId)
         .single();
         
       setLoading(false);
       if (data && data.mobile_number === mobile && data.password_hash === password) {
          onUnlock(); // Success!
       } else {
          setError('Invalid Mobile Number or Password.');
       }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-obsidian p-6 relative overflow-hidden z-[9999]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="z-10 w-full max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald/20 flex items-center justify-center mx-auto mb-6 border border-emerald/30 shadow-[0_0_30px_rgba(0,255,65,0.2)]">
          {isSetupMode ? <Shield className="text-emerald" size={32} /> : <Lock className="text-emerald" size={32} />}
        </div>
        
        <div className="text-center mb-8">
           <h1 className="text-2xl font-black text-white tracking-widest uppercase mb-2">
             {isSetupMode ? 'Create Account' : 'Secure Login'}
           </h1>
           <p className="text-xs text-metallic font-mono h-4">
             {error ? <span className="text-red-500 animate-pulse">{error}</span> : 
               (isSetupMode ? 'Link Mobile Number & Password' : 'Login using your credentials')}
           </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
           {/* Mobile Input */}
           <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-metallic" />
              <input 
                 type="tel"
                 placeholder="10-Digit Mobile No."
                 value={mobile}
                 onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                 className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-mono outline-none focus:border-emerald/50 transition-colors"
                 required
              />
           </div>

           {/* Password Input */}
           <div className="relative">
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-metallic" />
              <input 
                 type="password"
                 placeholder="Password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-mono outline-none focus:border-emerald/50 transition-colors"
                 required
              />
           </div>

           {/* Confirm Password (Setup Only) */}
           {isSetupMode && (
              <div className="relative">
                 <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-metallic" />
                 <input 
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-mono outline-none focus:border-emerald/50 transition-colors"
                    required
                 />
              </div>
           )}

           <button 
              type="submit" disabled={loading}
              className="w-full bg-emerald text-black font-black uppercase tracking-widest p-4 rounded-xl hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(0,255,65,0.2)] mt-4"
           >
              {loading ? 'Processing...' : isSetupMode ? 'Register' : 'Login'}
           </button>
        </form>

      </motion.div>
    </div>
  );
}
