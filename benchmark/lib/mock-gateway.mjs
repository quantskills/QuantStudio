import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
export async function mockGateway(content = '{"total":15,"check":"arithmetic-checked"}') {
  const calls = []
  const server = createServer(async (req, res) => {
    try {
      let raw = ''; for await (const chunk of req) raw += chunk
      const body = JSON.parse(raw)
      calls.push({ model: body.model, stream: body.stream, reasoning: body.reasoning_effort,
        maxOutput: body.max_tokens ?? body.max_completion_tokens,
        tools: body.tools?.map(t => t.function?.name), inputBytes: Buffer.byteLength(raw), hasArithmeticSkill: JSON.stringify(body.messages).includes('skill-arithmetic-audit'),
        bodyHash: createHash('sha256').update(raw).digest('hex') })
      if (calls.length > 1024) { res.writeHead(400); res.end('mock request cap'); return }
      const common = { id: 'mock-' + calls.length, created: 1, model: body.model }
      const usage = { prompt_tokens: 100, completion_tokens: 15, total_tokens: 115 }
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        for (const part of [
          { choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }] },
          { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage }
        ]) res.write('data: ' + JSON.stringify({ ...common, object: 'chat.completion.chunk', ...part }) + '\n\n')
        res.end('data: [DONE]\n\n')
      } else { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ...common, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage })) }
    } catch { res.writeHead(500); res.end('invalid mock request') }
  })
  await new Promise(ok => server.listen(0, '127.0.0.1', ok))
  return { url: `http://127.0.0.1:${server.address().port}/v1`, calls, stop: () => new Promise(ok => server.close(ok)) }
}
