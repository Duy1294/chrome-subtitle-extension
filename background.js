// background.js

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

async function getOrCreateOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'To parse HTML content from multiple websites.',
  });
}

function fetchWithTimeout(resource, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const promise = fetch(resource, { ...options, signal: controller.signal });
  promise.finally(() => clearTimeout(id));
  return promise;
}

const searchSources = {
  jimaku: { url: 'https://jimaku.cc/', method: 'GET' },
  kitsunekko: { url: 'https://kitsunekko.net/dirlist.php?dir=subtitles/japanese/', method: 'GET' },
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'search') {
    const { query, source } = request;
    const sourcesToSearch = (source === 'both') ? ['jimaku', 'kitsunekko'] : [source];
    
    const fetchPromises = sourcesToSearch
      .filter(key => searchSources[key])
      .map(sourceKey => {
        let url = searchSources[sourceKey].url;
        const fetchOptions = {};
        
        return fetchWithTimeout(url, fetchOptions)
          .then(response => response.ok ? response.text() : Promise.reject(new Error(`Failed fetch from ${sourceKey}: ${response.status}`)))
          .then(htmlText => ({ htmlText, source: sourceKey, query: query }))
      });

    Promise.allSettled(fetchPromises)
      .then(async (results) => {
        await getOrCreateOffscreenDocument();
        
        const successfulPages = [];
        const fetchErrors = [];

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            successfulPages.push(result.value);
          } else {
            const errorMessage = result.reason.message || 'Unknown fetch error';
            let sourceName = 'a source';
            if (errorMessage.includes('jimaku')) sourceName = 'Jimaku';
            else if (errorMessage.includes('kitsunekko')) sourceName = 'Kitsunekko';
            fetchErrors.push(`Failed to fetch from ${sourceName}.`);
          }
        });
        
        chrome.runtime.sendMessage({
          action: 'parseMultipleHtml',
          pages: successfulPages,
          errors: fetchErrors
        });
      });
    return true;

  } else if (request.action === 'fetchSubtitlePage') {
    const fetchOptions = {};

    fetchWithTimeout(request.url, fetchOptions, 8000)
      .then(response => response.ok ? response.text() : Promise.reject(`Network response was not ok for ${request.url}: ${response.status}`))
      .then(async (htmlText) => {
        await getOrCreateOffscreenDocument();
        let source = 'unknown';
        if (request.url.includes('kitsunekko.net')) source = 'kitsunekko';
        else if (request.url.includes('jimaku.cc')) source = 'jimaku';

        chrome.runtime.sendMessage({
          action: 'parseEpisodeList',
          htmlText: htmlText,
          baseUrl: request.url,
          source: source
        });
      })
      .catch(error => {
        console.error(`Fetch subtitle page error for ${request.url}:`, {
          message: error.message,
          stack: error.stack
        });
        chrome.runtime.sendMessage({ action: 'episodeListReady', data: [], error: `Không thể tải trang phụ đề: ${error.message}` });
      });
    return true;

  } else if (request.action === 'openDownloadTab') {
    chrome.tabs.create({ url: request.url, active: true });
    return true;

  } else if (request.action === 'fetchSubtitleContent') {
    fetch(request.url)
      .then(response => response.ok ? response.text() : Promise.reject('Failed to fetch subtitle'))
      .then(subtitleText => {
        chrome.runtime.sendMessage({ action: 'subtitleContentReady', data: subtitleText, format: request.format });
      })
      .catch(error => console.error(error));
    return true;
  
  } else if (request.action === 'applySettingsToTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'displaySubtitles',
                settings: request.settings,
                data: request.data,
                format: request.format,
                append: request.append || false
            });
        }
    });
    return true;
  }
  
  // SỬA ĐỔI HOÀN TOÀN HÀM NÀY ĐỂ HỖ TRỢ ĐA NGÔN NGỮ
  else if (request.action === 'lookupWord') {
    const { word, language } = request;

    if (language === 'japanese') {
        const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
        fetch(url)
            .then(response => response.ok ? response.json() : Promise.reject('Jisho API request failed'))
            .then(data => sendResponse({ success: true, source: 'jisho', data: data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
        // Sử dụng Google Translate cho các ngôn ngữ khác
        // Endpoint này không chính thức và có thể thay đổi
        const sourceLang = { 'german': 'de', 'english': 'en', 'french': 'fr', 'spanish': 'es' }[language] || 'auto';
        const targetLang = 'vi'; // Dịch sang tiếng Việt
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(word)}`;

        fetch(url)
            .then(response => response.ok ? response.json() : Promise.reject('Google Translate API request failed'))
            .then(json => {
                if (json && json[0] && json[0][0] && json[0][0][0]) {
                    const translation = json[0][0][0];
                    const originalWord = json[0][0][1];
                    sendResponse({ 
                        success: true, 
                        source: 'google_translate', 
                        data: {
                            word: originalWord,
                            translation: translation
                        }
                    });
                } else {
                    Promise.reject('No translation found.');
                }
            })
            .catch(error => sendResponse({ success: false, error: error.message }));
    }
    return true; // Quan trọng: Giữ kết nối mở cho sendResponse bất đồng bộ
  }
  
  else if (request.action === 'clearSubtitles') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'clearSubtitles' });
        }
    });
    return true;
  }

  return true;
});