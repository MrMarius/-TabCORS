const originDisplay = document.getElementById("origin-display");
const corsToggle = document.getElementById("cors-toggle");
const toggleLabel = document.getElementById("toggle-label");
const currentTabSection = document.getElementById("current-tab-section");
const disabledMessage = document.getElementById("disabled-message");
const errorMessage = document.getElementById("error-message");
const originsSection = document.getElementById("origins-section");
const originsList = document.getElementById("origins-list");

let currentOrigin = null;

// --- Helpers ---

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

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

// --- Render active origins list ---

async function renderOriginsList() {
  const result = await chrome.storage.local.get({ enabledOrigins: [] });
  const enabledOrigins = result.enabledOrigins;

  if (enabledOrigins.length === 0) {
    originsSection.classList.add("hidden");
    return;
  }

  originsSection.classList.remove("hidden");
  originsList.innerHTML = "";

  for (const origin of enabledOrigins) {
    const listItem = document.createElement("li");

    const originText = document.createElement("span");
    originText.className = "origin-text";
    originText.textContent = origin;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.textContent = "\u00d7";
    removeButton.title = `Remove ${origin}`;
    removeButton.addEventListener("click", () => handleRemoveOrigin(origin));

    listItem.appendChild(originText);
    listItem.appendChild(removeButton);
    originsList.appendChild(listItem);
  }
}

// --- Toggle handler ---

async function handleToggle() {
  if (!currentOrigin) return;

  const isEnabled = corsToggle.checked;

  try {
    const result = await chrome.storage.local.get({ enabledOrigins: [] });
    const enabledOrigins = new Set(result.enabledOrigins);

    if (isEnabled) {
      enabledOrigins.add(currentOrigin);
    } else {
      enabledOrigins.delete(currentOrigin);
    }

    await chrome.storage.local.set({ enabledOrigins: [...enabledOrigins] });

    await chrome.runtime.sendMessage({
      action: isEnabled ? "originEnabled" : "originDisabled",
      origin: currentOrigin,
    });

    await renderOriginsList();
  } catch (error) {
    console.error("Toggle failed:", error);
    showError("Failed to update CORS setting.");
    corsToggle.checked = !isEnabled; // revert toggle
  }
}

// --- Remove origin handler ---

async function handleRemoveOrigin(origin) {
  try {
    const result = await chrome.storage.local.get({ enabledOrigins: [] });
    const enabledOrigins = new Set(result.enabledOrigins);
    enabledOrigins.delete(origin);

    await chrome.storage.local.set({ enabledOrigins: [...enabledOrigins] });

    await chrome.runtime.sendMessage({
      action: "originDisabled",
      origin,
    });

    // Update toggle if we removed the current tab's origin
    if (origin === currentOrigin) {
      corsToggle.checked = false;
    }

    await renderOriginsList();
  } catch (error) {
    console.error("Remove origin failed:", error);
    showError("Failed to remove origin.");
  }
}

// --- Init ---

async function init() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || !activeTab.url) {
      currentTabSection.classList.add("hidden");
      disabledMessage.classList.remove("hidden");
      await renderOriginsList();
      return;
    }

    currentOrigin = extractOrigin(activeTab.url);

    if (!currentOrigin) {
      currentTabSection.classList.add("hidden");
      disabledMessage.classList.remove("hidden");
      await renderOriginsList();
      return;
    }

    originDisplay.textContent = currentOrigin;

    const result = await chrome.storage.local.get({ enabledOrigins: [] });
    const enabledOrigins = new Set(result.enabledOrigins);
    corsToggle.checked = enabledOrigins.has(currentOrigin);

    corsToggle.addEventListener("change", handleToggle);

    await renderOriginsList();
  } catch (error) {
    console.error("Popup init failed:", error);
    showError("Failed to load extension state.");
  }
}

init();
