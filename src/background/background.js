async function getOrCreateOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['DOM_PARSER', 'BLOBS'],
    justification: 'To parse HTML and process ZIP files from websites.',
  });
}

async function translateChunkWithGoogleAIStudio({ apiKey, targetLang, texts }) {
  const normalized = texts.map(normalizeSubtitleTextForTranslation);
  const payload = {
    target_language: mapGeminiTargetLang(targetLang),
    lines: normalized
  };

  const promptText =
    'You are a professional subtitle translator for movies/anime. Translate naturally while preserving meaning and tone. Keep each line concise for subtitles. Do not add explanations.\n' +
    'Keep the number of lines EXACTLY the same; do not merge or split lines.\n' +
    'Return valid JSON ONLY in the form: {"lines": ["..."]}. No markdown, no backticks, no extra keys.\n\n' +
    'INPUT JSON:\n' +
    JSON.stringify(payload);

  async function callGenerateContent(modelName) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      generationConfig: {
        temperature: 0.2
      },
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ]
    };

    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }, 60000);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      const err = new Error(`Google AI Studio error ${resp.status}: ${errText || resp.statusText}`);
      err.status = resp.status;
      throw err;
    }

    const data = await resp.json();
    const content = data?.candidates?.[0]?.content;
    const text = content?.parts?.map(p => p?.text || '').join('') || '';
    if (!text) throw new Error('Google AI Studio returned empty content');
    return text;
  }

  async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetchWithTimeout(url, { method: 'GET' }, 30000);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Google AI Studio ListModels error ${resp.status}: ${errText || resp.statusText}`);
    }
    const data = await resp.json();
    return Array.isArray(data?.models) ? data.models : [];
  }

  function parseLinesFromJsonText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Try to salvage first JSON object in the response
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Google AI Studio returned non-JSON content');
      parsed = JSON.parse(match[0]);
    }

    const outLines = parsed?.lines;
    if (!Array.isArray(outLines)) throw new Error('Google AI Studio JSON missing lines[]');
    if (outLines.length !== texts.length) {
      throw new Error(`Google AI Studio lines length mismatch: expected ${texts.length}, got ${outLines.length}`);
    }
    return outLines.map(v => (typeof v === 'string' ? v : String(v ?? '')));
  }

  const preferredModels = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.0-pro',
    'gemini-pro'
  ];

  for (const model of preferredModels) {
    try {
      const text = await callGenerateContent(model);
      return parseLinesFromJsonText(text);
    } catch (e) {
      const msg = String(e?.message || e);
      const isModelNotFound = (e?.status === 404) || msg.includes('not found') || msg.includes('NOT_FOUND');
      if (!isModelNotFound) {
        throw e;
      }
    }
  }

  // Fallback: discover supported models dynamically.
  const models = await listModels();
  const supported = models
    .filter(m => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => (m.name || '').replace(/^models\//, ''))
    .filter(Boolean);

  const pick = supported.find(n => /gemini/i.test(n)) || supported[0];
  if (!pick) {
    throw new Error('Google AI Studio: no generateContent-capable model found.');
  }

  const text = await callGenerateContent(pick);
  return parseLinesFromJsonText(text);
}

async function translateChunkWithGeminiChat({ apiKey, targetLang, texts }) {
  const normalized = texts.map(normalizeSubtitleTextForTranslation);
  const payload = {
    target_language: mapGeminiTargetLang(targetLang),
    lines: normalized
  };

  const systemText =
    'You are a professional subtitle translator for movies/anime. Translate naturally while preserving meaning and tone. Keep each line concise for subtitles. Do not add explanations.';
  const userText =
    'Translate the subtitle lines to the target language.\n' +
    'Keep the number of lines EXACTLY the same; do not merge or split lines.\n' +
    'Return valid JSON ONLY in the form: {"lines": ["..."]}. No markdown, no backticks, no extra keys.\n\n' +
    'INPUT JSON:\n' +
    JSON.stringify(payload);

  async function callGenerateContent(modelName) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      generationConfig: {
        temperature: 0.2
      },
      contents: [
        { role: 'user', parts: [{ text: systemText }] },
        { role: 'user', parts: [{ text: userText }] }
      ]
    };

    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }, 60000);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      const err = new Error(`Gemini Chat error ${resp.status}: ${errText || resp.statusText}`);
      err.status = resp.status;
      throw err;
    }

    const data = await resp.json();
    const content = data?.candidates?.[0]?.content;
    const text = content?.parts?.map(p => p?.text || '').join('') || '';
    if (!text) throw new Error('Gemini Chat returned empty content');
    return text;
  }

  async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetchWithTimeout(url, { method: 'GET' }, 30000);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Gemini Chat ListModels error ${resp.status}: ${errText || resp.statusText}`);
    }
    const data = await resp.json();
    return Array.isArray(data?.models) ? data.models : [];
  }

  function parseLinesFromJsonText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Gemini Chat returned non-JSON content');
      parsed = JSON.parse(match[0]);
    }

    const outLines = parsed?.lines;
    if (!Array.isArray(outLines)) throw new Error('Gemini Chat JSON missing lines[]');
    if (outLines.length !== texts.length) {
      throw new Error(`Gemini Chat lines length mismatch: expected ${texts.length}, got ${outLines.length}`);
    }
    return outLines.map(v => (typeof v === 'string' ? v : String(v ?? '')));
  }

  const preferredModels = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.0-pro',
    'gemini-pro'
  ];

  for (const model of preferredModels) {
    try {
      const text = await callGenerateContent(model);
      return parseLinesFromJsonText(text);
    } catch (e) {
      const msg = String(e?.message || e);
      const isModelNotFound = (e?.status === 404) || msg.includes('not found') || msg.includes('NOT_FOUND');
      if (!isModelNotFound) throw e;
    }
  }

  const models = await listModels();
  const supported = models
    .filter(m => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => (m.name || '').replace(/^models\//, ''))
    .filter(Boolean);

  const pick = supported.find(n => /gemini/i.test(n)) || supported[0];
  if (!pick) {
    throw new Error('Gemini Chat: no generateContent-capable model found.');
  }

  const text = await callGenerateContent(pick);
  return parseLinesFromJsonText(text);
}

function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const promise = fetch(resource, { ...options, signal: controller.signal });
  promise.finally(() => clearTimeout(id));
  return promise;
}

function chunkArray(arr, chunkSize) {
  const out = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    out.push(arr.slice(i, i + chunkSize));
  }
  return out;
}

function normalizeSubtitleTextForTranslation(t) {
  if (!t) return '';
  return String(t)
    .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '')
    .replace(/\s+$/g, '')
    .trim();
}

function mapDeepLTargetLang(code) {
  const upper = (code || '').toUpperCase();
  const map = {
    VI: 'VI',
    EN: 'EN',
    DE: 'DE',
    FR: 'FR',
    ES: 'ES',
    JA: 'JA'
  };
  return map[upper] || 'EN';
}

function mapGeminiTargetLang(code) {
  const upper = (code || '').toUpperCase();
  const map = {
    VI: 'Vietnamese',
    EN: 'English',
    DE: 'German',
    FR: 'French',
    ES: 'Spanish',
    JA: 'Japanese'
  };
  return map[upper] || 'English';
}

async function translateChunkWithOpenAI({ apiKey, targetLang, texts }) {
  const normalized = texts.map(normalizeSubtitleTextForTranslation);
  const userPayload = {
    target_language: (targetLang || 'VI').toUpperCase(),
    lines: normalized
  };

  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a professional subtitle translator for movies/anime. Translate naturally while preserving meaning, tone, honorifics/relationship nuances when relevant. Keep each line concise and suitable for subtitles. Do not add explanations. Output MUST be valid JSON.'
      },
      {
        role: 'user',
        content:
          'Translate the subtitle lines to the target_language. Keep the number of lines EXACTLY the same and keep line order. Do not merge or split lines. Keep punctuation natural. Preserve proper nouns.\n\nReturn JSON in the form: {"lines": ["..."]} with the same array length as input.\n\nINPUT JSON:\n' +
          JSON.stringify(userPayload)
      }
    ]
  };

  const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }, 60000);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`OpenAI error ${resp.status}: ${errText || resp.statusText}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('OpenAI returned non-JSON content');
  }
  const outLines = parsed?.lines;
  if (!Array.isArray(outLines)) throw new Error('OpenAI JSON missing lines[]');
  if (outLines.length !== texts.length) {
    throw new Error(`OpenAI lines length mismatch: expected ${texts.length}, got ${outLines.length}`);
  }
  return outLines.map(v => (typeof v === 'string' ? v : String(v ?? '')));
}

async function translateChunkWithDeepL({ apiKey, targetLang, texts }) {
  const isFreeTier = apiKey.endsWith(':fx');
  const apiUrl = isFreeTier ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
  const body = {
    text: texts.map(normalizeSubtitleTextForTranslation),
    target_lang: mapDeepLTargetLang(targetLang)
  };

  const resp = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }, 60000);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`DeepL error ${resp.status}: ${errText || resp.statusText}`);
  }

  const data = await resp.json();
  const translations = data?.translations;
  if (!Array.isArray(translations)) throw new Error('DeepL returned no translations');
  const outLines = translations.map(t => t?.text ?? '');
  if (outLines.length !== texts.length) {
    throw new Error(`DeepL lines length mismatch: expected ${texts.length}, got ${outLines.length}`);
  }
  return outLines;
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
  subdl: { url: 'https://subdl.com/search/', method: 'GET' },
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
        } else if (sourceKey === 'subdl') {
            // Subdl search URL format: https://subdl.com/search/{query}
            const encodedQuery = encodeURIComponent(query.trim()).replace(/%20/g, '%20');
            url += `${encodedQuery}`;
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
            } else if (errorLower.includes('subdl')) {
              sourceName = 'Subdl';
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
        else if (request.url.includes('subdl.com')) source = 'subdl';
        
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
        if (request.url.includes('opensubtitles.org')) {
            let isOpenSubtitlesDetailPage = false;
            try {
                const u = new URL(request.url);
                const path = u.pathname || '';
                // Listing pages live under /en/search/... (no download button). Detail pages are /subtitles/<id> or /en/subtitles/<id>.
                // Ensure we don't misclassify /en/search/... as a detail page.
                isOpenSubtitlesDetailPage =
                    (/^\/en\/subtitles\/\d+/.test(path) || /^\/subtitles\/\d+/.test(path)) &&
                    !path.startsWith('/en/search/');
            } catch (e) {
                isOpenSubtitlesDetailPage =
                    (request.url.includes('/subtitles/') || request.url.includes('/en/subtitles/')) &&
                    !request.url.includes('/en/search/');
            }

            if (isOpenSubtitlesDetailPage) {
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

  } else if (request.action === 'translateSubtitleTexts') {
    (async () => {
      try {
        const { provider, targetLang, texts } = request;
        if (!Array.isArray(texts) || texts.length === 0) {
          chrome.runtime.sendMessage({ action: 'subtitleTranslationResult', translatedTexts: null, error: 'No texts to translate.' });
          return;
        }

        const storage = await chrome.storage.local.get(['openai_api_key', 'deepl_api_key', 'google_ai_studio_api_key']);
        const openaiKey = storage.openai_api_key || '';
        const deeplKey = storage.deepl_api_key || '';
        const googleAiStudioKey = storage.google_ai_studio_api_key || '';

        const selectedProvider = (provider || 'openai').toLowerCase();
        const chunks = chunkArray(texts, 40);
        const translatedAll = [];

        for (const chunk of chunks) {
          if (selectedProvider === 'deepl') {
            if (!deeplKey) throw new Error('Missing DeepL API key');
            const translated = await translateChunkWithDeepL({ apiKey: deeplKey, targetLang, texts: chunk });
            translatedAll.push(...translated);
          } else if (selectedProvider === 'google_ai_studio') {
            if (!googleAiStudioKey) throw new Error('Missing Google AI Studio API key');
            const translated = await translateChunkWithGoogleAIStudio({ apiKey: googleAiStudioKey, targetLang, texts: chunk });
            translatedAll.push(...translated);
          } else if (selectedProvider === 'gemini_chat') {
            if (!googleAiStudioKey) throw new Error('Missing Google AI Studio API key');
            const translated = await translateChunkWithGeminiChat({ apiKey: googleAiStudioKey, targetLang, texts: chunk });
            translatedAll.push(...translated);
          } else {
            if (!openaiKey) throw new Error('Missing OpenAI API key');
            const translated = await translateChunkWithOpenAI({ apiKey: openaiKey, targetLang, texts: chunk });
            translatedAll.push(...translated);
          }
        }

        if (translatedAll.length !== texts.length) {
          throw new Error(`Translation length mismatch: expected ${texts.length}, got ${translatedAll.length}`);
        }

        chrome.runtime.sendMessage({ action: 'subtitleTranslationResult', translatedTexts: translatedAll, error: null });
      } catch (error) {
        chrome.runtime.sendMessage({ action: 'subtitleTranslationResult', translatedTexts: null, error: error?.message || String(error) });
      }
    })();
    return;
  
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