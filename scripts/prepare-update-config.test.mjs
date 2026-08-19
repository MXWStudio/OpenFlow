import assert from 'node:assert/strict'
import test from 'node:test'
import { createUpdateConfiguration } from './prepare-update-config.mjs'

const releaseEnvironment = {
  OPENFLOW_UPDATE_CHANNEL_URL: 'https://updates.example.com/openflow/stable/release.json',
  OPENFLOW_UPDATE_PUBLIC_KEY: 'YWJjZA==',
  OPENFLOW_SENTRY_DSN: 'https://public@example.ingest.sentry.io/123',
  OPENFLOW_DIAGNOSTICS_UPLOAD_INTERVAL_MINUTES: '30',
}

test('update configuration carries the Sentry DSN and interval', () => {
  assert.deepEqual(createUpdateConfiguration(releaseEnvironment, true), {
    schemaVersion: 1,
    channelUrl: releaseEnvironment.OPENFLOW_UPDATE_CHANNEL_URL,
    releasePublicKey: releaseEnvironment.OPENFLOW_UPDATE_PUBLIC_KEY,
    diagnostics: {
      sentryDsn: releaseEnvironment.OPENFLOW_SENTRY_DSN,
      uploadIntervalMinutes: 30,
    },
  })
})

test('local builds default to a 30 minute local-only diagnostics queue', () => {
  assert.deepEqual(createUpdateConfiguration({}), {
    schemaVersion: 1,
    channelUrl: '',
    releasePublicKey: '',
    diagnostics: { sentryDsn: '', uploadIntervalMinutes: 30 },
  })
})

test('diagnostics configuration rejects insecure or invalid DSNs and invalid intervals', () => {
  assert.throws(
    () => createUpdateConfiguration({ OPENFLOW_SENTRY_DSN: 'http://public@example.com/123' }),
    /must use HTTPS/,
  )
  assert.throws(
    () => createUpdateConfiguration({ OPENFLOW_SENTRY_DSN: 'https://public@example.com/123?token=secret' }),
    /valid client DSN/,
  )
  assert.throws(
    () => createUpdateConfiguration({ OPENFLOW_DIAGNOSTICS_UPLOAD_INTERVAL_MINUTES: '2' }),
    /integer from 5 to 1440/,
  )
})
