<template>
  <div class="fixed-header">
    <div class="search-container">
      <input type="text" id="search-input" v-model="searchQuery" placeholder="搜索标题或网址..." />
    </div>
    <div class="sort-controls">
      <button class="sort-btn" :class="{ active: currentSort.field === 'creationTime' }" @click="toggleSort('creationTime')">
        创建时间 {{ currentSort.field === 'creationTime' ? (currentSort.order === 'desc' ? '▼' : '▲') : '▼' }}
      </button>
      <button class="sort-btn" :class="{ active: currentSort.field === 'lastUpdateTime' }" @click="toggleSort('lastUpdateTime')">
        更新时间 {{ currentSort.field === 'lastUpdateTime' ? (currentSort.order === 'desc' ? '▼' : '▲') : '▼' }}
      </button>
    </div>
    <div class="tabs-section">
      <div class="tabs">
        <div class="tab" :class="{ active: currentTab === 'all' }" @click="currentTab = 'all'">全部</div>
        <div class="tab" :class="{ active: currentTab === 'unread' }" @click="currentTab = 'unread'">未读</div>
        <div class="tab" :class="{ active: currentTab === 'read' }" @click="currentTab = 'read'">已读</div>
      </div>
      <div class="stats-readmanage">
        <div class="stats">总计: {{ stats.total }} | 已读: {{ stats.read }} | 未读: {{ stats.unread }}</div>
        <div class="readmanagebutton">
          <button id="alreadyread" class="action-btn read-all" @click="batchUpdate(true)">全部已读</button>
          <button id="havenotread" class="action-btn unread-all" @click="batchUpdate(false)">全部未读</button>
        </div>
      </div>
    </div>
  </div>

  <div id="reading-list">
    <div v-if="filteredItems.length === 0" class="no-results">没有找到匹配的结果</div>
    <div v-for="item in filteredItems" :key="item.url" :class="['reading-item', { read: item.hasBeenRead }]">
      <a :href="item.url" target="_blank" v-html="highlightText(item.title)"></a>
      <span class="read-toggle" @click="toggleReadStatus(item.url, item.hasBeenRead)">
        {{ item.hasBeenRead ? '标记为未读' : '标记为已读' }}
      </span>
      <span class="delete-btn" @click="deleteEntry(item.url)">删除</span>
      <div style="font-size: 12px; color: #666;" v-html="highlightText(item.url)"></div>
      <div>创建时间: {{ new Date(item.creationTime).toLocaleString() }}</div>
      <div>更新时间: {{ new Date(item.lastUpdateTime).toLocaleString() }}</div>
    </div>
  </div>

  <div class="fixed-footer">
    <button id="add-current" :disabled="addDisabled" @click="addCurrentTab">{{ addButtonText }}</button>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';

const items = ref([]);
const currentSort = reactive({ field: 'creationTime', order: 'desc' });
const searchQuery = ref('');
const currentTab = ref('all');
const stats = reactive({ total: 0, read: 0, unread: 0 });
const addDisabled = ref(true);
const addButtonText = ref('添加当前标签页');

const worker = new Worker(chrome.runtime.getURL('batchWorker.js'));
worker.onmessage = (event) => {
  const { batch, readStatus, done } = event.data;
  if (batch) {
    batch.forEach(url => {
      const item = items.value.find(i => i.url === url);
      if (item) {
        item.hasBeenRead = readStatus;
      }
      chrome.readingList.updateEntry({ url, hasBeenRead: readStatus });
    });
  }
  if (done) {
    updateAllStates();
  }
};

function getCurrentTab() {
  return chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => tab);
}

async function updateAddButtonState() {
  try {
    const tab = await getCurrentTab();
    if (!tab) {
      addDisabled.value = true;
      addButtonText.value = '无法获取当前页面';
      return;
    }
    const existing = await chrome.readingList.query({});
    const isDuplicate = existing.some(item => item.url === tab.url);
    addDisabled.value = isDuplicate;
    addButtonText.value = isDuplicate ? '已在阅读列表中' : '添加当前标签页';
  } catch (e) {
    console.error('更新按钮状态失败:', e);
  }
}

async function addCurrentTab() {
  addDisabled.value = true;
  try {
    const tab = await getCurrentTab();
    if (tab) {
      await chrome.readingList.addEntry({
        title: tab.title,
        url: tab.url,
        hasBeenRead: false
      });
      addButtonText.value = '已添加';
      await updateAllStates();
    }
  } catch (e) {
    console.error('添加失败:', e);
    addDisabled.value = false;
  }
}

function highlightText(text) {
  if (!searchQuery.value) return text;
  const regex = new RegExp(`(${searchQuery.value})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}

const filteredItems = computed(() => {
  return items.value
    .filter(item => {
      const matchesTab = currentTab.value === 'all' ||
        (currentTab.value === 'read' && item.hasBeenRead) ||
        (currentTab.value === 'unread' && !item.hasBeenRead);
      const q = searchQuery.value.toLowerCase();
      const matchesSearch = !q ||
        item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      const timeA = a[currentSort.field];
      const timeB = b[currentSort.field];
      return currentSort.order === 'desc' ? timeB - timeA : timeA - timeB;
    });
});

async function getReadingList() {
  try {
    const all = await chrome.readingList.query({});
    items.value = all;
    updateStats();
  } catch (e) {
    console.error('获取阅读列表失败:', e);
  }
}

function updateStats() {
  const total = items.value.length;
  const read = items.value.filter(i => i.hasBeenRead).length;
  stats.total = total;
  stats.read = read;
  stats.unread = total - read;
}

async function toggleReadStatus(url, currentStatus) {
  try {
    await chrome.readingList.updateEntry({ url, hasBeenRead: !currentStatus });
    await updateAllStates();
  } catch (e) {
    console.error('更新状态失败:', e);
  }
}

async function deleteEntry(url) {
  try {
    await chrome.readingList.removeEntry({ url });
    await updateAllStates();
  } catch (e) {
    console.error('删除失败:', e);
  }
}

function batchUpdate(readStatus) {
  const urls = filteredItems.value
    .filter(item => item.hasBeenRead !== readStatus)
    .map(item => item.url);
  const batchSize = 100;
  worker.postMessage({ urls, readStatus, batchSize });
}

function toggleSort(field) {
  if (currentSort.field === field) {
    currentSort.order = currentSort.order === 'desc' ? 'asc' : 'desc';
  } else {
    currentSort.field = field;
    currentSort.order = 'desc';
  }
}

function initTabListeners() {
  chrome.tabs.onActivated.addListener(() => updateAddButtonState());
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      updateAddButtonState();
    }
  });
}

async function updateAllStates() {
  await Promise.all([getReadingList(), updateAddButtonState()]);
}

onMounted(() => {
  updateAllStates();
  initTabListeners();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding-top: 180px;
  padding-bottom: 60px;
  height: 100vh;
  overflow: hidden;
}

.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: white;
  z-index: 100;
  border-bottom: 1px solid #eee;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.search-container {
  padding: 10px;
  background: white;
}

#search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

#search-input:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 3px rgba(76, 175, 80, 0.3);
}

.sort-controls {
  padding: 10px;
  display: flex;
  gap: 10px;
  background: white;
}

.sort-btn {
  padding: 6px 12px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.sort-btn.active {
  background-color: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.tabs-section {
  background: white;
  padding: 0 10px;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
}

.tab {
  padding: 8px 16px;
  cursor: pointer;
  border: 1px solid transparent;
  border-bottom: none;
  margin-bottom: -1px;
  font-size: 14px;
}

.tab.active {
  background-color: white;
  border-color: #ddd;
  border-bottom-color: white;
  color: #4CAF50;
}

.stats-readmanage {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.stats {
  font-size: 13px;
  color: #666;
}

.readmanagebutton {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 6px 12px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

#reading-list {
  padding: 10px;
  height: calc(100vh - 180px - 60px);
  overflow-y: auto;
}

.reading-item {
  border-top: 1px solid #eee;
  padding: 10px 0;
  font-size: 14px;
}

.reading-item a {
  color: #333;
  text-decoration: none;
  display: block;
  margin-bottom: 4px;
}

.reading-item.read {
  opacity: 0.7;
}

.reading-item.read a {
  color: #666;
}

.read-toggle,
.delete-btn {
  color: #666;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  margin-right: 8px;
}

.read-toggle:hover,
.delete-btn:hover {
  background-color: #f0f0f0;
}

.delete-btn {
  color: #dc3545;
}

.time-info {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.fixed-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: white;
  border-top: 1px solid #eee;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
}

#add-current {
  width: 100%;
  padding: 10px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

#add-current:hover {
  background-color: #45a049;
}

#add-current:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.highlight {
  background-color: #fff3cd;
  padding: 2px;
  border-radius: 2px;
}

.no-results {
  padding: 20px;
  text-align: center;
  color: #666;
}

.reading-item:first-child {
  border-top: none;
  padding-top: 0;
}
</style>
