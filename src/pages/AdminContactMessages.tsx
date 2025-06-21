import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Search, 
  Inbox, 
  Mail, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../context/AuthContext';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  district: string | null;
  message: string;
  created_at: string;
  read_status: boolean;
}

const AdminContactMessages: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [showMessageDetail, setShowMessageDetail] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [refreshing, setRefreshing] = useState(false);

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
      fetchMessages();
    }
    // eslint-disable-next-line
  }, [authLoading, user, page, showUnreadOnly]);

  const fetchMessages = async () => {
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

      // Call the Edge Function to get messages
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-contact-messages?page=${page}&pageSize=${pageSize}${showUnreadOnly ? '&unread=true' : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch messages');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch messages');
      }

      setMessages(result.data || []);
      setTotalCount(result.count || 0);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleToggleReadStatus = async (messageId: string, currentStatus: boolean) => {
    try {
      setError(null);
      setSuccess(null);

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

      // Call the Edge Function to update message status
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-contact-messages`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            id: messageId,
            read_status: !currentStatus
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update message status');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update message status');
      }

      // Update the messages list
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, read_status: !currentStatus } : msg
        )
      );

      // If viewing message details, update the selected message
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage({ ...selectedMessage, read_status: !currentStatus });
      }

      setSuccess(`Message marked as ${!currentStatus ? 'read' : 'unread'}`);
    } catch (error: any) {
      console.error('Error updating message status:', error);
      setError('Failed to update message status: ' + error.message);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

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

      // Call the Edge Function to delete message
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-contact-messages`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            id: messageId
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete message');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete message');
      }

      // Update the messages list
      setMessages(prev => prev.filter(msg => msg.id !== messageId));

      // If viewing message details, close the detail view
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage(null);
        setShowMessageDetail(false);
      }

      setSuccess('Message deleted successfully');
    } catch (error: any) {
      console.error('Error deleting message:', error);
      setError('Failed to delete message: ' + error.message);
    }
  };

  const viewMessageDetail = (message: ContactMessage) => {
    setSelectedMessage(message);
    setShowMessageDetail(true);
    
    // If message is unread, mark it as read
    if (!message.read_status) {
      handleToggleReadStatus(message.id, message.read_status);
    }
  };

  // Filter messages based on search term
  const filteredMessages = messages.filter(message => {
    const searchLower = searchTerm.toLowerCase();
    return (
      message.name.toLowerCase().includes(searchLower) ||
      message.email.toLowerCase().includes(searchLower) ||
      (message.district && message.district.toLowerCase().includes(searchLower)) ||
      message.message.toLowerCase().includes(searchLower)
    );
  });

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Messages</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage messages from the contact form
          </p>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Dashboard
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="md:col-span-1 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Messages {totalCount > 0 && `(${totalCount})`}
              </h2>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-gray-500 hover:text-gray-700"
                title="Refresh messages"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="mt-3 flex items-center">
              <input
                type="checkbox"
                id="showUnreadOnly"
                checked={showUnreadOnly}
                onChange={() => setShowUnreadOnly(!showUnreadOnly)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="showUnreadOnly" className="ml-2 block text-sm text-gray-700">
                Show unread only
              </label>
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-gray-600">Loading messages...</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No messages found</h3>
                <p className="mt-1 text-gray-500">
                  {showUnreadOnly 
                    ? "There are no unread messages." 
                    : searchTerm 
                      ? "No messages match your search." 
                      : "There are no messages yet."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredMessages.map((message) => (
                  <li 
                    key={message.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedMessage?.id === message.id ? 'bg-gray-50' : ''
                    } ${!message.read_status ? 'bg-blue-50' : ''}`}
                    onClick={() => viewMessageDetail(message)}
                  >
                    <div className="px-4 py-4">
                      <div className="flex justify-between">
                        <p className={`text-sm font-medium ${!message.read_status ? 'text-primary' : 'text-gray-900'}`}>
                          {message.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(message.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">{message.email}</p>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{message.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {Math.ceil(totalCount / pageSize)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(totalCount / pageSize)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="md:col-span-2">
          {showMessageDetail && selectedMessage ? (
            <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Message Details</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleToggleReadStatus(selectedMessage.id, selectedMessage.read_status)}
                    className="text-gray-500 hover:text-gray-700"
                    title={selectedMessage.read_status ? "Mark as unread" : "Mark as read"}
                  >
                    {selectedMessage.read_status ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete message"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500">From</h3>
                  <p className="mt-1 text-lg font-medium text-gray-900">{selectedMessage.name}</p>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500">Contact Information</h3>
                  <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Email:</p>
                      <a 
                        href={`mailto:${selectedMessage.email}`} 
                        className="text-primary hover:underline"
                      >
                        {selectedMessage.email}
                      </a>
                    </div>
                    {selectedMessage.phone && (
                      <div>
                        <p className="text-sm text-gray-500">Phone:</p>
                        <a 
                          href={`tel:${selectedMessage.phone}`} 
                          className="text-primary hover:underline"
                        >
                          {selectedMessage.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {selectedMessage.district && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500">School District/Organization</h3>
                    <p className="mt-1 text-gray-900">{selectedMessage.district}</p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500">Date Received</h3>
                  <p className="mt-1 text-gray-900">
                    {format(new Date(selectedMessage.created_at), 'MMMM d, yyyy h:mm a')}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Message</h3>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                </div>

                <div className="mt-6 flex space-x-4">
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Re: Your message to TAPT`}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
                  >
                    <Mail className="mr-2 h-5 w-5" />
                    Reply by Email
                  </a>
                  {selectedMessage.phone && (
                    <a
                      href={`tel:${selectedMessage.phone}`}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="mr-2 h-5 w-5" />
                      Call
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden h-full flex items-center justify-center">
              <div className="text-center p-8">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Select a message</h3>
                <p className="mt-1 text-gray-500">
                  Choose a message from the list to view its details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminContactMessages;