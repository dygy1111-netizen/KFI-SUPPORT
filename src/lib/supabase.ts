import { createClient } from "@supabase/supabase-js";
import { PUBLIC_ASSET_BUCKET } from "../config/site";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabaseAnonKey || "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export function publicAssetUrl(path: string | null | undefined) {
  if (!path) return "";
  return supabase.storage.from(PUBLIC_ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadPublicFile(file: File, folder: "cases" | "resources") {
  const safeExtension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID()}.${safeExtension}`;
  const { error } = await supabase.storage.from(PUBLIC_ASSET_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removePublicFile(path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(PUBLIC_ASSET_BUCKET).remove([path]);
  if (error) throw error;
}
