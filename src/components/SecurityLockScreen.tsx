'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, Shield, Fingerprint, ArrowRight, Vibrate } from 'lucide-react';
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
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(isSetupMode ? 'SET' : 'ENTER'); // 'SET', 'CONFIRM', 'ENTER'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeyPress = (num: string) => {
    setError('');
    if (step === 'SET') {
      if (pin.length < 4) setPin(prev => prev + num);
    } else if (step === 'CONFIRM') {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + num);
    } else {
      if (pin.length < 4) setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setError('');
    if (step === 'SET') setPin(prev => prev.slice(0, -1));
    else if (step === 'CONFIRM') setConfirmPin(prev => prev.slice(0, -1));
    else setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    const processPin = async () => {
      // Handle Setup Phase
      if (isSetupMode && step === 'SET' && pin.length === 4) {
        setTimeout(() => setStep('CONFIRM'), 300);
      }
      
      if (isSetupMode && step === 'CONFIRM' && confirmPin.length === 4) {
        if (pin === confirmPin) {
          // Save to DB
          setLoading(true);
          const { error: dbErr } = await supabase
            .from('profiles')
            .update({ security_pin: pin })
            .eq('telegram_id', telegramId);
          
          setLoading(false);
          if (!dbErr) onUnlock();
          else setError('Failed to save PIN.');
        } else {
          setError('PINs do not match. Try again.');
          setPin('');
          setConfirmPin('');
          setStep('SET');
        }
      }

      // Handle Login Phase
      if (!isSetupMode && step === 'ENTER' && pin.length === 4) {
        setLoading(true);
        // Verify with database directly for maximum security
        const { data, error: dbErr } = await supabase
          .from('profiles')
          .select('security_pin')
          .eq('telegram_id', telegramId)
          .single();
          
        setLoading(false);
        if (data && data.security_pin === pin) {
           onUnlock();
        } else {
           setError('Incorrect PIN. Try again.');
           setPin('');
        }
      }
    };

    processPin();
  }, [pin, confirmPin]);

  const displayPin = step === 'CONFIRM' ? confirmPin : pin;

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-obsidian p-6 relative overflow-hidden z-[9999]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center z-10 w-full max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald/20 flex items-center justify-center mx-auto mb-6 border border-emerald/30 shadow-[0_0_30px_rgba(0,255,65,0.2)]">
          {isSetupMode ? <Shield className="text-emerald" size={32} /> : <Lock className="text-emerald" size={32} />}
        </div>
        
        <h1 className="text-2xl font-black text-white tracking-widest uppercase mb-2">
          {isSetupMode ? 'Secure Account' : 'Unlock App'}
        </h1>
        <p className="text-xs text-metallic font-mono mb-8 h-4">
          {error ? <span className="text-red-500 animate-pulse">{error}</span> : 
            step === 'SET' ? 'Create your 4-Digit Security PIN' : 
            step === 'CONFIRM' ? 'Confirm your 4-Digit Security PIN' : 
            'Enter your 4-Digit PIN to proceed'}
        </p>

        {/* PIN Dots */}
        <div className="flex justify-center gap-4 mb-12">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${displayPin.length > i ? 'bg-emerald shadow-[0_0_10px_#00FF41]' : 'border-2 border-white/20 bg-black/50'}`} />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button key={num} onClick={() => handleKeyPress(num.toString())} disabled={loading} className="h-16 rounded-full bg-white/5 border border-white/5 text-2xl font-mono text-white active:bg-white/20 active:scale-95 transition-all flex items-center justify-center">
              {num}
            </button>
          ))}
          <div className="h-16"></div> {/* Empty Slot */}
          <button onClick={() => handleKeyPress('0')} disabled={loading} className="h-16 rounded-full bg-white/5 border border-white/5 text-2xl font-mono text-white active:bg-white/20 active:scale-95 transition-all flex items-center justify-center">
            0
          </button>
          <button onClick={handleDelete} disabled={loading} className="h-16 rounded-full bg-white/5 border border-white/5 text-sm font-black uppercase text-metallic active:bg-white/20 active:scale-95 transition-all flex items-center justify-center">
            DEL
          </button>
        </div>
      </motion.div>
    </div>
  );
}
