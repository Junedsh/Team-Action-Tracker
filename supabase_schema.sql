-- Create Tasks Table
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    description TEXT NOT NULL,
    project TEXT,
    owner TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    assigned_date DATE DEFAULT CURRENT_DATE,
    promise_date DATE,
    completed_date DATE,
    comments TEXT
);

-- Create Team Members Table
CREATE TABLE public.team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    designation TEXT
);

-- Create Projects Table
CREATE TABLE public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create Policies for Public Access (Simulating "Anonymous" access for now)
-- Allow Select (Read) for everyone
CREATE POLICY "Enable read access for all users" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.projects FOR SELECT USING (true);

-- Allow Insert (Create) for everyone
CREATE POLICY "Enable insert access for all users" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert access for all users" ON public.team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert access for all users" ON public.projects FOR INSERT WITH CHECK (true);

-- Allow Update for everyone
CREATE POLICY "Enable update access for all users" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Enable update access for all users" ON public.team_members FOR UPDATE USING (true);
CREATE POLICY "Enable update access for all users" ON public.projects FOR UPDATE USING (true);

-- Allow Delete for everyone
CREATE POLICY "Enable delete access for all users" ON public.tasks FOR DELETE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.team_members FOR DELETE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.projects FOR DELETE USING (true);
