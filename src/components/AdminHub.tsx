'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Check, X, RefreshCw, Users, Shield, Plus, Minus, ArrowUpRight, Search, Clock, Award, XCircle } from 'lucide-react';

const PREDICTIONS = ['0/1 Run', '2 Runs', '3 Runs', '4 Runs', '6 Runs', 'Wide', 'Wicket', 'No Ball'];

export default function AdminHub() {
  const [matchState, setMatchState] = useState<any>(null);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedResult, setSelectedResult] = useState(PREDICTIONS[0]);

  // Adjust balance states
  const [adjustTarget, setAdjustTarget] = useState<number | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('');

  // Search & Profile states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserDossier, setSelectedUserDossier] = useState<{user: any, history: any[]} | null>(null);

  const fetchData = async () => {
    // Global state
    const { data: st } = await supabase.from('match_state').select('*').eq('id', 1).single();
    setMatchState(st);

    // Pending deposits
    const { data: deps } = await supabase.from('deposits').select('*').eq('status', 'PENDING');
    setPendingDeposits(deps || []);

    // Pending withdrawals
    const { data: wds } = await supabase.from('withdrawals').select('*').eq('status', 'PENDING');
    setPendingWithdrawals(wds || []);

    // All registered users
    const { data: usrs } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(usrs || []);
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authPin === '1234') setIsAuthenticated(true);
  };

  const setMarketLock = async (locked: boolean) => {
    setLoading(true);
    await supabase.from('match_state').update({ is_locked: locked }).eq('id', 1);
    await fetchData();
    setLoading(false);
  };

  const settleBall = async () => {
    setLoading(true);
    await supabase.from('match_state').update({ is_locked: true, current_ball_result: selectedResult }).eq('id', 1);

    const { data: bets } = await supabase.from('predictions').select('id, telegram_id, choice, potential_win, amount').eq('status', 'PENDING');
    if (bets) {
      for (const bet of bets) {
        if (bet.choice === selectedResult) {
          
          let payout = bet.potential_win;

          // RULE 1: 12x Only Once for 6 Runs
          if (bet.choice === '6 Runs') {
             const { count } = await supabase
               .from('predictions')
               .select('*', { count: 'exact', head: true })
               .eq('telegram_id', bet.telegram_id)
               .eq('choice', '6 Runs')
               .eq('status', 'WON');
               
             if (count && count > 0) {
                 payout = 0; // Already won 12x before, deny payout!
             }
          }

          await supabase.from('predictions').update({ status: 'WON', actual_win: payout }).eq('id', bet.id);
          const { data: p } = await supabase.from('profiles').select('balance').eq('telegram_id', bet.telegram_id).single();
          if (p && payout > 0) {
            await supabase.from('profiles').update({ balance: p.balance + payout }).eq('telegram_id', bet.telegram_id);
          }
        } else {
          // RULE 2: -12x Penalty ONLY IF they have previously won 6 Runs (The Trap)
          await supabase.from('predictions').update({ status: 'LOST' }).eq('id', bet.id);
          
          if (bet.choice === '6 Runs') {
             const { count } = await supabase
               .from('predictions')
               .select('*', { count: 'exact', head: true })
               .eq('telegram_id', bet.telegram_id)
               .eq('choice', '6 Runs')
               .eq('status', 'WON');

             if (count && count > 0) {
                 const penalty = bet.amount * 12;
                 const { data: p } = await supabase.from('profiles').select('balance').eq('telegram_id', bet.telegram_id).single();
                 if (p) {
                   // Allow balance to go deep into the negative (Debt)
                   await supabase.from('profiles').update({ balance: p.balance - penalty }).eq('telegram_id', bet.telegram_id);
                 }
             }
          }
        }
      }
    }
    await supabase.from('match_state').update({ is_locked: false }).eq('id', 1);
    await fetchData();
    setLoading(false);
    alert('Ball Settled successfully!');
  };

  const resolveDeposit = async (id: string, telegramId: number, amount: number, isApproved: boolean) => {
    setLoading(true);
    if (isApproved) {
      await supabase.from('deposits').update({ status: 'APPROVED', resolved_at: new Date().toISOString() }).eq('id', id);
      const { data: p } = await supabase.from('profiles').select('balance').eq('telegram_id', telegramId).single();
      if (p) await supabase.from('profiles').update({ balance: p.balance + amount }).eq('telegram_id', telegramId);
    } else {
      await supabase.from('deposits').update({ status: 'REJECTED', resolved_at: new Date().toISOString() }).eq('id', id);
    }
    await fetchData();
    setLoading(false);
  };

  const resolveWithdrawal = async (id: string, telegramId: number, amount: number, isApproved: boolean) => {
    setLoading(true);
    if (isApproved) {
      await supabase.from('withdrawals').update({ status: 'APPROVED', resolved_at: new Date().toISOString() }).eq('id', id);
    } else {
      await supabase.from('withdrawals').update({ status: 'REJECTED', resolved_at: new Date().toISOString() }).eq('id', id);
      const { data: p } = await supabase.from('profiles').select('balance').eq('telegram_id', telegramId).single();
      if (p) await supabase.from('profiles').update({ balance: p.balance + amount }).eq('telegram_id', telegramId);
    }
    await fetchData();
    setLoading(false);
  };

  const adjustManualBalance = async (telegramId: number, type: 'ADD' | 'SUBTRACT') => {
    const amt = parseFloat(adjustAmt);
    if (!amt || isNaN(amt) || amt <= 0) return alert("Invalid amount");
    
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('balance').eq('telegram_id', telegramId).single();
    if (p) {
       const newBal = type === 'ADD' ? p.balance + amt : Math.max(0, p.balance - amt);
       await supabase.from('profiles').update({ balance: newBal }).eq('telegram_id', telegramId);
       alert(`Adjusted! New Balance: ${newBal}`);
       setAdjustTarget(null);
       setAdjustAmt('');
       await fetchData();
    }
    setLoading(false);
  };

  const openDossier = async (u: any) => {
    setLoading(true);
    const { data: hist } = await supabase
       .from('predictions')
       .select('*')
       .eq('telegram_id', u.telegram_id)
       .order('created_at', { ascending: false })
       .limit(30);
    setSelectedUserDossier({ user: u, history: hist || [] });
    setLoading(false);
  };

  const filteredUsers = users.filter((u) => {
     if (!searchQuery) return true;
     const sq = searchQuery.toLowerCase();
     return u.first_name?.toLowerCase().includes(sq) || 
            u.username?.toLowerCase().includes(sq) || 
            u.telegram_id.toString().includes(sq);
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian text-white p-6">
        <form onSubmit={handleAuth} className="glass-panel p-8 w-full max-w-sm flex flex-col items-center">
          <ShieldAlert size={40} className="text-red-500 mb-4" />
          <h2 className="text-xl font-black uppercase mb-6 tracking-widest text-center">Root System</h2>
          <input 
             type="password" placeholder="ENTER PIN" value={authPin} onChange={e => setAuthPin(e.target.value)}
             className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-center tracking-[0.5em] text-emerald mb-4 outline-none focus:border-emerald"
          />
          <button type="submit" className="w-full bg-emerald text-black font-black uppercase tracking-widest p-4 rounded-xl">Verify</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-obsidian text-white p-4 font-sans no-scrollbar overflow-y-auto pb-20 relative">
       {/* USER DOSSIER MODAL OVERLAY */}
       {selectedUserDossier && (
          <div className="absolute inset-x-0 inset-y-0 z-50 bg-obsidian/95 backdrop-blur-md p-4 overflow-y-auto no-scrollbar">
             <button onClick={() => setSelectedUserDossier(null)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20">
                <X size={20} />
             </button>
             
             <div className="mt-8 mb-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald/20 flex items-center justify-center mx-auto mb-4 border border-emerald/30 shadow-[0_0_20px_rgba(0,255,65,0.2)]">
                   <Users className="text-emerald" size={32} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-widest">{selectedUserDossier.user.first_name}</h2>
                <p className="text-metallic text-xs font-mono mt-1">@{selectedUserDossier.user.username || 'unknown'}</p>
                <p className="text-metallic text-[10px] font-mono mt-1">ID: {selectedUserDossier.user.telegram_id}</p>
                <div className="mt-4 bg-emerald/10 border border-emerald/30 inline-block px-4 py-2 rounded-lg">
                   <p className="text-[10px] uppercase tracking-widest text-emerald/70 font-bold mb-1">Live Balance</p>
                   <p className="text-2xl font-black text-emerald font-mono">₹{selectedUserDossier.user.balance}</p>
                </div>
                <p className="text-[9px] text-metallic mt-3">Joined: {new Date(selectedUserDossier.user.created_at).toLocaleString()}</p>
             </div>

             <div className="border-t border-white/10 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-metallic mb-4 flex justify-between items-center">
                   Betting Ledger (Last 30) <span className="bg-white/10 px-2 py-0.5 rounded-full">{selectedUserDossier.history.length}</span>
                </h3>
                <div className="space-y-2">
                   {selectedUserDossier.history.length === 0 && <p className="text-center text-xs text-white/30 italic py-4">No history found</p>}
                   {selectedUserDossier.history.map((bet, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-black/50 border border-white/5 rounded-xl">
                         <div>
                            <p className="text-xs font-bold text-white flex items-center gap-1">
                               {bet.choice}
                            </p>
                            <p className="text-[9px] text-metallic mt-1">{new Date(bet.created_at).toLocaleString()}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-xs font-mono text-white mb-1">Amt: ₹{bet.amount}</p>
                            {bet.status === 'PENDING' && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded flex items-center gap-1 justify-end"><Clock size={10}/> PENDING</span>}
                            {bet.status === 'WON' && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-emerald/20 text-emerald rounded flex items-center gap-1 justify-end"><Award size={10}/> WON ₹{bet.actual_win}</span>}
                            {bet.status === 'LOST' && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-red-500/20 text-red-500 rounded flex items-center gap-1 justify-end"><XCircle size={10}/> LOST</span>}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
       )}

       <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black italic tracking-tighter text-emerald">ADMIN_NODE</h1>
          <button onClick={fetchData} className="p-2 glass-panel border-white/10 rounded-full"><RefreshCw size={16} /></button>
       </div>

       {/* ENGINE CONTROLS */}
       <div className="glass-panel p-4 mb-4 border-red-500/20">
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-metallic uppercase mb-3 text-red-500 flex items-center gap-1"><Shield size={12}/> Algorithm Controller</h2>
          <div className="flex justify-between items-center mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
             <span className="font-mono text-xs font-bold">Status: {matchState?.is_locked ? <span className="text-red-500">LOCKED</span> : <span className="text-emerald">OPEN</span>}</span>
             <button 
                disabled={loading} onClick={() => setMarketLock(!matchState?.is_locked)}
                className={`px-3 py-1.5 font-black uppercase tracking-widest text-[9px] rounded-lg ${matchState?.is_locked ? 'bg-emerald text-black' : 'bg-red-500 text-white'}`}
             >
                {matchState?.is_locked ? 'Unlock Market' : 'Lock Market'}
             </button>
          </div>

          <div className="space-y-3">
             <select 
               value={selectedResult} onChange={e => setSelectedResult(e.target.value)}
               className="w-full bg-black/50 border border-emerald/50 p-3 rounded-xl text-emerald font-black tracking-widest outline-none text-sm"
             >
                {PREDICTIONS.map(p => <option key={p} value={p}>{p}</option>)}
             </select>
             <button 
                onClick={settleBall} disabled={loading}
                className="w-full bg-emerald text-black font-black italic uppercase tracking-widest p-3 rounded-xl shadow-[0_5px_20px_rgba(0,255,65,0.2)] text-xs"
             >
                {loading ? 'Processing...' : 'Settle Ball Outcomes'}
             </button>
          </div>
       </div>

       {/* MANUAL SCORE UPDATER */}
       <div className="glass-panel p-4 mb-4">
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-metallic uppercase mb-3">Live Feed Override</h2>
          <div className="space-y-2">
             <div className="flex gap-2">
                <input type="text" placeholder="Team A" value={matchState?.live_score?.teamA || ''} onChange={e => setMatchState({...matchState, live_score: {...(matchState?.live_score || {}), teamA: e.target.value}})} className="flex-1 bg-black/50 border border-white/10 p-2 rounded-lg text-xs outline-none" />
                <input type="text" placeholder="Team B" value={matchState?.live_score?.teamB || ''} onChange={e => setMatchState({...matchState, live_score: {...(matchState?.live_score || {}), teamB: e.target.value}})} className="flex-1 bg-black/50 border border-white/10 p-2 rounded-lg text-xs outline-none" />
             </div>
             <div className="flex gap-2">
                <input type="text" placeholder="Score 0/0" value={matchState?.live_score?.score || ''} onChange={e => setMatchState({...matchState, live_score: {...(matchState?.live_score || {}), score: e.target.value}})} className="w-1/2 bg-black/50 border border-emerald/30 p-2 rounded-lg text-emerald font-black outline-none" />
                <input type="text" placeholder="Overs 0.0" value={matchState?.live_score?.overs || ''} onChange={e => setMatchState({...matchState, live_score: {...(matchState?.live_score || {}), overs: e.target.value}})} className="w-1/2 bg-black/50 border border-white/10 p-2 rounded-lg text-xs outline-none" />
             </div>
             <div className="flex gap-2">
                <input type="text" placeholder="Target" value={matchState?.live_score?.target || ''} onChange={e => setMatchState({...matchState, live_score: {...(matchState?.live_score || {}), target: e.target.value}})} className="flex-1 bg-black/50 border border-white/10 p-2 rounded-lg text-xs outline-none" />
                <input type="text" placeholder="Status" value={matchState?.live_score?.status || ''} onChange={e => setMatchState({...matchState, live_score: {...(matchState?.live_score || {}), status: e.target.value}})} className="flex-1 bg-black/50 border border-white/10 p-2 rounded-lg text-xs outline-none" />
             </div>
             <button 
                onClick={async () => {
                   setLoading(true);
                   const { data, error } = await supabase.from('match_state').update({ live_score: matchState.live_score }).eq('id', 1).select();
                   if (error) alert(`Error: ${error.message}`);
                   else if (!data || data.length === 0) alert('WARNING: Row id=1 not found!');
                   else alert('Feed Broadcasted!');
                   setLoading(false);
                }} disabled={loading}
                className="w-full bg-white text-black font-black uppercase tracking-widest p-3 rounded-lg mt-2 text-xs"
             >
                Broadcast Feed
             </button>
          </div>
       </div>

       {/* WITHDRAWAL QUEUE */}
       <div className="glass-panel p-4 mb-4 border border-blue-500/20">
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-metallic uppercase mb-3 flex justify-between">
             Payout Queue <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full">{pendingWithdrawals.length}</span>
          </h2>
          <div className="space-y-2">
             {pendingWithdrawals.length === 0 && <p className="text-center text-metallic text-xs italic py-2">No pending payouts</p>}
             {pendingWithdrawals.map(wd => {
                const associatedUser = users.find(u => u.telegram_id === wd.telegram_id);
                return (
                   <div key={wd.id} className="bg-black/50 border border-white/10 p-3 rounded-xl flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="font-mono font-bold text-sm text-white flex items-center gap-2">
                               [{wd.telegram_id}]
                               {associatedUser && <span className="text-[9px] bg-white/10 px-1 rounded text-metallic font-sans">{associatedUser.first_name}</span>}
                            </p>
                            <p className="font-mono font-black text-xl text-blue-400 mt-1">₹{wd.amount}</p>
                            <p className="font-mono text-[9px] text-metallic mt-1">Pay To: <span className="text-white">{wd.upi_id}</span></p>
                            {associatedUser && (
                               <div className="mt-2 bg-white/5 border border-white/10 p-1.5 rounded inline-block">
                                  <p className="font-mono text-[9px] text-metallic flex gap-1">Wallet Balance: <span className={`font-bold ${associatedUser.balance < 0 ? 'text-red-500' : 'text-emerald'}`}>₹{associatedUser.balance}</span></p>
                               </div>
                            )}
                         </div>
                         <div className="flex gap-2">
                            <button onClick={() => resolveWithdrawal(wd.id, wd.telegram_id, wd.amount, false)} className="p-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20"><X size={16} /></button>
                            <button onClick={() => resolveWithdrawal(wd.id, wd.telegram_id, wd.amount, true)} className="p-2 bg-emerald/10 text-emerald rounded-lg border border-emerald/20"><Check size={16}/></button>
                         </div>
                      </div>
                   </div>
                );
             })}
          </div>
       </div>

       {/* DEPOSIT QUEUE */}
       <div className="glass-panel p-4 mb-4 border border-emerald/20">
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-metallic uppercase mb-3 flex justify-between">
             Deposit Queue <span className="bg-emerald text-black px-2 py-0.5 rounded-full">{pendingDeposits.length}</span>
          </h2>
          <div className="space-y-2">
             {pendingDeposits.length === 0 && <p className="text-center text-metallic text-xs italic py-2">No pending deposits</p>}
             {pendingDeposits.map(dep => (
                <div key={dep.id} className="bg-black/50 border border-white/10 p-3 rounded-xl flex flex-col gap-2">
                   <div className="flex justify-between items-start">
                      <div>
                         <p className="font-mono font-bold text-sm text-white">[{dep.telegram_id}]</p>
                         <p className="font-mono font-bold text-lg text-emerald mt-1">₹{dep.amount}</p>
                         <p className="font-mono text-[9px] text-metallic mt-1">UTR: <span className="text-white">{dep.utr_number}</span></p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => resolveDeposit(dep.id, dep.telegram_id, dep.amount, false)} className="p-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20"><X size={16} /></button>
                         <button onClick={() => resolveDeposit(dep.id, dep.telegram_id, dep.amount, true)} className="p-2 bg-emerald/10 text-emerald rounded-lg border border-emerald/20"><Check size={16}/></button>
                      </div>
                   </div>
                </div>
             ))}
          </div>
       </div>

       {/* USER DIRECTORY WITH SEARCH */}
       <div className="glass-panel p-4">
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-metallic uppercase mb-3 flex items-center justify-between">
             <span className="flex items-center gap-1"><Users size={12} /> Directory ({filteredUsers.length})</span>
          </h2>
          
          <div className="relative mb-4">
             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-metallic" />
             <input 
                type="text" 
                placeholder="Search by ID, Name, Username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald/50 transition-colors"
             />
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
             {filteredUsers.length === 0 && <p className="text-center text-metallic text-[10px] py-4">No users found.</p>}
             {filteredUsers.map(u => (
                <div key={u.telegram_id} className="bg-white/5 border border-white/10 p-3 rounded-xl transition-colors hover:border-emerald/30 group">
                   <div className="flex justify-between items-center cursor-pointer" onClick={() => openDossier(u)}>
                      <div>
                         <p className="font-mono text-xs font-bold text-white flex items-center gap-2">
                           {u.first_name} <span className="text-[9px] text-metallic bg-black/50 px-1 rounded">ID:{u.telegram_id}</span>
                         </p>
                         <p className={`font-mono text-sm mt-1 font-bold ${u.balance < 0 ? 'text-red-500' : 'text-emerald'}`}>₹{u.balance}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                         <button 
                            onClick={(e) => { e.stopPropagation(); setAdjustTarget(adjustTarget === u.telegram_id ? null : u.telegram_id); }}
                            className="p-1 px-3 text-[9px] font-bold uppercase tracking-widest bg-white/10 border border-white/20 rounded-lg text-metallic hover:text-white"
                         >
                            Adjust
                         </button>
                      </div>
                   </div>
                   
                   {/* Manual Adjustment Expansion */}
                   {adjustTarget === u.telegram_id && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                         <input 
                            type="number" 
                            placeholder="Amount" 
                            value={adjustAmt} 
                            onChange={(e) => setAdjustAmt(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2 text-xs font-mono outline-none"
                         />
                         <button onClick={() => adjustManualBalance(u.telegram_id, 'ADD')} className="p-2 bg-emerald/20 text-emerald rounded-lg border border-emerald/30"><Plus size={14}/></button>
                         <button onClick={() => adjustManualBalance(u.telegram_id, 'SUBTRACT')} className="p-2 bg-red-500/20 text-red-500 rounded-lg border border-red-500/30"><Minus size={14}/></button>
                      </div>
                   )}
                </div>
             ))}
          </div>
       </div>

    </div>
  );
}
