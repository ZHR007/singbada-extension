document.addEventListener('DOMContentLoaded', () => {
  const autoQueryToggle = document.getElementById('autoQueryToggle');
  const autoFillToggle = document.getElementById('autoFillToggle');
  const statusText = document.getElementById('statusText');
  const produceTimeDaysInput = document.getElementById('produceTimeDays');

  // Load saved state
  chrome.storage.local.get(['autoQuery', 'autoFillProducer', 'defaultProduceTimeDays'], (result) => {
    const isAutoQuery = result.autoQuery || false;
    const isAutoFill = result.autoFillProducer !== false; // 默认启用
    const defaultProduceTimeDays = Number.isFinite(Number(result.defaultProduceTimeDays)) ? Number(result.defaultProduceTimeDays) : 3;
    
    autoQueryToggle.checked = isAutoQuery;
    autoFillToggle.checked = isAutoFill;
    if (produceTimeDaysInput) produceTimeDaysInput.value = String(defaultProduceTimeDays);
    updateStatusText(isAutoQuery);
  });

  // Listen for auto query changes
  autoQueryToggle.addEventListener('change', () => {
    const isAuto = autoQueryToggle.checked;
    chrome.storage.local.set({ autoQuery: isAuto }, () => {
      updateStatusText(isAuto);
    });
  });

  // Listen for auto fill changes
  autoFillToggle.addEventListener('change', () => {
    const isAutoFill = autoFillToggle.checked;
    chrome.storage.local.set({ autoFillProducer: isAutoFill });
  });

  if (produceTimeDaysInput) {
    const saveProduceTimeDays = () => {
      const raw = Number(produceTimeDaysInput.value);
      const v = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      produceTimeDaysInput.value = String(v);
      chrome.storage.local.set({ defaultProduceTimeDays: v });
    };

    produceTimeDaysInput.addEventListener('change', saveProduceTimeDays);
    produceTimeDaysInput.addEventListener('blur', saveProduceTimeDays);
  }

  function updateStatusText(isAuto) {
    statusText.textContent = isAuto ? '当前模式：自动查询' : '当前模式：手动查询';
  }
});
