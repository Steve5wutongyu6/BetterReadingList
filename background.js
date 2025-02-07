chrome.runtime.onInstalled.addListener(() => {
    // 创建上下文菜单项
    chrome.contextMenus.create({
        id: "AddCurrentTabtoReadingList",
        title: "添加当前标签页到阅读列表",
        contexts: ["all"]
    });

    // 监听插件栏插件按钮的点击事件
    chrome.action.onClicked.addListener((tab) => {
        // 弹出侧边栏
        chrome.sidePanel.open({ windowId: tab.windowId });
    });

    // 监听上下文菜单的点击事件
    chrome.contextMenus.onClicked.addListener((info, tab) => {

        // 如果点击添加当前标签页到阅读列表，则调用chrome.readingList.addEntry()将当前页面添加到阅读列表
        if (info.menuItemId === "AddCurrentTabtoReadingList") {
            // 获取当前活跃Tab的URL和标题
            async function getCurrentTab() {
                const [currentTab] = await chrome.tabs.query({active: true, currentWindow: true});
                return currentTab;
            }

            // 将currentTab的URL和标题作为参数传递给chrome.readingList.addEntry()
            getCurrentTab().then((currentTab) => {
                chrome.readingList.addEntry({
                    url: currentTab.url,
                    title: currentTab.title,
                    hasBeenRead: false
                });
            });
            // 弹出侧边栏
            chrome.sidePanel.open({ windowId: tab.windowId });
        }
    });
});
