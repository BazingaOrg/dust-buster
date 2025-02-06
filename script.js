// 存储书签数据
let bookmarks = [];
let selectedIndex = -1; // 添加selectedIndex声明
const searchResults = document.getElementById("searchResults");

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

// 获取默认图标
function getDefaultIcon() {
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="%23666" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`;
}

// 获取网站图标URL
function getFaviconUrl(url) {
  try {
    const parsedUrl = safeParseUrl(url);
    if (!parsedUrl) return getDefaultIcon();
    return `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
  } catch (e) {
    console.error("Error getting favicon:", e);
    return getDefaultIcon();
  }
}

// 处理图标加载错误
function handleImageError(img) {
  if (!img) return;
  img.onerror = null;
  img.src = getDefaultIcon();
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
function filterBookmarks(query) {
  if (!Array.isArray(bookmarks)) return [];
  if (!query) return bookmarks;

  const normalizedQuery = query.toLowerCase();
  return bookmarks.filter(
    (bookmark) =>
      bookmark.title.toLowerCase().includes(normalizedQuery) ||
      bookmark.url.toLowerCase().includes(normalizedQuery)
  );
}

// 渲染书签列表
function renderBookmarks(bookmarksToShow) {
  const container = document.getElementById("bookmarksList");
  if (!container) {
    console.error("bookmarksList container not found");
    return;
  }

  try {
    container.innerHTML = bookmarksToShow
      .map((bookmark) => {
        const url = escapeHtml(bookmark.url);
        const title = escapeHtml(bookmark.title);
        const hostname = safeParseUrl(bookmark.url)?.hostname || "";

        return `
            <div class="bookmark-item" data-url="${url}">
                <div class="bookmark-icon">
                    <img src="${getFaviconUrl(bookmark.url)}" 
                         onerror="handleImageError(this)" 
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

    // 添加点击事件
    container.querySelectorAll(".bookmark-item").forEach((item) => {
      item.addEventListener("click", () => {
        const url = item.dataset.url;
        if (url) {
          window.open(url, "_blank");
        }
      });
    });

    // 添加触摸事件处理
    container.querySelectorAll(".bookmark-item").forEach((item) => {
      item.addEventListener("touchstart", (e) => {
        e.currentTarget.classList.add("active");
      });
      item.addEventListener("touchend", (e) => {
        e.currentTarget.classList.remove("active");
      });
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
    selectedIndex = -1;

    if (!query) {
      searchResults.classList.remove("visible");
      return;
    }

    const filtered = filterBookmarks(query);

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
      item.innerHTML = `
        <div class="bookmark-icon">
          <img src="${getFaviconUrl(bookmark.url)}" 
               onerror="handleImageError(this)" 
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
    item.classList.toggle("selected", index === selectedIndex);
  });

  if (selectedIndex >= 0 && selectedIndex < items.length) {
    items[selectedIndex].scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }
}

function filterAllBookmarks(query) {
  try {
    const filtered = query
      ? bookmarks.filter(
          (bookmark) =>
            bookmark.title.toLowerCase().includes(query) ||
            bookmark.url.toLowerCase().includes(query)
        )
      : bookmarks;

    renderBookmarks(filtered);
    updateBookmarkCount(filtered.length);
  } catch (error) {
    console.error("Error filtering bookmarks:", error);
  }
}

// 主题相关函数
function initThemeSwitcher() {
  const themeBtns = document.querySelectorAll(".theme-btn");
  const savedTheme = localStorage.getItem("theme") || "light";

  try {
    setTheme(savedTheme);
    updateActiveButton(savedTheme);

    themeBtns.forEach((btn) => {
      // 移除 { once: true } 选项
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        if (theme) {
          setTheme(theme);
          localStorage.setItem("theme", theme);
          updateActiveButton(theme);
        }
      });
    });
  } catch (error) {
    console.error("Error initializing theme switcher:", error);
  }
}

function updateActiveButton(theme) {
  if (!theme) return;

  const themeBtns = document.querySelectorAll(".theme-btn");
  themeBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}

function setTheme(theme) {
  if (!theme) return;
  document.documentElement.setAttribute("data-theme", theme);
}

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
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (!bookmarkTree) {
        console.error("Failed to get bookmarks");
        return;
      }

      bookmarks = flattenBookmarks(bookmarkTree);
      bookmarks = sortBookmarks(bookmarks);
      updateBookmarkCount(bookmarks.length);
      renderBookmarks(bookmarks);
    });
  } catch (error) {
    console.error("Error getting bookmarks:", error);
  }

  // 初始化主题切换
  initThemeSwitcher();

  // 搜索输入处理
  let searchDebounceTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const query = e.target.value.toLowerCase();
      toggleClearButton(searchInput, clearButton);
      showSearchResults(query);
      filterAllBookmarks(query);
    }, 300); // 添加防抖
  });

  // 键盘导航
  searchInput.addEventListener("keydown", (e) => {
    const items = searchResults?.querySelectorAll(".search-result-item");
    if (!items?.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelection();
        break;
      case "ArrowUp":
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection();
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const selectedItem = items[selectedIndex];
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
    updateBookmarkCount(bookmarks.length);
    searchResults?.classList.remove("visible");
    renderBookmarks(bookmarks);
  });

  // 切换清除按钮显示状态
  function toggleClearButton(searchInput, clearButton) {
    if (!searchInput || !clearButton) return;
    clearButton.style.display = searchInput.value.trim() ? "flex" : "none";
  }

  // 初始化时隐藏清除按钮
  toggleClearButton(searchInput, clearButton);
});

// 添加错误处理
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});
