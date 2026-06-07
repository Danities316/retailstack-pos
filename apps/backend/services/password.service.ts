// import bcrypt from 'bcryptjs';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

/**
 * Hashes a plain text password and returns a single unified string
 * containing both the salt and the hash separated by a colon.
 * This can be stored directly into your database's string 'password' field.
 */
export const hashPassword = (password: string): string => {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

/**
 * Compares a plain text password with the stored unified string.
 * It automatically splits the string to extract the original salt and hash.
 */
export const comparePassword = (password: string, storedValue: string): boolean => {
  const [salt, originalHash] = storedValue.split(':');

  // Safety check if the string format in the database is invalid or empty
  if (!salt || !originalHash) return false;

  const hashToCompare = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  // timingSafeEqual prevents timing side-channel attacks
  return timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(hashToCompare, 'hex'));
};
