import { Video } from 'lucide-react';

export interface StatItem {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: typeof Video;
  color?: 'brand' | 'success' | 'warning' | 'error' | 'info';
  primary?: boolean;
}
