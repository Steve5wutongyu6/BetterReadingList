self.onmessage = async function(event) {
    const { urls, readStatus, batchSize } = event.data;

    const promises = []; // 存储所有的 Promise

    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);

        // 处理每个批次的更新
        const promise = (async () => {
            // 通知主线程更新状态
            self.postMessage({ batch, readStatus });

            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 0));
        })();

        promises.push(promise); // 将 Promise 添加到数组中
    }

    // 等待所有的 Promise 完成
    await Promise.all(promises);

    // 通知主线程任务完成
    self.postMessage({ done: true });
};