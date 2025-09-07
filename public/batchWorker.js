self.onmessage = async function(event) {
    const { urls, readStatus, batchSize } = event.data;

    const promises = [];

    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);

        const promise = (async () => {
            self.postMessage({ batch, readStatus });
            await new Promise(resolve => setTimeout(resolve, 0));
        })();

        promises.push(promise);
    }

    await Promise.all(promises);

    self.postMessage({ done: true });
};
