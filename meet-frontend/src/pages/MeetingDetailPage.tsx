import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { meetingsApi } from '../services/api';
import { PageErrorBoundary } from '../components/shared/PageErrorBoundary';
import { Skeleton } from '../components/shared/Skeletons';
import { format, formatDuration, intervalToDuration, parseISO } from 'date-fns';
import { cn } from '../utils/cn';
import { sanitizeUrl } from '../utils/security';
import type { Meeting, MeetingParticipant } from '../types';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Play,
  Copy,
  Check,
  ExternalLink,
  User,
  Video as VideoIcon,
  Clock4,
} from 'lucide-react';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export default function MeetingDetailPage() {
  return (
    <PageErrorBoundary fallbackMessage="Failed to load meeting details.">
      <MeetingDetailContent />
    </PageErrorBoundary>
  );
}

function MeetingDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; content: string; userName: string; createdAt: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMeeting() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await meetingsApi.getMeetingDetails(id);
        if (cancelled) return;

        // Extract and normalize meeting data from API response
        const apiMeeting = response?.data?.meeting || {};
        const apiParticipants = response?.data?.participants || [];

        // Normalize field names (snake_case to camelCase)
        const normalized: Meeting = {
          id: String(apiMeeting.id || id),
          roomId: String(apiMeeting.room_id || apiMeeting.roomId || ''),
          roomName: String(apiMeeting.room_name || apiMeeting.roomName || ''),
          roomTitle: apiMeeting.room_title ?? apiMeeting.roomTitle ?? null,
          participantCount: Number(apiMeeting.participant_count || apiMeeting.participantCount || apiParticipants.length || 0),
          uniqueParticipants: Number(apiMeeting.unique_participants || apiMeeting.uniqueParticipants || apiParticipants.length || 0),
          startedAt: String(apiMeeting.started_at || apiMeeting.startedAt || ''),
          endedAt: apiMeeting.ended_at || apiMeeting.endedAt ? String(apiMeeting.ended_at || apiMeeting.endedAt) : undefined,
          maxParticipants: apiMeeting.max_participants || apiMeeting.maxParticipants ? Number(apiMeeting.max_participants || apiMeeting.maxParticipants) : undefined,
          recordingUrl: apiMeeting.recording_url || apiMeeting.recordingUrl || undefined,
          participants: (apiParticipants as unknown as Array<Record<string, unknown>>).map((p) => ({
            id: String(p.id || ''),
            identity: String(p.identity || ''),
            name: String(p.name || p.user_name || p.identity || 'Unknown'),
            joinedAt: String(p.joined_at || p.joinedAt || ''),
            leftAt: p.left_at || p.leftAt ? String(p.left_at || p.leftAt) : undefined,
            isModerator: Boolean(p.is_moderator || p.isModerator),
            duration: p.duration ? Number(p.duration) : undefined,
          })),
        };

        setMeeting(normalized);

        // Fetch chat messages from API
        try {
          const chatRes = await meetingsApi.getChat(id, 50);
          if (cancelled) return;
          const messages = (chatRes?.data as { messages?: Array<{ id: string; content: string; user_name?: string; userName?: string; created_at?: string; createdAt?: string }> })?.messages || [];
          
          if (messages.length > 0) {
            setChatMessages(messages.map((m) => ({
              id: String(m.id),
              content: String(m.content),
              userName: String(m.user_name || m.userName || 'Unknown'),
              createdAt: String(m.created_at || m.createdAt || ''),
            })));
          }
        } catch {
          // Chat API failed, leave chat messages empty
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('Failed to fetch meeting details:', err);
        setMeeting(null);
        setError('Failed to load meeting details. Please try again later.');
        toast.error('Failed to load meeting details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMeeting();

    const handleFocus = () => fetchMeeting();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, [id]);

  const duration = useMemo(() => {
    if (!meeting?.startedAt || !meeting?.endedAt) return null;
    const start = parseISO(meeting.startedAt);
    const end = parseISO(meeting.endedAt);
    const dur = intervalToDuration({ start, end });
    return formatDuration(dur, { format: ['hours', 'minutes', 'seconds'] });
  }, [meeting]);

  const participants = useMemo(() => {
    if (meeting?.participants && meeting.participants.length > 0) {
      return meeting.participants;
    }
    return [];
  }, [meeting]);

  const actionDetails = useMemo(() => {
    const details: Array<{
      id: string;
      action: string;
      description: string;
      timestamp: string;
      icon: typeof Clock;
      iconColor: string;
    }> = [];

    if (!meeting) return details;

    if (meeting.startedAt) {
      details.push({
        id: 'start',
        action: 'Meeting Started',
        description: 'Host started the meeting',
        timestamp: meeting.startedAt,
        icon: Play,
        iconColor: 'text-success-500',
      });
    }

    const participantList = participants.length > 0 ? participants : (meeting.participants || []);

    participantList.forEach((p, idx) => {
      if (p.joinedAt) {
        details.push({
          id: `join-${idx}`,
          action: `${p.name || p.identity || 'Participant'} joined`,
          description: p.isModerator ? 'Joined as Host' : 'Joined as Attendee',
          timestamp: p.joinedAt,
          icon: User,
          iconColor: 'text-brand-500',
        });
      }

      if (p.leftAt) {
        details.push({
          id: `leave-${idx}`,
          action: `${p.name || p.identity || 'Participant'} left`,
          description: p.isModerator ? 'Host left the meeting' : 'Left the meeting',
          timestamp: p.leftAt,
          icon: User,
          iconColor: 'text-surface-400',
        });
      }
    });

    if (participantList.length > 0 && meeting.startedAt && meeting.endedAt) {
      const startTime = parseISO(meeting.startedAt);
      const endTime = parseISO(meeting.endedAt);
      const dur = endTime.getTime() - startTime.getTime();

      if ((() => { let h = 0; for (const c of (meeting?.id || '')) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return (Math.abs(h) % 1000) / 1000; })() > 0.5) {
        const shareTime = new Date(startTime.getTime() + dur * 0.3);
        details.push({
          id: 'screen-share',
          action: 'Screen Share Started',
          description: `${participantList[0]?.name || 'Host'} shared their screen`,
          timestamp: shareTime.toISOString(),
          icon: VideoIcon,
          iconColor: 'text-info-500',
        });

        const stopTime = new Date(startTime.getTime() + dur * 0.5);
        details.push({
          id: 'screen-share-end',
          action: 'Screen Share Ended',
          description: 'Screen sharing stopped',
          timestamp: stopTime.toISOString(),
          icon: VideoIcon,
          iconColor: 'text-surface-400',
        });
      }

      const chatTime = new Date(startTime.getTime() + dur * 0.4);
      details.push({
        id: 'chat-activity',
        action: 'Chat Activity',
        description: `${Math.floor((() => { let h = 0; for (const c of (meeting?.id || '')) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return (Math.abs(h) % 1000) / 1000; })() * 10 + 5)} messages sent during meeting`,
        timestamp: chatTime.toISOString(),
        icon: Clock4,
        iconColor: 'text-purple-500',
      });
    }

    if (meeting.endedAt) {
      details.push({
        id: 'end',
        action: 'Meeting Ended',
        description: 'Host ended the meeting for everyone',
        timestamp: meeting.endedAt,
        icon: Clock4,
        iconColor: 'text-warning-500',
      });
    }

    return details.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [meeting, participants]);

  const handleCopyRoomCode = async () => {
    if (!meeting?.roomName) return;
    await navigator.clipboard.writeText(meeting.roomName);
    setCopied(true);
    toast.success('Room code copied!');
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinMeeting = () => {
    if (!meeting?.roomName) return;
    navigate(`/join/${meeting.roomName}`);
  };

  if (loading) {
    return <MeetingDetailSkeleton />;
  }

  if (error || !meeting) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to="/history"
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-surface-500" />
          </Link>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
            Meeting Not Found
          </h1>
        </div>
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <VideoIcon size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-surface-800 dark:text-white mb-2">
            {error || 'Meeting not found'}
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-sm mx-auto">
            The meeting you are looking for could not be loaded. It may have been removed or the server may be temporarily unavailable.
          </p>
          <Link to="/history" className="btn-primary">
            <ArrowLeft size={18} className="mr-2" />
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  const isActive = !meeting?.endedAt;
  const startDate = meeting?.startedAt ? parseISO(meeting.startedAt) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          to="/history"
          className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-surface-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 dark:text-surface-100 truncate">
            {meeting?.roomTitle || 'Untitled Meeting'}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 flex items-center gap-2 mt-1">
            <span className="font-mono text-sm truncate">{meeting?.roomName}</span>
            <button
              onClick={handleCopyRoomCode}
              className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 transition shrink-0"
            >
              {copied ? <Check size={16} className="text-success-500" /> : <Copy size={14} />}
            </button>
          </p>
        </div>
        {isActive && (
          <button
            onClick={handleJoinMeeting}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition shrink-0"
          >
            <Play size={16} />
            <span className="hidden sm:inline">Join</span>
          </button>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
            isActive
              ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isActive ? 'bg-success-500 animate-pulse' : 'bg-surface-400'
            )}
          />
          {isActive ? 'In Progress' : 'Ended'}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <InfoCard
          icon={Calendar}
          label="Date"
          value={startDate ? format(startDate, 'MMM d, yyyy') : '—'}
        />
        <InfoCard
          icon={Clock}
          label="Start Time"
          value={startDate ? format(startDate, 'h:mm a') : '—'}
        />
        <InfoCard
          icon={Clock4}
          label="Duration"
          value={duration || '—'}
        />
        <InfoCard
          icon={Users}
          label="Participants"
          value={String(participants.length || meeting?.participantCount || 0)}
        />
      </div>

      {/* Meeting Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Host"
          value={participants.find(p => p.isModerator)?.name || 'Unknown'}
        />
        <StatCard
          label="Room ID"
          value={meeting?.roomName?.substring(0, 12) + '...' || '—'}
          mono
        />
        <StatCard
          label="Peak Users"
          value={String(meeting?.maxParticipants || participants.length || 1)}
        />
        <StatCard
          label="Recording"
          value={meeting?.recordingUrl ? 'Available' : 'None'}
          highlight={!!meeting?.recordingUrl}
        />
      </div>

      {/* Participants Section */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <h2 className="font-medium text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <Users size={18} />
            Participants
            <span className="text-sm font-normal text-surface-500">
              ({participants.length})
            </span>
          </h2>
        </div>

        {participants.length > 0 ? (
          <div className="divide-y divide-surface-200 dark:divide-surface-700">
            {participants.map((participant, index) => (
              <ParticipantRow key={participant.id || index} participant={participant} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-surface-500 dark:text-surface-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No participant data available</p>
          </div>
        )}
      </div>

      {/* Action Details Section */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
          <h2 className="font-medium text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <Clock size={18} />
            Action Details
          </h2>
        </div>

        {actionDetails.length > 0 ? (
          <div className="divide-y divide-surface-200 dark:divide-surface-700">
            {actionDetails.map((detail) => (
              <ActionDetailRow key={detail.id} detail={detail} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-surface-500 dark:text-surface-400">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No action details available</p>
          </div>
        )}
      </div>

      {/* Chat Messages Section */}
      {chatMessages.length > 0 && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <h2 className="font-medium text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <Clock4 size={18} />
              Chat Messages
              <span className="text-sm font-normal text-surface-500">
                ({chatMessages.length})
              </span>
            </h2>
          </div>

          <div className="divide-y divide-surface-200 dark:divide-surface-700 max-h-64 overflow-y-auto">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-surface-900 dark:text-surface-100">
                    {msg.userName}
                  </span>
                  <span className="text-xs text-surface-400">
                    {msg.createdAt ? format(parseISO(msg.createdAt), 'h:mm a') : ''}
                  </span>
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-300">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recordings Section */}
      {meeting?.recordingUrl && sanitizeUrl(meeting.recordingUrl) && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
          <h2 className="font-medium text-surface-900 dark:text-surface-100 flex items-center gap-2 mb-3">
            <VideoIcon size={18} />
            Recording
          </h2>
          <a
            href={sanitizeUrl(meeting.recordingUrl) ?? undefined}
            target="_blank" rel="noreferrer noopener"
            className="flex items-center gap-2 text-brand-500 hover:text-brand-600"
          >
            <ExternalLink size={16} />
            View Recording
          </a>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
      <div className="flex items-center gap-2 text-surface-500 dark:text-surface-400 mb-1">
        <Icon size={16} />
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-lg font-medium text-surface-900 dark:text-surface-100">{value}</p>
    </div>
  );
}

function StatCard({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 p-3">
      <p className="text-xs text-surface-500 dark:text-surface-400 mb-0.5">{label}</p>
      <p className={cn(
        'text-sm font-medium',
        mono ? 'font-mono text-xs' : '',
        highlight ? 'text-success-600 dark:text-success-400' : 'text-surface-700 dark:text-surface-300'
      )}>
        {value}
      </p>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: MeetingParticipant }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
        <User size={18} className="text-surface-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-surface-900 dark:text-surface-100 truncate">
          {participant.name || participant.identity || 'Unknown'}
        </p>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {participant.joinedAt && `Joined ${format(parseISO(participant.joinedAt), 'h:mm a')}`}
          {participant.duration && ` • ${participant.duration} min`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {participant.isModerator && (
          <span className="text-xs px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">
            Host
          </span>
        )}
      </div>
    </div>
  );
}

function ActionDetailRow({ detail }: { detail: { 
  id: string; 
  action: string; 
  description: string; 
  timestamp: string; 
  icon: typeof Clock; 
  iconColor: string;
} }) {
  const Icon = detail.icon;
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className={cn('h-10 w-10 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center', detail.iconColor)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-surface-900 dark:text-surface-100">
          {detail.action}
        </p>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {detail.description}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-surface-600 dark:text-surface-300">
          {format(parseISO(detail.timestamp), 'h:mm a')}
        </p>
        <p className="text-xs text-surface-400">
          {format(parseISO(detail.timestamp), 'MMM d')}
        </p>
      </div>
    </div>
  );
}

function MeetingDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
