import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MarketingTask = {
  id: string;
  match_id: string;
  status: "pendente" | "concluida";
  photo_path: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type MarketingStory = {
  id: string;
  match_id: string;
  story_type: "resultado" | "craque";
  image_path: string;
  created_at: string;
};

export type Sponsor = {
  id: string;
  edition_id: string | null;
  name: string;
  logo_url: string;
  is_master: boolean;
  sort_order: number;
};

export function useMarketingTasks() {
  return useQuery({
    queryKey: ["marketing_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_tasks")
        .select("id, match_id, status, photo_path, created_at, resolved_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingTask[];
    },
  });
}

export function useMarketingStories() {
  return useQuery({
    queryKey: ["marketing_stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_stories")
        .select("id, match_id, story_type, image_path, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketingStory[];
    },
  });
}

export function useSponsors() {
  return useQuery({
    queryKey: ["sponsors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsors")
        .select("id, edition_id, name, logo_url, is_master, sort_order")
        .order("is_master", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Sponsor[];
    },
  });
}

export function marketingPublicUrl(path: string): string {
  return supabase.storage.from("marketing").getPublicUrl(path).data.publicUrl;
}
