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

