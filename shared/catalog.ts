// Everyday items people buy, with a default category and NEED/WANT label so
// the app never has to ask. Photos come from Wikipedia / Wikimedia Commons
// (free licences) and are resolved by scripts/build-catalog-images.ts into
// shared/catalog-images.json.
import type { EntryType } from './types';
import images from './catalog-images.json';

export interface CatalogItem {
  id: string;
  name: string;
  /** Other words people type for it. */
  aliases: string[];
  /** Name of a default category (see shared/defaults.ts). */
  category: string;
  type: EntryType;
  /** Wikipedia article whose lead photo is used. */
  wiki: string;
}

const C = (
  id: string,
  name: string,
  category: string,
  type: EntryType,
  wiki: string,
  aliases: string[] = [],
): CatalogItem => ({ id, name, category, type, wiki, aliases });

const FOOD = 'Food & groceries';
const TRANSPORT = 'Transport';
const HEALTH = 'Medicine & health';
const UTIL = 'Utilities';
const PHONE = 'Phone & internet';
const EDU = 'Education';
const EAT = 'Eating out';
const FUN = 'Entertainment';
const SUBS = 'Subscriptions';
const GADGET = 'Gadgets';
const FASHION = 'Fashion';
const HOBBY = 'Hobbies';
const GIFT = 'Gifts';
const TRAVEL = 'Travel';
const OTHER = 'Other';
const HOUSE = 'Rent & housing';

export const CATALOG: CatalogItem[] = [
  // Food & groceries
  C('rice', 'Rice', FOOD, 'NEED', 'White rice', ['samba', 'nadu', 'keeri samba', 'basmati']),
  C('dhal', 'Dhal', FOOD, 'NEED', 'Masoor dal', ['dal', 'lentils', 'parippu']),
  C('bread', 'Bread', FOOD, 'NEED', 'Bread', ['paan', 'loaf']),
  C('eggs', 'Eggs', FOOD, 'NEED', 'Egg as food', ['egg', 'biththara']),
  C('milk-powder', 'Milk powder', FOOD, 'NEED', 'Powdered milk', [
    'anchor',
    'highland',
    'kiri piti',
  ]),
  C('milk', 'Fresh milk', FOOD, 'NEED', 'Milk', ['milk', 'kiri']),
  C('coconut', 'Coconuts', FOOD, 'NEED', 'Coconut', ['pol', 'coconut']),
  C('vegetables', 'Vegetables', FOOD, 'NEED', 'Vegetable', ['veg', 'elawalu']),
  C('fruits', 'Fruits', FOOD, 'NEED', 'Fruit', ['fruit', 'banana', 'papaya', 'mango']),
  C('fish', 'Fish', FOOD, 'NEED', 'Fish as food', ['malu', 'tuna', 'sprats']),
  C('chicken', 'Chicken', FOOD, 'NEED', 'Chicken as food', ['meat', 'kukul mas']),
  C('sugar', 'Sugar', FOOD, 'NEED', 'Sugar', ['seeni']),
  C('tea', 'Tea leaves', FOOD, 'NEED', 'Tea', ['tea', 'thea kola']),
  C('cooking-oil', 'Cooking oil', FOOD, 'NEED', 'Cooking oil', ['coconut oil', 'oil']),
  C('flour', 'Wheat flour', FOOD, 'NEED', 'Flour', ['flour', 'piti']),
  C('onions', 'Onions', FOOD, 'NEED', 'Onion', ['onion', 'lunu', 'big onion']),
  C('potatoes', 'Potatoes', FOOD, 'NEED', 'Potato', ['potato', 'ala']),
  C('spices', 'Spices', FOOD, 'NEED', 'Spice', ['chilli', 'curry powder', 'pepper']),
  C('groceries', 'Weekly groceries', FOOD, 'NEED', 'Grocery store', [
    'groceries',
    'supermarket',
    'keells',
    'cargills',
    'food city',
  ]),
  C('water-bottle', 'Drinking water', FOOD, 'NEED', 'Bottled water', ['water', 'bottle']),

  // Transport
  C('fuel', 'Bike fuel', TRANSPORT, 'NEED', 'Filling station', [
    'petrol',
    'gas',
    'fuel',
    'refuel',
    'octane',
    'diesel',
  ]),
  C('bus', 'Bus fare', TRANSPORT, 'NEED', 'Bus', ['bus', 'ticket']),
  C('train', 'Train ticket', TRANSPORT, 'NEED', 'Train', ['train', 'railway']),
  C('tuk', 'Tuk-tuk ride', TRANSPORT, 'NEED', 'Auto rickshaw', [
    'three wheeler',
    'threewheel',
    'tuk tuk',
    'pickme',
    'uber',
  ]),
  C('taxi', 'Taxi', TRANSPORT, 'NEED', 'Taxicab', ['cab', 'car hire']),
  C('bike-service', 'Bike service', TRANSPORT, 'NEED', 'Motorcycle', [
    'service',
    'repair',
    'oil change',
    'motorbike',
  ]),
  C('tyres', 'Tyres', TRANSPORT, 'NEED', 'Tire', ['tyre', 'tire', 'tube']),
  C('helmet', 'Helmet', TRANSPORT, 'NEED', 'Motorcycle helmet', []),
  C('parking', 'Parking', TRANSPORT, 'NEED', 'Parking space', []),
  C('car-wash', 'Car / bike wash', TRANSPORT, 'WANT', 'Car wash', ['wash']),

  // Health
  C('medicine', 'Medicine', HEALTH, 'NEED', 'Medication', [
    'pharmacy',
    'tablets',
    'pills',
    'beheth',
  ]),
  C('doctor', 'Doctor visit', HEALTH, 'NEED', 'Stethoscope', [
    'channelling',
    'channeling',
    'clinic',
    'hospital',
  ]),
  C('vitamins', 'Vitamins', HEALTH, 'NEED', 'Dietary supplement', ['supplements']),
  C('glasses', 'Spectacles', HEALTH, 'NEED', 'Glasses', ['glasses', 'eye test', 'lenses']),
  C('dentist', 'Dentist', HEALTH, 'NEED', 'Dentistry', ['dental', 'tooth']),
  C('first-aid', 'First aid kit', HEALTH, 'NEED', 'First aid kit', []),

  // Utilities & housing
  C('electricity', 'Electricity bill', UTIL, 'NEED', 'Electricity meter', [
    'ceb',
    'light bill',
    'current bill',
    'leco',
  ]),
  C('water-bill', 'Water bill', UTIL, 'NEED', 'Water metering', ['water board']),
  C('gas-cylinder', 'Gas cylinder', UTIL, 'NEED', 'Gas cylinder', [
    'litro',
    'laugfs',
    'lp gas',
    'cooking gas',
  ]),
  C('rent', 'House rent', HOUSE, 'NEED', 'Single-family detached home', [
    'rent',
    'boarding',
    'annex',
  ]),

  // Phone & internet
  C('reload', 'Mobile reload', PHONE, 'NEED', 'SIM card', [
    'reload',
    'dialog',
    'mobitel',
    'hutch',
    'airtel',
    'top up',
  ]),
  C('internet', 'Internet / Wi-Fi', PHONE, 'NEED', 'Wireless router', [
    'wifi',
    'fibre',
    'broadband',
    'data',
  ]),

  // Education
  C('school-fees', 'School fees', EDU, 'NEED', 'School', ['fees', 'facility fees']),
  C('tuition', 'Tuition class', EDU, 'NEED', 'Classroom', ['class', 'tuition', 'tution']),
  C('books', 'Books', EDU, 'NEED', 'Book', ['book', 'novel', 'textbook']),
  C('stationery', 'Stationery', EDU, 'NEED', 'Stationery', ['pens', 'pencils', 'exercise books']),
  C('uniform', 'School uniform', EDU, 'NEED', 'School uniform', ['uniform']),
  C('school-bag', 'School bag', EDU, 'NEED', 'Backpack', ['bag', 'backpack']),
  C('course', 'Online course', EDU, 'NEED', 'Educational technology', [
    'course',
    'udemy',
    'coursera',
  ]),

  // Household
  C('soap', 'Soap', OTHER, 'NEED', 'Soap', ['body wash']),
  C('toothpaste', 'Toothpaste', OTHER, 'NEED', 'Toothpaste', ['tooth brush', 'toothbrush']),
  C('shampoo', 'Shampoo', OTHER, 'NEED', 'Shampoo', []),
  C('detergent', 'Washing powder', OTHER, 'NEED', 'Laundry detergent', [
    'detergent',
    'sunlight',
    'surf',
  ]),
  C('diapers', 'Diapers', OTHER, 'NEED', 'Diaper', ['nappies', 'nappy', 'pampers']),
  C('toilet-paper', 'Toilet paper', OTHER, 'NEED', 'Toilet paper', ['tissue']),
  C('rice-cooker', 'Rice cooker', OTHER, 'NEED', 'Rice cooker', []),
  C('fridge', 'Refrigerator', OTHER, 'WANT', 'Refrigerator', ['fridge']),
  C('fan', 'Electric fan', OTHER, 'NEED', 'Mechanical fan', ['fan', 'table fan', 'ceiling fan']),
  C('washing-machine', 'Washing machine', OTHER, 'WANT', 'Washing machine', []),
  C('mattress', 'Mattress', OTHER, 'NEED', 'Mattress', ['bed']),
  C('office-chair', 'Office chair', OTHER, 'NEED', 'Office chair', ['chair', 'desk chair']),
  C('blender', 'Blender', OTHER, 'WANT', 'Blender (appliance)', ['mixer', 'grinder']),
  C('kettle', 'Electric kettle', OTHER, 'WANT', 'Electric kettle', ['kettle']),
  C('bulbs', 'Light bulbs', OTHER, 'NEED', 'LED lamp', ['bulb', 'led']),
  C('haircut', 'Haircut', OTHER, 'NEED', 'Barber', ['salon', 'barber', 'hair']),

  // Eating out
  C('restaurant', 'Restaurant meal', EAT, 'WANT', 'Restaurant', ['dinner', 'lunch', 'meal']),
  C('coffee', 'Coffee', EAT, 'WANT', 'Coffee', ['cafe', 'latte', 'cappuccino']),
  C('kottu', 'Kottu', EAT, 'WANT', 'Kottu', ['koththu']),
  C('pizza', 'Pizza', EAT, 'WANT', 'Pizza', []),
  C('burger', 'Burger', EAT, 'WANT', 'Hamburger', ['hamburger']),
  C('ice-cream', 'Ice cream', EAT, 'WANT', 'Ice cream', []),
  C('cake', 'Cake', EAT, 'WANT', 'Cake', ['birthday cake']),
  C('short-eats', 'Short eats', EAT, 'WANT', 'Samosa', ['snacks', 'rolls', 'patties']),

  // Entertainment & subscriptions
  C('movie', 'Movie ticket', FUN, 'WANT', 'Movie projector', ['cinema', 'film']),
  C('concert', 'Concert ticket', FUN, 'WANT', 'Concert', ['show', 'musical']),
  C('cricket-match', 'Cricket match', FUN, 'WANT', 'Cricket', ['match']),
  C('netflix', 'Netflix', SUBS, 'WANT', 'Netflix', ['streaming']),
  C('spotify', 'Earphone', SUBS, 'WANT', 'Spotify', ['music']),
  C('gym', 'Gym membership', HOBBY, 'WANT', 'Dumbbell', ['fitness', 'workout']),

  // Gadgets
  C('smartphone', 'Smartphone', GADGET, 'WANT', 'Smartphone', [
    'phone',
    'iphone',
    'samsung',
    'mobile',
  ]),
  C('headphones', 'Headphones', GADGET, 'WANT', 'Headphones', ['earphones', 'headset']),
  C('earbuds', 'Wireless earbuds', GADGET, 'WANT', 'AirPods', ['airpods', 'buds', 'earbuds']),
  C('laptop', 'Laptop', GADGET, 'WANT', 'Laptop', ['notebook', 'macbook', 'computer']),
  C('smartwatch', 'Smartwatch', GADGET, 'WANT', 'Smartwatch', ['fitness band', 'apple watch']),
  C('tablet', 'Tablet', GADGET, 'WANT', 'Tablet computer', ['ipad']),
  C('tv', 'Television', GADGET, 'WANT', 'Television set', ['tv', 'smart tv']),
  C('camera', 'Camera', GADGET, 'WANT', 'Digital camera', ['dslr']),
  C('power-bank', 'Power bank', GADGET, 'WANT', '', ['powerbank', 'charger']),
  C('console', 'Gaming console', GADGET, 'WANT', 'Gamepad', [
    'playstation',
    'ps5',
    'xbox',
    'nintendo',
  ]),
  C('speaker', 'Bluetooth speaker', GADGET, 'WANT', 'Bluetooth speaker', ['speaker', 'jbl']),
  C('keyboard', 'Keyboard & mouse', GADGET, 'WANT', 'Computer keyboard', ['mouse', 'keyboard']),

  // Fashion
  C('shoes', 'Shoes', FASHION, 'WANT', 'Shoe', ['sandals', 'slippers', 'boots']),
  C('running-shoes', 'Running shoes', FASHION, 'WANT', 'Sneakers', ['sneakers', 'trainers']),
  C('shirt', 'Shirt', FASHION, 'WANT', 'Shirt', ['office shirt']),
  C('t-shirt', 'T-shirt', FASHION, 'WANT', 'T-shirt', ['tshirt', 'tee']),
  C('jeans', 'Jeans', FASHION, 'WANT', 'Jeans', ['trousers', 'pants', 'denim']),
  C('dress', 'Dress', FASHION, 'WANT', 'Dress', ['frock']),
  C('saree', 'Saree', FASHION, 'WANT', 'Sari', ['sari', 'osariya']),
  C('handbag', 'Handbag', FASHION, 'WANT', 'Handbag', ['purse']),
  C('watch', 'Wristwatch', FASHION, 'WANT', 'Watch', ['watch']),
  C('sunglasses', 'Sunglasses', FASHION, 'WANT', 'Sunglasses', ['shades']),
  C('perfume', 'Perfume', FASHION, 'WANT', 'Eau de toilette', ['cologne', 'body spray']),

  // Hobbies, gifts, travel
  C('guitar', 'Guitar', HOBBY, 'WANT', 'Guitar', []),
  C('bicycle', 'Bicycle', HOBBY, 'WANT', 'Bicycle', ['bike', 'cycle']),
  C('football', 'Football', HOBBY, 'WANT', 'Ball (association football)', ['ball']),
  C('board-game', 'Board game', HOBBY, 'WANT', 'Board game', ['carrom', 'chess']),
  C('gift', 'Birthday gift', GIFT, 'WANT', 'Gift', ['present', 'wedding gift']),
  C('flowers', 'Flowers', GIFT, 'WANT', 'Rose', ['bouquet', 'roses']),
  C('chocolates', 'Chocolates', GIFT, 'WANT', 'Chocolate', ['chocolate']),
  C('trip', 'Weekend trip', TRAVEL, 'WANT', 'Ella, Sri Lanka', [
    'trip',
    'tour',
    'holiday',
    'vacation',
  ]),
  C('hotel', 'Hotel stay', TRAVEL, 'WANT', 'Hotel', ['hotel', 'room']),
  C('flight', 'Flight ticket', TRAVEL, 'WANT', 'Airliner', ['flight', 'air ticket', 'plane']),
];

const IMAGES = images as Record<string, { src: string; page: string }>;

export function catalogImage(item: CatalogItem | undefined | null): string | null {
  if (!item) return null;
  return IMAGES[item.id]?.src ?? null;
}

export function catalogCredit(item: CatalogItem): string | null {
  return IMAGES[item.id]?.page ?? null;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ranked catalogue search: name prefix > word prefix > alias > anywhere. */
export function searchCatalog(query: string, limit = 8): CatalogItem[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of CATALOG) {
    const name = norm(item.name);
    const aliases = item.aliases.map(norm);
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.split(' ').some((w) => w.startsWith(q))) score = 70;
    else if (aliases.some((a) => a === q)) score = 65;
    else if (aliases.some((a) => a.startsWith(q) || a.split(' ').some((w) => w.startsWith(q))))
      score = 55;
    else if (name.includes(q)) score = 40;
    else if (aliases.some((a) => a.includes(q))) score = 30;
    if (score > 0) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((s) => s.item);
}

/** The catalogue item a free-text name refers to (exact name, then best alias match). */
export function matchCatalog(name: string | null | undefined): CatalogItem | undefined {
  if (!name) return undefined;
  const n = norm(name);
  if (!n) return undefined;
  const exact = CATALOG.find((c) => norm(c.name) === n);
  if (exact) return exact;
  const alias = CATALOG.find((c) => c.aliases.some((a) => norm(a) === n));
  if (alias) return alias;
  // e.g. "Petrol for bike" → fuel; only whole-word alias hits to avoid wrong photos
  const words = new Set(n.split(' '));
  return CATALOG.find(
    (c) => words.has(norm(c.name)) || c.aliases.some((a) => !a.includes(' ') && words.has(norm(a))),
  );
}
