import crypto from 'crypto'

export function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateToken(bytes = 32) {
    const token = crypto.randomBytes(bytes).toString('hex')
    return { token, hashed: hashToken(token) }
}

export function generateNumericOtp(length = 6) {
    const max = 10 ** length;
    const code = crypto.randomInt(0, max)
      .toString()
      .padStart(length, '0');
    return { code, hashed: hashToken(code) };
  }

// export function generateNumericOtp(length = 6) {
//     const max = 10 ** length
//     const code = (Math.floor(Math.random() * (max - 1)) + 1).toString().padStart(length, '0')
//     return { code, hashed: hashToken(code) }
// }
