import React from 'react';
import { sanitizeDisplayText } from '../../utils/security';

/** Cache for pre-formatted message content to avoid re-sanitizing on every render */
const formattedCache = new Map<string, { raw: string; formatted: React.ReactNode }>();
const MAX_CACHE_SIZE = 200;

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

/**
 * Build React nodes from a message string, sanitizing XSS and highlighting @mentions.
 * Results are cached by raw text so repeated renders of the same message skip work.
 */
export function renderMessageWithMentions(text: string): React.ReactNode {
  const cached = formattedCache.get(text);
  if (cached) return cached.formatted;

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

  const formatted = parts.length > 0 ? parts : sanitized;

  // Evict oldest entries when cache is full (simple FIFO eviction)
  if (formattedCache.size >= MAX_CACHE_SIZE) {
    const firstKey = formattedCache.keys().next().value;
    if (firstKey !== undefined) formattedCache.delete(firstKey);
  }
  formattedCache.set(text, { raw: text, formatted });

  return formatted;
}

// Type for mentionable participants
export interface MentionableParticipant {
  identity: string;
  name: string;
  role: string;
  isModerator: boolean;
}
