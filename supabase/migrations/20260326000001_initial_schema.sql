-- =============================================================================
-- Migration: 20260326000001_initial_schema
-- Project:   Coupon Wallet MVP
-- Purpose:   Create all business tables, indexes, helper functions, triggers,
--            and Row Level Security policies for the Coupon Wallet application.
--
-- Conventions used throughout:
--   • Every table has created_at (and updated_at where rows are mutable).
--   • All business tables have RLS enabled; default is DENY ALL.
--   • Policies are written in the narrowest form that still serves the MVP,
--     but with explicit comments on where to tighten later.
--   • Two lightweight helper functions (is_wallet_member / is_wallet_owner)
--     centralise the membership check that most policies need, so that
--     adding richer role logic later is a single-file change.
--   • processing_jobs and audit_events are fully locked down from
--     authenticated mobile clients – service_role only.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------

-- pgcrypto is pre-installed on Supabase; included for explicitness.
-- gen_random_uuid() is available natively on pg ≥ 13 without it.
create extension if not exists pgcrypto schema extensions;


-- ---------------------------------------------------------------------------
-- 1. HELPER: set_updated_at trigger function
--    Reused by every table that has an updated_at column.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. PROFILES
--    One row per auth.users entry.
--    notifications_enabled lives here so the mobile app can read it in a
--    single query. If per-wallet notification settings are needed later,
--    add a separate wallet_notification_settings table rather than moving
--    this column.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                   uuid        primary key references auth.users(id) on delete cascade,
  display_name         text,
  default_currency     text        not null default 'ILS',
  language             text        not null default 'he',
  notifications_enabled boolean    not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.profiles is
  'One profile row per authenticated user. Extended user-facing preferences live here.';
comment on column public.profiles.notifications_enabled is
  'Global push-notification opt-in. Per-wallet overrides can be added with a wallet_notification_settings table later.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;


-- ---------------------------------------------------------------------------
-- 3. WALLETS
--    type is constrained to 'personal' | 'family' | 'shared'.
--
--    All three values are intentionally kept even for MVP because:
--      • 'family' and 'shared' share the same RLS logic as 'personal'
--        (is_wallet_member). Adding them later would require no policy change.
--      • The mobile app and reminder pipeline already reference wallet.type
--        but branch only on 'personal' for now; other values are inert.
--      • Removing them later is a breaking migration; keeping them is additive.
--    owner_user_id is the primary authority; fine-grained delegation
--    is handled through wallet_members.role.
-- ---------------------------------------------------------------------------

create table public.wallets (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  type           text        not null default 'personal'
                             check (type in ('personal', 'family', 'shared')),
  owner_user_id  uuid        not null references auth.users(id) on delete cascade,
  default_currency text      not null default 'ILS',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.wallets is
  'A wallet groups vouchers under a single ownership context. Personal wallets are the MVP focus.';
comment on column public.wallets.type is
  'personal | family | shared. Shared is reserved for future B2B/group scenarios.';

create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

alter table public.wallets enable row level security;


-- ---------------------------------------------------------------------------
-- 4. WALLET_MEMBERS
--    Maps users → wallets with a role.
--
--    role: 'owner' | 'admin' | 'member' | 'viewer'
--      • 'owner' is required now (auto-provisioned for every new wallet).
--      • 'member' is required now (shared/family wallet members).
--      • 'admin' and 'viewer' are pre-declared so adding them later is a
--        data-only change (no schema migration, no policy rewrite). They are
--        currently treated identically to 'member' in all policies.
--
--    status: 'active' | 'invited' | 'revoked'
--      Required even for MVP because the handle_new_user() trigger sets
--      status='active', wallet_invites resolution sets status='invited' then
--      'active', and revocation preserves the audit trail. Dropping status
--      later would be a breaking change.
--
--    owner is the only role that can mutate membership.
-- ---------------------------------------------------------------------------

create table public.wallet_members (
  id         uuid        primary key default gen_random_uuid(),
  wallet_id  uuid        not null references public.wallets(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'member'
                         check (role in ('owner', 'admin', 'member', 'viewer')),
  status     text        not null default 'active'
                         check (status in ('active', 'invited', 'revoked')),
  -- Future: add a jsonb permissions column here for granular overrides.
  created_at timestamptz not null default now(),
  unique (wallet_id, user_id)
);

comment on table public.wallet_members is
  'Associates users with wallets and assigns a role. Owners are always synced as active members.';
comment on column public.wallet_members.role is
  'owner | admin | member | viewer. '
  'admin and viewer are pre-declared for future policy tightening; '
  'they currently share member permissions in all RLS policies. '
  'No migration is needed to start using them — just set the role value.';

create index idx_wallet_members_user_id  on public.wallet_members(user_id);
create index idx_wallet_members_wallet_id on public.wallet_members(wallet_id);

alter table public.wallet_members enable row level security;


-- ---------------------------------------------------------------------------
-- 5. HELPER FUNCTIONS: is_wallet_member / is_wallet_owner
--    Used in every policy below. Marking them STABLE lets Postgres cache the
--    result within a single statement, which matters for policies that fire
--    on bulk queries.
--    security definer + explicit search_path prevents search-path injection.
-- ---------------------------------------------------------------------------

create or replace function public.is_wallet_member(wallet_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wallet_members wm
    where wm.wallet_id = wallet_uuid
      and wm.user_id   = auth.uid()
      and wm.status    = 'active'
  );
$$;

comment on function public.is_wallet_member(uuid) is
  'Returns true when the calling user is an active member of wallet_uuid. Used in RLS policies.';

create or replace function public.is_wallet_owner(wallet_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wallet_members wm
    where wm.wallet_id = wallet_uuid
      and wm.user_id   = auth.uid()
      and wm.role      = 'owner'
      and wm.status    = 'active'
  );
$$;

comment on function public.is_wallet_owner(uuid) is
  'Returns true when the calling user is the active owner of wallet_uuid. Used in RLS policies.';


-- ---------------------------------------------------------------------------
-- 6. VOUCHERS
-- ---------------------------------------------------------------------------

create table public.vouchers (
  id                  uuid           primary key default gen_random_uuid(),
  wallet_id           uuid           not null references public.wallets(id) on delete cascade,
  created_by_user_id  uuid           not null references auth.users(id) on delete restrict,
  title               text           not null,
  merchant_name       text,
  category            text,
  face_value          numeric(12, 2) check (face_value is null or face_value >= 0),
  paid_value          numeric(12, 2) check (paid_value is null or paid_value >= 0),
  currency            text           not null,
  purchase_date       date,
  expiry_date         date           not null,
  code                text,
  notes               text,
  status              text           not null default 'active'
                                     check (status in ('active', 'redeemed', 'expired', 'archived')),
  source_type         text           not null default 'manual'
                                     check (source_type in ('manual', 'upload', 'email_import', 'ocr_import', 'shared', 'barcode_scan', 'api')),
  -- source_type enum is intentionally wider than MVP (manual only) because:
  -- • The domain.ts VoucherSource type already mirrors these values.
  -- • The mobile app's repository layer sets source_type='manual' today;
  --   other values are inserted by future server-side ingestion pipelines.
  -- • Adding new source values later without a schema migration requires they
  --   already exist in the check constraint.
  -- Active MVP sources: 'manual', 'upload'.
  -- metadata is for arbitrary extension data (e.g. barcode symbology, email
  -- message-id) without requiring schema migrations for every new source type.
  metadata            jsonb          not null default '{}',
  redeemed_at         timestamptz,
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now(),
  -- Sanity: redeemed_at must be null unless status = 'redeemed'
  constraint vouchers_redeemed_at_status_check
    check (redeemed_at is null or status = 'redeemed')
);

comment on table public.vouchers is
  'Core business entity. One voucher per coupon/gift-card/discount code.';
comment on column public.vouchers.metadata is
  'Extensible JSON for source-specific data: barcode symbology, email headers, OCR confidence, etc.';
comment on column public.vouchers.status is
  'active | redeemed | expired | archived. '
  'All four values are kept for MVP because: '
  'active is the normal operational state; '
  'redeemed is set when the user marks a voucher used; '
  'expired is set by the server-side cron (deferred but modeled now to avoid a later migration); '
  'archived is a soft-delete that preserves history. '
  'Removing any value later would be a breaking migration.';

create trigger vouchers_set_updated_at
  before update on public.vouchers
  for each row execute function public.set_updated_at();

-- Indexes for common mobile access patterns
create index idx_vouchers_wallet_status       on public.vouchers(wallet_id, status);
create index idx_vouchers_wallet_expiry        on public.vouchers(wallet_id, expiry_date);
create index idx_vouchers_created_by           on public.vouchers(created_by_user_id);
create index idx_vouchers_source_type          on public.vouchers(source_type);

alter table public.vouchers enable row level security;


-- ---------------------------------------------------------------------------
-- 7. VOUCHER_ATTACHMENTS
--    Attachments are modeled separately so storage lifecycle, signed-URL
--    generation, and future processing jobs can evolve without touching
--    voucher rows.
--    kind: original | preview | ocr_source | ocr_output
--    storage_bucket + storage_path are the Supabase Storage coordinates;
--    the mobile app must NEVER construct public URLs – always use signed URLs.
-- ---------------------------------------------------------------------------

create table public.voucher_attachments (
  id                   uuid        primary key default gen_random_uuid(),
  voucher_id           uuid        not null references public.vouchers(id) on delete cascade,
  storage_bucket       text        not null,
  storage_path         text        not null,
  file_name            text,
  mime_type            text        not null,
  file_size_bytes      bigint,
  uploaded_by_user_id  uuid        not null references auth.users(id) on delete restrict,
  kind                 text        not null default 'original'
                                   check (kind in ('original', 'preview', 'ocr_source', 'ocr_output')),
  created_at           timestamptz not null default now(),
  -- Prevent duplicate storage paths within a single voucher
  unique (voucher_id, storage_path)
);

comment on table public.voucher_attachments is
  'Metadata record for files stored in Supabase Storage. Never expose storage_path directly; always generate signed URLs server-side.';
comment on column public.voucher_attachments.kind is
  'original = user-uploaded file. preview = generated thumbnail. ocr_source/ocr_output = OCR pipeline artefacts.';

create index idx_voucher_attachments_voucher_id on public.voucher_attachments(voucher_id);

alter table public.voucher_attachments enable row level security;


-- ---------------------------------------------------------------------------
-- 8. VOUCHER_REMINDERS
--    Tracks which reminder offsets should fire for a voucher and whether they
--    have been sent. Server-side job (cron / Edge Function) owns scheduling;
--    the mobile app can read and configure these rows but must not mark them
--    sent directly.
-- ---------------------------------------------------------------------------

create table public.voucher_reminders (
  id          uuid        primary key default gen_random_uuid(),
  voucher_id  uuid        not null references public.vouchers(id) on delete cascade,
  offset_days integer     not null check (offset_days >= 0),
  channel     text        not null default 'push'
                          check (channel in ('push', 'email')),
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (voucher_id, offset_days, channel)
);

comment on table public.voucher_reminders is
  'One row per (voucher, offset, channel) reminder slot. The server owns sent_at; mobile should not update it directly.';

create index idx_voucher_reminders_voucher_id on public.voucher_reminders(voucher_id);
-- Allows the reminder job to query: WHERE sent_at IS NULL AND expiry_date <= now() + offset_days
create index idx_voucher_reminders_sent_at    on public.voucher_reminders(sent_at) where sent_at is null;

alter table public.voucher_reminders enable row level security;


-- ---------------------------------------------------------------------------
-- 9. PUSH_TOKENS
--    Stores Expo push tokens for server-side reminder delivery.
--    device_platform: 'ios' | 'android' | 'web' (open text; no check
--    constraint so new platforms don't require a migration).
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  expo_push_token  text        not null,
  device_platform  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

comment on table public.push_tokens is
  'Expo push tokens per user/device. Used exclusively by the server-side reminder pipeline.';

create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

create index idx_push_tokens_user_id on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;


-- ---------------------------------------------------------------------------
-- 10. WALLET_INVITES
--     Invite-by-email flow for family/shared wallets.
--     On acceptance, the server resolves the email → auth.users lookup and
--     creates the wallet_members row; this table just tracks invite state.
-- ---------------------------------------------------------------------------

create table public.wallet_invites (
  id                  uuid        primary key default gen_random_uuid(),
  wallet_id           uuid        not null references public.wallets(id) on delete cascade,
  email               text        not null,
  invited_by_user_id  uuid        not null references auth.users(id) on delete restrict,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'accepted', 'revoked')),
  created_at          timestamptz not null default now(),
  -- One pending invite per (wallet, email) at a time; re-invites must revoke first.
  unique (wallet_id, email)
);

comment on table public.wallet_invites is
  'Invite records for adding new members to family/shared wallets. Status transitions are managed server-side.';

alter table public.wallet_invites enable row level security;


-- ---------------------------------------------------------------------------
-- 11. PROCESSING_JOBS
--     Future-facing async job queue for OCR, email parsing, barcode
--     extraction, thumbnail generation.
--     Mobile clients have NO access (no RLS SELECT policy for anon/authed).
--     Only service_role (Edge Functions / cron) reads/writes this table.
-- ---------------------------------------------------------------------------

create table public.processing_jobs (
  id           uuid        primary key default gen_random_uuid(),
  entity_type  text        not null check (entity_type in ('voucher', 'attachment', 'wallet')),
  entity_id    uuid        not null,
  job_type     text        not null check (job_type in ('ocr', 'email_parse', 'thumbnail', 'barcode_extract')),
  status       text        not null default 'pending'
                           check (status in ('pending', 'running', 'completed', 'failed')),
  payload      jsonb       not null default '{}',
  result       jsonb       not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.processing_jobs is
  'Async processing queue for OCR, thumbnails, barcode extraction, email parsing. Mobile clients have no RLS access.';

create trigger processing_jobs_set_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_updated_at();

create index idx_processing_jobs_entity   on public.processing_jobs(entity_type, entity_id);
create index idx_processing_jobs_status   on public.processing_jobs(status, job_type)
  where status in ('pending', 'running');

alter table public.processing_jobs enable row level security;
-- No policies added: default-deny blocks all authenticated clients.
-- service_role bypasses RLS and is the only caller.


-- ---------------------------------------------------------------------------
-- 12. AUDIT_EVENTS
--     Append-only event log. Mobile clients have NO access.
--     wallet_id may be null for system-level or auth events.
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id             uuid        primary key default gen_random_uuid(),
  actor_user_id  uuid        references auth.users(id) on delete set null,
  wallet_id      uuid        references public.wallets(id) on delete set null,
  entity_type    text        not null,
  entity_id      uuid,
  action         text        not null,
  payload        jsonb       not null default '{}',
  created_at     timestamptz not null default now()
  -- No updated_at: this table is append-only.
);

comment on table public.audit_events is
  'Append-only audit log. Only service_role may write or read. Mobile clients have zero access.';

-- Partial indexes to keep audit queries fast without indexing every column.
create index idx_audit_events_wallet_id    on public.audit_events(wallet_id) where wallet_id is not null;
create index idx_audit_events_actor        on public.audit_events(actor_user_id) where actor_user_id is not null;
create index idx_audit_events_entity       on public.audit_events(entity_type, entity_id);

alter table public.audit_events enable row level security;
-- No policies added: service_role only.


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------

-- SELECT: a user may only read their own profile.
create policy "profiles: own row select"
  on public.profiles
  for select
  using ( id = auth.uid() );

-- INSERT: only the authenticated user may insert their own profile row.
create policy "profiles: own row insert"
  on public.profiles
  for insert
  with check ( id = auth.uid() );

-- UPDATE: only the authenticated user may update their own profile row.
create policy "profiles: own row update"
  on public.profiles
  for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() );


-- ---------------------------------------------------------------------------
-- WALLETS
-- ---------------------------------------------------------------------------

-- SELECT: a user can read wallets they are an active member of.
create policy "wallets: member select"
  on public.wallets
  for select
  using ( public.is_wallet_member(id) );

-- INSERT: the inserting user must be the declared owner.
create policy "wallets: owner insert"
  on public.wallets
  for insert
  with check ( owner_user_id = auth.uid() );

-- UPDATE: only the wallet owner may update wallet metadata.
create policy "wallets: owner update"
  on public.wallets
  for update
  using  ( public.is_wallet_owner(id) )
  with check ( public.is_wallet_owner(id) );

-- DELETE: only the wallet owner may delete the wallet.
create policy "wallets: owner delete"
  on public.wallets
  for delete
  using ( public.is_wallet_owner(id) );


-- ---------------------------------------------------------------------------
-- WALLET_MEMBERS
-- ---------------------------------------------------------------------------

-- SELECT: any active member of the wallet can see who else is in it.
create policy "wallet_members: member select"
  on public.wallet_members
  for select
  using ( public.is_wallet_member(wallet_id) );

-- INSERT: only the wallet owner may add members.
create policy "wallet_members: owner insert"
  on public.wallet_members
  for insert
  with check ( public.is_wallet_owner(wallet_id) );

-- UPDATE: only the wallet owner may change roles or status.
-- TODO: when richer self-serve role changes are needed, narrow this further.
create policy "wallet_members: owner update"
  on public.wallet_members
  for update
  using  ( public.is_wallet_owner(wallet_id) )
  with check ( public.is_wallet_owner(wallet_id) );

-- DELETE: only the wallet owner may remove members.
create policy "wallet_members: owner delete"
  on public.wallet_members
  for delete
  using ( public.is_wallet_owner(wallet_id) );


-- ---------------------------------------------------------------------------
-- VOUCHERS
-- ---------------------------------------------------------------------------

-- SELECT: any active wallet member can read vouchers in that wallet.
create policy "vouchers: member select"
  on public.vouchers
  for select
  using ( public.is_wallet_member(wallet_id) );

-- INSERT: any active wallet member may create vouchers in the wallet.
create policy "vouchers: member insert"
  on public.vouchers
  for insert
  with check ( public.is_wallet_member(wallet_id) );

-- UPDATE: any active wallet member may update vouchers (MVP).
-- TODO: tighten to role = 'owner' | 'admin' | 'member' once role-based
--       write restrictions are needed (e.g. viewers should not edit).
create policy "vouchers: member update"
  on public.vouchers
  for update
  using  ( public.is_wallet_member(wallet_id) )
  with check ( public.is_wallet_member(wallet_id) );

-- DELETE: any active wallet member may delete vouchers (MVP).
-- TODO: same as update – tighten when viewer role should be read-only.
create policy "vouchers: member delete"
  on public.vouchers
  for delete
  using ( public.is_wallet_member(wallet_id) );


-- ---------------------------------------------------------------------------
-- VOUCHER_ATTACHMENTS
-- ---------------------------------------------------------------------------

-- Authorization flows through parent voucher → wallet membership.

create policy "voucher_attachments: member select"
  on public.voucher_attachments
  for select
  using (
    exists (
      select 1 from public.vouchers v
      where v.id = voucher_id
        and public.is_wallet_member(v.wallet_id)
    )
  );

create policy "voucher_attachments: member insert"
  on public.voucher_attachments
  for insert
  with check (
    exists (
      select 1 from public.vouchers v
      where v.id = voucher_id
        and public.is_wallet_member(v.wallet_id)
    )
  );

create policy "voucher_attachments: member delete"
  on public.voucher_attachments
  for delete
  using (
    exists (
      select 1 from public.vouchers v
      where v.id = voucher_id
        and public.is_wallet_member(v.wallet_id)
    )
  );


-- ---------------------------------------------------------------------------
-- VOUCHER_REMINDERS
-- ---------------------------------------------------------------------------

create policy "voucher_reminders: member select"
  on public.voucher_reminders
  for select
  using (
    exists (
      select 1 from public.vouchers v
      where v.id = voucher_id
        and public.is_wallet_member(v.wallet_id)
    )
  );

create policy "voucher_reminders: member insert"
  on public.voucher_reminders
  for insert
  with check (
    exists (
      select 1 from public.vouchers v
      where v.id = voucher_id
        and public.is_wallet_member(v.wallet_id)
    )
  );

-- UPDATE is intentionally omitted for authenticated mobile clients.
-- sent_at is owned exclusively by the server-side reminder pipeline
-- (the process-reminders Edge Function running as service_role). Allowing
-- mobile clients to update this row would let them suppress or falsify
-- delivery state. service_role bypasses RLS so no policy is needed for
-- the Edge Function.
create policy "voucher_reminders: member delete"
  on public.voucher_reminders
  for delete
  using (
    exists (
      select 1 from public.vouchers v
      where v.id = voucher_id
        and public.is_wallet_member(v.wallet_id)
    )
  );


-- ---------------------------------------------------------------------------
-- PUSH_TOKENS
-- ---------------------------------------------------------------------------

create policy "push_tokens: own row select"
  on public.push_tokens
  for select
  using ( user_id = auth.uid() );

create policy "push_tokens: own row insert"
  on public.push_tokens
  for insert
  with check ( user_id = auth.uid() );

create policy "push_tokens: own row update"
  on public.push_tokens
  for update
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

create policy "push_tokens: own row delete"
  on public.push_tokens
  for delete
  using ( user_id = auth.uid() );


-- ---------------------------------------------------------------------------
-- WALLET_INVITES
-- ---------------------------------------------------------------------------

-- SELECT: any active wallet member can read invites for their wallet.
create policy "wallet_invites: member select"
  on public.wallet_invites
  for select
  using ( public.is_wallet_member(wallet_id) );

-- INSERT / UPDATE / DELETE: wallet owner only.
create policy "wallet_invites: owner insert"
  on public.wallet_invites
  for insert
  with check ( public.is_wallet_owner(wallet_id) );

create policy "wallet_invites: owner update"
  on public.wallet_invites
  for update
  using  ( public.is_wallet_owner(wallet_id) )
  with check ( public.is_wallet_owner(wallet_id) );

create policy "wallet_invites: owner delete"
  on public.wallet_invites
  for delete
  using ( public.is_wallet_owner(wallet_id) );


-- =============================================================================
-- AUTO-PROVISIONING ON SIGNUP
-- =============================================================================
--
-- Decision: use a trigger on auth.users via the on auth.user event pathway.
--
-- Supabase exposes auth.users to Postgres, and a trigger on that table is
-- the standard approach for post-signup provisioning. The risk profile is:
--
--   SAFE   – auth.users inserts happen inside a Supabase-controlled
--            transaction; our trigger runs in the same transaction, so
--            failures roll back cleanly.
--   SAFE   – We mark the function "security definer" with a pinned
--            search_path to prevent injection through search-path hijacking.
--   SAFE   – We wrap the body in BEGIN … EXCEPTION so a provisioning
--            failure (e.g. duplicate key) does not block the signup itself —
--            the user still gets their auth row and can be re-provisioned.
--   MILD   – We fetch the user's email from new.email, which IS populated
--            by Supabase's auth.users at insert time.
--
-- The trigger creates:
--   1. A profiles row.
--   2. A personal wallet.
--   3. An owner wallet_members row.
--
-- If any step fails it is silently swallowed. The mobile app handles the
-- case of a missing profile/wallet gracefully through repository fallbacks.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  -- 1. Create profile
  insert into public.profiles (id, display_name, default_currency, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', null),
    'ILS',
    'he'
  )
  on conflict (id) do nothing;

  -- 2. Create personal wallet
  insert into public.wallets (name, type, owner_user_id, default_currency)
  values ('My Wallet', 'personal', new.id, 'ILS')
  returning id into v_wallet_id;

  -- 3. Add owner member row
  insert into public.wallet_members (wallet_id, user_id, role, status)
  values (v_wallet_id, new.id, 'owner', 'active')
  on conflict (wallet_id, user_id) do nothing;

  return new;
exception
  when others then
    -- Log the error to Postgres logs without blocking signup.
    raise warning 'handle_new_user: provisioning failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

comment on function public.handle_new_user() is
  'Triggered after auth.users insert. Creates a profile row, a personal wallet, and the owner wallet_members row for each new signup. Failures are swallowed to avoid blocking auth.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- STORAGE GUIDANCE (informational – not executable here)
-- =============================================================================
--
-- Create a private storage bucket named 'vouchers' in the Supabase dashboard
-- (or via the Storage API). Do NOT enable public access.
--
-- Recommended storage.objects RLS policies (run in a separate migration or
-- via the dashboard after creating the bucket):
--
--   -- Allow wallet members to upload attachments
--   create policy "vouchers bucket: member upload"
--     on storage.objects
--     for insert
--     to authenticated
--     with check (
--       bucket_id = 'vouchers'
--       -- storage_path convention: {wallet_id}/{voucher_id}/{filename}
--       -- Extract wallet_id from the object name prefix and verify membership.
--       and public.is_wallet_member(
--         (string_to_array(name, '/'))[1]::uuid
--       )
--     );
--
--   -- Allow wallet members to read / generate signed URLs
--   create policy "vouchers bucket: member read"
--     on storage.objects
--     for select
--     to authenticated
--     using (
--       bucket_id = 'vouchers'
--       and public.is_wallet_member(
--         (string_to_array(name, '/'))[1]::uuid
--       )
--     );
--
--   -- Allow wallet members to delete their uploads
--   create policy "vouchers bucket: member delete"
--     on storage.objects
--     for delete
--     to authenticated
--     using (
--       bucket_id = 'vouchers'
--       and public.is_wallet_member(
--         (string_to_array(name, '/'))[1]::uuid
--       )
--     );
--
-- IMPORTANT: Always use createSignedUrl() on the server side (Edge Function
-- or RPC) to vend time-limited download URLs. Never construct or cache public
-- object URLs in the mobile client.
-- =============================================================================
