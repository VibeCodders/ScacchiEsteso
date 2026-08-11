import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names (`clsx`) and de-duplicate conflicting Tailwind utilities
 * (`tailwind-merge`). Shared by every UI component so callers can layer Tailwind classes on top
 * of component defaults without fighting the cascade.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
