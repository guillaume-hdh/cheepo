import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { PENDING_JOIN_CODE_KEY } from "./constants";
import { supabase } from "./supabase";
import { SessionContext } from "./session-context";
import { toast } from "./toast";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    async function readSessionFlags(nextSession: Session | null) {
      if (!nextSession?.user) {
        return {
          isPlatformAdmin: false,
          isBanned: false,
        };
      }

      const { data, error } = await supabase.rpc("get_session_flags", {});

      if (error) {
        return {
          isPlatformAdmin: false,
          isBanned: false,
        };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") {
        return {
          isPlatformAdmin: false,
          isBanned: false,
        };
      }

      const flags = row as { is_platform_admin?: unknown; is_banned?: unknown };

      return {
        isPlatformAdmin: Boolean(flags.is_platform_admin),
        isBanned: Boolean(flags.is_banned),
      };
    }

    async function applySession(nextSession: Session | null) {
      const currentRequestId = ++requestId;
      const flags = await readSessionFlags(nextSession);

      if (!active || currentRequestId !== requestId) {
        return;
      }

      if (flags.isBanned) {
        localStorage.removeItem(PENDING_JOIN_CODE_KEY);

        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("sb-")) {
            localStorage.removeItem(key);
          }
        }

        await supabase.auth.signOut({ scope: "local" });

        if (!active || currentRequestId !== requestId) {
          return;
        }

        setSession(null);
        setUser(null);
        setIsPlatformAdmin(false);
        setLoading(false);
        toast("Compte suspendu. Contacte l equipe Cheepo.");
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsPlatformAdmin(flags.isPlatformAdmin);
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
