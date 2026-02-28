/**
 * Ball Brawl XP & Leveling Logic
 */

/**
 * Calculates the level based on total XP.
 * Formula: Level = floor(sqrt(xp / 100)) + 1
 */
export function calculateLevel(xp) {
  if (!xp || xp < 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/**
 * Calculates the total XP required to reach a specific level.
 * Formula: XP = ((level - 1)^2) * 100
 */
export function getXPForLevel(level) {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 100;
}

/**
 * Calculates how much XP is needed to reach the next level.
 */
export function getXPToNextLevel(xp) {
  const currentLevel = calculateLevel(xp);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  return nextLevelXP - xp;
}

/**
 * Calculates progress within the current level (0 to 1).
 */
export function getLevelProgress(xp) {
  const currentLevel = calculateLevel(xp);
  const currentLevelStartXP = getXPForLevel(currentLevel);
  const nextLevelStartXP = getXPForLevel(currentLevel + 1);
  const xpInCurrentLevel = xp - currentLevelStartXP;
  const xpRequiredForThisLevel = nextLevelStartXP - currentLevelStartXP;
  return Math.min(Math.max(xpInCurrentLevel / xpRequiredForThisLevel, 0), 1);
}

/**
 * Calculates XP earned from a match.
 */
export function calculateMatchXP(won, goals = 0) {
  let xp = 20; // Base XP for completing a match
  if (won) xp += 30; // Bonus for winning
  xp += goals * 10; // Bonus per goal
  return xp;
}
