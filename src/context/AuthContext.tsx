import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

  // Track if a refresh is already in progress to prevent race conditions
  const isRefreshing = useRef(false);
  // Track if initial auth has completed
  const initialAuthComplete = useRef(false);
  // Track current user ID to detect changes
  const currentUserId = useRef<string | null>(null);

  const refreshAuth = async (force = false) => {
    // Prevent concurrent refreshes unless forced
    if (isRefreshing.current && !force) {
      console.log('AuthContext: Refresh already in progress, skipping');
      return;
    }

    try {
      isRefreshing.current = true;
      console.log('AuthContext: refreshAuth started, setting loading to true');
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('AuthContext: getSession completed, session:', session ? 'exists' : 'null');
      
      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        console.log('AuthContext: No session found, setting loading to false');
        currentUserId.current = null;
        setState({
          user: null,
          loading: false,
          error: null,
          refreshAuth
        });
        initialAuthComplete.current = true;
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
        currentUserId.current = session.user.id;
        setState({
          user: { ...session.user, role: null, access_token: session.access_token },
          loading: false,
          error: roleError,
          refreshAuth
        });
        initialAuthComplete.current = true;
        return;
      }

      console.log('AuthContext: User role fetched:', role, 'setting loading to false');
      currentUserId.current = session.user.id;
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
      initialAuthComplete.current = true;
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
      initialAuthComplete.current = true;
    } finally {
      isRefreshing.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      await refreshAuth(true); // Force initial refresh
    };
    
    initAuth();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('AuthContext: Auth event:', event);

      if (event === 'SIGNED_OUT') {
        console.log('AuthContext: User signed out, clearing state and redirecting');
        currentUserId.current = null;
        // Immediately clear state and redirect
        setState({
          user: null,
          loading: false,
          error: null,
          refreshAuth
        });
        
        // Force redirect to login page
        console.log('AuthContext: Redirecting to /admin/login');
        window.location.href = '/admin/login';
        return;
      }

      // Only refresh on SIGNED_IN if we don't already have this user loaded
      // This prevents the double-refresh when tab becomes visible
      if (event === 'SIGNED_IN' && session?.user) {
        if (currentUserId.current === session.user.id && initialAuthComplete.current) {
          console.log('AuthContext: User already loaded, skipping refresh');
          return;
        }
        console.log('AuthContext: User signed in, refreshing auth');
        await refreshAuth();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('AuthContext: Token refreshed, updating token without full refresh');
        // Just update the access token without triggering a full refresh
        setState(prev => {
          if (prev.user && session) {
            return {
              ...prev,
              user: { ...prev.user, access_token: session.access_token }
            };
          }
          return prev;
        });
      }
    });
    
    // Debounced visibility change handler
    let visibilityTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear any pending timeout
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout);
        }
        
        // Debounce the refresh to avoid race conditions with auth state change
        visibilityTimeout = setTimeout(() => {
          // Only check session if we're not already refreshing and initial auth is complete
          if (!isRefreshing.current && initialAuthComplete.current) {
            console.log('AuthContext: Tab became visible, checking session validity');
            // Instead of full refresh, just verify the session is still valid
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (!session && currentUserId.current) {
                console.log('AuthContext: Session expired, clearing user');
                currentUserId.current = null;
                setState({
                  user: null,
                  loading: false,
                  error: null,
                  refreshAuth
                });
              } else if (session && !currentUserId.current) {
                console.log('AuthContext: Have session but no user, refreshing');
                refreshAuth();
              }
              // If session exists and user exists, do nothing - we're good
            });
          }
        }, 500); // 500ms debounce
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
    };
  }, []);

  // Add safety timeout to prevent infinite loading states
  useEffect(() => {
    if (!state.loading) return;

    const timeoutId = setTimeout(() => {
      console.warn('AuthContext: Auth loading timeout - forcing state reset');
      isRefreshing.current = false;
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: new Error('Authentication timeout')
      }));
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [state.loading]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);