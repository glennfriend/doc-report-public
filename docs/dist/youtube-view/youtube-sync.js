(function () {
  var SPLIT_STORAGE_KEY = "youtube-sync-subtitle-width-v2";

  function renderAppShell(root) {
    root.innerHTML = [
      "<section class='hero'>",
      "  <div class='panel video-panel'>",
      "    <div class='video-frame'>",
      "      <div id='player'></div>",
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

    let player;
    let rafId = 0;
    let lastActiveSecond = -1;

    function syncTimeline() {
      if (!player || typeof player.getCurrentTime !== "function") {
        rafId = window.requestAnimationFrame(syncTimeline);
        return;
      }

      const state = typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;
      if (state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.BUFFERING) {
        const currentSeconds = Math.floor(player.getCurrentTime());
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
        if (player && typeof player.seekTo === "function") {
          player.seekTo(seconds, true);
          player.playVideo();
          setActive(buttons, seconds, { keepInView: timeline });
        }
      });
    });

    loadYoutubeApi(function () {
      player = new window.YT.Player("player", {
        videoId: config.videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: 0
        },
        events: {
          onReady: function () {
            setActive(buttons, 0, { keepInView: timeline });
            if (!rafId) {
              rafId = window.requestAnimationFrame(syncTimeline);
            }
          }
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
