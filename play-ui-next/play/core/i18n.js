// UI copy. Language follows DLsite Play's <html lang>: zh-cn, zh-tw, ja, ko, en (fallback en).

const zhCN = {
  navigation: 'DLook 导航', library: '媒体库', mylist: '我的列表', playlist: '播放列表', offline: '离线暂存', settings: '设置',
  works: '作品', circles: '作者/社团', voices: '声优', all: '全部', audio: '音声', video: '视频', comic: '漫画', other: '其他',
  search: '搜索', searchPlaceholder: '搜索标题、社团、声优或编号', sort: '排序', sortPurchased: '最近购买', sortPurchasedOld: '最早购买',
  sortRelease: '发售日期', sortTitle: '标题', sortCircle: '社团', sortRecent: '最近播放', layout: '布局', layoutGrid: '网格', layoutList: '列表',
  density: '卡片大小', compact: '紧凑', comfortable: '舒适',
  emptyLibrary: '媒体库里还没有作品', emptyLibraryHint: '购买的作品同步后会出现在这里。', noResults: '没有找到匹配的作品',
  syncing: (v, m) => m ? `正在同步 ${v}/${m}` : '正在同步…', synced: '媒体库已是最新', syncFailed: '同步失败，请稍后重试。',
  continue: '继续', recent: '最近播放', count: n => `${n} 部作品`, items: n => `${n} 项`, trackCount: n => `${n} 个音轨`, hidden: '已隐藏的作品', showHidden: '查看隐藏的作品',
  more: '更多', ageAll: '全年龄', series: '系列',
  listen: '收听', resume: '继续收听', watch: '观看', resumeWatch: '继续观看', read: '阅读', resumeRead: '继续阅读', open: '打开',
  files: '文件', details: '详情', circle: '社团', authors: '作者', cast: '声优', release: '发售日', purchasedOn: '购买日', type: '类型', fileSize: '大小',
  saveOffline: '暂存音视频', saved: '已暂存', saving: '正在暂存…', pauseSaving: '暂停暂存', resumeSaving: '继续暂存',
  savedCount: (s, t) => `已暂存 ${s}/${t} 项`, addToList: '加入我的列表', inList: '已在我的列表', share: '分享', copied: '链接已复制',
  hide: '隐藏作品', unhide: '取消隐藏', hiddenDone: '已隐藏该作品', unhiddenDone: '已取消隐藏', openOfficial: '在官方页面打开',
  playFolder: '播放此文件夹', addToPlaylist: '加入播放列表', noFiles: '这个文件夹是空的', loadFailed: '加载失败', retry: '重试',
  authorization: '授权失败，请确认已登录且能在线播放。', catalog: '无法读取文件列表，请重试。', media: '部分音视频下载失败，请重试。',
  storage: '浏览器无法写入暂存，请检查本地存储。', quota: '空间不足，请删除部分暂存作品后重试。', noAudio: '这个作品没有可暂存的音频或视频。', stopped: '暂存已暂停。',
  newMylist: '新建我的列表', newPlaylist: '新建播放列表', listName: '列表名称', cancel: '取消', create: '创建', createFailed: '创建失败，请重试。',
  rename: '重命名', save: '保存', delete: '删除', deleteConfirm: t => `删除「${t}」？此操作无法撤销。`, playAll: '播放全部', shuffle: '随机播放',
  emptyMylist: '这个列表还没有作品。在作品页点「加入我的列表」。', emptyPlaylist: '这个播放列表还没有音轨。在作品文件列表里添加。',
  emptyCollections: '还没有列表', edit: '编辑', done: '完成', remove: '移除', chooseList: '选择列表', added: n => `已加入「${n}」`,
  removed: '已移除', updateFailed: '更新失败，请重试。', moveUp: '上移', moveDown: '下移',
  offlineEmpty: '还没有暂存作品。联网时，在已购作品页点「暂存音视频」。', removeOffline: '删除暂存', removeOfflineConfirm: t => `删除「${t}」的本地暂存？`,
  removeFailed: '无法删除暂存，请重试。', openFailed: '无法读取离线暂存，请重试。', playFailed: '无法播放这一项，请尝试重新暂存。', used: '已用空间',
  offlinePage: '打开离线页', offlinePageHint: '离线页属于浏览器扩展，断网或无法访问 DLsite 时，点浏览器工具栏的 DLook 图标 →「离线播放」即可打开。', offlineMigrated: n => `已将 ${n} 部暂存作品移入扩展存储`,
  offlineNotice: '当前处于离线状态，只能播放已暂存的内容。',   noAccess: '当前账号没有这部作品的播放权限', noAccessHint: '请确认登录的是购买该作品的账号。', noAccessSaved: '当前账号无法在线访问这部作品，以下是本地暂存的内容。',
  account: '账户', sync: '同步媒体库', syncRequested: '已开始同步媒体库。', dlsite: '返回 DLsite', help: '帮助', notifications: '通知',
  unread: '有未读通知', logout: '登出', appearance: '外观', accent: '主题色', blue: '蓝', pink: '粉', mode: '显示模式', auto: '自动', light: '浅色', dark: '深色',
  cache: '缓存', coverCache: '封面缓存', clearCovers: '清除封面缓存', cleared: '已清除', storageInfo: '离线暂存', failed: '操作未能启动，请重试。',
  playback: '播放', skipBack: '后退间隔', skipForward: '前进间隔', seconds: n => `${n} 秒`, autoplayNext: '自动播放下一轨', readerDefaults: '阅读',
  readDirection: '翻页方向', ltr: '从左到右', rtl: '从右到左', pageMode: '页面模式', single: '单页', spread: '双页', vertical: '纵向滚动', autoMode: '自动',
  themeBlue: '已切换为蓝色主题。', themePink: '已切换为粉色主题。', version: '版本', reduceMotion: '跟随系统减弱动态效果', smaller: '缩小文字', larger: '放大文字', copy: '复制全文', copiedText: '已复制全文',
  expand: '展开播放器', minimize: '收起播放器', close: '关闭', play: '播放', pause: '暂停', previous: '上一轨', next: '下一轨', seek: '播放进度',
  repeat: '循环', repeatAll: '列表循环', repeatOne: '单曲循环', repeatOff: '不循环', speed: '播放速度', queue: '播放队列', captions: '字幕',
  sleep: '定时关闭', sleepOff: '未设置', sleepEnd: '播完本轨', minutes: n => `${n} 分钟`, remaining: '剩余', cancelTimer: '取消定时',
  back15: '后退', fwd30: '前进', volume: '音量', mute: '静音', fullscreen: '全屏', pip: '画中画', nowPlaying: '正在播放', upNext: '接下来',
  noCaptions: '此音轨没有字幕', fromQueue: '来自', local: '本地', streaming: '在线',
  page: (n, m) => `${n} / ${m}`, prevPage: '上一页', nextPage: '下一页', thumbnails: '缩略图', readerSettings: '阅读设置', fit: '适应',
  fitScreen: '适应屏幕', fitWidth: '适应宽度', protectedPages: '这些页面受保护，需要在官方阅读器中打开。', continueFrom: n => `从第 ${n} 页继续`,
  startOver: '从头开始', finished: '已读完', loading: '加载中…', error: '出错了', offlineMode: '离线', ok: '好', confirm: '确定', back: '返回',
  returnToDLook: '返回 DLook', close2: '关闭',
};

const zhTW = {
  ...zhCN,
  navigation: 'DLook 導覽', library: '媒體庫', mylist: '我的清單', playlist: '播放清單', offline: '離線暫存', settings: '設定',
  circles: '作者/社團', voices: '聲優', audio: '音聲', video: '影片', comic: '漫畫', search: '搜尋', searchPlaceholder: '搜尋標題、社團、聲優或編號',
  sort: '排序', sortPurchased: '最近購買', sortPurchasedOld: '最早購買', sortRelease: '發售日期', sortTitle: '標題', sortCircle: '社團', sortRecent: '最近播放',
  layout: '版面', layoutGrid: '格狀', layoutList: '清單', density: '卡片大小', compact: '緊湊', comfortable: '舒適',
  emptyLibrary: '媒體庫中還沒有作品', emptyLibraryHint: '購買的作品同步後會出現在這裡。', noResults: '找不到符合的作品',
  syncing: (v, m) => m ? `正在同步 ${v}/${m}` : '正在同步…', synced: '媒體庫已是最新', syncFailed: '同步失敗，請稍後再試。',
  continue: '繼續', recent: '最近播放', count: n => `${n} 部作品`, items: n => `${n} 項`, trackCount: n => `${n} 個音軌`, hidden: '已隱藏的作品', showHidden: '查看隱藏的作品', more: '更多',
  listen: '收聽', resume: '繼續收聽', watch: '觀看', resumeWatch: '繼續觀看', read: '閱讀', resumeRead: '繼續閱讀', open: '開啟',
  files: '檔案', details: '詳細資訊', circle: '社團', cast: '聲優', release: '發售日', purchasedOn: '購買日', type: '類型', fileSize: '大小',
  saveOffline: '暫存影音', saved: '已暫存', saving: '正在暫存…', pauseSaving: '暫停暫存', resumeSaving: '繼續暫存', savedCount: (s, t) => `已暫存 ${s}/${t} 項`,
  addToList: '加入我的清單', inList: '已在我的清單', share: '分享', copied: '已複製連結', hide: '隱藏作品', unhide: '取消隱藏', hiddenDone: '已隱藏此作品',
  unhiddenDone: '已取消隱藏', openOfficial: '在官方頁面開啟', playFolder: '播放此資料夾', addToPlaylist: '加入播放清單', noFiles: '此資料夾是空的',
  loadFailed: '載入失敗', retry: '重試', authorization: '授權失敗，請確認已登入且可線上播放。', catalog: '無法讀取檔案清單，請再試一次。',
  media: '部分影音下載失敗，請再試一次。', storage: '瀏覽器無法寫入暫存，請檢查本機儲存空間。', quota: '空間不足，請刪除部分暫存作品後再試。',
  noAudio: '此作品沒有可暫存的音訊或影片。', stopped: '已暫停暫存。', newMylist: '新增我的清單', newPlaylist: '新增播放清單', listName: '清單名稱',
  create: '建立', createFailed: '建立失敗，請再試一次。', rename: '重新命名', save: '儲存', delete: '刪除', deleteConfirm: t => `刪除「${t}」？此操作無法復原。`,
  emptyMylist: '此清單還沒有作品。在作品頁點選「加入我的清單」。', emptyPlaylist: '此播放清單還沒有音軌。可從作品的檔案清單加入。',
  emptyCollections: '還沒有清單', edit: '編輯', remove: '移除', chooseList: '選擇清單', added: n => `已加入「${n}」`, removed: '已移除', updateFailed: '更新失敗，請再試一次。',
  moveUp: '上移', moveDown: '下移', offlineEmpty: '還沒有暫存作品。連線時，在已購作品頁點選「暫存影音」。', removeOffline: '刪除暫存',
  removeOfflineConfirm: t => `刪除「${t}」的本機暫存？`, removeFailed: '無法刪除暫存，請再試一次。', openFailed: '無法讀取離線暫存，請再試一次。',
  offlinePage: '開啟離線頁', offlinePageHint: '離線頁屬於瀏覽器擴充功能，斷線或無法連上 DLsite 時，點瀏覽器工具列的 DLook 圖示 →「離線播放」即可開啟。', offlineMigrated: n => `已將 ${n} 部暫存作品移入擴充功能儲存空間`, playFailed: '無法播放此項目，請嘗試重新暫存。', used: '已用空間', offlineNotice: '目前處於離線狀態，只能播放已暫存的內容。', noAccess: '目前帳號沒有此作品的播放權限', noAccessHint: '請確認登入的是購買此作品的帳號。', noAccessSaved: '目前帳號無法線上存取此作品，以下為本機暫存的內容。',
  account: '帳戶', sync: '同步媒體庫', syncRequested: '已開始同步媒體庫。', help: '說明', notifications: '通知', unread: '有未讀通知', logout: '登出',
  appearance: '外觀', accent: '主題色', blue: '藍', pink: '粉', mode: '顯示模式', auto: '自動', light: '淺色', dark: '深色', cache: '快取',
  coverCache: '封面快取', clearCovers: '清除封面快取', cleared: '已清除', storageInfo: '離線暫存', failed: '無法啟動操作，請再試一次。',
  playback: '播放', skipBack: '倒轉間隔', skipForward: '快轉間隔', seconds: n => `${n} 秒`, autoplayNext: '自動播放下一軌', readerDefaults: '閱讀',
  readDirection: '翻頁方向', ltr: '由左至右', rtl: '由右至左', pageMode: '頁面模式', single: '單頁', spread: '雙頁', vertical: '縱向捲動', autoMode: '自動',
  themeBlue: '已切換為藍色主題。', themePink: '已切換為粉色主題。', version: '版本', reduceMotion: '跟隨系統減少動態效果', smaller: '縮小文字', larger: '放大文字', copy: '複製全文', copiedText: '已複製全文', expand: '展開播放器', minimize: '收起播放器', close: '關閉',
  play: '播放', pause: '暫停', previous: '上一軌', next: '下一軌', seek: '播放位置', repeat: '重複', repeatAll: '清單重複', repeatOne: '單曲重複',
  repeatOff: '不重複', speed: '播放速度', queue: '播放佇列', captions: '字幕', sleep: '定時關閉', sleepOff: '未設定', sleepEnd: '播完本軌',
  minutes: n => `${n} 分鐘`, remaining: '剩餘', cancelTimer: '取消定時', back15: '倒轉', fwd30: '快轉', volume: '音量', mute: '靜音', fullscreen: '全螢幕',
  pip: '子母畫面', nowPlaying: '正在播放', upNext: '接下來', noCaptions: '此音軌沒有字幕', fromQueue: '來自', local: '本機', streaming: '線上',
  prevPage: '上一頁', nextPage: '下一頁', thumbnails: '縮圖', readerSettings: '閱讀設定', fit: '適應', fitScreen: '適應螢幕', fitWidth: '適應寬度',
  protectedPages: '這些頁面受保護，需要在官方閱讀器中開啟。', continueFrom: n => `從第 ${n} 頁繼續`, startOver: '從頭開始', finished: '已讀完',
  loading: '載入中…', error: '發生錯誤', offlineMode: '離線', confirm: '確定', back: '返回', returnToDLook: '返回 DLook', close2: '關閉',
};

const en = {
  navigation: 'DLook navigation', library: 'Library', mylist: 'My lists', playlist: 'Playlists', offline: 'Offline', settings: 'Settings',
  works: 'Works', circles: 'Circles', voices: 'Voices', all: 'All', audio: 'Audio', video: 'Video', comic: 'Comics', other: 'Other',
  search: 'Search', searchPlaceholder: 'Title, circle, voice actor or ID', sort: 'Sort', sortPurchased: 'Recently purchased', sortPurchasedOld: 'Oldest purchase',
  sortRelease: 'Release date', sortTitle: 'Title', sortCircle: 'Circle', sortRecent: 'Recently played', layout: 'Layout', layoutGrid: 'Grid', layoutList: 'List',
  density: 'Card size', compact: 'Compact', comfortable: 'Comfortable',
  emptyLibrary: 'Your library is empty', emptyLibraryHint: 'Purchased works appear here after syncing.', noResults: 'No matching works',
  syncing: (v, m) => m ? `Syncing ${v}/${m}` : 'Syncing…', synced: 'Library is up to date', syncFailed: 'Sync failed. Try again later.',
  continue: 'Continue', recent: 'Recently played', count: n => `${n} ${n === 1 ? 'work' : 'works'}`, items: n => `${n} ${n === 1 ? 'item' : 'items'}`, trackCount: n => `${n} ${n === 1 ? 'track' : 'tracks'}`,
  hidden: 'Hidden works', showHidden: 'Show hidden works', more: 'More', ageAll: 'All ages', series: 'Series',
  listen: 'Listen', resume: 'Resume', watch: 'Watch', resumeWatch: 'Resume', read: 'Read', resumeRead: 'Resume', open: 'Open',
  files: 'Files', details: 'Details', circle: 'Circle', authors: 'Authors', cast: 'Voices', release: 'Released', purchasedOn: 'Purchased', type: 'Type', fileSize: 'Size',
  saveOffline: 'Save offline', saved: 'Saved offline', saving: 'Saving…', pauseSaving: 'Pause saving', resumeSaving: 'Resume saving',
  savedCount: (s, t) => `${s} of ${t} items saved`, addToList: 'Add to list', inList: 'In your lists', share: 'Share', copied: 'Link copied',
  hide: 'Hide work', unhide: 'Unhide', hiddenDone: 'Work hidden', unhiddenDone: 'Work unhidden', openOfficial: 'Open in DLsite Play',
  playFolder: 'Play this folder', addToPlaylist: 'Add to playlist', noFiles: 'This folder is empty', loadFailed: 'Could not load', retry: 'Retry',
  authorization: 'Authorization failed. Check that you can play this work online.', catalog: 'Could not load the file list. Try again.',
  media: 'Some audio or video could not be downloaded. Try again.', storage: 'Could not write the offline copy. Check browser storage.',
  quota: 'Storage is full. Remove some saved works and try again.', noAudio: 'This work has no audio or video to save.', stopped: 'Saving paused.',
  newMylist: 'New list', newPlaylist: 'New playlist', listName: 'List name', cancel: 'Cancel', create: 'Create', createFailed: 'Could not create the list. Try again.',
  rename: 'Rename', save: 'Save', delete: 'Delete', deleteConfirm: t => `Delete “${t}”? This cannot be undone.`, playAll: 'Play all', shuffle: 'Shuffle',
  emptyMylist: 'No works yet. Use “Add to list” on a work.', emptyPlaylist: 'No tracks yet. Add them from a work’s file list.',
  emptyCollections: 'No lists yet', edit: 'Edit', done: 'Done', remove: 'Remove', chooseList: 'Choose a list', added: n => `Added to “${n}”`,
  removed: 'Removed', updateFailed: 'Could not update. Try again.', moveUp: 'Move up', moveDown: 'Move down',
  offlineEmpty: 'No saved works yet. While online, open a purchased work and select “Save offline.”', removeOffline: 'Remove offline copy',
  removeOfflineConfirm: t => `Remove the offline copy of “${t}”?`, removeFailed: 'Could not remove the offline copy.', openFailed: 'Could not read offline copies.',
  offlinePage: 'Open offline page', offlinePageHint: 'The offline page belongs to the browser extension. When you are offline or cannot reach DLsite, open it from the DLook toolbar icon → “Offline playback.”', offlineMigrated: n => `Moved ${n} saved work${n === 1 ? '' : 's'} into extension storage`, playFailed: 'Could not play this item. Try saving it again.', used: 'Used', offlineNotice: 'You are offline. Only saved items can play.', noAccess: 'This account cannot play this work', noAccessHint: 'Check that you are signed in with the account that bought it.', noAccessSaved: 'This account cannot access the work online. Showing the offline copy.',
  account: 'Account', sync: 'Sync library', syncRequested: 'Library sync started.', dlsite: 'Back to DLsite', help: 'Help', notifications: 'Notices',
  unread: 'Unread notices', logout: 'Log out', appearance: 'Appearance', accent: 'Accent', blue: 'Blue', pink: 'Pink', mode: 'Mode', auto: 'Auto', light: 'Light', dark: 'Dark',
  cache: 'Cache', coverCache: 'Cover cache', clearCovers: 'Clear cover cache', cleared: 'Cleared', storageInfo: 'Offline storage', failed: 'Could not start this action.',
  playback: 'Playback', skipBack: 'Skip back', skipForward: 'Skip forward', seconds: n => `${n}s`, autoplayNext: 'Play next track automatically', readerDefaults: 'Reading',
  readDirection: 'Page direction', ltr: 'Left to right', rtl: 'Right to left', pageMode: 'Page mode', single: 'Single', spread: 'Spread', vertical: 'Scroll', autoMode: 'Auto',
  themeBlue: 'Switched to the blue theme.', themePink: 'Switched to the pink theme.', version: 'Version', reduceMotion: 'Follow system Reduce Motion', smaller: 'Smaller text', larger: 'Larger text', copy: 'Copy all', copiedText: 'Text copied',
  expand: 'Expand player', minimize: 'Minimize player', close: 'Close', play: 'Play', pause: 'Pause', previous: 'Previous', next: 'Next', seek: 'Playback position',
  repeat: 'Repeat', repeatAll: 'Repeat all', repeatOne: 'Repeat one', repeatOff: 'Repeat off', speed: 'Speed', queue: 'Queue', captions: 'Captions',
  sleep: 'Sleep timer', sleepOff: 'Off', sleepEnd: 'End of track', minutes: n => `${n} min`, remaining: 'Remaining', cancelTimer: 'Cancel timer',
  back15: 'Back', fwd30: 'Forward', volume: 'Volume', mute: 'Mute', fullscreen: 'Full screen', pip: 'Picture in picture', nowPlaying: 'Now playing', upNext: 'Up next',
  noCaptions: 'No captions for this track', fromQueue: 'From', local: 'Saved', streaming: 'Online',
  page: (n, m) => `${n} / ${m}`, prevPage: 'Previous page', nextPage: 'Next page', thumbnails: 'Pages', readerSettings: 'Reader settings', fit: 'Fit',
  fitScreen: 'Fit screen', fitWidth: 'Fit width', protectedPages: 'These pages are protected and open in the official viewer.',
  continueFrom: n => `Continue from page ${n}`, startOver: 'Start over', finished: 'Finished', loading: 'Loading…', error: 'Something went wrong',
  offlineMode: 'Offline', ok: 'OK', confirm: 'Confirm', back: 'Back', returnToDLook: 'Back to DLook', close2: 'Close',
};

const ja = {
  ...en,
  navigation: 'DLook ナビゲーション', library: 'ライブラリ', mylist: 'マイリスト', playlist: 'プレイリスト', offline: 'オフライン', settings: '設定',
  works: '作品', circles: '作者・サークル', voices: '声優', all: 'すべて', audio: '音声', video: '動画', comic: 'マンガ', other: 'その他',
  search: '検索', searchPlaceholder: 'タイトル・サークル・声優・作品番号', sort: '並び替え', sortPurchased: '購入日が新しい順', sortPurchasedOld: '購入日が古い順',
  sortRelease: '発売日順', sortTitle: 'タイトル順', sortCircle: 'サークル順', sortRecent: '最近再生した順', layout: 'レイアウト', layoutGrid: 'グリッド', layoutList: 'リスト',
  density: 'カードサイズ', compact: 'コンパクト', comfortable: 'ゆったり',
  emptyLibrary: 'ライブラリに作品がありません', emptyLibraryHint: '購入した作品は同期後にここに表示されます。', noResults: '該当する作品がありません',
  syncing: (v, m) => m ? `同期中 ${v}/${m}` : '同期中…', synced: 'ライブラリは最新です', syncFailed: '同期できませんでした。',
  continue: '続きから', recent: '最近再生', count: n => `${n} 作品`, items: n => `${n} 件`, trackCount: n => `${n} トラック`, hidden: '非表示の作品', showHidden: '非表示の作品を見る', more: 'その他',
  listen: '再生', resume: '続きを聴く', watch: '再生', resumeWatch: '続きを見る', read: '読む', resumeRead: '続きを読む', open: '開く',
  files: 'ファイル', details: '詳細', circle: 'サークル', authors: '作者', cast: '声優', release: '発売日', purchasedOn: '購入日', type: '種類', fileSize: 'サイズ',
  saveOffline: '音声・動画を保存', saved: '保存済み', saving: '保存中…', pauseSaving: '保存を一時停止', resumeSaving: '保存を再開',
  savedCount: (s, t) => `${t} 件中 ${s} 件を保存済み`, addToList: 'マイリストに追加', inList: 'マイリスト登録済み', share: '共有', copied: 'リンクをコピーしました',
  hide: '作品を非表示', unhide: '非表示を解除', hiddenDone: '作品を非表示にしました', unhiddenDone: '非表示を解除しました', openOfficial: '公式ページで開く',
  playFolder: 'このフォルダを再生', addToPlaylist: 'プレイリストに追加', noFiles: 'このフォルダは空です', loadFailed: '読み込めませんでした', retry: '再試行',
  authorization: '認証できません。ログイン状態と再生権限を確認してください。', catalog: 'ファイル一覧を取得できません。',
  media: '一部の音声・動画をダウンロードできませんでした。', storage: '保存できません。ブラウザのストレージを確認してください。',
  quota: '空き容量が不足しています。', noAudio: '保存できる音声・動画がありません。', stopped: '保存を一時停止しました。',
  newMylist: 'マイリストを作成', newPlaylist: 'プレイリストを作成', listName: 'リスト名', cancel: 'キャンセル', create: '作成', createFailed: '作成できませんでした。',
  rename: '名前を変更', save: '保存', delete: '削除', deleteConfirm: t => `「${t}」を削除しますか？`, playAll: 'すべて再生', shuffle: 'シャッフル',
  emptyMylist: '作品がありません。作品ページの「マイリストに追加」から登録できます。', emptyPlaylist: 'トラックがありません。作品のファイル一覧から追加できます。',
  emptyCollections: 'リストがありません', edit: '編集', done: '完了', remove: '削除', chooseList: 'リストを選択', added: n => `「${n}」に追加しました`,
  removed: '削除しました', updateFailed: '更新できませんでした。', moveUp: '上へ', moveDown: '下へ',
  offlineEmpty: 'オンライン時に購入済みの作品ページから音声・動画を保存できます。', removeOffline: '保存を削除', removeOfflineConfirm: t => `「${t}」の保存データを削除しますか？`,
  removeFailed: '削除できませんでした。', openFailed: '保存データを読み込めませんでした。', playFailed: 'この項目を再生できません。', used: '使用量',
  offlinePage: 'オフラインページを開く', offlinePageHint: 'オフラインページは拡張機能の一部です。オフライン時や DLsite に接続できないときは、ツールバーの DLook アイコン →「オフライン再生」から開けます。', offlineMigrated: n => `保存済みの ${n} 作品を拡張機能のストレージに移動しました`,
  offlineNotice: 'オフラインです。保存済みの項目のみ再生できます。', noAccess: 'このアカウントではこの作品を再生できません', noAccessHint: '購入したアカウントでログインしているか確認してください。', noAccessSaved: 'オンラインで利用できないため、保存済みのデータを表示しています。',
  account: 'アカウント', sync: 'ライブラリを同期', syncRequested: '同期をリクエストしました。', dlsite: 'DLsiteへ', help: 'ヘルプ', notifications: 'お知らせ',
  unread: '未読のお知らせがあります', logout: 'ログアウト', appearance: '外観', accent: 'テーマ色', blue: 'ブルー', pink: 'ピンク', mode: '表示モード', auto: '自動', light: 'ライト', dark: 'ダーク',
  cache: 'キャッシュ', coverCache: 'カバー画像', clearCovers: 'カバーのキャッシュを削除', cleared: '削除しました', storageInfo: 'オフライン保存', failed: '操作を開始できませんでした。',
  playback: '再生', skipBack: '戻る秒数', skipForward: '進む秒数', seconds: n => `${n} 秒`, autoplayNext: '次のトラックを自動再生', readerDefaults: '閲覧',
  readDirection: 'めくり方向', ltr: '左から右', rtl: '右から左', pageMode: 'ページ表示', single: '単ページ', spread: '見開き', vertical: '縦スクロール', autoMode: '自動',
  themeBlue: 'ブルーのテーマに切り替えました。', themePink: 'ピンクのテーマに切り替えました。', version: 'バージョン', reduceMotion: 'システムの視差効果を減らす設定に従う', smaller: '文字を小さく', larger: '文字を大きく', copy: 'すべてコピー', copiedText: 'コピーしました',
  expand: 'プレーヤーを開く', minimize: 'プレーヤーを縮小', close: '閉じる', play: '再生', pause: '一時停止', previous: '前のトラック', next: '次のトラック', seek: '再生位置',
  repeat: 'リピート', repeatAll: '全曲リピート', repeatOne: '1曲リピート', repeatOff: 'リピートなし', speed: '再生速度', queue: '再生キュー', captions: '字幕',
  sleep: 'スリープタイマー', sleepOff: 'オフ', sleepEnd: 'トラックの終わり', minutes: n => `${n} 分`, remaining: '残り', cancelTimer: 'タイマーを解除',
  back15: '戻る', fwd30: '進む', volume: '音量', mute: 'ミュート', fullscreen: '全画面', pip: 'ピクチャー・イン・ピクチャー', nowPlaying: '再生中', upNext: '次に再生',
  noCaptions: '字幕はありません', fromQueue: '再生元', local: '保存済み', streaming: 'オンライン',
  prevPage: '前のページ', nextPage: '次のページ', thumbnails: 'ページ一覧', readerSettings: 'ビューア設定', fit: 'フィット', fitScreen: '画面に合わせる', fitWidth: '幅に合わせる',
  protectedPages: '保護されたページは公式ビューアで開きます。', continueFrom: n => `${n} ページから続ける`, startOver: '最初から', finished: '読了',
  loading: '読み込み中…', error: 'エラーが発生しました', offlineMode: 'オフライン', confirm: 'OK', back: '戻る', returnToDLook: 'DLook に戻る', close2: '閉じる',
};

const ko = {
  ...en,
  navigation: 'DLook 탐색', library: '라이브러리', mylist: '내 목록', playlist: '재생 목록', offline: '오프라인', settings: '설정',
  works: '작품', circles: '작가/서클', voices: '성우', all: '전체', audio: '음성', video: '동영상', comic: '만화', other: '기타',
  search: '검색', searchPlaceholder: '제목, 서클, 성우 또는 작품 번호', sort: '정렬', sortPurchased: '최근 구매순', sortPurchasedOld: '오래된 구매순',
  sortRelease: '발매일순', sortTitle: '제목순', sortCircle: '서클순', sortRecent: '최근 재생순', layout: '레이아웃', layoutGrid: '그리드', layoutList: '목록',
  emptyLibrary: '라이브러리에 작품이 없습니다', emptyLibraryHint: '구매한 작품은 동기화 후 여기에 표시됩니다.', noResults: '일치하는 작품이 없습니다',
  syncing: (v, m) => m ? `동기화 중 ${v}/${m}` : '동기화 중…', synced: '라이브러리가 최신입니다', continue: '이어서', recent: '최근 재생',
  count: n => `작품 ${n}개`, items: n => `${n}개`, trackCount: n => `트랙 ${n}개`, hidden: '숨긴 작품', showHidden: '숨긴 작품 보기', more: '더 보기',
  listen: '재생', resume: '이어 듣기', watch: '재생', resumeWatch: '이어 보기', read: '읽기', resumeRead: '이어 읽기', open: '열기',
  files: '파일', details: '정보', circle: '서클', authors: '작가', cast: '성우', release: '발매일', purchasedOn: '구매일', type: '유형', fileSize: '크기',
  saveOffline: '오디오·동영상 저장', saved: '저장됨', saving: '저장 중…', pauseSaving: '저장 일시 중지', resumeSaving: '저장 계속하기',
  savedCount: (s, t) => `${t}개 중 ${s}개 저장됨`, addToList: '내 목록에 추가', inList: '내 목록에 있음', share: '공유', copied: '링크를 복사했습니다',
  hide: '작품 숨기기', unhide: '숨기기 해제', openOfficial: '공식 페이지에서 열기', playFolder: '이 폴더 재생', addToPlaylist: '재생 목록에 추가', retry: '다시 시도',
  newMylist: '내 목록 만들기', newPlaylist: '재생 목록 만들기', listName: '목록 이름', cancel: '취소', create: '만들기', rename: '이름 변경', save: '저장', delete: '삭제',
  deleteConfirm: t => `“${t}”을(를) 삭제할까요?`, playAll: '모두 재생', shuffle: '셔플 재생', edit: '편집', done: '완료', remove: '삭제',
  offlineEmpty: '온라인 상태에서 구매한 작품 페이지의 저장 버튼을 누르세요.', removeOffline: '저장 삭제', removeOfflineConfirm: t => `“${t}”의 저장 데이터를 삭제할까요?`,
  account: '계정', sync: '라이브러리 동기화', syncRequested: '라이브러리 동기화를 요청했습니다.', dlsite: 'DLsite로', help: '도움말', notifications: '알림',
  unread: '읽지 않은 알림', logout: '로그아웃', appearance: '모양', accent: '테마 색', blue: '파랑', pink: '분홍', mode: '모드', auto: '자동', light: '라이트', dark: '다크',
  themeBlue: '파란색 테마로 바꿨습니다.', themePink: '분홍색 테마로 바꿨습니다.',
  expand: '플레이어 펼치기', minimize: '플레이어 접기', close: '닫기', play: '재생', pause: '일시정지', previous: '이전 트랙', next: '다음 트랙', seek: '재생 위치',
  repeat: '반복', speed: '재생 속도', queue: '재생 대기열', captions: '자막', sleep: '취침 타이머', sleepOff: '꺼짐', minutes: n => `${n}분`, remaining: '남은 시간',
  cancelTimer: '타이머 취소', loading: '불러오는 중…', back: '뒤로', returnToDLook: 'DLook으로 돌아가기',
};

const dictionaries = { 'zh-cn': zhCN, zh: zhCN, 'zh-tw': zhTW, 'zh-hk': zhTW, ja, en, ko };
let current = en;
let language = 'en';
const listeners = new Set();

export function detect() {
  const raw = (document.documentElement.lang || navigator.language || 'en').toLowerCase().replaceAll('_', '-');
  if (raw.startsWith('zh')) return /tw|hk|hant/.test(raw) ? 'zh-tw' : 'zh-cn';
  const base = raw.split('-')[0];
  return dictionaries[base] ? base : 'en';
}

export function setLanguage(next) {
  if (next === language && current) return;
  language = next;
  current = dictionaries[next] ?? en;
  for (const listener of listeners) listener(next);
}

export const lang = () => language;
export const onLanguage = listener => { listeners.add(listener); return () => listeners.delete(listener); };

/** Translates a key; function entries receive the extra arguments. */
export function t(key, ...args) {
  const value = current[key] ?? en[key] ?? zhCN[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
}

/** Picks a localized name from DLsite's { ja_JP, zh_CN, en_US, ... } objects. */
export function localized(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const locale = { 'zh-cn': ['zh_CN', 'zh_TW'], 'zh-tw': ['zh_TW', 'zh_CN'], ja: ['ja_JP'], ko: ['ko_KR'], en: ['en_US'] }[language] ?? ['en_US'];
  for (const key of [...locale, 'ja_JP', 'en_US']) if (value[key]) return value[key];
  return Object.values(value).find(Boolean) ?? '';
}

setLanguage(detect());
