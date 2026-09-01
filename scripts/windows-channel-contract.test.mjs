import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Dev activation is isolated, staged and rollback-safe', () => {
  const source = read('./install-dev-atomic.ps1')
  assert.match(source, /D:\\OpenFlow\\Dev/)
  assert.match(source, /OpenFlow Studio Dev\.exe/)
  assert.match(source, /com\.openflow\.studio\.dev/)
  assert.match(source, /\.OpenFlowDev-staging-/)
  assert.match(source, /Move-Item -LiteralPath \$staging -Destination \$target/)
  assert.match(source, /Move-Item -LiteralPath \$rollback -Destination \$target/)
  assert.match(source, /\\u00B7/)
  assert.doesNotMatch(source, /C:\\Users\\EDY\\Downloads\\openflow-studio/)
})

test('channel builder disables cloud updates for Dev and Candidate', () => {
  const source = read('./build-windows-channel.ps1')
  assert.match(source, /OPENFLOW_UPDATE_CHANNEL_URL = ''/)
  assert.match(source, /OPENFLOW_UPDATE_PUBLIC_KEY = ''/)
  assert.match(source, /OPENFLOW_SENTRY_DSN = ''/)
  assert.match(source, /electron-builder\.channel\.cjs/)
})

test('remote transport carries bundle, binary patch and untracked archive through fixed BatchMode SSH', () => {
  const sender = read('./remote-windows-electron.sh')
  const runner = read('./windows-remote-runner.sh')
  assert.match(sender, /git .* bundle create/)
  assert.match(sender, /diff --binary --full-index HEAD/)
  assert.match(sender, /ls-files --others --exclude-standard -z/)
  assert.match(sender, /BatchMode=yes/)
  assert.match(sender, /edy-main/)
  assert.match(sender, /\/d\/OpenFlow\/Validation/)
  assert.match(runner, /git clone --quiet/)
  assert.match(runner, /git -C .* apply/)
  assert.match(runner, /tar -xzf/)
  assert.match(sender + runner, /STABLE TOUCHED: NO|StableTouched = 'NO'/)
})
