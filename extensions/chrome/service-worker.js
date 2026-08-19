const UPDATE_ALARM = 'openflow-update-check';
const UPDATE_ALARM_MINUTES = 5;
const RUNTIME_STATE_KEY = 'openflowUpdateRuntime';
const DIAGNOSTIC_QUEUE_KEY = 'openflowDiagnosticQueue';
const MAX_DIAGNOSTIC_QUEUE = 100;
const MAX_DIAGNOSTIC_BATCH = 20;
const MAX_DIAGNOSTIC_EVENT_BYTES = 16 * 1024;
const TRACKED_TAB_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BUSY_TAB_MAX_AGE_MS = 60 * 60 * 1000;

let activeCheck = null;
let activeDiagnosticFlush = null;
let diagnosticQueueMutation = Promise.resolve();

function storageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result[key]);
    });
  });
}

function storageSet(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function normalizeDiagnosticEvent(value) {
  const type = typeof value?.type === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(value.type)
    ? value.type
    : 'extension.unknown';
  const severity = ['info', 'warning', 'error'].includes(value?.severity) ? value.severity : 'error';
  const occurredAt = typeof value?.occurredAt === 'string' && Number.isFinite(Date.parse(value.occurredAt))
    ? new Date(value.occurredAt).toISOString()
    : new Date().toISOString();
  let payload = value?.payload ?? null;
  let event = {
    id: crypto.randomUUID(),
    type,
    severity,
    occurredAt,
    payload
  };
  const eventBytes = new TextEncoder().encode(JSON.stringify(event)).byteLength;
  if (eventBytes > MAX_DIAGNOSTIC_EVENT_BYTES) {
    event = {
      ...event,
      payload: {
        truncated: true,
        originalBytes: eventBytes,
        message: typeof payload?.message === 'string' ? payload.message.slice(0, 1000) : undefined
      }
    };
  }
  return event;
}

async function getDiagnosticQueue() {
  const value = await storageGet(DIAGNOSTIC_QUEUE_KEY);
  return Array.isArray(value) ? value : [];
}

function mutateDiagnosticQueue(mutator) {
  const operation = diagnosticQueueMutation.then(async () => {
    const queue = await getDiagnosticQueue();
    const nextQueue = await mutator(queue);
    await storageSet(DIAGNOSTIC_QUEUE_KEY, nextQueue);
    return nextQueue;
  });
  diagnosticQueueMutation = operation.then(() => undefined, () => undefined);
  return operation;
}

async function queueDiagnosticEvent(value) {
  await mutateDiagnosticQueue((queue) => [...queue, normalizeDiagnosticEvent(value)].slice(-MAX_DIAGNOSTIC_QUEUE));
  void flushDiagnostics();
  return { queued: true };
}

async function getRuntimeState() {
  const value = await storageGet(RUNTIME_STATE_KEY);
  return value && typeof value === 'object'
    ? value
    : { trackedTabs: {}, busyTabs: {}, lastRefreshedVersion: '' };
}

async function updateTrackedTab(tabId, busy) {
  if (!Number.isInteger(tabId)) return;
  const state = await getRuntimeState();
  const now = Date.now();
  state.trackedTabs = state.trackedTabs || {};
  state.busyTabs = state.busyTabs || {};
  state.trackedTabs[String(tabId)] = now;
  if (busy === true) state.busyTabs[String(tabId)] = now;
  if (busy === false) delete state.busyTabs[String(tabId)];
  await storageSet(RUNTIME_STATE_KEY, state);
}

async function hasBusyExtraction() {
  const state = await getRuntimeState();
  const now = Date.now();
  let busy = false;
  for (const [tabId, timestamp] of Object.entries(state.busyTabs || {})) {
    if (Number.isFinite(timestamp) && now - timestamp < BUSY_TAB_MAX_AGE_MS) busy = true;
    else delete state.busyTabs[tabId];
  }
  await storageSet(RUNTIME_STATE_KEY, state);
  return busy;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isSafeExtensionPath(path) {
  return typeof path === 'string' &&
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path.split('/').every((part) => part && part !== '.' && part !== '..');
}

async function verifyInstalledPackage(expectedVersion) {
  const manifestResponse = await fetch(`${chrome.runtime.getURL('extension-release.json')}?v=${Date.now()}`, { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('扩展完整性清单缺失');
  const releaseManifest = await manifestResponse.json();
  if (
    releaseManifest?.schemaVersion !== 1 ||
    releaseManifest.extensionVersion !== expectedVersion ||
    !Array.isArray(releaseManifest.files) ||
    releaseManifest.files.length === 0
  ) {
    throw new Error('扩展完整性清单与目标版本不一致');
  }

  for (const file of releaseManifest.files) {
    if (
      !isSafeExtensionPath(file?.path) ||
      !Number.isSafeInteger(file?.size) ||
      file.size < 0 ||
      !/^[a-f0-9]{64}$/i.test(file?.sha256 || '')
    ) {
      throw new Error('扩展完整性清单包含无效文件');
    }
    const response = await fetch(`${chrome.runtime.getURL(file.path)}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`扩展文件缺失：${file.path}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== file.size) throw new Error(`扩展文件大小不一致：${file.path}`);
    const digest = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
    if (digest !== file.sha256.toLowerCase()) throw new Error(`扩展文件校验失败：${file.path}`);
  }
}

async function readBridgeConfig() {
  const response = await fetch(`${chrome.runtime.getURL('openflow-bridge.json')}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const config = await response.json();
  if (
    config?.schemaVersion !== 1 ||
    config.extensionId !== chrome.runtime.id ||
    config.host !== '127.0.0.1' ||
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535 ||
    !/^[a-f0-9]{64}$/.test(config.token || '')
  ) {
    throw new Error('桌面端连接信息无效');
  }
  return config;
}

async function bridgeFetch(config, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${config.port}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'X-OpenFlow-Extension-Version': chrome.runtime.getManifest().version,
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`桌面端更新服务返回 ${response.status}`);
  return response.json();
}

async function acknowledge(config, status, reason, version = chrome.runtime.getManifest().version) {
  return bridgeFetch(config, '/v1/ack', {
    method: 'POST',
    body: JSON.stringify({
      version,
      status,
      reason: reason ? String(reason).slice(0, 1000) : undefined
    })
  });
}

async function runDiagnosticFlush() {
  const queue = await getDiagnosticQueue();
  if (queue.length === 0) return;
  const config = await readBridgeConfig();
  if (!config) return;
  const batch = queue.slice(0, MAX_DIAGNOSTIC_BATCH);
  const result = await bridgeFetch(config, '/v1/diagnostics', {
    method: 'POST',
    body: JSON.stringify({
      events: batch.map(({ id: _id, ...event }) => event)
    })
  });
  if (result?.accepted !== batch.length) throw new Error('桌面端未完整接收诊断信息');
  const acceptedIds = new Set(batch.map((event) => event.id));
  await mutateDiagnosticQueue((latestQueue) => latestQueue.filter((event) => !acceptedIds.has(event.id)));
}

function flushDiagnostics() {
  if (!activeDiagnosticFlush) {
    activeDiagnosticFlush = runDiagnosticFlush()
      .catch((error) => console.debug('[OpenFlow] 诊断信息已留在本机扩展队列：', error))
      .finally(() => { activeDiagnosticFlush = null; });
  }
  return activeDiagnosticFlush;
}

async function refreshTrackedTabs(version) {
  const state = await getRuntimeState();
  if (state.lastRefreshedVersion === version) return;
  const now = Date.now();
  const tabIds = [];
  for (const [tabId, timestamp] of Object.entries(state.trackedTabs || {})) {
    if (Number.isFinite(timestamp) && now - timestamp < TRACKED_TAB_MAX_AGE_MS) tabIds.push(Number(tabId));
    else delete state.trackedTabs[tabId];
  }
  await Promise.allSettled(tabIds.filter(Number.isInteger).map((tabId) => chrome.tabs.reload(tabId)));
  state.lastRefreshedVersion = version;
  state.busyTabs = {};
  await storageSet(RUNTIME_STATE_KEY, state);
}

async function runUpdateCheck() {
  const config = await readBridgeConfig();
  if (!config) return;
  if (await hasBusyExtraction()) return;
  const status = await bridgeFetch(config, '/v1/status');
  if (!status?.pending) return;

  if (status.action === 'reload') {
    try {
      await verifyInstalledPackage(status.targetVersion);
    } catch (error) {
      const result = await acknowledge(config, 'failed', error instanceof Error ? error.message : error, status.targetVersion);
      if (result?.reload) setTimeout(() => chrome.runtime.reload(), 100);
      return;
    }
    setTimeout(() => chrome.runtime.reload(), 100);
    return;
  }

  if (status.action === 'acknowledge') {
    try {
      const currentVersion = chrome.runtime.getManifest().version;
      await verifyInstalledPackage(currentVersion);
      await refreshTrackedTabs(currentVersion);
      await acknowledge(config, 'ready');
    } catch (error) {
      const result = await acknowledge(config, 'failed', error instanceof Error ? error.message : error);
      if (result?.reload) setTimeout(() => chrome.runtime.reload(), 100);
    }
  }
}

function checkForUpdates() {
  if (!activeCheck) {
    activeCheck = runUpdateCheck()
      .catch((error) => console.debug('[OpenFlow] 自动更新检查暂不可用：', error))
      .finally(() => { activeCheck = null; });
  }
  return activeCheck;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_ALARM_MINUTES });
  void checkForUpdates();
  void flushDiagnostics();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_ALARM_MINUTES });
  void checkForUpdates();
  void flushDiagnostics();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) {
    void checkForUpdates();
    void flushDiagnostics();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void getRuntimeState().then((state) => {
    delete state.trackedTabs?.[String(tabId)];
    delete state.busyTabs?.[String(tabId)];
    return storageSet(RUNTIME_STATE_KEY, state);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPENFLOW_PAGE_READY') {
    void updateTrackedTab(sender.tab?.id, false);
    return;
  }
  if (message?.type === 'OPENFLOW_EXTRACTION_STATE') {
    void updateTrackedTab(sender.tab?.id, message.busy === true).then(() => {
      if (message.busy !== true) return Promise.all([checkForUpdates(), flushDiagnostics()]);
    });
    return;
  }
  if (message?.type === 'OPENFLOW_DIAGNOSTIC_EVENT') {
    void queueDiagnosticEvent(message.event)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ queued: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (message?.type === 'OPENFLOW_CHECK_FOR_UPDATES') {
    void checkForUpdates().then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_ALARM_MINUTES });
void checkForUpdates();
void flushDiagnostics();
