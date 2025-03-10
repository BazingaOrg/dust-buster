# 灰不了

一个让你对着收藏夹'呼噜噜'吹灰的搜索工具！

## 🌟 项目背景

"到我的收藏夹里吃灰吧"

这是网上流传的一句调侃。我们总是习惯性地把觉得有用的网页收藏起来，却很少再打开它们。时间久了，这些珍贵的收藏就像蒙上了一层灰，渐渐被遗忘。

「灰不了」就是为解决这个问题而生的 Chrome 扩展程序。它能帮你快速检索收藏夹里的内容，让每一个书签都能在需要的时候被找到，不再躺尸吃灰。

## ✨ 特性

- **快速搜索**：实时搜索你的书签，支持标题和网址搜索
- **网站预览**：自动加载并显示网站预览图，快速识别目标网站
- **懒加载优化**：使用 Intersection Observer 实现预览图懒加载，提升性能
- **键盘导航**：支持键盘方向键浏览书签，提升无鼠标操作体验
- **交互反馈**：点击时的波纹效果和预览图加载的过渡动画
- **多主题支持**：内置明暗两种主题，自动适应系统主题设置
- **可访问性**：完整的键盘操作支持、ARIA 标签和高对比度模式
- **响应式设计**：自适应各种屏幕尺寸，优化移动设备体验

## 📦 使用方法

1. 下载本项目的压缩包
2. 解压到本地文件夹
3. 打开 Chrome，进入 chrome://extensions/
4. 开启右上角的"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的文件夹

安装完成后：

1. 点击浏览器工具栏中的扩展图标
2. 在搜索框输入关键词
3. 回车跳转到目标书签

## 🔍 使用技巧

- **快捷键导航**：Alt + / 快速聚焦搜索框
- **键盘浏览**：使用方向键浏览书签列表，Enter 键打开选中书签
- **空状态提示**：当没有书签或搜索无结果时会显示友好提示
- **主题切换**：点击右上角的主题按钮可手动切换明暗主题

## 💯 性能优化

- **懒加载**：预览图使用 Intersection Observer 实现按需加载
- **缓存机制**：使用 localStorage 缓存预览图 URL，减少重复请求
- **错误处理**：完善的图片加载错误处理和多级备选方案
- **动画优化**：针对低性能设备的动画降级处理

## 🛠️ 技术栈

- HTML
- CSS
- JavaScript
- Chrome Extension API
- Intersection Observer API

## 📝 开源协议

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

Made with ❤️
