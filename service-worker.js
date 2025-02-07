// 监听标签页更新事件，当标签页的内容发生变化时触发
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    // 如果标签页没有 URL，则直接返回，不进行后续操作
    if (!tab.url) return;
    // 将标签页的 URL 转换为 URL 对象，方便后续解析
    const url = new URL(tab.url);
    // 启用侧边栏面板，并设置其选项：
    // - tabId: 当前标签页的 ID
    // - path: 侧边栏面板的 HTML 文件路径
    // - enabled: 是否启用侧边栏面板
    await chrome.sidePanel.setOptions({
        tabId,
        path: 'sidebar.html',
        enabled: true
    });
});


// 点击插件按钮打开SideBar
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 在Sidebar中显示阅读列表
chrome.sidePanel.onShown.addListener(async (panel) => {
  const items = await chrome.readingList.query({});
  // 按照添加时间排序，后添加的排在前面
  items.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  const listElement = document.getElementById('reading-list');
  listElement.innerHTML = '';
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

