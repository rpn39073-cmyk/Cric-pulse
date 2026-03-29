-- PostgreSQL Database Schema for Cric-Pulse Strategy Hub (TWA)

-- 1. PROFILES TABLE (Stores Telegram Users & Balances)
CREATE TABLE IF NOT EXISTS profiles (
    telegram_id BIGINT PRIMARY KEY, -- Telegram User ID
    username VARCHAR(255),
    first_name VARCHAR(255),
    balance NUMERIC(18, 2) DEFAULT 0.00, -- 'Cric-Credits'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. MATCH_STATE TABLE (A single row to hold the global "2-Ball Safety Lock" and results)
CREATE TABLE IF NOT EXISTS match_state (
    id INT PRIMARY KEY DEFAULT 1, -- Singleton pattern
    is_locked BOOLEAN DEFAULT FALSE,
    current_ball_result VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initialize the single match_state row if not exists
INSERT INTO match_state (id, is_locked) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

-- 3. PREDICTIONS TABLE (Stores user strategies/bets)
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT REFERENCES profiles(telegram_id) ON DELETE CASCADE,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    choice VARCHAR(50) NOT NULL, -- '0/1 Run', '2 Runs', '3 Runs', '4 Runs', '6 Runs', 'Wide', 'Wicket', 'No Ball'
    multiplier NUMERIC(8, 2) NOT NULL,
    potential_win NUMERIC(18, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'WON', 'LOST'
    actual_win NUMERIC(18, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. DEPOSITS TABLE (Auto Deposit System with UTR)
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT REFERENCES profiles(telegram_id) ON DELETE CASCADE,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    utr_number VARCHAR(12) NOT NULL UNIQUE, -- Requires exactly 12 digits (App enforced)
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- INDEXES & PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_telegram_id ON predictions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- ==========================================
-- REALTIME ENABLEMENT
-- ==========================================
-- Essential for the "2-Ball Safety Lock" engine to instantly blur TWA screens
ALTER PUBLICATION supabase_realtime ADD TABLE match_state;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
