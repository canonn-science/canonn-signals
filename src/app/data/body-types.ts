/**
 * Canonical body `type` values used across the app. Spansh/Canonn supply `type`
 * as a free-form string, but the app only branches on this fixed set, so these
 * constants replace scattered magic strings and give a single named vocabulary.
 */
export const BODY_TYPE = {
  Star: 'Star',
  Planet: 'Planet',
  Ring: 'Ring',
  Belt: 'Belt',
  Barycentre: 'Barycentre',
} as const;
