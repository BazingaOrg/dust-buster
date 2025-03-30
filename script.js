// 检查是否已经有打开的标签页
async function checkExistingTab() {
    try {
        const tabs = await chrome.tabs.query({});
        const currentTab = await chrome.tabs.getCurrent();
        
        // 获取扩展的URL
        const extensionUrl = chrome.runtime.getURL('index.html');
        
        // 查找已存在的灰不了标签页
        const existingTab = tabs.find(tab => {
            if (!tab.url || tab.id === currentTab.id || tab.active) {
                return false;
            }
            return tab.url === extensionUrl;
        });
        
        if (existingTab) {
            // 如果找到已存在的标签页，激活它
            await chrome.tabs.update(existingTab.id, { active: true });
            // 关闭当前标签页
            if (currentTab) {
                await chrome.tabs.remove(currentTab.id);
            }
            return true;
        }
    } catch (error) {
        console.error('Error checking existing tab:', error);
    }
    return false;
}

// 在页面加载时检查
document.addEventListener('DOMContentLoaded', async () => {
    const hasExistingTab = await checkExistingTab();
    if (hasExistingTab) {
        return; // 如果找到已存在的标签页，不继续初始化
    }
    init(); // 否则继续初始化
});

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
    return `https://image.thum.io/get/width/400/noanimate/${url}`;
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

  // 保存原始类名
  const originalClasses = container.className;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-message">${message}</div>
    </div>
  `;

  // 恢复原始类名
  container.className = originalClasses;
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

// 添加一个标志变量来跟踪是否正在处理点击事件
let isProcessingClick = false;

// 修改renderBookmarks函数，移除复制和分享按钮
function renderBookmarks(bookmarksToShow) {
  const container = document.getElementById("bookmarksList");
  if (!container) return;

  try {
    // 确保容器有正确的类名
    if (!container.classList.contains("bookmarks-grid")) {
      container.classList.add("bookmarks-grid");
    }

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

    // 同时更新主书签列表
    if (query) {
      const filtered = filterBookmarks(query, false);
      renderBookmarks(filtered);
      updateBookmarkCount(filtered.length);
    } else {
      renderBookmarks(allBookmarks);
      updateBookmarkCount(allBookmarks.length);
    }
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

  // 不在这里调用initEventListeners，避免重复添加事件监听器
  // initEventListeners();
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
    console.log("Container click event", e.target);

    // 如果已经在处理点击事件，则直接返回
    if (isProcessingClick) {
      console.log("Already processing click, ignoring");
      return;
    }

    // 处理书签点击
    const bookmarkItem = e.target.closest(
      ".bookmark-item, .search-result-item"
    );
    if (bookmarkItem) {
      // 标记正在处理点击事件
      isProcessingClick = true;

      // 阻止事件传播
      e.stopPropagation();

      // 添加波纹效果
      const ripple = document.createElement("span");
      ripple.classList.add("ripple");
      bookmarkItem.appendChild(ripple);

      const rect = bookmarkItem.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;

      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      // 移除波纹效果
      setTimeout(() => {
        ripple.remove();
      }, 600);

      // 打开URL
      const url = bookmarkItem.dataset.url;
      if (url) {
        console.log("Opening URL:", url);
        window.open(url, "_blank");
      }

      // 设置一个短暂的超时，避免事件重复触发
      setTimeout(() => {
        isProcessingClick = false;
      }, 100);

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
  
  // 移除对initSettingsEvents函数的调用
}

// 初始化设置相关事件
function initSettingsEvents() {
  // 空函数，保留接口兼容性
  return;
}

// 空函数，保留接口兼容性
function loadSettings() {
  return;
}

// 空函数，保留接口兼容性
function saveSettings() {
  return;
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

// Fluid Cursor
function initFluidCursor() {
  const canvas = document.getElementById('fluid');
  resizeCanvas();
  
  // @ts-nocheck
  if (!canvas) {
    console.warn("Fluid canvas element not found");
    return;
  }

  let config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1440,
    CAPTURE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 4.0,
    VELOCITY_DISSIPATION: 2.0,
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 30,
    SPLAT_RADIUS: 0.25,
    SPLAT_FORCE: 8000,
    SHADING: true,
    COLOR_UPDATE_SPEED: 10,
    PAUSED: false,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    TRANSPARENT: true,
  };

  function pointerPrototype() {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    this.color = [0, 0, 0];
  }

  const pointers = [];
  pointers.push(new pointerPrototype());

  // 获取WebGL上下文
  function getWebGLContext(canvas) {
    const params = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    };

    let gl = canvas.getContext("webgl2", params);
    const isWebGL2 = !!gl;
    if (!isWebGL2)
      gl =
        canvas.getContext("webgl", params) ||
        canvas.getContext("experimental-webgl", params);

    let halfFloat;
    let supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension("EXT_color_buffer_float");
      supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
    } else {
      halfFloat = gl.getExtension("OES_texture_half_float");
      supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const halfFloatTexType = isWebGL2
      ? gl.HALF_FLOAT
      : halfFloat.HALF_FLOAT_OES;
    let formatRGBA;
    let formatRG;
    let formatR;

    if (isWebGL2) {
      formatRGBA = getSupportedFormat(
        gl,
        gl.RGBA16F,
        gl.RGBA,
        halfFloatTexType
      );
      formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    return {
      gl,
      ext: {
        formatRGBA,
        formatRG,
        formatR,
        halfFloatTexType,
        supportLinearFiltering,
      },
    };
  }

  function getSupportedFormat(gl, internalFormat, format, type) {
    if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
      switch (internalFormat) {
        case gl.R16F:
          return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
        case gl.RG16F:
          return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
        default:
          return null;
      }
    }

    return {
      internalFormat,
      format,
    };
  }

  function supportRenderTextureFormat(gl, internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      4,
      4,
      0,
      format,
      type,
      null
    );

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status == gl.FRAMEBUFFER_COMPLETE;
  }

  class Material {
    constructor(vertexShader, fragmentShaderSource) {
      this.vertexShader = vertexShader;
      this.fragmentShaderSource = fragmentShaderSource;
      this.programs = [];
      this.activeProgram = null;
      this.uniforms = [];
    }

    setKeywords(keywords) {
      let hash = 0;
      for (let i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);

      let program = this.programs[hash];
      if (program == null) {
        let fragmentShader = compileShader(
          gl.FRAGMENT_SHADER,
          this.fragmentShaderSource,
          keywords
        );
        program = createProgram(this.vertexShader, fragmentShader);
        this.programs[hash] = program;
      }

      if (program == this.activeProgram) return;

      this.uniforms = getUniforms(program);
      this.activeProgram = program;
    }

    bind() {
      gl.useProgram(this.activeProgram);
    }
  }

  class Program {
    constructor(vertexShader, fragmentShader) {
      this.uniforms = {};
      this.program = createProgram(vertexShader, fragmentShader);
      this.uniforms = getUniforms(this.program);
    }

    bind() {
      gl.useProgram(this.program);
    }
  }

  function createProgram(vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      console.trace(gl.getProgramInfoLog(program));

    return program;
  }

  function getUniforms(program) {
    let uniforms = [];
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      let uniformName = gl.getActiveUniform(program, i).name;
      uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
  }

  function compileShader(type, source, keywords) {
    source = addKeywords(source, keywords);

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      console.trace(gl.getShaderInfoLog(shader));

    return shader;
  }

  function addKeywords(source, keywords) {
    if (keywords == null) return source;
    let keywordsString = "";
    keywords.forEach((keyword) => {
      keywordsString += "#define " + keyword + "\n";
    });

    return keywordsString + source;
  }

  // 获取WebGL上下文
  const { gl, ext } = getWebGLContext(canvas);

  if (!ext.supportLinearFiltering) {
    config.DYE_RESOLUTION = 512;
    config.SHADING = false;
  }

  // 顶点着色器
  const baseVertexShader = compileShader(
    gl.VERTEX_SHADER,
    `
       precision highp float;
   
       attribute vec2 aPosition;
       varying vec2 vUv;
       varying vec2 vL;
       varying vec2 vR;
       varying vec2 vT;
       varying vec2 vB;
       uniform vec2 texelSize;
   
       void main () {
           vUv = aPosition * 0.5 + 0.5;
           vL = vUv - vec2(texelSize.x, 0.0);
           vR = vUv + vec2(texelSize.x, 0.0);
           vT = vUv + vec2(0.0, texelSize.y);
           vB = vUv - vec2(0.0, texelSize.y);
           gl_Position = vec4(aPosition, 0.0, 1.0);
       }
   `
  );

  // 模糊顶点着色器
  const blurVertexShader = compileShader(
    gl.VERTEX_SHADER,
    `
       precision highp float;
   
       attribute vec2 aPosition;
       varying vec2 vUv;
       varying vec2 vL;
       varying vec2 vR;
       uniform vec2 texelSize;
   
       void main () {
           vUv = aPosition * 0.5 + 0.5;
           float offset = 1.33333333;
           vL = vUv - texelSize * offset;
           vR = vUv + texelSize * offset;
           gl_Position = vec4(aPosition, 0.0, 1.0);
       }
   `
  );

  // 模糊片段着色器
  const blurShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
       precision mediump sampler2D;
   
       varying vec2 vUv;
       varying vec2 vL;
       varying vec2 vR;
       uniform sampler2D uTexture;
   
       void main () {
           vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
           sum += texture2D(uTexture, vL) * 0.35294117;
           sum += texture2D(uTexture, vR) * 0.35294117;
           gl_FragColor = sum;
       }
   `
  );

  // 复制片段着色器
  const copyShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
       precision mediump sampler2D;
   
       varying highp vec2 vUv;
       uniform sampler2D uTexture;
   
       void main () {
           gl_FragColor = texture2D(uTexture, vUv);
       }
   `
  );

  // 清除片段着色器
  const clearShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
       precision mediump sampler2D;
   
       varying highp vec2 vUv;
       uniform sampler2D uTexture;
       uniform float value;
   
       void main () {
           gl_FragColor = value * texture2D(uTexture, vUv);
       }
   `
  );

  // 颜色片段着色器
  const colorShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
   
       uniform vec4 color;
   
       void main () {
           gl_FragColor = color;
       }
   `
  );

  // 显示片段着色器源代码
  const displayShaderSource = `
       precision highp float;
       precision highp sampler2D;
   
       varying vec2 vUv;
       varying vec2 vL;
       varying vec2 vR;
       varying vec2 vT;
       varying vec2 vB;
       uniform sampler2D uTexture;
       uniform sampler2D uDithering;
       uniform vec2 ditherScale;
       uniform vec2 texelSize;
   
       vec3 linearToGamma (vec3 color) {
           color = max(color, vec3(0));
           return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
       }
   
       void main () {
           vec3 c = texture2D(uTexture, vUv).rgb;
   
       #ifdef SHADING
           vec3 lc = texture2D(uTexture, vL).rgb;
           vec3 rc = texture2D(uTexture, vR).rgb;
           vec3 tc = texture2D(uTexture, vT).rgb;
           vec3 bc = texture2D(uTexture, vB).rgb;
   
           float dx = length(rc) - length(lc);
           float dy = length(tc) - length(bc);
   
           vec3 n = normalize(vec3(dx, dy, length(texelSize)));
           vec3 l = vec3(0.0, 0.0, 1.0);
   
           float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
           c *= diffuse;
       #endif
   
           float a = max(c.r, max(c.g, c.b));
           gl_FragColor = vec4(c, a);
       }
   `;

  // Splat片段着色器
  const splatShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision highp float;
       precision highp sampler2D;
   
       varying vec2 vUv;
       uniform sampler2D uTarget;
       uniform float aspectRatio;
       uniform vec3 color;
       uniform vec2 point;
       uniform float radius;
   
       void main () {
           vec2 p = vUv - point.xy;
           p.x *= aspectRatio;
           vec3 splat = exp(-dot(p, p) / radius) * color;
           vec3 base = texture2D(uTarget, vUv).xyz;
           gl_FragColor = vec4(base + splat, 1.0);
       }
   `
  );

  // 对流片段着色器
  const advectionShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision highp float;
       precision highp sampler2D;
   
       varying vec2 vUv;
       uniform sampler2D uVelocity;
       uniform sampler2D uSource;
       uniform vec2 texelSize;
       uniform vec2 dyeTexelSize;
       uniform float dt;
       uniform float dissipation;
   
       vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
           vec2 st = uv / tsize - 0.5;
   
           vec2 iuv = floor(st);
           vec2 fuv = fract(st);
   
           vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
           vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
           vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
           vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
   
           return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
       }
   
       void main () {
       #ifdef MANUAL_FILTERING
           vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
           vec4 result = bilerp(uSource, coord, dyeTexelSize);
       #else
           vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
           vec4 result = texture2D(uSource, coord);
       #endif
           float decay = 1.0 + dissipation * dt;
           gl_FragColor = result / decay;
       }`,
    ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"]
  );

  // 散度片段着色器
  const divergenceShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
       precision mediump sampler2D;
   
       varying highp vec2 vUv;
       varying highp vec2 vL;
       varying highp vec2 vR;
       varying highp vec2 vT;
       varying highp vec2 vB;
       uniform sampler2D uVelocity;
   
       void main () {
           float L = texture2D(uVelocity, vL).x;
           float R = texture2D(uVelocity, vR).x;
           float T = texture2D(uVelocity, vT).y;
           float B = texture2D(uVelocity, vB).y;
   
           vec2 C = texture2D(uVelocity, vUv).xy;
           if (vL.x < 0.0) { L = -C.x; }
           if (vR.x > 1.0) { R = -C.x; }
           if (vT.y > 1.0) { T = -C.y; }
           if (vB.y < 0.0) { B = -C.y; }
   
           float div = 0.5 * (R - L + T - B);
           gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
       }
   `
  );

  // curl片段着色器
  const curlShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
       precision mediump sampler2D;
   
       varying highp vec2 vUv;
       varying highp vec2 vL;
       varying highp vec2 vR;
       varying highp vec2 vT;
       varying highp vec2 vB;
       uniform sampler2D uVelocity;
   
       void main () {
           float L = texture2D(uVelocity, vL).y;
           float R = texture2D(uVelocity, vR).y;
           float T = texture2D(uVelocity, vT).x;
           float B = texture2D(uVelocity, vB).x;
           float vorticity = R - L - T + B;
           gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
       }
   `
  );

  // 涡度片段着色器
  const vorticityShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision highp float;
       precision highp sampler2D;
   
       varying vec2 vUv;
       varying vec2 vL;
       varying vec2 vR;
       varying vec2 vT;
       varying vec2 vB;
       uniform sampler2D uVelocity;
       uniform sampler2D uCurl;
       uniform float curl;
       uniform float dt;
   
       void main () {
           float L = texture2D(uCurl, vL).x;
           float R = texture2D(uCurl, vR).x;
           float T = texture2D(uCurl, vT).x;
           float B = texture2D(uCurl, vB).x;
           float C = texture2D(uCurl, vUv).x;
   
           vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
           force /= length(force) + 0.0001;
           force *= curl * C;
           force.y *= -1.0;
   
           vec2 velocity = texture2D(uVelocity, vUv).xy;
           velocity += force * dt;
           velocity = min(max(velocity, -1000.0), 1000.0);
           gl_FragColor = vec4(velocity, 0.0, 1.0);
       }
   `
  );

  // 压力片段着色器
  const pressureShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
       precision mediump sampler2D;
   
       varying highp vec2 vUv;
       varying highp vec2 vL;
       varying highp vec2 vR;
       varying highp vec2 vT;
       varying highp vec2 vB;
       uniform sampler2D uPressure;
       uniform sampler2D uDivergence;
   
       void main () {
           float L = texture2D(uPressure, vL).x;
           float R = texture2D(uPressure, vR).x;
           float T = texture2D(uPressure, vT).x;
           float B = texture2D(uPressure, vB).x;
           float C = texture2D(uPressure, vUv).x;
           float divergence = texture2D(uDivergence, vUv).x;
           float pressure = (L + R + B + T - divergence) * 0.25;
           gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
       }
   `
  );

  // 梯度减法片段着色器
  const gradientSubtractShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
       precision mediump float;
       precision mediump sampler2D;
   
       varying highp vec2 vUv;
       varying highp vec2 vL;
       varying highp vec2 vR;
       varying highp vec2 vT;
       varying highp vec2 vB;
       uniform sampler2D uPressure;
       uniform sampler2D uVelocity;
   
       void main () {
           float L = texture2D(uPressure, vL).x;
           float R = texture2D(uPressure, vR).x;
           float T = texture2D(uPressure, vT).x;
           float B = texture2D(uPressure, vB).x;
           vec2 velocity = texture2D(uVelocity, vUv).xy;
           velocity.xy -= vec2(R - L, T - B);
           gl_FragColor = vec4(velocity, 0.0, 1.0);
       }
   `
  );

  // blit函数
  const blit = (() => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([0, 1, 2, 0, 2, 3]),
      gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    return (target, clear = false) => {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  })();

  // 创建帧缓冲对象
  let dye;
  let velocity;
  let divergence;
  let curl;
  let pressure;

  // 创建程序
  const copyProgram = new Program(baseVertexShader, copyShader);
  const clearProgram = new Program(baseVertexShader, clearShader);
  const splatProgram = new Program(baseVertexShader, splatShader);
  const advectionProgram = new Program(baseVertexShader, advectionShader);
  const divergenceProgram = new Program(baseVertexShader, divergenceShader);
  const curlProgram = new Program(baseVertexShader, curlShader);
  const vorticityProgram = new Program(baseVertexShader, vorticityShader);
  const pressureProgram = new Program(baseVertexShader, pressureShader);
  const gradienSubtractProgram = new Program(
    baseVertexShader,
    gradientSubtractShader
  );

  const displayMaterial = new Material(baseVertexShader, displayShaderSource);

  // 初始化帧缓冲
  function initFramebuffers() {
    let simRes = getResolution(config.SIM_RESOLUTION);
    let dyeRes = getResolution(config.DYE_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba = ext.formatRGBA;
    const rg = ext.formatRG;
    const r = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    gl.disable(gl.BLEND);

    if (dye == null)
      dye = createDoubleFBO(
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering
      );
    else
      dye = resizeDoubleFBO(
        dye,
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering
      );

    if (velocity == null)
      velocity = createDoubleFBO(
        simRes.width,
        simRes.height,
        rg.internalFormat,
        rg.format,
        texType,
        filtering
      );
    else
      velocity = resizeDoubleFBO(
        velocity,
        simRes.width,
        simRes.height,
        rg.internalFormat,
        rg.format,
        texType,
        filtering
      );

    divergence = createFBO(
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      gl.NEAREST
    );
    curl = createFBO(
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      gl.NEAREST
    );
    pressure = createDoubleFBO(
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      gl.NEAREST
    );
  }

  // 创建FBO
  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      w,
      h,
      0,
      format,
      type,
      null
    );

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let texelSizeX = 1.0 / w;
    let texelSizeY = 1.0 / h;

    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX,
      texelSizeY,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  // 创建双缓冲FBO
  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    let fbo1 = createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = createFBO(w, h, internalFormat, format, type, param);

    return {
      width: w,
      height: h,
      texelSizeX: fbo1.texelSizeX,
      texelSizeY: fbo1.texelSizeY,
      get read() {
        return fbo1;
      },
      set read(value) {
        fbo1 = value;
      },
      get write() {
        return fbo2;
      },
      set write(value) {
        fbo2 = value;
      },
      swap() {
        let temp = fbo1;
        fbo1 = fbo2;
        fbo2 = temp;
      },
    };
  }

  // 重置FBO
  function resizeFBO(target, w, h, internalFormat, format, type, param) {
    let newFBO = createFBO(w, h, internalFormat, format, type, param);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(newFBO);
    return newFBO;
  }

  // 重置双缓冲FBO
  function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
    if (target.width == w && target.height == h) return target;
    target.read = resizeFBO(
      target.read,
      w,
      h,
      internalFormat,
      format,
      type,
      param
    );
    target.write = createFBO(w, h, internalFormat, format, type, param);
    target.width = w;
    target.height = h;
    target.texelSizeX = 1.0 / w;
    target.texelSizeY = 1.0 / h;
    return target;
  }

  function updateKeywords() {
    let displayKeywords = [];
    if (config.SHADING) displayKeywords.push("SHADING");
    displayMaterial.setKeywords(displayKeywords);
  }

  updateKeywords();
  initFramebuffers();

  let lastUpdateTime = Date.now();
  let colorUpdateTimer = 0.0;

  // 动画更新函数
  function update() {
    const dt = calcDeltaTime();
    if (resizeCanvas()) initFramebuffers();
    updateColors(dt);
    applyInputs();
    step(dt);
    render(null);
    requestAnimationFrame(update);
  }

  // 计算时间增量
  function calcDeltaTime() {
    let now = Date.now();
    let dt = (now - lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    lastUpdateTime = now;
    return dt;
  }

  // 调整Canvas大小
  function resizeCanvas() {
    let width = scaleByPixelRatio(canvas.clientWidth);
    let height = scaleByPixelRatio(canvas.clientHeight);
    if (canvas.width != width || canvas.height != height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  // 更新颜色
  function updateColors(dt) {
    colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
    if (colorUpdateTimer >= 1) {
      colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
      pointers.forEach((p) => {
        p.color = generateColor();
      });
    }
  }

  // 应用输入
  function applyInputs() {
    pointers.forEach((p) => {
      if (p.moved) {
        p.moved = false;
        splatPointer(p);
      }
    });
  }

  // 流体模拟步骤
  function step(dt) {
    gl.disable(gl.BLEND);

    curlProgram.bind();
    gl.uniform2f(
      curlProgram.uniforms.texelSize,
      velocity.texelSizeX,
      velocity.texelSizeY
    );
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(
      vorticityProgram.uniforms.texelSize,
      velocity.texelSizeX,
      velocity.texelSizeY
    );
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(
      divergenceProgram.uniforms.texelSize,
      velocity.texelSizeX,
      velocity.texelSizeY
    );
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(
      pressureProgram.uniforms.texelSize,
      velocity.texelSizeX,
      velocity.texelSizeY
    );
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    gradienSubtractProgram.bind();
    gl.uniform2f(
      gradienSubtractProgram.uniforms.texelSize,
      velocity.texelSizeX,
      velocity.texelSizeY
    );
    gl.uniform1i(
      gradienSubtractProgram.uniforms.uPressure,
      pressure.read.attach(0)
    );
    gl.uniform1i(
      gradienSubtractProgram.uniforms.uVelocity,
      velocity.read.attach(1)
    );
    blit(velocity.write);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(
      advectionProgram.uniforms.texelSize,
      velocity.texelSizeX,
      velocity.texelSizeY
    );
    if (!ext.supportLinearFiltering)
      gl.uniform2f(
        advectionProgram.uniforms.dyeTexelSize,
        velocity.texelSizeX,
        velocity.texelSizeY
      );
    let velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(
      advectionProgram.uniforms.dissipation,
      config.VELOCITY_DISSIPATION
    );
    blit(velocity.write);
    velocity.swap();

    if (!ext.supportLinearFiltering)
      gl.uniform2f(
        advectionProgram.uniforms.dyeTexelSize,
        dye.texelSizeX,
        dye.texelSizeY
      );
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(
      advectionProgram.uniforms.dissipation,
      config.DENSITY_DISSIPATION
    );
    blit(dye.write);
    dye.swap();
  }

  // 渲染到目标
  function render(target) {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    drawDisplay(target);
  }

  // 绘制显示
  function drawDisplay(target) {
    let width = target == null ? gl.drawingBufferWidth : target.width;
    let height = target == null ? gl.drawingBufferHeight : target.height;

    displayMaterial.bind();
    if (config.SHADING)
      gl.uniform2f(
        displayMaterial.uniforms.texelSize,
        1.0 / width,
        1.0 / height
      );
    gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    blit(target);
  }

  // 喷溅指针
  function splatPointer(pointer) {
    let dx = pointer.deltaX * config.SPLAT_FORCE;
    let dy = pointer.deltaY * config.SPLAT_FORCE;
    splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
  }

  // 生成随机颜色
  function generateColor() {
    // 检查当前主题模式
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // 使用主题色 #f59e0b 的 HSL 值作为基准
    // HSL: 35, 92%, 50%
    const baseHue = 35;
    const hueVariation = 15; // 允许色相在基准色周围15度范围内变化
    const hue = (baseHue + (Math.random() - 0.5) * hueVariation) / 360;
    
    let c = HSVtoRGB(hue, 0.8, 1.0);
    
    // 根据主题模式调整颜色强度
    if (isDarkMode) {
      // 暗色模式下使用较亮的颜色
      c.r *= 0.25;
      c.g *= 0.25;
      c.b *= 0.25;
    } else {
      // 亮色模式下使用更深的颜色
      c.r *= 0.95;  // 增加红色分量
      c.g *= 0.95;  // 增加绿色分量
      c.b *= 0.95;  // 增加蓝色分量
    }
    
    return c;
  }

  // 点击喷溅
  function clickSplat(pointer) {
    const color = generateColor();
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // 根据主题模式调整点击时的颜色强度
    const intensity = isDarkMode ? 20.0 : 35.0;  // 保持原有的点击强度
    color.r *= intensity;
    color.g *= intensity;
    color.b *= intensity;
    
    let dx = 15 * (Math.random() - 0.5);
    let dy = 40 * (Math.random() - 0.5);
    splat(pointer.texcoordX, pointer.texcoordY, dx, dy, color);
  }

  // 喷溅
  function splat(x, y, dx, dy, color) {
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(
      splatProgram.uniforms.aspectRatio,
      canvas.width / canvas.height
    );
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(
      splatProgram.uniforms.radius,
      correctRadius(config.SPLAT_RADIUS / 100.0)
    );
    blit(velocity.write);
    velocity.swap();
    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
  }

  // 修正半径
  function correctRadius(radius) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) radius *= aspectRatio;
    return radius;
  }

  // 修正X方向增量
  function correctDeltaX(delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
  }

  // 修正Y方向增量
  function correctDeltaY(delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
  }

  // HSV到RGB转换
  function HSVtoRGB(h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        (r = v), (g = t), (b = p);
        break;
      case 1:
        (r = q), (g = v), (b = p);
        break;
      case 2:
        (r = p), (g = v), (b = t);
        break;
      case 3:
        (r = p), (g = q), (b = v);
        break;
      case 4:
        (r = t), (g = p), (b = v);
        break;
      case 5:
        (r = v), (g = p), (b = q);
        break;
    }
    return {
      r,
      g,
      b,
    };
  }

  // 包裹值在范围内
  function wrap(value, min, max) {
    const range = max - min;
    if (range == 0) return min;
    return ((value - min) % range) + min;
  }

  // 获取分辨率
  function getResolution(resolution) {
    let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

    const min = Math.round(resolution);
    const max = Math.round(resolution * aspectRatio);

    if (gl.drawingBufferWidth > gl.drawingBufferHeight)
      return { width: max, height: min };
    else return { width: min, height: max };
  }

  // 根据像素比例缩放
  function scaleByPixelRatio(input) {
    const pixelRatio = window.devicePixelRatio || 1;
    return Math.floor(input * pixelRatio);
  }

  // 哈希码计算
  function hashCode(s) {
    if (s.length == 0) return 0;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0; // 转为32位整数
    }
    return hash;
  }

  // 更新指针下移数据
  function updatePointerDownData(pointer, id, posX, posY) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = generateColor();
  }

  // 更新指针移动数据
  function updatePointerMoveData(pointer, posX, posY, color) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved =
      Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    pointer.color = color;
  }

  // 更新指针抬起数据
  function updatePointerUpData(pointer) {
    pointer.down = false;
  }

  // 事件监听
  window.addEventListener("mousedown", (e) => {
    let pointer = pointers[0];
    let posX = scaleByPixelRatio(e.clientX);
    let posY = scaleByPixelRatio(e.clientY);
    updatePointerDownData(pointer, -1, posX, posY);
    clickSplat(pointer);
  });

  window.addEventListener("mousemove", (e) => {
    let pointer = pointers[0];
    let posX = scaleByPixelRatio(e.clientX);
    let posY = scaleByPixelRatio(e.clientY);
    let color = generateColor();
    updatePointerMoveData(pointer, posX, posY, color);
  });

  window.addEventListener(
    "touchstart",
    (e) => {
      const touches = e.targetTouches;
      for (let i = 0; i < touches.length; i++) {
        let posX = scaleByPixelRatio(touches[i].clientX);
        let posY = scaleByPixelRatio(touches[i].clientY);

        // 确保有足够的指针
        while (touches[i].identifier >= pointers.length) {
          pointers.push(new pointerPrototype());
        }

        updatePointerDownData(
          pointers[touches[i].identifier],
          touches[i].identifier,
          posX,
          posY
        );
        clickSplat(pointers[touches[i].identifier]);
      }
    },
    false
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      const touches = e.targetTouches;
      for (let i = 0; i < touches.length; i++) {
        let posX = scaleByPixelRatio(touches[i].clientX);
        let posY = scaleByPixelRatio(touches[i].clientY);
        updatePointerMoveData(
          pointers[touches[i].identifier],
          posX,
          posY,
          pointers[touches[i].identifier].color
        );
      }
    },
    false
  );

  window.addEventListener("touchend", (e) => {
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      updatePointerUpData(pointers[touches[i].identifier]);
    }
  });

  // 监听窗口大小变化
  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  // 启动动画
  update();
}

// 确保在DOM加载完成后初始化所有功能
window.addEventListener("DOMContentLoaded", () => {
  // 初始化光标
  initFluidCursor();
});

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
