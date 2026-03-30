import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type SessionContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isPlatformAdmin: boolean;
};

export const SessionContext = createContext<SessionContextValue | undefined>(undefined);
