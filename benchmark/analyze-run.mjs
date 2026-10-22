import {readFile,writeFile} from 'node:fs/promises'
import {summarize} from './lib/analyze.mjs'
const [input,output]=process.argv.slice(2)
if(!input||!output)throw new Error('Usage: node benchmark/analyze-run.mjs report.json new-summary.json')
const summary=summarize(JSON.parse(await readFile(input,'utf8')))
await writeFile(output,JSON.stringify(summary,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({attempted:summary.attempted,planned:summary.plannedRuns,default:summary.activation.default}))
