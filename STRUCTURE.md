# Cấu trúc Dự án

Dự án này đã được tái cấu trúc để dễ quản lý và theo dõi hơn.

## Cấu trúc Thư mục

```
chrome-subtitle-extension/
├── manifest.json          # Cấu hình extension
├── README.md              # Hướng dẫn sử dụng
├── LICENSE                # Giấy phép
├── .gitignore             # Git ignore rules
│
├── src/                   # Source code chính
│   ├── popup/             # Popup UI
│   │   ├── popup.html     # HTML của popup
│   │   ├── popup.css      # Styles của popup
│   │   └── popup.js       # Logic của popup
│   │
│   ├── content/           # Content scripts (chạy trên trang web)
│   │   ├── content_script.js  # Script xử lý subtitle trên trang
│   │   └── content.css         # Styles cho subtitle overlay
│   │
│   ├── background/        # Background service worker
│   │   └── background.js  # Xử lý logic backend, API calls
│   │
│   └── offscreen/         # Offscreen document
│       ├── offscreen.html # HTML cho offscreen document
│       └── offscreen.js  # Xử lý parsing HTML và ZIP files
│
├── lib/                   # Thư viện bên ngoài (third-party)
│   ├── subsrt.js         # Parser cho subtitle files
│   ├── kuromoji.js       # Japanese tokenizer
│   ├── jszip.min.js      # ZIP file handler
│   ├── libarchive.js     # Archive handler (7z, rar, etc.)
│   ├── libarchive.wasm   # WebAssembly cho libarchive
│   └── worker-bundle.js  # Worker bundle
│
└── assets/                # Tài nguyên tĩnh
    └── dict/              # Dictionary data cho kuromoji
        ├── base.dat.gz
        ├── cc.dat.gz
        ├── check.dat.gz
        └── ... (các file dictionary khác)

```

## Mô tả các Thành phần

### `src/popup/`
Giao diện người dùng chính của extension, bao gồm:
- **Search tab**: Tìm kiếm subtitle từ các nguồn (Jimaku, Kitsunekko, OpenSubtitles)
- **Settings tab**: Cấu hình subtitle (vị trí, kích thước, màu sắc, etc.)
- **Transcript tab**: Hiển thị transcript của subtitle đang phát
- **Vocab List tab**: Quản lý từ vựng đã lưu

### `src/content/`
Scripts chạy trên trang web để:
- Hiển thị subtitle overlay trên video
- Xử lý tương tác với subtitle (click để tra từ điển)
- Quản lý vị trí và style của subtitle

### `src/background/`
Service worker xử lý:
- Tìm kiếm subtitle từ các API
- Quản lý storage
- Xử lý messages giữa các components
- Dictionary lookup (Jisho, DeepL, Google Translate)

### `src/offscreen/`
Offscreen document để:
- Parse HTML từ các trang web subtitle
- Extract và parse các file archive (ZIP, 7z, RAR)
- Xử lý các tác vụ cần DOM nhưng không cần hiển thị

### `lib/`
Các thư viện bên ngoài được sử dụng:
- **subsrt.js**: Parse và build subtitle files (SRT, VTT, etc.)
- **kuromoji.js**: Japanese morphological analyzer
- **jszip.min.js**: Xử lý ZIP files
- **libarchive.js/wasm**: Xử lý các định dạng archive khác (7z, RAR)

### `assets/`
Tài nguyên tĩnh:
- **dict/**: Dictionary data cho kuromoji tokenizer

## Luồng Hoạt động

1. **User mở popup** → `src/popup/popup.html` được load
2. **User tìm kiếm subtitle** → `popup.js` gửi message đến `background.js`
3. **Background worker** tìm kiếm từ các nguồn và trả về kết quả
4. **User chọn subtitle** → Background tải file và parse (có thể dùng offscreen)
5. **Subtitle được gửi đến content script** → Hiển thị trên video
6. **User tương tác với subtitle** → Content script xử lý và có thể gọi dictionary lookup

## Lưu ý khi Phát triển

- Tất cả đường dẫn trong `manifest.json` phải tương đối từ root của extension
- Các file trong `lib/` và `assets/` được khai báo trong `web_accessible_resources`
- ES modules trong `offscreen.js` sử dụng đường dẫn tuyệt đối từ root (`/lib/...`)
- Content scripts sử dụng `chrome.runtime.getURL()` để truy cập resources

