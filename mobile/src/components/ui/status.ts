import type { StatusTone } from '@/features/orders/status';
import type { BadgeTone } from './badge';

/** Tonos de estado del web (ORDER_STATUS_TONE, SHIPMENT_STATUS) → tonos de Badge. */
export function badgeTone(tone: StatusTone): BadgeTone {
  return tone === 'gray' ? 'neutral' : tone;
}
