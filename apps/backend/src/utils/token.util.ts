import crypto from 'crypto'

export function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateToken(bytes = 32) {
    const token = crypto.randomBytes(bytes).toString('hex')
    return { token, hashed: hashToken(token) }
}
