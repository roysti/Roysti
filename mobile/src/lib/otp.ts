import { router } from 'expo-router';
import type { OtpPurpose, OtpSent } from './types';

/** Ouvre l'écran de saisie du code. */
export function openOtp(sent: OtpSent, purpose: OtpPurpose, extra: { name?: string; from?: 'login' | 'profile' } = {}) {
  router.push({
    pathname: '/otp',
    params: {
      channel: sent.channel,
      destination: sent.destination,
      masked: sent.destinationMasked,
      purpose,
      resendIn: String(sent.resendInSec),
      demoCode: sent.demoCode ?? '',
      name: extra.name ?? '',
      from: extra.from ?? 'login',
    },
  });
}
