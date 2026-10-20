/** Real Chromium against the freshly activated, credential-free fixture only. */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'node:http'
import assert from 'node:assert/strict'

export async function verifyBrowser({ url, fixtureRoot, proof }) {
  const parsed = new URL(url)
  if (parsed.hostname !== '127.0.0.1' || !parsed.port || parsed.port === '3198' || parsed.port === '3097') throw new Error('Browser acceptance requires an isolated random port')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = []
  const output = process.env.QS_BROWSER_EVIDENCE ?? join(fixtureRoot, 'browser-evidence')
  await mkdir(output, { recursive: true })
  let modelCalls = 0
  const model = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk
    response.setHeader('content-type', 'application/json')
    if (request.url.endsWith('/models')) {
      response.end(JSON.stringify({ object: 'list', data: [{ id: 'qs-fixture', object: 'model', owned_by: 'isolated-test' }] })); return
    }
    if (request.url.endsWith('/chat/completions')) {
      modelCalls++
      const input = JSON.parse(raw || '{}'), base = { id: 'fixture-' + modelCalls, created: 1, model: 'qs-fixture' }
      const content = 'QS 本机隔离验收响应'
      if (input.stream) {
        response.setHeader('content-type', 'text/event-stream')
        for (const [delta, finish_reason] of [[{ role: 'assistant', content }, null], [{}, 'stop']]) {
          response.write(`data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })}\n\n`)
        }
        response.end('data: [DONE]\n\n')
      } else response.end(JSON.stringify({ ...base, object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }))
      return
    }
    response.statusCode = 404; response.end('{}')
  })
  await new Promise(done => model.listen(0, '127.0.0.1', done))
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(url)
    await page.getByRole('button', { name: '设置', exact: true }).waitFor({ timeout: 60000 })
    await writeFile(join(output, 'initial.txt'), await page.locator('body').innerText())
    await page.getByRole('button', { name: '稍后设置', exact: true }).click()
    await page.getByRole('button', { name: '设置', exact: true }).click()
    await page.getByText('模型服务', { exact: true }).first().waitFor()
    await page.getByRole('button', { name: '模型服务', exact: true }).click()
    await page.getByRole('button', { name: '添加模型服务', exact: true }).click()
    await page.getByRole('button', { name: /自定义兼容服务/ }).click()
    await page.getByLabel('服务地址', { exact: true }).fill(`http://127.0.0.1:${model.address().port}/v1`)
    await page.getByRole('button', { name: '验证并保存', exact: true }).click()
    await page.getByRole('button', { name: '推理测试', exact: true }).waitFor()
    await page.getByRole('button', { name: '推理测试', exact: true }).click()
    await page.getByRole('button', { name: '开始真实推理测试', exact: true }).click()
    await page.getByRole('button', { name: '开始真实推理测试', exact: true }).waitFor({ state: 'hidden' })
    await writeFile(join(output, 'settings.txt'), await page.locator('body').innerText())
    await page.getByRole('button', { name: '会话', exact: true }).click()
    await page.locator('main[data-page]').getByRole('button', { name: '新建会话', exact: true }).first().click()
    const composer = page.locator('[data-composer-card]:visible')
    await composer.getByRole('button', { name: /请选择模型|选择模型，当前/ }).click()
    await composer.getByRole('dialog').getByRole('button', { name: /^模型/ }).click()
    await composer.getByRole('dialog').getByRole('button', { name: 'qs-fixture', exact: true }).click()
    await page.getByRole('textbox').fill('请回复本机验收结果')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    const replies = page.getByText('QS 本机隔离验收响应', { exact: true }).filter({ visible: true })
    await replies.first().waitFor({ timeout: 30000 })
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'acceptance.txt', mimeType: 'text/plain', buffer: Buffer.from('Isolated attachment for rc.2 acceptance.'),
    })
    await page.getByText('acceptance.txt', { exact: true }).filter({ visible: true }).first().waitFor()
    await composer.getByRole('textbox').fill('请读取此构造附件')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await replies.nth(1).waitFor({ timeout: 30000 })
    await composer.getByRole('textbox').fill('重载后保留的验收草稿')
    await page.reload()
    await page.getByRole('button', { name: '会话', exact: true }).click()
    await page.locator('main[data-page]').getByText('QS 本机隔离验收响应', { exact: true }).first().click()
    await replies.nth(1).waitFor({ timeout: 30000 })
    await page.waitForFunction(() => [...document.querySelectorAll('[data-composer-card] textarea, [data-composer-card] [role=textbox]')]
      .some(node => (node.value ?? node.textContent) === '重载后保留的验收草稿'))
    assert.match(await composer.getByRole('button', { name: /选择模型，当前/ }).getAttribute('aria-label'), /qs-fixture/)
    await page.setViewportSize({ width: 1000, height: 800 })
    await composer.getByRole('textbox').fill('缩窄视口后继续会话')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await replies.nth(2).waitFor({ timeout: 30000 })
    assert.ok(modelCalls >= 4, 'Native host did not perform all expected local inference calls')
    await writeFile(join(output, 'conversation.txt'), await page.locator('body').innerText())
    await page.screenshot({ path: join(output, 'workspace.png') })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: '设置', exact: true }).click()
    await page.getByRole('button', { name: '更多能力', exact: true }).click()
    await page.getByRole('button', { name: '管理自动化任务', exact: true }).click()
    await page.getByRole('heading', { name: '自动化任务', exact: true }).waitFor()
    await page.getByText('还没有自动化任务，在会话中创建的任务会显示在这里', { exact: true }).waitFor()
    await page.getByRole('button', { name: '账号菜单', exact: true }).click()
    await page.getByRole('menuitem', { name: /^设置/ }).click()
    await page.getByText('显示代码工作视图', { exact: true }).waitFor()
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: '插件', exact: true }).click()
    await page.getByRole('button', { name: '查看 网页搜索', exact: true }).click()
    await writeFile(join(output, 'advanced-settings.txt'), await page.locator('body').innerText())
    await page.screenshot({ path: join(output, 'advanced-settings.png') })
    if (errors.length) throw new Error('Browser page errors: ' + errors.join('; '))
    console.log(JSON.stringify({ browser: 'passed', scope: 'model-settings-streaming-attachment-draft-reload-resize-automation-search-settings',
      modelCalls, commit: proof.commit, artifact: proof.artifact }))
  } catch (error) {
    await writeFile(join(output, 'failure.txt'), await page.locator('body').innerText())
    await page.screenshot({ path: join(output, 'failure.png') })
    throw error
  } finally {
    await context.close(); await browser.close()
    model.closeAllConnections(); await new Promise(done => model.close(done))
  }
}
