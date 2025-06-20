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
  CheckCircle,
  Clock,
  FileText
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
    nominations: 0,
    totalUsers: 0,
    pendingNominations: 0,
    upcomingEvents: 0
  });
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

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

      // Get conference registration stats
      const { count: confCount } = await supabase
        .from('conference_registrations')
        .select('*', { count: 'exact', head: true });

      // Get tech conference registration stats
      const { count: techConfCount } = await supabase
        .from('tech_conference_registrations')
        .select('*', { count: 'exact', head: true });

      // Get nomination stats
      const { count: nomCount } = await supabase
        .from('hall_of_fame_nominations')
        .select('*', { count: 'exact', head: true });

      // Get pending nominations count
      const { count: pendingCount } = await supabase
        .from('hall_of_fame_nominations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get total users count
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get upcoming events count
      const { count: eventsCount } = await supabase
        .from('content')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'event')
        .gt('date', new Date().toISOString());

      // Get recent activities
      const { data: activities, error: activitiesError } = await supabase
        .from('admin_logs')
        .select('*')
        .eq('outcome', 'success')
        .order('timestamp', { ascending: false })
        .limit(5);

      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError);
      } else {
        setRecentActivities(activities || []);
      }

      setStats({
        conferenceRegistrations: confCount || 0,
        techConferenceRegistrations: techConfCount || 0,
        nominations: nomCount || 0,
        totalUsers: usersCount || 0,
        pendingNominations: pendingCount || 0,
        upcomingEvents: eventsCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format timestamp to relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - activityTime.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  // Helper function to get activity icon and message
  const getActivityDetails = (activity: ActivityLog): { icon: React.ReactNode; message: string } => {
    const action = activity.action;
    
    if (action.includes('conference_registration')) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        message: 'New conference registration submitted'
      };
    } else if (action.includes('tech_conference_registration')) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        message: 'New tech conference registration submitted'
      };
    } else if (action.includes('nomination')) {
      return {
        icon: <Clock className="h-5 w-5 text-orange-500" />,
        message: 'New Hall of Fame nomination received'
      };
    } else if (action.includes('user') || action.includes('create_user')) {
      return {
        icon: <Users className="h-5 w-5 text-blue-500" />,
        message: 'New user account created'
      };
    } else if (action.includes('content')) {
      return {
        icon: <FileText className="h-5 w-5 text-purple-500" />,
        message: 'Content updated'
      };
    } else if (action.includes('membership')) {
      return {
        icon: <Users className="h-5 w-5 text-indigo-500" />,
        message: 'New membership application received'
      };
    } else {
      return {
        icon: <CheckCircle className="h-5 w-5 text-gray-500" />,
        message: `Activity: ${action}`
      };
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => {
                const { icon, message } = getActivityDetails(activity);
                return (
                  <div key={activity.id} className="flex items-center">
                    {icon}
                    <div className="ml-3">
                      <p className="text-sm text-gray-900">{message}</p>
                      <p className="text-xs text-gray-500">{formatRelativeTime(activity.timestamp)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>No recent activity found</p>
              </div>
            )}
          </div>
        </div>

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