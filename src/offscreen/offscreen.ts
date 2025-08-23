// Offscreen document for handling CORS-restricted downloads

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'offscreen-fetch') {
    handleFetch(request.url).then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Will respond asynchronously
  }
  return false;
});

async function handleFetch(url: string) {
  console.log('[Offscreen] Fetching:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit', // Don't send credentials to avoid CORS issues
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to transferable array
    return Array.from(bytes);
  } catch (error) {
    console.error('[Offscreen] Fetch error:', error);
    throw error;
  }
}

console.log('[Offscreen] Document initialized');