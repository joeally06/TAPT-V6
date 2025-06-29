import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  loading: boolean;
  error: Error | null;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  refreshAuth: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    refreshAuth: async () => {}
  });

  const refreshAuth = async () => {
    try {
      console.log('AuthContext: refreshAuth started, setting loading to true');
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('AuthContext: getSession completed, session:', session);
      
      if (sessionError) {
        throw sessionError;
      }
      
      if (!session) {
        console.log('AuthContext: No session found, setting loading to false');
        setState({
          user: null,
          loading: false,
          error: null,
          refreshAuth
        });
        return;
      }
      
      // Use RPC function to get role without recursion
      console.log('AuthContext: Fetching user role for ID:', session.user.id);
      const { data: role, error: roleError } = await supabase.rpc(
        'get_user_role',
        { user_id: session.user.id }
      );

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        setState({
          user: { ...session.user, role: null, access_token: session.access_token },
          loading: false,
          error: roleError,
          refreshAuth
        });
        return;
      }

      console.log('AuthContext: User role fetched, setting loading to false');
      setState({
        user: { 
          ...session.user, 
          role, 
          access_token: session.access_token 
        },
        loading: false,
        error: null,
        refreshAuth
      });
    } catch (error) {
      console.error('Auth refresh error:', error);
      console.log('AuthContext: Error during refreshAuth, setting loading to false. Error:', error);
      setState(prev => ({
        ...prev,
        user: null,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown authentication error'),
        refreshAuth
      }));
    }
  };
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      await refreshAuth();
    };
    
    initAuth();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('AuthContext: Auth event:', event);

      if (event === 'SIGNED_OUT') {
        console.log('AuthContext: User signed out, clearing state and redirecting');
        // Immediately clear state and redirect
        setState({
          user: null,
          loading: false, // Critical: Set loading to false immediately
          error: null,
          refreshAuth
        });
        
        // Force redirect to login page
        console.log('AuthContext: Redirecting to /admin/login');
        window.location.href = '/admin/login';
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('AuthContext: User signed in, refreshing auth');
        setState(prev => ({ ...prev, loading: true }));
        await refreshAuth();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('AuthContext: Token refreshed, refreshing auth');
        await refreshAuth();
      }
    });
    
    // Add visibility change listener to refresh auth when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('AuthContext: Tab became visible, refreshing auth state');
        refreshAuth();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Add safety timeout to prevent infinite loading states
  useEffect(() => {
    if (!state.loading) return;

    const timeoutId = setTimeout(() => {
      console.warn('AuthContext: Auth loading timeout - forcing state reset');
      
      // If user is null after timeout, force redirect to login page
      if (!state.user) {
        console.log('AuthContext: No user after timeout - redirecting to login page');
        window.location.href = '/admin/login';
      } else {
        // Just reset loading state if we have a user
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: new Error('Authentication timeout')
        }));
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [state.loading, state.user]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);