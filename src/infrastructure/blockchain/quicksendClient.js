let quicksendModulePromise = null;

function loadQuicksendModule() {
    if (!quicksendModulePromise) {
        quicksendModulePromise = import('ecash-quicksend');
    }
    return quicksendModulePromise;
}

async function getQuicksendApi() {
    const module = await loadQuicksendModule();
    if (module?.default && typeof module.default === 'object') {
        return { ...module.default, ...module };
    }
    return module;
}

module.exports = {
    getQuicksendApi,
};
