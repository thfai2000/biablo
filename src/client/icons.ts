import { EquipmentSlot } from "./item";

// Simple ASCII/Unicode art for stats
export const STAT_ICONS = {
  strength: '💪',
  dexterity: '🏃',
  vitality: '❤️',
  intelligence: '🧠',
  availablePoints: '✨'
};

// Simple ASCII/Unicode art for equipment slots
export const SLOT_ICONS = {
  [EquipmentSlot.HEAD]: '👑',
  [EquipmentSlot.BODY]: '👕',
  [EquipmentSlot.RIGHT_HAND]: '🗡️',
  [EquipmentSlot.LEFT_HAND]: '🛡️',
  [EquipmentSlot.HANDS]: '🧤',
  [EquipmentSlot.FEET]: '👢',
  [EquipmentSlot.NECK]: '📿',
  [EquipmentSlot.RING1]: '💍',
  [EquipmentSlot.RING2]: '💍'
};

// For more advanced pixel art, we would use SVG or canvas to draw the icons
// Here's an example of how a simple ASCII pixel art version could look:

export const PIXEL_ART = {
  BODY_DIAGRAM: `
    +-----+
    |  0  |
    /-+-+-\\
   /|     |\\
  / |     | \\
 o  +-----+  o
  \\ |     | /
   \\|     |/
    |     |
    /     \\
   /       \\
  /         \\
 /           \\
/             \\
  `
};
