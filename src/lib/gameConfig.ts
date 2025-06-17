
export const MAX_LEVEL = 3;

// Costs based on Game Design Document Section 9
// Attack Upgrade:
// Level 1 -> 2: Cost: 1000 Gold + 1500 Resources
// Level 2 -> 3: Cost: 3000 Gold + 4000 Resources
export const ATTACK_UPGRADE_COSTS: Record<number, { gold: number; resources: number; military?: number }> = {
  2: { gold: 1000, resources: 1500 }, // Cost to upgrade from level 1 to 2
  3: { gold: 3000, resources: 4000 }, // Cost to upgrade from level 2 to 3
};

// Defense Upgrade:
// Level 1 -> 2: Cost: 800 Gold + 1400 Resources
// Level 2 -> 3: Cost: 2400 Gold + 3500 Resources
export const DEFENSE_UPGRADE_COSTS: Record<number, { gold: number; resources: number; military?: number }> = {
  2: { gold: 800, resources: 1400 }, 
  3: { gold: 2400, resources: 3500 },
};

// Risk level effects (Section 8) - for future game logic implementation
export const RISK_LEVEL_EFFECTS: Record<RiskLevel, { lossPercent: number; gainPercent: number }> = {
  LOW: { lossPercent: 0.06, gainPercent: 0.02 }, // Example values, can be tuned
  MEDIUM: { lossPercent: 0.10, gainPercent: 0.04 },
  HIGH: { lossPercent: 0.16, gainPercent: 0.06 },
};

// Base resource values upon recovery (Section 7)
export const RECOVERY_BASE_STATS = {
  gold: 60,
  military: 60,
  resources: 60,
};

// Victory/Loss condition threshold (Section 2)
export const RESOURCE_THRESHOLD_PERCENT = 0.50; // 50%

// Max turns for a game (Section 2)
export const MAX_TURNS = 20;

// Blocked attack penalty (Section 10)
// Attacker loses ~4%-6% of the intended resource category.
// For simplicity, let's use a fixed percentage for now. This can be a range or more dynamic later.
export const BLOCKED_ATTACK_PENALTY_PERCENT = 0.05; // 5%

// Successful attack gain share (Section 10)
// Attacker gains a share (e.g., 80% of taken amount)
export const SUCCESSFUL_ATTACK_GAIN_SHARE_PERCENT = 0.80; // 80%

// Types related to game logic - also in types/index.ts but useful here for config context
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type GameMode = "TRAINING" | "QUICK_WAR" | "ROOM_MATCH";

export enum AttackType {
  RAID_CAMP = "RAID_CAMP", // Target: Military
  RESOURCE_HIJACK = "RESOURCE_HIJACK", // Target: Resources
  VAULT_BREAK = "VAULT_BREAK", // Target: Gold
}

export enum DefenseType {
  BARRICADE_TROOPS = "BARRICADE_TROOPS", // Defends against Raid Camp
  SECURE_STORAGE = "SECURE_STORAGE", // Defends against Resource Hijack
  GOLD_SENTINEL = "GOLD_SENTINEL", // Defends against Vault Break
}
