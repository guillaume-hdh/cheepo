import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { SessionContext } from "./session-context";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    async function readPlatformAdminFlag(nextSession: Session | null) {
      if (!nextSession?.user) {
        return false;
      }

      const { data, error } = await supabase.rpc("is_platform_admin", {});

      if (error) {
        return false;
      }

      return Boolean(data);
    }

    async function applySession(nextSession: Session | null) {
      const currentRequestId = ++requestId;
      const adminFlag = await readPlatformAdminFlag(nextSession);

      if (!active || currentRequestId !== requestId) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsPlatformAdmin(adminFlag);
      setLoading(false);
    }

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      await applySession(data.session);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      void applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ loading, session, user, isPlatformAdmin }}>
      {children}
    </SessionContext.Provider>
  );
}
