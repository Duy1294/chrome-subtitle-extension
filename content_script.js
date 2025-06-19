console.log("Subtitle Inserter [v21-AssSupport] loaded.");

let videoElement = null;
let subtitleContainer = null;
let parsedSubtitles = [];
let lastSubData = { data: '', format: 'srt' };
let lastSettings = {};
let lastAnnouncedIndex = -1;
let isDragging = false;
let initialMouseY = 0;
let initialBottomPercent = 0;
let userDefinedBottom = '5%';

const SETTINGS_KEY = 'subtitleUserSettings';
const defaultSettings = {
    position: 5,
    fontSize: 2.5,
    enableFurigana: false,
    enableDictionary: false,
    language: 'japanese',
    moveOnPause: false,
    backgroundStyle: 'default',
    panelWidth: 90,
    panelHeight: 80
};
let observer = null;
let dictionaryIsEnabled = false;

const tokenizerPromise = new Promise((resolve) => {
    kuromoji.builder({ dicPath: chrome.runtime.getURL("dict/") }).build((err, tokenizer) => {
        if (err) {
            console.error("Could not build kuromoji tokenizer:", err);
            resolve(null);
        } else {
            console.log("Kuromoji tokenizer ready.");
            resolve(tokenizer);
        }
    });
});

function katakanaToHiragana(kata) {
    if (!kata) return '';
    return String.fromCharCode(...[...kata].map(c => c.codePointAt(0) - 0x60));
}

async function wrapWordsInSpan(text) {
    const tokenizer = await tokenizerPromise;
    if (!tokenizer || !text) return text;
    const tokens = tokenizer.tokenize(text);
    return tokens.map(token => `<span class="vocab-word">${token.surface_form}</span>`).join('');
}

async function addFuriganaAndWrap(text) {
    const tokenizer = await tokenizerPromise;
    if (!tokenizer || !text) return text;
    const tokens = tokenizer.tokenize(text);
    const kanjiRegex = /[一-龯]/;
    let resultHtml = '';
    for (const token of tokens) {
        const surface = token.surface_form;
        const reading = token.reading;
        let wordHtml;
        if (kanjiRegex.test(surface) && reading) {
            const hiraganaReading = katakanaToHiragana(reading);
            wordHtml = `<ruby><rb>${surface}</rb><rt>${hiraganaReading}</rt></ruby>`;
        } else {
            wordHtml = surface;
        }
        resultHtml += `<span class="vocab-word">${wordHtml}</span>`;
    }
    return resultHtml;
}

function getBaseText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    const rubies = clone.querySelectorAll('rt');
    rubies.forEach(rt => rt.remove());
    return clone.textContent;
}

function renderPopupContent(word, response, container) {
    if (!response || !response.success || !response.data) {
        container.innerHTML = `<div class="dict-error">${response ? response.error : 'Unknown error.'}</div>`;
        return;
    }
    let html = '';
    if (response.source === 'jisho') {
        if (response.data.data.length === 0) {
            container.innerHTML = `<div class="dict-error">No results found for "${word}" on Jisho.org.</div>`;
            return;
        }
        response.data.data.slice(0, 5).forEach(entry => {
            const japanese = entry.japanese[0];
            const wordText = japanese.word || japanese.reading;
            const readingText = japanese.reading;
            html += `<div class="dict-entry">`;
            html += `<div class="dict-entry-japanese">`;
            html += `<span class="dict-entry-word">${wordText}</span>`;
            if (readingText && readingText !== wordText) {
                html += `<span class="dict-entry-reading">【${readingText}】</span>`;
            }
            html += `</div>`;
            entry.senses.slice(0, 3).forEach(sense => {
                html += `<div class="dict-entry-sense">`;
                if (sense.parts_of_speech.length > 0) {
                    html += `<div class="dict-entry-pos">${sense.parts_of_speech.join(', ')}</div>`;
                }
                if (sense.english_definitions.length > 0) {
                    html += `<ol class="dict-entry-definitions">`;
                    sense.english_definitions.forEach(def => {
                        html += `<li>${def}</li>`;
                    });
                    html += `</ol>`;
                }
                html += `</div>`;
            });
            html += `</div>`;
        });
    }
    else if (response.source === 'google_translate' || response.source === 'deepl') {
        html += `<div class="dict-entry">`;
        html += `<div class="dict-entry-japanese">`;
        html += `<span class="dict-entry-word">${response.data.word}</span>`;
        html += `</div>`;
        html += `<div class="dict-entry-sense">`;
        html += `<div class="dict-entry-pos">Translation (Vietnamese)</div>`;
        html += `<ol class="dict-entry-definitions">`;
        html += `<li>${response.data.translation}</li>`;
        html += `</ol>`;
        html += `</div>`;
        html += `</div>`;
    }
    container.innerHTML = html;
}

function showDictionaryPopup(word, clickedElement) {
    const existingPopup = document.getElementById('dictionary-popup-backdrop');
    if (existingPopup) existingPopup.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'dictionary-popup-backdrop';
    const container = document.createElement('div');
    container.id = 'dictionary-popup-container';
    const header = document.createElement('div');
    header.id = 'dictionary-popup-header';
    const title = document.createElement('h3');
    title.textContent = `Dictionary: ${word}`;
    const closeBtn = document.createElement('button');
    closeBtn.id = 'dictionary-popup-close-btn';
    closeBtn.innerHTML = '×';
    const content = document.createElement('div');
    content.id = 'dictionary-popup-content';
    content.innerHTML = `<div class="dict-loading">Loading...</div>`;
    const ankiBtn = document.createElement('button');
    ankiBtn.id = 'dictionary-popup-anki-btn';
    ankiBtn.textContent = 'Add to Anki';
    Object.assign(ankiBtn.style, {
        marginLeft: '10px', padding: '2px 8px', fontSize: '12px',
        cursor: 'pointer', border: '1px solid #ccc', borderRadius: '3px'
    });
    header.appendChild(title);
    header.appendChild(ankiBtn);
    header.appendChild(closeBtn);
    container.appendChild(header);
    container.appendChild(content);
    let contextSentence = '';
    if (clickedElement) {
        const subtitleLine = clickedElement.closest('#custom-subtitle-container > div, #custom-subtitle-container');
        if (subtitleLine) {
            contextSentence = getBaseText(subtitleLine).trim().replace(/<br>/g, ' ');
        }
    }
    const hostElement = document.fullscreenElement || document.body;
    hostElement.appendChild(backdrop);
    backdrop.appendChild(container);
    let dragOffsetX, dragOffsetY;
    const onDragStart = (e) => {
        dragOffsetX = e.clientX - container.offsetLeft;
        dragOffsetY = e.clientY - container.offsetTop;
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', onDragEnd, { once: true });
    };
    const onDrag = (e) => {
        container.style.left = `${e.clientX - dragOffsetX}px`;
        container.style.top = `${e.clientY - dragOffsetY}px`;
    };
    const onDragEnd = () => {
        document.removeEventListener('mousemove', onDrag);
    };
    header.addEventListener('mousedown', onDragStart);
    const closePopup = () => { backdrop.remove(); };
    closeBtn.addEventListener('click', closePopup);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePopup(); });
    ankiBtn.addEventListener('click', () => {
        ankiBtn.textContent = 'Adding...';
        ankiBtn.disabled = true;
        const language = lastSettings.language || 'japanese';
        addNoteToAnki(word, contextSentence, language, (success, error) => {
            if (success) {
                ankiBtn.textContent = '✓ Added';
            } else {
                ankiBtn.textContent = 'Error';
                ankiBtn.title = error;
                console.error('AnkiConnect Error:', error);
            }
        });
    });
    const language = lastSettings.language || 'japanese';
    chrome.runtime.sendMessage({ action: 'lookupWord', word: word, language: language }, (response) => {
        if (chrome.runtime.lastError) {
            content.innerHTML = `<div class="dict-error">Error: ${chrome.runtime.lastError.message}</div>`;
            ankiBtn.disabled = true;
            return;
        }
        if (response) {
            if (response.success) {
                if (response.source === 'jisho') {
                    title.textContent = `Jisho.org: ${word}`;
                } else if (response.source === 'google_translate') {
                    title.textContent = `Google Translate: ${word}`;
                } else if (response.source === 'deepl') {
                    title.textContent = `DeepL: ${word}`;
                }
                renderPopupContent(word, response, content);
                ankiBtn.dataset.lookupResponse = JSON.stringify(response);
            } else {
                content.innerHTML = `<div class="dict-error">Error: ${response.error}</div>`;
                ankiBtn.disabled = true;
            }
        } else {
            content.innerHTML = `<div class="dict-error">No response from background script.</div>`;
            ankiBtn.disabled = true;
        }
    });
}

function handleSubtitleInteraction(event) {
    if (event.type === 'mouseup') {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            event.stopPropagation();
            const selectedText = getBaseText(selection.getRangeAt(0).cloneContents()).trim();
            if (selectedText.length > 0 && subtitleContainer.contains(selection.anchorNode)) {
                showDictionaryPopup(selectedText, selection.anchorNode.parentElement);
            }
            return;
        }
    }
    
    if (event.type === 'click') {
        const selection = window.getSelection();
        if (selection && selection.isCollapsed) {
            const wordElement = event.target.closest('.vocab-word');
            if (wordElement) {
                const word = getBaseText(wordElement).trim();
                if (word) {
                    showDictionaryPopup(word, wordElement);
                }
            }
        }
    }
}

function onDragStart(e) {
    if (e.target !== subtitleContainer) return;
    e.preventDefault();
    isDragging = true;
    initialMouseY = e.clientY;
    initialBottomPercent = parseFloat(subtitleContainer.style.bottom || lastSettings.position);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd, { once: true });
}

function onDragMove(e) {
    if (!isDragging) return;
    const videoParent = subtitleContainer.parentElement;
    if (!videoParent) return;
    const deltaY = e.clientY - initialMouseY;
    const parentHeight = videoParent.clientHeight;
    const deltaPercent = (deltaY / parentHeight) * 100;
    let newBottom = initialBottomPercent - deltaPercent;
    if (newBottom < 0) newBottom = 0;
    if (newBottom > 95) newBottom = 95;
    subtitleContainer.style.bottom = `${newBottom}%`;
}

function onDragEnd(e) {
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    if (subtitleContainer) {
        const finalPosition = parseFloat(subtitleContainer.style.bottom);
        userDefinedBottom = `${finalPosition}%`;
        lastSettings.position = finalPosition;
        chrome.storage.local.set({ [SETTINGS_KEY]: lastSettings });
        chrome.runtime.sendMessage({ action: 'updateSettingInPopup', setting: 'position', value: finalPosition });
    }
}

function updateSubtitleAppearance() {
    if (!subtitleContainer || !lastSettings) return;

    userDefinedBottom = `${lastSettings.position}%`;
    const shouldBeElevated = videoElement && videoElement.paused && lastSettings.moveOnPause && lastSettings.backgroundStyle === 'panel';

    if (shouldBeElevated) {
        const videoParent = subtitleContainer.parentElement;
        if (videoParent) {
            const parentHeight = videoParent.clientHeight;
            const panelHeight = subtitleContainer.offsetHeight;
            const topMargin = 10;
            const newBottomInPixels = parentHeight - panelHeight - topMargin;
            const newBottomInPercent = (newBottomInPixels / parentHeight) * 100;
            subtitleContainer.style.bottom = `${newBottomInPercent}%`;
        }
    } else {
        subtitleContainer.style.bottom = userDefinedBottom;
    }

    subtitleContainer.style.fontSize = `${lastSettings.fontSize}vw`;
    if (lastSettings.backgroundStyle === 'panel') {
        subtitleContainer.style.backgroundColor = '#282c34';
        subtitleContainer.style.textShadow = 'none';
        subtitleContainer.style.borderRadius = '4px';
        subtitleContainer.style.width = `${lastSettings.panelWidth}%`;
        subtitleContainer.style.height = `${lastSettings.panelHeight}px`;
        subtitleContainer.style.display = 'flex';
        subtitleContainer.style.flexDirection = 'column';
        subtitleContainer.style.justifyContent = 'center';
        subtitleContainer.style.padding = '0 0.5em';
    } else {
        subtitleContainer.style.backgroundColor = 'transparent';
        subtitleContainer.style.textShadow = '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000';
        subtitleContainer.style.borderRadius = '0';
        subtitleContainer.style.width = '90%';
        subtitleContainer.style.height = 'auto';
        subtitleContainer.style.display = 'block';
        subtitleContainer.style.justifyContent = 'initial';
        subtitleContainer.style.padding = '0';
    }
}

function cleanup(preserveState = false) {
    if (videoElement) {
        videoElement.removeEventListener('timeupdate', updateSubtitle);
        videoElement.removeEventListener('pause', updateSubtitleAppearance);
        videoElement.removeEventListener('play', updateSubtitleAppearance);
    }
    if (subtitleContainer && subtitleContainer.parentElement) {
        subtitleContainer.remove();
    }
    videoElement = null;
    subtitleContainer = null;
    parsedSubtitles = [];
    if (!preserveState) {
        lastSubData = { data: '', format: 'srt' };
        lastSettings = {};
    }
}

async function initializeSubtitleInjector(video) {
    if (videoElement === video) return;
    cleanup(true);
    videoElement = video;
    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'custom-subtitle-container';
    Object.assign(subtitleContainer.style, {
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', color: 'white', fontWeight: 'bold',
        zIndex: '2147483647', pointerEvents: 'auto', lineHeight: '1.4'
    });
    const videoParent = video.parentElement;
    if (getComputedStyle(videoParent).position === 'static') videoParent.style.position = 'relative';
    videoParent.appendChild(subtitleContainer);
    
    video.addEventListener('timeupdate', updateSubtitle);
    video.addEventListener('pause', updateSubtitleAppearance);
    video.addEventListener('play', updateSubtitleAppearance);

    subtitleContainer.addEventListener('click', (e) => {
        if (!isDragging) handleSubtitleInteraction(e);
    });
    subtitleContainer.addEventListener('mouseup', (e) => {
        if (!isDragging) handleSubtitleInteraction(e);
    });
    subtitleContainer.addEventListener('mousedown', onDragStart);

    if (lastSubData.data) {
        const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get([SETTINGS_KEY]);
        const currentSettings = { ...defaultSettings, ...settings };
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'displaySubtitles', settings: currentSettings, data: lastSubData.data, format: lastSubData.format });
            }
        });
    }
}

function updateSubtitle() {
    if (!videoElement || !subtitleContainer) return;
    const currentTime = videoElement.currentTime;
    let currentSubtitleIndex = parsedSubtitles.findIndex(sub => currentTime >= sub.startTime && currentTime <= sub.endTime);
    if (currentSubtitleIndex !== -1) {
        const currentSubtitle = parsedSubtitles[currentSubtitleIndex];
        const lines = currentSubtitle.text.split('<br>').map(line => `<div>${line}</div>`).join('');
        subtitleContainer.innerHTML = lines;
    } else {
        subtitleContainer.innerHTML = '';
    }
    if (currentSubtitleIndex !== lastAnnouncedIndex) {
        chrome.runtime.sendMessage({ action: 'updateTranscriptHighlight', index: currentSubtitleIndex })
            .catch(error => { if (!error.message.includes('Receiving end does not exist')) console.error("Error sending highlight message:", error); });
        lastAnnouncedIndex = currentSubtitleIndex;
    }
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

async function parseSrt(srtText, options = {}) {
    const { offset = 0, useFurigana = false, useDictionary = false, language = 'japanese' } = options;
    const subtitles = [];
    if (!srtText) return subtitles;
    const cleanedText = srtText.replace(/&[a-z]+;/gi, '').replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '');
    const entries = cleanedText.trim().replace(/\r/g, '').split(/\n\s*\n/);
    for (const entry of entries) {
        const lines = entry.split('\n');
        if (lines.length >= 2) {
            const timeMatch = lines[1] ? lines[1].match(/(.+?)\s*-->\s*(.+)/) : null;
            if (timeMatch) {
                const startTime = Math.max(0, timeToSeconds(timeMatch[1].trim()) + offset);
                const endTime = Math.max(0, timeToSeconds(timeMatch[2].trim()) + offset);
                if (endTime > startTime) {
                    let textContent = lines.slice(2).join('<br>');
                    const originalLines = textContent.split('<br>');
                    let processedLines;
                    if (language === 'japanese') {
                        if (useFurigana) {
                            processedLines = await Promise.all(originalLines.map(line => addFuriganaAndWrap(line)));
                        } else if (useDictionary) {
                            processedLines = await Promise.all(originalLines.map(line => wrapWordsInSpan(line)));
                        } else {
                            processedLines = originalLines;
                        }
                    } else {
                        if (useDictionary) {
                            processedLines = originalLines.map(line =>
                                line.split(/(\s+)/).map(word => `<span class="vocab-word">${word}</span>`).join('')
                            );
                        } else {
                            processedLines = originalLines;
                        }
                    }
                    textContent = processedLines.join('<br>');
                    subtitles.push({ startTime, endTime, text: textContent });
                }
            }
        }
    }
    return subtitles;
}

async function parseAndDisplaySubtitles(data, format, settings) {
    const parseOptions = {
        offset: settings.offset || 0,
        useFurigana: settings.enableFurigana || false,
        useDictionary: settings.enableDictionary || false,
        language: settings.language || 'japanese'
    };
    return await parseSrt(data, parseOptions);
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'displaySubtitles') {
        if (!videoElement) {
            const video = document.querySelector('video');
            if (video) await initializeSubtitleInjector(video);
            else { console.log("No video element found."); return; }
        }
        if (request.settings) {
            lastSettings = request.settings;
        }
        dictionaryIsEnabled = lastSettings.enableDictionary;
        if (request.append && request.data) {
            const newSubs = await parseAndDisplaySubtitles(request.data, 'srt', lastSettings);
            parsedSubtitles = parsedSubtitles.concat(newSubs);
            lastSubData.data += '\n\n' + request.data;
        } else if (request.data) {
            lastSubData = { data: request.data, format: 'srt' };
            parsedSubtitles = await parseAndDisplaySubtitles(lastSubData.data, lastSubData.format, lastSettings);
        } else if (lastSubData.data) {
            parsedSubtitles = await parseAndDisplaySubtitles(lastSubData.data, 'srt', lastSettings);
        }
        
        updateSubtitleAppearance();
        updateSubtitle();

    } else if (request.action === 'seekVideo') {
        if (videoElement) videoElement.currentTime = request.time;
    } else if (request.action === 'clearSubtitles') {
        cleanup(false);
    }
});

function handleDOMChanges(mutations) {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            setTimeout(() => {
                const currentVideo = document.querySelector('video');
                if (currentVideo && currentVideo !== videoElement) {
                    initializeSubtitleInjector(currentVideo);
                }
            }, 500);
            return;
        }
    }
}

setTimeout(() => {
    const initialVideo = document.querySelector('video');
    if (initialVideo) initializeSubtitleInjector(initialVideo);
}, 500);

observer = new MutationObserver(handleDOMChanges);
observer.observe(document.body, { childList: true, subtree: true });

async function addNoteToAnki(word, sentence, language, callback) {
    const ankiBtn = document.getElementById('dictionary-popup-anki-btn');
    const lookupResponse = JSON.parse(ankiBtn.dataset.lookupResponse || '{}');
    if (!lookupResponse.success || !lookupResponse.data) {
        callback(false, "No dictionary data available.");
        return;
    }
    const langUpper = language.charAt(0).toUpperCase() + language.slice(1);
    const desiredDeckName = `Created by MSST - ${langUpper}`;
    const desiredModelName = "Basic";
    let fields = {};
    if (language === 'japanese' && lookupResponse.source === 'jisho') {
        const firstEntry = lookupResponse.data.data[0];
        const japanese = firstEntry.japanese[0];
        const reading = japanese.reading || '';
        const definitions = firstEntry.senses.map((sense, i) => `${i + 1}. [${sense.parts_of_speech.join(', ')}] ${sense.english_definitions.join('; ')}`).join('\n');
        fields = {
            "Front": word,
            "Back": `<div style="text-align:left;">
                        <b>Reading:</b> ${reading}<br>
                        <b>Definition:</b><br>${definitions.replace(/\n/g, '<br>')}<br><hr>
                        <b>Sentence:</b> ${sentence}
                     </div>`
        };
    } else {
        const translation = lookupResponse.data.translation;
        fields = {
            "Front": word,
            "Back": `<div style="text-align:left;">
                        <b>Translation (VI):</b> ${translation}<br><hr>
                        <b>Sentence:</b> ${sentence}
                     </div>`
        };
    }
    try {
        await fetch('http://127.0.0.1:8765', {
            method: 'POST',
            body: JSON.stringify({
                action: "createDeck",
                version: 6,
                params: { deck: desiredDeckName }
            })
        });
        const note = {
            deckName: desiredDeckName,
            modelName: desiredModelName,
            fields: fields,
            options: {
                "allowDuplicate": false,
                "duplicateScope": "deck"
            },
            tags: [
                `from_extension_${language}`
            ]
        };
        const addNoteResponse = await fetch('http://127.0.0.1:8765', {
            method: 'POST',
            body: JSON.stringify({
                action: "addNote",
                version: 6,
                params: {
                    note: note
                }
            })
        });
        const addNoteJson = await addNoteResponse.json();
        if (addNoteJson.error) {
            if (addNoteJson.error.includes("duplicate")) {
                callback(false, "Note already exists (duplicate).");
            } else {
                throw new Error(addNoteJson.error);
            }
        } else {
            callback(true, null);
        }
    } catch (e) {
        callback(false, "Could not connect to Anki or AnkiConnect error: " + e.message);
    }
}