'use client';

import React, { useState, useEffect } from 'react';
import { useTelegram } from './TelegramProvider';
import { supabase } from '@/lib/supabase';
import { Wallet, History, Send, QrCode, TrendingUp, CheckCircle, Clock, ArrowDownToLine, ArrowUpFromLine, SmartphoneNfc } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import { load } from '@cashfreepayments/cashfree-js';

// Initialize Cashfree
let cashfree: any;

export default function WalletManager() {
  const { user, balance, refreshBalance } = useTelegram();
  const [activeTab, setActiveTab] = useState<'deposit' | 'redeem' | 'history'>('deposit');
  const [depositMode, setDepositMode] = useState<'ONLINE' | 'MANUAL'>('ONLINE');
  
  // States
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [upiId, setUpiId] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  useEffect(() => {
    // Load Cashfree SDK globally
    const initCF = async () => {
      cashfree = await load({
        mode: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "production" // Force PROD due to the keys given
      });
    };
    initCF();
  }, []);

  useEffect(() => {
    if (user && activeTab === 'history') {
      fetchHistory();
    }
    setMessage('');
  }, [user, activeTab, depositMode]);

  const fetchHistory = async () => {
    if (!user) return;
    const { data: deps } = await supabase.from('deposits').select('id, amount, status, created_at, utr_number').eq('telegram_id', user.id);
    const { data: wds } = await supabase.from('withdrawals').select('id, amount, status, created_at, upi_id').eq('telegram_id', user.id);
      
    const combined = [
      ...(deps || []).map(d => ({ ...d, type: 'DEPOSIT', ref: d.utr_number })),
      ...(wds || []).map(w => ({ ...w, type: 'WITHDRAWAL', ref: w.upi_id }))
    ];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setHistoryItems(combined);
  };

  const verifyCashfreePayment = async (orderId: string) => {
    setMessage("Verifying payment directly with node...");
    try {
      const res = await fetch('/api/verify-payment', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId })
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage("Success: " + data.message);
        setAmount('');
        refreshBalance();
      } else {
        setMessage("Error: " + data.error);
      }
    } catch (e) {
      setMessage("Error verifying the payment.");
    }
  };

  const handleOnlineDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (parseFloat(amount) < 1) {
      setMessage('Amount is invalid.');
      return;
    }
    
    setLoading(true);
    setMessage('');

    try {
       // 1. Generate Order Session via API Route
       const res = await fetch('/api/create-payment', {
          method: 'POST',
          body: JSON.stringify({
             amount: parseFloat(amount),
             telegram_id: user.id
          })
       });
       
       const data = await res.json();
       if (!res.ok) throw new Error(data.error);

       // 2. Open Cashfree Popup Native Checkout
       let checkoutOptions = {
          paymentSessionId: data.payment_session_id,
          redirectTarget: "_modal", // Overlays on the Telegram app
       };
       
       await cashfree.checkout(checkoutOptions).then((result: any) => {
          if (result.error) {
             setMessage("Payment Failed: " + result.error.message);
          } else if (result.paymentDetails) {
             // 3. User paid! Verify with Backend
             verifyCashfreePayment(data.order_id);
          } else {
             setMessage("Payment sequence interrupted.");
          }
       });

    } catch (err: any) {
       console.error(err);
       setMessage(`Error: ${err.message}`);
    } finally {
       setLoading(false);
    }
  };

  const handleManualDeposit = async (e: React.FormEvent) => {
     // Legacy Code
     e.preventDefault();
     if (!user) return;
     if (utr.length !== 12) return setMessage('Error: UTR must be 12 digits.');
     setLoading(true);
     setMessage('');
     const { error } = await supabase.from('deposits').insert({ telegram_id: user.id, amount: parseFloat(amount), utr_number: utr, status: 'PENDING' });
     if (error) setMessage('Error: UTR likely already used.');
     else { setMessage('Request queued via manual processing.'); setAmount(''); setUtr(''); }
     setLoading(false);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const reqAmount = parseFloat(redeemAmount);
    if (!upiId.includes('@') || reqAmount > balance) return setMessage('Error: Invalid Request.');
    
    setLoading(true);
    const { error: balErr } = await supabase.from('profiles').update({ balance: balance - reqAmount }).eq('telegram_id', user.id);
    if (balErr) { setLoading(false); return setMessage('Error: Transaction Failed.'); }

    const { error } = await supabase.from('withdrawals').insert({ telegram_id: user.id, amount: reqAmount, upi_id: upiId, status: 'PENDING' });
    if (error) {
       await supabase.from('profiles').update({ balance }).eq('telegram_id', user.id);
       setMessage('Error: Failed to process withdrawal.');
    } else {
       setMessage('Success: Request Sent. Credits deducted.');
       setRedeemAmount(''); setUpiId('');
       refreshBalance();
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto">
       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Wallet size={120} /></div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-metallic uppercase">Available Units</p>
          <h2 className="text-4xl font-black italic tracking-tighter mt-1">{balance} <span className="text-lg text-emerald">CC</span></h2>
       </motion.div>

       <div className="flex gap-2">
          <button onClick={() => setActiveTab('deposit')} className={`flex-1 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-1 tracking-widest rounded-xl transition-all ${activeTab === 'deposit' ? 'bg-emerald text-black shadow-[0_4px_20px_rgba(0,255,65,0.2)]' : 'bg-black/40 border border-white/5 text-metallic'}`}><ArrowDownToLine size={12} /> Top-Up</button>
          <button onClick={() => setActiveTab('redeem')} className={`flex-1 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-1 tracking-widest rounded-xl transition-all ${activeTab === 'redeem' ? 'bg-white text-black shadow-[0_4px_20px_rgba(255,255,255,0.2)]' : 'bg-black/40 border border-white/5 text-metallic'}`}><ArrowUpFromLine size={12} /> Redeem</button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-1 tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-black/40 border border-white/5 text-metallic'}`}><History size={12} /> Log</button>
       </div>

       <AnimatePresence mode="wait">
         {activeTab === 'deposit' && (
            <motion.div key="dep" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
               
               <div className="flex justify-center bg-black/50 p-1 rounded-xl border border-white/5 mb-2">
                  <button onClick={() => setDepositMode('ONLINE')} className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all ${depositMode === 'ONLINE' ? 'bg-emerald text-black' : 'text-metallic hover:text-white'}`}>Live Gateway</button>
                  <button onClick={() => setDepositMode('MANUAL')} className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all ${depositMode === 'MANUAL' ? 'bg-white/10 text-white' : 'text-metallic hover:text-white'}`}>Manual UTR</button>
               </div>

               {depositMode === 'ONLINE' ? (
                  <form onSubmit={handleOnlineDeposit} className="space-y-4 glass-panel p-6">
                     <p className="text-[10px] text-emerald mb-2 font-bold tracking-widest uppercase text-center flex items-center justify-center gap-1"><SmartphoneNfc size={14}/> Secure PG Gateway Checkout</p>
                     <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-metallic block mb-2">Quantity (INR)</label>
                        <input type="number" required min="10" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:border-emerald/50 outline-none transition-all" placeholder="Min: ₹10" />
                     </div>
                     {message && <p className={`text-[10px] font-bold text-center mt-2 ${message.includes('Error') ? 'text-red-500' : 'text-emerald'}`}>{message}</p>}
                     <motion.button whileTap={{ scale: 0.98 }} disabled={loading} type="submit" className="w-full bg-emerald text-black font-black py-4 rounded-xl mt-4 text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        {loading ? 'Booting SDK...' : 'Pay with UPI / Cards'}
                     </motion.button>
                  </form>
               ) : (
                  <form onSubmit={handleManualDeposit} className="space-y-4 glass-panel p-6">
                     <div className="text-center border border-white/10 p-4 rounded-xl mb-4 bg-white/5">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-metallic mb-1">Pay To</p>
                        <p className="text-sm font-black tracking-widest text-emerald">ADMIN@PAYTM</p>
                     </div>
                     <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-metallic block mb-2">Quantity (INR)</label>
                        <input type="number" required min="10" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:border-white/50 outline-none transition-all" />
                     </div>
                     <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-metallic block mb-2">12-Digit UTR Ref</label>
                        <input type="text" required maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:border-white/50 outline-none transition-all" placeholder="123456789012" />
                     </div>
                     {message && <p className={`text-[10px] font-bold text-center mt-2 ${message.includes('Error') ? 'text-red-500' : 'text-emerald'}`}>{message}</p>}
                     <motion.button whileTap={{ scale: 0.98 }} disabled={loading} type="submit" className="w-full bg-white text-black font-black py-4 rounded-xl mt-4 text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        {loading ? 'Processing...' : 'Submit Reference'} <Send size={14} />
                     </motion.button>
                  </form>
               )}
            </motion.div>
         )}

         {/* Redeem and History tabs logic remained unchanged, omitted redundant logs to save complexity but rendered the exact forms */}
         {activeTab === 'redeem' && (
            <motion.div key="red" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
               <form onSubmit={handleRedeem} className="space-y-4 glass-panel p-6">
                  <div>
                     <label className="text-[10px] uppercase font-bold tracking-widest text-metallic block mb-2">Amount to Withdraw (CC)</label>
                     <input type="number" required min="500" max={balance} value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:border-white/50 outline-none transition-all" placeholder="Min 500 CC" />
                  </div>
                  <div>
                     <label className="text-[10px] uppercase font-bold tracking-widest text-metallic block mb-2">Destination UPI ID</label>
                     <input type="text" required value={upiId} onChange={(e) => setUpiId(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:border-white/50 outline-none transition-all" placeholder="name@bank" />
                  </div>
                  {message && <p className={`text-[10px] font-bold text-center mt-2 ${message.includes('Error') ? 'text-red-500' : 'text-emerald'}`}>{message}</p>}
                  <motion.button whileTap={{ scale: 0.98 }} disabled={loading} type="submit" className="w-full bg-white text-black font-black py-4 rounded-xl mt-4 text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                     {loading ? 'Processing...' : 'Request Payout'} <ArrowUpFromLine size={14} />
                  </motion.button>
               </form>
            </motion.div>
         )}

         {activeTab === 'history' && (
            <motion.div key="hist" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
               {historyItems.length === 0 ? (
                  <div className="glass-panel p-10 text-center flex flex-col items-center"><History className="text-metallic/40 mb-3" size={32} /><p className="text-[10px] text-metallic font-bold uppercase tracking-widest">No previous logs</p></div>
               ) : (
                  historyItems.map((item) => (
                     <div key={item.id} className="glass-panel p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-lg ${item.status === 'APPROVED' ? 'bg-emerald/10 text-emerald' : item.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-metallic'}`}>{item.status === 'APPROVED' ? <CheckCircle size={16} /> : <Clock size={16} />}</div>
                           <div>
                              <p className={`font-mono text-sm font-bold ${item.type === 'DEPOSIT' ? 'text-emerald' : 'text-white'}`}>{item.type === 'DEPOSIT' ? '+' : '-'} {item.amount}</p>
                              <p className="text-[9px] text-metallic font-mono mt-0.5">REF: {item.ref.substring(0, 16)}...</p>
                           </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                           <span className={`text-[8px] mb-1 font-bold tracking-[0.2em] bg-white/5 px-2 py-0.5 rounded ${item.type === 'DEPOSIT' ? 'text-emerald' : 'text-white/50'}`}>{item.type}</span>
                           <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${item.status === 'APPROVED' ? 'bg-emerald/5 border-emerald/20 text-emerald' : item.status === 'REJECTED' ? 'bg-red-500/5 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-metallic'}`}>{item.status}</span>
                        </div>
                     </div>
                  ))
               )}
            </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}
