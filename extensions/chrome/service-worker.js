const UPDATE_ALARM = 'openflow-update-check';
const UPDATE_ALARM_MINUTES = 5;
const RUNTIME_STATE_KEY = 'openflowUpdateRuntime';
const TRACKED_TAB_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BUSY_TAB_MAX_AGE_MS = 60 * 60 * 1000;

let activeCheck = null;

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

async function refreshTrackedTabs(version) {
  const state = await getRuntimeState();
  if (state.lastRefreshedVersion === version) return;
  const now = Date.now();
  const tabIds = [];
  for (const [tabId, timestamp] of Object.entries(state.trackedTabs || {})) {
    if (Number.isFinite(timestamp) && now - timestamp < TRACKED_TAB_MAX_AGE_MS) tabIds.push(Number(tabId));
    else delete state.trackedTabs[tabId];
  }
  state.lastRefreshedVersion = version;
  state.busyTabs = {};
  await storageSet(RUNTIME_STATE_KEY, state);
  await Promise.allSettled(tabIds.filter(Number.isInteger).map((tabId) => chrome.tabs.reload(tabId)));
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
      await acknowledge(config, 'ready');
      await refreshTrackedTabs(currentVersion);
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
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_ALARM_MINUTES });
  void checkForUpdates();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) void checkForUpdates();
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
      if (message.busy !== true) return checkForUpdates();
    });
    return;
  }
  if (message?.type === 'OPENFLOW_CHECK_FOR_UPDATES') {
    void checkForUpdates().then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_ALARM_MINUTES });
void checkForUpdates();
