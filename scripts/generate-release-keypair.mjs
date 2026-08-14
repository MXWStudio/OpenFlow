import { generateKeyPairSync } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDirectory = resolve(process.argv[2] ?? '.openflow-private')
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
await mkdir(outputDirectory, { recursive: true })
await writeFile(resolve(outputDirectory, 'openflow-release-private.pem'), privateKey, { mode: 0o600 })
await writeFile(resolve(outputDirectory, 'openflow-release-public-spki.txt'), `${publicKey.toString('base64')}\n`, 'utf8')
console.log(`Release signing keys created in ${outputDirectory}. Keep the private PEM outside Git and store it as a GitHub Actions secret.`)
