import { Archive } from './libarchive.js';

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
            (async () => {
                const { url, format } = request;

                const processSubtitleContent = (subtitleText) => {
                    try {
                        const cleanedText = subtitleText.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '');
                        if (!cleanedText || cleanedText.trim() === '') {
                            throw new Error('Empty or invalid subtitle file.');
                        }
                        const captions = subsrt.parse(cleanedText);
                        
                        const cleanedCaptions = captions.map(caption => {
                            caption.text = caption.text.replace(/{[^}]+}/g, '');
                            caption.text = caption.text.replace(/\\N/g, '\n');
                            return caption;
                        });

                        const srtContent = subsrt.build(cleanedCaptions, { format: 'srt' });
                        chrome.runtime.sendMessage({ action: 'unzippedSubtitleReady', data: srtContent });
                    } catch (error) {
                        console.error("Subsrt parsing/building error:", error);
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
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('text/html')) {
                        throw new Error('File is an HTML page, not a subtitle file.');
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
                            const buffer = await subtitleEntry.async('arraybuffer');
                            const text = await decodeWithFallback(buffer);
                            processSubtitleContent(text);
                        } else {
                            throw new Error('No subtitle file (.srt, .ass, .vtt) found in zip.');
                        }
                    } else if (format === 'rar') {
                        await Archive.init({
                            workerUrl: 'worker-bundle.js'
                        });
        
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const blob = await response.blob();
                        const file = new File([blob], "subtitle.rar");

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
                            const fileBuffer = await subtitleFile.arrayBuffer();
                            const text = await decodeWithFallback(fileBuffer);
                            processSubtitleContent(text);
                        } else {
                            throw new Error('No subtitle file (.srt, .ass, .vtt) found in rar archive.');
                        }
                    } else {
                        const text = await fetchAndDecode(url);
                        processSubtitleContent(text);
                    }
                } catch (error) {
                    chrome.runtime.sendMessage({ action: 'fetchError', error: error.message });
                }
            })();
            return true;
        }
    });
});