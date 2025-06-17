function cleanSubtitleText(text) {
  if (!text) return '';
  return text
    .replace(/^\uFEFF/, '')            
    .replace(/[\u200B-\u200F]/g, '')   
    .replace(/&lrm;/gi, '')             
    .replace(/&rlm;/gi, '');           
}

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
    const episodeRows = doc.querySelectorAll('tr[itemprop="episode"]');
    if (episodeRows.length > 0) {
        let currentSeason = "1";
        doc.querySelectorAll('#search_results tr').forEach(row => {
            const seasonHeader = row.querySelector('span[id^="season-"] b');
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
    if (results.length === 0) {
        const resultRows = doc.querySelectorAll('#search_results tr[id]');
        resultRows.forEach(row => {
            const linkElement = row.querySelector('strong a');
            if (linkElement) {
                let title = linkElement.textContent.trim();
                const relativeUrl = linkElement.getAttribute('href');
                const cellContent = linkElement.closest('td');
                if (cellContent) {
                    const contentClone = cellContent.cloneNode(true);
                    contentClone.querySelector('strong')?.remove();
                    let details = contentClone.textContent.trim().replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ');
                    if (details) {
                        title += ` - ${details}`;
                    }
                }
                results.push({
                    title: title,
                    url: new URL(relativeUrl, 'https://www.opensubtitles.org').href,
                    source: 'OpenSubtitles'
                });
            }
        });
    }
    return results;
}

function parseEpisodeList(doc, baseUrl, source) {
    const results = [];
    if (source === 'opensubtitles') {
        const downloadButton = doc.querySelector('#download-button, a[data-cy="download-button"], a[href*="/download/"]');
        if (downloadButton) {
            results.push({
                title: `Download: ${doc.querySelector('h1')?.textContent.trim() || 'Subtitle'}`,
                url: new URL(downloadButton.getAttribute('href'), 'https://www.opensubtitles.org').href,
                source: 'OpenSubtitles',
                isDirectDownload: true,
                format: 'zip'
            });
        }
        else if (doc.querySelectorAll('tr[itemprop="episode"]').length > 0) {
             return parseOpenSubtitles(doc, '');
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
    if (results.length > 0) {
        results.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    }
    return results;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'parseMultipleHtml') {
        const { pages, errors } = request;
        let allResults = [];
        const parser = new DOMParser();
        pages.forEach(page => {
            const doc = parser.parseFromString(page.htmlText, "text/html");
            let pageResults = [];
            if (page.source === 'jimaku') {
                pageResults = parseJimaku(doc, page.query);
            } else if (page.source === 'kitsunekko') {
                pageResults = parseKitsunekko(doc, page.query);
            } else if (page.source === 'opensubtitles') {
                pageResults = parseOpenSubtitles(doc, page.query);
            }
            allResults = allResults.concat(pageResults);
        });
        allResults.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
        chrome.runtime.sendMessage({ action: 'searchResults', data: allResults, errors: errors });
        return true;
    } else if (request.action === 'parseEpisodeList') {
        const { htmlText, baseUrl, source } = request;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const results = parseEpisodeList(doc, baseUrl, source);
        chrome.runtime.sendMessage({ action: 'episodeListReady', data: results });
        return true;
    }

    if (request.action === 'fetchAndProcessFile') {
        const { url, format } = request;
        if (format === 'zip') {
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.arrayBuffer();
                })
                .then(data => JSZip.loadAsync(data))
                .then(zip => {
                    let subtitleEntry = null;
                    const preferredExtensions = ['.srt', '.ass', '.vtt'];
                    for (const ext of preferredExtensions) {
                        for (const fileName of Object.keys(zip.files)) {
                            const file = zip.files[fileName];
                            const lowerCaseName = file.name.toLowerCase();
                            if (!file.dir && lowerCaseName.endsWith(ext) && !lowerCaseName.startsWith('__macosx')) {
                                subtitleEntry = file;
                                break;
                            }
                        }
                        if (subtitleEntry) break;
                    }
                    if (subtitleEntry) {
                        return subtitleEntry.async('string');
                    } else {
                        throw new Error('No subtitle file (.srt, .ass, .vtt) found in zip.');
                    }
                })
                .then(subtitleText => {
                    const cleanedText = cleanSubtitleText(subtitleText);
                    chrome.runtime.sendMessage({ action: 'unzippedSubtitleReady', data: cleanedText });
                })
                .catch(error => {
                    chrome.runtime.sendMessage({ action: 'fetchError', error: error.message });
                });
        } else {
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.text();
                })
                .then(subtitleText => {
                    const cleanedText = cleanSubtitleText(subtitleText);
                    chrome.runtime.sendMessage({ action: 'unzippedSubtitleReady', data: cleanedText });
                })
                .catch(error => {
                    chrome.runtime.sendMessage({ action: 'fetchError', error: error.message });
                });
        }
        return true;
    }
});