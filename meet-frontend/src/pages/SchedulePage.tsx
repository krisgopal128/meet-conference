import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { meetingsApi } from '../services/api';
import { PageErrorBoundary } from '../components/shared/PageErrorBoundary';
import { MeetingFormModal } from '../components/schedule/MeetingFormModal';
import { cn } from '../utils/cn';
import { getLocalTimezone, getCommonTimezones, getTimezoneAbbreviation } from '../utils/timezone';
import type { ScheduledMeeting } from '../types';
import { format } from 'date-fns';
import { Plus, Calendar, Clock, Video, Trash2, Play, X, Check, ArrowRight, Edit2, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceConfig {
  type: RecurrenceType;
  endDate?: string;
  occurrences?: number;
}

const recurrenceOptions: { value: RecurrenceType; label: string; description: string }[] = [
  { value: 'none', label: 'Does not repeat', description: 'One-time meeting' },
  { value: 'daily', label: 'Daily', description: 'Every day at the same time' },
  { value: 'weekly', label: 'Weekly', description: 'Every week on the same day' },
  { value: 'biweekly', label: 'Every 2 weeks', description: 'Every two weeks on the same day' },
  { value: 'monthly', label: 'Monthly', description: 'Every month on the same date' },
];

export default function SchedulePage() {
  return (
    <PageErrorBoundary fallbackMessage="Failed to load scheduled meetings.">
      <SchedulePageContent />
    </PageErrorBoundary>
  );
}

function SchedulePageContent() {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<ScheduledMeeting | null>(null);
  const [meetingToEdit, setMeetingToEdit] = useState<ScheduledMeeting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledStart: '',
    scheduledEnd: '',
  });
  const [selectedTimezone, setSelectedTimezone] = useState(getLocalTimezone());
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>({ type: 'none' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form validation
  const [titleTouched, setTitleTouched] = useState(false);
  const [startTouched, setStartTouched] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [startError, setStartError] = useState('');

  // Optimistic update tracking
  const [pendingCreations, setPendingCreations] = useState<ScheduledMeeting[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());

  // Modal refs
  const deleteModalRef = useRef<HTMLDivElement>(null);

  // Timezone options
  const timezoneOptions = useMemo(() => getCommonTimezones(), []);

  useEffect(() => {
    loadMeetings();
  }, []);

  // Validate title
  useEffect(() => {
    if (titleTouched) {
      if (!formData.title.trim()) {
        setTitleError('Title is required');
      } else if (formData.title.length > 100) {
        setTitleError('Title must be less than 100 characters');
      } else {
        setTitleError('');
      }
    }
  }, [formData.title, titleTouched]);

  // Validate start time
  useEffect(() => {
    if (startTouched) {
      if (!formData.scheduledStart) {
        setStartError('Start time is required');
      } else if (new Date(formData.scheduledStart) < new Date()) {
        setStartError('Start time must be in the future');
      } else {
        setStartError('');
      }
    }
  }, [formData.scheduledStart, startTouched]);

  const loadMeetings = async () => {
    try {
      const response = await meetingsApi.getScheduled();
      setMeetings(response?.data?.meetings || []);
    } catch (error) {
      logger.error('Failed to load meetings:', error);
      toast.error('Failed to load scheduled meetings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', scheduledStart: '', scheduledEnd: '' });
    setRecurrence({ type: 'none' });
    setSelectedTimezone(getLocalTimezone());
    setTitleTouched(false);
    setStartTouched(false);
    setTitleError('');
    setStartError('');
    setError('');
  };

  const openEditModal = (meeting: ScheduledMeeting) => {
    const startDate = new Date(meeting.scheduled_start || meeting.scheduledStart);
    const endDate = (meeting.scheduled_end || meeting.scheduledEnd) 
      ? new Date(meeting.scheduled_end || meeting.scheduledEnd!) 
      : null;
    
    setMeetingToEdit(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      scheduledStart: format(startDate, "yyyy-MM-dd'T'HH:mm"),
      scheduledEnd: endDate ? format(endDate, "yyyy-MM-dd'T'HH:mm") : '',
    });
    setSelectedTimezone(meeting.timezone || getLocalTimezone());
    setShowEditModal(true);
    setError('');
    setTitleTouched(false);
    setStartTouched(false);
  };

  // Generate recurring meeting instances
  const generateRecurringInstances = useCallback((baseMeeting: {
    title: string;
    description?: string;
    scheduledStart: string;
    scheduledEnd?: string;
  }, recurrenceConfig: RecurrenceConfig): Date[] => {
    const dates: Date[] = [new Date(baseMeeting.scheduledStart)];
    
    if (recurrenceConfig.type === 'none') return dates;
    
    const maxOccurrences = recurrenceConfig.occurrences || 12;
    const endDate = recurrenceConfig.endDate ? new Date(recurrenceConfig.endDate) : null;
    const start = new Date(baseMeeting.scheduledStart);
    
    for (let i = 1; i < maxOccurrences; i++) {
      let nextDate: Date;
      
      switch (recurrenceConfig.type) {
        case 'daily':
          nextDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          nextDate = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
          break;
        case 'biweekly':
          nextDate = new Date(start.getTime() + i * 14 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          nextDate = new Date(start);
          nextDate.setMonth(nextDate.getMonth() + i);
          break;
        default:
          return dates;
      }
      
      if (endDate && nextDate > endDate) break;
      dates.push(nextDate);
    }
    
    return dates;
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Touch all fields
    setTitleTouched(true);
    setStartTouched(true);
    
    if (titleError || startError || !formData.title.trim() || !formData.scheduledStart) {
      return;
    }

    setSubmitting(true);
    setError('');

    // Generate instances for recurring meetings
    const instances = generateRecurringInstances(formData, recurrence);
    const isRecurring = recurrence.type !== 'none';

    // Create optimistic meetings
    const optimisticMeetings: ScheduledMeeting[] = instances.map((date, index) => ({
      id: `temp-${Date.now()}-${index}`,
      roomName: `temp-room-${Date.now()}-${index}`,
      title: formData.title,
      description: formData.description,
      hostId: '',
      scheduledStart: date.toISOString(),
      scheduledEnd: formData.scheduledEnd ? new Date(formData.scheduledEnd).toISOString() : undefined,
      timezone: selectedTimezone,
      status: 'scheduled' as const,
    }));

    // Optimistic update - add to pending and show immediately
    setPendingCreations(prev => [...prev, ...optimisticMeetings]);

    try {
      // Create each instance
      const createPromises = instances.map((date) => 
        meetingsApi.schedule({
          title: formData.title,
          description: formData.description || undefined,
          scheduledStart: date.toISOString(),
          scheduledEnd: formData.scheduledEnd ? new Date(formData.scheduledEnd).toISOString() : undefined,
          timezone: selectedTimezone,
        })
      );

      await Promise.all(createPromises);

      toast.success(
        isRecurring 
          ? `Scheduled ${instances.length} recurring meetings`
          : 'Meeting scheduled successfully'
      );
      
      setShowCreateModal(false);
      resetForm();
      
      // Reload to get actual IDs
      loadMeetings();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to schedule meeting');
    } finally {
      setSubmitting(false);
      setPendingCreations([]);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    
    setDeleting(true);
    
    // Optimistic update
    setPendingDeletions(prev => new Set([...prev, meetingToDelete.id]));
    setShowDeleteModal(false);
    
    try {
      await meetingsApi.cancel(meetingToDelete.id);
      
      // Remove from local state
      setMeetings(meetings.filter(m => m.id !== meetingToDelete.id));
      setPendingCreations(prev => prev.filter(m => m.id !== meetingToDelete.id));
      
      toast.success('Meeting cancelled');
      setMeetingToDelete(null);
    } catch {
      // Rollback optimistic update
      setPendingDeletions(prev => {
        const next = new Set(prev);
        next.delete(meetingToDelete.id);
        return next;
      });
      
      toast.error('Failed to cancel meeting');
      // Restore modal
      setShowDeleteModal(true);
    } finally {
      setDeleting(false);
      setPendingDeletions(prev => {
        const next = new Set(prev);
        next.delete(meetingToDelete.id);
        return next;
      });
    }
  };

  const handleEditMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!meetingToEdit) return;
    
    // Touch all fields
    setTitleTouched(true);
    setStartTouched(true);
    
    if (titleError || startError || !formData.title.trim() || !formData.scheduledStart) {
      return;
    }

    setEditing(true);
    setError('');

    try {
      await meetingsApi.update(meetingToEdit.id, {
        title: formData.title,
        description: formData.description || undefined,
        scheduledStart: new Date(formData.scheduledStart).toISOString(),
        scheduledEnd: formData.scheduledEnd ? new Date(formData.scheduledEnd).toISOString() : undefined,
        timezone: selectedTimezone,
      });

      toast.success('Meeting updated successfully');
      setShowEditModal(false);
      setMeetingToEdit(null);
      resetForm();
      
      // Reload to get updated data
      loadMeetings();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to update meeting');
    } finally {
      setEditing(false);
    }
  };

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent, closeModal: () => void) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  }, []);

  const isFormValid = Boolean(formData.title.trim()) && Boolean(formData.scheduledStart) && !titleError && !startError;

  // Set minimum datetime to now
  const minDateTime = new Date().toISOString().slice(0, 16);

  // Combine real meetings with pending creations and filter out pending deletions
  const allMeetings = useMemo(() => {
    const combined = [...meetings, ...pendingCreations];
    return combined.filter(m => !pendingDeletions.has(m.id));
  }, [meetings, pendingCreations, pendingDeletions]);

  // Separate upcoming and past meetings
  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    return allMeetings
      .filter(m => new Date(m.scheduled_start || m.scheduledStart) >= now)
      .sort((a, b) => 
        new Date(a.scheduled_start || a.scheduledStart).getTime() - 
        new Date(b.scheduled_start || b.scheduledStart).getTime()
      );
  }, [allMeetings]);
  
  const pastMeetings = useMemo(() => {
    const now = new Date();
    return allMeetings.filter(m => new Date(m.scheduled_start || m.scheduledStart) < now);
  }, [allMeetings]);

  // Skeleton component
  const MeetingSkeleton = () => (
    <div className="card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="skeleton-text w-48 h-5" />
          <div className="skeleton-text w-full h-3" />
          <div className="flex gap-4">
            <div className="skeleton w-24 h-4" />
            <div className="skeleton w-20 h-4" />
            <div className="skeleton w-32 h-4" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="skeleton-button" />
          <div className="skeleton w-9 h-9 rounded-lg" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-surface-800 dark:text-white">
            Scheduled Meetings
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            Manage your upcoming meetings
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus size={18} aria-hidden="true" />
          <span>Schedule Meeting</span>
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="space-y-3">
          <MeetingSkeleton />
          <MeetingSkeleton />
          <MeetingSkeleton />
        </div>
      ) : allMeetings.length === 0 ? (
        /* Empty state */
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-surface-100 dark:bg-surface-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={28} className="text-surface-400" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-semibold text-surface-800 dark:text-white mb-2">
            No scheduled meetings
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-sm mx-auto">
            Schedule your first meeting to send invitations and set reminders
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus size={18} aria-hidden="true" />
            <span>Schedule Meeting</span>
          </button>
        </div>
      ) : (
        <>
          {/* Upcoming meetings */}
          {upcomingMeetings.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <h2 id="upcoming-heading" className="font-display font-semibold text-lg text-surface-800 dark:text-white mb-3">
                Upcoming ({upcomingMeetings.length})
              </h2>
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onEdit={(m) => openEditModal(m)}
                    onDelete={(m) => {
                      setMeetingToDelete(m);
                      setShowDeleteModal(true);
                    }}
                    isPending={meeting.id.startsWith('temp-')}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past meetings */}
          {pastMeetings.length > 0 && (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="font-display font-semibold text-lg text-surface-800 dark:text-white mb-3">
                Past ({pastMeetings.length})
              </h2>
              <div className="space-y-3">
                {pastMeetings.slice(0, 5).map((meeting) => (
                  <PastMeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Create Modal */}
      <MeetingFormModal
        isOpen={showCreateModal}
        mode="create"
        formData={formData}
        setFormData={setFormData}
        selectedTimezone={selectedTimezone}
        setSelectedTimezone={setSelectedTimezone}
        recurrence={recurrence}
        setRecurrence={setRecurrence}
        error={error}
        titleError={titleError}
        titleTouched={titleTouched}
        setTitleTouched={setTitleTouched}
        startError={startError}
        startTouched={startTouched}
        setStartTouched={setStartTouched}
        isFormValid={isFormValid}
        submitting={submitting}
        minDateTime={minDateTime}
        timezoneOptions={timezoneOptions}
        recurrenceOptions={recurrenceOptions}
        getTimezoneAbbreviation={getTimezoneAbbreviation}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        onSubmit={handleCreateMeeting}
      />

      {/* Edit Modal */}
      <MeetingFormModal
        isOpen={showEditModal}
        mode="edit"
        meetingToEdit={meetingToEdit}
        formData={formData}
        setFormData={setFormData}
        selectedTimezone={selectedTimezone}
        setSelectedTimezone={setSelectedTimezone}
        recurrence={recurrence}
        setRecurrence={setRecurrence}
        error={error}
        titleError={titleError}
        titleTouched={titleTouched}
        setTitleTouched={setTitleTouched}
        startError={startError}
        startTouched={startTouched}
        setStartTouched={setStartTouched}
        isFormValid={isFormValid}
        submitting={editing}
        minDateTime={minDateTime}
        timezoneOptions={timezoneOptions}
        recurrenceOptions={recurrenceOptions}
        getTimezoneAbbreviation={getTimezoneAbbreviation}
        onClose={() => {
          setShowEditModal(false);
          setMeetingToEdit(null);
          resetForm();
        }}
        onSubmit={handleEditMeeting}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && meetingToDelete && (
        <div 
          className="modal-overlay" 
          role="alertdialog" 
          aria-modal="true" 
          aria-labelledby="delete-modal-title"
          aria-describedby="delete-modal-desc"
          onKeyDown={(e) => handleModalKeyDown(e, () => {
            setShowDeleteModal(false);
            setMeetingToDelete(null);
          })}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
              setMeetingToDelete(null);
            }
          }}
        >
          <div ref={deleteModalRef} className="modal-content">
            <div className="modal-header">
              <h2 id="delete-modal-title" className="font-display font-semibold text-lg text-surface-800 dark:text-white">
                Cancel Meeting
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setMeetingToDelete(null);
                }}
                className="modal-close"
                aria-label="Close modal"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            
            <div className="modal-body">
              <p id="delete-modal-desc" className="text-surface-600 dark:text-surface-400">
                Are you sure you want to cancel <strong className="text-surface-800 dark:text-white">{meetingToDelete.title}</strong>? 
                This will remove the scheduled meeting.
              </p>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setMeetingToDelete(null);
                }}
                className="btn-secondary"
                disabled={deleting}
              >
                Keep Meeting
              </button>
              <button
                onClick={handleDeleteMeeting}
                disabled={deleting}
                className="btn-danger"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Cancelling...
                  </span>
                ) : (
                  <>
                    <Trash2 size={18} aria-hidden="true" />
                    <span>Cancel Meeting</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Meeting card component
const MeetingCard = memo(function MeetingCard({ 
  meeting, 
  onEdit,
  onDelete, 
  isPending 
}: { 
  meeting: ScheduledMeeting; 
  onEdit: (m: ScheduledMeeting) => void;
  onDelete: (m: ScheduledMeeting) => void;
  isPending?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const roomName = meeting.room_name || meeting.roomName;
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
    <article className={cn(
      "card-hover p-4",
      isPending && "opacity-70 animate-pulse"
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-surface-800 dark:text-white flex items-center gap-2">
            {meeting.title}
            {isPending && (
              <span className="text-xs px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                Creating...
              </span>
            )}
          </h3>
          {meeting.description && (
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
              {meeting.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-surface-500 dark:text-surface-400">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} aria-hidden="true" />
              <span>
                {format(new Date(meeting.scheduled_start || meeting.scheduledStart), 'EEE, MMM d')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} aria-hidden="true" />
              <span>
                {format(new Date(meeting.scheduled_start || meeting.scheduledStart), 'p')}
                {(meeting.scheduled_end || meeting.scheduledEnd) && (
                  <> - {format(new Date(meeting.scheduled_end || meeting.scheduledEnd!), 'p')}</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Video size={14} aria-hidden="true" />
              <span className="truncate max-w-[200px] font-mono text-xs">{meeting.room_name || meeting.roomName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/join/${meeting.room_name || meeting.roomName}`}
            className="btn-primary py-2.5"
          >
            <Play size={14} aria-hidden="true" />
            <span>Start</span>
          </a>
          <button
            onClick={handleShare}
            className={cn(
              "btn-ghost p-2.5",
              copied ? "text-success-500" : "text-surface-400 hover:text-brand-500"
            )}
            aria-label={`Share meeting link for ${meeting.title}`}
            disabled={isPending}
            title="Copy meeting link"
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
          </button>
          <button
            onClick={() => onEdit(meeting)}
            className="btn-ghost p-2.5 text-surface-400 hover:text-brand-500"
            aria-label={`Edit ${meeting.title}`}
            disabled={isPending}
          >
            <Edit2 size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => onDelete(meeting)}
            className="btn-ghost p-2.5 text-surface-400 hover:text-danger-500"
            aria-label={`Cancel ${meeting.title}`}
            disabled={isPending}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
});

// Past meeting card component
const PastMeetingCard = memo(function PastMeetingCard({ meeting }: { meeting: ScheduledMeeting }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const roomName = meeting.room_name || meeting.roomName;
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
    <article className="card p-4 opacity-60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-surface-700 dark:text-surface-300">
            {meeting.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 text-sm text-surface-400">
            <Calendar size={12} aria-hidden="true" />
            <span>
              {format(new Date(meeting.scheduled_start || meeting.scheduledStart), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className={cn(
              "btn-ghost p-2.5",
              copied ? "text-success-500" : "text-surface-400 hover:text-brand-500"
            )}
            aria-label={`Share meeting link for ${meeting.title}`}
            title="Copy meeting link"
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
          </button>
          <a
            href={`/join/${meeting.room_name || meeting.roomName}`}
            className="btn-secondary py-2.5"
          >
            <ArrowRight size={14} aria-hidden="true" />
            <span>Join Anyway</span>
          </a>
        </div>
      </div>
    </article>
  );
});
