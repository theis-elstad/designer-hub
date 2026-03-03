-- Update Leaderboard Function to support new time ranges and cumulative scores
-- Run this in your Supabase SQL Editor to update the leaderboard function
-- Adds: last_business_day, weekly (Thu-to-Thu), cumulative_total_score, week_offset param

-- Drop all existing versions of the function to allow return type change
DROP FUNCTION IF EXISTS public.get_leaderboard(TEXT);
DROP FUNCTION IF EXISTS public.get_leaderboard(TEXT, INT);

CREATE OR REPLACE FUNCTION public.get_leaderboard(time_range TEXT DEFAULT 'all', week_offset INT DEFAULT 0)
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
    -- Calculate date range based on time_range parameter
    CASE time_range
        WHEN 'today' THEN
            start_date := CURRENT_DATE;
            end_date := CURRENT_DATE;
        WHEN 'yesterday' THEN
            start_date := CURRENT_DATE - INTERVAL '1 day';
            end_date := CURRENT_DATE - INTERVAL '1 day';
        WHEN 'last_business_day' THEN
            -- dow: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
            start_date := CASE EXTRACT(DOW FROM CURRENT_DATE)::INT
                WHEN 0 THEN CURRENT_DATE - 2  -- Sunday -> Friday
                WHEN 1 THEN CURRENT_DATE - 3  -- Monday -> Friday
                WHEN 6 THEN CURRENT_DATE - 1  -- Saturday -> Friday
                ELSE CURRENT_DATE - 1         -- Tue-Fri -> previous day
            END;
            end_date := start_date;
        WHEN 'weekly' THEN
            -- Friday-to-Thursday cycle
            -- Find the most recent Friday, then apply week_offset
            start_date := CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::INT - 5 + 7) % 7) + (week_offset * 7);
            end_date := start_date + 6;
            -- Cap end_date to today if in the future
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
        -- Get one score per submission (avoid duplication from assets join)
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
        -- Get asset counts per user for the date range
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

-- Verify the function works
SELECT 'Updated leaderboard function with new time ranges:' as info;
SELECT * FROM public.get_leaderboard('weekly'::TEXT, 0) LIMIT 5;
