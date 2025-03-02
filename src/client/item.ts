// filepath: c:\Users\user\OneDrive\桌面\Work\biablo\src\client\item.ts
export enum ItemType {
  WEAPON,
  ARMOR,
  HELMET,
  SHIELD,
  BOOTS,
  GLOVES,
  AMULET,
  RING
}

export enum EquipmentSlot {
  HEAD = 'head',
  BODY = 'body',
  RIGHT_HAND = 'rightHand',
  LEFT_HAND = 'leftHand',
  FEET = 'feet',
  HANDS = 'hands',
  NECK = 'neck',
  RING1 = 'ring1',
  RING2 = 'ring2'
}

export interface ItemStats {
  strengthBonus?: number;
  dexterityBonus?: number;
  vitalityBonus?: number;
  intelligenceBonus?: number;
}

export class Item {
  readonly id: string;
  readonly name: string;
  readonly type: ItemType;
  readonly slot: EquipmentSlot;
  readonly stats: ItemStats;
  readonly icon: string;
  
  constructor(id: string, name: string, type: ItemType, slot: EquipmentSlot, stats: ItemStats, icon: string) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.slot = slot;
    this.stats = stats;
    this.icon = icon;
  }
  
  static generateRandomItem(): Item {
    const types = Object.values(ItemType).filter(v => !isNaN(Number(v)));
    const randomType = types[Math.floor(Math.random() * types.length)] as ItemType;
    
    let slot: EquipmentSlot;
    switch (randomType) {
      case ItemType.HELMET:
        slot = EquipmentSlot.HEAD;
        break;
      case ItemType.ARMOR:
        slot = EquipmentSlot.BODY;
        break;
      case ItemType.WEAPON:
        slot = Math.random() > 0.5 ? EquipmentSlot.RIGHT_HAND : EquipmentSlot.LEFT_HAND;
        break;
      case ItemType.SHIELD:
        slot = EquipmentSlot.LEFT_HAND;
        break;
      case ItemType.BOOTS:
        slot = EquipmentSlot.FEET;
        break;
      case ItemType.GLOVES:
        slot = EquipmentSlot.HANDS;
        break;
      case ItemType.AMULET:
        slot = EquipmentSlot.NECK;
        break;
      case ItemType.RING:
        slot = Math.random() > 0.5 ? EquipmentSlot.RING1 : EquipmentSlot.RING2;
        break;
      default:
        slot = EquipmentSlot.BODY;
    }
    
    const stats: ItemStats = {
      strengthBonus: Math.floor(Math.random() * 5),
      dexterityBonus: Math.floor(Math.random() * 5),
      vitalityBonus: Math.floor(Math.random() * 5),
      intelligenceBonus: Math.floor(Math.random() * 5)
    };
    
    const itemNames = ['Ancient', 'Epic', 'Rare', 'Common'];
    const itemTypes = ['Sword', 'Shield', 'Helmet', 'Armor', 'Boots', 'Gloves', 'Amulet', 'Ring'];
    const name = `${itemNames[Math.floor(Math.random() * itemNames.length)]} ${itemTypes[randomType]}`;
    
    return new Item(
      `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      randomType,
      slot,
      stats,
      getIconForType(randomType)
    );
  }
}

function getIconForType(type: ItemType): string {
  switch (type) {
    case ItemType.WEAPON: return '⚔️';
    case ItemType.ARMOR: return '🛡️';
    case ItemType.HELMET: return '⛑️';
    case ItemType.SHIELD: return '🔰';
    case ItemType.BOOTS: return '👢';
    case ItemType.GLOVES: return '🧤';
    case ItemType.AMULET: return '📿';
    case ItemType.RING: return '💍';
    default: return '❓';
  }
}