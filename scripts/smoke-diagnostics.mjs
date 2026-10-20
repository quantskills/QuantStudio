/** Public smoke failures retain only bounded error lines, never auth URLs or credentials. */
export function smokeDiagnostics(output, privateValues = []) {
  let source = String(output)
  for (const value of privateValues) if (value) source = source.replaceAll(value, '[redacted]')
  return source.split(/\r?\n/)
    .filter(line => /error|failed|inactive|refused|not found|ENOENT/i.test(line))
    .filter(line => !/credential|secret|token|password|authorization|api.?key|login|https?:\/\//i.test(line))
    .map(line => line.replace(/[A-Za-z0-9_+\/-]{32,}={0,2}/g, '[redacted]').slice(0, 400))
    .slice(-12).join('\n')
}
