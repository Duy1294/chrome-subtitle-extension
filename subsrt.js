// subsrt.js - PHIÊN BẢN ĐÃ SỬA LỖI TẬN GỐC

(function (global) {
  var factory = function() {
    return /******/ (function(modules) { // webpackBootstrap
    /******/ 	// The module cache
    /******/ 	var installedModules = {};
    /******/
    /******/ 	// The require function
    /******/ 	function __webpack_require__(moduleId) {
    /******/
    /******/ 		// Check if module is in cache
    /******/ 		if(installedModules[moduleId]) {
    /******/ 			return installedModules[moduleId].exports;
    /******/ 		}
    /******/ 		// Create a new module (and put it into the cache)
    /******/ 		var module = installedModules[moduleId] = {
    /******/ 			i: moduleId,
    /******/ 			l: false,
    /******/ 			exports: {}
    /******/ 		};
    /******/
    /******/ 		// Execute the module function
    /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    /******/
    /******/ 		// Flag the module as loaded
    /******/ 		module.l = true;
    /******/
    /******/ 		// Return the exports of the module
    /******/ 		return module.exports;
    /******/ 	}
    /******/
    /******/
    /******/ 	// expose the modules object (__webpack_modules__)
    /******/ 	__webpack_require__.m = modules;
    /******/
    /******/ 	// expose the module cache
    /******/ 	__webpack_require__.c = installedModules;
    /******/
    /******/ 	// define getter function for harmony exports
    /******/ 	__webpack_require__.d = function(exports, name, getter) {
    /******/ 		if(!__webpack_require__.o(exports, name)) {
    /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
    /******/ 		}
    /******/ 	};
    /******/
    /******/ 	// define __esModule on exports
    /******/ 	__webpack_require__.r = function(exports) {
    /******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
    /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    /******/ 		}
    /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
    /******/ 	};
    /******/
    /******/ 	// create a fake namespace object
    /******/ 	// mode & 1: value is a module id, require it
    /******/ 	// mode & 2: merge all properties of value into the ns
    /******/ 	// mode & 4: return value when already ns object
    /******/ 	// mode & 8|1: behave like require
    /******/ 	__webpack_require__.t = function(value, mode) {
    /******/ 		if(mode & 1) value = __webpack_require__(value);
    /******/ 		if(mode & 8) return value;
    /******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
    /******/ 		var ns = Object.create(null);
    /******/ 		__webpack_require__.r(ns);
    /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
    /******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
    /******/ 		return ns;
    /******/ 	};
    /******/
    /******/ 	// getDefaultExport function for compatibility with non-harmony modules
    /******/ 	__webpack_require__.n = function(module) {
    /******/ 		var getter = module && module.__esModule ?
    /******/ 			function getDefault() { return module['default']; } :
    /******/ 			function getModuleExports() { return module; };
    /******/ 		__webpack_require__.d(getter, 'a', getter);
    /******/ 		return getter;
    /******/ 	};
    /******/
    /******/ 	// Object.prototype.hasOwnProperty.call
    /******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
    /******/
    /******/ 	// __webpack_public_path__
    /******/ 	__webpack_require__.p = "";
    /******/
    /******/
    /******/ 	// Load entry module and return exports
    /******/ 	return __webpack_require__(__webpack_require__.s = 0);
    /******/ })
    /************************************************************************/
    /******/ ([
    /* 0 */
    /***/ (function(module, exports, __webpack_require__) {

    "use strict";


    var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

    var formats = __webpack_require__(1);

    var subsrt = {};

    subsrt.list = function () {
      return Object.keys(formats);
    };

    subsrt.parse = function (content) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var format = subsrt.detect(content, options);
      if (!format) {
        var E = Error; 
        throw new E('Unsupported subtitle format');
      }
      var captions = formats[format].parse(content, options);
      return captions;
    };

    subsrt.build = function (captions) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var format = options.format || 'srt';
      if (Object.keys(formats).indexOf(format) < 0) {
        var E = Error; 
        throw new E('Unsupported subtitle format ' + format);
      }
      var content = formats[format].build(captions, options);
      return content;
    };

    subsrt.detect = function (content) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var format = '';
      for (var key in formats) {
        if (formats[key].detect(content, options)) {
          format = key;
          break;
        }
      }
      return format;
    };

    subsrt.resync = function (captions) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var shift = 0;
      if (options.offset) {
        shift += options.offset;
      }

      if (options.ratio) {
        var ratio = options.ratio || 1.0;
        var frame = options.frame || false;
        for (var i = 0; i < captions.length; i++) {
          var caption = captions[i];
          var start = frame ? caption.frame.start : caption.start;
          var end = frame ? caption.frame.end : caption.end;
          start = Math.round(start * ratio);
          end = Math.round(end * ratio);
          if (frame) {
            caption.frame.start = start;
            caption.frame.end = end;
          } else {
            caption.start = start;
            caption.end = end;
          }
        }
      }

      if (shift) {
        for (var _i = 0; _i < captions.length; _i++) {
          var _caption = captions[_i];
          if (_caption.frame) {
            _caption.frame.start += shift;
            _caption.frame.end += shift;
          } else {
            _caption.start += shift;
            _caption.end += shift;
          }
        }
      }

      return captions;
    };

    subsrt.convert = function (content) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var captions = subsrt.parse(content, options);
      if (options.resync) {
        captions = subsrt.resync(captions, _extends({}, options, options.resync));
      }
      var result = subsrt.build(captions, options);
      return result;
    };

    module.exports = subsrt;

    /***/ }),
    /* 1 */
    /***/ (function(module, exports, __webpack_require__) {

    "use strict";


    module.exports = {
      ass: __webpack_require__(2),
      ssa: __webpack_require__(2),
      sub: __webpack_require__(4),
      srt: __webpack_require__(5),
      vtt: __webpack_require__(6)
    };

    /***/ }),
    /* 2 */
    /***/ (function(module, exports, __webpack_require__) {

    "use strict";


    var _helper = __webpack_require__(3);

    var helper = _interopRequireWildcard(_helper);

    function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

    var re = /^(Dialogue|Comment): (.*?),(\d+:\d+:\d+.\d+),(\d+:\d+:\d+.\d+),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),(.*)/;

    var parse = function parse(content) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var captions = [];
      var lines = content.split(/(?:\r\n|\r|\n)/gm);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var m = line.match(re);
        if (m) {
          var caption = {};
          caption.type = 'caption';
          caption.start = helper.toMilliseconds(m[3]);
          caption.end = helper.toMilliseconds(m[4]);
          caption.style = m[5].trim();
          
          // ----- BẮT ĐẦU THAY ĐỔI -----
          // Lấy text gốc
          var rawText = m[10].trim();
          // Dọn dẹp dấu phẩy ở đầu và chuyển \N thành \n
          caption.text = rawText.replace(/^,/, '').replace(/\\N/g, '\n').trim();
          // ----- KẾT THÚC THAY ĐỔI -----

          if (options.verbose) {
            caption.dialogue = m[1] === 'Dialogue';
            caption.comment = m[1] === 'Comment';
            caption.layer = m[2];
            caption.style = m[5];
            caption.name = m[6];
            caption.marginl = m[7];
            caption.marginr = m[8];
            caption.marginv = m[9];
          }
          captions.push(caption);
        }
      }
      return captions;
    };

    var build = function build(captions) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var content = '';

      if (options.format === 'ass') {
        content += '[Script Info]\n';
        content += 'Title: Default Aegisub file\n';
        content += 'ScriptType: v4.00+\n';
        content += 'WrapStyle: 0\n';
        content += 'ScaledBorderAndShadow: yes\n';
        content += 'YCbCr Matrix: None\n';
        content += '\n';
        content += '[Aegisub Advanced Resolution Script]\n';
        content += '\n';
        content += '[V4+ Styles]\n';
        content += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
        content += 'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n';
        content += '\n';
        content += '[Events]\n';
        content += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
      }

      if (options.format === 'ssa') {
        content += '[Script Info]\n';
        content += 'Title: Default Aegisub file\n';
        content += 'ScriptType: v4.00\n';
        content += 'Collisions: Normal\n';
        content += 'PlayResX: 384\n';
        content += 'PlayResY: 288\n';
        content += 'Timer: 100.0000\n';
        content += 'WrapStyle: 0\n';
        content += '\n';
        content += '[V4 Styles]\n';
        content += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding\n';
        content += 'Style: Default,Arial,20,16777215,65535,0,0,-1,0,1,2,2,2,10,10,10,0,1\n';
        content += '\n';
        content += '[Events]\n';
        content += 'Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
      }

      for (var i = 0; i < captions.length; i++) {
        var caption = captions[i];
        if (caption.type === 'caption') {
          content += 'Dialogue: 0,';
          content += helper.toTimeString(caption.start) + ',';
          content += helper.toTimeString(caption.end) + ',';
          content += caption.style || 'Default';
          content += ',,0,0,0,,';
          content += caption.text.replace(/\r\n|\r|\n/g, '\\N');
          content += '\r\n';
        }
      }

      return content;
    };

    var detect = function detect(content) {
      if (typeof content !== 'string') {
        return false;
      }
      return (/(^\[Script Info\]\r\n)|(^\[V4\+ Styles\]\r\n)|(^\[Events\]\r\n)/.test(content));
    };

    module.exports = {
      parse: parse,
      build: build,
      detect: detect
    };

    /***/ }),
    /* 3 */
    /***/ (function(module, exports, __webpack_require__) {

    "use strict";


    var toMilliseconds = function toMilliseconds(s) {
      if (typeof s !== 'string') {
        return 0;
      }
      var re = /(\d+):(\d+):(\d+)(?:[.,](\d+))?/;
      var m = re.exec(s);
      if (m) {
        var hh = parseInt(m[1], 10) * 3600000;
        var mm = parseInt(m[2], 10) * 60000;
        var ss = parseInt(m[3], 10) * 1000;
        var ff = m[4] ? parseInt((m[4] + '00').substr(0, 3), 10) : 0;
        return hh + mm + ss + ff;
      }
      return 0;
    };

    var toTimeString = function toTimeString(ms) {
      if (typeof ms !== 'number') {
        return '0:00:00.00';
      }
      var hh = Math.floor(ms / 3600000);
      var mm = Math.floor(ms % 3600000 / 60000);
      if (mm < 10) {
        mm = '0' + mm;
      }
      var ss = Math.floor(ms % 60000 / 1000);
      if (ss < 10) {
        ss = '0' + ss;
      }
      var ff = Math.floor(ms % 1000 / 10);
      if (ff < 10) {
        ff = '0' + ff;
      }
      return hh + ':' + mm + ':' + ss + '.' + ff;
    };

    module.exports = {
      toMilliseconds: toMilliseconds,
      toTimeString: toTimeString
    };

    /***/ }),
    /* 4 */
    /***/ (function(module, exports, __webpack_require__) {

    "use strict";


    var re = /{([^}]*)}{([^}]*)} *(.*)/;

    var parse = function parse(content, options) {
      var captions = [];
      if (typeof content !== 'string' || !options || typeof options.fps !== 'number') {
        return captions;
      }
      var lines = content.split(/\r\n|\r|\n/);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var m = line.match(re);
        if (m) {
          var caption = {};
          caption.type = 'caption';
          caption.start = Math.round(parseInt(m[1]) * 1000 / options.fps);
          caption.end = Math.round(parseInt(m[2]) * 1000 / options.fps);
          caption.text = m[3].replace(/\|/g, '\r\n');
          if (options.verbose) {
            caption.frame = {
              start: parseInt(m[1]),
              end: parseInt(m[2]),
              count: parseInt(m[2]) - parseInt(m[1])
            };
          }
          captions.push(caption);
        }
      }
      return captions;
    };

    var build = function build(captions, options) {
      var content = '';
      if (!captions || !options || typeof options.fps !== 'number') {
        return content;
      }
      for (var i = 0; i < captions.length; i++) {
        var caption = captions[i];
        var start = Math.round(caption.start * options.fps / 1000);
        var end = Math.round(caption.end * options.fps / 1000);
        var text = caption.text.replace(/\r\n|\r|\n/g, '|');
        content += '{' + start + '}{' + end + '}' + text + '\r\n';
      }
      return content;
    };

    var detect = function detect(content) {
      if (typeof content !== 'string') {
        return false;
      }
      return (/^\{\d+\}\{\d+\}/.test(content)
      );
    };

    module.exports = {
      parse: parse,
      build: build,
      detect: detect
    };

    /***/ }),
    /* 5 */
    /***/ (function(module, exports, __webpack_require__) {

    "use strict";


    var _helper = __webpack_require__(3);

    var helper = _interopRequireWildcard(_helper);

    function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

    var parse = function parse(content) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var captions = [];
      if (typeof content !== 'string') {
        return captions;
      }
      var lines = content.split(/(?:\r\n|\r|\n)/gm);
      var S_INDEX = 1;
      var S_TIMESTAMP = 2;
      var S_TEXT = 3;
      var state = S_INDEX;
      var caption = {};
      var index = 0;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        switch (state) {
          case S_INDEX:
            {
              if (line.match(/^\d+$/)) {
                index = parseInt(line);
                caption = {
                  type: 'caption',
                  index: index
                };
                state = S_TIMESTAMP;
              }
              break;
            }
          case S_TIMESTAMP:
            {
              var m = line.match(/(\d+:\d+:\d+[,.]\d+) --> (\d+:\d+:\d+[,.]\d+)/);
              if (m) {
                caption.start = helper.toMilliseconds(m[1]);
                caption.end = helper.toMilliseconds(m[2]);
                if (options.verbose) {
                  caption.startTime = m[1];
                  caption.endTime = m[2];
                }
                state = S_TEXT;
              } else {
                state = S_INDEX;
              }
              break;
            }
          case S_TEXT:
            {
              if (line.trim().length > 0) {
                if (caption.text) {
                  caption.text += '\n' + line;
                } else {
                  caption.text = line;
                }
              } else {
                captions.push(caption);
                state = S_INDEX;
              }
              break;
            }
        }
      }

      if (state === S_TEXT) {
        captions.push(caption);
      }

      return captions;
    };

    var build = function build(captions) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var content = '';
      if (!captions) {
        return content;
      }
      for (var i = 0; i < captions.length; i++) {
        var caption = captions[i];
        if (caption.type === 'caption') {
          content += (caption.index || i + 1).toString();
          content += '\r\n';
          content += helper.toTimeString(caption.start).replace('.', ',') + ' --> ' + helper.toTimeString(caption.end).replace('.', ',');
          content += '\r\n';
          content += caption.text;
          content += '\r\n\r\n';
        }
      }
      return content;
    };

    var detect = function detect(content) {
      if (typeof content !== 'string') {
        return false;
      }
      return (/(?:\r\n|\r|\n)\d{1,2}:\d{1,2}:\d{1,2}[,.]\d{1,3} --> \d{1,2}:\d{1,2}:\d{1,2}[,.]\d{1,3}(?:\r\n|\r|\n)/.test(content)
      );
    };

    module.exports = {
      parse: parse,
      build: build,
      detect: detect
    };

    /***/ }),
    /* 6 */
    /***/ (function(module, exports, __webpack_require__) {

    "use strict";


    var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

    var _helper = __webpack_require__(3);

    var helper = _interopRequireWildcard(_helper);

    function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

    var parse = function parse(content) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var captions = [];
      if (typeof content !== 'string') {
        return captions;
      }
      var lines = content.split(/(?:\r\n|\r|\n)/gm);
      var S_HEADER = 1;
      var S_ID = 2;
      var S_TIMESTAMP = 3;
      var S_TEXT = 4;
      var state = S_HEADER;
      var caption = {};
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        switch (state) {
          case S_HEADER:
            {
              if (line.match(/^WEBVTT/)) {
                captions.push({
                  type: 'header',
                  text: line
                });
                state = S_ID;
              }
              break;
            }
          case S_ID:
            {
              if (line.trim().length === 0) {
                continue;
              }
              caption = {
                type: 'caption',
                index: lines[i]
              };
              state = S_TIMESTAMP;
              break;
            }
          case S_TIMESTAMP:
            {
              var m = line.match(/(\d*:?\d+:\d+.\d+) --> (\d*:?\d+:\d+.\d+)/);
              if (m) {
                caption.start = helper.toMilliseconds(m[1]);
                caption.end = helper.toMilliseconds(m[2]);
                if (options.verbose) {
                  caption.startTime = m[1];
                  caption.endTime = m[2];
                }
                state = S_TEXT;
              } else {
                state = S_ID;
              }
              break;
            }
          case S_TEXT:
            {
              if (line.trim().length > 0) {
                if (caption.text) {
                  caption.text += '\n' + line;
                } else {
                  caption.text = line;
                }
              } else {
                captions.push(caption);
                state = S_ID;
              }
              break;
            }
        }
      }

      if (state === S_TEXT) {
        captions.push(caption);
      }

      return captions;
    };

    var build = function build(captions) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var content = '';
      var header = captions.find(function (caption) {
        return caption.type === 'header';
      });
      if (header) {
        content += header.text;
      } else {
        content += 'WEBVTT';
      }
      content += '\r\n\r\n';

      for (var i = 0; i < captions.length; i++) {
        var caption = captions[i];
        if (caption.type === 'caption') {
          if (caption.index) {
            content += caption.index;
            content += '\r\n';
          }
          content += helper.toTimeString(caption.start).replace(',', '.') + ' --> ' + helper.toTimeString(caption.end).replace(',', '.');
          content += '\r\n';
          content += caption.text;
          content += '\r\n\r\n';
        } else if (caption.type === 'style' && options.verbose) {
          content += 'STYLE';
          content += '\r\n';
          content += caption.text;
          content += '\r\n\r\n';
        } else if (caption.type === 'region' && options.verbose) {
          content += 'REGION';
          content += '\r\n';
          content += _extends({}, caption).text;
          content += '\r\n\r\n';
        }
      }
      return content;
    };

    var detect = function detect(content) {
      if (typeof content !== 'string') {
        return false;
      }
      return (/^WEBVTT/.test(content)
      );
    };

    module.exports = {
      parse: parse,
      build: build,
      detect: detect
    };

    /***/ })
    /******/ ]);
  };
  
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    var g = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this;
    g.subsrt = factory();
  }

})(this);