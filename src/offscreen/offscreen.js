import { Archive } from '../../lib/libarchive.js';

window.addEventListener('load', function() {
    function parseJimaku(doc, query) {
        const results = [];
        const lowerCaseQuery = query.toLowerCase();
        doc.querySelectorAll('a.file-name').forEach(link => {
            const title = link.textContent.trim();
            if (title.toLowerCase().includes(lowerCaseQuery)) {
                results.push({
                    title: title,
                    url: new URL(link.getAttribute('href'), 'https://jimaku.cc/').href,
                    source: 'Jimaku'
                });
            }
        });
        return results;
    }

    function parseKitsunekko(doc, query) {
        const results = [];
        const lowerCaseQuery = query.toLowerCase();
        doc.querySelectorAll('td[colspan="2"] a').forEach(link => {
            const title = link.textContent.trim();
            if (title && title.toLowerCase().includes(lowerCaseQuery)) {
                results.push({
                    title: title,
                    url: new URL(link.getAttribute('href'), 'https://kitsunekko.net/').href,
                    source: 'Kitsunekko'
                });
            }
        });
        return results;
    }

    function parseOpenSubtitles(doc, query) {
        const results = [];
        // Check if this is a subtitle list page (has subtitle rows with flags) or a movie list page
        // First, try to parse as subtitle list page (direct subtitles from search results)
        const subtitleRows = doc.querySelectorAll('table#search_results tr[id], #search_results tr[id], table tbody tr');
        
        // More accurate detection: check if rows have flags AND links to subtitle pages (not movie pages)
        let hasSubtitleRows = false;
        let hasMovieRows = false;
        
        Array.from(subtitleRows).forEach(row => {
            const mainCell = row.querySelector('td[id^="main"]');
            if (!mainCell) return;
            
            const link = mainCell.querySelector('a');
            if (!link) return;
            
            const href = link.getAttribute('href') || '';
            
            // Check if this is a movie/show page link (pattern: /idmovie-{number})
            if (href.includes('/idmovie-') && !href.includes('/subtitles/')) {
                hasMovieRows = true;
            }
            
            // Check if this is a subtitle row (has flag div OR link to subtitle page)
            const hasFlag = row.querySelector('div.flag') !== null;
            const isSubtitleLink = href.match(/\/subtitles\/[0-9]+\//) || href.includes('/download/');
            
            if (hasFlag || isSubtitleLink) {
                hasSubtitleRows = true;
            }
        });
        
        // If we found subtitle rows (and no movie rows), parse as subtitle list
        if (hasSubtitleRows && !hasMovieRows) {
            // This is a subtitle list page - parse subtitles directly
            return parseEpisodeList(doc, '', 'opensubtitles');
        }
        
        // Otherwise, this is a movie list page - continue to parse movie/show links
        
        // Otherwise, this is a movie list page - parse movie/show links
        // Structure: <tr id="name481532"><td id="main481532"><strong><a class="bnone" href="/en/search/sublanguageid-all/idmovie-481532">Your Name. (2016)</a></strong></td></tr>
        
        // Try multiple selectors to find result rows
        let resultRows = doc.querySelectorAll('#search_results tr[id^="name"]');
        if (resultRows.length === 0) {
            resultRows = doc.querySelectorAll('table#search_results tr[id^="name"]');
        }
        if (resultRows.length === 0) {
            resultRows = doc.querySelectorAll('tr[id^="name"]');
        }
        
        resultRows.forEach(row => {
            // Find the main cell with id="main{number}"
            const mainCell = row.querySelector('td[id^="main"]');
            if (!mainCell) return;
            
            // Find the link inside strong tag or directly in main cell
            let linkElement = mainCell.querySelector('strong a.bnone');
            if (!linkElement) {
                linkElement = mainCell.querySelector('a.bnone');
            }
            if (!linkElement) {
                linkElement = mainCell.querySelector('strong a');
            }
            if (!linkElement) {
                linkElement = mainCell.querySelector('a[href*="/idmovie-"]');
            }
            if (!linkElement) return;
            
            let title = linkElement.textContent.trim();
            const relativeUrl = linkElement.getAttribute('href');
            
            // Skip if this is not a movie/show page link
            // Movie/show page links have pattern: /en/search/sublanguageid-all/idmovie-{number} or /search/sublanguageid-all/idmovie-{number}
            if (!relativeUrl || !relativeUrl.includes('/idmovie-')) {
                return;
            }
            
            // Clean up title - remove extra whitespace
            title = title.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
            
            // Construct URL - if it's a relative URL, make it absolute
            let fullUrl;
            if (relativeUrl.startsWith('http')) {
                fullUrl = relativeUrl;
            } else if (relativeUrl.startsWith('/')) {
                fullUrl = new URL(relativeUrl, 'https://www.opensubtitles.org').href;
            } else {
                fullUrl = new URL(relativeUrl, 'https://www.opensubtitles.org/en/search/').href;
            }
            
            // Only add if we haven't seen this URL before
            if (title && fullUrl && !results.some(r => r.url === fullUrl)) {
                results.push({
                    title: title,
                    url: fullUrl,
                    source: 'OpenSubtitles'
                });
            }
        });
        
        // If no results found with above method, try alternative selectors
        if (results.length === 0) {
            doc.querySelectorAll('a[href*="/idmovie-"]').forEach(link => {
                const href = link.getAttribute('href');
                const title = link.textContent.trim();
                // Only add if it's a movie/show page link (not a subtitle page)
                if (title && href && href.includes('/idmovie-') && !href.match(/\/subtitles\/[0-9]+\//)) {
                    const fullUrl = href.startsWith('http') ? href : new URL(href, 'https://www.opensubtitles.org').href;
                    if (!results.some(r => r.url === fullUrl)) {
                        results.push({
                            title: title,
                            url: fullUrl,
                            source: 'OpenSubtitles'
                        });
                    }
                }
            });
        }
        
        return results;
    }

    function parseEpisodeList(doc, baseUrl, source) {
        const results = [];
        if (source === 'opensubtitles') {
            // Parse subtitle list from OpenSubtitles movie/show page
            // Look for episode rows first (TV shows)
        const episodeRows = doc.querySelectorAll('tr[itemprop="episode"]');
        if (episodeRows.length > 0) {
            let currentSeason = "1";
                doc.querySelectorAll('#search_results tr, table tr').forEach(row => {
                    const seasonHeader = row.querySelector('span[id^="season-"] b, b[id^="season-"]');
                if (seasonHeader) {
                    const seasonMatch = seasonHeader.textContent.match(/Season (\d+)/i);
                    if (seasonMatch) {
                        currentSeason = seasonMatch[1];
                    }
                }
                if (row.matches('tr[itemprop="episode"]')) {
                    const numberEl = row.querySelector('span[itemprop="episodeNumber"]');
                    const linkEl = row.querySelector('a[itemprop="url"]');
                    const nameEl = linkEl ? linkEl.querySelector('span[itemprop="name"]') : null;
                    if (numberEl && linkEl && nameEl) {
                        const episodeNumber = numberEl.textContent.trim();
                        const episodeName = nameEl.textContent.trim();
                        const url = new URL(linkEl.getAttribute('href'), 'https://www.opensubtitles.org').href;
                        const displayTitle = `S${currentSeason.padStart(2, '0')}E${episodeNumber.padStart(2, '0')}: ${episodeName}`;
                        results.push({ title: displayTitle, url, source: 'OpenSubtitles' });
                    }
                }
            });
        }
            
            // If no episodes, look for subtitle download links
        if (results.length === 0) {
                // Try to find subtitle list on the page
                const subtitleRows = doc.querySelectorAll('table#search_results tr[id], #search_results tr[id], table tbody tr');
                // Don't group - keep all subtitles in original order from source
                
                subtitleRows.forEach(row => {
                    // Skip header rows and rows without proper structure
                    if (!row.id || !row.id.startsWith('name')) {
                        // Still try to process if it has main cell
                        if (!row.querySelector('td[id^="main"]')) return;
                    }
                    
                    // Find the main subtitle link
                    const mainCell = row.querySelector('td[id^="main"]');
                    if (!mainCell) return;
                    
                    const linkElement = mainCell.querySelector('a.bnone, strong a');
                    if (!linkElement) return;
                    
                    const href = linkElement.getAttribute('href');
                    // Extract title - try to get subtitle-specific name first
                    // Look for <span> after <strong> or text after <br /> which contains subtitle-specific info
                    let title = null;
                    
                    // Strategy 1: Look for <span> with title attribute or text content after <strong>
                    const spanAfterStrong = mainCell.querySelector('strong + span, strong ~ span');
                    if (spanAfterStrong) {
                        const spanTitle = spanAfterStrong.getAttribute('title');
                        const spanText = spanAfterStrong.textContent.trim();
                        if (spanTitle && spanTitle.length > 0 && spanTitle.length < 200) {
                            title = spanTitle;
                        } else if (spanText && spanText.length > 0 && !spanText.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
                            // Don't use date patterns
                            title = spanText;
                        }
                    }
                    
                    // Strategy 2: Look for text nodes after <br /> tags (subtitle description)
                    if (!title) {
                        const brTags = mainCell.querySelectorAll('br');
                        for (const br of brTags) {
                            let nextSibling = br.nextSibling;
                            while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim()) {
                                nextSibling = nextSibling.nextSibling;
                            }
                            if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                                const text = nextSibling.textContent.trim();
                                if (text && text.length > 0 && !text.match(/^\d{2}\/\d{2}\/\d{2}$/) && !text.match(/^\d+\.\d+$/)) {
                                    // Not a date or FPS number
                                    title = text;
                                    break;
                                }
                            } else if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE) {
                                const elemText = nextSibling.textContent.trim();
                                if (elemText && elemText.length > 0 && !elemText.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
                                    title = elemText;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Strategy 3: Fallback to strong tag or link text (movie name)
                    if (!title) {
                        const strongTag = mainCell.querySelector('strong');
                        title = strongTag ? strongTag.textContent.trim() : linkElement.textContent.trim();
                    }
                    
                    // Try to find language flag div in the same row
                    // Flag is usually in a td cell: <td><div class="flag ro"></div></td>
                    // OR in a link: <td><a><div class="flag ro"></div></a></td>
                    let flagDiv = null;
                    let flagLink = null;
                    const allCells = row.querySelectorAll('td');
                    
                    // Strategy 1: Find flag div directly (most common - flag div in td, not in link)
                    for (const cell of allCells) {
                        // Skip the main cell
                        if (cell.id && cell.id.startsWith('main')) continue;
                        
                        // Look for flag div first (most reliable indicator)
                        flagDiv = cell.querySelector('div.flag');
                        if (flagDiv) {
                            // Check if flag div is inside a link
                            flagLink = flagDiv.closest('a');
                            break;
                        }
                    }
                    
                    // Strategy 2: If no flag div found, look for link with sublanguageid
                    if (!flagDiv) {
                        for (const cell of allCells) {
                            if (cell.id && cell.id.startsWith('main')) continue;
                            
                            const sublangLink = cell.querySelector('a[href*="/sublanguageid-"]');
                            if (sublangLink) {
                                flagLink = sublangLink;
                                // Try to find flag div inside this link
                                flagDiv = sublangLink.querySelector('div.flag');
                                break;
                            }
                        }
                    }
                    
                    // Strategy 3: Find any link with title attribute (language name)
                    if (!flagDiv && !flagLink) {
                        const allLinks = row.querySelectorAll('td a[title]');
                        for (const link of allLinks) {
                            if (link !== linkElement) {
                                const titleAttr = link.getAttribute('title');
                                if (titleAttr && titleAttr.trim().length > 0 && titleAttr.length < 50) {
                                    flagLink = link;
                                    flagDiv = link.querySelector('div.flag');
                                    break;
                                }
                            }
                        }
                    }
                    
                    let detectedLang = null;
                    
                    // Method 1: Extract from flag div class (e.g., class="flag ro" -> "ro")
                    if (flagDiv) {
                        const flagClass = flagDiv.className;
                        // Match pattern: "flag" followed by space and 2-letter code (e.g., "flag ro", "flag en")
                        const flagMatch = flagClass.match(/\bflag\s+([a-z]{2})\b/i);
                        if (flagMatch) {
                            const flagCode = flagMatch[1].toLowerCase();
                            const flagCodeMap = {
                                'pt': 'portuguese', 'pb': 'portuguese', 'en': 'english', 'ja': 'japanese',
                                'de': 'german', 'fr': 'french', 'es': 'spanish', 'spa': 'spanish',
                                'vi': 'vietnamese', 'ar': 'arabic', 'zh': 'chinese', 'zht': 'chinese',
                                'ko': 'korean', 'it': 'italian', 'ru': 'russian',
                                'th': 'thai', 'id': 'indonesian', 'tr': 'turkish',
                                'pl': 'polish', 'nl': 'dutch', 'sv': 'swedish',
                                'no': 'norwegian', 'da': 'danish', 'fi': 'finnish',
                                'el': 'greek', 'cs': 'czech', 'hu': 'hungarian',
                                'ro': 'romanian', 'bg': 'bulgarian', 'hr': 'croatian',
                                'sr': 'serbian', 'sk': 'slovak', 'sl': 'slovenian',
                                'hi': 'hindi', 'fa': 'persian', 'tl': 'tagalog',
                                'kn': 'kannada', 'be': 'belarusian', 'zt': 'chinese',
                                'uk': 'ukrainian', 'ms': 'malay', 'my': 'burmese'
                            };
                            detectedLang = flagCodeMap[flagCode] || null;
                        }
                    }
                    
                    // Method 2: Extract from flag link title attribute (if flag div didn't work)
                    if (!detectedLang && flagLink) {
                        // Method 1: Extract from title attribute (e.g., title="Portuguese")
                        const titleAttr = flagLink.getAttribute('title');
                        if (titleAttr && titleAttr.trim()) {
                            const titleLangMap = {
                                'Portuguese': 'portuguese', 'Português': 'portuguese',
                                'English': 'english', 'Inglês': 'english',
                                'Japanese': 'japanese', '日本語': 'japanese',
                                'German': 'german', 'Deutsch': 'german',
                                'French': 'french', 'Français': 'french',
                                'Spanish': 'spanish', 'Español': 'spanish',
                                'Vietnamese': 'vietnamese', 'Tiếng Việt': 'vietnamese',
                                'Arabic': 'arabic', 'العربية': 'arabic',
                                'Chinese': 'chinese', '中文': 'chinese',
                                'Korean': 'korean', '한국어': 'korean',
                                'Italian': 'italian', 'Italiano': 'italian',
                                'Russian': 'russian', 'русский': 'russian',
                                'Thai': 'thai', 'ไทย': 'thai',
                                'Indonesian': 'indonesian', 'Bahasa Indonesia': 'indonesian',
                                'Turkish': 'turkish', 'Türkçe': 'turkish',
                                'Polish': 'polish', 'Polski': 'polish',
                                'Dutch': 'dutch', 'Nederlands': 'dutch',
                                'Swedish': 'swedish', 'Svenska': 'swedish',
                                'Norwegian': 'norwegian', 'Norsk': 'norwegian',
                                'Danish': 'danish', 'Dansk': 'danish',
                                'Finnish': 'finnish', 'Suomi': 'finnish',
                                'Greek': 'greek', 'Ελληνικά': 'greek',
                                'Czech': 'czech', 'Čeština': 'czech',
                                'Hungarian': 'hungarian', 'Magyar': 'hungarian',
                                'Romanian': 'romanian', 'Română': 'romanian',
                                'Bulgarian': 'bulgarian', 'български': 'bulgarian',
                                'Croatian': 'croatian', 'Hrvatski': 'croatian',
                                'Serbian': 'serbian', 'Cрпски': 'serbian',
                                'Slovak': 'slovak', 'Slovenčina': 'slovak',
                                'Slovenian': 'slovenian', 'Slovenščina': 'slovenian',
                                'Hindi': 'hindi', 'हिन्दी': 'hindi',
                                'Persian': 'persian', 'فارسی': 'persian',
                                'Tagalog': 'tagalog',
                                'Kannada': 'kannada',
                                'Belarusian': 'belarusian',
                                'Chinese (traditional)': 'chinese',
                                'Ukrainian': 'ukrainian', 'українська': 'ukrainian',
                                'Malay': 'malay',
                                'Burmese': 'burmese'
                            };
                            detectedLang = titleLangMap[titleAttr] || null;
                        }
                        
                        // Method 2b: Extract from href pattern /sublanguageid-{code}
                        if (!detectedLang) {
                            const flagHref = flagLink.getAttribute('href');
                            if (flagHref) {
                                const sublangMatch = flagHref.match(/\/sublanguageid-([a-z]{2,3})/);
                                if (sublangMatch) {
                                    const langCode = sublangMatch[1];
                                    const langCodeMap = {
                                        'eng': 'english', 'en': 'english',
                                        'jpn': 'japanese', 'ja': 'japanese',
                                        'ger': 'german', 'de': 'german',
                                        'fre': 'french', 'fr': 'french',
                                        'spa': 'spanish', 'es': 'spanish',
                                        'vie': 'vietnamese', 'vi': 'vietnamese',
                                        'ara': 'arabic', 'ar': 'arabic',
                                        'chi': 'chinese', 'zh': 'chinese',
                                        'kor': 'korean', 'ko': 'korean',
                                        'ita': 'italian', 'it': 'italian',
                                        'por': 'portuguese', 'pt': 'portuguese',
                                        'rus': 'russian', 'ru': 'russian',
                                        'tha': 'thai', 'th': 'thai',
                                        'ind': 'indonesian', 'id': 'indonesian',
                                        'tur': 'turkish', 'tr': 'turkish',
                                        'pol': 'polish', 'pl': 'polish',
                                        'dut': 'dutch', 'nl': 'dutch',
                                        'swe': 'swedish', 'sv': 'swedish',
                                        'nor': 'norwegian', 'no': 'norwegian',
                                        'dan': 'danish', 'da': 'danish',
                                        'fin': 'finnish', 'fi': 'finnish',
                                        'gre': 'greek', 'el': 'greek',
                                        'cze': 'czech', 'cs': 'czech',
                                        'hun': 'hungarian', 'hu': 'hungarian',
                                        'rum': 'romanian', 'ro': 'romanian',
                                        'bul': 'bulgarian', 'bg': 'bulgarian',
                                        'hrv': 'croatian', 'hr': 'croatian',
                                        'srp': 'serbian', 'sr': 'serbian',
                                        'slo': 'slovak', 'sk': 'slovak',
                                        'slv': 'slovenian', 'sl': 'slovenian',
                                        'hin': 'hindi', 'hi': 'hindi',
                                        'per': 'persian', 'fa': 'persian',
                                        'tgl': 'tagalog', 'tl': 'tagalog',
                                        'kan': 'kannada', 'kn': 'kannada',
                                        'bel': 'belarusian', 'be': 'belarusian',
                                        'zht': 'chinese', 'zt': 'chinese',
                                        'ukr': 'ukrainian', 'uk': 'ukrainian',
                                        'may': 'malay', 'ms': 'malay',
                                        'bur': 'burmese', 'my': 'burmese'
                                    };
                                    detectedLang = langCodeMap[langCode] || null;
                                }
                            }
                        }
                    }
                    
                    // Method 3: Fallback - extract from main link URL (e.g., /deadlier-than-the-male-ro)
                    if (!detectedLang && href) {
                        // Try pattern: /en/subtitles/13426120/deadlier-than-the-male-ro -> extract "ro"
                        // Or: /your-name-pt -> extract "pt"
                        const urlLangMatch = href.match(/-([a-z]{2})(?:$|\/|\?)/);
                        if (urlLangMatch) {
                            const urlCode = urlLangMatch[1].toLowerCase();
                            const urlCodeMap = {
                                'pt': 'portuguese', 'pb': 'portuguese', 'en': 'english', 'ja': 'japanese',
                                'de': 'german', 'fr': 'french', 'es': 'spanish',
                                'vi': 'vietnamese', 'ar': 'arabic', 'zh': 'chinese', 'zht': 'chinese',
                                'ko': 'korean', 'it': 'italian', 'ru': 'russian',
                                'th': 'thai', 'id': 'indonesian', 'tr': 'turkish',
                                'pl': 'polish', 'nl': 'dutch', 'sv': 'swedish',
                                'no': 'norwegian', 'da': 'danish', 'fi': 'finnish',
                                'el': 'greek', 'cs': 'czech', 'hu': 'hungarian',
                                'ro': 'romanian', 'bg': 'bulgarian', 'hr': 'croatian',
                                'sr': 'serbian', 'sk': 'slovak', 'sl': 'slovenian',
                                'hi': 'hindi', 'fa': 'persian', 'tl': 'tagalog',
                                'kn': 'kannada', 'be': 'belarusian', 'zt': 'chinese',
                                'uk': 'ukrainian', 'ms': 'malay', 'my': 'burmese'
                            };
                            detectedLang = urlCodeMap[urlCode] || null;
                        }
                    }
                    
                    // Method 4: Final fallback - use detectLanguage function
                    if (!detectedLang) {
                        detectedLang = detectLanguage(title, href, 'opensubtitles');
                    }
                    
                    // Clean up title - remove extra whitespace and newlines
                    title = title.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
                    
                    if (title && href) {
                        const fullUrl = new URL(href, 'https://www.opensubtitles.org').href;
                        
                        // Add subtitle directly without grouping - keep all subtitles in original order
                    results.push({
                            title: title, // Keep original title as-is
                            url: fullUrl,
                            source: 'OpenSubtitles',
                            language: detectedLang, // Keep null if not detected, don't default
                            isDirectDownload: href.includes('/download/'),
                            format: href.includes('/download/') ? 'zip' : null
                    });
                }
            });

                // Fallback: look for download button
                if (results.length === 0) {
            const downloadButton = doc.querySelector('#download-button, a[data-cy="download-button"], a[href*="/download/"]');
            if (downloadButton) {
                        // Try to detect language from URL
                        const href = downloadButton.getAttribute('href');
                        const langMatch = baseUrl.match(/\/subtitles\/([a-z]{2,3})\//);
                        let detectedLang = null;
                        if (langMatch) {
                            const langCodeMap = {
                                'eng': 'english', 'en': 'english',
                                'jpn': 'japanese', 'ja': 'japanese',
                                'ger': 'german', 'de': 'german',
                                'fre': 'french', 'fr': 'french',
                                'spa': 'spanish', 'es': 'spanish',
                                'vie': 'vietnamese', 'vi': 'vietnamese'
                            };
                            detectedLang = langCodeMap[langMatch[1]] || null;
                        }
                        
                results.push({
                    title: `Download: ${doc.querySelector('h1')?.textContent.trim() || 'Subtitle'}`,
                            url: new URL(href, 'https://www.opensubtitles.org').href,
                    source: 'OpenSubtitles',
                            language: detectedLang,
                    isDirectDownload: true,
                    format: 'zip'
                });
            }
                }
            }
        } else if (source === 'jimaku') {
            doc.querySelectorAll('a.table-data.file-name').forEach(link => {
                const title = link.textContent.trim();
                if (title && !title.includes('[Parent Directory]')) {
                    results.push({ title, url: new URL(link.getAttribute('href'), baseUrl).href, source: 'Jimaku' });
                }
            });
        } else if (source === 'kitsunekko') {
            doc.querySelectorAll('table#flisttable tr > td:first-child a').forEach(link => {
                const title = link.textContent.trim();
                if (title && !title.includes('[Parent Directory]')) {
                    results.push({ title, url: new URL(link.getAttribute('href'), baseUrl).href, source: 'Kitsunekko' });
                }
            });
        }
        // Don't sort - keep results in original order from source
        return results;
    }

    // Helper function to detect language from title or URL
    function detectLanguage(title, url, source) {
        // First, try to extract language from URL (most reliable for OpenSubtitles)
        if (url) {
            const langMatch = url.match(/\/subtitles\/([a-z]{2,3})\//);
            if (langMatch) {
                const langCode = langMatch[1];
                const langCodeMap = {
                    'eng': 'english', 'en': 'english',
                    'jpn': 'japanese', 'ja': 'japanese',
                    'ger': 'german', 'de': 'german',
                    'fre': 'french', 'fr': 'french',
                    'spa': 'spanish', 'es': 'spanish',
                    'vie': 'vietnamese', 'vi': 'vietnamese',
                    'ara': 'arabic', 'ar': 'arabic',
                    'chi': 'chinese', 'zh': 'chinese',
                    'kor': 'korean', 'ko': 'korean',
                    'ita': 'italian', 'it': 'italian',
                    'por': 'portuguese', 'pt': 'portuguese',
                    'rus': 'russian', 'ru': 'russian',
                    'tha': 'thai', 'th': 'thai',
                    'ind': 'indonesian', 'id': 'indonesian',
                    'tur': 'turkish', 'tr': 'turkish',
                    'pol': 'polish', 'pl': 'polish',
                    'dut': 'dutch', 'nl': 'dutch',
                    'swe': 'swedish', 'sv': 'swedish',
                    'nor': 'norwegian', 'no': 'norwegian',
                    'dan': 'danish', 'da': 'danish',
                    'fin': 'finnish', 'fi': 'finnish',
                    'gre': 'greek', 'el': 'greek',
                    'cze': 'czech', 'cs': 'czech',
                    'hun': 'hungarian', 'hu': 'hungarian',
                    'rum': 'romanian', 'ro': 'romanian',
                    'bul': 'bulgarian', 'bg': 'bulgarian',
                    'hrv': 'croatian', 'hr': 'croatian',
                    'srp': 'serbian', 'sr': 'serbian',
                    'slo': 'slovak', 'sk': 'slovak',
                    'slv': 'slovenian', 'sl': 'slovenian'
                };
                const detected = langCodeMap[langCode];
                if (detected) {
                    return detected;
                }
            }
        }
        
        const titleLower = title.toLowerCase();
        const urlLower = url ? url.toLowerCase() : '';
        
        // Language keywords in title
        const languageKeywords = {
            japanese: ['japanese', 'jpn', 'ja', '日本語', 'jap'],
            english: ['english', 'eng', 'en', 'anglais'],
            german: ['german', 'ger', 'de', 'deutsch'],
            french: ['french', 'fre', 'fr', 'français'],
            spanish: ['spanish', 'spa', 'es', 'español'],
            vietnamese: ['vietnamese', 'vie', 'vi', 'tiếng việt'],
            arabic: ['arabic', 'ara', 'ar', 'عربي'],
            chinese: ['chinese', 'chi', 'zh', '中文'],
            korean: ['korean', 'kor', 'ko', '한국어'],
            italian: ['italian', 'ita', 'it', 'italiano'],
            portuguese: ['portuguese', 'por', 'pt', 'português'],
            russian: ['russian', 'rus', 'ru', 'русский'],
            thai: ['thai', 'tha', 'th', 'ไทย'],
            indonesian: ['indonesian', 'ind', 'id', 'bahasa indonesia'],
            turkish: ['turkish', 'tur', 'tr', 'türkçe'],
            polish: ['polish', 'pol', 'pl', 'polski'],
            dutch: ['dutch', 'dut', 'nl', 'nederlands'],
            swedish: ['swedish', 'swe', 'sv', 'svenska'],
            norwegian: ['norwegian', 'nor', 'no', 'norsk'],
            danish: ['danish', 'dan', 'da', 'dansk'],
            finnish: ['finnish', 'fin', 'fi', 'suomi'],
            greek: ['greek', 'gre', 'el', 'ελληνικά'],
            czech: ['czech', 'cze', 'cs', 'čeština'],
            hungarian: ['hungarian', 'hun', 'hu', 'magyar'],
            romanian: ['romanian', 'rum', 'ro', 'română'],
            bulgarian: ['bulgarian', 'bul', 'bg', 'български'],
            croatian: ['croatian', 'hrv', 'hr', 'hrvatski'],
            serbian: ['serbian', 'srp', 'sr', 'српски'],
            slovak: ['slovak', 'slo', 'sk', 'slovenčina'],
            slovenian: ['slovenian', 'slv', 'sl', 'slovenščina']
        };
        
        // Check title and URL for language indicators
        for (const [lang, keywords] of Object.entries(languageKeywords)) {
            for (const keyword of keywords) {
                if (titleLower.includes(keyword) || urlLower.includes(keyword)) {
                    return lang;
                }
            }
        }
        
        // Source-specific defaults
        if (source === 'jimaku' || source === 'kitsunekko') {
            return 'japanese'; // These sources are primarily Japanese
        }
        
        return null; // Unknown language - don't default to English
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractOpenSubtitlesDownloadLink') {
            const { htmlText, baseUrl } = request;
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            // Try to find download link - priority order:
            // 1. Direct download link: https://dl.opensubtitles.org/en/download/sub/...
            // 2. Subtitle serve link: /en/subtitleserve/sub/...
            // 3. Download button with href
            
            let downloadUrl = null;
            
            // Method 1: Look for direct download link (dl.opensubtitles.org) - highest priority
            const directDownloadLinks = doc.querySelectorAll('a[href*="dl.opensubtitles.org"], a[href*="/download/sub/"]');
            for (const link of directDownloadLinks) {
                const href = link.getAttribute('href');
                if (href && (href.includes('dl.opensubtitles.org') || href.includes('/download/sub/'))) {
                    downloadUrl = href.startsWith('http') ? href : new URL(href, 'https://www.opensubtitles.org').href;
                    break;
                }
            }
            
            // Method 2: Look for download button with specific ID or classes
            if (!downloadUrl) {
                const downloadButton = doc.querySelector('a#bt-dwl-bt, a.bt-dwl, a[href*="/subtitleserve/sub/"]');
                if (downloadButton) {
                    const href = downloadButton.getAttribute('href');
                    if (href) {
                        // Convert subtitleserve to direct download if possible
                        if (href.includes('/subtitleserve/sub/')) {
                            const subIdMatch = href.match(/\/sub\/(\d+)/);
                            if (subIdMatch) {
                                downloadUrl = `https://dl.opensubtitles.org/en/download/sub/${subIdMatch[1]}`;
                            } else {
                                downloadUrl = href.startsWith('http') ? href : new URL(href, 'https://www.opensubtitles.org').href;
                            }
                        } else {
                            downloadUrl = href.startsWith('http') ? href : new URL(href, 'https://www.opensubtitles.org').href;
                        }
                    }
                }
            }
            
            // Method 3: Look for any download link
            if (!downloadUrl) {
                const allDownloadLinks = doc.querySelectorAll('a[href*="/download/"], a[href*="/subtitleserve/"]');
                for (const link of allDownloadLinks) {
                    const href = link.getAttribute('href');
                    if (href) {
                        if (href.includes('/download/sub/')) {
                            downloadUrl = href.startsWith('http') ? href : new URL(href, 'https://www.opensubtitles.org').href;
                            break;
                        } else if (href.includes('/subtitleserve/sub/') && !downloadUrl) {
                            const subIdMatch = href.match(/\/sub\/(\d+)/);
                            if (subIdMatch) {
                                downloadUrl = `https://dl.opensubtitles.org/en/download/sub/${subIdMatch[1]}`;
                            } else {
                                downloadUrl = href.startsWith('http') ? href : new URL(href, 'https://www.opensubtitles.org').href;
                            }
                        }
                    }
                }
            }
            
            // Method 3: Extract subtitle ID from URL and construct download link
            if (!downloadUrl) {
                const subtitleIdMatch = baseUrl.match(/\/subtitles\/(\d+)/);
                if (subtitleIdMatch) {
                    const subtitleId = subtitleIdMatch[1];
                    // Try direct download link first
                    downloadUrl = `https://dl.opensubtitles.org/en/download/sub/${subtitleId}`;
                }
            }
            
            chrome.runtime.sendMessage({ 
                action: 'downloadLinkExtracted', 
                downloadUrl: downloadUrl 
            });
            return true;
        }
        
        if (request.action === 'extractPaginationLinks') {
            const { htmlText, baseUrl } = request;
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const paginationLinks = [];
            
            // Find pagination links - look for links with /offset- pattern
            const paginationElements = doc.querySelectorAll('a[href*="/offset-"]');
            const offsetUrls = new Set();
            
            paginationElements.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.includes('/offset-')) {
                    const fullUrl = href.startsWith('http') ? href : new URL(href, 'https://www.opensubtitles.org').href;
                    // Only add if it's a valid offset URL (not the current page)
                    if (fullUrl.includes('/offset-') && !fullUrl.includes('/offset-0')) {
                        offsetUrls.add(fullUrl);
                    }
                }
            });
            
            // Also check pagination info to determine total pages
            const paginationInfo = doc.querySelector('.pager-list, #pager, .pager, .pager-list a');
            if (paginationInfo) {
                // Find the last pagination link to determine max offset
                const allPagerLinks = doc.querySelectorAll('.pager-list a[href*="/offset-"], #pager a[href*="/offset-"]');
                if (allPagerLinks.length > 0) {
                    const lastLink = allPagerLinks[allPagerLinks.length - 1];
                    const lastHref = lastLink.getAttribute('href');
                    const lastOffsetMatch = lastHref.match(/\/offset-(\d+)/);
                    if (lastOffsetMatch) {
                        const lastOffset = parseInt(lastOffsetMatch[1]);
                        // Generate all offset URLs (40 results per page)
                        const baseUrlWithoutOffset = baseUrl.replace(/\/offset-\d+.*$/, '');
                        for (let offset = 40; offset <= lastOffset; offset += 40) {
                            const offsetUrl = baseUrlWithoutOffset + `/offset-${offset}`;
                            offsetUrls.add(offsetUrl);
                        }
                    }
                }
            }
            
            paginationLinks.push(...Array.from(offsetUrls));
            chrome.runtime.sendMessage({ action: 'paginationLinksExtracted', links: paginationLinks });
            return true;
        }
        
        if (request.action === 'parseMultipleHtml') {
            const { pages, errors } = request;
            let allResults = [];
            const parser = new DOMParser();
            const moviePagesToFetch = []; // Store movie pages that need to be fetched
            
            pages.forEach(page => {
                const doc = parser.parseFromString(page.htmlText, "text/html");
                let pageResults = [];
                if (page.source === 'jimaku') {
                    pageResults = parseJimaku(doc, page.query);
                } else if (page.source === 'kitsunekko') {
                    pageResults = parseKitsunekko(doc, page.query);
                } else if (page.source === 'opensubtitles') {
                    pageResults = parseOpenSubtitles(doc, page.query);
                    
                    // Check if results are movie/show links (have /idmovie- in URL)
                    // If so, mark them as movies (not subtitles) so user can select which movie to view subtitles for
                    pageResults = pageResults.map(result => {
                        if (result.url && result.url.includes('/idmovie-')) {
                            // This is a movie/show page link, mark it as such
                            return {
                                ...result,
                                isMovie: true, // Flag to indicate this is a movie, not a subtitle
                                language: null // Movies don't have language until we fetch their subtitle page
                            };
                        }
                        // This is a direct subtitle result
                        const detectedLang = detectLanguage(result.title, result.url, page.source);
                        return { ...result, language: detectedLang, isMovie: false };
                    });
                } else {
                    // Add language detection to each result for other sources
                    pageResults = pageResults.map(result => {
                        const detectedLang = detectLanguage(result.title, result.url, page.source);
                        return { ...result, language: detectedLang, isMovie: false };
                    });
                }
                
                allResults = allResults.concat(pageResults);
            });
            
            // Separate movies and subtitles
            const movies = allResults.filter(r => r.isMovie);
            const subtitles = allResults.filter(r => !r.isMovie);
            
            // For movies: keep original order from source (no grouping, no sorting)
            // For subtitles: group duplicates and sort
            const groupedSubtitles = new Map();
            subtitles.forEach(result => {
                // Extract base title (remove year and extra info)
                const titleMatch = result.title.match(/^(.+?)\s*\((\d{4})\)/);
                let baseTitle = titleMatch ? titleMatch[1].trim() : result.title;
                
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
                const langKey = result.language || '_no_lang';
                const groupKey = `${normalizedTitle}_${langKey}`;
                
                // Only add if not seen before (same subtitle + same language)
                if (!groupedSubtitles.has(groupKey)) {
                    // Use the cleaned title with year if available
                    const displayTitle = titleMatch 
                        ? `${titleMatch[1].trim()} (${titleMatch[2]})`
                        : baseTitle;
                    
                    groupedSubtitles.set(groupKey, {
                        ...result,
                        title: displayTitle
                    });
                }
            });
            
            // Convert grouped subtitles to array and sort
            const groupedSubtitlesArray = Array.from(groupedSubtitles.values());
            groupedSubtitlesArray.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
            
            // Combine: movies first (in original order from source), then sorted subtitles
            allResults = [...movies, ...groupedSubtitlesArray];
            
            chrome.runtime.sendMessage({ action: 'searchResults', data: allResults, errors: errors });
            return true;
        } else if (request.action === 'parseEpisodeList') {
            const { htmlText, baseUrl, source } = request;
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, "text/html");
            const results = parseEpisodeList(doc, baseUrl, source);
            // Check if this is called from fetchMoviePages (no episodeListReady listener) or from user click
            chrome.runtime.sendMessage({ action: 'episodeListReady', data: results });
            chrome.runtime.sendMessage({ action: 'episodeListParsed', data: results });
            return true;
        }

        if (request.action === 'fetchAndProcessFile') {
            (async () => {
                const { url, format } = request;

                const processSubtitleContent = (subtitleText, fileExtension = 'srt') => {
                    try {
                        if (!subtitleText || typeof subtitleText !== 'string') {
                            throw new Error('Invalid subtitle text: not a string');
                        }
                        
                        const cleanedText = subtitleText.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '').trim();
                        if (!cleanedText || cleanedText === '') {
                            throw new Error('Empty or invalid subtitle file.');
                        }
                        
                        console.log('Processing subtitle content, length:', cleanedText.length);
                        console.log('File extension:', fileExtension);
                        console.log('First 200 chars:', cleanedText.substring(0, 200));
                        
                        // Determine format from file extension (not auto-detect)
                        let format = 'srt'; // default
                        const ext = fileExtension.toLowerCase().replace(/^\./, ''); // Remove leading dot if present
                        if (ext === 'srt') {
                            format = 'srt';
                        } else if (ext === 'ass' || ext === 'ssa') {
                            format = 'ass';
                        } else if (ext === 'vtt') {
                            format = 'vtt';
                        } else if (ext === 'sub') {
                            format = 'sub';
                        }
                        
                        console.log('Using format:', format);
                        
                        // Parse with explicit format based on file extension
                        let captions;
                        try {
                            captions = subsrt.parse(cleanedText, { format: format });
                        } catch (parseError) {
                            console.warn('Parse with format', format, 'failed, trying srt:', parseError);
                            // Fallback to srt format
                            captions = subsrt.parse(cleanedText, { format: 'srt' });
                        }
                        
                        if (!captions || captions.length === 0) {
                            throw new Error('No captions found in subtitle file.');
                        }
                        
                        console.log('Parsed captions count:', captions.length);
                        
                        const cleanedCaptions = captions.map(caption => {
                            if (!caption.text) return caption;
                            caption.text = caption.text.replace(/{[^}]+}/g, '');
                            caption.text = caption.text.replace(/<[^>]*>/g, '');
                            caption.text = caption.text.replace(/\\N/g, '\n');
                            return caption;
                        });

                        const srtContent = subsrt.build(cleanedCaptions, { format: 'srt' });
                        
                        if (!srtContent || srtContent.trim() === '') {
                            throw new Error('Generated SRT content is empty.');
                        }
                        
                        console.log('Sending unzippedSubtitleReady, content length:', srtContent.length);
                        chrome.runtime.sendMessage({ action: 'unzippedSubtitleReady', data: srtContent });
                    } catch (error) {
                        console.error("Subsrt parsing/building error:", error);
                        console.error("Subtitle text sample:", subtitleText ? subtitleText.substring(0, 500) : 'null');
                        chrome.runtime.sendMessage({ action: 'fetchError', error: error.message || 'Could not parse subtitle file.' });
                    }
                };
                
                const decodeWithFallback = async (buffer) => {
                    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
                    let decodedText = utf8Decoder.decode(buffer);

                    if (decodedText.includes('\uFFFD')) {
                        console.warn('UTF-8 decoding resulted in replacement characters. Falling back to windows-1252.');
                        const fallbackDecoder = new TextDecoder('windows-1252');
                        decodedText = fallbackDecoder.decode(buffer);
                    }
                    return decodedText;
                };

                const fetchAndDecode = async (url) => {
                    // Follow redirects and check final response
                    let response = await fetch(url, { redirect: 'follow' });
                    
                    // If redirected, check the final URL
                    if (response.redirected) {
                        const finalUrl = response.url;
                        // If final URL is still an HTML page, try to extract download link from it
                        if (finalUrl.includes('/subtitles/') && !finalUrl.includes('/download/')) {
                            throw new Error('Redirected to HTML page. Need to extract download link.');
                        }
                    }
                    
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    
                    const contentType = response.headers.get('content-type') || '';
                    // Check if response is HTML
                    if (contentType.includes('text/html')) {
                        // Try to read a bit of content to confirm
                        const text = await response.clone().text();
                        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                        throw new Error('File is an HTML page, not a subtitle file.');
                        }
                    }
                    
                    const buffer = await response.arrayBuffer();
                    return decodeWithFallback(buffer);
                };

                try {
                    if (format === 'zip') {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const data = await response.arrayBuffer();
                        const zip = await JSZip.loadAsync(data);
                        
                        // Log all files in ZIP
                        const allFilesInZip = Object.keys(zip.files);
                        console.log('=== ZIP EXTRACTION DEBUG ===');
                        console.log('Total entries in ZIP:', allFilesInZip.length);
                        console.log('All files/folders in ZIP:');
                        allFilesInZip.forEach((fileName, index) => {
                            const file = zip.files[fileName];
                            const isDir = file.dir;
                            const size = isDir ? 'DIR' : (file._data ? file._data.uncompressedSize : 'unknown');
                            console.log(`  [${index + 1}] ${fileName} (${isDir ? 'DIRECTORY' : 'FILE'}, size: ${size})`);
                        });
                        
                        let subtitleEntry = null;
                        let fileExtension = 'srt'; // default
                        
                        // Supported subtitle file extensions (in priority order)
                        const supportedExtensions = ['.srt', '.ass', '.ssa', '.vtt', '.sub'];
                        
                        console.log('Searching for subtitle files with extensions:', supportedExtensions);
                        
                        // Find first file with supported extension
                        for (const ext of supportedExtensions) {
                            console.log(`  Checking for ${ext} files...`);
                            for (const fileName of Object.keys(zip.files)) {
                                const file = zip.files[fileName];
                                const lowerCaseName = file.name.toLowerCase();
                                if (!file.dir && lowerCaseName.endsWith(ext) && !lowerCaseName.startsWith('__macosx')) {
                                    subtitleEntry = file;
                                    fileExtension = ext; // Store the extension found
                                    console.log(`  ✓ Found ${ext} file: ${fileName}`);
                                    break;
                                }
                            }
                            if (subtitleEntry) {
                                console.log(`  → Selected file: ${subtitleEntry.name} with extension: ${fileExtension}`);
                                break;
                            } else {
                                console.log(`  ✗ No ${ext} file found`);
                            }
                        }

                        if (subtitleEntry) {
                            console.log('=== SELECTED FILE INFO ===');
                            console.log('File name:', subtitleEntry.name);
                            console.log('File extension:', fileExtension);
                            console.log('File path in ZIP:', subtitleEntry.name);
                            const buffer = await subtitleEntry.async('arraybuffer');
                            console.log('Extracted buffer size:', buffer.byteLength, 'bytes');
                            const text = await decodeWithFallback(buffer);
                            console.log('Decoded text length:', text.length, 'characters');
                            console.log('First 300 characters of decoded text:');
                            console.log(text.substring(0, 300));
                            console.log('=== END ZIP DEBUG ===');
                            // Pass file extension to processSubtitleContent
                            processSubtitleContent(text, fileExtension);
                        } else {
                            // List all files in zip for debugging
                            const allFiles = Object.keys(zip.files).filter(name => !zip.files[name].dir);
                            console.error('=== ERROR: No subtitle file found ===');
                            console.error('Available files in ZIP:', allFiles);
                            console.error('Supported extensions:', supportedExtensions);
                            throw new Error(`No subtitle file (.srt, .ass, .vtt, .sub) found in zip. Available files: ${allFiles.join(', ')}`);
                        }
                    } else if (format === 'rar' || format === '7z') {
                        await Archive.init({
                            workerUrl: 'worker-bundle.js'
                        });
        
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const blob = await response.blob();
                        const file = new File([blob], `subtitle.${format}`);

                        const archive = await Archive.open(file);
                        const extractedFiles = await archive.extractFiles();
                        
                        let subtitleFile = null;
                        const preferredExtensions = ['.srt', '.ass', '.vtt'];
                         for (const ext of preferredExtensions) {
                            for (const fileName in extractedFiles) {
                                if (fileName.toLowerCase().endsWith(ext)) {
                                    subtitleFile = extractedFiles[fileName];
                                    break;
                                }
                            }
                            if (subtitleFile) break;
                        }

                        if (subtitleFile) {
                            // Extract extension from filename
                            let fileExtension = 'srt';
                            for (const ext of ['.srt', '.ass', '.ssa', '.vtt', '.sub']) {
                                if (subtitleFile.name && subtitleFile.name.toLowerCase().endsWith(ext)) {
                                    fileExtension = ext;
                                    break;
                                }
                            }
                            console.log('Found subtitle file in archive:', subtitleFile.name, 'extension:', fileExtension);
                            const fileBuffer = await subtitleFile.arrayBuffer();
                            const text = await decodeWithFallback(fileBuffer);
                            processSubtitleContent(text, fileExtension);
                        } else {
                            throw new Error(`No subtitle file (.srt, .ass, .vtt, .sub) found in ${format} archive.`);
                        }
                    } else {
                        // For direct file download, first check if it's actually a ZIP file
                        console.log('Direct file download, checking file type...');
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        
                        // Check content-type header
                        const contentType = response.headers.get('content-type') || '';
                        console.log('Content-Type:', contentType);
                        
                        // Read first few bytes to check for ZIP signature
                        const buffer = await response.arrayBuffer();
                        const firstBytes = new Uint8Array(buffer.slice(0, 4));
                        const isZipFile = firstBytes[0] === 0x50 && firstBytes[1] === 0x4B && 
                                         (firstBytes[2] === 0x03 || firstBytes[2] === 0x05 || firstBytes[2] === 0x07);
                        
                        console.log('First bytes (hex):', Array.from(firstBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                        console.log('Is ZIP file (PK signature):', isZipFile);
                        
                        if (isZipFile || contentType.includes('zip') || contentType.includes('application/zip')) {
                            // It's actually a ZIP file, process it as ZIP
                            console.log('File is ZIP, processing as ZIP archive...');
                            const zip = await JSZip.loadAsync(buffer);
                            
                            // Log all files in ZIP
                            const allFilesInZip = Object.keys(zip.files);
                            console.log('=== ZIP EXTRACTION DEBUG (from direct download) ===');
                            console.log('Total entries in ZIP:', allFilesInZip.length);
                            console.log('All files/folders in ZIP:');
                            allFilesInZip.forEach((fileName, index) => {
                                const file = zip.files[fileName];
                                const isDir = file.dir;
                                const size = isDir ? 'DIR' : (file._data ? file._data.uncompressedSize : 'unknown');
                                console.log(`  [${index + 1}] ${fileName} (${isDir ? 'DIRECTORY' : 'FILE'}, size: ${size})`);
                            });
                            
                            let subtitleEntry = null;
                            let fileExtension = 'srt';
                            const supportedExtensions = ['.srt', '.ass', '.ssa', '.vtt', '.sub'];
                            
                            console.log('Searching for subtitle files with extensions:', supportedExtensions);
                            
                            for (const ext of supportedExtensions) {
                                console.log(`  Checking for ${ext} files...`);
                                for (const fileName of Object.keys(zip.files)) {
                                    const file = zip.files[fileName];
                                    const lowerCaseName = file.name.toLowerCase();
                                    if (!file.dir && lowerCaseName.endsWith(ext) && !lowerCaseName.startsWith('__macosx')) {
                                        subtitleEntry = file;
                                        fileExtension = ext;
                                        console.log(`  ✓ Found ${ext} file: ${fileName}`);
                                        break;
                                    }
                                }
                                if (subtitleEntry) {
                                    console.log(`  → Selected file: ${subtitleEntry.name} with extension: ${fileExtension}`);
                                    break;
                                } else {
                                    console.log(`  ✗ No ${ext} file found`);
                                }
                            }
                            
                            if (subtitleEntry) {
                                console.log('=== SELECTED FILE INFO ===');
                                console.log('File name:', subtitleEntry.name);
                                console.log('File extension:', fileExtension);
                                const fileBuffer = await subtitleEntry.async('arraybuffer');
                                console.log('Extracted buffer size:', fileBuffer.byteLength, 'bytes');
                                const text = await decodeWithFallback(fileBuffer);
                                console.log('Decoded text length:', text.length, 'characters');
                                console.log('First 300 characters of decoded text:');
                                console.log(text.substring(0, 300));
                                console.log('=== END ZIP DEBUG ===');
                                processSubtitleContent(text, fileExtension);
                            } else {
                                const allFiles = Object.keys(zip.files).filter(name => !zip.files[name].dir);
                                console.error('No subtitle file found in zip. Available files:', allFiles);
                                throw new Error(`No subtitle file (.srt, .ass, .vtt, .sub) found in zip. Available files: ${allFiles.join(', ')}`);
                            }
                        } else {
                            // It's a direct subtitle file, detect extension from URL
                            let fileExtension = 'srt';
                            const urlLower = url.toLowerCase();
                            if (urlLower.endsWith('.ass') || urlLower.endsWith('.ssa')) {
                                fileExtension = '.ass';
                            } else if (urlLower.endsWith('.vtt')) {
                                fileExtension = '.vtt';
                            } else if (urlLower.endsWith('.sub')) {
                                fileExtension = '.sub';
                            } else if (urlLower.endsWith('.srt')) {
                                fileExtension = '.srt';
                            }
                            console.log('Direct subtitle file, detected extension from URL:', fileExtension);
                            const text = await decodeWithFallback(buffer);
                            processSubtitleContent(text, fileExtension);
                        }
                    }
                } catch (error) {
                    chrome.runtime.sendMessage({ action: 'fetchError', error: error.message });
                }
            })();
            return true;
        }
    });
});