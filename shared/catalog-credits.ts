// Photo credits: Wikimedia Commons page (author + licence) for each item photo.
// Kept separate so the full paths are only loaded when the credits are opened.
import images from './catalog-images.json';

const IMAGES = images as Record<string, string>;

export function catalogCredit(id: string): string | null {
  const path = IMAGES[id];
  if (!path) return null;
  // "thumb/a/ab/File.jpg/330px-File.jpg" or "a/ab/File.jpg" → "File.jpg"
  const file = path.replace(/^thumb\//, '').split('/')[2];
  return file ? `https://commons.wikimedia.org/wiki/File:${file}` : null;
}
