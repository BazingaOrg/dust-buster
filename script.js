// 存储书签数据
let allBookmarks = [];
let selectedSearchResultIndex = -1;
const searchResults = document.getElementById("searchResults");

const DEFAULT_ICON = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="%23666" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`;

// 安全的HTML转义函数
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 安全的URL解析
function safeParseUrl(url) {
  try {
    return new URL(url);
  } catch (e) {
    console.warn(`Invalid URL: ${url}`);
    return null;
  }
}

// 获取网站图标URL
function getFaviconUrl(url) {
  try {
    const parsedUrl = safeParseUrl(url);
    if (!parsedUrl) return DEFAULT_ICON;

    // 使用更可靠的 favicon 服务
    return {
      url: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`,
      fallbacks: [
        `https://icon.horse/icon/${parsedUrl.hostname}`,
        `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${parsedUrl.origin}&size=32`,
        DEFAULT_ICON,
      ],
    };
  } catch (e) {
    console.error("Error getting favicon:", e);
    return DEFAULT_ICON;
  }
}

// 处理图标加载错误
function handleImageError(img) {
  if (!img || !img.dataset.url) return;

  try {
    const faviconData = getFaviconUrl(img.dataset.url);
    if (typeof faviconData === "string") {
      img.src = faviconData;
      return;
    }

    const currentIndex = parseInt(img.dataset.fallbackIndex || "-1");
    const nextIndex = currentIndex + 1;

    if (nextIndex < faviconData.fallbacks.length) {
      img.dataset.fallbackIndex = nextIndex;
      img.src = faviconData.fallbacks[nextIndex];
    } else {
      img.onerror = null;
      img.src = DEFAULT_ICON;
      img.classList.add("default-icon"); // 添加样式标记
    }
  } catch (e) {
    console.error("Error handling image fallback:", e);
    img.onerror = null;
    img.src = DEFAULT_ICON;
    img.classList.add("default-icon");
  }
}

// 获取网站预览图URL
function getWebsitePreviewUrl(url) {
  try {
    const parsedUrl = safeParseUrl(url);
    if (!parsedUrl) return null;

    // 检查缓存
    try {
      const previewCache = JSON.parse(
        localStorage.getItem("previewCache") || "{}"
      );
      const cacheKey = url;

      // 缓存有效期为1天
      const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 1天的毫秒数

      // 如果存在有效缓存，直接返回
      if (
        previewCache[cacheKey] &&
        previewCache[cacheKey].timestamp > Date.now() - CACHE_EXPIRY &&
        previewCache[cacheKey].url
      ) {
        console.log(`Using cached preview for ${url}`);
        return previewCache[cacheKey].url;
      }
    } catch (cacheError) {
      console.warn("Error accessing preview cache:", cacheError);
      // 继续执行，不要因为缓存错误影响功能
    }

    // 没有缓存或缓存过期时，使用合适的备选方案
    // 针对不同网站使用不同的预览服务

    // 常见社交媒体、新闻和流行网站特殊处理，通常网站自己提供的预览图更可靠
    if (/youtube\.com|youtu\.be/.test(parsedUrl.hostname)) {
      // YouTube视频预览
      const videoId = parsedUrl.pathname.includes("watch")
        ? new URLSearchParams(parsedUrl.search).get("v")
        : parsedUrl.pathname.replace(/^\//, "");
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    }

    // 一般网站使用图像服务
    return `https://image.thum.io/get/width/400/crop/800/noanimate/${url}`;
  } catch (e) {
    console.error("Error getting website preview:", e);
    return null;
  }
}

// 更新预览图缓存
function updatePreviewCache(url, previewUrl) {
  try {
    if (!url || !previewUrl) return;

    const previewCache = JSON.parse(
      localStorage.getItem("previewCache") || "{}"
    );
    previewCache[url] = {
      url: previewUrl,
      timestamp: Date.now(),
    };

    // 缓存清理：仅保留最近100个缓存（减少存储负担）
    const urlKeys = Object.keys(previewCache);
    if (urlKeys.length > 100) {
      // 按时间戳排序
      urlKeys.sort(
        (a, b) => previewCache[a].timestamp - previewCache[b].timestamp
      );
      // 移除最旧的条目
      for (let i = 0; i < urlKeys.length - 100; i++) {
        delete previewCache[urlKeys[i]];
      }
    }

    localStorage.setItem("previewCache", JSON.stringify(previewCache));
  } catch (e) {
    console.error("Error updating preview cache:", e);
  }
}

// 尝试使用Open Graph获取预览图（备选方案）
async function getOgImage(url) {
  try {
    // 由于CORS限制，我们不能直接通过fetch获取外部网站内容
    // 这里我们直接返回null，改为使用backupImageService获取预览
    console.log("OG Image fetch not attempted due to CORS limitations");
    return null;
  } catch (e) {
    console.error("Error fetching OG image:", e);
    return null;
  }
}

// 使用备用图片服务
function backupImageService(url) {
  try {
    const parsedUrl = safeParseUrl(url);
    if (!parsedUrl) return null;

    // 尝试其他预览图服务 - 使用更可靠的参数
    return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${parsedUrl.origin}&size=128`;
  } catch (e) {
    console.error("Error using backup image service:", e);
    return null;
  }
}

// 处理预览图加载错误，尝试备选方案
function handlePreviewError(img, url) {
  if (!img || !url) return;

  img.style.display = "none"; // 隐藏出错的图片

  // 在预览图位置显示加载状态
  const previewContainer = img.parentElement;
  if (previewContainer) {
    previewContainer.classList.add("loading-preview");

    // 使用备用图片服务
    const backupUrl = backupImageService(url);

    if (backupUrl) {
      // 重置图片并使用备用图像
      img.src = backupUrl;
      img.style.display = "";
      // 更新事件处理，避免循环
      img.onerror = () => {
        img.style.display = "none";
        previewContainer.classList.remove("loading-preview");
        previewContainer.classList.add("no-preview");
      };
    } else {
      // 如果也没有备用图像，则显示无预览状态
      previewContainer.classList.remove("loading-preview");
      previewContainer.classList.add("no-preview");
    }
  }
}

// 展平书签树
function flattenBookmarks(bookmarkTree) {
  const result = [];
  function traverse(nodes) {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
      if (node.url) {
        result.push({
          id: node.id,
          title: node.title || "Untitled",
          url: node.url,
          dateAdded: node.dateAdded,
        });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  traverse(bookmarkTree);
  return result;
}

// 排序书签
function sortBookmarks(bookmarks) {
  if (!Array.isArray(bookmarks)) return [];

  return bookmarks.sort((a, b) => {
    const titleA = (a.title || "").toLowerCase();
    const titleB = (b.title || "").toLowerCase();
    return titleA.localeCompare(titleB);
  });
}

// 过滤书签
function filterBookmarks(query, updateUI = true) {
  if (!Array.isArray(allBookmarks)) return [];

  const filtered = query
    ? allBookmarks.filter(
        (bookmark) =>
          bookmark.title.toLowerCase().includes(query) ||
          bookmark.url.toLowerCase().includes(query)
      )
    : allBookmarks;

  if (updateUI) {
    renderBookmarks(filtered);
    updateBookmarkCount(filtered.length);
  }

  return filtered;
}

// 使用Intersection Observer优化预览图加载
let imageObserver;

function setupIntersectionObserver() {
  // 如果浏览器支持Intersection Observer
  if ("IntersectionObserver" in window) {
    imageObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          // 当预览图容器进入视口
          if (entry.isIntersecting) {
            const previewContainer = entry.target;
            const previewImage =
              previewContainer.querySelector(".preview-image");

            if (previewImage && previewImage.dataset.src && !previewImage.src) {
              // 设置图片src，开始加载
              previewImage.src = previewImage.dataset.src;

              // 停止观察这个元素
              observer.unobserve(previewContainer);
            }
          }
        });
      },
      {
        rootMargin: "200px 0px", // 提前200px开始加载
        threshold: 0.01, // 当元素有1%进入视口时触发
      }
    );
  }
}

// 键盘导航相关变量
let focusedBookmarkIndex = -1;
let visibleBookmarks = [];

// 更新键盘导航的书签列表
function updateNavigableBookmarks() {
  visibleBookmarks = Array.from(document.querySelectorAll(".bookmark-item"));
  // 如果之前有焦点，重新设置为第一个元素
  if (focusedBookmarkIndex !== -1) {
    focusedBookmarkIndex = 0;
    if (visibleBookmarks.length > 0) {
      setFocusedBookmark(0);
    }
  }
}

// 设置焦点书签
function setFocusedBookmark(index) {
  // 移除之前的焦点样式
  if (focusedBookmarkIndex !== -1 && visibleBookmarks[focusedBookmarkIndex]) {
    visibleBookmarks[focusedBookmarkIndex].classList.remove("keyboard-focus");
    visibleBookmarks[focusedBookmarkIndex].setAttribute("tabindex", "-1");
  }

  // 设置新的焦点
  focusedBookmarkIndex = index;

  if (index !== -1 && visibleBookmarks[index]) {
    visibleBookmarks[index].classList.add("keyboard-focus");
    visibleBookmarks[index].setAttribute("tabindex", "0");
    visibleBookmarks[index].focus();

    // 确保焦点元素在视口内
    visibleBookmarks[index].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }
}

// 处理键盘导航
function handleKeyboardNavigation(event) {
  // 如果搜索框有焦点，不进行书签导航
  if (document.activeElement === document.getElementById("searchInput")) {
    return;
  }

  // 如果没有可见书签，不进行处理
  if (visibleBookmarks.length === 0) return;

  switch (event.key) {
    case "ArrowRight":
      // 如果没有焦点项，设置第一个
      if (focusedBookmarkIndex === -1) {
        setFocusedBookmark(0);
      } else {
        // 计算下一个索引，循环到开头
        const nextIndex = (focusedBookmarkIndex + 1) % visibleBookmarks.length;
        setFocusedBookmark(nextIndex);
      }
      event.preventDefault();
      break;

    case "ArrowLeft":
      // 如果没有焦点项，设置最后一个
      if (focusedBookmarkIndex === -1) {
        setFocusedBookmark(visibleBookmarks.length - 1);
      } else {
        // 计算上一个索引，循环到末尾
        const prevIndex =
          (focusedBookmarkIndex - 1 + visibleBookmarks.length) %
          visibleBookmarks.length;
        setFocusedBookmark(prevIndex);
      }
      event.preventDefault();
      break;

    case "ArrowDown":
      // 计算下一行的同一列位置
      if (focusedBookmarkIndex !== -1) {
        // 获取当前网格列数
        const gridComputedStyle = window.getComputedStyle(
          document.querySelector(".bookmarks-grid")
        );
        const columnsMatch =
          gridComputedStyle.gridTemplateColumns.match(/1fr/g);
        const columns = columnsMatch ? columnsMatch.length : 6; // 默认6列

        const nextRowIndex = focusedBookmarkIndex + columns;
        if (nextRowIndex < visibleBookmarks.length) {
          setFocusedBookmark(nextRowIndex);
        }
        event.preventDefault();
      }
      break;

    case "ArrowUp":
      // 计算上一行的同一列位置
      if (focusedBookmarkIndex !== -1) {
        // 获取当前网格列数
        const gridComputedStyle = window.getComputedStyle(
          document.querySelector(".bookmarks-grid")
        );
        const columnsMatch =
          gridComputedStyle.gridTemplateColumns.match(/1fr/g);
        const columns = columnsMatch ? columnsMatch.length : 6; // 默认6列

        const prevRowIndex = focusedBookmarkIndex - columns;
        if (prevRowIndex >= 0) {
          setFocusedBookmark(prevRowIndex);
        }
        event.preventDefault();
      }
      break;

    case "Enter":
      // 打开焦点书签
      if (
        focusedBookmarkIndex !== -1 &&
        visibleBookmarks[focusedBookmarkIndex]
      ) {
        const url = visibleBookmarks[focusedBookmarkIndex].dataset.url;
        if (url) {
          window.open(url, "_blank");
        }
        event.preventDefault();
      }
      break;

    case "Escape":
      // 清除焦点
      if (focusedBookmarkIndex !== -1) {
        visibleBookmarks[focusedBookmarkIndex].classList.remove(
          "keyboard-focus"
        );
        visibleBookmarks[focusedBookmarkIndex].setAttribute("tabindex", "-1");
        focusedBookmarkIndex = -1;
        // 将焦点返回到搜索框
        document.getElementById("searchInput").focus();
        event.preventDefault();
      }
      break;
  }
}

// 渲染空状态
function renderEmptyState(container, message, iconType) {
  const icons = {
    bookmarks: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  };

  const icon = icons[iconType] || icons.bookmarks;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-message">${message}</div>
    </div>
  `;
}

// 添加动画效果管理器
const AnimationManager = {
  // 添加元素进入动画
  fadeIn: (element, delay = 0) => {
    if (!element) return;

    element.style.opacity = "0";
    element.style.transform = "translateY(20px)";
    element.style.transition = "opacity 0.5s ease, transform 0.5s ease";

    setTimeout(() => {
      element.style.opacity = "1";
      element.style.transform = "translateY(0)";
    }, delay);
  },

  // 添加书签项动画
  animateBookmarkItems: () => {
    const items = document.querySelectorAll(".bookmark-item");
    items.forEach((item, index) => {
      AnimationManager.fadeIn(item, index * 50);
    });
  },

  // 添加加载动画
  addLoadingAnimation: (element) => {
    if (!element) return;

    element.classList.add("loading-animation");
    const loader = document.createElement("div");
    loader.className = "loader-overlay";
    loader.innerHTML = `
      <div class="loader-spinner"></div>
    `;
    element.appendChild(loader);
  },

  // 移除加载动画
  removeLoadingAnimation: (element) => {
    if (!element) return;

    element.classList.remove("loading-animation");
    const loader = element.querySelector(".loader-overlay");
    if (loader) {
      loader.addEventListener("transitionend", () => loader.remove());
      loader.style.opacity = "0";
    }
  },
};

// 添加可访问性辅助函数
const A11yHelper = {
  // 添加ARIA标签
  setAriaLabels: () => {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.setAttribute("role", "searchbox");
      searchInput.setAttribute("aria-label", "搜索书签");
    }

    document.querySelectorAll(".bookmark-item").forEach((item) => {
      item.setAttribute("role", "link");
      item.setAttribute(
        "aria-label",
        `访问 ${item.querySelector(".bookmark-title").textContent}`
      );
    });
  },

  // 添加键盘快捷键
  setupKeyboardShortcuts: () => {
    document.addEventListener("keydown", (e) => {
      // Alt + / 聚焦搜索框
      if (e.key === "/" && e.altKey) {
        e.preventDefault();
        document.getElementById("searchInput")?.focus();
      }

      // Esc 清除搜索
      if (
        e.key === "Escape" &&
        document.activeElement === document.getElementById("searchInput")
      ) {
        handleClearSearch();
      }
    });
  },

  // 添加焦点指示器
  setupFocusIndicators: () => {
    // 添加焦点样式类
    document.body.classList.add("js-focus-visible");

    // 监听Tab键使用
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        document.body.classList.add("user-is-tabbing");
      }
    });

    // 监听鼠标使用
    document.addEventListener("mousedown", () => {
      document.body.classList.remove("user-is-tabbing");
    });
  },
};

// 修改renderBookmarks函数，移除复制和分享按钮
function renderBookmarks(bookmarksToShow) {
  const container = document.getElementById("bookmarksList");
  if (!container) return;

  try {
    // 处理空书签情况
    if (!bookmarksToShow || bookmarksToShow.length === 0) {
      renderEmptyState(
        container,
        "没有找到书签。通过浏览器添加书签后会显示在这里。",
        "bookmarks"
      );
      return;
    }

    // 添加加载动画
    AnimationManager.addLoadingAnimation(container);

    // 渲染书签内容
    container.innerHTML = bookmarksToShow
      .map((bookmark) => {
        const url = escapeHtml(bookmark.url);
        const title = escapeHtml(bookmark.title);
        const faviconData = getFaviconUrl(bookmark.url);
        const initialFaviconUrl =
          typeof faviconData === "string" ? faviconData : faviconData.url;
        const previewUrl = getWebsitePreviewUrl(bookmark.url);

        return `
          <div class="bookmark-item" data-url="${url}" tabindex="-1">
            <div class="bookmark-header">
              <div class="bookmark-icon">
                <img src="${initialFaviconUrl}" 
                     data-url="${url}"
                     data-fallback-index="-1"
                     alt="favicon" />
              </div>
              <div class="bookmark-content">
                <div class="bookmark-title">${title}</div>
                <div class="bookmark-url">${url}</div>
              </div>
            </div>
            ${
              previewUrl
                ? `
            <div class="bookmark-preview">
              <div class="preview-skeleton"></div>
              <img class="preview-image" 
                   alt="网站预览" 
                   data-src="${previewUrl}" 
                   data-url="${url}"
                   loading="lazy" />
            </div>`
                : `<div class="bookmark-preview no-preview"></div>`
            }
          </div>
        `;
      })
      .join("");

    // 移除加载动画并添加元素进入动画
    AnimationManager.removeLoadingAnimation(container);
    AnimationManager.animateBookmarkItems();

    // 为所有favicon图片添加错误处理
    container.querySelectorAll(".bookmark-icon img").forEach((img) => {
      img.addEventListener("error", () => handleImageError(img));
    });

    // 使用Intersection Observer观察所有预览图容器
    if (imageObserver) {
      container
        .querySelectorAll(".bookmark-preview:not(.no-preview)")
        .forEach((preview) => {
          imageObserver.observe(preview);
        });
    }

    // 为所有预览图添加事件监听器
    container.querySelectorAll(".preview-image").forEach((img) => {
      img.addEventListener("load", function () {
        if (this.parentElement) {
          this.parentElement.classList.add("loaded");
          this.parentElement.classList.add("ripple-effect");
          setTimeout(() => {
            this.parentElement.classList.remove("ripple-effect");
          }, 800);
        }

        const url = this.dataset.url;
        if (url && this.src) {
          updatePreviewCache(url, this.src);
        }
      });

      img.addEventListener("error", function () {
        const url = this.dataset.url;
        if (url) {
          handlePreviewError(this, url);
        }
      });
    });

    // 添加书签项点击事件处理
    container.querySelectorAll(".bookmark-item").forEach((item) => {
      // 点击事件和波纹效果
      item.addEventListener("click", (e) => {
        const ripple = document.createElement("span");
        ripple.classList.add("ripple");
        item.appendChild(ripple);

        const rect = item.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;

        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        setTimeout(() => {
          ripple.remove();
        }, 600);

        const url = item.dataset.url;
        if (url) {
          window.open(url, "_blank");
        }
      });
    });

    // 更新键盘导航的书签列表
    updateNavigableBookmarks();

    // 在渲染完成后更新ARIA标签
    A11yHelper.setAriaLabels();
  } catch (error) {
    console.error("Error rendering bookmarks:", error);
    renderEmptyState(container, "加载书签时出错，请刷新页面重试。", "error");
  }
}

// 更新书签计数
function updateBookmarkCount(count) {
  const countElement = document.getElementById("totalBookmarks");
  if (countElement) {
    countElement.textContent = count;
  }
}

// 搜索相关函数
function showSearchResults(query) {
  if (!searchResults) return;

  try {
    searchResults.innerHTML = "";
    selectedSearchResultIndex = -1;

    if (!query) {
      searchResults.classList.remove("visible");
      return;
    }

    const filtered = filterBookmarks(query, false);

    if (filtered.length === 0) {
      renderEmptyState(
        searchResults,
        `没有找到与 "${query}" 相关的书签。`,
        "search"
      );
      searchResults.classList.add("visible");
      return;
    }

    filtered.forEach((bookmark) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.dataset.url = bookmark.url;

      // 获取图标数据
      const faviconData = getFaviconUrl(bookmark.url);
      const initialFaviconUrl =
        typeof faviconData === "string" ? faviconData : faviconData.url;

      // 获取预览图
      const previewUrl = getWebsitePreviewUrl(bookmark.url);

      item.innerHTML = `
        <div class="search-result-header">
          <div class="bookmark-icon">
            <img src="${initialFaviconUrl}" 
                 data-url="${bookmark.url}"
                 data-fallback-index="-1"
                 alt="favicon" />
          </div>
          <div class="bookmark-content">
            <div class="title">${escapeHtml(bookmark.title)}</div>
            <div class="url">${escapeHtml(bookmark.url)}</div>
          </div>
        </div>
        ${
          previewUrl
            ? `
        <div class="search-result-preview">
          <div class="preview-skeleton"></div>
          <img src="${previewUrl}" 
               alt="网站预览" 
               class="preview-image" 
               data-url="${bookmark.url}"
               loading="lazy" />
        </div>`
            : ``
        }
      `;

      item.addEventListener("click", () => {
        window.open(bookmark.url, "_blank");
      });
      searchResults.appendChild(item);
    });

    // 为所有favicon图片添加错误处理
    searchResults.querySelectorAll(".bookmark-icon img").forEach((img) => {
      img.addEventListener("error", () => handleImageError(img));
    });

    // 为所有预览图添加加载成功处理，更新缓存
    searchResults.querySelectorAll(".preview-image").forEach((img) => {
      // 添加load事件监听器
      img.addEventListener("load", function () {
        // 加载成功后更新UI
        if (this.parentElement) {
          this.parentElement.classList.add("loaded");
        }

        // 更新缓存
        const url = this.dataset.url;
        if (url && this.src) {
          updatePreviewCache(url, this.src);
        }
      });

      // 添加error事件监听器
      img.addEventListener("error", function () {
        const url = this.dataset.url;
        if (url) {
          handlePreviewError(this, url);
        }
      });
    });

    searchResults.classList.add("visible");
  } catch (error) {
    console.error("Error showing search results:", error);
    searchResults.innerHTML = '<div class="error">Error showing results</div>';
  }
}

function updateSelection() {
  if (!searchResults) return;

  const items = searchResults.querySelectorAll(".search-result-item");
  if (!items.length) return;

  items.forEach((item, index) => {
    item.classList.toggle("selected", index === selectedSearchResultIndex);
  });

  if (
    selectedSearchResultIndex >= 0 &&
    selectedSearchResultIndex < items.length
  ) {
    items[selectedSearchResultIndex].scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }
}

// 主题相关函数
function initThemeSwitcher() {
  const themeBtns = document.querySelectorAll(".theme-btn");
  const html = document.documentElement;

  // 从 localStorage 获取保存的主题
  const savedTheme = localStorage.getItem("theme") || "system";
  setTheme(savedTheme, html);

  // 为每个主题按钮添加点击事件
  themeBtns.forEach((btn) => {
    const theme = btn.dataset.theme;

    // 设置初始激活状态
    if (theme === savedTheme) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      // 移除所有按钮的激活状态
      themeBtns.forEach((b) => b.classList.remove("active"));
      // 添加当前按钮的激活状态
      btn.classList.add("active");

      setTheme(theme, html);
    });
  });
}

function setTheme(theme, html) {
  localStorage.setItem("theme", theme);

  if (theme === "system") {
    // 移除手动设置的主题
    html.removeAttribute("data-theme");

    // 根据系统主题设置
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      html.setAttribute("data-theme", "dark");
    } else {
      html.setAttribute("data-theme", "light");
    }
  } else {
    html.setAttribute("data-theme", theme);
  }
}

// 监听系统主题变化
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    if (localStorage.getItem("theme") === "system") {
      setTheme("system", document.documentElement);
    }
  });

// 初始化应用
document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchInput");
  const clearButton = document.getElementById("clearSearch");

  if (!searchInput || !clearButton) {
    console.error("Required elements not found");
    return;
  }

  // 添加快捷键监听
  document.addEventListener("keydown", (e) => {
    // 检查是否按下 Command/Ctrl + K
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // 获取所有书签
  try {
    await initializeBookmarks();
  } catch (error) {
    handleError(error, "初始化应用");
  }

  // 初始化主题切换
  initThemeSwitcher();

  // 优化搜索防抖
  const debounce = (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const handleSearch = debounce((query) => {
    toggleClearButton(searchInput, clearButton);
    showSearchResults(query);
  }, 300);

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    handleSearch(query);
  });

  // 键盘导航
  searchInput.addEventListener("keydown", (e) => {
    const items = searchResults?.querySelectorAll(".search-result-item");
    if (!items?.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        selectedSearchResultIndex = Math.min(
          selectedSearchResultIndex + 1,
          items.length - 1
        );
        updateSelection();
        break;
      case "ArrowUp":
        e.preventDefault();
        selectedSearchResultIndex = Math.max(selectedSearchResultIndex - 1, -1);
        updateSelection();
        break;
      case "Enter":
        e.preventDefault();
        if (
          selectedSearchResultIndex >= 0 &&
          selectedSearchResultIndex < items.length
        ) {
          const selectedItem = items[selectedSearchResultIndex];
          const url = selectedItem.dataset.url;
          if (url) {
            window.open(url, "_blank");
            searchResults.classList.remove("visible");
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        searchResults.classList.remove("visible");
        searchInput.blur();
        break;
    }
  });

  // 点击外部关闭搜索结果
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      searchResults?.classList.remove("visible");
    }
  });

  // 清除按钮点击事件
  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    toggleClearButton(searchInput, clearButton);
    updateBookmarkCount(allBookmarks.length);
    searchResults?.classList.remove("visible");
    renderBookmarks(allBookmarks);
  });

  // 切换清除按钮显示状态
  function toggleClearButton(searchInput, clearButton) {
    if (!searchInput || !clearButton) return;
    clearButton.style.display = searchInput.value.trim() ? "flex" : "none";
  }

  // 初始化时隐藏清除按钮
  toggleClearButton(searchInput, clearButton);

  // 使用事件委托优化所有事件监听
  initEventListeners();
});

// 添加全局错误处理函数
function handleError(error, context) {
  console.error(`Error in ${context}:`, error);

  // 显示用户友好的错误消息
  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent = `出现了一些问题：${error.message}`;

  // 添加重试按钮
  const retryButton = document.createElement("button");
  retryButton.textContent = "重试";
  retryButton.onclick = () => window.location.reload();
  errorMessage.appendChild(retryButton);

  document.body.appendChild(errorMessage);
}

// 使用事件委托优化所有事件监听
function initEventListeners() {
  const container = document.querySelector(".container");

  // 统一处理点击事件
  container.addEventListener("click", (e) => {
    // 处理书签点击
    const bookmarkItem = e.target.closest(".bookmark-item");
    if (bookmarkItem) {
      const url = bookmarkItem.dataset.url;
      if (url) window.open(url, "_blank");
      return;
    }

    // 处理清除按钮点击
    if (e.target.closest("#clearSearch")) {
      handleClearSearch();
      return;
    }
  });

  // 统一处理触摸事件
  container.addEventListener("touchstart", (e) => {
    const item = e.target.closest(".bookmark-item");
    if (item) item.classList.add("active");
  });

  container.addEventListener("touchend", (e) => {
    const item = e.target.closest(".bookmark-item");
    if (item) item.classList.remove("active");
  });
}

// 清除搜索的处理函数
function handleClearSearch() {
  const searchInput = document.getElementById("searchInput");
  const clearButton = document.getElementById("clearSearch");

  searchInput.value = "";
  searchInput.focus();
  toggleClearButton(searchInput, clearButton);
  updateBookmarkCount(allBookmarks.length);
  searchResults?.classList.remove("visible");
  renderBookmarks(allBookmarks);
}

function showLoading(show = true) {
  const loadingEl =
    document.querySelector(".loading") || createLoadingElement();
  loadingEl.style.display = show ? "flex" : "none";
}

function createLoadingElement() {
  const loading = document.createElement("div");
  loading.className = "loading";
  loading.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">加载中...</div>
  `;
  document.body.appendChild(loading);
  return loading;
}

// 在获取书签时使用
async function initializeBookmarks() {
  try {
    showLoading(true);

    // 初始化功能
    init();

    // 获取书签
    chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
      try {
        allBookmarks = sortBookmarks(flattenBookmarks(bookmarkTreeNodes));
        updateBookmarkCount(allBookmarks.length);
        renderBookmarks(allBookmarks);
      } catch (error) {
        handleError(error, "初始化书签时出错");
      } finally {
        showLoading(false);
      }
    });
  } catch (error) {
    handleError(error, "初始化书签时出错");
    showLoading(false);
  }
}

// 修改init函数，添加可访问性初始化
function init() {
  setupIntersectionObserver();

  // 初始化事件监听
  initEventListeners();

  // 初始化可访问性功能
  A11yHelper.setAriaLabels();
  A11yHelper.setupKeyboardShortcuts();
  A11yHelper.setupFocusIndicators();

  // 添加主题切换按钮的可访问性
  const themeSwitcher = document.querySelector(".theme-switcher");
  if (themeSwitcher) {
    themeSwitcher.setAttribute("role", "radiogroup");
    themeSwitcher.setAttribute("aria-label", "选择主题");

    themeSwitcher.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", btn.classList.contains("active"));
    });
  }

  // 监听主题变化
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addListener((e) => {
    const theme = e.matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeButtons(theme);
  });
}

// 更新主题按钮状态
function updateThemeButtons(theme) {
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    const isActive = btn.dataset.theme === theme;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", isActive);
  });
}

// 修改showToast函数，添加可访问性支持
function showToast(message, duration = 3000) {
  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => {
      toast.remove();
    });
  }, duration);
}
