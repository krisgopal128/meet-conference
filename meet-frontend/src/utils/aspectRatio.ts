import type { GridAspectRatio } from '../store/roomStore';

export const ASPECT_RATIO_CSS: Record<GridAspectRatio, string> = {
  '16:9': '16/9',
  '9:16': '9/16',
  '1:1': '1/1',
  '4:3': '4/3',
};

export const ASPECT_RATIO_MULTIPLIERS: Record<GridAspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3,
};
