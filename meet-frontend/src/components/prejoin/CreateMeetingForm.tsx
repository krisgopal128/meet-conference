/**
 * CreateMeetingForm - Title, room code, password, waiting room for moderators
 * 
 * Extracted from PreJoinPage.tsx to reduce component complexity.
 */

import { Edit3, Video, Lock, RefreshCw, Copy, Users, VideoOff } from 'lucide-react';

interface CreateMeetingFormProps {
  meetingTitle: string;
  meetingRoomCode: string;
  meetingPassword: string;
  showPassword: boolean;
  waitingRoomEnabled: boolean;
  onTitleChange: (title: string) => void;
  onRoomCodeChange: (code: string) => void;
  onPasswordChange: (password: string) => void;
  onShowPasswordToggle: () => void;
  onWaitingRoomChange: (enabled: boolean) => void;
  onGenerateRoomCode: () => void;
  onCopyRoomCode: () => void;
}

export function CreateMeetingForm({
  meetingTitle,
  meetingRoomCode,
  meetingPassword,
  showPassword,
  waitingRoomEnabled,
  onTitleChange,
  onRoomCodeChange,
  onPasswordChange,
  onShowPasswordToggle,
  onWaitingRoomChange,
  onGenerateRoomCode,
  onCopyRoomCode,
}: CreateMeetingFormProps) {
  return (
    <div className="space-y-4 mb-6">
      <div>
        <label htmlFor="meetingTitle" className="flex items-center gap-2">
          <Edit3 size={14} className="text-surface-400" />
          Meeting Title
        </label>
        <input 
          id="meetingTitle"
          value={meetingTitle} 
          onChange={e => onTitleChange(e.target.value)}
          placeholder="e.g., Team Standup" 
          className="mt-1"
        />
      </div>

      <div>
        <label htmlFor="meetingRoomCode" className="flex items-center gap-2">
          <Video size={14} className="text-surface-400" />
          Room Code
        </label>
        <div className="flex gap-2 mt-1">
          <input 
            id="meetingRoomCode"
            value={meetingRoomCode} 
            onChange={e => onRoomCodeChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="room-code" 
            className="font-mono flex-1"
          />
          <button
            type="button"
            onClick={onGenerateRoomCode}
            className="btn-secondary btn-icon"
            title="Generate new code"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={onCopyRoomCode}
            className="btn-secondary btn-icon"
            title="Copy code"
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="text-xs text-surface-400 mt-1">Share this code with participants</p>
      </div>

      <div>
        <label htmlFor="meetingPassword" className="flex items-center gap-2">
          <Lock size={14} className="text-surface-400" />
          Password <span className="text-surface-400 font-normal">(optional)</span>
        </label>
        <div className="relative mt-1">
          <input 
            id="meetingPassword"
            type={showPassword ? "text" : "password"}
            value={meetingPassword} 
            onChange={e => onPasswordChange(e.target.value)}
            placeholder="Leave empty for no password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={onShowPasswordToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
          >
            {showPassword ? <VideoOff size={16} /> : <Video size={16} />}
          </button>
        </div>
        <p className="text-xs text-surface-400 mt-1">Protect your meeting with a password</p>
      </div>

      <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-surface-700 dark:text-surface-200 flex items-center gap-2">
            <Users size={14} />
            Waiting Room
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400">Participants wait until you admit them</p>
        </div>
        <input
          type="checkbox"
          checked={waitingRoomEnabled}
          onChange={(event) => onWaitingRoomChange(event.target.checked)}
          className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
        />
      </label>
    </div>
  );
}
