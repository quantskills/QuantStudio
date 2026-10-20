/** Stopped-profile repair is delegated to the official manager, never a second installer. */
import { recoverPluginTransaction } from '@deepseek-ai/dsh-plugin-manager/operations'
import { resolveDshHome, resolveProfile } from './profile-state.mjs'
import { join } from 'node:path'

if (!process.env.npm_execpath) throw new Error('Run with pnpm exec node scripts/recover-plugin-transaction.mjs.')
const home = resolveDshHome(), profile = resolveProfile()
const result = await recoverPluginTransaction({ home, profile, dir: join(home, 'profiles', profile), installAnchor: process.cwd(), cwd: process.cwd() },
  { command: process.execPath, args: [process.env.npm_execpath], execution: 'cli', outputBytes: 4096 })
console.log(JSON.stringify(result))
