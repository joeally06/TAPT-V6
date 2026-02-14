import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Calendar,
  Award,
  TrendingUp,
  AlertCircle,
  Clock,
  FileText,
  Store,
  Settings,
  GraduationCap,
  MapPin
} from 'lucide-react';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  outcome: string;
  timestamp: string;
  details: any;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    conferenceRegistrations: 0,
    techConferenceRegistrations: 0,
    exhibitorRegistrations: 0,
    scholarshipApplications: 0,
    nominations: 0,
    totalUsers: 0,
    pendingNominations: 0,
    upcomingEvents: 0
  });

  const [luncheonRegistrations, setLuncheonRegistrations] = useState(0);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/admin/login');
        return;
      }
      if (user.role !== 'admin') {
        navigate('/');
        return;
      }
      fetchDashboardStats();
    }
    // eslint-disable-next-line
  }, [authLoading, user]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call the Edge Function to get dashboard stats
      const response = await fetch(`${supabaseUrl}/functions/v1/get-dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dashboard statistics');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard statistics');
      }

      setStats(result.stats);


      // Fetch regional luncheon registration count
      const { count: luncheonCount } = await supabase
        .from('regional_luncheon_registrations')
        .select('*', { count: 'exact', head: true });
      setLuncheonRegistrations(luncheonCount ?? 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome to the TAPT administration panel. Here's an overview of your site's activity.
        </p>
      </div>

      {error && (
        <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[
          {
            title: 'Total Users',
            value: stats.totalUsers,
            icon: Users,
            color: 'bg-blue-500'
          },
          {
            title: 'Conference Registrations',
            value: stats.conferenceRegistrations,
            icon: Calendar,
            color: 'bg-green-500'
          },
          {
            title: 'Tech Conference Registrations',
            value: stats.techConferenceRegistrations,
            icon: Calendar,
            color: 'bg-purple-500'
          },
          {
            title: 'Exhibitor Registrations',
            value: stats.exhibitorRegistrations,
            icon: Store,
            color: 'bg-teal-500'
          },
          {
            title: 'Scholarship Applications',
            value: stats.scholarshipApplications,
            icon: GraduationCap,
            color: 'bg-amber-500'
          },
          {
            title: 'Hall of Fame Nominations',
            value: stats.nominations,
            icon: Award,
            color: 'bg-yellow-500'
          },
          {
            title: 'Pending Nominations',
            value: stats.pendingNominations,
            icon: Clock,
            color: 'bg-orange-500'
          },
          {
            title: 'Luncheon Registrations',
            value: luncheonRegistrations,
            icon: MapPin,
            color: 'bg-rose-500'
          },
          {
            title: 'Upcoming Events',
            value: stats.upcomingEvents,
            icon: TrendingUp,
            color: 'bg-indigo-500'
          }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center">
                <div className={`${stat.color} rounded-lg p-3`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 truncate">
                    {stat.title}
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                title: 'Manage Users',
                path: '/admin/users',
                icon: Users,
                color: 'bg-blue-100 text-blue-600'
              },
              {
                title: 'View Registrations',
                path: '/admin/conference-registrations',
                icon: Calendar,
                color: 'bg-green-100 text-green-600'
              },
              {
                title: 'Review Nominations',
                path: '/admin/hall-of-fame-nominations',
                icon: Award,
                color: 'bg-yellow-100 text-yellow-600'
              },
              {
                title: 'Manage Content',
                path: '/admin/content',
                icon: FileText,
                color: 'bg-purple-100 text-purple-600'
              },
              {
                title: 'Exhibitor Settings',
                path: '/admin/exhibitor-settings',
                icon: Store,
                color: 'bg-teal-100 text-teal-600'
              },
              {
                title: 'Scholarship Settings',
                path: '/admin/student-scholarship-settings',
                icon: GraduationCap,
                color: 'bg-amber-100 text-amber-600'
              },
              {
                title: 'Site Settings',
                path: '/admin/site-settings',
                icon: Settings,
                color: 'bg-gray-100 text-gray-600'
              }
            ].map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`p-3 rounded-lg ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="mt-2 text-sm font-medium text-gray-900">
                  {action.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;