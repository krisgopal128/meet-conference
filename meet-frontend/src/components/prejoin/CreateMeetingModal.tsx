/**
 * CreateMeetingModal - Modal form for scheduling meetings
 * 
 * Extracted from SchedulePage.tsx to reduce component complexity.
 */

import { X, Calendar, Globe, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { RecurrenceConfig, RecurrenceType } from '../../pages/SchedulePage';

interface CreateMeetingModalProps {
  show: boolean;
  onClose: () => void;
  formData: {
    title: string;
    description: string;
    scheduledStart: string;
    scheduledEnd: string;
  };
  selectedTimezone: string;
  recurrence: RecurrenceConfig;
  submitting: boolean;
  error: string;
  titleError: string;
  titleTouched: boolean;
  startError: string;
  startTouched: boolean;
  minDateTime: string;
  isFormValid: boolean;
  timezoneOptions: Array<{ value: string; label: string; offset: string }>;
  recurrenceOptions: Array<{ value: RecurrenceType; label: string; description: string }>;
  onFormDataChange: (data: CreateMeetingModalProps['formData']) => void;
  onTimezoneChange: (tz: string) => void;
  onRecurrenceChange: (recurrence: RecurrenceConfig) => void;
  onTitleBlur: () => void;
  onStartBlur: () => void;
  onSubmit: (e: React.FormEvent) => void;
  modalRef: React.RefObject<HTMLDivElement>;
  closeRef: React.RefObject<HTMLButtonElement>;
  handleModalKeyDown: (e: React.KeyboardEvent, closeModal: () => void) => void;
  getTimezoneAbbreviation: (tz: string) => string;
}

export function CreateMeetingModal({
  show,
  onClose,
  formData,
  selectedTimezone,
  recurrence,
  submitting,
  error,
  titleError,
  titleTouched,
  startError,
  startTouched,
  minDateTime,
  isFormValid,
  timezoneOptions,
  recurrenceOptions,
  onFormDataChange,
  onTimezoneChange,
  onRecurrenceChange,
  onTitleBlur,
  onStartBlur,
  onSubmit,
  modalRef,
  closeRef,
  handleModalKeyDown,
  getTimezoneAbbreviation,
}: CreateMeetingModalProps) {
  if (!show) return null;

  return (
    <div 
      className="modal-overlay" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="create-modal-title"
      onKeyDown={(e) => handleModalKeyDown(e, onClose)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        className="modal-content modal-lg max-h-[90vh] overflow-y-auto"
        tabIndex={-1}
      >
        <div className="modal-header sticky top-0 bg-white dark:bg-surface-800 z-10">
          <h2 id="create-modal-title" className="font-display font-semibold text-lg text-surface-800 dark:text-white">
            Schedule Meeting
          </h2>
          <button
            ref={closeRef}
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

            <div className="form-group">
              <label htmlFor="title">Meeting Title *</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
                onBlur={onTitleBlur}
                placeholder="Team standup"
                className={cn(
                  titleError && 'input-error',
                  titleTouched && !titleError && 'input-success'
                )}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? 'title-error' : undefined}
                autoFocus
              />
              {titleError ? (
                <p id="title-error" className="form-error">
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

            <div className="form-group">
              <label htmlFor="description">
                Description <span className="text-surface-400">(optional)</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Discuss project updates and next steps..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="timezone" className="flex items-center gap-2">
                <Globe size={14} aria-hidden="true" />
                Timezone
              </label>
              <select
                id="timezone"
                value={selectedTimezone}
                onChange={(e) => onTimezoneChange(e.target.value)}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="startTime">Start Time *</label>
                <input
                  id="startTime"
                  type="datetime-local"
                  value={formData.scheduledStart}
                  onChange={(e) => onFormDataChange({ ...formData, scheduledStart: e.target.value })}
                  onBlur={onStartBlur}
                  min={minDateTime}
                  className={cn(
                    startError && 'input-error',
                    startTouched && !startError && 'input-success'
                  )}
                  aria-invalid={!!startError}
                  aria-describedby={startError ? 'start-error' : undefined}
                />
                {startError && (
                  <p id="start-error" className="form-error">
                    <AlertCircle size={14} aria-hidden="true" />
                    {startError}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="endTime">
                  End Time <span className="text-surface-400">(optional)</span>
                </label>
                <input
                  id="endTime"
                  type="datetime-local"
                  value={formData.scheduledEnd}
                  onChange={(e) => onFormDataChange({ ...formData, scheduledEnd: e.target.value })}
                  min={formData.scheduledStart || minDateTime}
                />
                <p className="form-hint">Default is 1 hour</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="recurrence" className="flex items-center gap-2">
                <RefreshCw size={14} aria-hidden="true" />
                Repeat
              </label>
              <select
                id="recurrence"
                value={recurrence.type}
                onChange={(e) => onRecurrenceChange({ ...recurrence, type: e.target.value as RecurrenceType })}
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

            {recurrence.type !== 'none' && (
              <div className="form-group">
                <label htmlFor="recurrenceEnd">
                  End Date <span className="text-surface-400">(optional)</span>
                </label>
                <input
                  id="recurrenceEnd"
                  type="date"
                  value={recurrence.endDate || ''}
                  onChange={(e) => onRecurrenceChange({ ...recurrence, endDate: e.target.value })}
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
                  Scheduling...
                </span>
              ) : (
                <>
                  <Calendar size={18} aria-hidden="true" />
                  <span>Schedule</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
