// offscreen.js

// --- CÁC HÀM PARSE HTML GIỮ NGUYÊN ---

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
    const resultRows = doc.querySelectorAll('#search_results tr[id]');
    resultRows.forEach(row => {
        const linkElement = row.querySelector('strong a');
        if (linkElement) {
            const title = linkElement.textContent.trim();
            const relativeUrl = linkElement.getAttribute('href');
            results.push({
                title: title,
                url: new URL(relativeUrl, 'https://www.opensubtitles.org').href,
                source: 'OpenSubtitles'
            });
        }
    });
    return results;
}

function parseEpisodeList(doc, baseUrl, source) {
    const results = [];
    let links;
    if (source === 'jimaku') {
        links = doc.querySelectorAll('a.table-data.file-name');
    } else if (source === 'kitsunekko') {
        links = doc.querySelectorAll('table#flisttable tr > td:first-child a');
    } else if (source === 'opensubtitles') {
        const downloadLink = doc.querySelector('a[href*="/download/"]');
        if (downloadLink) {
            results.push({
                title: `Download: ${doc.querySelector('h1')?.textContent.trim() || 'Subtitle'}`,
                url: new URL(downloadLink.getAttribute('href'), 'https://www.opensubtitles.org').href,
                source: 'OpenSubtitles',
                isDirectDownload: true,
                format: 'zip' // <<< SỬA ĐỔI QUAN TRỌNG: Thêm định dạng tường minh
            });
        }
        return results;
    } else {
        return results;
    }
    links.forEach(link => {
        const title = link.textContent.trim();
        const relativeUrl = link.getAttribute('href');
        if (title && relativeUrl && !title.includes('[Parent Directory]') && relativeUrl !== '../') {
            results.push({
                title: title,
                url: new URL(relativeUrl, baseUrl).href,
                source: source === 'jimaku' ? 'Jimaku' : 'Kitsunekko'
            });
        }
    });
    return results;
}


// --- CÁC MESSAGE LISTENER ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Listener cho việc parse HTML từ các trang tìm kiếm chính
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

        allResults.sort((a, b) => a.title.localeCompare(b.title));
        
        chrome.runtime.sendMessage({ action: 'searchResults', data: allResults, errors: errors });
        return true;

    // Listener cho việc parse HTML từ các trang danh sách tập tin/phụ đề
    } else if (request.action === 'parseEpisodeList') {
        const { htmlText, baseUrl, source } = request;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const results = parseEpisodeList(doc, baseUrl, source);
        
        results.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

        chrome.runtime.sendMessage({ action: 'episodeListReady', data: results });
        return true;
    }

    // LISTENER MỚI ĐỂ TẢI VÀ GIẢI NÉN FILE
    if (request.action === 'fetchAndProcessFile') {
        const { url, format } = request;

        // Xử lý file ZIP
        if (format === 'zip') {
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.arrayBuffer();
                })
                .then(data => JSZip.loadAsync(data))
                .then(zip => {
                    let subtitleEntry = null;
                    for (const fileName of Object.keys(zip.files)) {
                        const file = zip.files[fileName];
                        const lowerCaseName = file.name.toLowerCase();
                        if (!file.dir && (lowerCaseName.endsWith('.srt') || lowerCaseName.endsWith('.ass')) && !lowerCaseName.startsWith('__macosx')) {
                            subtitleEntry = file;
                            break;
                        }
                    }
                    if (subtitleEntry) {
                        return subtitleEntry.async('string');
                    } else {
                        throw new Error('No subtitle file (.srt, .ass) found in zip.');
                    }
                })
                .then(subtitleText => {
                    // Gửi kết quả về cho background script
                    chrome.runtime.sendMessage({ action: 'unzippedSubtitleReady', data: subtitleText });
                })
                .catch(error => {
                    // Gửi lỗi về cho background script
                    chrome.runtime.sendMessage({ action: 'fetchError', error: error.message });
                });
        } else {
            // Xử lý các file thường (srt, ass trực tiếp)
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.text();
                })
                .then(subtitleText => {
                    // Gửi kết quả về cho background script, dùng chung message cho đơn giản
                    chrome.runtime.sendMessage({ action: 'unzippedSubtitleReady', data: subtitleText });
                })
                .catch(error => {
                    chrome.runtime.sendMessage({ action: 'fetchError', error: error.message });
                });
        }
        return true;
    }
});