-- ==============================================================================
-- 小規模チーム向けToDo管理アプリ (Supabase セットアップ用 SQL スクリプト)
-- ==============================================================================

-- 1. tasks テーブルの作成
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    due_date TIMESTAMPTZ,
    assignee TEXT NOT NULL DEFAULT '全員',
    scope TEXT NOT NULL CHECK (scope IN ('all', 'personal')) DEFAULT 'all',
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT '業務',
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. 検索・ソート高速化のためのインデックス
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks (assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_scope ON public.tasks (scope);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON public.tasks (is_completed);

-- 3. 行単位セキュリティ (Row Level Security: RLS) の有効化
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS ポリシーの設定
DROP POLICY IF EXISTS "Allow public read access" ON public.tasks;
DROP POLICY IF EXISTS "Allow public insert access" ON public.tasks;
DROP POLICY IF EXISTS "Allow public update access" ON public.tasks;
DROP POLICY IF EXISTS "Allow public delete access" ON public.tasks;

CREATE POLICY "Allow public read access" ON public.tasks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert access" ON public.tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.tasks FOR DELETE TO anon, authenticated USING (true);

-- ==============================================================================
-- 5. アプリ設定同期テーブル (app_settings) の作成
-- メンバー一覧・パスワード・カテゴリーを複数端末・全携帯でリアルタイム同期
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public update app_settings" ON public.app_settings;

CREATE POLICY "Allow public read app_settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert app_settings" ON public.app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update app_settings" ON public.app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. サンプルデータの挿入（初期動作確認用）
INSERT INTO public.tasks (title, description, due_date, assignee, scope, priority, category, is_completed)
VALUES 
('チーム定例ミーティングの資料準備', '進捗報告用のスライドを3枚程度でまとめる', now() + interval '2 hours', '全員', 'all', 'high', '会議', false),
('今週のタスク洗い出し', '個人タスクと全員共有タスクの整理', now() + interval '1 day', 'メンバーA', 'personal', 'medium', '業務', false),
('備品の在庫確認', 'ホワイトボードマーカーと付箋の残数確認', now() + interval '3 days', 'メンバーB', 'all', 'low', '雑務', false),
('前週の議事録共有', 'Slackおよびメールで議事録を送付済', now() - interval '1 day', 'メンバーC', 'all', 'medium', '業務', true)
ON CONFLICT DO NOTHING;
