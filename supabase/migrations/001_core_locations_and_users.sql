-- Migration 001: Core Locations & User Profiles (Idempotent)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.barangays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  municipality text NOT NULL DEFAULT 'Manolo Fortich',
  province text NOT NULL DEFAULT 'Bukidnon',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cdcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barangay_id uuid NOT NULL REFERENCES public.barangays(id) ON DELETE RESTRICT,
  name text NOT NULL,
  center_type text NOT NULL DEFAULT 'CDC' CHECK (center_type IN ('CDC', 'LC')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  permit_number text,
  permit_issued_at date,
  permit_expires_at date,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barangay_id, name)
);

ALTER TABLE public.cdcs ADD COLUMN IF NOT EXISTS barangay_id uuid REFERENCES public.barangays(id) ON DELETE RESTRICT;
ALTER TABLE public.cdcs ADD COLUMN IF NOT EXISTS center_type text NOT NULL DEFAULT 'CDC';
ALTER TABLE public.cdcs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.cdcs ADD COLUMN IF NOT EXISTS permit_number text;
ALTER TABLE public.cdcs ADD COLUMN IF NOT EXISTS permit_issued_at date;
ALTER TABLE public.cdcs ADD COLUMN IF NOT EXISTS permit_expires_at date;

CREATE INDEX IF NOT EXISTS idx_cdcs_barangay_id ON public.cdcs(barangay_id);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text NOT NULL,
  phone_number text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('superadmin', 'admin', 'teacher', 'student')),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_code text UNIQUE,
  registration_code text UNIQUE,
  cdc_id uuid REFERENCES public.cdcs(id) ON DELETE SET NULL,
  barangay_id uuid REFERENCES public.barangays(id) ON DELETE SET NULL,
  position_title text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS teacher_code text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS registration_code text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS cdc_id uuid REFERENCES public.cdcs(id) ON DELETE SET NULL;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS barangay_id uuid REFERENCES public.barangays(id) ON DELETE SET NULL;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS position_title text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_teachers_cdc_id ON public.teachers(cdc_id);
CREATE INDEX IF NOT EXISTS idx_teachers_barangay_id ON public.teachers(barangay_id);

CREATE TABLE IF NOT EXISTS public.parents (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  occupation text,
  address text,
  preferred_contact text CHECK (preferred_contact IN ('phone', 'email', 'sms')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
