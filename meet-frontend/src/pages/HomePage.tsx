import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, getMyRooms, meetingsApi, roomsApi } from '../services/api';
import { useUser } from '../store/authStore';
import { PageErrorBoundary } from '../components/shared/PageErrorBoundary';
import { MeetingCardSkeleton } from '../components/shared/Skeletons';
import { DashboardStats } from '../components/shared/DashboardStats';
import type { StatItem } from '../components/shared/DashboardStats';
import { cn } from '../utils/cn';
import { generateRoomName } from '../utils/roomName';
import type { Room, ScheduledMeeting } from '../types';
import { Plus, Link2 as Link, ArrowRight, X, Trash2, Calendar, Clock, AlertCircle, Check, Zap, Video, Users, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import logger from '../utils/logger';

export default function HomePage() {
  return (
    <PageErrorBoundary fallbackMessage="Failed to load dashboard.">
      <HomePageContent />
    </PageErrorBoundary>
  );
}

function HomePageContent() {
  const navigate = useNavigate();
  const user = useUser();
  
  // Room state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  
  // Stats state
  const [stats, setStats] = useState<StatItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsLoaded, setStatsLoaded] = useState(false);
  
  // Scheduled meetings state
  const [upcomingMeetings, setUpcomingMeetings] = useState<ScheduledMeeting[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingLoaded, setUpcomingLoaded] = useState(false);
  
  // Form state
  const [roomName, setRoomName] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Validation state
  const [roomNameTouched, setRoomNameTouched] = useState(false);
  const [roomNameError, setRoomNameError] = useState('');
  
  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Load critical data immediately
    loadCriticalData();
    // Defer non-critical data by 1 second
    const deferredTimer = setTimeout(loadDeferredData, 1000);
    return () => {
      mountedRef.current = false;
      clearTimeout(deferredTimer);
    };
  }, []);

  // Validate room name
  useEffect(() => {
    if (roomNameTouched) {
      if (!roomName.trim()) {
        setRoomNameError('Room name is required');
      } else if (!/^[a-z0-9-]+$/.test(roomName)) {
        setRoomNameError('Only lowercase letters, numbers, and hyphens allowed');
      } else if (roomName.length > 50) {
        setRoomNameError('Room name must be 50 characters or less');
      } else {
        setRoomNameError('');
      }
    }
  }, [roomName, roomNameTouched]);

  // Lightweight room reload (for after create/delete)
  const reloadRooms = async () => {
    try {
      const response = await getMyRooms();
      setRooms(response?.data?.rooms || []);
    } catch (err) {
      logger.error('Failed to reload rooms:', err);
    }
  };

  // Critical data - loads immediately (rooms for user's primary need)
  const loadCriticalData = async () => {
    setLoadingRooms(true);
    try {
      const response = await getMyRooms();
      setRooms(response?.data?.rooms || []);
    } catch (err) {
      logger.error('Failed to load rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Deferred data - loads after 1s delay (stats, upcoming meetings)
  const loadDeferredData = async () => {
    if (!mountedRef.current) return;
    setLoadingStats(true);
    setLoadingUpcoming(true);
    
    try {
      const [historyRes, scheduledRes] = await Promise.all([
        meetingsApi.getHistory(50, 0),
        meetingsApi.getScheduled(),
      ]);

      if (!mountedRef.current) return;

      const meetings = historyRes?.data?.meetings || [];
      const scheduled = scheduledRes?.data?.meetings || [];
      
      const totalMeetings = meetings.length;
      const totalParticipants = meetings.reduce(
        (sum, m) => sum + (m.uniqueParticipants || m.participantCount || 0),
        0
      );
      
      const totalMinutes = meetings.reduce((sum, m) => {
        if (!m.startedAt || !m.endedAt) return sum;
        const start = parseISO(m.startedAt);
        const end = parseISO(m.endedAt);
        return sum + Math.abs(Math.round((end.getTime() - start.getTime()) / 60000));
      }, 0);
      
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingThisWeek = scheduled.filter(m => {
        const date = parseISO(m.scheduled_start || m.scheduledStart);
        return date >= now && date <= weekFromNow;
      }).length;
      
      if (!mountedRef.current) return;
      setStats([
        { label: 'Total Meetings', value: totalMeetings, icon: Video, color: 'brand', primary: true },
        { label: 'This Week', value: upcomingThisWeek, icon: Calendar, color: 'success' },
        { label: 'Total Participants', value: totalParticipants, icon: Users, color: 'info' },
        { label: 'Total Hours', value: Math.max(0, Math.round(totalMinutes / 60)), icon: Clock, color: 'warning' },
      ]);
      setLoadingStats(false);
      setStatsLoaded(true);

      const upcoming = scheduled
        .filter(m => new Date(m.scheduled_start || m.scheduledStart) >= now)
        .sort((a, b) => 
          new Date(a.scheduled_start || a.scheduledStart).getTime() - 
          new Date(b.scheduled_start || b.scheduledStart).getTime()
        )
        .slice(0, 5);
      
      if (!mountedRef.current) return;
      setUpcomingMeetings(upcoming);
      setLoadingUpcoming(false);
      setUpcomingLoaded(true);
    } catch (err) {
      if (mountedRef.current) {
        logger.error('Failed to load deferred data:', err);
        setLoadingStats(false);
        setLoadingUpcoming(false);
      }
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setRoomNameTouched(true);
    
    if (roomNameError || !roomName.trim()) {
      return;
    }
    
    setCreating(true);
    
    try {
      await createRoom({ name: roomName, title: roomTitle || undefined });
      toast.success('Room created!');
      setShowCreateModal(false);
      setRoomName('');
      setRoomTitle('');
      setRoomNameTouched(false);
      reloadRooms();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      toast.error(axiosErr.response?.data?.error || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (roomName: string) => {
    const link = `${window.location.origin}/join/${roomName}`;
    await navigator.clipboard.writeText(link);
    setCopied(roomName);
    toast.success('Link copied!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Delete this room?')) return;
    
    try {
      // Optimistic update
      setRooms(prev => prev.filter(r => r.id !== roomId));
      await roomsApi.delete(roomId);
      toast.success('Room deleted');
    } catch {
      toast.error('Failed to delete room');
      reloadRooms(); // Reload on error
    }
  };

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowCreateModal(false);
      setRoomName('');
      setRoomTitle('');
      setRoomNameTouched(false);
    }
  }, []);

  // Focus modal on open
  useEffect(() => {
    if (showCreateModal && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [showCreateModal]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-surface-800 dark:text-white">
              Welcome{user?.name ? `, ${user.name}` : ''}
            </h1>
            {upcomingMeetings.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                <Calendar size={12} />
                {upcomingMeetings.length} today
              </span>
            )}
          </div>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            Start or join a meeting
          </p>
        </div>
        <button
          onClick={() => {
            setRoomName(generateRoomName());
            setShowCreateModal(true);
          }}
          className="btn-primary"
        >
          <Plus size={18} aria-hidden="true" />
          <span>New Meeting</span>
        </button>
      </div>

      {/* Stats Dashboard */}
      <div className={cn(statsLoaded && 'animate-fade-in')}>
        <DashboardStats stats={stats} loading={loadingStats} />
      </div>

      {/* Quick Start */}
      <div className="card p-4 sm:p-6">
        <h2 className="font-display font-semibold text-lg text-surface-800 dark:text-white mb-4 flex items-center gap-2">
          <Zap size={18} className="text-brand-500" aria-hidden="true" />
          Quick Start
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => {
              setRoomName(generateRoomName());
              setShowCreateModal(true);
            }}
            className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-surface-200 dark:border-surface-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center group-hover:bg-brand-200 dark:group-hover:bg-brand-900/50 transition">
              <Video size={24} className="text-brand-500" />
            </div>
            <div className="text-left">
              <p className="font-medium text-surface-800 dark:text-white">Instant Meeting</p>
              <p className="text-sm text-surface-500">Start a new meeting now</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/schedule')}
            className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-surface-200 dark:border-surface-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center group-hover:bg-success-200 dark:group-hover:bg-success-900/50 transition">
              <Calendar size={24} className="text-success-500" />
            </div>
            <div className="text-left">
              <p className="font-medium text-surface-800 dark:text-white">Schedule Meeting</p>
              <p className="text-sm text-surface-500">Plan for later</p>
            </div>
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings */}
        <div className={cn('card p-4 sm:p-6', upcomingLoaded && 'animate-fade-in')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-surface-800 dark:text-white flex items-center gap-2">
              <Calendar size={18} className="text-success-500" aria-hidden="true" />
              Upcoming
            </h2>
            <button
              onClick={() => navigate('/schedule')}
              className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1"
            >
              View all
              <ArrowRight size={14} />
            </button>
          </div>
          
          {loadingUpcoming ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <MeetingCardSkeleton key={i} />
              ))}
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={32} className="mx-auto text-surface-300 mb-2" />
              <p className="text-surface-500 dark:text-surface-400">No upcoming meetings</p>
              <button
                onClick={() => navigate('/schedule')}
                className="text-sm text-brand-500 hover:text-brand-600 mt-2"
              >
                Schedule one →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map(meeting => (
                <UpcomingMeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Rooms */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-surface-800 dark:text-white flex items-center gap-2">
              <Video size={18} className="text-brand-500" aria-hidden="true" />
              Recent Rooms
            </h2>
            {rooms.length > 0 && (
              <button
                onClick={() => navigate('/history')}
                className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1"
              >
                View history
                <ArrowRight size={14} />
              </button>
            )}
          </div>
          
          {loadingRooms ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <MeetingCardSkeleton key={i} />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8">
              <Video size={32} className="mx-auto text-surface-300 mb-2" />
              <p className="text-surface-500 dark:text-surface-400">No recent rooms</p>
              <p className="text-sm text-surface-400 mt-1">Start a meeting to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.slice(0, 5).map(room => (
                <div 
                  key={room.id} 
                  className="flex items-center justify-between p-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-surface-800 dark:text-white truncate">
                      {room.title || room.name}
                    </p>
                    <p className="text-xs text-surface-400 font-mono">{room.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(room.name)}
                      className={cn(
                        "p-2.5 rounded-lg transition",
                        copied === room.name
                          ? "text-success-500 bg-success-50 dark:bg-success-900/20"
                          : "text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700"
                      )}
                      aria-label="Copy link"
                    >
                      {copied === room.name ? <Check size={16} /> : <Link size={16} />}
                    </button>
                    <a
                      href={`/join/${room.name}`}
                      className="p-2.5 rounded-lg text-surface-400 hover:text-brand-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
                      aria-label="Join room"
                    >
                      <ArrowRight size={16} />
                    </a>
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="p-2.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
                      aria-label="Delete room"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div 
          className="modal-overlay" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="create-modal-title"
          onKeyDown={handleModalKeyDown}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setRoomName('');
              setRoomTitle('');
              setRoomNameTouched(false);
            }
          }}
        >
          <div 
            ref={modalRef}
            className="modal-content max-h-[90vh] overflow-y-auto"
            tabIndex={-1}
          >
            <div className="modal-header">
              <h2 id="create-modal-title" className="font-display font-semibold text-lg text-surface-800 dark:text-white">
                Create New Room
              </h2>
              <button
                ref={closeButtonRef}
                onClick={() => {
                  setShowCreateModal(false);
                  setRoomName('');
                  setRoomTitle('');
                  setRoomNameTouched(false);
                }}
                className="modal-close"
                aria-label="Close modal"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRoom} noValidate>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label htmlFor="roomName">Room Code *</label>
                  <input
                    id="roomName"
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    onBlur={() => setRoomNameTouched(true)}
                    placeholder="my-meeting-123"
                    className={cn(
                      roomNameError && 'input-error',
                      roomNameTouched && !roomNameError && 'input-success'
                    )}
                    aria-invalid={!!roomNameError}
                    aria-describedby={roomNameError ? 'room-name-error' : undefined}
                    autoFocus
                  />
                  {roomNameError ? (
                    <p id="room-name-error" className="form-error">
                      <AlertCircle size={14} aria-hidden="true" />
                      {roomNameError}
                    </p>
                  ) : (
                    <p className="form-hint">Unique identifier for your room</p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="roomTitle">
                    Display Name <span className="text-surface-400">(optional)</span>
                  </label>
                  <input
                    id="roomTitle"
                    type="text"
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    placeholder="Team Standup"
                    maxLength={100}
                  />
                  <p className="form-hint">Friendly name shown to participants</p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setRoomName('');
                    setRoomTitle('');
                    setRoomNameTouched(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !!roomNameError || !roomName.trim()}
                  className="btn-primary"
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Creating...
                    </span>
                  ) : (
                    <>
                      <Plus size={18} aria-hidden="true" />
                      <span>Create Room</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Upcoming meeting card component
function UpcomingMeetingCard({ meeting }: { meeting: ScheduledMeeting }) {
  const [copied, setCopied] = useState(false);
  
  const scheduledStart = meeting.scheduled_start || meeting.scheduledStart;
  const roomName = meeting.room_name || meeting.roomName;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const meetingUrl = `${window.location.origin}/join/${roomName}`;
    
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      toast.success('Meeting link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = meetingUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success('Meeting link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-surface-800 dark:text-white truncate">
          {meeting.title}
        </p>
        <div className="flex items-center gap-3 mt-1 text-sm text-surface-500">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {scheduledStart && format(parseISO(scheduledStart), 'MMM d')}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {scheduledStart && format(parseISO(scheduledStart), 'h:mm a')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleShare}
          className={cn(
            "p-2.5 rounded-lg transition",
            copied
              ? "text-success-500 bg-success-50 dark:bg-success-900/20"
              : "text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700"
          )}
          aria-label="Share meeting link"
          title="Copy meeting link"
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}
        </button>
        <a
          href={`/join/${roomName}`}
          className="btn-primary btn-sm"
        >
          <Video size={14} />
          <span>Start</span>
        </a>
      </div>
    </div>
  );
}
