-- Migration script to add roadmap_templates table for shared roadmap templates
-- Run this in Supabase SQL Editor

-- Roadmap Templates table (shared templates, not user-specific)
CREATE TABLE IF NOT EXISTS public.roadmap_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_roadmap_templates_slug ON public.roadmap_templates(slug);

-- Enable Row Level Security
ALTER TABLE public.roadmap_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roadmap_templates (public read, no write for users)
CREATE POLICY "Anyone can view roadmap templates"
  ON public.roadmap_templates FOR SELECT
  USING (true);

-- Note: Template creation/updates should be done server-side or by admin
-- Users cannot insert/update/delete templates directly

