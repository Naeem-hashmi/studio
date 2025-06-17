
export const MAX_LEVEL = 3;

export const ATTACK_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 2000, military: 5000, resources: 4000 }, // Cost to upgrade from level 1 to 2
  3: { gold: 5000, military: 10000, resources: 8000 }, // Cost to upgrade from level 2 to 3
};

export const DEFENSE_UPGRADE_COSTS: Record<number, { gold: number; military: number; resources: number }> = {
  2: { gold: 2000, military: 5000, resources: 4000 }, 
  3: { gold: 5000, military: 10000, resources: 8000 },
};
