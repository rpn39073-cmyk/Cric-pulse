'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoginGateway from '@/components/LoginGateway';
import SecurityLockScreen from '@/components/SecurityLockScreen';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramContextValue {
  user: TelegramUser | null;
  balance: number;
  refreshBalance: () => Promise<void>;
  webApp: any | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  user: null,
  balance: 0,
  refreshBalance: async () => {},
  webApp: null,
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [webApp, setWebApp] = useState<any>(null);
  
  // Security States
  const [needsLogin, setNeedsLogin] = useState(false);
  const [hasMobile, setHasMobile] = useState<boolean | null>(null);
  const [pinVerified, setPinVerified] = useState(false); // Keeps logic same, just verifies Mobile+Pass

  const fetchProfileData = async (telegramId: number) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance, mobile_number')
        .eq('telegram_id', telegramId)
        .single();
      
      if (!error && data) {
        setBalance(data.balance);
        setHasMobile(data.mobile_number !== null);
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        const app = window.Telegram.WebApp;
        app.ready();
        app.expand();
        if (app.isVersionAtLeast('6.1')) {
           app.setHeaderColor('#050505'); 
           app.setBackgroundColor('#050505');
        }
        setWebApp(app);

        const tgUser = app.initDataUnsafe?.user;
        
        if (tgUser) {
           setUser(tgUser);
           const { error } = await supabase.from('profiles').upsert(
                 { telegram_id: tgUser.id, username: tgUser.username || null, first_name: tgUser.first_name },
                 { onConflict: 'telegram_id' }
              );

           if (!error) await fetchProfileData(tgUser.id);
        } else {
           setNeedsLogin(true);
        }
      }
    };
    
    let checkTgLocal: NodeJS.Timeout;
    const timeout = setTimeout(async () => {
        clearInterval(checkTgLocal);
        if (!user) setNeedsLogin(true);
    }, 1500);

    checkTgLocal = setInterval(() => {
       if (typeof window !== 'undefined' && window.Telegram) {
          clearInterval(checkTgLocal);
          initApp();
       }
    }, 100);

    return () => {
       clearInterval(checkTgLocal);
       clearTimeout(timeout);
    };
  }, []);

  if (pathname?.startsWith('/admin-x')) {
      return <>{children}</>;
  }

  if (needsLogin) {
     return <LoginGateway onSuccess={async (u) => {
         setUser(u);
         await fetchProfileData(u.id);
         setNeedsLogin(false);
     }} />;
  }

  // If user exists, but PIN logic is pending, block the screen with Security Lock
  if (user && !pinVerified && hasMobile !== null) {
      return <SecurityLockScreen 
          telegramId={user.id} 
          isSetupMode={!hasMobile} 
          onUnlock={() => setPinVerified(true)} 
      />;
  }

  return (
    <TelegramContext.Provider value={{
      user: pinVerified ? user : null, // Prevent hydration flashes
      balance,
      refreshBalance: async () => { if (user) await fetchProfileData(user.id) },
      webApp
    }}>
      {children}
    </TelegramContext.Provider>
  );
}

export const useTelegram = () => useContext(TelegramContext);
