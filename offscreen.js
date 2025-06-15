// offscreen.js

// Parser for Jimaku (Không thay đổi)
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

// Parser for Kitsunekko main directory (Không thay đổi)
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

// Parser for the episode/file list page
function parseEpisodeList(doc, baseUrl, source) {
    const results = [];
    let links;
    
    if (source === 'jimaku') {
        links = doc.querySelectorAll('a.table-data.file-name');
    } else if (source === 'kitsunekko') {
        links = doc.querySelectorAll('table#flisttable tr > td:first-child a');
    } else {
        return results; // Should not happen
    }
    
    links.forEach(link => {
        const title = link.textContent.trim();
        const relativeUrl = link.getAttribute('href');
        // Ignore invalid links and "Parent Directory" links
        if (title && relativeUrl && !title.includes('[Parent Directory]') && relativeUrl !== '../') {
            results.push({
                title: title,
                // *** FIX: Use the 'baseUrl' parameter to correctly resolve relative URLs for both sources ***
                url: new URL(relativeUrl, baseUrl).href,
                source: source === 'jimaku' ? 'Jimaku' : 'Kitsunekko'
            });
        }
    });
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
            }
            allResults = allResults.concat(pageResults);
        });

        allResults.sort((a, b) => a.title.localeCompare(b.title));
        
        chrome.runtime.sendMessage({ action: 'searchResults', data: allResults, errors: errors });

    } else if (request.action === 'parseEpisodeList') {
        const { htmlText, baseUrl, source } = request;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const results = parseEpisodeList(doc, baseUrl, source);
        
        results.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

        chrome.runtime.sendMessage({ action: 'episodeListReady', data: results });
    }
});