// 存储扩展页面的URL
const EXTENSION_URL = chrome.runtime.getURL('index.html');

// 存储每个窗口中的扩展标签页ID
const windowExtensionTabs = new Map();

// 自动清理下载历史 - 删除已不存在文件的下载记录
// 启动时立即执行，每天执行一次

let cleanupTimerId = null;
const CHECK_INTERVAL = 86400000; // 24小时
const INITIAL_DELAY = 0; // 立即执行

// 启动清理
initDownloadCleanup();

// 监听标签页创建事件
chrome.tabs.onCreated.addListener(async (tab) => {
    if (!tab.url) return;

    if (tab.url === EXTENSION_URL || tab.url === 'chrome://newtab/') {
        handleExtensionTab(tab);
    }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && (tab.url === EXTENSION_URL || tab.url === 'chrome://newtab/')) {
        handleExtensionTab(tab);
    }
});

// 处理扩展标签页
async function handleExtensionTab(tab) {
    const existingTabId = windowExtensionTabs.get(tab.windowId);

    if (existingTabId) {
        try {
            const existingTab = await chrome.tabs.get(existingTabId);
            if (existingTab) {
                await chrome.tabs.update(existingTabId, { active: true });
                await chrome.tabs.remove(tab.id);
            } else {
                windowExtensionTabs.set(tab.windowId, tab.id);
            }
        } catch (error) {
            windowExtensionTabs.set(tab.windowId, tab.id);
        }
    } else {
        windowExtensionTabs.set(tab.windowId, tab.id);
    }
}

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener((tabId) => {
    for (const [windowId, extensionTabId] of windowExtensionTabs.entries()) {
        if (extensionTabId === tabId) {
            windowExtensionTabs.delete(windowId);
            break;
        }
    }
});

// 初始化下载历史清理
function initDownloadCleanup() {
    setTimeout(() => {
        cleanupDownloadHistory();
        cleanupTimerId = setInterval(cleanupDownloadHistory, CHECK_INTERVAL);
    }, INITIAL_DELAY);
}

// 清理下载历史中已删除文件的记录
function cleanupDownloadHistory() {
    chrome.downloads.search({}, (downloadItems) => {
        const completedDownloads = downloadItems.filter(item => item.state === 'complete');
        
        console.log(`检查 ${completedDownloads.length} 条下载记录...`);
        
        let processedCount = 0;
        completedDownloads.forEach((download) => {
            chrome.downloads.search({id: download.id, exists: false}, (items) => {
                processedCount++;
                if (items && items.length > 0) {
                    chrome.downloads.erase({id: download.id}, (erasedIds) => {
                        console.log(`已清除记录: ${download.filename}`);
                    });
                }
                
                if (processedCount === completedDownloads.length) {
                    console.log(`下载记录检查完成，共处理 ${processedCount} 条记录`);
                }
            });
        });
    });
} 