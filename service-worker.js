// --- Storage helpers ---

async function getEnabledOrigins() {
  const result = await chrome.storage.local.get({ enabledOrigins: [] });
  return new Set(result.enabledOrigins);
}

async function saveEnabledOrigins(originsSet) {
  await chrome.storage.local.set({ enabledOrigins: [...originsSet] });
}

async function addOrigin(origin) {
  const origins = await getEnabledOrigins();
  origins.add(origin);
  await saveEnabledOrigins(origins);
}

async function removeOrigin(origin) {
  const origins = await getEnabledOrigins();
  origins.delete(origin);
  await saveEnabledOrigins(origins);
}

// --- Rule management ---

function buildCorsRule(tabId, origin) {
  return {
    id: tabId,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "Access-Control-Allow-Origin", operation: "set", value: origin },
        { header: "Access-Control-Allow-Methods", operation: "set", value: "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD" },
        { header: "Access-Control-Allow-Headers", operation: "set", value: "*" },
        { header: "Access-Control-Allow-Credentials", operation: "set", value: "true" },
        { header: "Access-Control-Expose-Headers", operation: "set", value: "*" },
        { header: "Access-Control-Max-Age", operation: "set", value: "0" },
      ],
    },
    condition: {
      tabIds: [tabId],
      resourceTypes: [
        "xmlhttprequest",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "media",
        "other",
      ],
    },
  };
}

function extractOrigin(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin;
    }
  } catch {
    // invalid URL
  }
  return null;
}

async function addRuleForTab(tabId, origin) {
  const rule = buildCorsRule(tabId, origin);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [rule],
      removeRuleIds: [tabId],
    });
  } catch (error) {
    console.error(`Failed to add CORS rule for tab ${tabId}:`, error);
    return false;
  }
  return true;
}

async function removeRuleForTab(tabId) {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId],
    });
  } catch (error) {
    console.error(`Failed to remove CORS rule for tab ${tabId}:`, error);
  }
}

// --- Badge / Icon ---

async function setBadgeOn(tabId) {
  await chrome.action.setIcon({
    path: {
      16: "icons/icon-on-16.png",
      32: "icons/icon-on-32.png",
      48: "icons/icon-on-48.png",
      128: "icons/icon-on-128.png",
    },
    tabId,
  });
  await chrome.action.setBadgeText({ text: "ON", tabId });
  await chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId });
}

async function setBadgeOff(tabId) {
  await chrome.action.setIcon({
    path: {
      16: "icons/icon-off-16.png",
      32: "icons/icon-off-32.png",
      48: "icons/icon-off-48.png",
      128: "icons/icon-off-128.png",
    },
    tabId,
  });
  await chrome.action.setBadgeText({ text: "", tabId });
}

// --- Bulk operations ---

async function applyRulesForOrigin(origin) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const tabOrigin = extractOrigin(tab.url);
    if (tabOrigin === origin) {
      const success = await addRuleForTab(tab.id, origin);
      if (success) {
        await setBadgeOn(tab.id);
      }
    }
  }
}

async function removeRulesForOrigin(origin) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const tabOrigin = extractOrigin(tab.url);
    if (tabOrigin === origin) {
      await removeRuleForTab(tab.id);
      await setBadgeOff(tab.id);
    }
  }
}

// --- Startup: rebuild session rules from storage ---

async function rebuildAllRules() {
  const enabledOrigins = await getEnabledOrigins();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const tabOrigin = extractOrigin(tab.url);
    if (tabOrigin && enabledOrigins.has(tabOrigin)) {
      const success = await addRuleForTab(tab.id, tabOrigin);
      if (success) {
        await setBadgeOn(tab.id);
      }
    }
  }
}

chrome.runtime.onStartup.addListener(rebuildAllRules);
chrome.runtime.onInstalled.addListener(rebuildAllRules);

// --- Tab lifecycle ---

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  const tabOrigin = extractOrigin(tab.url);
  const enabledOrigins = await getEnabledOrigins();

  if (tabOrigin && enabledOrigins.has(tabOrigin)) {
    const success = await addRuleForTab(tabId, tabOrigin);
    if (success) {
      await setBadgeOn(tabId);
    }
  } else {
    await removeRuleForTab(tabId);
    await setBadgeOff(tabId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeRuleForTab(tabId);
});

// --- Messages from popup ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "originEnabled") {
    applyRulesForOrigin(message.origin).then(() => sendResponse({ success: true }));
    return true; // keep message channel open for async response
  }

  if (message.action === "originDisabled") {
    removeRulesForOrigin(message.origin).then(() => sendResponse({ success: true }));
    return true;
  }
});
