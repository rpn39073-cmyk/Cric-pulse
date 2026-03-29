'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoginGateway from '@/components/LoginGateway';

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
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [webApp, setWebApp] = useState<any>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const fetchBalance = async (telegramId: number) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('telegram_id', telegramId)
        .single();
      
      if (!error && data) {
        setBalance(data.balance);
      }
    } catch (e) {
      console.error("Error fetching balance:", e);
    }
  };

  useEffect(() => {
    // Wait for the script to attach 'Telegram' to the window object
    const initApp = async () => {
      if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        const app = window.Telegram.WebApp;
        app.ready(); // Inform Telegram app is ready
        
        // Optimize view for a native app feel
        app.expand();
        if (app.isVersionAtLeast('6.1')) {
           app.setHeaderColor('#050505'); // Deep Obsidian
           app.setBackgroundColor('#050505');
        }
        
        setWebApp(app);

        // Fetch user data from Telegram context
        const tgUser = app.initDataUnsafe?.user;
        
        if (tgUser) {
           setUser(tgUser);
           
           // Upsert profile in Supabase
           const { error } = await supabase
              .from('profiles')
              .upsert(
                 { 
                    telegram_id: tgUser.id,
                    username: tgUser.username || null,
                    first_name: tgUser.first_name,
                    // Note: default balance handles itself for new inserts
                 },
                 { onConflict: 'telegram_id' }
              );

           if (!error) {
              await fetchBalance(tgUser.id);
           }
        } else {
           // If no tgUser in initDataUnsafe, we fallback to manual login
           setNeedsLogin(true);
        }
      }
    };
    
    // Add event listener to detect when WebApp is loaded
    let checkTgLocal: NodeJS.Timeout;
    
    // Development Mocking fallback if not embedded after 1.5s
    const timeout = setTimeout(async () => {
        clearInterval(checkTgLocal);
        if (!user) {
           setNeedsLogin(true);
        }
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

  if (needsLogin) {
     return <LoginGateway onSuccess={async (u) => {
         setUser(u);
         await fetchBalance(u.id);
         setNeedsLogin(false);
     }} />;
  }

  return (
    <TelegramContext.Provider value={{
      user,
      balance,
      refreshBalance: async () => { if (user) await fetchBalance(user.id) },
      webApp
    }}>
      {children}
    </TelegramContext.Provider>
  );
}

export const useTelegram = () => useContext(TelegramContext);
