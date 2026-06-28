import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createRoom, getMyRooms, meetingsApi, roomsApi } from '../services/api';
import { useUser } from '../store/authStore';
import { PageErrorBoundary } from '../components/shared/PageErrorBoundary';
import { MeetingCardSkeleton } from '../components/shared/Skeletons';
import type { StatItem } from '../components/shared/DashboardStats';
import { cn } from '../utils/cn';
import { generateRoomName } from '../utils/roomName';
import type { Room, ScheduledMeeting } from '../types';
import { Plus, Link2 as LinkIcon, ArrowRight, X, Trash2, Calendar, Clock, AlertCircle, Check, Video, Users, Share2, ChevronRight, LayoutGrid, Lock, EyeOff, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import logger from '../utils/logger';

function normalizeRoomNameInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function getRoomNameError(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Room name is required';
  if (!/^[a-z][a-z0-9-]{2,99}$/.test(trimmed)) {
    return 'Room name must start with a letter and use only lowercase letters, numbers, and hyphens';
  }
  if (trimmed.includes('--')) {
    return 'Room name cannot contain consecutive hyphens';
  }
  if (trimmed.endsWith('-')) {
    return 'Room name cannot end with a hyphen';
  }
  return '';
}

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

  // Scheduled meetings state
  const [upcomingMeetings, setUpcomingMeetings] = useState<ScheduledMeeting[]>([]);
  const [upcomingLoaded, setUpcomingLoaded] = useState(false);
  
  // Form state
  const [roomName, setRoomName] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Validation state
  const [roomNameTouched, setRoomNameTouched] = useState(false);
  const [roomNameError, setRoomNameError] = useState('');
  
  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadCriticalData();
    const deferredTimer = setTimeout(loadDeferredData, 1000);

    // Refresh data when user returns to the dashboard tab (e.g., after ending a meeting)
    const handleFocus = () => {
      if (mountedRef.current) {
        loadCriticalData();
        loadDeferredData();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      clearTimeout(deferredTimer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Validate room name
  useEffect(() => {
    if (roomNameTouched) {
      setRoomNameError(getRoomNameError(roomName));
    }
  }, [roomName, roomNameTouched]);

  // Lightweight room + stats reload (for after create/delete)
  const reloadRooms = useCallback(async () => {
    try {
      const response = await getMyRooms();
      if (!mountedRef.current) return;
      setRooms(response?.data?.rooms || []);
      // Also refresh stats after room changes
      if (mountedRef.current) loadDeferredData();
    } catch (err) {
      logger.error('Failed to reload rooms:', err);
    }
  // loadDeferredData is stable enough (only closes over state setters + mountedRef)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Critical data - loads immediately
  const loadCriticalData = async () => {
    setLoadingRooms(true);
    try {
      const response = await getMyRooms();
      if (!mountedRef.current) return;
      setRooms(response?.data?.rooms || []);
    } catch (err) {
      logger.error('Failed to load rooms:', err);
    } finally {
      if (mountedRef.current) setLoadingRooms(false);
    }
  };

  // Deferred data - loads after 1s delay
  const loadDeferredData = async () => {
    if (!mountedRef.current) return;
    setLoadingStats(true);
    setUpcomingLoaded(false);
    
    try {
      const [statsRes, scheduledRes] = await Promise.all([
        meetingsApi.getStats(),
        meetingsApi.getScheduled(),
      ]);

      if (!mountedRef.current) return;

      const s = statsRes?.data?.stats;
      const scheduled = scheduledRes?.data?.meetings || [];

      const newStats: StatItem[] = [
        {
          label: 'Total Meetings',
          value: s?.totalMeetings ?? 0,
          icon: Video,
          color: 'brand',
          primary: true,
        },
        {
          label: 'Participants',
          value: s?.totalParticipants ?? 0,
          icon: Users,
          color: 'info',
        },
        {
          label: 'Minutes',
          value: s?.totalMinutes ?? 0,
          icon: Clock,
          color: 'success',
        },
        {
          label: 'This Week',
          value: s?.thisWeek ?? 0,
          icon: Calendar,
          color: 'warning',
        },
      ];

      if (mountedRef.current) {
        setStats(newStats);
        setUpcomingMeetings(scheduled);
        setUpcomingLoaded(true);
      }
    } catch (err) {
      logger.error('Failed to load deferred data:', err);
    } finally {
      if (mountedRef.current) {
        setLoadingStats(false);
      }
    }
  };

  // Reload all data (rooms + stats) — used after create/delete and on focus
  const reloadAll = useCallback(async () => {
    if (!mountedRef.current) return;
    await loadCriticalData();
    if (mountedRef.current) await loadDeferredData();
  }, []);

  void reloadAll;

  // Start instant meeting
  const handleStartMeeting = useCallback(async () => {
    try {
      const name = generateRoomName();
      const response = await createRoom({
        name,
        title: `Instant Meeting`,
      });
      if (response?.data?.room) {
        navigate(`/join/${response.data.room.name}`);
      }
    } catch (err) {
      logger.error('Failed to start meeting:', err);
      toast.error('Failed to start meeting');
    }
  }, [navigate]);

  // Create room
  const handleCreateRoom = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating || roomNameError || !roomName.trim()) return;
    
    setCreating(true);
    try {
      const response = await createRoom({
        name: roomName,
        title: roomTitle || undefined,
        password: meetingPassword || undefined,
      });
      
      if (response?.data?.room) {
        toast.success(`Room "${roomTitle || roomName}" created!`);
        setShowCreateModal(false);
        setRoomName('');
        setRoomTitle('');
        setMeetingPassword('');
        setShowPassword(false);
        setRoomNameTouched(false);
        reloadRooms();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create room';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }, [creating, roomName, roomTitle, meetingPassword, roomNameError, reloadRooms]);

  // Delete room
  const handleDeleteRoom = useCallback(async (roomName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Delete this room? This cannot be undone.')) return;
    
    try {
      await roomsApi.delete(roomName);
      toast.success('Room deleted');
      reloadRooms();
    } catch (err) {
      logger.error('Failed to delete room:', err);
      toast.error('Failed to delete room');
    }
  }, [reloadRooms]);

  // Copy room link
  const handleCopyLink = useCallback(async (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = `${window.location.origin}/join/${name}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    
    setCopied(name);
    toast.success('Link copied!');
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(null), 2000);
  }, []);

  // Calendar meeting click
  // Close modal on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal) {
        setShowCreateModal(false);
        setRoomName('');
        setRoomTitle('');
        setRoomNameTouched(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showCreateModal]);

  // Greeting
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const todayFormatted = useMemo(() => format(new Date(), 'EEEE, MMMM d, yyyy'), []);

  // Memoize sorted upcoming meetings (top 5)
  const sortedUpcomingMeetings = useMemo(() => {
    return [...upcomingMeetings]
      .sort((a, b) => {
        const aDate = new Date(a.scheduledStart || a.scheduled_start || 0).getTime();
        const bDate = new Date(b.scheduledStart || b.scheduled_start || 0).getTime();
        return aDate - bDate;
      })
      .slice(0, 5);
  }, [upcomingMeetings]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Hero: Greeting + Primary Actions */}
      <section className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-700 dark:to-brand-800 p-6 sm:p-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-brand-100 text-sm">
              {todayFormatted}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleStartMeeting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-brand-600 font-semibold hover:bg-brand-50 transition shadow-sm"
            >
              <Video size={18} aria-hidden="true" />
              <span>Start Meeting</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/15 text-white font-medium hover:bg-white/25 transition border border-white/20"
            >
              <Plus size={18} aria-hidden="true" />
              <span>Create Room</span>
            </button>
          </div>
        </div>

        {/* Compact inline stats */}
        {!loadingStats && stats.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="flex items-center gap-1.5 text-brand-100">
                  <Icon size={14} />
                  <span className="font-semibold text-white">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</span>
                  <span>{stat.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Main content: Upcoming + Rooms side by side */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming Meetings */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
          <div className="flex items-center justify-between p-4 pb-0">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-brand-500" />
              <h2 className="text-base font-semibold text-surface-800 dark:text-white">
                Upcoming
              </h2>
            </div>
            <button
              onClick={() => navigate('/schedule')}
              className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 transition"
            >
              Schedule
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="p-4">
            {!upcomingLoaded ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <MeetingCardSkeleton key={i} />
                ))}
              </div>
            ) : upcomingMeetings.length === 0 ? (
              <div className="text-center py-6">
                <Calendar size={28} className="mx-auto text-surface-300 dark:text-surface-600 mb-2" />
                <p className="text-sm text-surface-500 dark:text-surface-400">No upcoming meetings</p>
                <button
                  onClick={() => navigate('/schedule')}
                  className="mt-2 text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 transition"
                >
                  Schedule one →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedUpcomingMeetings
                  .map((meeting) => (
                    <UpcomingMeetingCard key={meeting.id} meeting={meeting} />
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Your Rooms */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
          <div className="flex items-center justify-between p-4 pb-0">
            <div className="flex items-center gap-2">
              <LayoutGrid size={18} className="text-brand-500" />
              <h2 className="text-base font-semibold text-surface-800 dark:text-white">
                Your Rooms
              </h2>
              {!loadingRooms && rooms.length > 0 && (
                <span className="badge badge-default">{rooms.length}</span>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 transition"
            >
              <Plus size={14} />
              New
            </button>
          </div>

          <div className="p-4">
            {loadingRooms ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <MeetingCardSkeleton key={i} />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-6">
                <Video size={28} className="mx-auto text-surface-300 dark:text-surface-600 mb-2" />
                <p className="text-sm text-surface-500 dark:text-surface-400">No rooms yet</p>
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                  Create a room to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => navigate(`/join/${room.name}`)}
                    className="group flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700/50 transition cursor-pointer"
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      room.status === 'active'
                        ? 'bg-success-100 dark:bg-success-900/30 text-success-500'
                        : 'bg-surface-100 dark:bg-surface-700 text-surface-400'
                    )}>
                      <Video size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-surface-800 dark:text-white truncate">
                        {room.title || room.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                        <span className={cn(
                          'inline-flex items-center gap-1',
                          room.status === 'active' ? 'text-success-500' : ''
                        )}>
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            room.status === 'active' ? 'bg-success-500' : 'bg-surface-300 dark:bg-surface-600'
                          )} />
                          {room.status}
                        </span>
                        {room.maxParticipants && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Users size={10} />
                              {room.maxParticipants}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleCopyLink(room.name, e)}
                        className={cn(
                          'p-2.5 rounded-lg transition',
                          copied === room.name
                            ? 'text-success-500 bg-success-50 dark:bg-success-900/20'
                            : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 md:opacity-0 md:group-hover:opacity-100'
                        )}
                        aria-label="Copy room link"
                        title="Copy link"
                      >
                        {copied === room.name ? <Check size={16} /> : <LinkIcon size={16} />}
                      </button>
                      <button
                        onClick={(e) => handleDeleteRoom(room.name, e)}
                        className="p-2.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition md:opacity-0 md:group-hover:opacity-100"
                        aria-label="Delete room"
                        title="Delete room"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ArrowRight
                        size={14}
                        className="text-surface-300 dark:text-surface-600 group-hover:text-brand-500 transition"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setRoomName('');
              setRoomTitle('');
              setMeetingPassword('');
              setShowPassword(false);
              setRoomNameTouched(false);
            }
          }}
        >
          <div
            ref={modalRef}
            className="bg-white dark:bg-surface-800 rounded-xl shadow-xl max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-label="Create new room"
          >
            <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
                Create Room
              </h2>
              <button
                ref={closeButtonRef}
            onClick={() => {
              setShowCreateModal(false);
              setRoomName('');
              setRoomTitle('');
              setMeetingPassword('');
              setShowPassword(false);
              setRoomNameTouched(false);
            }}
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition"
            aria-label="Close"
              >
                <X size={18} className="text-surface-500" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="p-4 space-y-4">
              <div className="space-y-4">
                <div className="form-group">
                  <label htmlFor="roomName">
                    Room Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    id="roomName"
                    type="text"
                    value={roomName}
                    onChange={(e) => {
                      setRoomName(normalizeRoomNameInput(e.target.value));
                      if (!roomNameTouched) setRoomNameTouched(true);
                    }}
                    onBlur={() => setRoomNameTouched(true)}
                    placeholder="team-standup"
                    className={roomNameError}
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

                <div className="form-group">
                  <label htmlFor="meetingPassword" className="flex items-center gap-2">
                    <Lock size={14} className="text-surface-400" />
                    Password <span className="text-surface-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="meetingPassword"
                      type={showPassword ? "text" : "password"}
                      value={meetingPassword}
                      onChange={(e) => setMeetingPassword(e.target.value)}
                      placeholder="Leave empty for no password"
                      maxLength={255}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="form-hint">Protect your meeting with a password</p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setRoomName('');
                    setRoomTitle('');
                    setMeetingPassword('');
                    setShowPassword(false);
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
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); }, []);
  
  const scheduledStart = meeting.scheduledStart || meeting.scheduled_start;
  const roomName = meeting.roomName || meeting.room_name;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const meetingUrl = `${window.location.origin}/join/${roomName}`;
    
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      toast.success('Meeting link copied!');
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = meetingUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success('Meeting link copied!');
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
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
        <Link to={`/join/${roomName}`}
          className="btn-primary btn-sm"
        >
          <Video size={14} />
          <span>Start</span>
        </Link>
      </div>
    </div>
  );
}
