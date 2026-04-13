import React from 'react';
import { sanitizeDisplayText } from '../../utils/security';

// Mention parsing utilities
export function parseMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_\-.\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\s]+?)(?=\s|$|@|[.,!?;:])/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].trim());
  }
  return mentions;
}

export function renderMessageWithMentions(text: string): React.ReactNode {
  // Security: Sanitize text to prevent XSS (defense in depth with React's escaping)
  const sanitized = sanitizeDisplayText(text, 5000);
  
  const mentionRegex = /@([a-zA-Z0-9_\-.\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\s]+?)(?=\s|$|@|[.,!?;:])/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = mentionRegex.exec(sanitized)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(sanitized.slice(lastIndex, match.index));
    }
    // Add highlighted mention
    parts.push(
      <span key={key++} className="bg-brand-500/30 text-brand-200 px-1 rounded">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < sanitized.length) {
    parts.push(sanitized.slice(lastIndex));
  }

  return parts.length > 0 ? parts : sanitized;
}

// Type for mentionable participants
export interface MentionableParticipant {
  identity: string;
  name: string;
  role: string;
  isModerator: boolean;
}
