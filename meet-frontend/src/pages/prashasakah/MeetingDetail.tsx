import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminMeeting, AdminMeetingParticipant, AdminChatMessage } from '../../services/prashasakahApi';
import { sanitizeUrl } from '../../utils/security';

/**
 * MeetingDetail - Individual Meeting Detail Page
 * 
 * Shows meeting information, participant list, and chat logs.
 */

interface MeetingData extends AdminMeeting {
  room_id: string;
  recording_url?: string | null;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Ongoing';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateTime(dateStr);
}

const statusColors: Record<string, string> = {
  ongoing: 'bg-green-100 text-green-800 border-green-200',
  ended: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [participants, setParticipants] = useState<AdminMeetingParticipant[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');

  const fetchMeeting = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await prashasakahApi.getMeeting(id);
      const data = response.data as { meeting: MeetingData; participants: AdminMeetingParticipant[] };
      setMeeting(data.meeting);
      setParticipants(data.participants || []);
    } catch (error) {
      console.error('Failed to fetch meeting:', error);
      toast.error('Failed to load meeting details');
      navigate('/prashasakah/meetings');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchChatMessages = useCallback(async () => {
    if (!id) return;
    
    setChatLoading(true);
    try {
      const response = await prashasakahApi.getMeetingChat(id, { limit: 200 });
      setChatMessages(response?.data?.messages || []);
    } catch (error) {
      console.error('Failed to fetch chat messages:', error);
      // Don't show toast for chat errors - might just not have chat
    } finally {
      setChatLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  useEffect(() => {
    if (activeTab === 'chat' && chatMessages.length === 0) {
      fetchChatMessages();
    }
  }, [activeTab, chatMessages.length, fetchChatMessages]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting not found</h2>
        <Link to="/prashasakah/meetings" className="text-brand-600 hover:underline">
          Return to meetings list
        </Link>
      </div>
    );
  }

  const isOngoing = meeting.status === 'ongoing';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/prashasakah" className="hover:text-gray-700">Dashboard</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link to="/prashasakah/meetings" className="hover:text-gray-700">Meetings</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium">{meeting.roomTitle || meeting.roomName}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {meeting.roomTitle || meeting.roomName}
          </h1>
          <p className="text-gray-500 mt-1">
            {formatDateTime(meeting.startedAt)}
            {meeting.endedAt && ` - ${formatDateTime(meeting.endedAt)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColors[meeting.status]}`}>
            {isOngoing ? (
              <svg className="w-4 h-4 mr-1.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="3" />
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {meeting.status}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Meeting Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Meeting Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Meeting Information
            </h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500">Room Name</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 font-mono">
                  {meeting.roomName}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Duration</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatDuration(meeting.duration)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Participants</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {meeting.participantCount}
                  {meeting.maxParticipants && ` / ${meeting.maxParticipants} max`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Started</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(meeting.startedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Ended</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {formatDateTime(meeting.endedAt)}
                </dd>
              </div>
              {meeting.recording_url && sanitizeUrl(meeting.recording_url) && (
                <div>
                  <dt className="text-sm text-gray-500">Recording</dt>
                  <dd className="mt-1">
                    <a 
                      href={sanitizeUrl(meeting.recording_url) ?? undefined} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-brand-600 hover:underline"
                    >
                      View Recording
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Statistics
            </h3>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-gray-600">Total Participants</dt>
                <dd className="font-semibold text-gray-900">{participants.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Unique Users</dt>
                <dd className="font-semibold text-gray-900">
                  {new Set(participants.filter(p => p.userId).map(p => p.userId)).size}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Guest Users</dt>
                <dd className="font-semibold text-gray-900">
                  {participants.filter(p => !p.userId).length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Chat Messages</dt>
                <dd className="font-semibold text-gray-900">{chatMessages.length}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right Column - Participants & Chat */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('participants')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'participants'
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Participants ({participants.length})
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'chat'
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Chat ({chatMessages.length})
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'participants' && (
                <div>
                  {participants.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p>No participants recorded</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Joined
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Left
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Duration
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {participants.map((participant, index) => {
                            const joinedAt = new Date(participant.joinedAt);
                            const leftAt = participant.leftAt ? new Date(participant.leftAt) : new Date();
                            const durationMins = Math.round((leftAt.getTime() - joinedAt.getTime()) / 60000);
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                                      {(participant.name || participant.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="ml-3">
                                      <div className="text-sm font-medium text-gray-900">
                                        {participant.name || 'Guest User'}
                                      </div>
                                      {participant.email && (
                                        <div className="text-xs text-gray-500">{participant.email}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {formatRelativeTime(participant.joinedAt)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {participant.leftAt 
                                    ? formatRelativeTime(participant.leftAt)
                                    : <span className="text-green-600">Still in meeting</span>
                                  }
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {durationMins}m
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'chat' && (
                <div>
                  {chatLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="w-8 h-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p>No chat messages in this meeting</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {chatMessages.map((message) => (
                        <div key={message.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                            {(message.userName || message.userEmail || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {message.userName || 'Unknown User'}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatRelativeTime(message.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-700 break-words">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="pt-4">
        <Link 
          to="/prashasakah/meetings" 
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Meetings
        </Link>
      </div>
    </div>
  );
}
