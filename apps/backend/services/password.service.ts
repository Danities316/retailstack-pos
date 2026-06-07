// import bcrypt from 'bcryptjs';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

export const hashPassword = (password: string) => {
  const salt = randomBytes(32);
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512');
  return { hash, salt };
};

export const comparePassword = (password: string, hash: string, salt: string) => {
  const hashToCompare = pbkdf2Sync(password, salt, 10000, 64, 'sha512');
  return timingSafeEqual(Buffer.from(hash), Buffer.from(hashToCompare));
};