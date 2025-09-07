chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "AddCurrentTabtoReadingList",
        title: "添加当前标签页到阅读列表",
        contexts: ["all"]
    });

    chrome.action.onClicked.addListener((tab) => {
        chrome.sidePanel.open({ windowId: tab.windowId });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "AddCurrentTabtoReadingList") {
            async function getCurrentTab() {
                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                return currentTab;
            }

            getCurrentTab().then((currentTab) => {
                chrome.readingList.addEntry({
                    url: currentTab.url,
                    title: currentTab.title,
                    hasBeenRead: false
                });
            });

            chrome.sidePanel.open({ windowId: tab.windowId });
        }
    });
});
