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
        `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${parsedUrl.hostname}&size=32`,
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

// 渲染书签列表
function renderBookmarks(bookmarksToShow) {
  const container = document.getElementById("bookmarksList");
  if (!container) return;

  try {
    container.innerHTML = bookmarksToShow
      .map((bookmark) => {
        const url = escapeHtml(bookmark.url);
        const title = escapeHtml(bookmark.title);
        const faviconData = getFaviconUrl(bookmark.url);
        const initialFaviconUrl =
          typeof faviconData === "string" ? faviconData : faviconData.url;

        return `
          <div class="bookmark-item" data-url="${url}">
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
        `;
      })
      .join("");

    // 为所有图片添加错误处理
    container.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => handleImageError(img));
    });
  } catch (error) {
    console.error("Error rendering bookmarks:", error);
    container.innerHTML = '<div class="error">Error rendering bookmarks</div>';
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
      searchResults.innerHTML =
        '<div class="no-results">No results found</div>';
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

      item.innerHTML = `
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
      `;

      item.addEventListener("click", () => {
        window.open(bookmark.url, "_blank");
      });
      searchResults.appendChild(item);
    });

    // 为搜索结果中的所有图片添加错误处理
    searchResults.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => handleImageError(img));
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
  showLoading(true);
  try {
    await new Promise((resolve) => {
      chrome.bookmarks.getTree((bookmarkTree) => {
        if (!bookmarkTree) throw new Error("Failed to get bookmarks");
        allBookmarks = sortBookmarks(flattenBookmarks(bookmarkTree));
        updateBookmarkCount(allBookmarks.length);
        renderBookmarks(allBookmarks);
        resolve();
      });
    });
  } catch (error) {
    handleError(error, "获取书签");
  } finally {
    showLoading(false);
  }
}
