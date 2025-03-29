// 存储扩展页面的URL
const EXTENSION_URL = chrome.runtime.getURL('index.html');

// 存储每个窗口中的扩展标签页ID
const windowExtensionTabs = new Map();

// 监听标签页创建事件
chrome.tabs.onCreated.addListener(async (tab) => {
    // 如果是新标签页（URL为空），等待URL更新
    if (!tab.url) return;

    // 检查是否是扩展页面或新标签页
    if (tab.url === EXTENSION_URL || tab.url === 'chrome://newtab/') {
        handleExtensionTab(tab);
    }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // 只在URL更新时处理
    if (changeInfo.url && (tab.url === EXTENSION_URL || tab.url === 'chrome://newtab/')) {
        handleExtensionTab(tab);
    }
});

// 处理扩展标签页的函数
async function handleExtensionTab(tab) {
    const existingTabId = windowExtensionTabs.get(tab.windowId);

    if (existingTabId) {
        try {
            // 检查标签页是否还存在
            const existingTab = await chrome.tabs.get(existingTabId);
            if (existingTab) {
                // 如果已存在扩展标签页，激活它
                await chrome.tabs.update(existingTabId, { active: true });
                // 关闭当前标签页
                await chrome.tabs.remove(tab.id);
            } else {
                // 如果标签页不存在，更新记录
                windowExtensionTabs.set(tab.windowId, tab.id);
            }
        } catch (error) {
            // 如果检查出错，更新记录
            windowExtensionTabs.set(tab.windowId, tab.id);
        }
    } else {
        // 如果没有已存在的标签页，记录当前标签页
        windowExtensionTabs.set(tab.windowId, tab.id);
    }
}

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener((tabId) => {
    // 如果关闭的是扩展标签页，从记录中删除
    for (const [windowId, extensionTabId] of windowExtensionTabs.entries()) {
        if (extensionTabId === tabId) {
            windowExtensionTabs.delete(windowId);
            break;
        }
    }
}); 