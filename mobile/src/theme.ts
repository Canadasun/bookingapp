// Brand palette + status colors, shared across every screen and style sheet.

export const BRAND      = '#E9A23C'; // amber/gold brand
export const BRAND_DARK = '#CE8A2A'; // deeper amber for gradients / pressed states
export const BRAND_LT   = '#FBE8CF'; // light tint for selected backgrounds
export const SURFACE    = '#FFFDF8'; // warm off-white — replaces pure #fff on screens/headers
export const GRAY_50    = '#F9FAFB';
export const GRAY_100   = '#F3F4F6';
export const GRAY_200   = '#E5E7EB';
export const GRAY_400   = '#9CA3AF';
export const GRAY_500   = '#6B7280';
export const GRAY_700   = '#374151';
export const GRAY_900   = '#111827';

export const STATUS_COLOR: Record<string, string> = {
  PENDING:'#F59E0B', CONFIRMED:'#10B981', CANCELLED:'#EF4444', COMPLETED:'#6B7280', NO_SHOW:'#1F2937',
};
