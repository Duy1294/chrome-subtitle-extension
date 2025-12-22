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
    const languageSelect = document.getElementById('search-language-select');
    const targetLanguageSelect = document.getElementById('target-language-select');
    const loadFileBtn = document.getElementById('load-file-btn');
    const fileInput = document.getElementById('file-input');
    const tabButtons = document.querySelectorAll('.tabs-nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const transcriptContainer = document.getElementById('transcript-container');
    const backButton = document.getElementById('back-button');
    const sourceSelect = document.getElementById('source-select');
    const sourceCheckboxes = document.querySelectorAll('.source-option-checkbox');
    const allSourceCheckbox = document.querySelector('.source-option-checkbox[data-source="all"]');
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
    const languageFilterIndicator = document.getElementById('language-filter-indicator');
    const languageFilterText = document.getElementById('language-filter-text');
    const deeplApiKeyInput = document.getElementById('deepl-api-key-input');
    const openaiApiKeyInput = document.getElementById('openai-api-key-input');
    const googleAiStudioApiKeyInput = document.getElementById('google-ai-studio-api-key-input');
    const dictionaryProviderSelect = document.getElementById('dictionary-provider-select');
    const subtitleTranslationProviderSelect = document.getElementById('subtitle-translation-provider-select');
    const subtitleTranslationTargetSelect = document.getElementById('subtitle-translation-target-select');
    const translateSubtitlesBtn = document.getElementById('translate-subtitles-btn');
    const vocabTabBtn = document.getElementById('vocab-tab-btn');
    const vocabListContainer = document.getElementById('vocab-list-container');
    const exportVocabBtn = document.getElementById('export-vocab-btn');
    const textColorInput = document.getElementById('text-color-input');
    const colorPickerInput = document.getElementById('color-picker-input');
    const strokeColorInput = document.getElementById('stroke-color-input');
    const strokeColorPickerInput = document.getElementById('stroke-color-picker-input');
    const strokeWidthInput = document.getElementById('stroke-width-input');
    const strokeWidthMinus = document.getElementById('stroke-width-minus');
    const strokeWidthPlus = document.getElementById('stroke-width-plus');
    const radiantTextToggle = document.getElementById('radiant-text-toggle');
    const radiantStrokeToggle = document.getElementById('radiant-stroke-toggle');
    const radiantControlsRow = document.getElementById('radiant-controls-row');
    const radiantModeSelect = document.getElementById('radiant-mode-select');
    const radiantSpeedSlider = document.getElementById('radiant-speed-slider');
    const radiantSpeedValue = document.getElementById('radiant-speed-value');
    const radiantSpeedLabel = document.getElementById('radiant-speed-label');
    const radiantRandomToggle = document.getElementById('radiant-random-toggle');
    const profileSelect = document.getElementById('profile-select');
    const profileNameInput = document.getElementById('profile-name-input');
    const loadProfileBtn = document.getElementById('load-profile-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const deleteProfileBtn = document.getElementById('delete-profile-btn');

    const DEEPL_KEY_STORAGE = 'deepl_api_key';
    const OPENAI_KEY_STORAGE = 'openai_api_key';
    const GOOGLE_AI_STUDIO_KEY_STORAGE = 'google_ai_studio_api_key';
    const DICTIONARY_PROVIDER_KEY = 'dictionaryProviderSettings';
    const TARGET_LANGUAGE_KEY = 'targetTranslationLanguage';
    const SUBTITLE_TRANSLATION_PROVIDER_KEY = 'subtitleTranslationProvider';
    const SUBTITLE_TRANSLATION_TARGET_KEY = 'subtitleTranslationTargetLanguage';
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
    const PROFILES_KEY = 'subtitleSettingProfiles';
    const ACTIVE_PROFILE_KEY = 'activeSubtitleProfile';

    const defaultSettings = {
        offset: 0,
        rate: 1.0,
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
        textColor: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 1.5,
        radiantTextEnabled: false,
        radiantStrokeEnabled: false,
        radiantSpeed: 5,
        radiantMode: 'stable',
        radiantRandomEnabled: false,
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
    let searchResultsCache = null; // Store all unfiltered results
    let allSearchResults = []; // Store all results for filtering
    let allEpisodeResults = []; // Store all episode/subtitle results for filtering

    function initializeCustomSelects() {
        document.querySelectorAll('.custom-select').forEach(selectElement => {
            // Skip source-select as it has its own handler
            if (selectElement.id === 'source-select') return;
            
            selectElement.addEventListener('click', function(e) {
                e.stopPropagation();
                const clickedOption = e.target.closest('.custom-option');
                
                if (clickedOption) {
                    const trigger = this.querySelector('.custom-select-trigger span');
                    if (this.dataset.value !== clickedOption.dataset.value) {
                        trigger.textContent = clickedOption.textContent;
                        this.dataset.value = clickedOption.dataset.value;
                        const changeEvent = new CustomEvent('change', { detail: { value: this.dataset.value } });
                        this.dispatchEvent(changeEvent);
                    }
                    this.classList.remove('open');
                } else {
                    closeAllSelects(this);
                    this.classList.toggle('open');
                }
            });
        });
    }
    
    function closeAllSelects(exceptThisOne) {
        document.querySelectorAll('.custom-select.open').forEach(openSelect => {
            if (openSelect !== exceptThisOne) {
                openSelect.classList.remove('open');
            }
        });
    }

    window.addEventListener('click', closeAllSelects);

    function setCustomSelectValue(selectElement, value) {
        if (!selectElement) return;
        const trigger = selectElement.querySelector('.custom-select-trigger span');
        const optionToSelect = selectElement.querySelector(`.custom-option[data-value="${value}"]`);

        if (optionToSelect) {
            trigger.textContent = optionToSelect.textContent;
            selectElement.dataset.value = value;
        } else {
            const firstOption = selectElement.querySelector('.custom-option');
            if (firstOption) {
                 trigger.textContent = firstOption.textContent;
                 selectElement.dataset.value = firstOption.dataset.value;
            }
        }
    }
    
    function toggleRadiantControls() {
        radiantControlsRow.style.display = (radiantTextToggle.checked || radiantStrokeToggle.checked) ? 'block' : 'none';
    }

    function updateRadiantSpeedLabel() {
        const mode = radiantModeSelect.dataset.value;
        const isRandom = radiantRandomToggle.classList.contains('active');

        if (isRandom) {
            radiantSpeedLabel.textContent = 'Max Speed';
        } else if (mode === 'stable') {
            radiantSpeedLabel.textContent = 'Speed';
        } else {
            radiantSpeedLabel.textContent = 'Intensity';
        }
    }
    
    radiantTextToggle.addEventListener('change', () => {
        toggleRadiantControls();
        applySettingsFromPanel(false);
    });

    radiantStrokeToggle.addEventListener('change', () => {
        toggleRadiantControls();
        applySettingsFromPanel(false);
    });

    radiantModeSelect.addEventListener('change', () => {
        updateRadiantSpeedLabel();
        applySettingsFromPanel(false);
    });

    radiantRandomToggle.addEventListener('click', () => {
        radiantRandomToggle.classList.toggle('active');
        if (radiantRandomToggle.classList.contains('active')) {
            radiantRandomToggle.textContent = 'Turn Off';
            radiantRandomToggle.style.backgroundColor = 'var(--danger-color)';
        } else {
            radiantRandomToggle.textContent = 'Turn On';
            radiantRandomToggle.style.backgroundColor = 'var(--success-color)';
        }
        updateRadiantSpeedLabel();
        applySettingsFromPanel(false);
    });

    deeplApiKeyInput.addEventListener('change', () => {
        const key = deeplApiKeyInput.value.trim();
        chrome.storage.local.set({ [DEEPL_KEY_STORAGE]: key });
    });

    if (openaiApiKeyInput) {
        openaiApiKeyInput.addEventListener('change', () => {
            const key = openaiApiKeyInput.value.trim();
            chrome.storage.local.set({ [OPENAI_KEY_STORAGE]: key });
        });
    }

    if (googleAiStudioApiKeyInput) {
        googleAiStudioApiKeyInput.addEventListener('change', () => {
            const key = googleAiStudioApiKeyInput.value.trim();
            chrome.storage.local.set({ [GOOGLE_AI_STUDIO_KEY_STORAGE]: key });
        });
    }

    if (subtitleTranslationProviderSelect) {
        subtitleTranslationProviderSelect.addEventListener('change', () => {
            chrome.storage.local.set({ [SUBTITLE_TRANSLATION_PROVIDER_KEY]: subtitleTranslationProviderSelect.dataset.value });
        });
    }

    if (subtitleTranslationTargetSelect) {
        subtitleTranslationTargetSelect.addEventListener('change', () => {
            chrome.storage.local.set({ [SUBTITLE_TRANSLATION_TARGET_KEY]: subtitleTranslationTargetSelect.dataset.value });
        });
    }

    targetLanguageSelect.addEventListener('change', () => {
        chrome.storage.local.set({ [TARGET_LANGUAGE_KEY]: targetLanguageSelect.dataset.value });
        applySettingsFromPanel(false);
    });
    
    languageSelect.addEventListener('change', () => {
      updateDictionaryProviderOptions();
      // Save language selection for search
      const selectedLanguage = languageSelect.dataset.value;
      chrome.storage.local.set({ searchLanguage: selectedLanguage });
      
      // Filter results immediately if we have cached results
      // Only filter episode list, NOT search results
      if (allEpisodeResults.length > 0) {
          // If we're in episode list view, filter episode results
          renderEpisodeList(allEpisodeResults, null);
      } else if (allSearchResults.length > 0) {
          // For search results, don't filter - just re-render with all results
          renderSearchResults(allSearchResults, searchResultsCache?.errors || [], 'all');
      } else {
          // Update indicator even if no results yet
          updateLanguageFilterIndicator(selectedLanguage);
      }
    });
    
    dictionaryProviderSelect.addEventListener('change', () => {
        saveDictionaryProviderSetting();
        applySettingsFromPanel(false);
    });

    backgroundStyleSelect.addEventListener('change', () => {
        togglePanelSettings();
        applySettingsFromPanel(false);
    });
    
    colorPickerInput.addEventListener('input', () => {
        textColorInput.value = colorPickerInput.value.toUpperCase();
        applySettingsFromPanel(false);
    });

    textColorInput.addEventListener('input', () => {
        const value = textColorInput.value;
        if (/^#[0-9A-F]{6}$/i.test(value)) {
            colorPickerInput.value = value;
            applySettingsFromPanel(false);
        }
    });

    strokeColorPickerInput.addEventListener('input', () => {
        strokeColorInput.value = strokeColorPickerInput.value.toUpperCase();
        applySettingsFromPanel(false);
    });

    strokeColorInput.addEventListener('input', () => {
        const value = strokeColorInput.value;
        if (/^#[0-9A-F]{6}$/i.test(value)) {
            strokeColorPickerInput.value = value;
            applySettingsFromPanel(false);
        }
    });

    strokeWidthMinus.addEventListener('click', () => {
        const current = parseFloat(strokeWidthInput.value) || 1.5;
        const newValue = Math.max(0.5, current - 0.5);
        strokeWidthInput.value = newValue.toFixed(1);
        applySettingsFromPanel(false);
    });

    strokeWidthPlus.addEventListener('click', () => {
        const current = parseFloat(strokeWidthInput.value) || 1.5;
        const newValue = Math.min(10, current + 0.5);
        strokeWidthInput.value = newValue.toFixed(1);
        applySettingsFromPanel(false);
    });

    strokeWidthInput.addEventListener('input', () => {
        const value = parseFloat(strokeWidthInput.value);
        if (!isNaN(value) && value >= 0.5 && value <= 10) {
            applySettingsFromPanel(false);
        }
    });
    
    radiantSpeedSlider.addEventListener('input', () => {
        radiantSpeedValue.textContent = radiantSpeedSlider.value;
        applySettingsFromPanel(false);
    });

    [furiganaToggle, dictionaryToggle, moveOnPauseToggle].forEach(toggle => {
        toggle.addEventListener('change', () => applySettingsFromPanel(false));
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
                chrome.storage.local.clear(() => {});
                chrome.storage.session.clear(() => {});
                chrome.runtime.sendMessage({ action: 'clearSubtitles' });
                alert('All settings and data have been reset. The panel will now reload.');
                window.location.reload();
            }
        });
    }

    async function updateDictionaryProviderOptions() {
        let currentLanguage = languageSelect.dataset.value || 'all';
        // For dictionary, if "all" is selected, default to japanese
        if (currentLanguage === 'all') {
            currentLanguage = 'japanese';
        }
        
        const availableProviders = {
            japanese: [{ value: 'jisho', text: 'Jisho.org' }, { value: 'google_translate', text: 'Google Translate' }],
            german: [{ value: 'deepl', text: 'DeepL' }, { value: 'google_translate', text: 'Google Translate' }],
            english: [{ value: 'deepl', text: 'DeepL' }, { value: 'google_translate', text: 'Google Translate' }],
            french: [{ value: 'deepl', text: 'DeepL' }, { value: 'google_translate', text: 'Google Translate' }],
            spanish: [{ value: 'deepl', text: 'DeepL' }, { value: 'google_translate', text: 'Google Translate' }],
            vietnamese: [{ value: 'google_translate', text: 'Google Translate' }]
        };

        const optionsContainer = dictionaryProviderSelect.querySelector('.custom-options');
        optionsContainer.innerHTML = '';
        const providersForLang = availableProviders[currentLanguage] || availableProviders.english;
        
        providersForLang.forEach(provider => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-option';
            optionDiv.dataset.value = provider.value;
            optionDiv.innerHTML = `<span>${provider.text}</span>`;
            optionsContainer.appendChild(optionDiv);
        });

        const result = await chrome.storage.local.get(DICTIONARY_PROVIDER_KEY);
        const savedProviders = result[DICTIONARY_PROVIDER_KEY] || defaultSettings.dictionaryProvider;
        const providerForCurrentLang = savedProviders[currentLanguage] || providersForLang[0].value;
        setCustomSelectValue(dictionaryProviderSelect, providerForCurrentLang);
    }

    async function saveDictionaryProviderSetting() {
        const currentLanguage = languageSelect.dataset.value;
        const selectedProvider = dictionaryProviderSelect.dataset.value;

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
        if (!srtText || srtText.trim() === '') {
            console.error('Popup: Empty subtitle text received');
            showStatusMessage(`<i style="color: var(--danger-color);">Error: Empty subtitle file.</i>`);
            return;
        }
        
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
            
            if (transcriptSubtitles.length === 0) {
                console.error('Popup: No subtitles parsed from text');
                showStatusMessage(`<i style="color: var(--danger-color);">Error: Could not parse subtitle file. Please check the file format.</i>`);
                return;
            }
            
            updateTranscriptDisplay();
            // Switch to Transcript tab to show the loaded subtitle
            showTab('transcript-tab');
            await applySettingsFromPanel(true);
            showStatusMessage(`<i style="color: var(--success-color);">Subtitle loaded successfully. View in Transcript tab.</i>`);
        }
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
        const rateInput = document.getElementById('rate-input');
        return {
            offset: parseFloat(offsetInput.value) || 0,
            rate: parseFloat(rateInput.value) || 1.0,
            position: parseFloat(positionInput.value) || 5,
            fontSize: parseFloat(fontsizeInput.value) || 2.5,
            enableFurigana: furiganaToggle.checked,
            enableDictionary: dictionaryToggle.checked,
            language: languageSelect.dataset.value,
            targetLanguage: targetLanguageSelect.dataset.value,
            moveOnPause: moveOnPauseToggle.checked,
            backgroundStyle: backgroundStyleSelect.dataset.value,
            panelWidth: parseInt(panelWidthInput.value, 10) || 90,
            panelHeight: parseInt(panelHeightInput.value, 10) || 80,
            textColor: textColorInput.value,
            strokeColor: strokeColorInput.value,
            strokeWidth: parseFloat(strokeWidthInput.value) || 1.5,
            radiantTextEnabled: radiantTextToggle.checked,
            radiantStrokeEnabled: radiantStrokeToggle.checked,
            radiantSpeed: parseInt(radiantSpeedSlider.value, 10) || 5,
            radiantMode: radiantModeSelect.dataset.value || 'stable',
            radiantRandomEnabled: radiantRandomToggle.classList.contains('active'),
        };
    }

    function applySettingsToPanel(settings) {
        const settingsToApply = { ...defaultSettings, ...settings };
        const rateInput = document.getElementById('rate-input');

        offsetInput.value = settingsToApply.offset.toFixed(1);
        if (rateInput) rateInput.value = (settingsToApply.rate || 1.0).toFixed(4);
        positionInput.value = settingsToApply.position.toFixed(0);
        fontsizeInput.value = settingsToApply.fontSize.toFixed(1);
        furiganaToggle.checked = settingsToApply.enableFurigana;
        dictionaryToggle.checked = settingsToApply.enableDictionary;
        moveOnPauseToggle.checked = settingsToApply.moveOnPause;
        panelWidthInput.value = settingsToApply.panelWidth;
        panelHeightInput.value = settingsToApply.panelHeight;
        textColorInput.value = settingsToApply.textColor;
        colorPickerInput.value = settingsToApply.textColor;
        strokeColorInput.value = settingsToApply.strokeColor || '#000000';
        strokeColorPickerInput.value = settingsToApply.strokeColor || '#000000';
        strokeWidthInput.value = (settingsToApply.strokeWidth || 1.5).toFixed(1);

        setCustomSelectValue(languageSelect, settingsToApply.language);
        setCustomSelectValue(targetLanguageSelect, settingsToApply.targetLanguage);
        setCustomSelectValue(backgroundStyleSelect, settingsToApply.backgroundStyle);

        // Support both old and new settings format
        if (settingsToApply.radiantEnabled !== undefined) {
            // Old format - convert to new format
            radiantTextToggle.checked = settingsToApply.radiantEnabled;
            radiantStrokeToggle.checked = settingsToApply.radiantEnabled;
        } else {
            radiantTextToggle.checked = settingsToApply.radiantTextEnabled || false;
            radiantStrokeToggle.checked = settingsToApply.radiantStrokeEnabled || false;
        }
        radiantSpeedSlider.value = settingsToApply.radiantSpeed;
        radiantSpeedValue.textContent = settingsToApply.radiantSpeed;
        setCustomSelectValue(radiantModeSelect, settingsToApply.radiantMode);
        toggleRadiantControls();

        if (settingsToApply.radiantRandomEnabled) {
            radiantRandomToggle.classList.add('active');
            radiantRandomToggle.textContent = 'Turn Off';
            radiantRandomToggle.style.backgroundColor = 'var(--danger-color)';
        } else {
            radiantRandomToggle.classList.remove('active');
            radiantRandomToggle.textContent = 'Turn On';
            radiantRandomToggle.style.backgroundColor = 'var(--success-color)';
        }

        togglePanelSettings();
        toggleRadiantControls();
        updateRadiantSpeedLabel();
        updateDictionaryProviderOptions();

        applySettingsFromPanel(false);
        
        applyStatus.textContent = 'Profile loaded successfully.';
        applyStatus.className = 'status-message success';
        applyStatus.style.display = 'block';
        setTimeout(() => { applyStatus.style.display = 'none'; }, 2000);
    }

    async function applySettingsFromPanel(newDataLoaded = false) {
        const settings = getSettingsFromPanel();
        
        if (!newDataLoaded) {
            applyStatus.textContent = 'Settings updated.';
            applyStatus.className = 'status-message success';
            applyStatus.style.display = 'block';
            setTimeout(() => { applyStatus.style.display = 'none'; }, 1500);
        } else {
             applyStatus.textContent =  'Subtitle loaded and settings applied.';
             applyStatus.className = 'status-message success';
             applyStatus.style.display = 'block';
             setTimeout(() => { applyStatus.style.display = 'none'; }, 3000);
        }

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

    async function loadProfilesIntoSelect() {
        const result = await chrome.storage.local.get([PROFILES_KEY, ACTIVE_PROFILE_KEY]);
        const profiles = result[PROFILES_KEY] || {};
        const activeProfile = result[ACTIVE_PROFILE_KEY] || '';

        profileSelect.innerHTML = '<option value="">Default Settings</option>';
        
        const profileNames = Object.keys(profiles).sort();
        profileNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === activeProfile) {
                option.selected = true;
            }
            profileSelect.appendChild(option);
        });
        
        profileNameInput.value = activeProfile;
    }

    async function saveProfile() {
        const name = profileNameInput.value.trim();
        if (!name) {
            alert("Please enter a profile name.");
            return;
        }

        const currentSettings = getSettingsFromPanel();
        const result = await chrome.storage.local.get(PROFILES_KEY);
        const profiles = result[PROFILES_KEY] || {};

        if (profiles[name]) {
            if (!confirm(`Profile "${name}" already exists. Do you want to overwrite it?`)) {
                return;
            }
        }

        profiles[name] = currentSettings;
        await chrome.storage.local.set({ [PROFILES_KEY]: profiles, [ACTIVE_PROFILE_KEY]: name });
        
        await loadProfilesIntoSelect();
        
        applyStatus.textContent = `Profile "${name}" saved.`;
        applyStatus.className = 'status-message success';
        applyStatus.style.display = 'block';
        setTimeout(() => { applyStatus.style.display = 'none'; }, 2000);
    }

    async function loadProfile() {
        const name = profileSelect.value;
        if (!name) {
            applySettingsToPanel(defaultSettings);
            await chrome.storage.local.remove(ACTIVE_PROFILE_KEY);
            profileNameInput.value = '';
            return;
        }

        const result = await chrome.storage.local.get(PROFILES_KEY);
        const profiles = result[PROFILES_KEY] || {};
        const settingsToLoad = profiles[name];

        if (settingsToLoad) {
            applySettingsToPanel(settingsToLoad);
            await chrome.storage.local.set({ [ACTIVE_PROFILE_KEY]: name });
            profileNameInput.value = name;
        } else {
            alert(`Profile "${name}" not found!`);
        }
    }

    async function deleteProfile() {
        const name = profileSelect.value;
        if (!name) {
            alert("Please select a profile to delete.");
            return;
        }

        if (!confirm(`Are you sure you want to delete the profile "${name}"?`)) {
            return;
        }

        const result = await chrome.storage.local.get([PROFILES_KEY, ACTIVE_PROFILE_KEY]);
        const profiles = result[PROFILES_KEY] || {};
        const activeProfile = result[ACTIVE_PROFILE_KEY] || '';
        
        delete profiles[name];

        const storageUpdate = { [PROFILES_KEY]: profiles };
        if (activeProfile === name) {
            storageUpdate[ACTIVE_PROFILE_KEY] = '';
        }

        await chrome.storage.local.set(storageUpdate);
        await loadProfilesIntoSelect();

        applyStatus.textContent = `Profile "${name}" deleted.`;
        applyStatus.className = 'status-message success';
        applyStatus.style.display = 'block';
        setTimeout(() => { applyStatus.style.display = 'none'; }, 2000);
    }

    function loadSettings() {
        chrome.storage.local.get([
            SETTINGS_KEY,
            SELECTED_SOURCES_KEY,
            DEEPL_KEY_STORAGE,
            OPENAI_KEY_STORAGE,
            GOOGLE_AI_STUDIO_KEY_STORAGE,
            DICTIONARY_PROVIDER_KEY,
            TARGET_LANGUAGE_KEY,
            SUBTITLE_TRANSLATION_PROVIDER_KEY,
            SUBTITLE_TRANSLATION_TARGET_KEY,
            'searchLanguage'
        ], (result) => {
            const savedSettings = result[SETTINGS_KEY] || {};
            const currentSettings = { ...defaultSettings, ...savedSettings };
            const rateInput = document.getElementById('rate-input');

            offsetInput.value = currentSettings.offset.toFixed(1);
            if (rateInput) rateInput.value = (currentSettings.rate || 1.0).toFixed(4);
            positionInput.value = currentSettings.position.toFixed(0);
            fontsizeInput.value = currentSettings.fontSize.toFixed(1);
            furiganaToggle.checked = currentSettings.enableFurigana;
            dictionaryToggle.checked = currentSettings.enableDictionary;
            moveOnPauseToggle.checked = currentSettings.moveOnPause;
            panelWidthInput.value = currentSettings.panelWidth;
            panelHeightInput.value = currentSettings.panelHeight;
            
            setCustomSelectValue(languageSelect, result.searchLanguage || 'all');
            setCustomSelectValue(targetLanguageSelect, result[TARGET_LANGUAGE_KEY] || defaultSettings.targetLanguage);
            setCustomSelectValue(backgroundStyleSelect, currentSettings.backgroundStyle);
            
            // Support both old and new settings format
            if (currentSettings.radiantEnabled !== undefined) {
                // Old format - convert to new format
                radiantTextToggle.checked = currentSettings.radiantEnabled;
                radiantStrokeToggle.checked = currentSettings.radiantEnabled;
            } else {
                radiantTextToggle.checked = currentSettings.radiantTextEnabled || false;
                radiantStrokeToggle.checked = currentSettings.radiantStrokeEnabled || false;
            }
            textColorInput.value = currentSettings.textColor;
            colorPickerInput.value = currentSettings.textColor;
            strokeColorInput.value = currentSettings.strokeColor || '#000000';
            strokeColorPickerInput.value = currentSettings.strokeColor || '#000000';
            strokeWidthInput.value = (currentSettings.strokeWidth || 1.5).toFixed(1);
            radiantSpeedSlider.value = currentSettings.radiantSpeed;
            toggleRadiantControls();
            radiantSpeedValue.textContent = currentSettings.radiantSpeed;
            setCustomSelectValue(radiantModeSelect, currentSettings.radiantMode);

            if (currentSettings.radiantRandomEnabled) {
                radiantRandomToggle.classList.add('active');
                radiantRandomToggle.textContent = 'Turn Off';
                radiantRandomToggle.style.backgroundColor = 'var(--danger-color)';
            } else {
                radiantRandomToggle.classList.remove('active');
                radiantRandomToggle.textContent = 'Turn On';
                radiantRandomToggle.style.backgroundColor = 'var(--success-color)';
            }
            
            togglePanelSettings();
            toggleRadiantControls();
            updateRadiantSpeedLabel();

            updateDictionaryProviderOptions();

            const savedSources = result[SELECTED_SOURCES_KEY];
            if (savedSources && savedSources.length > 0) {
                sourceCheckboxes.forEach(cb => {
                    if (cb.dataset.source === 'all') return;
                    cb.checked = savedSources.includes(cb.dataset.source);
                });
                updateAllCheckboxState();
                updateSourceDropdownText();
            } else {
                // Default: select all
                sourceCheckboxes.forEach(cb => {
                    if (cb.dataset.source !== 'all') {
                        cb.checked = true;
                    }
                });
                allSourceCheckbox.checked = true;
                updateSourceDropdownText();
            }


            if (result[DEEPL_KEY_STORAGE]) {
                deeplApiKeyInput.value = result[DEEPL_KEY_STORAGE];
            }

            if (openaiApiKeyInput && result[OPENAI_KEY_STORAGE]) {
                openaiApiKeyInput.value = result[OPENAI_KEY_STORAGE];
            }

            if (googleAiStudioApiKeyInput && result[GOOGLE_AI_STUDIO_KEY_STORAGE]) {
                googleAiStudioApiKeyInput.value = result[GOOGLE_AI_STUDIO_KEY_STORAGE];
            }

            if (subtitleTranslationProviderSelect) {
                setCustomSelectValue(subtitleTranslationProviderSelect, result[SUBTITLE_TRANSLATION_PROVIDER_KEY] || 'openai');
            }

            if (subtitleTranslationTargetSelect) {
                setCustomSelectValue(subtitleTranslationTargetSelect, result[SUBTITLE_TRANSLATION_TARGET_KEY] || 'VI');
            }
        });
    }

    async function handleTranslateSubtitlesClick() {
        const result = await chrome.storage.session.get([SESSION_SUB_KEY]);
        const srtText = result[SESSION_SUB_KEY]?.data || '';
        if (!srtText || !srtText.trim()) {
            showStatusMessage('<i>No subtitle loaded to translate.</i>');
            return;
        }

        const settingsResult = await chrome.storage.local.get([
            DEEPL_KEY_STORAGE,
            OPENAI_KEY_STORAGE,
            GOOGLE_AI_STUDIO_KEY_STORAGE,
            SUBTITLE_TRANSLATION_PROVIDER_KEY,
            SUBTITLE_TRANSLATION_TARGET_KEY
        ]);

        const provider = settingsResult[SUBTITLE_TRANSLATION_PROVIDER_KEY] || 'openai';
        const targetLang = settingsResult[SUBTITLE_TRANSLATION_TARGET_KEY] || 'VI';

        if (provider === 'openai' && !settingsResult[OPENAI_KEY_STORAGE]) {
            showStatusMessage('<i style="color: var(--danger-color);">Missing OpenAI API key. Add it in Settings.</i>', true);
            showTab('settings-tab');
            return;
        }

        if (provider === 'deepl' && !settingsResult[DEEPL_KEY_STORAGE]) {
            showStatusMessage('<i style="color: var(--danger-color);">Missing DeepL API key. Add it in Settings.</i>', true);
            showTab('settings-tab');
            return;
        }

        if (provider === 'google_ai_studio' && !settingsResult[GOOGLE_AI_STUDIO_KEY_STORAGE]) {
            showStatusMessage('<i style="color: var(--danger-color);">Missing Google AI Studio API key. Add it in Settings.</i>', true);
            showTab('settings-tab');
            return;
        }

        if (provider === 'gemini_chat' && !settingsResult[GOOGLE_AI_STUDIO_KEY_STORAGE]) {
            showStatusMessage('<i style="color: var(--danger-color);">Missing Google AI Studio API key. Add it in Settings.</i>', true);
            showTab('settings-tab');
            return;
        }

        const providerLabelMap = {
            openai: 'OpenAI',
            deepl: 'DeepL',
            google_ai_studio: 'Google AI Studio',
            gemini_chat: 'Gemini Chat'
        };
        const providerLabel = providerLabelMap[provider] || provider;
        showStatusMessage(`<i>Translating subtitles to <b>${targetLang}</b> via <b>${providerLabel}</b>...</i>`);

        let captions;
        try {
            captions = subsrt.parse(srtText);
        } catch (e) {
            showStatusMessage('<i style="color: var(--danger-color);">Error: Could not parse subtitle for translation.</i>', true);
            return;
        }

        const texts = captions.map(c => (c.text || '').replace(/<[^>]*>/g, ''));

        const translationResult = await new Promise((resolve) => {
            const listener = (msg) => {
                if (msg.action === 'subtitleTranslationResult') {
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve({ translatedTexts: msg.translatedTexts || null, error: msg.error || null });
                }
            };
            chrome.runtime.onMessage.addListener(listener);
            chrome.runtime.sendMessage({
                action: 'translateSubtitleTexts',
                provider,
                targetLang,
                texts
            });
            setTimeout(() => {
                chrome.runtime.onMessage.removeListener(listener);
                resolve({ translatedTexts: null, error: 'Translation timed out.' });
            }, 120000);
        });

        if (translationResult?.error) {
            showStatusMessage(`<i style="color: var(--danger-color);">${translationResult.error}</i>`, true);
            return;
        }

        const translatedTexts = translationResult?.translatedTexts;

        if (!translatedTexts || !Array.isArray(translatedTexts) || translatedTexts.length !== texts.length) {
            showStatusMessage('<i style="color: var(--danger-color);">Translation failed or returned invalid result.</i>', true);
            return;
        }

        captions.forEach((cap, i) => {
            cap.text = translatedTexts[i] || cap.text;
        });

        const translatedSrt = subsrt.build(captions, { format: 'srt' });
        await loadSubData(translatedSrt, false);
        showStatusMessage('<i style="color: var(--success-color);">Subtitle translated successfully.</i>');
    }

    if (translateSubtitlesBtn) {
        translateSubtitlesBtn.addEventListener('click', handleTranslateSubtitlesClick);
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
        applySettingsFromPanel(false);
    }
    
    function createItem(item, onLoad, onAppend, showSource = true) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'result-item';
        if (item.isMovie) {
            itemDiv.classList.add('result-item-movie');
        }
        itemDiv.addEventListener('click', onLoad);
        
        // Determine what to show: source tag for search results, language tag for episode list
        if (showSource && item.source) {
            // Show source indicator for search results (replaces MOVIE tag)
            const sourceIndicator = document.createElement('span');
            sourceIndicator.className = 'result-language-indicator result-source-indicator';
            let sourceText = item.source.replace('.org', '');
            // Format source name for display
            if (sourceText.toLowerCase() === 'opensubtitles') {
                sourceText = 'OPENSUBTITLES';
            } else if (sourceText.toLowerCase() === 'jimaku') {
                sourceText = 'JIMAKU';
            } else if (sourceText.toLowerCase() === 'kitsunekko') {
                sourceText = 'KITSUNEKKO';
            } else if (sourceText.toLowerCase() === 'subscene') {
                sourceText = 'SUBSCENE';
            } else {
                sourceText = sourceText.toUpperCase();
            }
            sourceIndicator.textContent = sourceText;
            let sourceClass = item.source.toLowerCase().replace('.org', '').replace(/-/g, '').replace(/\s+/g, '');
            sourceIndicator.classList.add(`source-${sourceClass}`);
            sourceIndicator.title = item.source;
            sourceIndicator.setAttribute('aria-label', item.source);
            itemDiv.appendChild(sourceIndicator);
        } else if (item.language) {
            // Show language indicator for episode list (after clicking on a movie)
            const languageIndicator = document.createElement('span');
            languageIndicator.className = 'result-language-indicator';
            const languageName = getLanguageDisplayName(item.language);
            languageIndicator.textContent = languageName || item.language.toUpperCase();
            languageIndicator.title = languageName || 'Unknown Language';
            languageIndicator.setAttribute('aria-label', languageName || 'Unknown Language');
            itemDiv.appendChild(languageIndicator);
        }
        
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
        // Source tag is now shown on the left, no need to show it here
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

    function getLanguageDisplayName(language) {
        const languageNames = {
            'all': 'All Languages',
            'japanese': 'Japanese',
            'german': 'German',
            'english': 'English',
            'french': 'French',
            'spanish': 'Spanish',
            'vietnamese': 'Vietnamese',
            'arabic': 'Arabic',
            'chinese': 'Chinese',
            'korean': 'Korean',
            'italian': 'Italian',
            'portuguese': 'Portuguese',
            'russian': 'Russian',
            'thai': 'Thai',
            'indonesian': 'Indonesian',
            'turkish': 'Turkish',
            'polish': 'Polish',
            'dutch': 'Dutch',
            'swedish': 'Swedish',
            'norwegian': 'Norwegian',
            'danish': 'Danish',
            'finnish': 'Finnish',
            'greek': 'Greek',
            'czech': 'Czech',
            'hungarian': 'Hungarian',
            'romanian': 'Romanian',
            'bulgarian': 'Bulgarian',
            'croatian': 'Croatian',
            'serbian': 'Serbian',
            'slovak': 'Slovak',
            'slovenian': 'Slovenian',
            'hindi': 'Hindi',
            'persian': 'Persian',
            'tagalog': 'Tagalog',
            'kannada': 'Kannada',
            'belarusian': 'Belarusian',
            'ukrainian': 'Ukrainian',
            'malay': 'Malay',
            'burmese': 'Burmese'
        };
        // If not found, capitalize first letter
        if (languageNames[language]) {
            return languageNames[language];
        }
        // Capitalize first letter of language code
        return language ? language.charAt(0).toUpperCase() + language.slice(1) : 'Unknown';
    }

    // Mapping language to country code (ISO 3166-1 alpha-2)
    const languageToCountryCode = {
        'japanese': 'jp',
        'german': 'de',
        'english': 'gb', // UK flag for English
        'french': 'fr',
        'spanish': 'es',
        'vietnamese': 'vn',
        'arabic': 'sa',
        'chinese': 'cn',
        'korean': 'kr',
        'italian': 'it',
        'portuguese': 'pt',
        'russian': 'ru',
        'thai': 'th',
        'indonesian': 'id',
        'turkish': 'tr',
        'polish': 'pl',
        'dutch': 'nl',
        'swedish': 'se',
        'norwegian': 'no',
        'danish': 'dk',
        'finnish': 'fi',
        'greek': 'gr',
        'czech': 'cz',
        'hungarian': 'hu',
        'romanian': 'ro',
        'bulgarian': 'bg',
        'croatian': 'hr',
        'serbian': 'rs',
        'slovak': 'sk',
        'slovenian': 'si'
    };

    function getCountryCodeFromLanguage(language) {
        return languageToCountryCode[language] || null;
    }

    function getLanguageFlag(language) {
        const countryCode = getCountryCodeFromLanguage(language);
        if (!countryCode) {
            return null; // Return null to use default icon
        }
        return countryCode;
    }

    function getLanguageCode(language) {
        const languageCodes = {
            'japanese': 'JP',
            'german': 'DE',
            'english': 'EN',
            'french': 'FR',
            'spanish': 'ES',
            'vietnamese': 'VI'
        };
        return languageCodes[language] || '??';
    }

    function updateLanguageFilterIndicator(selectedLanguage) {
        if (!languageFilterIndicator || !languageFilterText) return;
        
        // Check if we're in episode list view or search results view
        const isEpisodeListView = allEpisodeResults.length > 0;
        const resultsToUse = isEpisodeListView ? allEpisodeResults : allSearchResults;
        
        if (selectedLanguage && selectedLanguage !== 'all' && resultsToUse.length > 0) {
            const filteredCount = filterResultsByLanguage(resultsToUse, selectedLanguage).length;
            const totalCount = resultsToUse.length;
            languageFilterText.textContent = `Showing: ${getLanguageDisplayName(selectedLanguage)} (${filteredCount} of ${totalCount} results)`;
            languageFilterIndicator.style.display = 'block';
        } else if (selectedLanguage === 'all' && resultsToUse.length > 0) {
            languageFilterText.textContent = `Showing: All Languages (${resultsToUse.length} results)`;
            languageFilterIndicator.style.display = 'block';
        } else {
            languageFilterIndicator.style.display = 'none';
        }
    }

    function filterResultsByLanguage(results, selectedLanguage) {
        if (!selectedLanguage || selectedLanguage === 'all') {
            // Show all results when "all" is selected (including unknown languages)
            return results;
        }
        // Normalize language values for comparison (lowercase, trim)
        const normalizedSelected = selectedLanguage.toLowerCase().trim();
        // Filter by exact language match only (exclude null/unknown)
        return results.filter(result => {
            if (!result.language) return false; // Exclude results with no language
            const normalizedResultLang = result.language.toLowerCase().trim();
            return normalizedResultLang === normalizedSelected;
        });
    }

    function renderSearchResults(data, errors, languageFilter = null) {
        // Store all results for filtering
        allSearchResults = data || [];
        
        // Don't filter search results - show all results (movies and subtitles)
        // Language filter only applies to episode list (after clicking on a movie)
        const filteredData = allSearchResults; // Always show all search results
        
        // Hide language filter indicator for search results
        if (languageFilterIndicator) {
            languageFilterIndicator.style.display = 'none';
        }
        
        resultsDiv.innerHTML = '';
        if (filteredData.length === 0 && errors.length === 0) {
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
        if (filteredData && filteredData.length > 0) {
            filteredData.forEach(item => {
                const onClick = () => {
                    if (item.isMovie) {
                        // This is a movie/show page - fetch subtitles from it
                        showStatusMessage(`<i>Loading subtitles for <b>${item.title}</b>...</i>`);
                        chrome.runtime.sendMessage({ action: 'fetchSubtitlePage', url: item.url });
                    } else {
                        // This is a direct subtitle - load it
                        showStatusMessage(`<i>Loading list for <b>${item.title}</b>...</i>`);
                        chrome.runtime.sendMessage({ action: 'fetchSubtitlePage', url: item.url });
                    }
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
            // Store all episode results for filtering
            allEpisodeResults = data || [];
            
            // Apply language filter
            const selectedLanguage = languageSelect.dataset.value || 'all';
            const filteredData = filterResultsByLanguage(allEpisodeResults, selectedLanguage);
            
            // Update language filter indicator
            updateLanguageFilterIndicator(selectedLanguage);
            
            if (filteredData.length > 0) {
                showResults();
                filteredData.forEach(item => {
                    const onEpisodeLoad = () => handleEpisodeClick(item, false);
                    const onEpisodeAppend = () => handleEpisodeClick(item, true);
                    // Episode list: show language tag, not source tag
                    resultsDiv.appendChild(createItem(item, onEpisodeLoad, onEpisodeAppend, false));
                });
            } else {
                showStatusMessage(`<i>No subtitles found for selected language (${getLanguageDisplayName(selectedLanguage) || selectedLanguage}).</i>`);
            }
            filterContainer.style.display = 'block';
        } else {
            showStatusMessage('<i>No subtitle files found on this page.</i>');
        }
    }
    
    function handleEpisodeClick(episodeItem, isAppending) {
        chrome.storage.session.set({ [SESSION_APPEND_KEY]: isAppending });
        const message = isAppending ? `Appending subtitle from` : `Loading subtitle from`;
        showStatusMessage(`<i>${message} <b>${episodeItem.title}</b>...</i>`);

        if (episodeItem.isMovie) {
            showStatusMessage(`<i>Loading subtitles for <b>${episodeItem.title}</b>...</i>`);
            chrome.runtime.sendMessage({ action: 'fetchSubtitlePage', url: episodeItem.url });
            return;
        }
        
        let format = 'srt';
        if (episodeItem.format) {
            format = episodeItem.format;
        } else {
            const url = episodeItem.url.toLowerCase();
            // Check if it's OpenSubtitles - they always return ZIP files
            if (url.includes('opensubtitles.org') && (url.includes('/download/') || url.includes('/subtitleserve/'))) {
                format = 'zip'; // OpenSubtitles always returns ZIP files
            } else if (url.endsWith('.ass') || url.endsWith('.ssa')) {
                format = 'ass';
            } else if (url.includes('.zip')) {
                format = 'zip';
            } else if (url.includes('.rar')) {
                format = 'rar';
            } else if (url.includes('.7z')) {
                format = '7z';
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
            allEpisodeResults = state.data || [];
            renderEpisodeList(allEpisodeResults, state.error);
            if (searchResultsCache) {
                backButton.style.display = 'block';
            }
        } else if (state.view === 'searchResults') {
            allSearchResults = state.data || [];
            searchResultsCache = { data: allSearchResults, errors: state.errors };
            const selectedLanguage = languageSelect.dataset.value || 'all';
            renderSearchResults(allSearchResults, state.errors, selectedLanguage);
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
            allSearchResults = searchResultsCache.data || [];
            const selectedLanguage = languageSelect.dataset.value || 'all';
            renderSearchResults(allSearchResults, searchResultsCache.errors, selectedLanguage);
            chrome.storage.session.set({ [UI_STATE_KEY]: {
                view: 'searchResults',
                data: searchResultsCache.data,
                errors: searchResultsCache.errors,
                backButtonCache: null
            }});
            backButton.style.display = 'none';
        }
    });

    // Helper function to get selected sources
    function getSelectedSources() {
        return Array.from(sourceCheckboxes)
            .filter(cb => cb.dataset.source !== 'all' && cb.checked)
            .map(cb => cb.dataset.source);
    }

    // Helper function to update dropdown trigger text
    function updateSourceDropdownText() {
        const selectedSources = getSelectedSources();
        const trigger = sourceSelect.querySelector('.custom-select-trigger span');
        const allSources = ['jimaku', 'kitsunekko', 'opensubtitles', 'subscene', 'subdl'];
        const allSelected = allSources.every(source => selectedSources.includes(source));
        
        if (selectedSources.length === 0) {
            trigger.textContent = 'Select Sources';
        } else if (allSelected && selectedSources.length === allSources.length) {
            trigger.textContent = 'All Sources';
        } else {
            trigger.textContent = `${selectedSources.length} Selected`;
        }
    }

    // Helper function to update "All" checkbox state
    function updateAllCheckboxState() {
        const selectedSources = getSelectedSources();
        const allSources = ['jimaku', 'kitsunekko', 'opensubtitles', 'subscene', 'subdl'];
        const allSelected = allSources.every(source => selectedSources.includes(source));
        allSourceCheckbox.checked = allSelected && selectedSources.length === allSources.length;
    }


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
        const selectedSources = getSelectedSources();
        if (selectedSources.length === 0) {
            showStatusMessage('<i>Please select at least one source.</i>', true);
            return;
        }
        await chrome.storage.local.set({ [LAST_SEARCH_TIME_KEY]: now });
        const language = languageSelect.dataset.value || 'all';
        showStatusMessage('<i>Searching...</i>');
        saveSearchHistory(query);
        chrome.runtime.sendMessage({ action: 'search', query: query, sources: selectedSources, language: language })
            .catch(error => {
                console.error('[Popup] Error sending search message:', error);
                showStatusMessage(`<i>Error: ${error.message || 'Failed to send search request'}</i>`, true);
            });
    });

    searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchButton.click();
        }
    });

    // Initialize source dropdown - prevent closing when clicking on options
    sourceSelect.addEventListener('click', function(e) {
        e.stopPropagation();
        const clickedOption = e.target.closest('.custom-option');
        const clickedCheckbox = e.target.closest('.source-option-checkbox');
        const clickedLabel = e.target.closest('label');
        
        // If clicking on trigger, toggle dropdown
        if (e.target.closest('.custom-select-trigger')) {
            const isOpen = this.classList.contains('open');
            closeAllSelects(this);
            if (!isOpen) {
                this.classList.add('open');
            }
            return;
        }
        
        // If clicking on checkbox or label, handle selection but don't close dropdown
        if (clickedCheckbox || clickedLabel) {
            const checkbox = clickedCheckbox || clickedLabel.querySelector('.source-option-checkbox');
            if (checkbox) {
                e.preventDefault();
                e.stopPropagation();
                
                // Handle "All" checkbox
                if (checkbox.dataset.source === 'all') {
                    const allSources = ['jimaku', 'kitsunekko', 'opensubtitles', 'subscene', 'subdl'];
                    const allSelected = allSources.every(source => {
                        const cb = document.querySelector(`.source-option-checkbox[data-source="${source}"]`);
                        return cb && cb.checked;
                    });
                    
                    if (allSelected) {
                        // Unselect all
                        sourceCheckboxes.forEach(cb => {
                            if (cb.dataset.source !== 'all') {
                                cb.checked = false;
                            }
                        });
                        checkbox.checked = false;
                    } else {
                        // Select all
                        sourceCheckboxes.forEach(cb => {
                            if (cb.dataset.source !== 'all') {
                                cb.checked = true;
                            }
                        });
                        checkbox.checked = true;
                    }
                } else {
                    // Toggle individual checkbox
                    checkbox.checked = !checkbox.checked;
                }
                
                // Update states
                updateAllCheckboxState();
                updateSourceDropdownText();
                
                // Save selected sources
                const selectedSources = getSelectedSources();
                chrome.storage.local.set({ [SELECTED_SOURCES_KEY]: selectedSources });
            }
            return;
        }
        
        // If clicking elsewhere in option, do nothing (prevent closing)
        if (clickedOption) {
            return;
        }
        
        // Close dropdown if clicking outside
        closeAllSelects(this);
        this.classList.remove('open');
    });

    applyBtn.addEventListener('click', () => applySettingsFromPanel(false));

    applyBtn.addEventListener('click', () => applySettingsFromPanel(false));
    loadFileBtn.addEventListener('click', () => fileInput.click());
    exportVocabBtn.addEventListener('click', exportVocabList);

    transcriptContainer.addEventListener('click', (e) => {
        const entry = e.target.closest('.transcript-entry');
        if (entry && entry.dataset.startTime) {
            const originalStartTime = parseFloat(entry.dataset.startTime);
            const settings = getSettingsFromPanel();
            let seekTime = (originalStartTime / settings.rate) + settings.offset;
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

    [offsetMinusBtn, offsetPlusBtn, positionDownBtn, positionUpBtn, fontsizeMinusBtn, fontsizePlusBtn, panelWidthMinusBtn, panelWidthPlusBtn, panelHeightMinusBtn, panelHeightPlusBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            const inputId = btn.id.replace(/-(minus|plus|down|up)/, '-input');
            const inputElement = document.getElementById(inputId);
            let amount = 0;
            let precision = 0;
            if (btn.id.includes('offset')) { amount = btn.id.includes('minus') ? -0.1 : 0.1; precision = 1; }
            else if (btn.id.includes('position')) { amount = btn.id.includes('down') ? -1 : 1; precision = 0; }
            else if (btn.id.includes('fontsize')) { amount = btn.id.includes('minus') ? -0.1 : 0.1; precision = 1; }
            else if (btn.id.includes('panel-width')) { amount = btn.id.includes('minus') ? -1 : 1; precision = 0; }
            else if (btn.id.includes('panel-height')) { amount = btn.id.includes('minus') ? -5 : 5; precision = 0; }
            
            let currentValue = (precision === 0) ? parseInt(inputElement.value, 10) : parseFloat(inputElement.value);
            currentValue = (currentValue || 0) + amount;
            if (currentValue < 0 && inputElement.id !== 'offset-input') currentValue = 0;
            inputElement.value = currentValue.toFixed(precision);
            applySettingsFromPanel(false);
        });
    });

    const rateInput = document.getElementById('rate-input');
    if(rateInput) {
        rateInput.addEventListener('change', () => applySettingsFromPanel(false));
    }

    saveProfileBtn.addEventListener('click', saveProfile);
    loadProfileBtn.addEventListener('click', loadProfile);
    deleteProfileBtn.addEventListener('click', deleteProfile);

    profileSelect.addEventListener('change', () => {
        profileNameInput.value = profileSelect.value;
    });

    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        console.log('[Popup] Received message:', request.action, request);
        if (request.action === 'searchResults') {
            // Store all results (unfiltered)
            allSearchResults = request.data || [];
            searchResultsCache = { data: allSearchResults, errors: request.errors };
            
            // Render with current language filter
            const selectedLanguage = languageSelect.dataset.value || 'all';
            renderSearchResults(allSearchResults, request.errors, selectedLanguage);
            
            chrome.storage.session.set({ [UI_STATE_KEY]: {
                view: 'searchResults',
                data: allSearchResults,
                errors: request.errors,
                backButtonCache: null
            }});
        } else if (request.action === 'episodeListReady') {
            allEpisodeResults = request.data || [];
            renderEpisodeList(allEpisodeResults, request.error);
            if (searchResultsCache) {
                backButton.style.display = 'block';
            }
            chrome.storage.session.set({ [UI_STATE_KEY]: {
                view: 'episodeList',
                data: allEpisodeResults,
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
        if (backgroundStyleSelect.dataset.value === 'panel') {
            panelWidthRow.style.display = 'flex';
            panelHeightRow.style.display = 'flex';
        } else {
            panelWidthRow.style.display = 'none';
            panelHeightRow.style.display = 'none';
        }
    }

    async function initialize() {
        initializeCustomSelects();
        loadSettings();
        loadSearchHistory();
        renderVocabList();
        await loadProfilesIntoSelect();
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