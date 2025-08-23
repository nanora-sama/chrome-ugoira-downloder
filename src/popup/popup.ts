document.addEventListener('DOMContentLoaded', async () => {
  // 要素の取得
  const qualitySelect = document.getElementById('quality') as HTMLSelectElement;
  const resolutionSelect = document.getElementById('resolution') as HTMLSelectElement;
  const autoDownloadCheckbox = document.getElementById('auto-download') as HTMLInputElement;
  const downloadCountSpan = document.getElementById('download-count') as HTMLSpanElement;
  const openPixivButton = document.getElementById('open-pixiv') as HTMLButtonElement;
  const clearDataButton = document.getElementById('clear-data') as HTMLButtonElement;
  const helpLink = document.getElementById('help') as HTMLAnchorElement;
  const aboutLink = document.getElementById('about') as HTMLAnchorElement;
  const statusElement = document.getElementById('status') as HTMLDivElement;
  const statusText = document.getElementById('status-text') as HTMLSpanElement;

  // 設定の読み込み
  const loadSettings = async () => {
    const result = await chrome.storage.local.get(['settings', 'stats']);
    
    if (result.settings) {
      qualitySelect.value = result.settings.quality || '10';
      resolutionSelect.value = result.settings.resolution || '1920x1080';
      autoDownloadCheckbox.checked = result.settings.autoDownload || false;
    }

    if (result.stats) {
      downloadCountSpan.textContent = result.stats.downloadCount || '0';
    }
  };

  // 設定の保存
  const saveSettings = async () => {
    const settings = {
      quality: parseInt(qualitySelect.value),
      resolution: resolutionSelect.value,
      autoDownload: autoDownloadCheckbox.checked
    };

    await chrome.storage.local.set({ settings });
    console.log('Settings saved:', settings);
  };

  // 現在のタブの状態を確認
  const checkCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url) {
      const isPixiv = tab.url.includes('pixiv.net');
      const isArtwork = tab.url.includes('/artworks/');
      
      if (isPixiv) {
        statusElement.classList.remove('inactive');
        statusText.textContent = isArtwork ? 
          'うごイラページで利用可能' : 
          'Pixivで有効です';
      } else {
        statusElement.classList.add('inactive');
        statusText.textContent = 'Pixivページではありません';
      }
    }
  };

  // イベントリスナーの設定
  qualitySelect.addEventListener('change', saveSettings);
  resolutionSelect.addEventListener('change', saveSettings);
  autoDownloadCheckbox.addEventListener('change', saveSettings);

  openPixivButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.pixiv.net/' });
  });

  clearDataButton.addEventListener('click', async () => {
    if (confirm('すべてのデータをクリアしますか？')) {
      await chrome.storage.local.clear();
      downloadCountSpan.textContent = '0';
      await loadSettings(); // デフォルト設定を再読み込み
      alert('データをクリアしました');
    }
  });

  helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: 'https://github.com/yourusername/pixiv-ugoira-gif-downloader/wiki' 
    });
  });

  aboutLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert(
      'Pixiv Ugoira GIF Downloader v1.0.0\n\n' +
      'PixivのうごイラをワンクリックでGIF形式でダウンロードできる拡張機能です。\n\n' +
      '© 2024 - MIT License'
    );
  });

  // ストレージの変更を監視
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.stats) {
        const newStats = changes.stats.newValue;
        if (newStats && newStats.downloadCount !== undefined) {
          downloadCountSpan.textContent = newStats.downloadCount.toString();
        }
      }
    }
  });

  // 初期化
  await loadSettings();
  await checkCurrentTab();

  // タブの変更を監視
  chrome.tabs.onActivated.addListener(checkCurrentTab);
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) {
      checkCurrentTab();
    }
  });
});

// ダウンロード回数をインクリメント（Service Workerから呼ばれる）
export async function incrementDownloadCount() {
  const result = await chrome.storage.local.get(['stats']);
  const stats = result.stats || { downloadCount: 0 };
  stats.downloadCount++;
  await chrome.storage.local.set({ stats });
}