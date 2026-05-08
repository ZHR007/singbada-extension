// background.js

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_FACTORY_INFO') {
    handleFetchFactoryInfo(request.orderId, sendResponse);
    return true; // Will respond asynchronously
  }
});

/**
 * Fetches factory info from the API
 * @param {string} orderId 
 * @param {function} sendResponse 
 */
async function handleFetchFactoryInfo(orderId, sendResponse) {
  const apiUrl = `https://ntmapi.singbada.cn/common/getOriginal?old_order_id=${encodeURIComponent(orderId)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, data: data });

  } catch (error) {
    console.error('Fetch error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
