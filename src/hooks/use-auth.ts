import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "mesario";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
        if (active) setRoles((data ?? []).map((r) => r.role as AppRole));
      } else if (active) {
        setRoles([]);
      }
      if (active) setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => void load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      void load(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user,
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isStaff: roles.length > 0,
  };
}
