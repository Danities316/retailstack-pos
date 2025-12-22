import { generateToken, hashToken } from '../src/utils/token.util'

async function run() {
    const { token, hashed } = generateToken()
    console.log('plain token:', token)
    console.log('stored hashed:', hashed)

    const incoming = token // simulate user-provided token
    const incomingHash = hashToken(incoming)

    console.log('incoming hashed matches stored?', incomingHash === hashed)
}

run().catch((e) => { console.error(e); process.exit(1) })
