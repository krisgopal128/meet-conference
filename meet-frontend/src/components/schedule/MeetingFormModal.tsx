import { useEffect, useRef, memo } from 'react';
import { X, AlertCircle, Check, Calendar, Globe, RefreshCw } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ScheduledMeeting } from '../../types';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface MeetingFormData {
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface RecurrenceData {
  type: RecurrenceType;
  endDate?: string;
}

interface MeetingFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  meetingToEdit?: ScheduledMeeting | null;
  formData: MeetingFormData;
  setFormData: React.Dispatch<React.SetStateAction<MeetingFormData>>;
  selectedTimezone: string;
  setSelectedTimezone: (tz: string) => void;
  recurrence: RecurrenceData;
  setRecurrence: React.Dispatch<React.SetStateAction<RecurrenceData>>;
  error: string;
  titleError: string;
  titleTouched: boolean;
  setTitleTouched: (touched: boolean) => void;
  startError: string;
  startTouched: boolean;
  setStartTouched: (touched: boolean) => void;
  isFormValid: boolean;
  submitting: boolean;
  minDateTime: string;
  timezoneOptions: Array<{ value: string; label: string; offset: string }>;
  recurrenceOptions: Array<{ value: string; label: string; description: string }>;
  getTimezoneAbbreviation: (tz: string) => string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const MeetingFormModal = memo(function MeetingFormModal({
  isOpen,
  mode,
  formData,
  setFormData,
  selectedTimezone,
  setSelectedTimezone,
  recurrence,
  setRecurrence,
  error,
  titleError,
  titleTouched,
  setTitleTouched,
  startError,
  startTouched,
  setStartTouched,
  isFormValid,
  submitting,
  minDateTime,
  timezoneOptions,
  recurrenceOptions,
  getTimezoneAbbreviation,
  onClose,
  onSubmit,
}: MeetingFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const title = mode === 'create' ? 'Schedule Meeting' : 'Edit Meeting';
  const submitLabel = mode === 'create' ? 'Schedule' : 'Save Changes';
  const titleId = mode === 'create' ? 'create-modal-title' : 'edit-modal-title';
  const fieldPrefix = mode === 'create' ? '' : 'edit-';

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="modal-content modal-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto mx-2 sm:mx-0"
        tabIndex={-1}
      >
        <div className="modal-header sticky top-0 bg-white dark:bg-surface-800 z-10">
          <h2 id={titleId} className="font-display font-semibold text-lg text-surface-800 dark:text-white">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="modal-close"
            aria-label="Close modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="modal-body space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
                <p className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
                  <AlertCircle size={16} aria-hidden="true" />
                  {error}
                </p>
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label htmlFor={`${fieldPrefix}title`}>Meeting Title *</label>
              <input
                id={`${fieldPrefix}title`}
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onBlur={() => setTitleTouched(true)}
                placeholder="Team standup"
                className={cn(
                  titleError && 'input-error',
                  titleTouched && !titleError && 'input-success'
                )}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? `${fieldPrefix}title-error` : undefined}
                autoFocus
              />
              {titleError ? (
                <p id={`${fieldPrefix}title-error`} className="form-error">
                  <AlertCircle size={14} aria-hidden="true" />
                  {titleError}
                </p>
              ) : titleTouched && !titleError ? (
                <p className="form-success">
                  <Check size={14} aria-hidden="true" />
                  Looks good
                </p>
              ) : (
                <p className="form-hint">Give your meeting a descriptive name</p>
              )}
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor={`${fieldPrefix}description`}>
                Description <span className="text-surface-400">(optional)</span>
              </label>
              <textarea
                id={`${fieldPrefix}description`}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Discuss project updates and next steps..."
              />
            </div>

            {/* Timezone */}
            <div className="form-group">
              <label htmlFor={`${fieldPrefix}timezone`} className="flex items-center gap-2">
                <Globe size={14} aria-hidden="true" />
                Timezone
              </label>
              <select
                id={`${fieldPrefix}timezone`}
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="input"
              >
                {timezoneOptions.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label} ({tz.offset})
                  </option>
                ))}
              </select>
              <p className="form-hint">
                Selected: {getTimezoneAbbreviation(selectedTimezone)}
              </p>
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor={`${fieldPrefix}startTime`}>Start Time *</label>
                <input
                  id={`${fieldPrefix}startTime`}
                  type="datetime-local"
                  value={formData.scheduledStart}
                  onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                  onBlur={() => setStartTouched(true)}
                  min={minDateTime}
                  className={cn(
                    startError && 'input-error',
                    startTouched && !startError && 'input-success'
                  )}
                  aria-invalid={!!startError}
                  aria-describedby={startError ? `${fieldPrefix}start-error` : undefined}
                />
                {startError && (
                  <p id={`${fieldPrefix}start-error`} className="form-error">
                    <AlertCircle size={14} aria-hidden="true" />
                    {startError}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label htmlFor={`${fieldPrefix}endTime`}>
                  End Time <span className="text-surface-400">(optional)</span>
                </label>
                <input
                  id={`${fieldPrefix}endTime`}
                  type="datetime-local"
                  value={formData.scheduledEnd}
                  onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                  min={formData.scheduledStart || minDateTime}
                />
                <p className="form-hint">Default is 1 hour</p>
              </div>
            </div>

            {/* Recurrence */}
            <div className="form-group">
              <label htmlFor={`${fieldPrefix}recurrence`} className="flex items-center gap-2">
                <RefreshCw size={14} aria-hidden="true" />
                Repeat
              </label>
              <select
                id={`${fieldPrefix}recurrence`}
                value={recurrence.type}
                onChange={(e) => setRecurrence({ ...recurrence, type: e.target.value as RecurrenceType })}
                className="input"
              >
                {recurrenceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                {recurrenceOptions.find(o => o.value === recurrence.type)?.description}
              </p>
            </div>

            {/* Recurrence End */}
            {recurrence.type !== 'none' && (
              <div className="form-group">
                <label htmlFor={`${fieldPrefix}recurrenceEnd`}>
                  End Date <span className="text-surface-400">(optional)</span>
                </label>
                <input
                  id={`${fieldPrefix}recurrenceEnd`}
                  type="date"
                  value={recurrence.endDate || ''}
                  onChange={(e) => setRecurrence({ ...recurrence, endDate: e.target.value })}
                  min={formData.scheduledStart?.split('T')[0] || minDateTime.split('T')[0]}
                  className="input"
                />
                <p className="form-hint">
                  Creates up to 12 meetings if no end date is set
                </p>
              </div>
            )}
          </div>

          <div className="modal-footer sticky bottom-0 bg-white dark:bg-surface-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="btn-primary"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  {mode === 'create' ? 'Scheduling...' : 'Saving...'}
                </span>
              ) : (
                <>
                  <Calendar size={18} aria-hidden="true" />
                  <span>{submitLabel}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
