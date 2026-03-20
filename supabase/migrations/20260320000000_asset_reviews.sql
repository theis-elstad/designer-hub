-- Peer review ratings on individual assets (for training auto-rating model)
-- Separate from the admin judge ratings which are per-submission

create table if not exists asset_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  stars smallint not null check (stars >= 1 and stars <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One review per user per asset
  unique (asset_id, reviewer_id)
);

-- Index for fast lookups by asset
create index if not exists idx_asset_reviews_asset_id on asset_reviews(asset_id);

-- Index for fetching a user's reviews
create index if not exists idx_asset_reviews_reviewer_id on asset_reviews(reviewer_id);

-- RLS policies
alter table asset_reviews enable row level security;

-- Anyone authenticated can read reviews
create policy "Authenticated users can read asset reviews"
  on asset_reviews for select
  to authenticated
  using (true);

-- Users can insert their own reviews
create policy "Users can insert own asset reviews"
  on asset_reviews for insert
  to authenticated
  with check (auth.uid() = reviewer_id);

-- Users can update their own reviews
create policy "Users can update own asset reviews"
  on asset_reviews for update
  to authenticated
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id);
