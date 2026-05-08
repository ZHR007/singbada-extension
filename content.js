// content.js

console.log('Singbada Factory Info Helper: Content script loaded.');

let observer = null;
const PROCESSED_ATTRIBUTE = 'data-singbada-helper-processed';
let isAutoQueryEnabled = false;

// Initialize
function init() {
  // Load settings
  chrome.storage.local.get(['autoQuery'], (result) => {
    isAutoQueryEnabled = result.autoQuery || false;
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.autoQuery) {
      isAutoQueryEnabled = changes.autoQuery.newValue;
    }
  });

  // Initial check
  scanForOrderInfo();

  // Set up observer for SPA navigation/modal opening
  observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      // Debounce slightly to avoid performance hit
      setTimeout(scanForOrderInfo, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Scans the page for the Order ID element and injects the button.
 */
function scanForOrderInfo() {
  // Strategy 1: Find by text "订单编号"
  // This is the most robust method for text-based UI
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes('订单编号')) {
      const labelElement = node.parentElement;
      
      // Avoid processing if already processed or hidden
      if (labelElement.offsetParent === null) continue; // Hidden

      // Try to find the container row/wrapper
      // Usually: <div> <label>订单编号</label> <span>12345</span> </div>
      // Or: <div>订单编号: 12345</div>
      
      const container = labelElement.parentElement;
      if (!container || container.getAttribute(PROCESSED_ATTRIBUTE)) continue;

      // Try to extract the ID from the container text
      // Look for a sequence of digits (8-20 length) that is NOT the label
      const fullText = container.textContent;
      // Regex: Look for digits after "订单编号"
      const match = fullText.match(/订单编号\s*[:：]?\s*(\d{5,})/);
      
      if (match && match[1]) {
        const orderId = match[1];
        injectButton(container, orderId);
      } else {
        // Maybe the value is in a sibling element (as per screenshot)
        // Check next sibling element
        let nextSibling = labelElement.nextElementSibling;
        if (nextSibling && nextSibling.textContent.match(/^\d+$/)) {
             injectButton(nextSibling.parentElement, nextSibling.textContent.trim());
        }
      }
    }
  }
  
  // Strategy 2: User provided specific selector (Fallback)
  // Note: Data attributes like data-v-ae105d90 are often generated and change on build.
  // We use it cautiously.
  const specificSpans = document.querySelectorAll('span[data-v-ae105d90]');
  specificSpans.forEach(span => {
      if (span.offsetParent !== null && !span.parentElement.getAttribute(PROCESSED_ATTRIBUTE)) {
          const text = span.textContent.trim();
          if (/^\d+$/.test(text)) {
              // Verify context - is "订单编号" nearby?
              const prev = span.previousElementSibling;
              if (prev && prev.textContent.includes('订单编号')) {
                   injectButton(span.parentElement, text);
              }
          }
      }
  });
}

/**
 * Injects the action button next to the order ID
 * @param {HTMLElement} containerElement The element to append the button to
 * @param {string} orderId The extracted order ID
 */
function injectButton(containerElement, orderId) {
  if (containerElement.getAttribute(PROCESSED_ATTRIBUTE)) return;
  
  containerElement.setAttribute(PROCESSED_ATTRIBUTE, 'true');
  containerElement.style.position = 'relative'; // Ensure positioning context

  const button = document.createElement('button');
  button.className = 'singbada-helper-btn';
  button.textContent = '获取排单信息';
  button.title = `查询订单 ${orderId} 的加工厂信息`;
  
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    fetchFactoryInfo(orderId, button);
  });

  containerElement.appendChild(button);

  // Auto-query if enabled
  if (isAutoQueryEnabled) {
      fetchFactoryInfo(orderId, button);
  }
}

/**
 * Calls background script to fetch data
 */
function fetchFactoryInfo(orderId, btnElement) {
  btnElement.classList.add('loading');
  btnElement.textContent = '查询中...';

  chrome.runtime.sendMessage(
    { type: 'FETCH_FACTORY_INFO', orderId: orderId },
    (response) => {
      btnElement.classList.remove('loading');
      btnElement.textContent = '获取排单信息';

      if (chrome.runtime.lastError) {
        showResultPanel(null, '插件通信错误: ' + chrome.runtime.lastError.message, true);
        return;
      }

      if (response.success) {
        processAndShowData(response.data);
      } else {
        showResultPanel(null, '请求失败: ' + response.error, true);
      }
    }
  );
}

/**
 * Process the API response and display
 */
function processAndShowData(data) {
  // 优先查找包含"车缝"的加工项目的加工方
  let producerName = findProducerByKeyword(data, '车缝');
  
  // 如果没找到特定加工方，回退到原来的查找方式
  if (!producerName) {
    producerName = findValueByKey(data, 'producer');
  }

  if (!producerName) {
      showResultPanel(null, '未在返回数据中找到加工方(producer)信息', true);
  } else {
      showResultPanel({
          producer: producerName,
          raw: data 
      });
  }
}

/**
 * 查找包含指定关键词（如"车缝"）的对象的加工方信息
 * @param {Object|Array} obj 数据对象
 * @param {string} keyword 关键词
 * @returns {string|null} 加工方名称
 */
function findProducerByKeyword(obj, keyword) {
  if (obj === null || obj === undefined) return null;

  // 如果是字符串，尝试解析JSON
  if (typeof obj === 'string') {
    if ((obj.trim().startsWith('{') && obj.trim().endsWith('}')) || 
        (obj.trim().startsWith('[') && obj.trim().endsWith(']'))) {
      try {
        return findProducerByKeyword(JSON.parse(obj), keyword);
      } catch (e) {}
    }
    return null;
  }

  if (typeof obj !== 'object') return null;

  // 1. 检查当前对象是否同时包含关键词和producer
  // 遍历当前对象的所有值，看是否有包含关键词的
  let hasKeyword = false;
  let currentProducer = null;

  if (!Array.isArray(obj)) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        
        // 检查key是否是producer
        if (key.toLowerCase().includes('producer')) {
          currentProducer = value;
        }
        
        // 检查value是否包含关键词（只检查字符串类型的值）
        if (typeof value === 'string' && value.includes(keyword)) {
          hasKeyword = true;
        }
      }
    }

    // 如果当前对象既有关键词又有producer，直接返回
    if (hasKeyword && currentProducer) {
      return currentProducer;
    }
  }

  // 2. 递归查找子对象
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = findProducerByKeyword(obj[key], keyword);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Recursively finds the value for a given key in a nested object or array.
 * Returns the first non-empty value found.
 * Handles cases where values might be JSON strings.
 * @param {Object|Array|string} obj The object to search
 * @param {string} keyToFind The key to search for
 * @returns {any} The value found or null
 */
function findValueByKey(obj, keyToFind) {
  if (obj === null || obj === undefined) {
    return null;
  }

  // Attempt to parse string if it looks like JSON (starts with { or [)
  if (typeof obj === 'string') {
      const trimmed = obj.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
              const parsed = JSON.parse(obj);
              return findValueByKey(parsed, keyToFind);
          } catch (e) {
              // Not valid JSON, treat as normal string
          }
      }
      return null;
  }

  if (typeof obj !== 'object') {
    return null;
  }

  // Check if current object has the key
  if (keyToFind in obj) {
      if (obj[keyToFind]) {
          return obj[keyToFind];
      }
  }

  // Iterate over keys
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = findValueByKey(obj[key], keyToFind);
      if (result) {
        return result;
      }
    }
  }

  return null;
}


/**
 * Display the floating result panel
 */
function showResultPanel(info, errorMessage = null, isError = false) {
  // Remove existing panel
  const existing = document.querySelector('.singbada-result-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.className = 'singbada-result-panel';
  if (isError) panel.classList.add('singbada-error');

  const header = document.createElement('div');
  header.className = 'singbada-result-header';
  header.innerHTML = `
    <span>${isError ? '查询出错' : '排单信息'}</span>
    <span class="singbada-result-close">&times;</span>
  `;
  
  header.querySelector('.singbada-result-close').onclick = () => panel.remove();
  panel.appendChild(header);

  const content = document.createElement('div');
  content.className = 'singbada-result-content';

  if (errorMessage) {
    content.innerHTML = `<div style="color:red">${errorMessage}</div>`;
  } else {
    content.innerHTML = `
      <div class="singbada-info-row">
        <span class="singbada-label">加工方:</span>
        <span class="singbada-value highlight">${info.producer}</span>
      </div>
      <div style="margin-top: 10px;">
        <button id="singbada-manual-fill" class="singbada-manual-btn">手动填充到输入框</button>
      </div>
    `;
    
    // 自动填充加工方名称到输入框
    autoFillProducerName(info.producer);
    
    // 添加手动填充按钮事件
    setTimeout(() => {
      const manualBtn = document.getElementById('singbada-manual-fill');
      if (manualBtn) {
        manualBtn.addEventListener('click', () => {
          const input = findProducerInput();
          if (input) {
            chrome.storage.local.get(['defaultProduceTimeDays'], (result) => {
              const days = Number.isFinite(Number(result.defaultProduceTimeDays)) ? Number(result.defaultProduceTimeDays) : 3;
              selectElementOption(input, info.producer, { defaultProduceTimeDays: days });
            });
            
            // 视觉反馈
            input.style.border = '2px solid #4CAF50';
            setTimeout(() => {
              input.style.border = '';
            }, 2000);
            
            manualBtn.textContent = '已填充!';
            manualBtn.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
              manualBtn.textContent = '手动填充到输入框';
              manualBtn.style.backgroundColor = '';
            }, 2000);
          } else {
            alert('未找到加工方输入框，请手动复制：' + info.producer);
          }
        });
      }
    }, 100);
  }

  panel.appendChild(content);
  document.body.appendChild(panel);

  // Auto hide after 10 seconds if success
  if (!isError) {
      setTimeout(() => {
          if (document.body.contains(panel)) panel.remove();
      }, 10000);
  }
}

function showToastMessage(message, isError = false) {
  const existing = document.querySelector('.singbada-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'singbada-toast';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '10001';
  toast.style.padding = '10px 14px';
  toast.style.borderRadius = '6px';
  toast.style.background = isError ? '#ff4d4f' : '#333';
  toast.style.color = '#fff';
  toast.style.fontSize = '13px';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  toast.style.maxWidth = '80vw';
  toast.style.whiteSpace = 'nowrap';
  toast.style.overflow = 'hidden';
  toast.style.textOverflow = 'ellipsis';

  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 2500);
}

/**
 * 自动填充加工方名称到输入框
 * @param {string} producerName 加工方名称
 */
function autoFillProducerName(producerName, retryCount = 0) {
  const MAX_RETRIES = 15;
  const RETRY_DELAY = 500;

  const targetInput = findProducerInput();

  if (targetInput) {
    chrome.storage.local.get(['autoFillProducer', 'defaultProduceTimeDays'], (result) => {
      if (result.autoFillProducer !== false) {
        console.log('尝试填充加工方:', producerName, '(第' + (retryCount + 1) + '次尝试)');
        const days = Number.isFinite(Number(result.defaultProduceTimeDays)) ? Number(result.defaultProduceTimeDays) : 3;
        selectElementOption(targetInput, producerName, { defaultProduceTimeDays: days });
      }
    });
  } else if (retryCount < MAX_RETRIES) {
    console.log('未找到加工方输入框，' + RETRY_DELAY + 'ms后重试 (' + (retryCount + 1) + '/' + MAX_RETRIES + ')');
    setTimeout(() => autoFillProducerName(producerName, retryCount + 1), RETRY_DELAY);
  } else {
    console.log('未找到加工方输入框，已重试' + MAX_RETRIES + '次，放弃自动填充');
  }
}

/**
 * 模拟 Element UI Select 的选择操作
 * @param {HTMLElement} inputElement 输入框元素
 * @param {string} valueToSelect 要选择的值
 * @param {Object} options 额外配置
 */
function selectElementOption(inputElement, valueToSelect, options = {}) {
  const triggerMouseEvent = (el, type, extraOpts) => {
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = Object.assign({
        bubbles: true, cancelable: true, composed: true, view: window,
        button: 0, clientX: x, clientY: y, screenX: x, screenY: y
      }, extraOpts || {});
      el.dispatchEvent(new MouseEvent(type, opts));
    } catch (e) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  };

  const triggerPointerEvent = (el, type, extraOpts) => {
    if (!el || typeof PointerEvent === 'undefined') return;
    try {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = Object.assign({
        bubbles: true, cancelable: true, composed: true, view: window,
        button: 0, clientX: x, clientY: y, screenX: x, screenY: y,
        pointerType: 'mouse', isPrimary: true, pointerId: 1
      }, extraOpts || {});
      el.dispatchEvent(new PointerEvent(type, opts));
    } catch (e) {}
  };

  const setNativeValue = (el, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const setter = descriptor && descriptor.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  };

  // 通过注入脚本到页面主世界，直接调用 Vue 实例的 toggleMenu()
  // Element UI Select 组件在某些情况下对程序化事件不响应，但访问 __vue__.toggleMenu() 是最可靠的方式
  const tryOpenViaVue = () => {
    const elSelect = inputElement.closest('.el-select');
    if (!elSelect) return false;
    const marker = 'sgb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    elSelect.setAttribute('data-singbada-marker', marker);
    try {
      const script = document.createElement('script');
      script.textContent =
        '(function(){try{' +
        'var el=document.querySelector(\'[data-singbada-marker="' + marker + '"]\');' +
        'if(!el||!el.__vue__)return;' +
        'var vm=el.__vue__;' +
        'if(vm.selectDisabled||vm.visible)return;' +
        'if(typeof vm.toggleMenu==="function")vm.toggleMenu();' +
        'else if("visible" in vm)vm.visible=true;' +
        'el.setAttribute("data-singbada-success","1");' +
        '}catch(e){console.error("[Singbada] Vue toggle failed:",e);}})();';
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      const success = elSelect.getAttribute('data-singbada-success') === '1';
      elSelect.removeAttribute('data-singbada-marker');
      elSelect.removeAttribute('data-singbada-success');
      return success;
    } catch (e) {
      try { elSelect.removeAttribute('data-singbada-marker'); } catch (e2) {}
      console.log('[Singbada] Script injection failed:', e);
      return false;
    }
  };

  let vueAttempted = false;
  let vueSuccess = false;
  let vueAttemptTime = 0;
  let lastEventDispatch = 0;

  const ensureDropdownOpen = () => {
    if (getVisibleDropdown()) return;

    // 策略1：优先尝试通过 Vue 实例直接打开（只尝试一次，因为 toggleMenu 是切换语义）
    if (!vueAttempted) {
      vueAttempted = true;
      vueSuccess = tryOpenViaVue();
      vueAttemptTime = Date.now();
      if (vueSuccess) return; // 等待 Vue 响应式更新 DOM
    }

    // 如果 Vue 方式声称成功，信任它最多 1 秒（避免事件方式误触发关闭）
    if (vueSuccess && Date.now() - vueAttemptTime < 1000) return;

    // 策略2：事件防抖（每 500ms 最多触发一次，避免快速重复点击导致 toggle 闪烁）
    const now = Date.now();
    if (now - lastEventDispatch < 500) return;
    lastEventDispatch = now;

    // 策略2实施：模拟真实的鼠标点击事件（包含 PointerEvent + 坐标信息）
    const elSelect = inputElement.closest('.el-select');
    const elInput = inputElement.closest('.el-input');

    const realClick = (el) => {
      if (!el) return;
      triggerPointerEvent(el, 'pointerdown', { buttons: 1 });
      triggerMouseEvent(el, 'mousedown', { buttons: 1 });
      triggerPointerEvent(el, 'pointerup', { buttons: 0 });
      triggerMouseEvent(el, 'mouseup', { buttons: 0 });
      triggerMouseEvent(el, 'click', { buttons: 0 });
    };

    [inputElement, elInput, elSelect].forEach(target => {
      if (target) realClick(target);
    });
    inputElement.focus();
  };

  const getVisibleDropdown = () => {
    const dropdowns = document.querySelectorAll('.el-select-dropdown');
    for (let i = dropdowns.length - 1; i >= 0; i--) {
      const dd = dropdowns[i];
      // Check visibility
      if (dd.style.display !== 'none' && !dd.hidden && dd.offsetWidth > 0) return dd;
    }
    return null;
  };

  const getVisibleOptions = (dropdown) => {
    if (!dropdown) return [];
    return Array.from(dropdown.querySelectorAll('.el-select-dropdown__item'))
      .filter(option => option.style.display !== 'none' && !option.classList.contains('is-disabled'));
  };

  const resolveRowIndex = () => {
    const id = (inputElement && inputElement.id) ? String(inputElement.id) : '';
    const m = id.match(/tableData\.(\d+)\./);
    if (m && m[1]) return m[1];
    const label = inputElement ? inputElement.closest('.el-form-item')?.querySelector('label[for]') : null;
    const forId = label ? String(label.getAttribute('for') || '') : '';
    const m2 = forId.match(/tableData\.(\d+)\./);
    if (m2 && m2[1]) return m2[1];
    return null;
  };

  const fillProduceTimeDays = (days) => {
    const n = Number(days);
    if (!Number.isFinite(n)) return;
    const v = String(Math.max(0, Math.floor(n)));
    const idx = resolveRowIndex();
    const trySetInput = (el) => {
      if (!el) return false;
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
      el.focus();
      setNativeValue(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
      return true;
    };

    if (idx !== null) {
      const targetId = `tableData.${idx}.out_produce_time`;
      const direct = document.getElementById(targetId);
      if (trySetInput(direct)) return;
      const escapedId = (window.CSS && CSS.escape) ? CSS.escape(targetId) : targetId.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
      const byQuery = document.querySelector(`#${escapedId}`);
      if (trySetInput(byQuery)) return;
    }

    let scope = inputElement ? inputElement.closest('.mock-row') : null;
    if (!scope) scope = inputElement ? (inputElement.closest('.el-table__row') || inputElement.closest('.el-row') || inputElement.closest('tr')) : null;
    if (!scope) scope = inputElement ? inputElement.parentElement : null;
    for (let i = 0; i < 6 && scope; i++) {
      const label = Array.from(scope.querySelectorAll('label.el-form-item__label, label')).find(l => (l.textContent || '').includes('生产时长'));
      if (label) {
        const forId = label.getAttribute('for');
        if (forId) {
          const escaped = (window.CSS && CSS.escape) ? CSS.escape(forId) : forId.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
          const byId = scope.querySelector(`#${escaped}`) || document.querySelector(`#${escaped}`);
          if (trySetInput(byId)) return;
        }
        const formItem = label.closest('.el-form-item');
        if (formItem) {
          const input = formItem.querySelector('input, textarea');
          if (trySetInput(input)) return;
        }
      }
      scope = scope.parentElement;
    }
  };

  const dispatchTyping = (el) => {
    el.focus();
    setNativeValue(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    let commandSuccess = false;
    try {
        commandSuccess = document.execCommand('insertText', false, valueToSelect);
    } catch (e) {
        console.log('execCommand failed, falling back to event simulation');
    }

    if (!commandSuccess || el.value !== valueToSelect) {
        setNativeValue(el, valueToSelect);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));
  };

  let finished = false;
  let typed = false;
  let clicked = false;
  const startedAt = Date.now();
  const queryText = (valueToSelect || '').trim();
  const produceTimeDays = options && Object.prototype.hasOwnProperty.call(options, 'defaultProduceTimeDays') ? options.defaultProduceTimeDays : undefined;

  const processStep = () => {
    if (finished) return;
    
    // Timeout check
    if (Date.now() - startedAt > 5000) {
        finished = true;
        console.log('Timeout in selectElementOption');
        return;
    }

    if (!queryText) {
      finished = true;
      return;
    }

    const dropdown = getVisibleDropdown();

    if (!dropdown) {
      ensureDropdownOpen();
      return;
    }

    if (!typed) {
      const candidateInputs = Array.from(dropdown.querySelectorAll('input.el-input__inner, input[type="text"]'));
      const filterInput = candidateInputs.find(i => !i.readOnly && i.offsetParent !== null) || candidateInputs[0] || null;
      if (filterInput) {
        dispatchTyping(filterInput);
        typed = true;
      } else if (!inputElement.readOnly) {
        triggerMouseEvent(inputElement, 'click');
        dispatchTyping(inputElement);
        typed = true;
      }
      return;
    }

    if (clicked) {
      finished = true;
      return;
    }

    const options = getVisibleOptions(dropdown);
    const hasEmptyText = dropdown.textContent.includes('无数据') || dropdown.textContent.includes('无匹配');
    const emptyEl = dropdown.querySelector('.el-select-dropdown__empty');

    if (options.length === 0) {
      if (emptyEl || hasEmptyText || Date.now() - startedAt > 2200) {
        finished = true;
        showToastMessage('未找到匹配加工方！', true);
      }
      return;
    }

    const matched = options.find(option => (option.textContent || '').trim().includes(queryText)) || null;
    if (!matched) {
      finished = true;
      showToastMessage('未找到匹配加工方！', true);
      return;
    }

    const firstText = (options[0].textContent || '').trim();
    if (firstText.includes('裁床车间')) {
      finished = true;
      return;
    }

    clicked = true;
    triggerMouseEvent(matched, 'mouseenter');
    triggerMouseEvent(matched, 'mousedown');
    triggerMouseEvent(matched, 'mouseup');
    triggerMouseEvent(matched, 'click');

    setTimeout(() => {
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      inputElement.blur();
      triggerMouseEvent(document.body, 'mousedown');
      triggerMouseEvent(document.body, 'mouseup');
      triggerMouseEvent(document.body, 'click');
      if (produceTimeDays !== undefined) fillProduceTimeDays(produceTimeDays);
      finished = true;
    }, 80);
  };

  // Start the polling loop
  const intervalId = setInterval(() => {
    processStep();
    if (finished) {
        clearInterval(intervalId);
    }
  }, 100);
}

/**
 * 查找加工方相关的输入框
 * 优先查找“加工项目”为“车缝”的行对应的加工方输入框
 * @returns {HTMLElement|null} 输入框元素
 */
function findProducerInput() {
  const reasonablePriceBlocks = Array.from(document.querySelectorAll('div.item.flex')).filter(el => el.textContent.includes('合理价'));
  for (const priceBlock of reasonablePriceBlocks) {
    let container = priceBlock;
    for (let i = 0; i < 10; i++) {
      if (!container || container === document.body) break;

      const producerLabels = Array.from(container.querySelectorAll('label.el-form-item__label')).filter(l => {
        const text = l.textContent.trim();
        // Strict check: Must contain "加工方" and MUST NOT contain "加工项目"
        if (!text.includes('加工方')) return false;
        if (text.includes('加工项目')) return false;

        const forId = l.getAttribute('for') || '';
        if (!forId) return true;
        return forId.includes('sewing_factory_id_location');
      });
      for (const label of producerLabels) {
        const forId = label.getAttribute('for');
        if (forId) {
          const escapedId = (window.CSS && CSS.escape) ? CSS.escape(forId) : forId.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
          const byId = container.querySelector(`#${escapedId}`);
          if (byId && byId.tagName === 'INPUT') return byId;
        }

        const formItem = label.closest('.el-form-item');
        if (formItem) {
          const input = formItem.querySelector('input.el-input__inner');
          if (input) return input;
        }

        const sibling = label.nextElementSibling;
        if (sibling) {
          const input = sibling.querySelector ? sibling.querySelector('input.el-input__inner') : null;
          if (input) return input;
        }
      }

      container = container.parentElement;
    }
  }

  // 策略2: 精确查找“加工项目：车缝”对应的加工方 (作为备选)
  // ... (保留之前的逻辑)
  
  // 策略2: 精确查找“加工项目：车缝”对应的加工方 (作为备选)
  // ... (保留之前的逻辑)
  
  // 辅助函数：判断文本是否包含“加工项目”
  const isProjectLabel = (text) => text.includes('加工项目');
  
  const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node2;
  const projectNodes = [];
  while (node2 = walker2.nextNode()) {
    if (isProjectLabel(node2.textContent)) {
      projectNodes.push(node2);
    }
  }
  
  for (const pNode of projectNodes) {
    // 找到“加工项目”的容器
    // 通常结构：
    // <div class="form-item"> <label>加工项目</label> <div class="content"> ... </div> </div>
    // 或者
    // <div> <span>加工项目：</span> <span>车缝</span> </div>
    
    const labelContainer = pNode.parentElement; // label 或 span
    const formItem = labelContainer.closest('.el-form-item') || labelContainer.parentElement;
    
    if (!formItem) continue;
    
    // 检查该表单项的值是否是“车缝”
    // 1. 检查 input value
    const input = formItem.querySelector('input');
    const inputValue = input ? input.value : '';
    // 2. 检查显示文本（如果是 readonly 或 span 显示）
    const textContent = formItem.textContent;
    
    // 判断是否包含“车缝”
    if (inputValue.includes('车缝') || textContent.includes('车缝')) {
      console.log('找到“加工项目：车缝”所在区域');
      
      // 找到了“加工项目：车缝”。现在需要找到同一行/同一组的“加工方”。
      // 假设它们在同一个父容器中（比如一行 .el-row，或者一个 .card）
      // 我们向上找几层，然后在该范围内找“加工方”
      
      // 尝试向上找 2-3 层，找到包含“加工方”的容器
      let parent = formItem.parentElement;
      let foundProducerInput = null;
      
      // 限制向上查找层数，避免范围太大
      for (let i = 0; i < 4; i++) {
        if (!parent) break;
        
        // 在当前 parent 下查找“加工方”
        // 注意：要排除当前的“加工项目”输入框（如果有的话）
        
        // 查找所有 label 包含“加工方”的 form-item
        const producerLabels = Array.from(parent.querySelectorAll('label, span, div')).filter(el => el.textContent.includes('加工方') && !el.textContent.includes('加工项目'));
        
        if (producerLabels.length > 0) {
          // 找到了加工方标签，找对应的输入框
          for (const label of producerLabels) {
             // 查找相邻的输入框
             let target = label.nextElementSibling;
             if (target && target.querySelector('input')) {
                 foundProducerInput = target.querySelector('input');
                 break;
             }
             
             // 查找 form-item 内的输入框
             const pFormItem = label.closest('.el-form-item');
             if (pFormItem) {
                 const pInput = pFormItem.querySelector('input');
                 if (pInput) {
                     foundProducerInput = pInput;
                     break;
                 }
             }
          }
        }
        
        if (foundProducerInput) break;
        parent = parent.parentElement;
      }
      
      if (foundProducerInput) {
          console.log('定位到目标加工方输入框');
          return foundProducerInput;
      }
    }
  }
  
  // 策略2: 如果没找到特定的，回退到原来的通用查找
  console.log('未找到特定“车缝”对应的加工方，回退到通用查找');
  
  const labels = document.querySelectorAll('label, span');
  for (const label of labels) {
    if (label.textContent.includes('加工方') && !label.textContent.includes('加工项目')) {
       // 查找相邻的输入框
       let input = label.nextElementSibling;
       // 处理 el-select 结构： label + div.el-select > div.el-input > input
       if (input && input.querySelector('input')) {
           return input.querySelector('input');
       }
       if (input && input.tagName === 'INPUT') return input;
       
       // 查找同一父元素下的输入框
       const parent = label.parentElement;
       if (parent) {
         input = parent.querySelector('input');
         if (input) return input;
       }
    }
  }
  
  // 移除基于 placeholder 的模糊查找，因为它可能匹配到加工项目或其他不相关的输入框
  // const inputs = document.querySelectorAll('input[placeholder*="加工方"], input[placeholder*="请选择或输入"]');
  // if (inputs.length > 0) return inputs[0];
  
  return null;
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
