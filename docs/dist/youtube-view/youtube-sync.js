(function () {
  var SPLIT_STORAGE_KEY = "youtube-sync-subtitle-width-v2";
  var CC_STORAGE_KEY = "youtube-sync-cc-overlay-v1";
  var SKIP_SECONDS = 10;
  var ARROW_SKIP_SECONDS = 5;
  var VOLUME_STEP = 5;
  var FALLBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // 自製控制列圖示 (YouTube 新版 embed 只剩進度列/全螢幕, 沒有音量/速度, 所以控制列自己做)
  var ICONS = {
    play: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M8 5v14l11-7z'/></svg>",
    pause: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 5h4v14H6zM14 5h4v14h-4z'/></svg>",
    volume: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z'/></svg>",
    muted: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z'/></svg>",
    fullscreen: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zM5 14h2v3h3v2H5zm12 0h2v5h-5v-2h3z'/></svg>",
    exitFullscreen: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M8 5h2v5H5V8h3zm6 0h2v3h3v2h-5zM5 14h5v5H8v-3H5zm9 0h5v2h-3v3h-2z'/></svg>"
  };

  // YT IFrame player 參數預設值; spec 可用 playerVars 覆寫個別項目
  // 註: modestbranding 已被 YouTube 廢除 (2023), 傳了也沒作用, 故不再設定
  var DEFAULT_PLAYER_VARS = {
    autoplay: 0,
    controls: 1,
    rel: 0,               // 結束畫面推薦限制在同頻道 (YouTube 已無法完全關閉)
    playsinline: 1,
    start: 0,
    hl: "zh-TW",          // 播放器介面語言
    cc_load_policy: 1,    // 預設開啟原生字幕 (原文)
    iv_load_policy: 3     // 關掉浮動註解
    // 註: 刻意不設 cc_lang_pref, 讓原生 CC 維持影片原文;
    //     繁中由 spec.subtitles + 自製 overlay 疊在上面 (要改再從 spec.playerVars 覆寫)
  };

  function buildPlayerVars(overrides) {
    var result = {};
    Object.keys(DEFAULT_PLAYER_VARS).forEach(function (key) {
      result[key] = DEFAULT_PLAYER_VARS[key];
    });
    if (overrides && typeof overrides === "object") {
      Object.keys(overrides).forEach(function (key) {
        result[key] = overrides[key];
      });
    }
    return result;
  }

  function renderAppShell(root) {
    root.innerHTML = [
      "<section class='hero'>",
      "  <div class='panel video-panel'>",
      "    <div class='video-frame'>",
      "      <div id='player'></div>",
      "      <div class='cc-overlay' data-role='cc-overlay' hidden><span class='cc-overlay-text' data-role='cc-overlay-text'></span></div>",
      "    </div>",
      "    <div class='video-toolbar' data-role='video-toolbar'>",
      "      <div class='vc-group'>",
      "        <button type='button' class='vc-btn' data-role='vc-play' aria-label='播放 (K)' title='播放 (K)'>" + ICONS.play + "</button>",
      "        <button type='button' class='vc-btn vc-skip' data-role='vc-back' aria-label='倒退 10 秒 (J)' title='倒退 10 秒 (J)'>-10s</button>",
      "        <button type='button' class='vc-btn vc-skip' data-role='vc-forward' aria-label='快轉 10 秒 (L)' title='快轉 10 秒 (L)'>+10s</button>",
      "        <button type='button' class='vc-btn' data-role='vc-mute' aria-label='靜音 (M)' title='靜音 (M)'>" + ICONS.volume + "</button>",
      "        <input type='range' class='vc-volume' data-role='vc-volume' min='0' max='100' step='1' value='100' aria-label='音量'>",
      "        <span class='vc-volume-value' data-role='vc-volume-value'>100</span>",
      "      </div>",
      "      <div class='vc-group'>",
      "        <select class='vc-rate' data-role='vc-rate' aria-label='播放速度' title='播放速度 (&lt; &gt;)'></select>",
      "        <button type='button' class='cc-toggle' data-role='cc-toggle' aria-pressed='true' hidden>繁中字幕</button>",
      "        <button type='button' class='vc-btn' data-role='vc-fullscreen' aria-label='全螢幕 (F)' title='全螢幕 (F)'>" + ICONS.fullscreen + "</button>",
      "      </div>",
      "    </div>",
      "  </div>",
      "  <button type='button' class='splitter' data-role='splitter' aria-label='調整影片與字幕寬度' aria-orientation='vertical' aria-valuemin='20' aria-valuemax='45' aria-valuenow='34'>",
      "    <span class='splitter-line' aria-hidden='true'></span>",
      "    <span class='splitter-badge' data-role='splitter-status'>影片 66% | 字幕 34%</span>",
      "  </button>",
      "  <aside class='panel subtitle-panel'>",
      "    <div class='timeline-list' data-role='timeline'></div>",
      "  </aside>",
      "</section>",
      "<section class='content-grid'>",
      "  <aside class='sidebar'>",
      "    <section class='panel section'>",
      "      <h2>文章標籤</h2>",
      "      <div class='tag-list' data-role='tags'></div>",
      "    </section>",
      "    <section class='panel section'>",
      "      <h2>重點論述</h2>",
      "      <div data-role='key-points'></div>",
      "    </section>",
      "  </aside>",
      "</section>",
      "<section class='panel hero-copy'>",
      "  <h1 data-role='title'></h1>",
      "  <p class='summary' data-role='summary'></p>",
      "  <div class='meta-list'>",
      "    <div class='meta-item'>",
      "      <span class='meta-label'>更新日期</span>",
      "      <span class='meta-value' data-role='updated-at'></span>",
      "    </div>",
      "    <div class='meta-item'>",
      "      <span class='meta-label'>影片來源</span>",
      "      <a class='meta-value' data-role='source-link' target='_blank' rel='noreferrer'></a>",
      "    </div>",
      "  </div>",
      "</section>"
    ].join("");
  }

  function renderTimeline(root, items) {
    const timeline = root.querySelector("[data-role='timeline']");
    const buttons = [];

    items.forEach(function (item, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-item";
      button.dataset.index = String(index);
      button.dataset.seconds = String(item.seconds);
      button.innerHTML = [
        "<span class='timeline-time'>" + item.time + "</span>",
        "<p class='timeline-text'>" + item.text + "</p>"
      ].join("");
      timeline.appendChild(button);
      buttons.push(button);
    });

    return buttons;
  }

  function renderKeyPoints(root, sections) {
    const container = root.querySelector("[data-role='key-points']");

    sections.forEach(function (section) {
      const article = document.createElement("article");
      article.innerHTML = "<h3>" + section.title + "</h3>";
      const list = document.createElement("ul");

      section.items.forEach(function (item) {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        list.appendChild(listItem);
      });

      article.appendChild(list);
      container.appendChild(article);
    });
  }

  function renderTags(root, tags) {
    const container = root.querySelector("[data-role='tags']");
    tags.forEach(function (tag) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      container.appendChild(span);
    });
  }

  function keepActiveLineInView(container, activeButton) {
    if (!container || !activeButton) {
      return;
    }

    const itemTop = activeButton.offsetTop;
    const itemBottom = itemTop + activeButton.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const padding = 24;
    const preferredTopOffset = Math.max(72, Math.min(140, container.clientHeight * 0.22));
    const desiredTop = Math.max(0, itemTop - preferredTopOffset);
    const desiredBottom = desiredTop + container.clientHeight;

    if (itemTop < viewTop + preferredTopOffset - padding) {
      container.scrollTo({ top: desiredTop, behavior: "smooth" });
      return;
    }

    if (itemBottom > viewBottom - padding || itemBottom > desiredBottom) {
      container.scrollTo({ top: desiredTop, behavior: "smooth" });
    }
  }

  function setActive(buttons, currentSeconds, options) {
    const settings = options || {};
    let activeIndex = 0;

    for (let index = 0; index < buttons.length; index += 1) {
      const itemSeconds = Number(buttons[index].dataset.seconds);
      const nextSeconds = index + 1 < buttons.length ? Number(buttons[index + 1].dataset.seconds) : Number.POSITIVE_INFINITY;
      if (currentSeconds >= itemSeconds && currentSeconds < nextSeconds) {
        activeIndex = index;
        break;
      }
      if (currentSeconds >= itemSeconds) {
        activeIndex = index;
      }
    }

    buttons.forEach(function (button, index) {
      const isActive = index === activeIndex;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-current", isActive ? "true" : "false");
    });

    const activeButton = buttons[activeIndex];
    if (settings.keepInView && activeButton) {
      keepActiveLineInView(settings.keepInView, activeButton);
    }
  }

  function loadYoutubeApi(onReady) {
    if (window.YT && typeof window.YT.Player === "function") {
      onReady();
      return;
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previous === "function") {
        previous();
      }
      onReady();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // 把 spec.subtitles 正規化成排序好的 cue; 資料不合法就整條丟掉 (寧可少顯示也不要錯位)
  function normalizeCues(rawCues) {
    if (!Array.isArray(rawCues)) {
      return [];
    }

    return rawCues
      .filter(function (cue) {
        return cue
          && typeof cue.start === "number" && Number.isFinite(cue.start)
          && typeof cue.end === "number" && Number.isFinite(cue.end)
          && cue.end > cue.start
          && typeof cue.zh === "string" && cue.zh !== "";
      })
      .map(function (cue) {
        return { start: cue.start, end: cue.end, zh: cue.zh };
      })
      .sort(function (a, b) {
        return a.start - b.start;
      });
  }

  // 二分搜尋: 回傳 currentTime 落在哪一條 cue, 落在空隙回 -1
  function findCueIndex(cues, currentTime) {
    var low = 0;
    var high = cues.length - 1;

    while (low <= high) {
      var mid = (low + high) >> 1;
      if (currentTime < cues[mid].start) {
        high = mid - 1;
      } else if (currentTime >= cues[mid].end) {
        low = mid + 1;
      } else {
        return mid;
      }
    }

    return -1;
  }

  function setupCcOverlay(root, cues) {
    var overlay = root.querySelector("[data-role='cc-overlay']");
    var text = root.querySelector("[data-role='cc-overlay-text']");
    var toggle = root.querySelector("[data-role='cc-toggle']");
    var enabled = true;
    var lastIndex = -2;

    // 沒有繁中字幕資料就完全不出現 toggle, 只留 YouTube 原生字幕
    if (!overlay || !toggle || cues.length === 0) {
      return { update: function () {} };
    }

    try {
      enabled = window.localStorage.getItem(CC_STORAGE_KEY) !== "off";
    } catch (error) {
      enabled = true;
    }

    function apply() {
      toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
      overlay.hidden = !enabled;
      if (!enabled) {
        text.innerHTML = "";
        lastIndex = -2;
      }
    }

    toggle.hidden = false;
    apply();

    toggle.addEventListener("click", function () {
      enabled = !enabled;
      try {
        window.localStorage.setItem(CC_STORAGE_KEY, enabled ? "on" : "off");
      } catch (error) {
      }
      apply();
    });

    return {
      update: function (currentTime) {
        if (!enabled) {
          return;
        }

        var index = findCueIndex(cues, currentTime);
        if (index === lastIndex) {
          return;
        }

        lastIndex = index;
        // zh 為自產內容, 沿用 timeline 同樣的 innerHTML render;
        // 內含 <span class="learn"> 標出該句刻意保留的英文學習字
        text.innerHTML = index === -1 ? "" : cues[index].zh;
      }
    };
  }

  function setupSplitter(root) {
    var hero = root.querySelector(".hero");
    var splitter = root.querySelector("[data-role='splitter']");
    var badge = root.querySelector("[data-role='splitter-status']");

    if (!hero || !splitter || !badge) {
      return;
    }

    function bounds() {
      var heroWidth = hero.clientWidth;
      return {
        min: Math.max(260, Math.round(heroWidth * 0.22)),
        max: Math.max(320, Math.round(heroWidth * 0.42))
      };
    }

    function updateBadge(subtitleWidth) {
      var gap = 24;
      var total = hero.clientWidth - gap - splitter.offsetWidth;
      var safeTotal = total > 0 ? total : hero.clientWidth;
      var subtitlePercent = Math.round((subtitleWidth / safeTotal) * 100);
      var videoPercent = 100 - subtitlePercent;
      badge.textContent = "影片 " + videoPercent + "% | 字幕 " + subtitlePercent + "%";
      splitter.setAttribute("aria-valuenow", String(subtitlePercent));
      splitter.setAttribute("aria-valuetext", badge.textContent);
    }

    function applyWidth(rawWidth) {
      var limit = bounds();
      var subtitleWidth = clamp(Math.round(rawWidth), limit.min, limit.max);
      root.style.setProperty("--subtitle-width", subtitleWidth + "px");
      updateBadge(subtitleWidth);
      try {
        window.localStorage.setItem(SPLIT_STORAGE_KEY, String(subtitleWidth));
      } catch (error) {
      }
    }

    function currentWidth() {
      var value = window.getComputedStyle(root).getPropertyValue("--subtitle-width").trim();
      return Number.parseFloat(value) || Math.round(hero.clientWidth * 0.34);
    }

    function restoreWidth() {
      var storedWidth;
      try {
        storedWidth = Number.parseFloat(window.localStorage.getItem(SPLIT_STORAGE_KEY) || "");
      } catch (error) {
        storedWidth = NaN;
      }

      applyWidth(Number.isFinite(storedWidth) ? storedWidth : currentWidth());
    }

    function pointerMove(event) {
      var heroRect = hero.getBoundingClientRect();
      var nextWidth = heroRect.right - event.clientX;
      applyWidth(nextWidth);
    }

    function pointerUp() {
      splitter.classList.remove("is-dragging");
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
    }

    splitter.addEventListener("pointerdown", function (event) {
      if (window.matchMedia("(max-width: 480px)").matches) {
        return;
      }

      event.preventDefault();
      splitter.classList.add("is-dragging");
      splitter.setPointerCapture(event.pointerId);
      window.addEventListener("pointermove", pointerMove);
      window.addEventListener("pointerup", pointerUp);
    });

    splitter.addEventListener("keydown", function (event) {
      var step = event.shiftKey ? 24 : 12;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      applyWidth(currentWidth() + (event.key === "ArrowLeft" ? step : -step));
    });

    window.addEventListener("resize", restoreWidth);
    restoreWidth();
  }

  function isPlayingState(state) {
    return state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.BUFFERING;
  }

  function formatRate(rate) {
    return rate === 1 ? "正常" : rate + "x";
  }

  // 自製控制列: 播放/暫停, ±10 秒, 靜音, 音量, 速度, 全螢幕, 鍵盤快捷鍵 (仿 youtube.com)
  // getPlayer() 在 player 還沒 ready 前回 null, 這時所有操作直接略過
  function setupPlayerControls(root, getPlayer) {
    var panel = root.querySelector(".video-panel");
    var playButton = root.querySelector("[data-role='vc-play']");
    var backButton = root.querySelector("[data-role='vc-back']");
    var forwardButton = root.querySelector("[data-role='vc-forward']");
    var muteButton = root.querySelector("[data-role='vc-mute']");
    var volumeInput = root.querySelector("[data-role='vc-volume']");
    var volumeValue = root.querySelector("[data-role='vc-volume-value']");
    var rateSelect = root.querySelector("[data-role='vc-rate']");
    var fullscreenButton = root.querySelector("[data-role='vc-fullscreen']");

    function setLabel(button, label, icon) {
      button.innerHTML = icon;
      button.setAttribute("aria-label", label);
      button.title = label;
    }

    function syncPlayState(state) {
      var playing = isPlayingState(state);
      setLabel(playButton, playing ? "暫停 (K)" : "播放 (K)", playing ? ICONS.pause : ICONS.play);
    }

    function syncVolume() {
      var player = getPlayer();
      if (!player) {
        return;
      }
      var muted = player.isMuted();
      var volume = player.getVolume();
      volumeInput.value = String(muted ? 0 : volume);
      volumeValue.textContent = muted ? "0" : String(volume);
      setLabel(muteButton, muted ? "取消靜音 (M)" : "靜音 (M)", muted || volume === 0 ? ICONS.muted : ICONS.volume);
    }

    function syncRate() {
      var player = getPlayer();
      if (!player) {
        return;
      }
      rateSelect.value = String(player.getPlaybackRate());
    }

    function fillRates() {
      var player = getPlayer();
      var rates = player && player.getAvailablePlaybackRates();
      if (!Array.isArray(rates) || rates.length === 0) {
        rates = FALLBACK_RATES;
      }
      rateSelect.innerHTML = "";
      rates.forEach(function (rate) {
        var option = document.createElement("option");
        option.value = String(rate);
        option.textContent = formatRate(rate);
        rateSelect.appendChild(option);
      });
      syncRate();
    }

    function togglePlay() {
      var player = getPlayer();
      if (!player) {
        return;
      }
      if (isPlayingState(player.getPlayerState())) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }

    function skip(delta) {
      var player = getPlayer();
      if (!player) {
        return;
      }
      var duration = player.getDuration() || Number.POSITIVE_INFINITY;
      player.seekTo(clamp(player.getCurrentTime() + delta, 0, duration), true);
    }

    function toggleMute() {
      var player = getPlayer();
      if (!player) {
        return;
      }
      if (player.isMuted()) {
        player.unMute();
        if (player.getVolume() === 0) {
          player.setVolume(VOLUME_STEP * 4);
        }
      } else {
        player.mute();
      }
      // YT API 的 mute/unMute 是非同步送進 iframe, 稍後再讀回實際狀態
      window.setTimeout(syncVolume, 150);
    }

    function setVolume(volume) {
      var player = getPlayer();
      if (!player) {
        return;
      }
      var next = clamp(Math.round(volume), 0, 100);
      player.setVolume(next);
      if (next > 0 && player.isMuted()) {
        player.unMute();
      }
      volumeInput.value = String(next);
      volumeValue.textContent = String(next);
      setLabel(muteButton, "靜音 (M)", next === 0 ? ICONS.muted : ICONS.volume);
    }

    function stepRate(direction) {
      var options = Array.prototype.map.call(rateSelect.options, function (option) {
        return Number(option.value);
      });
      var index = options.indexOf(Number(rateSelect.value));
      var next = options[clamp(index + direction, 0, options.length - 1)];
      var player = getPlayer();
      if (player && next !== undefined) {
        player.setPlaybackRate(next);
        rateSelect.value = String(next);
      }
    }

    function toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (panel.requestFullscreen) {
        // 整個 video-panel 進全螢幕, 繁中字幕 overlay 與控制列都跟著進去
        panel.requestFullscreen();
      }
    }

    playButton.addEventListener("click", togglePlay);
    backButton.addEventListener("click", function () { skip(-SKIP_SECONDS); });
    forwardButton.addEventListener("click", function () { skip(SKIP_SECONDS); });
    muteButton.addEventListener("click", toggleMute);
    volumeInput.addEventListener("input", function () { setVolume(Number(volumeInput.value)); });
    rateSelect.addEventListener("change", function () {
      var player = getPlayer();
      if (player) {
        player.setPlaybackRate(Number(rateSelect.value));
      }
    });
    fullscreenButton.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", function () {
      var active = document.fullscreenElement === panel;
      setLabel(fullscreenButton, active ? "離開全螢幕 (F)" : "全螢幕 (F)", active ? ICONS.exitFullscreen : ICONS.fullscreen);
    });

    // 鍵盤快捷鍵 (焦點在 iframe 內時由 YouTube 自己處理); 輸入元件與已被處理過的按鍵 (如 splitter 方向鍵) 不攔
    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var tag = target && target.tagName;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || (target && target.isContentEditable)) {
        return;
      }

      var key = event.key;
      var handled = true;
      if (key === " " && tag === "BUTTON") {
        return;
      }
      if (key === " " || key === "k" || key === "K") {
        togglePlay();
      } else if (key === "j" || key === "J") {
        skip(-SKIP_SECONDS);
      } else if (key === "l" || key === "L") {
        skip(SKIP_SECONDS);
      } else if (key === "ArrowLeft") {
        skip(-ARROW_SKIP_SECONDS);
      } else if (key === "ArrowRight") {
        skip(ARROW_SKIP_SECONDS);
      } else if (key === "ArrowUp") {
        setVolume(Number(volumeInput.value) + VOLUME_STEP);
      } else if (key === "ArrowDown") {
        setVolume(Number(volumeInput.value) - VOLUME_STEP);
      } else if (key === "m" || key === "M") {
        toggleMute();
      } else if (key === "f" || key === "F") {
        toggleFullscreen();
      } else if (key === "<" || key === ",") {
        stepRate(-1);
      } else if (key === ">" || key === ".") {
        stepRate(1);
      } else {
        handled = false;
      }

      if (handled) {
        event.preventDefault();
      }
    });

    fillRates();

    return {
      onReady: function () {
        fillRates();
        syncVolume();
      },
      onStateChange: syncPlayState,
      onRateChange: syncRate
    };
  }

  function bootstrap() {
    const config = window.YOUTUBE_SYNC_CONFIG;
    if (!config) {
      return;
    }

    const root = document.querySelector("[data-youtube-sync-app]");
    if (!root) {
      return;
    }

    renderAppShell(root);

    document.title = config.title;
    root.querySelector("[data-role='title']").textContent = config.title;
    root.querySelector("[data-role='summary']").textContent = config.summary;
    root.querySelector("[data-role='updated-at']").textContent = config.updatedAt;
    root.querySelector("[data-role='source-link']").href = config.videoUrl;
    root.querySelector("[data-role='source-link']").textContent = config.videoUrl;
    setupSplitter(root);

    renderTags(root, config.tags);
    renderKeyPoints(root, config.keyPoints);
    const buttons = renderTimeline(root, config.timeline);
    const timeline = root.querySelector("[data-role='timeline']");
    const ccOverlay = setupCcOverlay(root, normalizeCues(config.subtitles));

    let player;
    let playerReady = false;
    let rafId = 0;
    let lastActiveSecond = -1;
    const controls = setupPlayerControls(root, function () {
      return playerReady ? player : null;
    });

    function syncTimeline() {
      if (!player || typeof player.getCurrentTime !== "function") {
        rafId = window.requestAnimationFrame(syncTimeline);
        return;
      }

      const state = typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;
      if (state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.BUFFERING) {
        const currentTime = player.getCurrentTime();
        // 字幕要次秒精度, timeline 高亮維持整秒節流
        ccOverlay.update(currentTime);

        const currentSeconds = Math.floor(currentTime);
        if (currentSeconds !== lastActiveSecond) {
          lastActiveSecond = currentSeconds;
          setActive(buttons, currentSeconds, { keepInView: timeline });
        }
      }

      rafId = window.requestAnimationFrame(syncTimeline);
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        const seconds = Number(button.dataset.seconds);
        if (!playerReady) {
          return;
        }

        // 點時間軸只跳時間, 播放狀態維持原樣: 播放中繼續播, 停著就停在新位置
        const state = player.getPlayerState();
        if (isPlayingState(state) || state === window.YT.PlayerState.PAUSED) {
          // 官方行為: 播放中 seekTo 會繼續播, 暫停中 seekTo 會維持暫停
          player.seekTo(seconds, true);
        } else {
          // 還沒開始 / cued / 已結束: seekTo 會自動開播, 改用 cue 停在新位置等使用者按播放
          player.cueVideoById({ videoId: config.videoId, startSeconds: seconds });
        }
        lastActiveSecond = seconds;
        setActive(buttons, seconds, { keepInView: timeline });
      });
    });

    loadYoutubeApi(function () {
      player = new window.YT.Player("player", {
        videoId: config.videoId,
        playerVars: buildPlayerVars(config.playerVars),
        events: {
          onReady: function () {
            playerReady = true;
            controls.onReady();
            setActive(buttons, 0, { keepInView: timeline });
            if (!rafId) {
              rafId = window.requestAnimationFrame(syncTimeline);
            }
          },
          onStateChange: function (event) {
            controls.onStateChange(event.data);
          },
          onPlaybackRateChange: function () {
            controls.onRateChange();
          }
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
