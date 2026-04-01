-- Prompt management with versioning for Creative Strategist
CREATE TABLE public.cs_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slug, version)
);

ALTER TABLE public.cs_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_prompts_select" ON public.cs_prompts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "cs_prompts_insert" ON public.cs_prompts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cs_prompts_update" ON public.cs_prompts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Default prompts seeded via application
