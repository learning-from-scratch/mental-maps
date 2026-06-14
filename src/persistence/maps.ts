import type { ProjectState } from '@/core/model/project';
import { normalizeProjectState } from '@/core/model/projectFactory';
import { getSupabase } from '@/lib/supabase';

export interface MapSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface MapRow {
  id: string;
  title: string;
  document: ProjectState;
  updated_at: string;
}

export async function listMaps(): Promise<MapSummary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('maps')
    .select('id, title, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function loadMap(mapId: string): Promise<ProjectState> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('maps')
    .select('id, title, document')
    .eq('id', mapId)
    .single();

  if (error) throw error;

  const row = data as MapRow;
  return normalizeProjectState({
    ...row.document,
    id: row.id,
    title: row.title,
  });
}

export async function createMap(project: ProjectState): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('maps')
    .insert({
      owner_id: user.id,
      title: project.title,
      document: project,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function saveMap(mapId: string, project: ProjectState): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('maps')
    .update({
      title: project.title,
      document: project,
      updated_at: new Date().toISOString(),
    })
    .eq('id', mapId);

  if (error) throw error;
}

export async function deleteMap(mapId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('maps').delete().eq('id', mapId);
  if (error) throw error;
}
