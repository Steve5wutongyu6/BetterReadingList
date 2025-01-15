// 获取当前标签页
async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

// 更新按钮状态
async function updateAddButtonState() {
    try {
        const tab = await getCurrentTab();
        const button = document.getElementById('add-current');

        if (!tab) {
            button.disabled = true;
            button.textContent = '无法获取当前页面';
            return;
        }

        const existingItems = await chrome.readingList.query({});
        const isDuplicate = existingItems.some(item => item.url === tab.url);

        button.disabled = isDuplicate;
        button.textContent = isDuplicate ? '已在阅读列表中' : '添加当前标签页';
    } catch (error) {
        console.error('更新按钮状态失败:', error);
    }
}

// 添加当前标签页到阅读列表
async function addCurrentTab() {
    const button = document.getElementById('add-current');
    button.disabled = true;

    try {
        const tab = await getCurrentTab();
        if (tab) {
            await chrome.readingList.addEntry({
                title: tab.title,
                url: tab.url,
                hasBeenRead: false
            });
            button.textContent = '已添加';
            await updateAllStates(); // 立即更新状态
        }
    } catch (error) {
        console.error('添加失败:', error);
        button.disabled = false;
    }
}

// 添加排序状态
let currentSort = {
    field: 'creationTime',
    order: 'desc' // 'desc' 或 'asc'
};

// 添加搜索状态
let searchQuery = '';

// 高亮搜索文本
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// 检查项目是否匹配搜索查询
function isItemMatch(item, query) {
    if (!query) return true;
    query = query.toLowerCase();
    return item.title.toLowerCase().includes(query) ||
        item.url.toLowerCase().includes(query);
}

// 添加状态变量
let currentTab = 'all';

// 更新统计信息
function updateStats(items) {
    const total = items.length;
    const read = items.filter(item => item.hasBeenRead).length;
    const unread = total - read;

    const statsDiv = document.querySelector('.stats');
    statsDiv.textContent = `总计: ${total} | 已读: ${read} | 未读: ${unread}`;
}

// 检查项目是否应该显示
function shouldShowItem(item, tab, query) {
    const matchesTab = tab === 'all' ||
        (tab === 'read' && item.hasBeenRead) ||
        (tab === 'unread' && !item.hasBeenRead);

    const matchesSearch = !query ||
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.url.toLowerCase().includes(query.toLowerCase());

    return matchesTab && matchesSearch;
}

// 切换已读状态
async function toggleReadStatus(url, currentStatus) {
    try {
        await chrome.readingList.updateEntry({
            url: url,
            hasBeenRead: !currentStatus
        });
        await updateAllStates(); // 立即更新状态
    } catch (error) {
        console.error('更新状态失败:', error);
    }
}

// 获取阅读列表
async function getReadingList() {
    try {
        const items = await chrome.readingList.query({});

        // 更新统计信息
        updateStats(items);

        // 过滤并排序
        const filteredItems = items.filter(item =>
            shouldShowItem(item, currentTab, searchQuery)
        ).sort((a, b) => {
            const timeA = a[currentSort.field];
            const timeB = b[currentSort.field];
            return currentSort.order === 'desc' ? timeB - timeA : timeA - timeB;
        });

        // 更新排序按钮状态
        document.querySelectorAll('.sort-btn').forEach(btn => {
            const isActive = btn.dataset.sort === currentSort.field;
            btn.classList.toggle('active', isActive);
            if (isActive) {
                btn.textContent = btn.textContent.replace(/[▼▲]/,
                    currentSort.order === 'desc' ? '▼' : '▲');
            } else {
                btn.textContent = btn.textContent.replace(/[▼▲]/, '▼');
            }
        });

        const container = document.getElementById('reading-list');
        container.innerHTML = '';

        if (filteredItems.length === 0) {
            container.innerHTML = '<div class="no-results">没有找到匹配的结果</div>';
            return;
        }

        filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = `reading-item ${item.hasBeenRead ? 'read' : ''}`;
            const highlightedTitle = highlightText(item.title, searchQuery);
            const highlightedUrl = highlightText(item.url, searchQuery);

            div.innerHTML = `
                <a href="${item.url}" target="_blank">${highlightedTitle}</a>
                <span class="read-toggle" data-url="${item.url}" data-read="${item.hasBeenRead}">
                    ${item.hasBeenRead ? '标记为未读' : '标记为已读'}
                </span>
                <span class="delete-btn" data-url="${item.url}">删除</span>
                <div style="font-size: 12px; color: #666;">${highlightedUrl}</div>
                <div>创建时间: ${new Date(item.creationTime).toLocaleString()}</div>
                <div>更新时间: ${new Date(item.lastUpdateTime).toLocaleString()}</div>
            `;
            container.appendChild(div);
        });

        // 添加事件监听器
        document.querySelectorAll('.read-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
                const url = btn.dataset.url;
                const isRead = btn.dataset.read === 'true';
                await toggleReadStatus(url, isRead);
            });
        });

        // 删除功能
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const url = btn.dataset.url;
                    await chrome.readingList.removeEntry({ url: url });
                    await updateAllStates(); // 立即更新状态
                } catch (error) {
                    console.error('删除失败:', error);
                }
            });
        });
    } catch (error) {
        console.error('获取阅读列表失败:', error);
    }
}

// 初始化排序按钮事件监听
function initSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.sort;
            // 如果点击的是当前排序字段，则切换排序顺序
            if (field === currentSort.field) {
                currentSort.order = currentSort.order === 'desc' ? 'asc' : 'desc';
            } else {
                // 如果是新字段，设置为降序
                currentSort.field = field;
                currentSort.order = 'desc';
            }
            getReadingList();
        });
    });
}

// 初始化搜索功能
function initSearch() {
    const searchInput = document.getElementById('search-input');
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchQuery = e.target.value.trim();
            getReadingList();
        }, 300); // 300ms 防抖
    });
}

// 初始化标签页
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            getReadingList();
        });
    });
}

// 更新所有状态
async function updateAllStates() {
    await Promise.all([
        getReadingList(),
        updateAddButtonState()
    ]);
}

// 页面加载时的初始化
document.addEventListener('DOMContentLoaded', () => {
    updateAllStates(); // 初始化状态
    document.getElementById('add-current').addEventListener('click', addCurrentTab);
    initSortButtons();
    initSearch();
    initTabs();
});

// 监听标签页变化
chrome.tabs.onActivated.addListener(() => {
    updateAddButtonState(); // 当切换标签页时更新按钮状态
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
        updateAddButtonState(); // 当URL改变时更新按钮状态
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // 选择按钮
    const alreadyReadButton = document.getElementById('alreadyread');
    const haveNotReadButton = document.getElementById('havenotread');

    // 选择阅读列表
    const readingList = document.getElementById('reading-list');

    // 创建 Web Worker
    const worker = new Worker(chrome.runtime.getURL('batchWorker.js'));

    // 监听 Web Worker 消息
    worker.onmessage = function(event) {
        const { batch, readStatus, done } = event.data;

        if (batch) {
            // 更新 DOM
            batch.forEach(url => {
                const item = readingList.querySelector(`a[href="${url}"]`).parentElement;
                if (readStatus) {
                    item.classList.add('read');
                } else {
                    item.classList.remove('read');
                }
                toggleReadStatus(url, !readStatus);
            });
        }

        if (done) {
            requestAnimationFrame(updateAllStates); // 使用 requestAnimationFrame
        }
    };

    // 批量更新阅读状态
    function batchUpdateReadStatus(items, readStatus) {
        const urls = Array.from(items).map(item => item.querySelector('a').href);//获取所有url
        const batchSize = 100; // 每批处理的项目数量

        // 发送任务到 Web Worker
        worker.postMessage({ urls, readStatus, batchSize });
    }

    // “全部已读”按钮功能
    alreadyReadButton.addEventListener('click', function() {
        const unreadItems = readingList.querySelectorAll('.reading-item:not(.read)');
        batchUpdateReadStatus(unreadItems, true);
    });

    // “全部未读”按钮功能
    haveNotReadButton.addEventListener('click', function() {
        const readItems = readingList.querySelectorAll('.reading-item.read');
        batchUpdateReadStatus(readItems, false);
    });
});
