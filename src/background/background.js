async function getOrCreateOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['DOM_PARSER', 'BLOBS'],
    justification: 'To parse HTML and process ZIP files from websites.',
  });
}

function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const promise = fetch(resource, { ...options, signal: controller.signal });
  promise.finally(() => clearTimeout(id));
  return promise;
}

const openSubtitlesLangCodes = {
    japanese: 'jpn',
    english: 'eng',
    german: 'ger',
    french: 'fre',
    spanish: 'spa',
    vietnamese: 'vie'
};

const searchSources = {
  jimaku: { url: 'https://jimaku.cc/', method: 'GET' },
  kitsunekko: { url: 'https://kitsunekko.net/dirlist.php?dir=subtitles/japanese/', method: 'GET' },
  opensubtitles: { url: 'https://www.opensubtitles.org/en/search2/', method: 'GET' },
  subscene: { url: 'https://sub-scene.com/search', method: 'GET' },
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'search') {
    chrome.storage.session.remove(['session_currentSubData', 'session_isAppending', 'ui_lastState']);
    const { query, sources, language } = request;
    const sourcesToSearch = sources || [];

    const fetchPromises = sourcesToSearch
      .filter(key => searchSources[key])
      .map(async sourceKey => {
        let url = searchSources[sourceKey].url;
        // Always search all languages, filter will be done after parsing
        if (sourceKey === 'opensubtitles') {
            // Search all languages for opensubtitles
            // URL format: /en/search2/moviename-your+name/sublanguageid-all
            // OpenSubtitles uses simple encoding: spaces become +, special chars are encoded
            // Example: "your name" -> "your+name"
            let normalizedQuery = query.trim();
            // First, encode the query properly, then replace %20 with +
            // This handles special characters correctly while using + for spaces
            normalizedQuery = encodeURIComponent(normalizedQuery).replace(/%20/g, '+');
            // Also handle already-encoded + signs (if any)
            normalizedQuery = normalizedQuery.replace(/%2B/gi, '+');
            url += `moviename-${normalizedQuery}/sublanguageid-all`;
        } else if (sourceKey === 'subscene') {
            // Subscene search URL format: https://sub-scene.com/search?query=your+name
            const encodedQuery = encodeURIComponent(query.trim()).replace(/%20/g, '+');
            url += `?query=${encodedQuery}`;
        }
        // Build fetch options with proper headers
        const fetchOptions = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
          }
        };
        
        // For subscene, try using tabs API as fallback if fetch fails (to bypass Cloudflare)
        let firstPageHtml;
        if (sourceKey === 'subscene') {
          try {
            // First try normal fetch
            fetchOptions.headers['Referer'] = 'https://sub-scene.com/';
            fetchOptions.headers['Origin'] = 'https://sub-scene.com';
            fetchOptions.headers['Sec-Fetch-Site'] = 'same-origin';
        const response = await fetchWithTimeout(url, fetchOptions);
            if (response.ok) {
              firstPageHtml = await response.text();
            } else if (response.status === 403) {
              // If 403, try using tabs API as fallback
              throw new Error('403_FALLBACK_TO_TABS');
            } else {
              throw new Error(`Failed fetch from ${sourceKey}: ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            if (error.message === '403_FALLBACK_TO_TABS') {
              // Try using tabs API to load page in browser context
              try {
                const tab = await chrome.tabs.create({ url: url, active: false });
                // Wait for page to load
                await new Promise((resolve) => {
                  const listener = (tabId, changeInfo) => {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                      chrome.tabs.onUpdated.removeListener(listener);
                      resolve();
                    }
                  };
                  chrome.tabs.onUpdated.addListener(listener);
                  // Timeout after 10 seconds
                  setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                  }, 10000);
                });
                // Execute script to get HTML
                const results = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: () => document.documentElement.outerHTML
                });
                if (results && results[0] && results[0].result) {
                  firstPageHtml = results[0].result;
                } else {
                  throw new Error('Failed to get HTML from tab');
                }
                // Close the tab
                chrome.tabs.remove(tab.id);
              } catch (tabsError) {
                console.error('[Subscene] Tabs API fallback also failed:', tabsError);
                chrome.tabs.remove(tab.id).catch(() => {});
                throw new Error(`Failed fetch from ${sourceKey}: 403 Forbidden (Cloudflare protection)`);
              }
            } else {
              console.error(`[${sourceKey}] Fetch error:`, error);
              console.error(`[${sourceKey}] Error details:`, {
                message: error.message,
                stack: error.stack,
                name: error.name
              });
              throw error;
            }
          }
        } else {
          // Normal fetch for other sources
          firstPageHtml = await fetchWithTimeout(url, fetchOptions)
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed fetch from ${sourceKey}: ${response.status} ${response.statusText}`);
              }
              return response.text();
            })
            .catch(error => {
              console.error(`[${sourceKey}] Fetch error:`, error);
              console.error(`[${sourceKey}] Error details:`, {
                message: error.message,
                stack: error.stack,
                name: error.name
              });
              throw error;
            });
        }
        
        // For OpenSubtitles, check for pagination and fetch all pages
        if (sourceKey === 'opensubtitles') {
          const pages = [{ htmlText: firstPageHtml, source: sourceKey, query: query, selectedLanguage: language }];
          
          // Parse first page in offscreen document to find pagination links
          await getOrCreateOffscreenDocument();
          const paginationLinks = await new Promise((resolve) => {
            const listener = (msg) => {
              if (msg.action === 'paginationLinksExtracted') {
                chrome.runtime.onMessage.removeListener(listener);
                resolve(msg.links || []);
              }
            };
            chrome.runtime.onMessage.addListener(listener);
            chrome.runtime.sendMessage({
              action: 'extractPaginationLinks',
              htmlText: firstPageHtml,
              baseUrl: url
            });
            // Timeout after 5 seconds
            setTimeout(() => {
              chrome.runtime.onMessage.removeListener(listener);
              resolve([]);
            }, 5000);
          });
          
          // Fetch additional pages (limit to 10 pages to avoid too many requests)
          const offsetUrlsArray = paginationLinks.slice(0, 10);
          const pagePromises = offsetUrlsArray.map(async (pageUrl) => {
            try {
              const pageHtml = await fetchWithTimeout(pageUrl, fetchOptions, 15000)
                .then(response => response.ok ? response.text() : null);
              return pageHtml ? { htmlText: pageHtml, source: sourceKey, query: query, selectedLanguage: language } : null;
            } catch (error) {
              console.warn(`Failed to fetch OpenSubtitles page: ${pageUrl}`, error);
              return null;
            }
          });
          
          const additionalPages = await Promise.all(pagePromises);
          pages.push(...additionalPages.filter(p => p !== null));
          
          return pages; // Return array of pages
        }
        
        return [{ htmlText: firstPageHtml, source: sourceKey, query: query, selectedLanguage: language }];
      });

    Promise.allSettled(fetchPromises)
      .then(async (results) => {
        await getOrCreateOffscreenDocument();
        const successfulPages = [];
        const fetchErrors = [];
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            // result.value is now an array of pages (for OpenSubtitles) or single page array (for others)
            if (Array.isArray(result.value)) {
              successfulPages.push(...result.value);
            } else {
              successfulPages.push(result.value);
            }
          } else {
            const errorMessage = result.reason?.message || result.reason?.toString() || 'Unknown fetch error';
            console.error(`[Background] Fetch error for result ${index}:`, errorMessage, result.reason);
            let sourceName = 'a source';
            let errorDetail = '';
            const errorLower = errorMessage.toLowerCase();
            if (errorLower.includes('jimaku')) {
              sourceName = 'Jimaku';
            } else if (errorLower.includes('kitsunekko')) {
              sourceName = 'Kitsunekko';
            } else if (errorLower.includes('opensubtitles')) {
              sourceName = 'OpenSubtitles';
            } else if (errorLower.includes('subscene')) {
              sourceName = 'Subscene';
              // Check if it's a 403 error (Cloudflare protection)
              if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                errorDetail = ' (Blocked by Cloudflare protection - may work if accessed directly in browser)';
              }
            }
            fetchErrors.push(`Failed to fetch from ${sourceName}${errorDetail}.`);
          }
        });
        chrome.runtime.sendMessage({
          action: 'parseMultipleHtml',
          pages: successfulPages,
          errors: fetchErrors
        });
      });
    return true;

  } else if (request.action === 'fetchMoviePages') {
    // Fetch multiple movie pages and parse subtitles from them
    const { movieUrls, query } = request;
    const fetchOptions = {};
    const fetchPromises = movieUrls.slice(0, 20).map(async (url) => { // Limit to 20 movies to avoid too many requests
      try {
        const htmlText = await fetchWithTimeout(url, fetchOptions, 15000)
          .then(response => response.ok ? response.text() : Promise.reject(`Failed to fetch ${url}: ${response.status}`));
        return { htmlText, url, source: 'opensubtitles' };
      } catch (error) {
        console.warn(`Failed to fetch movie page ${url}:`, error);
        return null;
      }
    });
    
    Promise.allSettled(fetchPromises).then(async (results) => {
      await getOrCreateOffscreenDocument();
      const successfulPages = [];
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          successfulPages.push(result.value);
        }
      });
      
      // Send all movie pages to offscreen document to parse subtitles
      const allSubtitles = [];
      for (const page of successfulPages) {
        try {
          const subtitles = await new Promise((resolve) => {
            const listener = (msg) => {
              if (msg.action === 'episodeListParsed') {
                chrome.runtime.onMessage.removeListener(listener);
                resolve(msg.data || []);
              }
            };
            chrome.runtime.onMessage.addListener(listener);
            chrome.runtime.sendMessage({
              action: 'parseEpisodeList',
              htmlText: page.htmlText,
              baseUrl: page.url,
              source: 'opensubtitles'
            });
            // Timeout after 10 seconds
            setTimeout(() => {
              chrome.runtime.onMessage.removeListener(listener);
              resolve([]);
            }, 10000);
          });
          allSubtitles.push(...subtitles);
        } catch (error) {
          console.warn(`Failed to parse movie page ${page.url}:`, error);
        }
      }
      
      // Group duplicate subtitles across all movie pages
      const groupedSubtitles = new Map();
      allSubtitles.forEach(subtitle => {
        // Extract base title (remove year and extra info)
        const titleMatch = subtitle.title.match(/^(.+?)\s*\((\d{4})\)/);
        let baseTitle = titleMatch ? titleMatch[1].trim() : subtitle.title;
        
        // Normalize baseTitle
        baseTitle = baseTitle
          .replace(/\s*-\s*[A-Z]{2,}\s*$/, '') // Remove " - HINDI", " - EN", etc.
          .replace(/\s*-\s*.*$/, '') // Remove any other " - suffix"
          .replace(/\s*\(.*?\)\s*$/, '') // Remove any remaining parentheses
          .trim();
        
        const normalizedTitle = baseTitle.toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Create group key: normalizedTitle + language
        const langKey = subtitle.language || '_no_lang';
        const groupKey = `${normalizedTitle}_${langKey}`;
        
        // Only add if not seen before (same movie + same language)
        if (!groupedSubtitles.has(groupKey)) {
          // Use the cleaned title with year if available
          const displayTitle = titleMatch 
            ? `${titleMatch[1].trim()} (${titleMatch[2]})`
            : baseTitle;
          
          groupedSubtitles.set(groupKey, {
            ...subtitle,
            title: displayTitle
          });
        }
      });
      
      // Convert map to array and sort
      const finalResults = Array.from(groupedSubtitles.values());
      finalResults.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
      
      // Send results back
      chrome.runtime.sendMessage({
        action: 'searchResults',
        data: finalResults,
        errors: []
      });
    });
    return true;
  } else if (request.action === 'fetchSubtitlePage') {
    const fetchOptions = {};
    fetchWithTimeout(request.url, fetchOptions, 15000)
      .then(response => response.ok ? response.text() : Promise.reject(`Network response was not ok for ${request.url}: ${response.status}`))
      .then(async (htmlText) => {
        await getOrCreateOffscreenDocument();
        let source = 'unknown';
        if (request.url.includes('kitsunekko.net')) source = 'kitsunekko';
        else if (request.url.includes('jimaku.cc')) source = 'jimaku';
        else if (request.url.includes('opensubtitles.org')) source = 'opensubtitles';
        else if (request.url.includes('sub-scene.com')) source = 'subscene';
        
        // For OpenSubtitles, check for pagination and fetch all subtitle pages
        if (source === 'opensubtitles') {
          const pages = [{ htmlText: htmlText, source: source, baseUrl: request.url }];
          
          // Parse first page to find pagination links
          const paginationLinks = await new Promise((resolve) => {
            const listener = (msg) => {
              if (msg.action === 'paginationLinksExtracted') {
                chrome.runtime.onMessage.removeListener(listener);
                resolve(msg.links || []);
              }
            };
            chrome.runtime.onMessage.addListener(listener);
            chrome.runtime.sendMessage({
              action: 'extractPaginationLinks',
              htmlText: htmlText,
              baseUrl: request.url
            });
            // Timeout after 5 seconds
            setTimeout(() => {
              chrome.runtime.onMessage.removeListener(listener);
              resolve([]);
            }, 5000);
          });
          
          // Fetch all pagination pages (limit to 20 pages to avoid too many requests)
          const offsetUrlsArray = paginationLinks.slice(0, 20);
          const pagePromises = offsetUrlsArray.map(async (pageUrl) => {
            try {
              const pageHtml = await fetchWithTimeout(pageUrl, fetchOptions, 15000)
                .then(response => response.ok ? response.text() : null);
              return pageHtml ? { htmlText: pageHtml, source: source, baseUrl: pageUrl } : null;
            } catch (error) {
              console.warn(`Failed to fetch OpenSubtitles subtitle page: ${pageUrl}`, error);
              return null;
            }
          });
          
          const additionalPages = await Promise.all(pagePromises);
          pages.push(...additionalPages.filter(p => p !== null));
          
          // Parse all pages and combine results
          const allSubtitles = [];
          for (const page of pages) {
            try {
              const subtitles = await new Promise((resolve) => {
                const listener = (msg) => {
                  if (msg.action === 'episodeListParsed') {
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve(msg.data || []);
                  }
                };
                chrome.runtime.onMessage.addListener(listener);
                chrome.runtime.sendMessage({
                  action: 'parseEpisodeList',
                  htmlText: page.htmlText,
                  baseUrl: page.baseUrl,
                  source: source
                });
                // Timeout after 10 seconds
                setTimeout(() => {
                  chrome.runtime.onMessage.removeListener(listener);
                  resolve([]);
                }, 10000);
              });
              allSubtitles.push(...subtitles);
            } catch (error) {
              console.warn(`Failed to parse subtitle page ${page.baseUrl}:`, error);
            }
          }
          
          // Send all subtitles (no grouping, keep original order)
          chrome.runtime.sendMessage({ action: 'episodeListReady', data: allSubtitles, error: null });
        } else {
          // For other sources, use original logic
          chrome.runtime.sendMessage({
            action: 'parseEpisodeList',
            htmlText: htmlText,
            baseUrl: request.url,
            source: source
          });
        }
      })
      .catch(error => {
        console.error(`Fetch subtitle page error for ${request.url}:`, { message: error.message, stack: error.stack });
        chrome.runtime.sendMessage({ action: 'showStatus', message: `<i>Error: Could not load subtitle page: ${error.message}</i>` });
      });
    return true;
  
  } else if (request.action === 'fetchSubtitleContent') {
    (async () => {
        // Check if this is an OpenSubtitles detail page (not a direct download link)
        if (request.url.includes('opensubtitles.org') && 
            (request.url.includes('/subtitles/') || request.url.includes('/en/subtitles/'))) {
            // This is a detail page, need to fetch HTML and extract download link
            try {
                const htmlText = await fetchWithTimeout(request.url, {}, 15000)
                    .then(response => response.ok ? response.text() : Promise.reject(`Network response was not ok: ${response.status}`));
                
                await getOrCreateOffscreenDocument();
                
                // Extract download link from HTML
                const downloadLink = await new Promise((resolve) => {
                    const listener = (msg) => {
                        if (msg.action === 'downloadLinkExtracted') {
                            chrome.runtime.onMessage.removeListener(listener);
                            resolve(msg.downloadUrl || null);
                        }
                    };
                    chrome.runtime.onMessage.addListener(listener);
                    chrome.runtime.sendMessage({
                        action: 'extractOpenSubtitlesDownloadLink',
                        htmlText: htmlText,
                        baseUrl: request.url
                    });
                    setTimeout(() => {
                        chrome.runtime.onMessage.removeListener(listener);
                        resolve(null);
                    }, 5000);
                });
                
                if (downloadLink) {
                    // Use the extracted download link
                    chrome.runtime.sendMessage({
                        action: 'fetchAndProcessFile',
                        url: downloadLink,
                        format: request.format || 'zip' // Default to zip for OpenSubtitles
                    });
                } else {
                    chrome.runtime.sendMessage({ 
                        action: 'showStatus', 
                        message: `<i>Error: Could not find download link on OpenSubtitles page.</i>` 
                    });
                }
            } catch (error) {
                console.error(`Error fetching OpenSubtitles detail page:`, error);
                chrome.runtime.sendMessage({ 
                    action: 'showStatus', 
                    message: `<i>Error: Could not load OpenSubtitles page: ${error.message}</i>` 
                });
            }
        } else if (request.url.includes('sub-scene.com') && request.url.includes('/subtitle/')) {
            // This is a Subscene detail page, need to fetch HTML and extract download link
            try {
                let htmlText;
                // Try normal fetch first
                try {
                    const fetchOptions = {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Referer': 'https://sub-scene.com/',
                            'Origin': 'https://sub-scene.com'
                        }
                    };
                    const response = await fetchWithTimeout(request.url, fetchOptions, 15000);
                    if (response.ok) {
                        htmlText = await response.text();
                    } else if (response.status === 403) {
                        // Try tabs API fallback
                        const tab = await chrome.tabs.create({ url: request.url, active: false });
                        await new Promise((resolve) => {
                            const listener = (tabId, changeInfo) => {
                                if (tabId === tab.id && changeInfo.status === 'complete') {
                                    chrome.tabs.onUpdated.removeListener(listener);
                                    resolve();
                                }
                            };
                            chrome.tabs.onUpdated.addListener(listener);
                            setTimeout(() => {
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }, 10000);
                        });
                        const results = await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: () => document.documentElement.outerHTML
                        });
                        htmlText = results[0].result;
                        await chrome.tabs.remove(tab.id);
                    } else {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                } catch (error) {
                    // Try tabs API fallback
                    const tab = await chrome.tabs.create({ url: request.url, active: false });
                    await new Promise((resolve) => {
                        const listener = (tabId, changeInfo) => {
                            if (tabId === tab.id && changeInfo.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        };
                        chrome.tabs.onUpdated.addListener(listener);
                        setTimeout(() => {
                            chrome.tabs.onUpdated.removeListener(listener);
                            resolve();
                        }, 10000);
                    });
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => document.documentElement.outerHTML
                    });
                    htmlText = results[0].result;
                    await chrome.tabs.remove(tab.id);
                }
                
                await getOrCreateOffscreenDocument();
                
                // Extract download link from HTML
                const downloadLink = await new Promise((resolve) => {
                    const listener = (msg) => {
                        if (msg.action === 'downloadLinkExtracted') {
                            chrome.runtime.onMessage.removeListener(listener);
                            resolve(msg.downloadUrl || null);
                        }
                    };
                    chrome.runtime.onMessage.addListener(listener);
                    chrome.runtime.sendMessage({
                        action: 'extractSubsceneDownloadLink',
                        htmlText: htmlText,
                        baseUrl: request.url
                    });
                    setTimeout(() => {
                        chrome.runtime.onMessage.removeListener(listener);
                        resolve(null);
                    }, 5000);
                });
                
                if (downloadLink) {
                    // Use the extracted download link
                    chrome.runtime.sendMessage({
                        action: 'fetchAndProcessFile',
                        url: downloadLink,
                        format: request.format || 'zip' // Default to zip for Subscene
                    });
                } else {
                    chrome.runtime.sendMessage({ 
                        action: 'showStatus', 
                        message: `<i>Error: Could not find download link on Subscene page.</i>` 
                    });
                }
            } catch (error) {
                console.error(`Error fetching Subscene detail page:`, error);
                chrome.runtime.sendMessage({ 
                    action: 'showStatus', 
                    message: `<i>Error: Could not load Subscene page: ${error.message}</i>` 
                });
            }
        } else {
            // Direct download link or other sources
            await getOrCreateOffscreenDocument();
            chrome.runtime.sendMessage({
                action: 'fetchAndProcessFile',
                url: request.url,
                format: request.format
            });
        }
    })();
    return true;
  
  } else if (request.action === 'unzippedSubtitleReady') {
      console.log('Background: Received unzippedSubtitleReady, data length:', request.data ? request.data.length : 0);
      chrome.storage.session.set({ 'session_currentSubData': { data: request.data, isNew: true } })
          .then(() => {
              console.log('Background: Session storage set, sending subtitleReadyForPopup');
              chrome.runtime.sendMessage({ action: 'subtitleReadyForPopup' })
                  .catch(error => {
                      console.error('Background: Error sending subtitleReadyForPopup:', error);
                  });
          })
          .catch(error => {
              console.error('Background: Error setting session storage:', error);
          });
      return true;
  
  } else if (request.action === 'fetchError') {
      console.error("Background received fetch error from offscreen:", request.error);
      chrome.runtime.sendMessage({ action: 'showStatus', message: `<i>Error: ${request.error}</i>` });

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
  
  } else if (request.action === 'lookupWord') {
    const { word, language } = request;

    const supportedDeepLLanguages = ['german', 'english', 'french', 'spanish'];
    const defaultProviders = {
        japanese: 'jisho',
        german: 'deepl',
        english: 'deepl',
        french: 'deepl',
        spanish: 'deepl',
        vietnamese: 'google_translate'
    };

    chrome.storage.local.get(['deepl_api_key', 'dictionaryProviderSettings', 'targetTranslationLanguage'], async (result) => {
        const deeplKey = result.deepl_api_key;
        const savedProviders = result.dictionaryProviderSettings || defaultProviders;
        const provider = savedProviders[language] || defaultProviders[language] || 'google_translate';
        const targetLang = result.targetTranslationLanguage || 'VI';

        if (provider === 'jisho' && language === 'japanese') {
            const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
            fetch(url)
                .then(response => response.ok ? response.json() : Promise.reject('Jisho API request failed'))
                .then(data => sendResponse({ success: true, source: 'jisho', targetLanguage: 'EN', data: data }))
                .catch(error => sendResponse({ success: false, error: error.message }));

        } else if (provider === 'deepl' && deeplKey && supportedDeepLLanguages.includes(language)) {
            const isFreeTier = deeplKey.endsWith(':fx');
            const apiUrl = isFreeTier 
                ? 'https://api-free.deepl.com/v2/translate' 
                : 'https://api.deepl.com/v2/translate';
            const body = { text: [word], target_lang: targetLang };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `DeepL-Auth-Key ${deeplKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error('Forbidden. Please check if your API Key is correct and active.');
                    }
                    if (response.status === 400) {
                         const errorData = await response.json();
                         throw new Error(errorData.message || 'Bad request. The target language might not be supported.');
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.translations && data.translations.length > 0) {
                    sendResponse({ 
                        success: true, 
                        source: 'deepl',
                        targetLanguage: targetLang,
                        data: { word: word, translation: data.translations[0].text }
                    });
                } else {
                    throw new Error('DeepL returned no translation.');
                }
            } catch (error) {
                console.warn(`DeepL lookup failed: ${error.message}. Falling back to Google Translate.`);
                const sourceLang = { 'german': 'de', 'english': 'en', 'french': 'fr', 'spanish': 'es' }[language] || 'auto';
                const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(word)}`;
                fetch(googleUrl)
                    .then(res => res.ok ? res.json() : Promise.reject('Google Translate API request failed'))
                    .then(json => {
                        if (json && json[0] && json[0][0] && json[0][0][0]) {
                            sendResponse({ 
                                success: true, 
                                source: 'google_translate', 
                                targetLanguage: targetLang,
                                data: { word: json[0][0][1], translation: json[0][0][0] }
                            });
                        } else {
                           sendResponse({ success: false, error: 'No translation found.' });
                        }
                    })
                    .catch(gtError => sendResponse({ success: false, error: gtError.message }));
            }
        } else {
            const sourceLang = { 'german': 'de', 'english': 'en', 'french': 'fr', 'spanish': 'es', 'japanese': 'ja' }[language] || 'auto';
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(word)}`;
            fetch(url)
                .then(response => response.ok ? response.json() : Promise.reject('Google Translate API request failed'))
                .then(json => {
                    if (json && json[0] && json[0][0] && json[0][0][0]) {
                        sendResponse({ 
                            success: true, 
                            source: 'google_translate',
                            targetLanguage: targetLang,
                            data: { word: json[0][0][1], translation: json[0][0][0] }
                        });
                    } else {
                       sendResponse({ success: false, error: 'No translation found.' });
                    }
                })
                .catch(error => sendResponse({ success: false, error: error.message }));
        }
    });
    return true;
  
  } else if (request.action === 'clearSubtitles') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'clearSubtitles' });
        }
    });
    return true;
  }
  return true;
});