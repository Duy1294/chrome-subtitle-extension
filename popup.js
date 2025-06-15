// popup.js

document.addEventListener('DOMContentLoaded', function() {
    // --- Element References ---
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchSource = document.getElementById('search-source');
    const resultsDiv = document.getElementById('results-div');
    const historyDiv = document.getElementById('history-div');
    const statusMessageDiv = document.getElementById('status-message');
    
    const applyBtn = document.getElementById('apply-btn');
    const applyStatus = document.getElementById('apply-status');
    const offsetInput = document.getElementById('offset-input');
    const offsetMinusBtn = document.getElementById('offset-minus');
    const offsetPlusBtn = document.getElementById('offset-plus');
    const positionInput = document.getElementById('position-input');
    const positionDownBtn = document.getElementById('position-down');
    const positionUpBtn = document.getElementById('position-up');
    const fontsizeInput = document.getElementById('fontsize-input');
    const fontsizeMinusBtn = document.getElementById('fontsize-minus');
    const fontsizePlusBtn = document.getElementById('fontsize-plus');
    const furiganaToggle = document.getElementById('furigana-toggle');
    const dictionaryToggle = document.getElementById('dictionary-toggle');
    const languageSelect = document.getElementById('language-select');

    const loadFileBtn = document.getElementById('load-file-btn');
    const fileInput = document.getElementById('file-input');

    const tabButtons = document.querySelectorAll('.tabs-nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const transcriptContainer = document.getElementById('transcript-container');

    // --- Constants ---
    const SETTINGS_KEY = 'subtitleUserSettings';
    const SEARCH_HISTORY_KEY = 'subtitleSearchHistory';
    const SESSION_SUB_KEY = 'session_currentSubData';
    const SESSION_APPEND_KEY = 'session_isAppending';
    const LAST_ACTIVE_TAB_KEY = 'lastActiveSubtitleTab';

    const defaultSettings = { 
        offset: 0, 
        position: 5, 
        fontSize: 2.5, 
        enableFurigana: false, 
        enableDictionary: false,
        language: 'japanese'
    };

    // --- State ---
    let transcriptSubtitles = [];
    let currentlyHighlighted = null;

    // --- Functions ---

    /**
     * Converts ASS time string (H:MM:SS.ss) to SRT time string (HH:MM:SS,ms).
     */
    function formatSrtTime(assTime) {
        const parts = assTime.split(':');
        const h = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const sec_ms = parts[2].split('.');
        const s = sec_ms[0].padStart(2, '0');
        const ms = (sec_ms[1] || '00').padEnd(3, '0');
        return `${h}:${m}:${s},${ms}`;
    }

    /**
     * Converts the entire content of an ASS file to SRT format.
     */
    function convertAssToSrt(assText) {
        const lines = assText.split(/\r?\n/);
        const srtEntries = [];
        let srtIndex = 1;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('Dialogue:')) {
                const parts = trimmedLine.split(',');
                if (parts.length < 10) continue;

                const startTime = parts[1].trim();
                const endTime = parts[2].trim();
                
                const textContent = parts.slice(9).join(',')
                                         .replace(/{[^}]*}/g, '') // Remove ASS styling tags
                                         .replace(/\\N/g, '\n')     // Convert newlines
                                         .trim();

                if (textContent) {
                    const srtStartTime = formatSrtTime(startTime);
                    const srtEndTime = formatSrtTime(endTime);
                    srtEntries.push(`${srtIndex}\n${srtStartTime} --> ${srtEndTime}\n${textContent}`);
                    srtIndex++;
                }
            }
        }
        return srtEntries.join('\n\n');
    }
    
    function clearAllSubtitleState() {
        chrome.storage.session.remove(SESSION_SUB_KEY);
        transcriptSubtitles = [];
        updateTranscriptDisplay();
        chrome.runtime.sendMessage({ action: 'clearSubtitles' });
        resultsDiv.innerHTML = '';
        showStatusMessage('<i>Enter a name and click Search.</i>');
    }

    async function loadSubData(srtText, isAppending = false) {
        if (isAppending) {
            const result = await chrome.storage.session.get([SESSION_SUB_KEY]);
            const existingSub = result[SESSION_SUB_KEY] || { data: '' };
            const newSubText = existingSub.data ? (existingSub.data + '\n\n' + srtText) : srtText;

            await chrome.storage.session.set({ [SESSION_SUB_KEY]: { data: newSubText } });
            transcriptSubtitles = parseSrtForTranscript(newSubText);
            
            chrome.runtime.sendMessage({
                action: 'applySettingsToTab',
                settings: getSettingsFromPanel(),
                data: srtText, // Send only the new part to be appended
                format: 'srt',
                append: true
            });
            showStatusMessage(`<i style="color: var(--success-color);">✓ Subtitle appended successfully.</i>`);
        } else {
            await chrome.storage.session.set({ [SESSION_SUB_KEY]: { data: srtText } });
            transcriptSubtitles = parseSrtForTranscript(srtText);
            await applySettingsFromPanel(true); // True indicates new data is loaded
        }
        updateTranscriptDisplay();
    }

    function showTab(targetTabId) {
        if (!targetTabId) return;
        tabContents.forEach(tab => tab.classList.toggle('active', tab.id === targetTabId));
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === targetTabId));
        chrome.storage.local.set({ [LAST_ACTIVE_TAB_KEY]: targetTabId });
    }

    function showStatusMessage(html, isError = false) {
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'none';
        statusMessageDiv.innerHTML = html;
        if(isError) statusMessageDiv.firstElementChild?.classList.add("error-message");
        statusMessageDiv.style.display = 'block';
    }

    function showResults() {
        statusMessageDiv.innerHTML = '';
        statusMessageDiv.style.display = 'none';
        resultsDiv.style.display = 'block';
    }
    
    function timeToSeconds(timeStr) {
        const timeRegex = /(?:(\d+):)?(\d+):(\d+)[,.](\d+)/;
        const match = timeStr.match(timeRegex);
        if (!match) return 0;
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const fracStr = match[4];
        const fraction = parseInt(fracStr, 10) / Math.pow(10, fracStr.length);
        return (hours * 3600) + (minutes * 60) + seconds + fraction;
    }
    
    function parseSrtForTranscript(srtText) {
        const subtitles = [];
        if (!srtText) return subtitles;
        const entries = srtText.trim().replace(/\r/g, '').split(/\n\s*\n/);
        for (const entry of entries) {
            const lines = entry.split('\n');
            if (lines.length >= 2) {
                const timeMatch = lines[1] ? lines[1].match(/(.+?)\s*-->\s*(.+)/) : null;
                if (timeMatch) {
                    const startTime = timeToSeconds(timeMatch[1].trim());
                    const text = lines.slice(2).join(' ').replace(/<[^>]*>/g, '');
                    if (text) subtitles.push({ startTime, text });
                }
            }
        }
        return subtitles;
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function updateTranscriptDisplay() {
        if (transcriptSubtitles.length === 0) {
            transcriptContainer.innerHTML = '<i>No transcript available. Load a subtitle file first.</i>';
            return;
        }
        transcriptContainer.innerHTML = '';
        transcriptSubtitles.forEach((sub, index) => {
            const entry = document.createElement('div');
            entry.className = 'transcript-entry';
            
            // SỬA ĐỔI: Thêm data-start-time để dễ dàng lấy thời gian gốc
            // GIẢI THÍCH: Lưu trữ thời gian gốc (chưa có offset) trực tiếp vào phần tử DOM
            // giúp việc tính toán khi click trở nên chính xác và đơn giản hơn.
            entry.dataset.startTime = sub.startTime; 

            entry.innerHTML = `<span class="timestamp">${formatTime(sub.startTime)}</span><span class="text">${sub.text}</span>`;
            transcriptContainer.appendChild(entry);
        });
    }

    function highlightTranscriptLine(index) {
        if (currentlyHighlighted) currentlyHighlighted.classList.remove('highlight');
        if (index < 0) {
            currentlyHighlighted = null;
            return;
        }
        // SỬA ĐỔI: Sử dụng querySelector an toàn hơn
        const newHighlightElement = transcriptContainer.querySelector(`.transcript-entry[data-start-time='${transcriptSubtitles[index].startTime}']`);
        if (newHighlightElement) {
            newHighlightElement.classList.add('highlight');
            const elemRect = newHighlightElement.getBoundingClientRect();
            const containerRect = transcriptContainer.getBoundingClientRect();
            // Scroll into view only if it's not already visible
            if (elemRect.top < containerRect.top || elemRect.bottom > containerRect.bottom) {
                 newHighlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            currentlyHighlighted = newHighlightElement;
        }
    }
    
    function getSettingsFromPanel() {
        return {
            offset: parseFloat(offsetInput.value) || 0,
            position: parseFloat(positionInput.value) || 5,
            fontSize: parseFloat(fontsizeInput.value) || 2.5,
            enableFurigana: furiganaToggle.checked,
            enableDictionary: dictionaryToggle.checked,
            language: languageSelect.value
        };
    }

    async function applySettingsFromPanel(newDataLoaded = false) {
        const settings = getSettingsFromPanel();
        applyStatus.textContent = newDataLoaded ? '✓ Subtitle loaded and settings applied.' : '✓ Settings updated.';
        applyStatus.className = 'status-message success';
        applyStatus.style.display = 'block';
        setTimeout(() => { applyStatus.style.display = 'none'; }, 3000);
        
        chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        
        const message = { action: 'applySettingsToTab', settings: settings };
        if (newDataLoaded) {
            const result = await chrome.storage.session.get([SESSION_SUB_KEY]);
            if (result[SESSION_SUB_KEY] && result[SESSION_SUB_KEY].data) {
                 message.data = result[SESSION_SUB_KEY].data;
                 message.format = 'srt';
            }
        }
        chrome.runtime.sendMessage(message);
    }
    
    function loadSettings() {
        chrome.storage.local.get([SETTINGS_KEY], (result) => {
            const savedSettings = result[SETTINGS_KEY] || {};
            const currentSettings = { ...defaultSettings, ...savedSettings };
            offsetInput.value = currentSettings.offset.toFixed(1);
            positionInput.value = currentSettings.position.toFixed(0);
            fontsizeInput.value = currentSettings.fontSize.toFixed(1);
            furiganaToggle.checked = currentSettings.enableFurigana;
            dictionaryToggle.checked = currentSettings.enableDictionary;
            languageSelect.value = currentSettings.language;
        });
    }

    function saveSearchHistory(query) {
        chrome.storage.local.get([SEARCH_HISTORY_KEY], (result) => {
            let history = result[SEARCH_HISTORY_KEY] || [];
            history = history.filter(item => item !== query);
            history.unshift(query);
            history = history.slice(0, 5);
            chrome.storage.local.set({ [SEARCH_HISTORY_KEY]: history }, loadSearchHistory);
        });
    }

    function loadSearchHistory() {
        chrome.storage.local.get([SEARCH_HISTORY_KEY], (result) => {
            const history = result[SEARCH_HISTORY_KEY] || [];
            historyDiv.innerHTML = '';
            if (history.length > 0) {
                const title = document.createElement('b');
                title.textContent = 'Recent:';
                historyDiv.appendChild(title);
                history.forEach(query => {
                    const historyItem = document.createElement('span');
                    historyItem.className = 'history-item';
                    historyItem.textContent = query;
                    historyItem.addEventListener('click', () => {
                        searchInput.value = query;
                        searchButton.click();
                    });
                    historyDiv.appendChild(historyItem);
                });
            }
        });
    }
    
    function adjustValue(inputElement, amount, precision) {
        let currentValue = parseFloat(inputElement.value) || 0;
        currentValue += amount;
        if (currentValue < 0 && inputElement.id !== 'offset-input') currentValue = 0;
        inputElement.value = currentValue.toFixed(precision);
    }

    function renderSearchResults(data, errors) {
        resultsDiv.innerHTML = '';
        showResults();

        if (errors && errors.length > 0) {
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            errorContainer.innerHTML = errors.map(e => `<i>- ${e}</i>`).join('<br>');
            resultsDiv.appendChild(errorContainer);
        }

        if (data && data.length > 0) {
            data.forEach(item => {
                const onClick = () => {
                    showStatusMessage(`<i>Loading subtitle page for <b>${item.title}</b>...</i>`);
                    chrome.runtime.sendMessage({ action: 'fetchSubtitlePage', url: item.url });
                };
                resultsDiv.appendChild(createItem(item, onClick, null));
            });
        } else {
            if (!errors || errors.length === 0) showStatusMessage('<i>No results found.</i>');
        }
    }
    
    function createItem(item, onLoad, onAppend) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'result-item';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'result-title';
        titleSpan.textContent = item.title;
        titleSpan.title = item.title;
        titleSpan.addEventListener('click', onLoad);

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'result-controls';

        const sourceSpan = document.createElement('span');
        sourceSpan.textContent = item.source.replace('.org', '');
        sourceSpan.className = `result-source source-${item.source.toLowerCase().replace('.org', '')}`;
        controlsDiv.appendChild(sourceSpan);

        if (onAppend) {
            const appendBtn = document.createElement('button');
            appendBtn.textContent = 'Append';
            appendBtn.className = 'action-btn append-btn';
            appendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onAppend();
            });
            controlsDiv.appendChild(appendBtn);
        }

        itemDiv.appendChild(titleSpan);
        itemDiv.appendChild(controlsDiv);
        return itemDiv;
    }

    function renderEpisodeList(data, error) {
        resultsDiv.innerHTML = '';
        if (error) {
            showStatusMessage(`<div class="error-message">Error: ${error}</div>`, true);
        } else if (data && data.length > 0) {
            showResults();
            data.forEach(item => {
                const onEpisodeLoad = () => handleEpisodeClick(item, false);
                const onEpisodeAppend = () => handleEpisodeClick(item, true);
                resultsDiv.appendChild(createItem(item, onEpisodeLoad, onEpisodeAppend));
            });
        } else {
            showStatusMessage('<i>No episodes found on this page.</i>');
        }
    }
    
    function handleEpisodeClick(episodeItem, isAppending) {
        const url = episodeItem.url;
        if (url.toLowerCase().endsWith('.zip') || url.toLowerCase().endsWith('.rar') || episodeItem.isDirectDownload) {
            chrome.runtime.sendMessage({ action: 'openDownloadTab', url: url });
            showStatusMessage(`<i>Opening download tab for <b>${episodeItem.title}</b>...</i>`);
            return;
        }

        chrome.storage.session.set({ [SESSION_APPEND_KEY]: isAppending });
        const message = isAppending ? `Appending subtitle from` : `Loading subtitle from`;
        showStatusMessage(`<i>${message} <b>${episodeItem.title}</b>...</i>`);
        
        const format = url.toLowerCase().endsWith('.ass') ? 'ass' : 'srt';
        chrome.runtime.sendMessage({ action: 'fetchSubtitleContent', url: url, format: format });
    }
    
    async function restoreTranscriptFromSession() {
        const result = await chrome.storage.session.get([SESSION_SUB_KEY]);
        if (result[SESSION_SUB_KEY] && result[SESSION_SUB_KEY].data) {
            const subData = result[SESSION_SUB_KEY];
            transcriptSubtitles = parseSrtForTranscript(subData.data);
            updateTranscriptDisplay();
        }
    }

    // --- Event Listeners ---
    tabButtons.forEach(button => button.addEventListener('click', () => showTab(button.dataset.tab)));

    searchButton.addEventListener('click', () => {
        clearAllSubtitleState();
        const query = searchInput.value.trim();
        if (!query) return;
        showStatusMessage('<i>Searching...</i>');
        saveSearchHistory(query);
        chrome.runtime.sendMessage({ action: 'search', query: query, source: searchSource.value });
    });

    applyBtn.addEventListener('click', () => applySettingsFromPanel(false));
    
    loadFileBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        clearAllSubtitleState();
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            let subText = e.target.result;
            const format = file.name.toLowerCase().endsWith('.ass') ? 'ass' : 'srt';

            if (format === 'ass') {
                try {
                    subText = convertAssToSrt(subText);
                } catch (error) {
                    console.error("ASS to SRT conversion failed:", error);
                    applyStatus.textContent = `Error converting ASS file. See console.`;
                    applyStatus.className = 'status-message error-message';
                    applyStatus.style.display = 'block';
                    return;
                }
            }
            
            loadSubData(subText, false);
            applyStatus.textContent = `✓ Loaded from file: ${file.name}`;
            applyStatus.className = 'status-message success';
            applyStatus.style.display = 'block';
            setTimeout(() => { applyStatus.style.display = 'none'; }, 4000);
        };
        reader.onerror = () => {
            applyStatus.textContent = `Error reading file: ${reader.error}`;
            applyStatus.className = 'status-message error-message';
            applyStatus.style.display = 'block';
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    // SỬA ĐỔI: Listener cho việc click vào transcript
    transcriptContainer.addEventListener('click', (e) => {
        // GIẢI THÍCH: Sử dụng event delegation để bắt sự kiện click trên toàn bộ container.
        // Dùng `closest` để tìm phần tử cha gần nhất có class `transcript-entry`.
        const entry = e.target.closest('.transcript-entry');
        if (entry && entry.dataset.startTime) {
            // Lấy thời gian gốc đã lưu trong data attribute
            const originalStartTime = parseFloat(entry.dataset.startTime);
            // Lấy giá trị offset hiện tại từ ô input
            const offset = parseFloat(offsetInput.value) || 0;
            // Tính toán thời gian cần tua đến, có tính cả offset
            let seekTime = originalStartTime + offset;

            // Đảm bảo thời gian không bị âm
            if (seekTime < 0) {
                seekTime = 0;
            }

            // Gửi tin nhắn đến content script để thực hiện việc tua video
            chrome.runtime.sendMessage({ action: 'seekVideo', time: seekTime });
        }
    });

    // Settings buttons
    offsetMinusBtn.addEventListener('click', () => adjustValue(offsetInput, -0.1, 1));
    offsetPlusBtn.addEventListener('click', () => adjustValue(offsetInput, 0.1, 1));
    positionDownBtn.addEventListener('click', () => adjustValue(positionInput, -1, 0));
    positionUpBtn.addEventListener('click', () => adjustValue(positionInput, 1, 0));
    fontsizeMinusBtn.addEventListener('click', () => adjustValue(fontsizeInput, -0.1, 1));
    fontsizePlusBtn.addEventListener('click', () => adjustValue(fontsizeInput, 0.1, 1));

    // --- Message Listener ---
    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        if (request.action === 'searchResults') {
            renderSearchResults(request.data, request.errors);
        } else if (request.action === 'episodeListReady') {
            renderEpisodeList(request.data, request.error);
        } else if (request.action === 'showStatus') {
            showStatusMessage(request.message);
        } else if (request.action === 'subtitleContentReady') {
            let subText = request.data;
            const format = request.format || 'srt';

            if (format === 'ass') {
                subText = convertAssToSrt(subText);
            }
            
            const { [SESSION_APPEND_KEY]: isAppending } = await chrome.storage.session.get([SESSION_APPEND_KEY]);
            chrome.storage.session.remove([SESSION_APPEND_KEY]);
            await loadSubData(subText, isAppending);
        } else if (request.action === 'updateTranscriptHighlight') {
            highlightTranscriptLine(request.index);
        }
    });

    // --- Initialization ---
    async function initialize() {
        loadSettings();
        loadSearchHistory();
        await restoreTranscriptFromSession();
        const { [LAST_ACTIVE_TAB_KEY]: lastTab } = await chrome.storage.local.get([LAST_ACTIVE_TAB_KEY]);
        showTab(lastTab || 'search-tab');
    }

    initialize();
});