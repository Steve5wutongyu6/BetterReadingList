const GOOGLE_ORIGIN = 'https://www.google.com';

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  // Enables the side panel on google.com
  if (url.origin === GOOGLE_ORIGIN) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidebar.html',
      enabled: true
    });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Fetch and display reading list in the sidebar
chrome.sidePanel.onShown.addListener(async (panel) => {
  const items = await chrome.readingList.query({});
  // 按照添加时间排序，后添加的排在前面
  items.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  const listElement = document.getElementById('reading-list');
  listElement.innerHTML = ''; // Clear existing items
  items.forEach(item => {
    const listItem = document.createElement('li');
    listItem.textContent = `${item.title} - ${item.url}`;
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      await chrome.readingList.removeEntry({ url: item.url });
      listItem.remove();
    });
    listItem.appendChild(deleteButton);
    listElement.appendChild(listItem);
  });
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// 添加右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'addToReadingList',
        title: '添加到阅读列表',
        contexts: ['page', 'link']
    });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'addToReadingList') {
        const url = info.linkUrl || info.pageUrl;
        try {
            await chrome.readingList.addEntry({
                url: url,
                title: tab.title || url
            });
            console.log('成功添加到阅读列表');
        } catch (error) {
            console.error('添加失败:', error);
        }
    }
});

