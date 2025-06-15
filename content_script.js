// content_script.js
console.log("Subtitle Inserter [v21-AssSupport] loaded.");

let videoElement = null;
let subtitleContainer = null;
let parsedSubtitles = [];
let lastSubData = { data: '', format: 'srt' };
let lastSettings = {};
let lastAnnouncedIndex = -1;

const SETTINGS_KEY = 'subtitleUserSettings';
const defaultSettings = {
    position: 5,
    fontSize: 2.5,
    enableFurigana: false,
    enableDictionary: false,
    language: 'japanese' // Thêm ngôn ngữ mặc định
};
let observer = null;
let dictionaryIsEnabled = false;

// --- KUROMOJI.JS INTEGRATION ---
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

// --- DICTIONARY POPUP LOGIC ---
function getBaseText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    const rubies = clone.querySelectorAll('rt');
    rubies.forEach(rt => rt.remove());
    return clone.textContent;
}

// SỬA ĐỔI: Hiển thị kết quả từ nhiều nguồn khác nhau
function renderPopupContent(word, response, container) {
    if (!response || !response.success || !response.data) {
        container.innerHTML = `<div class="dict-error">${response ? response.error : 'Unknown error.'}</div>`;
        return;
    }

    let html = '';
    // Hiển thị cho Jisho (tiếng Nhật)
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
    // Hiển thị cho Google Translate (các ngôn ngữ khác)
    else if (response.source === 'google_translate') {
        html += `<div class="dict-entry">`;
        html += `<div class="dict-entry-japanese">`; // Giữ class để style tương tự
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

// SỬA ĐỔI: Gửi request và xử lý Anki một cách linh hoạt
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
    title.textContent = `Dictionary: ${word}`; // Title chung
    
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

    // Xử lý sự kiện khi nhấn nút Anki
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

    // Gửi yêu cầu tra từ với thông tin ngôn ngữ
    const language = lastSettings.language || 'japanese';
    chrome.runtime.sendMessage({ action: 'lookupWord', word: word, language: language }, (response) => {
        if (chrome.runtime.lastError) {
            content.innerHTML = `<div class="dict-error">Error: ${chrome.runtime.lastError.message}</div>`;
            ankiBtn.disabled = true;
            return;
        }
        if (response) {
            if (response.success) {
                // Cập nhật title của popup dựa trên nguồn
                if(response.source === 'jisho') {
                    title.textContent = `Jisho.org: ${word}`;
                } else if (response.source === 'google_translate') {
                    title.textContent = `Google Translate: ${word}`;
                }
                
                renderPopupContent(word, response, content);
                ankiBtn.dataset.lookupResponse = JSON.stringify(response); // Lưu toàn bộ response
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
    event.stopPropagation();
    if (!dictionaryIsEnabled) return;
    const selection = window.getSelection();
    
    if (event.type === 'mouseup' && !selection.isCollapsed) {
        const selectedText = getBaseText(selection.getRangeAt(0).cloneContents()).trim();
        if (selectedText.length > 0 && subtitleContainer.contains(selection.anchorNode)) {
             showDictionaryPopup(selectedText, selection.anchorNode.parentElement);
        }
        return;
    }

    if (event.type === 'click' && selection.isCollapsed) {
        const wordElement = event.target.closest('.vocab-word');
        if (wordElement) {
            const word = getBaseText(wordElement).trim();
            if (word) {
                showDictionaryPopup(word, wordElement);
            }
        }
    }
}
// --- END DICTIONARY LOGIC ---

function cleanup(preserveState = false) {
    if (videoElement) videoElement.removeEventListener('timeupdate', updateSubtitle);
    if (subtitleContainer && subtitleContainer.parentElement) subtitleContainer.remove();
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
        position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: '90%',
        textAlign: 'center', color: 'white', fontWeight: 'bold',
        textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000',
        zIndex: '2147483647', pointerEvents: 'auto', lineHeight: '1.4'
    });
    
    const videoParent = video.parentElement;
    if (getComputedStyle(videoParent).position === 'static') videoParent.style.position = 'relative';
    videoParent.appendChild(subtitleContainer);
    
    video.addEventListener('timeupdate', updateSubtitle);
    subtitleContainer.addEventListener('click', handleSubtitleInteraction);
    subtitleContainer.addEventListener('mouseup', handleSubtitleInteraction);

    if (lastSubData.data) {
        console.log("Re-applying subtitles after DOM change (e.g., fullscreen).");
        const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get([SETTINGS_KEY]);
        const currentSettings = { ...defaultSettings, ...settings };
        await parseAndDisplaySubtitles(lastSubData.data, lastSubData.format, currentSettings);
    }
}

function updateSubtitle() {
    if (!videoElement || !subtitleContainer) return;
    const currentTime = videoElement.currentTime;
    let currentSubtitleIndex = parsedSubtitles.findIndex(sub => currentTime >= sub.startTime && currentTime <= sub.endTime);
    
    if (currentSubtitleIndex !== -1) {
        const currentSubtitle = parsedSubtitles[currentSubtitleIndex];
        // Wrap each line in a div to treat them as separate context blocks
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
    
    const entries = srtText.trim().replace(/\r/g, '').split(/\n\s*\n/);
    for (const entry of entries) {
        const lines = entry.split('\n');
        if (lines.length >= 2) {
            const timeMatch = lines[1].match(/(.+?)\s*-->\s*(.+)/);
            if (timeMatch) {
                const startTime = Math.max(0, timeToSeconds(timeMatch[1].trim()) + offset);
                const endTime = Math.max(0, timeToSeconds(timeMatch[2].trim()) + offset);
                
                if (endTime > startTime) {
                    let textContent = lines.slice(2).join('<br>');
                    const originalLines = textContent.split('<br>');
                    let processedLines;

                    // Chỉ áp dụng furigana và kuromoji cho tiếng Nhật
                    if (language === 'japanese') {
                        if (useFurigana) {
                            processedLines = await Promise.all(originalLines.map(line => addFuriganaAndWrap(line)));
                        } else if (useDictionary) {
                            processedLines = await Promise.all(originalLines.map(line => wrapWordsInSpan(line)));
                        } else {
                            processedLines = originalLines;
                        }
                    } else {
                        // Đối với các ngôn ngữ khác, chỉ bọc từ để có thể click
                        if(useDictionary) {
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
            lastSubData.data += '\n\n' + request.data;
            lastSubData.format = request.format || 'srt';
            const newSubs = await parseAndDisplaySubtitles(request.data, lastSubData.format, lastSettings);
            parsedSubtitles = parsedSubtitles.concat(newSubs);
        } else if (request.data) {
            // New subtitle data loaded
            lastSubData = { data: request.data, format: request.format || 'srt' };
            parsedSubtitles = await parseAndDisplaySubtitles(lastSubData.data, lastSubData.format, lastSettings);
        } else if (lastSubData.data) {
            // No new data, but settings were applied. Re-parse existing data.
            parsedSubtitles = await parseAndDisplaySubtitles(lastSubData.data, lastSubData.format, lastSettings);
        }
    
        if (lastSettings && subtitleContainer) {
            subtitleContainer.style.bottom = `${lastSettings.position}%`;
            subtitleContainer.style.fontSize = `${lastSettings.fontSize}vw`;
        }
        
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


// SỬA ĐỔI HOÀN TOÀN HÀM NÀY ĐỂ HỖ TRỢ ANKI ĐA NGÔN NGỮ
async function addNoteToAnki(word, sentence, language, callback) {
    const ankiBtn = document.getElementById('dictionary-popup-anki-btn');
    const lookupResponse = JSON.parse(ankiBtn.dataset.lookupResponse || '{}');

    if (!lookupResponse.success || !lookupResponse.data) {
        callback(false, "No dictionary data available.");
        return;
    }
    
    // Tạo tên deck động dựa trên ngôn ngữ
    const langUpper = language.charAt(0).toUpperCase() + language.slice(1);
    const desiredDeckName = `Created by MSST - ${langUpper}`;
    const desiredModelName = "Basic"; // Giữ Basic cho đơn giản, có thể tùy biến sau

    let fields = {};

    // Cấu trúc thẻ tùy theo ngôn ngữ và nguồn dữ liệu
    if (language === 'japanese' && lookupResponse.source === 'jisho') {
        const firstEntry = lookupResponse.data.data[0];
        const japanese = firstEntry.japanese[0];
        const reading = japanese.reading || '';
        const definitions = firstEntry.senses.map((sense, i) => `${i+1}. [${sense.parts_of_speech.join(', ')}] ${sense.english_definitions.join('; ')}`).join('\n');

        fields = {
            "Front": word,
            "Back": `<div style="text-align:left;">
                        <b>Reading:</b> ${reading}<br>
                        <b>Definition:</b><br>${definitions.replace(/\n/g, '<br>')}<br><hr>
                        <b>Sentence:</b> ${sentence}
                     </div>`
        };
    } else { // Cho các ngôn ngữ khác (ví dụ: dùng Google Translate)
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
        // Bước 1: Gọi AnkiConnect action để đảm bảo bộ thẻ tồn tại
        // Lệnh này sẽ tạo deck nếu chưa có, hoặc không làm gì nếu đã có.
        await fetch('http://127.0.0.1:8765', {
            method: 'POST',
            body: JSON.stringify({
                action: "createDeck",
                version: 6,
                params: { deck: desiredDeckName }
            })
        });

        // Cấu trúc của một thẻ Anki (note)
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

        // Bước 2: Thêm ghi chú
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
        
        // Xử lý lỗi, đặc biệt là lỗi trùng thẻ
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