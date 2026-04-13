const ADJECTIVES = ['quick', 'swift', 'bright', 'calm', 'eager', 'grand', 'happy', 'lucky', 'proud', 'wise'];
const NOUNS = ['forest', 'ocean', 'river', 'mountain', 'valley', 'desert', 'island', 'lake', 'meadow', 'canyon'];

/**
 * Generate a cryptographically secure random integer in range [0, max)
 */
function secureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

/**
 * Generate a secure random 4-digit number as string
 */
function secureRandomNumber(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 10000).toString().padStart(4, '0');
}

export function generateRoomName(): string {
  const adjective = ADJECTIVES[secureRandomInt(ADJECTIVES.length)];
  const noun = NOUNS[secureRandomInt(NOUNS.length)];
  const number = secureRandomNumber();
  return `${adjective}-${noun}-${number}`;
}
