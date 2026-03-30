-- ═══════════════════════════════════════
--  B2A Human Experiment — Supabase Schema
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════

-- Study 1 Trials (single-turn product grid selection)
CREATE TABLE IF NOT EXISTS study1_trials (
  id BIGSERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  funnel TEXT NOT NULL,
  target_product_id INTEGER NOT NULL,
  chosen_product_id INTEGER NOT NULL,
  chose_target BOOLEAN NOT NULL,
  position_order INTEGER[] NOT NULL,
  reaction_time_ms INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study 2 Trials (multi-step browsing selection)
CREATE TABLE IF NOT EXISTS study2_trials (
  id BIGSERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  funnel TEXT NOT NULL,
  target_product_id INTEGER NOT NULL,
  chosen_product_id INTEGER NOT NULL,
  chose_target BOOLEAN NOT NULL,
  position_order INTEGER[] NOT NULL,
  products_viewed INTEGER DEFAULT 0,
  reviews_read INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  page_visits JSONB DEFAULT '[]'::JSONB,
  time_per_page_ms JSONB DEFAULT '[]'::JSONB,
  reaction_time_ms INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id BIGSERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  study_type TEXT NOT NULL,
  q1_attention_check TEXT,
  attention_check_passed BOOLEAN,
  q2_important_factors TEXT[],
  q3_shopping_frequency TEXT,
  q4_age TEXT,
  q5_gender TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiment assignments (audit trail)
CREATE TABLE IF NOT EXISTS assignments (
  id BIGSERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  study_type TEXT NOT NULL,
  conditions TEXT[] NOT NULL,
  categories TEXT[] NOT NULL,
  funnels TEXT[],
  seed INTEGER,
  assignment_json JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study 2 browsing behavior (detailed clickstream)
CREATE TABLE IF NOT EXISTS study2_browsing (
  id BIGSERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  page_type TEXT NOT NULL,
  product_id INTEGER,
  enter_time BIGINT,
  exit_time BIGINT,
  duration_ms INTEGER,
  action TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_s1_participant ON study1_trials(participant_id);
CREATE INDEX IF NOT EXISTS idx_s1_condition ON study1_trials(condition);
CREATE INDEX IF NOT EXISTS idx_s2_participant ON study2_trials(participant_id);
CREATE INDEX IF NOT EXISTS idx_s2_condition ON study2_trials(condition);
CREATE INDEX IF NOT EXISTS idx_survey_participant ON survey_responses(participant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_participant ON assignments(participant_id);

-- Enable Row Level Security (but allow all inserts via anon key)
ALTER TABLE study1_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE study2_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE study2_browsing ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts and selects (experiment participants don't authenticate)
CREATE POLICY "anon_insert" ON study1_trials FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select" ON study1_trials FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON study2_trials FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select" ON study2_trials FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON survey_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select" ON survey_responses FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON assignments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select" ON assignments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON study2_browsing FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select" ON study2_browsing FOR SELECT TO anon USING (true);
