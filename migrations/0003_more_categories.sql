-- New default categories for the larger item catalogue, added for every
-- existing user (new users get them from shared/defaults.ts).
INSERT OR IGNORE INTO categories (user_id, name, type, priority, icon, color, is_default)
SELECT id, 'Household', 'NEED', 'MEDIUM', 'sofa', '#0D9488', 1 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, type, priority, icon, color, is_default)
SELECT id, 'Personal care', 'NEED', 'MEDIUM', 'sparkles', '#DB2777', 1 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, type, priority, icon, color, is_default)
SELECT id, 'Kids & baby', 'NEED', 'HIGH', 'baby', '#7C3AED', 1 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, type, priority, icon, color, is_default)
SELECT id, 'Pets', 'NEED', 'MEDIUM', 'pet', '#B45309', 1 FROM users;
