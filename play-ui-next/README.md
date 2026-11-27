# DLook Next：DLsite Play 全新界面

`play-ui-next/` 是 DLook 3.0.0 的扩展源码（Manifest V3），为 `play.dlsite.com` 提供一套全新的界面。`chrome-extension/` 保留旧版源码；开发时**同一时间只能启用其中一个**，否则两套界面会同时注入 DLsite Play。发布包沿用原扩展名称，Safari 沿用原脚本名称、命名空间和更新地址。

DLsite 商品页、购物车、收藏夹的史低价格卡片功能，原样复制自 `chrome-extension/`，没有修改。

## 安装

1. 在 `chrome://extensions` 里停用原来的 DLook 扩展。
2. 打开「开发者模式」，点「加载已解压的扩展程序」，选择 `play-ui-next` 文件夹。
3. 登录并打开 `https://play.dlsite.com/`。

## Safari（iPhone、iPad、Mac）：Userscripts

1. 在 App Store 安装 [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)，并在 Safari 的扩展设置里启用它。
2. 生成脚本（需要项目已经 `npm install`，打包会用到项目里的 Vite）：

   ```powershell
   node play-ui-next/scripts/build_userscript.mjs
   ```

   输出文件是 `play-ui-next/dist/DLook-Safari.user.js`。加上 `--release` 参数时，还会写入 `exports/<版本>/`，包括 `DLook-Safari.user.js` 和 `DLook-Safari.meta.js`。
3. 把脚本放进 Userscripts 应用的脚本目录，替换已有的 `DLook-Safari.user.js`。若曾安装实验版 `DLook-Next-Safari.user.js`，请停用它，避免重复运行。
4. 在 Safari 中允许 Userscripts 在 `play.dlsite.com` 和 `www.dlsite.com` 上运行，然后刷新页面。

打包方式：`play/userscript.js` 及其引用的所有模块（包括按需加载的视图）会被 Vite/Rollup 打成一个 IIFE。CSS 和 Logo 以内联方式写入脚本，因为 Userscripts 既不能 import 模块，也读不到扩展文件。DLsite 商品页的价格卡片沿用原来的拼接方式，复用 `userscripts/safari-platform.js`。

针对 Safari 做的适配：

- **iOS 播放限制**：iOS 只允许在用户手势里开始播放，而 DLook 会先联网解析音轨再播放，这时手势已经失效。因此用户第一次点击时，会用同一个媒体元素播放一段静音来"解锁"它。如果仍然被拒绝，界面会停在暂停状态，再点一次播放即可。
- **安全区**：自动给页面的 viewport 加上 `viewport-fit=cover`，这样刘海屏和底部手势条的安全区（`env(safe-area-inset-*)`）才会生效，底部标签栏和迷你播放器不会被遮挡。
- **漫画阅读器**：拦截 iOS 的 `gesturestart`，双指缩放只作用于漫画页，不会缩放整个网页。不支持标准全屏接口时（如 iPad 上的 Safari）改用 `webkitRequestFullscreen`；手机布局下隐藏全屏按钮，因为 iPhone 不支持网页全屏。视频全屏使用 `webkitEnterFullscreen`。
- **触摸**：全局设置 `touch-action: manipulation`，去掉双击缩放和点击延迟。没有悬停的设备上，卡片的快捷播放按钮常驻显示。
- **其他**：版本号由入口传入，不读取 `chrome.runtime`（Userscripts 环境里它可能指向 Userscripts 应用本身）。Safari 不支持 Navigation API，因此改为轮询跟随官方页面的路由跳转。所有毛玻璃效果都带有 `-webkit-backdrop-filter` 前缀。

本地验证打包结果：http://127.0.0.1:5178/dev/userscript.html 会在测试台里直接执行 `dist/` 中的脚本。

## 生成发布包

```powershell
python play-ui-next/scripts/build_release.py
```

版本号取自 `play-ui-next/manifest.json`。所有产物写入 `exports/<版本>/`：Chrome、Edge、Firefox 安装 ZIP，Firefox 审核源码 ZIP，以及 Safari 的 user.js 和 meta.js。扩展安装包排除 `dev/`、`dist/`、`scripts/` 和 README。Firefox 源码包包含标准库构建脚本，可解压后运行 `python build_firefox.py` 重建安装包。

## 设计

- **苹果风格**：半透明玻璃材质（`backdrop-filter`）、系统字体、大标题，按钮多为纯图标的圆形或胶囊形，用弹簧曲线做过渡动画。
- **蓝、粉两套主题色**，可以和「自动/浅色/深色」任意组合。在设置中切换，会沿用原扩展保存的主题色。
- **电脑和手机分开布局**（以 860px 为分界）：
  - **电脑**：左侧是玻璃侧边栏，包含 5 个入口，以及我的列表、播放列表的快捷入口；窗口窄于 1180px 时收成图标栏。作品页分左右两栏：左边是固定的封面区，右边是文件和详情。播放器是内容区底部的一条控制栏，展开后左边显示封面，右边显示歌词式字幕或播放队列。
  - **手机**：页面顶部是大标题，滚动后收进玻璃导航栏。底部是悬浮的玻璃标签栏，每项都是图标加文字。迷你播放器浮在标签栏上方，点开是全屏播放页，下拉即可关闭，左右滑动封面可以切换曲目。
- **卡片**：所有作品卡片的封面比例统一为 4:3，标题和副标题都只显示一行。封面始终铺满，竖版漫画封面会被裁切，并以靠上的位置为准，不会出现留白。作者和列表卡片用 2×2 封面拼图。
- **动画默认开启**：即使系统开启了「减弱动态效果」（例如 Windows 关闭了「动画效果」），也照常播放动画。如需跟随系统，可在 设置 → 外观 打开「跟随系统减弱动态效果」。
- **低频操作收进「…」菜单**：同步、隐藏作品、在官方页面打开、重命名、删除、布局密度等。

## 功能对照（原扩展 → 新界面）

| 原扩展功能 | 新界面 |
| --- | --- |
| 底部导航：媒体库、我的列表、播放列表、离线暂存、设置，以及未读通知提示点 | 手机上是底部标签栏，电脑上是侧边栏，未读通知的红点都保留 |
| 设置页：同步、回到 DLsite、帮助、通知、主题色、登出 | 设置页按 iOS 风格分组，以上入口全部保留。同步、通知、帮助和登出仍然调用 DLsite Play 自己的菜单操作；登出时会显示官方的确认框 |
| 媒体库搜索、作品/作者/声优视图、类别筛选、作者和声优卡片 | 全部保留。另外新增：分类计数、排序（购买日、发售日、标题、社团、最近播放）、网格和列表两种布局、紧凑密度，以及「继续」横排 |
| 封面缓存（IndexedDB，7 天） | 继续使用同一个数据库 `dlook-play-covers-v1`，上限提高到 600 张、64 MiB |
| 作品页：分享移入「更多」、在任一我的列表中时显示红心、加入列表 | 分享、红心、加入列表（可直接新建列表）、隐藏或取消隐藏作品 |
| 列表：播放全部、随机播放、播放列表作品数、新建对话框、编辑和删除 | 全部保留，并新增上移、下移排序，以及重命名 |
| 字幕时间轴（滚动跳转） | 改为歌词式显示。电脑上显示在右栏，手机上可以和封面互相切换，点任意一句即可跳转 |
| 定时关闭 | 可选 5 到 90 分钟或「播完本轨」，到时间后用 8 秒淡出再暂停 |
| 播放器：迷你和完整模式、倍速、随机、循环、队列、视频、双击全屏 | 全部保留。新增：后退和前进的秒数可以设置、按作品记住倍速、音量调节、画中画、系统媒体控制（Media Session）和键盘快捷键 |
| 收听进度同步，以及「继续收听」 | 沿用 DLsite Play 的进度格式；断网时上报会排队，联网后补发 |
| 离线暂存：音频、HLS 视频，暂停和继续，错误提示，删除 | 全部保留，并使用同一个 IndexedDB `dlook-offline-audio`，旧扩展暂存的作品可以直接播放。新增已用空间统计，以及作品页上的环形下载进度 |
| 主题色蓝、粉 | 保留，并新增浅色、深色模式 |
| 页面切换动画、播放器展开和收起的形变动画 | 推入和返回时有滑动，标签页之间淡入淡出，卡片依次入场，封面在迷你播放器和完整播放器之间飞行过渡 |

### 新的漫画阅读器

图片文件夹和 PDF 用 DLook 自己的阅读器打开：

- 左右翻页，默认从右到左，也可以改成从左到右；支持单页、双页、纵向滚动三种模式。「自动」模式在宽屏显示双页，在手机显示单页，遇到条漫则改为纵向滚动。
- 双页时封面单独显示，横版跨页图也单独显示，两页之间有中缝阴影。
- 翻页方式：滑动（手指拖动有跟随效果，到首尾会回弹）、点击左右区域、方向键、空格、PageUp/PageDown、Home/End、鼠标滚轮。
- 缩放：双指捏合，或双击缩放到点击位置，放大后可以拖动；Ctrl 加滚轮也能缩放。
- 底部进度条可以拖动跳页，方向跟随阅读方向；缩略图网格可以直接跳转；支持全屏，界面在 3 秒无操作后自动隐藏。
- 预加载后面 3 页；记住读到哪一页，再次打开时自动续读，阅读进度也会同步到 DLsite Play。
- **加密页（crypt）、电子书、文本和 HTML 文件**仍然用官方阅读器打开。如果图片页加载失败、一页都显示不出来，也会自动切换到官方阅读器。DLook 这时退到一旁，左上角留一个「返回 DLook」按钮，不尝试破解受保护的内容。

### 交给官方页面的部分

通知、帮助、账户页、电子书阅读器、加密页面，都直接显示 DLsite Play 的原生页面。迷你播放器和导航仍然留在最上层，所以没有任何功能因为界面重做而无法使用。

## 缓存

- `core/kv.js` 提供内存加 IndexedDB（`dlook-next-cache`）两级缓存，读取时先返回缓存，再在后台刷新。媒体库、作品详情（6 小时）、我的列表和播放列表（20 秒）、隐藏作品、阅读进度、观看历史都走这层缓存，所以重复进入同一页面不会重复请求。
- 媒体库采用和 DLsite Play 一致的增量同步：`/api/v4/content/count`，接着请求 sales、works 和 products，只拉取上次同步之后的新增作品。
- 文件树（ziptree）在内存里缓存 10 分钟，内容 Cookie 授权按到期时间缓存，流媒体签名在所有播放队列之间共享。
- 页面实例缓存最近 8 个，返回时会恢复滚动位置；在某个标签页里进入的子页面，切回该标签时会保留。

## 目录结构

```
play-ui-next/
├─ manifest.json          play.dlsite.com 只注入 play/loader.js 和 play/styles/host.css
├─ play/
│  ├─ loader.js           document_start：先应用主题、遮住原生界面，再动态 import 应用
│  ├─ core/               dom、icons、i18n（简中、繁中、日、英、韩）、prefs、kv 缓存、http
│  ├─ data/               api（媒体库、列表、隐藏、进度）、source（ziptree、签名、漫画页）、
│  │                      offline（暂存、队列）、offline-store、progress、covers
│  ├─ ui/                 app（外壳、路由、过渡）、kit（菜单、面板、对话框、提示、分段控件）、
│  │  │                   native（调用原生菜单）、state、page、cards、player、captions、reader
│  │  └─ views/           library、work、collections、offline、settings
│  └─ styles/             tokens、base、shell、cards、views、player、reader、desktop、mobile
└─ dev/                   本地测试台（不需要打包进发布版本）
```

整个界面渲染在 Shadow DOM 里，和 DLsite Play 的样式互不影响。原生 React 应用在下层继续运行，DLook 导航时会同步它的路由，所以登录状态、同步和各种对话框都能继续使用。

## 本地测试台

Play 账户的媒体库可能是空的，而界面需要真实的数据形态才能测试。为此，测试台用模拟接口提供 59 部作品、列表、字幕、音频和漫画页：

```powershell
node play-ui-next/dev/server.mjs
```

- 电脑布局：http://127.0.0.1:5178/
- 手机布局（390×844 的 iframe）：http://127.0.0.1:5178/dev/phone.html

## 尚未在真实站点验证的部分

以下部分已在测试台验证，但还没有在登录后的 play.dlsite.com 上实测，请加载扩展后重点检查：

- 我的列表的排序接口：`PUT /api/mylists/{id}/works` 的请求体是根据前端代码推测的，写作 `new_order`。如果失败，界面会提示「更新失败」并回滚。
- 播放列表添加音轨时发送 `{ workno, src }`，排序时发送 `new_order`，内容是音轨的 index 列表。
- HLS 视频的在线播放和离线播放都沿用原扩展的逻辑，测试台没有模拟视频。
- 登出时显示的原生确认框，以及通知页的原生页面切换（帮助页已实测）。
- Safari Userscripts 版本只在 Chrome 测试台里验证过打包结果能运行，还没有在真实的 iPhone、iPad 或 Mac Safari 上实测。

## 文本文件与官方内容页（2.1.7）

- **文本文件**（Read me、台本等）：由 DLook 自己读取并排版显示，支持调字号、复制全文，网址可以点击。文件编码按文件树里的标注解码；标注不对时，依次尝试 UTF-8、Shift_JIS、GB18030。
- **通知、帮助及其详情页**：这些内容写在官方前端代码里，没有接口可调用。DLook 让官方页面在后台渲染，再把正文转录进 DLook 自己的页面：保留文字、图片和链接；站内链接继续在 DLook 内打开，按钮的点击转发给官方原按钮。
- **官方阅读器**（加密漫画、电子书、HTML 等）：全屏显示，并隐藏 DLook 的底部导航、迷你播放器和返回按钮，退出用阅读器自带的关闭按钮。

## 发布

```powershell
python play-ui-next/scripts/build_release.py
```

按 `manifest.json` 中的版本号，生成 `exports/<版本>/`，内容与之前的版本一致：Chrome、Edge 安装包，Firefox 安装包和审核源码包，以及 Safari 的 `DLook-Safari.user.js` 和 `DLook-Safari.meta.js`。Firefox 包复用项目原有的 `scripts/build_firefox.py`。
