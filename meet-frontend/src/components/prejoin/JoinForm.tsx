/**
 * JoinForm - Display name, password, and join button for guests
 * 
 * Extracted from PreJoinPage.tsx to reduce component complexity.
 */

import { User, Lock, Check, ArrowRight } from 'lucide-react';
import type { Room } from '../../types';

interface JoinFormProps {
  showGuestFields: boolean;
  showModeratorLinkPrompt?: boolean;
  isCreateMode: boolean;
  displayName: string;
  password: string;
  room: Room | null;
  loading: boolean;
  creatingRoom: boolean;
  disabled?: boolean;
  willJoinAsModerator?: boolean;
  onDisplayNameChange: (name: string) => void;
  onPasswordChange: (password: string) => void;
  onJoin: () => void;
}

export function JoinForm({
  showGuestFields,
  showModeratorLinkPrompt = false,
  isCreateMode,
  displayName,
  password,
  room,
  loading,
  creatingRoom,
  disabled = false,
  willJoinAsModerator = false,
  onDisplayNameChange,
  onPasswordChange,
  onJoin,
}: JoinFormProps) {
  return (
    <>
      {showModeratorLinkPrompt && (
        <div className="p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg mb-4">
          <p className="text-sm text-warning-700 dark:text-warning-300">
            This is a moderator link. Please sign in to continue as moderator, or you can join as a guest below.
          </p>
        </div>
      )}

      {showGuestFields ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="displayName">Your Name</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input 
                id="displayName"
                value={displayName} 
                onChange={e => onDisplayNameChange(e.target.value)}
                placeholder="Enter your name" 
                required
                className="pl-10" 
              />
            </div>
          </div>
          {room && (
            <div>
              <label htmlFor="password">Room Password (if required)</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input 
                  id="password"
                  type="password" 
                  value={password} 
                  onChange={e => onPasswordChange(e.target.value)}
                  placeholder="Enter password"
                  className="pl-10" 
                />
              </div>
            </div>
          )}
        </div>
      ) : !isCreateMode && (
        <div className="flex items-center gap-3 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
          <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center">
            <Check size={20} className="text-white" />
          </div>
          <div>
            <p className="font-medium text-surface-800 dark:text-white">Signed in</p>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {willJoinAsModerator
                ? "You'll join as a moderator"
                : "You'll join as a participant"}
            </p>
          </div>
        </div>
      )}

      <button 
        onClick={onJoin} 
        disabled={disabled || loading || creatingRoom || (showGuestFields && !displayName.trim())}
        className="btn-primary w-full mt-6"
      >
        {creatingRoom ? (
          <span>Creating Room...</span>
        ) : loading ? (
          <span>{isCreateMode ? 'Starting...' : 'Joining...'}</span>
        ) : (
          <>
            <span>{isCreateMode ? 'Start Meeting' : 'Join Now'}</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </>
  );
}
