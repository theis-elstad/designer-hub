-- Leaderboard V2: daily target_date support, designer gallery function, time allocations table

-- ============================================
-- 1a. Update get_leaderboard with target_date parameter and 'daily' time_range
-- ============================================

DROP FUNCTION IF EXISTS public.get_leaderboard(TEXT, INT);
DROP FUNCTION IF EXISTS public.get_leaderboard(TEXT, INT, DATE);

CREATE OR REPLACE FUNCTION public.get_leaderboard(
    time_range TEXT DEFAULT 'all',
    week_offset INT DEFAULT 0,
    target_date DATE DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    total_submissions BIGINT,
    avg_total_score NUMERIC,
    avg_productivity NUMERIC,
    avg_quality NUMERIC,
    cumulative_total_score NUMERIC,
    rank BIGINT,
    static_count BIGINT,
    video_count BIGINT
) AS $$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    CASE time_range
        WHEN 'daily' THEN
            start_date := COALESCE(target_date, CURRENT_DATE);
            end_date := start_date;
        WHEN 'today' THEN
            start_date := CURRENT_DATE;
            end_date := CURRENT_DATE;
        WHEN 'yesterday' THEN
            start_date := CURRENT_DATE - INTERVAL '1 day';
            end_date := CURRENT_DATE - INTERVAL '1 day';
        WHEN 'last_business_day' THEN
            start_date := CASE EXTRACT(DOW FROM CURRENT_DATE)::INT
                WHEN 0 THEN CURRENT_DATE - 2  -- Sunday -> Friday
                WHEN 1 THEN CURRENT_DATE - 3  -- Monday -> Friday
                WHEN 6 THEN CURRENT_DATE - 1  -- Saturday -> Friday
                ELSE CURRENT_DATE - 1         -- Tue-Fri -> previous day
            END;
            end_date := start_date;
        WHEN 'weekly' THEN
            start_date := CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::INT - 5 + 7) % 7) + (week_offset * 7);
            end_date := start_date + 6;
            IF end_date > CURRENT_DATE THEN
                end_date := CURRENT_DATE;
            END IF;
        WHEN 'week' THEN
            start_date := CURRENT_DATE - INTERVAL '7 days';
            end_date := CURRENT_DATE;
        WHEN 'month' THEN
            start_date := CURRENT_DATE - INTERVAL '30 days';
            end_date := CURRENT_DATE;
        ELSE
            start_date := '1970-01-01'::DATE;
            end_date := CURRENT_DATE;
    END CASE;

    RETURN QUERY
    WITH submission_scores AS (
        SELECT
            s.id AS submission_id,
            s.user_id,
            r.productivity,
            r.quality
        FROM public.submissions s
        LEFT JOIN public.ratings r ON r.submission_id = s.id
        WHERE s.submission_date >= start_date AND s.submission_date <= end_date
    ),
    asset_counts AS (
        SELECT
            s.user_id,
            COUNT(DISTINCT CASE WHEN a.asset_type = 'image' THEN a.id END)::BIGINT AS statics,
            COUNT(DISTINCT CASE WHEN a.asset_type = 'video' THEN a.id END)::BIGINT AS videos
        FROM public.submissions s
        LEFT JOIN public.assets a ON a.submission_id = s.id
        WHERE s.submission_date >= start_date AND s.submission_date <= end_date
        GROUP BY s.user_id
    )
    SELECT
        p.id,
        p.full_name,
        COUNT(DISTINCT ss.submission_id)::BIGINT,
        ROUND(COALESCE(AVG(ss.productivity + ss.quality), 0), 2),
        ROUND(COALESCE(AVG(ss.productivity), 0), 2),
        ROUND(COALESCE(AVG(ss.quality), 0), 2),
        ROUND(COALESCE(SUM(ss.productivity + ss.quality), 0), 2),
        DENSE_RANK() OVER (ORDER BY COALESCE(AVG(ss.productivity + ss.quality), 0) DESC)::BIGINT,
        COALESCE(ac.statics, 0)::BIGINT,
        COALESCE(ac.videos, 0)::BIGINT
    FROM public.profiles p
    LEFT JOIN submission_scores ss ON ss.user_id = p.id
    LEFT JOIN asset_counts ac ON ac.user_id = p.id
    WHERE p.role IN ('designer', 'admin')
    GROUP BY p.id, p.full_name, ac.statics, ac.videos
    HAVING COUNT(DISTINCT ss.submission_id) > 0
    ORDER BY avg_total_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1b. Add get_designer_assets function
-- ============================================

CREATE OR REPLACE FUNCTION public.get_designer_assets(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    asset_id UUID,
    storage_path TEXT,
    file_name TEXT,
    asset_type TEXT,
    duration NUMERIC,
    submission_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.storage_path, a.file_name, a.asset_type::TEXT, a.duration, s.submission_date
    FROM public.assets a
    JOIN public.submissions s ON s.id = a.submission_id
    WHERE s.user_id = p_user_id
      AND s.submission_date >= p_start_date
      AND s.submission_date <= p_end_date
      AND s.is_completed = true
    ORDER BY s.submission_date DESC, a.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1c. Add time_allocations table
-- ============================================

CREATE TABLE IF NOT EXISTS public.time_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    allocation_date DATE NOT NULL,
    allocation TEXT NOT NULL CHECK (allocation IN ('0-30', '30-70', '70-100')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_allocation UNIQUE (user_id, allocation_date)
);

CREATE INDEX IF NOT EXISTS idx_time_allocations_user_date ON public.time_allocations(user_id, allocation_date);

ALTER TABLE public.time_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_allocations_select_own" ON public.time_allocations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "time_allocations_upsert_own" ON public.time_allocations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_allocations_update_own" ON public.time_allocations
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "time_allocations_select_admin" ON public.time_allocations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
