// This command records a separately obtained human authorization. It does not
// solicit, infer or grant approval and never runs a model request.
import { join } from 'node:path'
import { readConfig } from './lib/config.mjs'
import { Budget } from './lib/budget.mjs'
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
const config = await readConfig()
const next = await Budget.amend(join(config.workspace, 'evidence', 'budget.json'), config.budget, {
  id: arg('--id'), expectedSha256: arg('--expected-sha256'),
  additionalCny: Number(arg('--additional-cny')), limitCny: Number(arg('--limit-cny')),
  authorization: arg('--authorization'),
})
console.log(JSON.stringify({ status: 'amended', budget: next,
  instruction: 'Update the local configuration to this exact policy before running. Prior spend and requests are unchanged.' }))
