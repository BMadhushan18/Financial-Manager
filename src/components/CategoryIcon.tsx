import {
  Baby,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Palette,
  PawPrint,
  Plane,
  Receipt,
  Scissors,
  Shield,
  Shirt,
  ShoppingCart,
  Smartphone,
  Tag,
  Tv,
  Headphones,
  UtensilsCrossed,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Icon keys a category can store in its `icon` column. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  home: House,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  health: HeartPulse,
  power: Zap,
  education: GraduationCap,
  wifi: Wifi,
  phone: Smartphone,
  shield: Shield,
  bank: Landmark,
  food: UtensilsCrossed,
  coffee: Coffee,
  movie: Clapperboard,
  tv: Tv,
  gadget: Headphones,
  fashion: Shirt,
  hobby: Palette,
  gift: Gift,
  travel: Plane,
  pet: PawPrint,
  baby: Baby,
  fitness: Dumbbell,
  care: Scissors,
  bill: Receipt,
  tag: Tag,
};

const BY_NAME: [RegExp, string][] = [
  [/grocer|food &|supermarket/i, 'cart'],
  [/rent|house|home/i, 'home'],
  [/transport|bus|train/i, 'bus'],
  [/fuel|petrol/i, 'fuel'],
  [/vehicle|car/i, 'car'],
  [/medic|health|doctor|pharm/i, 'health'],
  [/utilit|electric|water/i, 'power'],
  [/educat|school|course|tuition/i, 'education'],
  [/phone|internet|mobile/i, 'wifi'],
  [/insur/i, 'shield'],
  [/loan|bank|debt/i, 'bank'],
  [/eating|restaurant|dining|lunch/i, 'food'],
  [/coffee|cafe/i, 'coffee'],
  [/entertain|movie|cinema/i, 'movie'],
  [/subscri|stream/i, 'tv'],
  [/gadget|electronic|tech/i, 'gadget'],
  [/fashion|cloth|shoe/i, 'fashion'],
  [/hobb|art|craft/i, 'hobby'],
  [/gift|present/i, 'gift'],
  [/travel|trip|holiday/i, 'travel'],
  [/pet|dog|cat/i, 'pet'],
  [/baby|kid|child/i, 'baby'],
  [/gym|fitness|sport/i, 'fitness'],
  [/salon|hair|beauty|care/i, 'care'],
];

export function categoryIconKey(
  icon: string | null | undefined,
  name: string | null | undefined,
): string {
  if (icon && CATEGORY_ICONS[icon]) return icon;
  const n = name ?? '';
  return BY_NAME.find(([re]) => re.test(n))?.[1] ?? 'tag';
}

/** Coloured rounded tile with the category's icon. */
export function CategoryIcon({
  icon,
  name,
  color,
  size = 'md',
}: {
  icon?: string | null;
  name?: string | null;
  color?: string | null;
  size?: 'sm' | 'md';
}) {
  const Icon = CATEGORY_ICONS[categoryIconKey(icon, name)] ?? Tag;
  const c = color ?? '#667085';
  return (
    <span
      className={`tile ${size === 'sm' ? 'sm' : ''}`}
      style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
      aria-hidden="true"
    >
      <Icon size={size === 'sm' ? 16 : 18} strokeWidth={2} />
    </span>
  );
}
