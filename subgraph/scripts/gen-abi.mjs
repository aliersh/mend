// Extracts .abi arrays from Foundry build artifacts for graph-cli consumption.
// graph-cli expects a plain JSON array; Foundry artifacts wrap it as { "abi": [...], ... }.
// Rerun `pnpm gen:abi` after any contract change.
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const foundryOut = resolve(__dirname, '../../contracts/out')
const abisDir = resolve(__dirname, '../abis')

mkdirSync(abisDir, { recursive: true })

const contracts = [
  ['MendFactory.sol', 'MendFactory'],
  ['MendGroup.sol',   'MendGroup'],
]

for (const [file, name] of contracts) {
  const artifactPath = resolve(foundryOut, file, `${name}.json`)
  const { abi } = JSON.parse(readFileSync(artifactPath, 'utf8'))
  const dest = resolve(abisDir, `${name}.json`)
  writeFileSync(dest, JSON.stringify(abi, null, 2), 'utf8')
  console.log(`gen-abi: wrote ${dest}`)
}
