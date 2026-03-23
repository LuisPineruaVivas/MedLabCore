import { createContext, useContext, useEffect, useReducer, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

interface AuthState {
  session: Session | null;
  loading: boolean;
}

type AuthAction = { type: "SET_SESSION"; session: Session | null };

function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_SESSION":
      return { session: action.session, loading: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ session, loading }, dispatch] = useReducer(authReducer, {
    session: null,
    loading: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        dispatch({ type: "SET_SESSION", session });
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch({ type: "SET_SESSION", session });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
