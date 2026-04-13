/**
 * UserActivityLog - Displays user activity timeline
 */

export interface ActivityItem {
  id: string;
  activity_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UserActivityLogProps {
  activities: ActivityItem[];
  loading?: boolean;
  compact?: boolean;
}

const activityConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  login: {
    label: 'Logged in',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
      </svg>
    ),
    color: 'bg-brand-500',
  },
  logout: {
    label: 'Logged out',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    color: 'bg-gray-500',
  },
  meeting_join: {
    label: 'Joined meeting',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    color: 'bg-green-500',
  },
  meeting_leave: {
    label: 'Left meeting',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 3.686 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
      </svg>
    ),
    color: 'bg-yellow-500',
  },
  room_create: {
    label: 'Created room',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    color: 'bg-purple-500',
  },
  room_delete: {
    label: 'Deleted room',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    color: 'bg-red-500',
  },
  profile_update: {
    label: 'Updated profile',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: 'bg-brand-500',
  },
  password_change: {
    label: 'Changed password',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    color: 'bg-orange-500',
  },
  default: {
    label: 'Activity',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'bg-gray-400',
  },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActivityDescription(activity: ActivityItem): string {
  const { activity_type, metadata } = activity;
  
  switch (activity_type) {
    case 'meeting_join':
    case 'meeting_leave':
      return metadata.room_name 
        ? `${activityConfig[activity_type]?.label || 'Activity'} "${metadata.room_name}"`
        : activityConfig[activity_type]?.label || 'Activity';
    case 'room_create':
    case 'room_delete':
      return metadata.room_name
        ? `${activityConfig[activity_type]?.label || 'Activity'} "${metadata.room_name}"`
        : activityConfig[activity_type]?.label || 'Activity';
    default:
      return activityConfig[activity_type]?.label || 'Activity';
  }
}

export default function UserActivityLog({ activities, loading = false, compact = false }: UserActivityLogProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500 text-sm">No activity recorded</p>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'}`}>
      {activities.map((activity, index) => {
        const config = activityConfig[activity.activity_type] || activityConfig.default;
        
        return (
          <div key={activity.id} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${config.color} text-white flex items-center justify-center flex-shrink-0`}>
                {config.icon}
              </div>
              {index < activities.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-200 my-1" />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-gray-900 ${compact ? 'text-sm' : 'text-base font-medium'}`}>
                  {getActivityDescription(activity)}
                </p>
                <span className={`text-gray-500 flex-shrink-0 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {formatRelativeTime(activity.created_at)}
                </span>
              </div>
              
              {/* Full timestamp on hover or for non-compact view */}
              {compact ? null : (
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatFullDate(activity.created_at)}
                </p>
              )}
              
              {/* Additional metadata if available */}
              {activity.metadata.ip_address !== undefined && activity.metadata.ip_address !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  IP: {String(activity.metadata.ip_address)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
