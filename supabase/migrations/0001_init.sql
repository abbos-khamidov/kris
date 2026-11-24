-- KRIS SKIN: initial schema. Every user table has owner_id and RLS (owner_id = auth.uid()).
-- Run in the Supabase SQL editor or via `supabase db push`.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = owner_id)
);

-- Auto-create a profile for every new auth user (registration itself is disabled in Supabase settings).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, owner_id, email, display_name)
  values (new.id, new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- patients
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160),
  birth_date date,
  phone text not null default '',
  whatsapp text not null default '',
  telegram text not null default '',
  email text not null default '',
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patients_owner_idx on public.patients (owner_id, archived_at);

create table public.patient_anamnesis (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  allergies_state text not null default 'unspecified',
  allergies text not null default '',
  chronic_state text not null default 'unspecified',
  chronic text not null default '',
  thyroid_state text not null default 'unspecified',
  thyroid text not null default '',
  hormone_tests text not null default 'unspecified',
  hormone_tests_note text not null default '',
  cycle text not null default 'unspecified',
  pregnancy text not null default 'unspecified',
  lactation text not null default 'unspecified',
  sebum numeric(2, 1) check (sebum between 1 and 5),
  skin_state text not null default '',
  complaints text not null default '',
  comments text not null default '',
  custom_fields jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id)
);

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  consulted_at date not null default current_date,
  complaints text not null default '',
  skin_state text not null default '',
  notes text not null default '',
  anamnesis_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultations_patient_idx on public.consultations (patient_id, consulted_at desc);

-- ---------------------------------------------------------------- media
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('brand', 'product', 'specialist', 'patient', 'illustration')),
  role text,
  name text not null default '',
  path text not null,
  content_type text not null default 'image/jpeg',
  width int,
  height int,
  size_bytes bigint,
  version int not null default 1,
  meta jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_assets_owner_idx on public.media_assets (owner_id, category, role);

create table public.patient_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  consultation_id uuid references public.consultations (id) on delete set null,
  asset_id uuid not null references public.media_assets (id),
  taken_at date not null default current_date,
  stage text not null default 'before' check (stage in ('before', 'after', 'progress')),
  angle text not null default 'front',
  comment text not null default '',
  allow_in_pdf boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patient_photos_patient_idx on public.patient_photos (patient_id, taken_at desc);

-- ---------------------------------------------------------------- catalog / library
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete set null,
  name text not null,
  brand text not null default '',
  description text not null default '',
  variants jsonb not null default '[]',        -- [{id, volume, price:{kind,amount,max,text}}]
  url text not null default '',
  restrictions text not null default '',
  alternatives jsonb not null default '[]',    -- [{name, brand}]
  in_stock boolean not null default true,
  image_asset_id uuid references public.media_assets (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_owner_idx on public.products (owner_id, archived_at);

create table public.recommendation_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,                           -- skin, morning, evening, barrier, actives, nutrition, vitamins, tests, procedures, conclusion, face_scheme
  title text not null,
  body jsonb not null default '[]',             -- blocks (or structured payload for face_scheme / procedures)
  favorite boolean not null default false,
  use_count int not null default 0,
  source text not null default 'manual' check (source in ('manual', 'card', 'import')),
  review_status text not null default 'approved' check (review_status in ('pending', 'approved')),
  content_key text not null default '',          -- normalised text hash used to avoid duplicates
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_owner_idx on public.recommendation_templates (owner_id, kind, archived_at);
create index templates_key_idx on public.recommendation_templates (owner_id, content_key);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  sessions text not null default '',
  frequency text not null default '',
  dosage text not null default '',
  volume text not null default '',
  price jsonb not null default '{"kind":"fixed","amount":null,"max":null,"text":""}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- cards
create table public.patient_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  consultation_id uuid references public.consultations (id) on delete set null,
  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved')),
  data jsonb not null default '{}',
  version int not null default 0,               -- number of approved versions so far
  based_on_card_id uuid references public.patient_cards (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_owner_idx on public.patient_cards (owner_id, status, updated_at desc);
create index cards_patient_idx on public.patient_cards (patient_id);

create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.patient_cards (id) on delete cascade,
  version int not null,
  path text not null,
  file_name text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.patient_cards (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,                      -- immutable: patient, anamnesis, card data, prices, settings, image versions
  document_id uuid references public.generated_documents (id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, version)
);

-- Approved snapshots can never be changed or deleted (only removed together with the card).
create or replace function public.forbid_snapshot_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.snapshot is distinct from old.snapshot or new.version <> old.version) then
    raise exception 'Утверждённая версия карты неизменяема';
  end if;
  return coalesce(new, old);
end $$;
create trigger card_versions_immutable before update on public.card_versions
  for each row execute function public.forbid_snapshot_change();

-- ---------------------------------------------------------------- misc
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}',             -- never contains medical content
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_owner_idx on public.activity_logs (owner_id, created_at desc);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  due_at date not null,
  note text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

-- ---------------------------------------------------------------- PDF import (reference cards)
create table public.pdf_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text not null,
  source_hash text not null,
  pages int not null default 0,
  status text not null default 'parsed' check (status in ('parsed', 'in_review', 'reviewed', 'discarded')),
  patient_data jsonb not null default '{}',     -- personal data stays here, never in the shared knowledge base
  draft jsonb not null default '{}',            -- structured draft of the ten sections
  imported_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_hash)
);

create table public.knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  import_id uuid references public.pdf_imports (id) on delete cascade,
  kind text not null check (kind in ('text_block', 'product', 'procedure')),
  section text not null default '',
  payload jsonb not null,
  content_key text not null,
  occurrences int not null default 1,
  review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'rejected', 'merged')),
  merged_into uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidates_owner_idx on public.knowledge_candidates (owner_id, review_status, kind);

-- ---------------------------------------------------------------- triggers + RLS
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','patients','patient_anamnesis','consultations','media_assets','patient_photos',
    'product_categories','products','recommendation_templates','procedures','patient_cards',
    'generated_documents','card_versions','activity_logs','follow_ups','settings','pdf_imports',
    'knowledge_candidates'
  ] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_owner_all on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
end $$;

-- Foreign keys must not allow pointing at another user's rows.
create or replace function public.assert_same_owner() returns trigger
language plpgsql as $$
declare ref_owner uuid;
begin
  if tg_argv[0] is not null and (to_jsonb(new) ->> tg_argv[0]) is not null then
    execute format('select owner_id from public.%I where id = $1', tg_argv[1])
      into ref_owner using ((to_jsonb(new) ->> tg_argv[0])::uuid);
    if ref_owner is distinct from new.owner_id then
      raise exception 'Ссылка на чужую запись запрещена';
    end if;
  end if;
  return new;
end $$;
create trigger anamnesis_owner_check before insert or update on public.patient_anamnesis
  for each row execute function public.assert_same_owner('patient_id', 'patients');
create trigger consultations_owner_check before insert or update on public.consultations
  for each row execute function public.assert_same_owner('patient_id', 'patients');
create trigger cards_owner_check before insert or update on public.patient_cards
  for each row execute function public.assert_same_owner('patient_id', 'patients');
create trigger photos_owner_check before insert or update on public.patient_photos
  for each row execute function public.assert_same_owner('patient_id', 'patients');
create trigger versions_owner_check before insert or update on public.card_versions
  for each row execute function public.assert_same_owner('card_id', 'patient_cards');

-- ---------------------------------------------------------------- storage (private bucket)
insert into storage.buckets (id, name, public, file_size_limit)
values ('kris-private', 'kris-private', false, 41943040)
on conflict (id) do update set public = false;

create policy "kris files: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'kris-private' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kris files: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'kris-private' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kris files: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'kris-private' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kris files: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'kris-private' and (storage.foldername(name))[1] = auth.uid()::text);
