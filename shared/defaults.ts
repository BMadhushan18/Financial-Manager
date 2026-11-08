import type { EntryType, Priority } from './types';

export interface DefaultCategory {
  name: string;
  type: EntryType;
  priority: Priority;
  icon: string;
  color: string;
}

/** Categories every new user starts with (pre-labelled NEED / WANT). */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & groceries', type: 'NEED', priority: 'HIGH', icon: 'cart', color: '#0EA5E9' },
  { name: 'Rent & housing', type: 'NEED', priority: 'HIGH', icon: 'home', color: '#0284C7' },
  { name: 'Transport', type: 'NEED', priority: 'HIGH', icon: 'bus', color: '#0891B2' },
  { name: 'Medicine & health', type: 'NEED', priority: 'HIGH', icon: 'health', color: '#14B8A6' },
  { name: 'Utilities', type: 'NEED', priority: 'HIGH', icon: 'power', color: '#06B6D4' },
  { name: 'Education', type: 'NEED', priority: 'HIGH', icon: 'education', color: '#3B82F6' },
  { name: 'Phone & internet', type: 'NEED', priority: 'MEDIUM', icon: 'wifi', color: '#6366F1' },
  { name: 'Insurance', type: 'NEED', priority: 'MEDIUM', icon: 'shield', color: '#8B5CF6' },
  { name: 'Loans', type: 'NEED', priority: 'HIGH', icon: 'bank', color: '#64748B' },
  { name: 'Eating out', type: 'WANT', priority: 'LOW', icon: 'food', color: '#F59E0B' },
  { name: 'Entertainment', type: 'WANT', priority: 'LOW', icon: 'movie', color: '#F97316' },
  { name: 'Subscriptions', type: 'WANT', priority: 'LOW', icon: 'tv', color: '#EAB308' },
  { name: 'Gadgets', type: 'WANT', priority: 'LOW', icon: 'gadget', color: '#EC4899' },
  { name: 'Fashion', type: 'WANT', priority: 'LOW', icon: 'fashion', color: '#D946EF' },
  { name: 'Hobbies', type: 'WANT', priority: 'LOW', icon: 'hobby', color: '#A855F7' },
  { name: 'Gifts', type: 'WANT', priority: 'MEDIUM', icon: 'gift', color: '#F43F5E' },
  { name: 'Travel', type: 'WANT', priority: 'LOW', icon: 'travel', color: '#FB923C' },
  { name: 'Household', type: 'NEED', priority: 'MEDIUM', icon: 'sofa', color: '#0D9488' },
  { name: 'Personal care', type: 'NEED', priority: 'MEDIUM', icon: 'sparkles', color: '#DB2777' },
  { name: 'Kids & baby', type: 'NEED', priority: 'HIGH', icon: 'baby', color: '#7C3AED' },
  { name: 'Pets', type: 'NEED', priority: 'MEDIUM', icon: 'pet', color: '#B45309' },
  { name: 'Other', type: 'WANT', priority: 'MEDIUM', icon: 'tag', color: '#94A3B8' },
];

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'LKR', label: 'Sri Lankan Rupee (Rs.)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
];
