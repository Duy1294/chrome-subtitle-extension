document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
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
    const targetLanguageSelect = document.getElementById('target-language-select');
    const loadFileBtn = document.getElementById('load-file-btn');
    const fileInput = document.getElementById('file-input');
    const tabButtons = document.querySelectorAll('.tabs-nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const transcriptContainer = document.getElementById('transcript-container');
    const backButton = document.getElementById('back-button');
    const sourceCheckboxes = document.querySelectorAll('.source-checkbox');
    const moveOnPauseToggle = document.getElementById('move-on-pause-toggle');
    const backgroundStyleSelect = document.getElementById('background-style-select');
    const panelWidthRow = document.getElementById('panel-width-row');
    const panelWidthInput = document.getElementById('panel-width-input');
    const panelWidthMinusBtn = document.getElementById('panel-width-minus');
    const panelWidthPlusBtn = document.getElementById('panel-width-plus');
    const panelHeightRow = document.getElementById('panel-height-row');
    const panelHeightInput = document.getElementById('panel-height-input');
    const panelHeightMinusBtn = document.getElementById('panel-height-minus');
    const panelHeightPlusBtn = document.getElementById('panel-height-plus');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    const filterContainer = document.getElementById('filter-container');
    const filterInput = document.getElementById('filter-input');
    const deeplApiKeyInput = document.getElementById('deepl-api-key-input');
    const dictionaryProviderSelect = document.getElementById('dictionary-provider-select');
    const vocabTabBtn = document.getElementById('vocab-tab-btn');
    const vocabListContainer = document.getElementById('vocab-list-container');
    const exportVocabBtn = document.getElementById('export-vocab-btn');

    const DEEPL_KEY_STORAGE = 'deepl_api_key';
    const DICTIONARY_PROVIDER_KEY = 'dictionaryProviderSettings';
    const TARGET_LANGUAGE_KEY = 'targetTranslationLanguage';

    deeplApiKeyInput.addEventListener('change', () => {
        const key = deeplApiKeyInput.value.trim();
        chrome.storage.local.set({ [DEEPL_KEY_STORAGE]: key });
    });

    targetLanguageSelect.addEventListener('change', () => {
        chrome.storage.local.set({ [TARGET_LANGUAGE_KEY]: targetLanguageSelect.value });
    });

    filterInput.addEventListener('input', () => {
        const filterText = filterInput.value.toLowerCase();
        const resultItems = resultsDiv.querySelectorAll('.result-item');
        
        resultItems.forEach(item => {
            const title = item.querySelector('.result-title').textContent.toLowerCase();
            if (title.includes(filterText)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', function() {
            const isConfirmed = window.confirm(
                "Are you sure you want to reset everything?\n\n" +
                "This will delete all your saved settings, search history, and clear any loaded subtitles. " +
                "The extension will be restored to its default state."
            );

            if (isConfirmed) {
                chrome.storage.local.clear(() => {
                    console.log('Local storage cleared.');
                });
                chrome.storage.session.clear(() => {
                    console.log('Session storage cleared.');
                });
                chrome.runtime.sendMessage({ action: 'clearSubtitles' });
                alert('All settings and data have been reset. The panel will now reload.');
                window.location.reload();
            }
        });
    }

    const SETTINGS_KEY = 'subtitleUserSettings';
    const SEARCH_HISTORY_KEY = 'subtitleSearchHistory';
    const SESSION_SUB_KEY = 'session_currentSubData';
    const SESSION_APPEND_KEY = 'session_isAppending';
    const LAST_ACTIVE_TAB_KEY = 'lastActiveSubtitleTab';
    const SELECTED_SOURCES_KEY = 'selectedSubtitleSources';
    const UI_STATE_KEY = 'ui_lastState';
    const LAST_SEARCH_TIME_KEY = 'lastSearchTimestamp';
    const SEARCH_COOLDOWN = 5000;
    const VOCAB_LIST_KEY = 'userVocabularyList';

    const defaultSettings = {
        offset: 0,
        position: 5,
        fontSize: 2.5,
        enableFurigana: false,
        enableDictionary: false,
        language: 'japanese',
        targetLanguage: 'VI',
        moveOnPause: false,
        backgroundStyle: 'default',
        panelWidth: 90,
        panelHeight: 80,
        dictionaryProvider: {
            japanese: 'jisho',
            german: 'deepl',
            english: 'deepl',
            french: 'deepl',
            spanish: 'deepl',
            vietnamese: 'google_translate'
        }
    };

    let transcriptSubtitles = [];
    let currentlyHighlighted = null;
    let searchResultsCache = null;

    async function updateDictionaryProviderOptions() {
        const currentLanguage = languageSelect.value;
        
        const availableProviders = {
            japanese: [
                { value: 'jisho', text: 'Jisho.org' },
                { value: 'google_translate', text: 'Google Translate' }
            ],
            german: [
                { value: 'deepl', text: 'DeepL' },
                { value: 'google_translate', text: 'Google Translate' }
            ],
            english: [
                { value: 'deepl', text: 'DeepL' },
                { value: 'google_translate', text: 'Google Translate' }
            ],
            french: [
                { value: 'deepl', text: 'DeepL' },
                { value: 'google_translate', text: 'Google Translate' }
            ],
            spanish: [
                { value: 'deepl', text: 'DeepL' },
                { value: 'google_translate', text: 'Google Translate' }
            ],
            vietnamese: [
                { value: 'google_translate', text: 'Google Translate' }
            ]
        };

        dictionaryProviderSelect.innerHTML = '';
        const providersForLang = availableProviders[currentLanguage] || availableProviders.english;
        
        providersForLang.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.value;
            option.textContent = provider.text;
            dictionaryProviderSelect.appendChild(option);
        });

        const result = await chrome.storage.local.get(DICTIONARY_PROVIDER_KEY);
        const savedProviders = result[DICTIONARY_PROVIDER_KEY] || defaultSettings.dictionaryProvider;
        dictionaryProviderSelect.value = savedProviders[currentLanguage] || providersForLang[0].value;
    }

    async function saveDictionaryProviderSetting() {
        const currentLanguage = languageSelect.value;
        const selectedProvider = dictionaryProviderSelect.value;

        const result = await chrome.storage.local.get(DICTIONARY_PROVIDER_KEY);
        let savedProviders = result[DICTIONARY_PROVIDER_KEY] || defaultSettings.dictionaryProvider;
        
        savedProviders[currentLanguage] = selectedProvider;

        chrome.storage.local.set({ [DICTIONARY_PROVIDER_KEY]: savedProviders });
    }

    fileInput.addEventListener('change', (event) => {
        clearAllSubtitleState(true);
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const rawText = e.target.result;
            try {
                const captions = subsrt.parse(rawText);
                const srtText = subsrt.build(captions, { format: 'srt' });
                loadSubData(srtText, false);
                applyStatus.textContent = `Loaded from file: ${file.name}`;
                applyStatus.className = 'status-message success';
                applyStatus.style.display = 'block';
                setTimeout(() => { applyStatus.style.display = 'none'; }, 4000);
            } catch (error) {
                showStatusMessage(`<i>Error: Could not process file. It may be invalid or unsupported.</i>`, true);
                console.error("Error processing local file:", error);
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    function clearAllSubtitleState(isNewSearch = false) {
        chrome.storage.session.remove([SESSION_SUB_KEY]);
        if (isNewSearch) {
            chrome.storage.session.remove([UI_STATE_KEY]);
        }
        transcriptSubtitles = [];
        updateTranscriptDisplay();
        chrome.runtime.sendMessage({ action: 'clearSubtitles' });
        resultsDiv.innerHTML = '';
        showStatusMessage('<i>Enter a name and click Search.</i>');
        filterContainer.style.display = 'none';
        filterInput.value = '';
    }

    async function loadSubData(srtText, isAppending = false) {
        if (isAppending) {
            const result = await chrome.storage.session.get([SESSION_SUB_KEY]);
            const existingSub = result[SESSION_SUB_KEY] || { data: '' };
            const newSubText = existingSub.data ? (existingSub.data + '\n\n' + srtText) : srtText;
            await chrome.storage.session.set({ [SESSION_SUB_KEY]: { data: newSubText, isNew: false } });
            transcriptSubtitles = parseSrtForTranscript(newSubText);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'displaySubtitles', settings: getSettingsFromPanel(), data: srtText, format: 'srt', append: true });
                }
            });
            showStatusMessage(`<i style="color: var(--success-color);">Subtitle appended successfully.</i>`);
        } else {
            await chrome.storage.session.set({ [SESSION_SUB_KEY]: { data: srtText, isNew: false } });
            transcriptSubtitles = parseSrtForTranscript(srtText);
            await applySettingsFromPanel(true);
            showStatusMessage(`<i style="color: var(--success-color);">Subtitle loaded successfully. View in Transcript tab.</i>`);
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
        if (isError) statusMessageDiv.firstElementChild?.classList.add("error-message");
        statusMessageDiv.style.display = 'block';
        filterContainer.style.display = 'none';
        filterInput.value = '';
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
        const cleanedText = srtText.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '');
        const entries = cleanedText.trim().replace(/\r/g, '').split(/\n\s*\n/);
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
        const newHighlightElement = transcriptContainer.querySelector(`.transcript-entry[data-start-time='${transcriptSubtitles[index].startTime}']`);
        if (newHighlightElement) {
            newHighlightElement.classList.add('highlight');
            const elemRect = newHighlightElement.getBoundingClientRect();
            const containerRect = transcriptContainer.getBoundingClientRect();
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
            language: languageSelect.value,
            targetLanguage: targetLanguageSelect.value,
            moveOnPause: moveOnPauseToggle.checked,
            backgroundStyle: backgroundStyleSelect.value,
            panelWidth: parseInt(panelWidthInput.value, 10) || 90,
            panelHeight: parseInt(panelHeightInput.value, 10) || 80
        };
    }

    async function applySettingsFromPanel(newDataLoaded = false) {
        const settings = getSettingsFromPanel();
        applyStatus.textContent = newDataLoaded ? 'Subtitle loaded and settings applied.' : 'Settings updated.';
        applyStatus.className = 'status-message success';
        applyStatus.style.display = 'block';
        setTimeout(() => { applyStatus.style.display = 'none'; }, 3000);

        chrome.storage.local.set({ [SETTINGS_KEY]: settings });

        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0] && tabs[0].id) {
                const message = {
                    action: 'displaySubtitles',
                    settings: settings
                };
                if (newDataLoaded) {
                    const result = await chrome.storage.session.get([SESSION_SUB_KEY]);
                    if (result[SESSION_SUB_KEY] && result[SESSION_SUB_KEY].data) {
                        message.data = result[SESSION_SUB_KEY].data;
                        message.format = 'srt';
                    }
                }
                chrome.tabs.sendMessage(tabs[0].id, message);
            }
        });
    }

    function loadSettings() {
        chrome.storage.local.get([SETTINGS_KEY, SELECTED_SOURCES_KEY, DEEPL_KEY_STORAGE, DICTIONARY_PROVIDER_KEY, TARGET_LANGUAGE_KEY], (result) => {
            const savedSettings = result[SETTINGS_KEY] || {};
            const currentSettings = { ...defaultSettings, ...savedSettings };
            offsetInput.value = currentSettings.offset.toFixed(1);
            positionInput.value = currentSettings.position.toFixed(0);
            fontsizeInput.value = currentSettings.fontSize.toFixed(1);
            furiganaToggle.checked = currentSettings.enableFurigana;
            dictionaryToggle.checked = currentSettings.enableDictionary;
            languageSelect.value = currentSettings.language;
            targetLanguageSelect.value = result[TARGET_LANGUAGE_KEY] || defaultSettings.targetLanguage;
            moveOnPauseToggle.checked = currentSettings.moveOnPause;
            backgroundStyleSelect.value = currentSettings.backgroundStyle;
            panelWidthInput.value = currentSettings.panelWidth;
            panelHeightInput.value = currentSettings.panelHeight;
            togglePanelSettings();

            updateDictionaryProviderOptions();

            const savedSources = result[SELECTED_SOURCES_KEY];
            if (savedSources && savedSources.length > 0) {
                sourceCheckboxes.forEach(cb => {
                    cb.checked = savedSources.includes(cb.value);
                });
            } else {
                sourceCheckboxes.forEach(cb => cb.checked = true);
            }

            if (result[DEEPL_KEY_STORAGE]) {
                deeplApiKeyInput.value = result[DEEPL_KEY_STORAGE];
            }
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
        let currentValue = (precision === 0) ? parseInt(inputElement.value, 10) : parseFloat(inputElement.value);
        currentValue = (currentValue || 0) + amount;
        if (currentValue < 0 && inputElement.id !== 'offset-input') currentValue = 0;
        inputElement.value = currentValue.toFixed(precision);
    }
    
    function createItem(item, onLoad, onAppend) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'result-item';
        itemDiv.addEventListener('click', onLoad);
        const mainInfoDiv = document.createElement('div');
        mainInfoDiv.className = 'result-main-info';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'result-title';
        titleSpan.textContent = item.title;
        titleSpan.title = item.title;
        mainInfoDiv.appendChild(titleSpan);
        itemDiv.appendChild(mainInfoDiv);
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'result-controls';
        if (item.source) {
            const sourceSpan = document.createElement('span');
            sourceSpan.textContent = item.source.replace('.org', '');
            sourceSpan.className = `result-source source-${item.source.toLowerCase().replace('.org', '')}`;
            controlsDiv.appendChild(sourceSpan);
        }
        if (onAppend) {
            const appendBtn = document.createElement('button');
            appendBtn.innerHTML = '+';
            appendBtn.title = 'Append Subtitle';
            appendBtn.className = 'action-btn append-btn';
            appendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onAppend();
            });
            controlsDiv.appendChild(appendBtn);
        }
        itemDiv.appendChild(controlsDiv);
        return itemDiv;
    }

    function renderSearchResults(data, errors) {
        resultsDiv.innerHTML = '';
        if (data.length === 0 && errors.length === 0) {
            showStatusMessage('<i>No results found.</i>');
            return;
        }
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
                    showStatusMessage(`<i>Loading list for <b>${item.title}</b>...</i>`);
                    chrome.runtime.sendMessage({ action: 'fetchSubtitlePage', url: item.url });
                };
                resultsDiv.appendChild(createItem(item, onClick, null));
            });
            filterContainer.style.display = 'block';
        }
    }

    function renderEpisodeList(data, error) {
        resultsDiv.innerHTML = '';
        if (error) {
            showStatusMessage(`<div class="error-message">Error: ${error}</div>`, true);
            return;
        }
        if (data && data.length > 0) {
            showResults();
            data.forEach(item => {
                const onEpisodeLoad = () => handleEpisodeClick(item, false);
                const onEpisodeAppend = () => handleEpisodeClick(item, true);
                resultsDiv.appendChild(createItem(item, onEpisodeLoad, onEpisodeAppend));
            });
            filterContainer.style.display = 'block';
        } else {
            showStatusMessage('<i>No subtitle files found on this page.</i>');
        }
    }
    
    function handleEpisodeClick(episodeItem, isAppending) {
        chrome.storage.session.set({ [SESSION_APPEND_KEY]: isAppending });
        const message = isAppending ? `Appending subtitle from` : `Loading subtitle from`;
        showStatusMessage(`<i>${message} <b>${episodeItem.title}</b>...</i>`);
        
        let format = 'srt';
        if (episodeItem.format) {
            format = episodeItem.format;
        } else {
            const url = episodeItem.url.toLowerCase();
            if (url.endsWith('.ass')) {
                format = 'ass';
            } else if (url.includes('.zip')) {
                format = 'zip';
            }
        }
        
        chrome.runtime.sendMessage({ action: 'fetchSubtitleContent', url: episodeItem.url, format: format });
    }
    
    async function checkAndLoadSessionSubtitle() {
        const result = await chrome.storage.session.get(SESSION_SUB_KEY);
        if (result[SESSION_SUB_KEY] && result[SESSION_SUB_KEY].isNew) {
            const subData = result[SESSION_SUB_KEY];
            const isAppending = (await chrome.storage.session.get(SESSION_APPEND_KEY))[SESSION_APPEND_KEY] || false;
            await chrome.storage.session.remove(SESSION_APPEND_KEY);
            await loadSubData(subData.data, isAppending);
        }
    }

    async function restoreLastUiState() {
        const result = await chrome.storage.session.get(UI_STATE_KEY);
        const state = result[UI_STATE_KEY];
        if (!state) {
            showStatusMessage('<i>Enter a name and click Search.</i>');
            return;
        }
        searchResultsCache = state.backButtonCache;
        if (state.view === 'episodeList') {
            renderEpisodeList(state.data, state.error);
            if (searchResultsCache) {
                backButton.style.display = 'block';
            }
        } else if (state.view === 'searchResults') {
            renderSearchResults(state.data, state.errors);
            backButton.style.display = 'none';
        } else {
            showStatusMessage('<i>Enter a name and click Search.</i>');
        }
    }

    function formatDefinitionForTooltip(response) {
        if (!response || !response.success || !response.data) {
            return 'No definition available.';
        }

        let definition = '';
        if (response.source === 'jisho') {
            const entry = response.data.data[0];
            if (!entry) return 'No definition found.';
            const japanese = entry.japanese[0];
            const reading = japanese.reading || '';
            definition += `Reading: ${reading}\n\n`;
            entry.senses.forEach(sense => {
                definition += `[${sense.parts_of_speech.join(', ')}]\n`;
                sense.english_definitions.forEach((def, i) => {
                    definition += `${i + 1}. ${def}\n`;
                });
            });
        } else if (response.source === 'google_translate' || response.source === 'deepl') {
            definition = `Translation: ${response.data.translation}`;
        }
        return definition.trim();
    }

    async function renderVocabList() {
        const { [VOCAB_LIST_KEY]: vocabList = [] } = await chrome.storage.local.get([VOCAB_LIST_KEY]);
        vocabListContainer.innerHTML = '';

        if (vocabList.length === 0) {
            vocabListContainer.innerHTML = '<i>Your vocabulary list is empty. Add words using the dictionary popup.</i>';
            return;
        }

        vocabList.sort((a, b) => new Date(b.addedOn) - new Date(a.addedOn));

        vocabList.forEach((item, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'vocab-item';
            entryDiv.title = formatDefinitionForTooltip(item.response);

            const wordSpan = document.createElement('span');
            wordSpan.className = 'vocab-word-text';
            wordSpan.textContent = item.word;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'vocab-remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove word';
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const list = (await chrome.storage.local.get([VOCAB_LIST_KEY]))[VOCAB_LIST_KEY] || [];
                const updatedList = list.filter(i => i.word.toLowerCase() !== item.word.toLowerCase());
                await chrome.storage.local.set({ [VOCAB_LIST_KEY]: updatedList });
                renderVocabList();
            });

            entryDiv.appendChild(wordSpan);
            entryDiv.appendChild(removeBtn);
            vocabListContainer.appendChild(entryDiv);
        });
    }

    async function exportVocabList() {
        const { [VOCAB_LIST_KEY]: vocabList = [] } = await chrome.storage.local.get([VOCAB_LIST_KEY]);
        if (vocabList.length === 0) {
            alert("Your vocabulary list is empty.");
            return;
        }

        let textContent = "My Simple Subtitle Tool - Vocabulary List\n\n";
        textContent += "========================================\n\n";

        vocabList.forEach(item => {
            textContent += `Word: ${item.word}\n`;
            textContent += `Definition:\n${formatDefinitionForTooltip(item.response).replace(/\n/g, '\n  ')}\n`;
            textContent += "\n========================================\n\n";
        });

        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'msst_vocab_list.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            showTab(button.dataset.tab);
            if (button.dataset.tab === 'vocab-tab') {
                renderVocabList();
            }
        });
    });

    backButton.addEventListener('click', () => {
        if (searchResultsCache) {
            renderSearchResults(searchResultsCache.data, searchResultsCache.errors);
            chrome.storage.session.set({ [UI_STATE_KEY]: {
                view: 'searchResults',
                data: searchResultsCache.data,
                errors: searchResultsCache.errors,
                backButtonCache: null
            }});
            backButton.style.display = 'none';
        }
    });

    searchButton.addEventListener('click', async () => {
        const { [LAST_SEARCH_TIME_KEY]: lastSearchTimestamp = 0 } = await chrome.storage.local.get(LAST_SEARCH_TIME_KEY);
        const now = Date.now();
        if (now - lastSearchTimestamp < SEARCH_COOLDOWN) {
            const timeLeft = Math.ceil((SEARCH_COOLDOWN - (now - lastSearchTimestamp)) / 1000);
            showStatusMessage(`<i>Too many requests. Please wait ${timeLeft} seconds.</i>`, true);
            return;
        }
        const query = searchInput.value.trim();
        if (!query) return;
        clearAllSubtitleState(true);
        searchResultsCache = null;
        backButton.style.display = 'none';
        const selectedSources = Array.from(sourceCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (selectedSources.length === 0) {
            showStatusMessage('<i>Please select at least one source.</i>', true);
            return;
        }
        await chrome.storage.local.set({ [LAST_SEARCH_TIME_KEY]: now });
        const language = languageSelect.value;
        showStatusMessage('<i>Searching...</i>');
        saveSearchHistory(query);
        chrome.runtime.sendMessage({ action: 'search', query: query, sources: selectedSources, language: language });
    });

    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchButton.click();
        }
    });

    sourceCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const selectedSources = Array.from(sourceCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
            chrome.storage.local.set({ [SELECTED_SOURCES_KEY]: selectedSources });
        });
    });

    applyBtn.addEventListener('click', () => applySettingsFromPanel(false));
    loadFileBtn.addEventListener('click', () => fileInput.click());
    exportVocabBtn.addEventListener('click', exportVocabList);

    transcriptContainer.addEventListener('click', (e) => {
        const entry = e.target.closest('.transcript-entry');
        if (entry && entry.dataset.startTime) {
            const originalStartTime = parseFloat(entry.dataset.startTime);
            const offset = parseFloat(offsetInput.value) || 0;
            let seekTime = originalStartTime + offset;
            if (seekTime < 0) seekTime = 0;
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'seekVideo',
                        time: seekTime
                    });
                }
            });
        }
    });

    languageSelect.addEventListener('change', updateDictionaryProviderOptions);
    dictionaryProviderSelect.addEventListener('change', saveDictionaryProviderSetting);

    offsetMinusBtn.addEventListener('click', () => adjustValue(offsetInput, -0.1, 1));
    offsetPlusBtn.addEventListener('click', () => adjustValue(offsetInput, 0.1, 1));
    positionDownBtn.addEventListener('click', () => adjustValue(positionInput, -1, 0));
    positionUpBtn.addEventListener('click', () => adjustValue(positionInput, 1, 0));
    fontsizeMinusBtn.addEventListener('click', () => adjustValue(fontsizeInput, -0.1, 1));
    fontsizePlusBtn.addEventListener('click', () => adjustValue(fontsizeInput, 0.1, 1));
    panelWidthMinusBtn.addEventListener('click', () => adjustValue(panelWidthInput, -1, 0));
    panelWidthPlusBtn.addEventListener('click', () => adjustValue(panelWidthInput, 1, 0));
    panelHeightMinusBtn.addEventListener('click', () => adjustValue(panelHeightInput, -5, 0));
    panelHeightPlusBtn.addEventListener('click', () => adjustValue(panelHeightInput, 5, 0));

    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        if (request.action === 'searchResults') {
            renderSearchResults(request.data, request.errors);
            chrome.storage.session.set({ [UI_STATE_KEY]: {
                view: 'searchResults',
                data: request.data,
                errors: request.errors,
                backButtonCache: null
            }});
        } else if (request.action === 'episodeListReady') {
            renderEpisodeList(request.data, request.error);
            if (searchResultsCache) {
                backButton.style.display = 'block';
            }
            chrome.storage.session.set({ [UI_STATE_KEY]: {
                view: 'episodeList',
                data: request.data,
                error: request.error,
                backButtonCache: searchResultsCache
            }});
        } else if (request.action === 'showStatus') {
            showStatusMessage(request.message, true);
        } else if (request.action === 'updateTranscriptHighlight') {
            highlightTranscriptLine(request.index);
        } else if (request.action === 'subtitleReadyForPopup') {
            checkAndLoadSessionSubtitle();
        } else if (request.action === 'updateSettingInPopup') {
            if (request.setting === 'position') {
                if (positionInput) {
                    positionInput.value = parseFloat(request.value).toFixed(0);
                }
            }
        }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[VOCAB_LIST_KEY]) {
            if (document.getElementById('vocab-tab').classList.contains('active')) {
                renderVocabList();
            }
        }
    });

    function togglePanelSettings() {
        if (backgroundStyleSelect.value === 'panel') {
            panelWidthRow.style.display = 'flex';
            panelHeightRow.style.display = 'flex';
        } else {
            panelWidthRow.style.display = 'none';
            panelHeightRow.style.display = 'none';
        }
    }

    backgroundStyleSelect.addEventListener('change', togglePanelSettings);
    
    async function initialize() {
        loadSettings();
        loadSearchHistory();
        renderVocabList();
        const subResult = await chrome.storage.session.get(SESSION_SUB_KEY);
        if (subResult[SESSION_SUB_KEY] && subResult[SESSION_SUB_KEY].data) {
            transcriptSubtitles = parseSrtForTranscript(subResult[SESSION_SUB_KEY].data);
            updateTranscriptDisplay();
        }
        await checkAndLoadSessionSubtitle();
        await restoreLastUiState();
        const { [LAST_ACTIVE_TAB_KEY]: lastTab } = await chrome.storage.local.get([LAST_ACTIVE_TAB_KEY]);
        showTab(lastTab || 'search-tab');
    }

    initialize();
});