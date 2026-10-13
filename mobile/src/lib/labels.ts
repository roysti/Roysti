import { colors } from '@/constants/theme';
import type { OrderStatus, ParcelStatus, Platform } from './types';

export const PLATFORM_NAMES: Record<Platform | 'other', string> = {
  taobao: 'Taobao',
  tmall: 'Tmall',
  '1688': '1688',
  alibaba: 'Alibaba',
  jd: 'JD.com',
  weidian: 'Weidian',
  other: 'Transfert',
};

type Tone = { label: string; color: string; background: string };

export const ORDER_STATUS: Record<OrderStatus, Tone> = {
  pending_payment: { label: 'À payer', color: colors.warning, background: colors.warningSoft },
  paid: { label: 'En cours d’achat', color: colors.info, background: colors.infoSoft },
  purchased: { label: 'Achetée', color: colors.info, background: colors.infoSoft },
  shipped_domestic: { label: 'Vers l’entrepôt', color: colors.info, background: colors.infoSoft },
  awaiting_arrival: { label: 'Attendue', color: colors.info, background: colors.infoSoft },
  in_warehouse: { label: 'En entrepôt', color: colors.success, background: colors.successSoft },
  canceled: { label: 'Annulée', color: colors.textMuted, background: colors.background },
};

export const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending_payment', label: 'Commande' },
  { status: 'paid', label: 'Payée' },
  { status: 'purchased', label: 'Achetée' },
  { status: 'shipped_domestic', label: 'Expédiée' },
  { status: 'in_warehouse', label: 'Entrepôt' },
];

export const PARCEL_STATUS: Record<ParcelStatus, Tone> = {
  pending_payment: { label: 'Port à payer', color: colors.warning, background: colors.warningSoft },
  paid: { label: 'Payé', color: colors.info, background: colors.infoSoft },
  packing: { label: 'Emballage', color: colors.info, background: colors.infoSoft },
  packed: { label: 'Emballé', color: colors.info, background: colors.infoSoft },
  shipped: { label: 'Expédié', color: colors.primary, background: colors.primarySoft },
  delivered: { label: 'Livré', color: colors.success, background: colors.successSoft },
  canceled: { label: 'Annulé', color: colors.textMuted, background: colors.background },
};

export const PARCEL_STEPS: { status: ParcelStatus; label: string }[] = [
  { status: 'pending_payment', label: 'Soumis' },
  { status: 'paid', label: 'Payé' },
  { status: 'packing', label: 'Emballage' },
  { status: 'shipped', label: 'Expédié' },
  { status: 'delivered', label: 'Livré' },
];

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
