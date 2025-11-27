// OP-TCG DB PWA メインスクリプト

(function() {
    'use strict';

    // === 0. 設定読み込み (config.js依存) ===
    const Config = window.AppConfig || {
        env: 'production',
        isBeta: false,
        dbName: 'OPCardDB',
        dbVersion: 3,
        cacheNames: { appShell: 'app-shell-v1', images: 'card-images-v1' },
        appVersion: '1.1.0',
        paths: { cardsJson: './cards.json', serviceWorker: './service-worker.js' }
    };

    // === 1. グローバル変数と定数 ===
    const DB_NAME = Config.dbName;
    const DB_VERSION = Config.dbVersion;
    const STORE_CARDS = 'cards';
    const STORE_METADATA = 'metadata';
    const STORE_DECKS = 'decks';
    const CARDS_JSON_PATH = Config.paths.cardsJson;
    const APP_VERSION = Config.appVersion;
    const SERVICE_WORKER_PATH = Config.paths.serviceWorker;
    const CACHE_IMAGES = Config.cacheNames.images;

    let db; 
    let allCards = [];
    let currentFilter = {}; 
    let swRegistration; 

    // --- アプリ状態管理 ---
    // currentMode: 'view' | 'leader_select' | 'deck_edit'
    let currentMode = 'view'; 
    let editingDeckId = null;
    let editingDeckData = {}; 
    let editingDeckMeta = {}; 

    // --- ライトボックス用 ---
    let currentFilteredCards = []; 
    
    // --- タッチイベント制御用 ---
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    let isLongPress = false;
    let longPressTimer = null;
    let activeCardIndex = -1;

    // === 2. DOM要素のキャッシュ ===
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);
    let dom = {};

    // ヘルパー関数
    function toKatakana(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
    }
    function toHalfWidth(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[\uFF01-\uFF5E]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
    }

    // === 3. 初期化処理 ===
    function cacheDomElements() {
        dom = {
            loadingIndicator: $('#loading-indicator'),
            mainContent: $('#main-content'),
            cardListView: $('#card-list-view'),
            cardListContainer: $('#card-list-container'),
            deckListView: $('#deck-list-view'),
            deckListContainer: $('#deck-list-container'),
            modeMessageBar: $('#mode-message-bar'), // 新規

            searchBar: $('#search-bar'),
            clearSearchBtn: $('#clear-search-btn'),
            filterBtn: $('#filter-btn'),
            envBadge: $('#env-badge'),
            cacheProgressContainer: $('#cache-progress-container'),
            cacheProgressBar: $('#cache-progress-bar'),
            cacheProgressText: $('#cache-progress-text'),

            navCards: $('#nav-cards'),
            navDecks: $('#nav-decks'),
            columnToggleBtn: $('#column-toggle-btn'),
            columnCountDisplay: $('#column-count-display'),
            settingsBtn: $('#settings-btn'),
            
            deckStatusBar: $('#deck-status-bar'),
            deckStatusInfo: $('#deck-status-info'),
            deckSaveBtn: $('#deck-save-btn'),
            createNewDeckBtn: $('#create-new-deck-btn'),
    
            filterModal: $('#filter-modal'),
            closeFilterModalBtn: $('#close-filter-modal-btn'),
            filterOptionsContainer: $('#filter-options-container'),
            applyFilterBtn: $('#apply-filter-btn'),
            resetFilterBtn: $('#reset-filter-btn'),
            filterSeries: $('#filter-series'),
    
            settingsModal: $('#settings-modal'),
            closeSettingsModalBtn: $('#close-settings-modal-btn'),
            cacheAllImagesBtn: $('#cache-all-images-btn'),
            clearAllDataBtn: $('#clear-all-data-btn'),
            appVersionInfo: $('#app-version-info'),
            envInfo: $('#env-info'),
            cardDataVersionInfo: $('#card-data-version-info'),

            lightboxModal: $('#lightbox-modal'),
            lightboxImage: $('#lightbox-image'),
            lightboxFallback: $('#lightbox-fallback'),
            lightboxCloseBtn: $('#lightbox-close-btn'),
    
            // 通知関連...
            messageToast: $('#message-toast'),
            messageToastText: $('#message-toast-text'),
            messageToastDismissBtn: $('#message-toast-dismiss-btn'),
            // ...他の通知要素は省略（既存コード参照）
             dbUpdateNotification: $('#db-update-notification'),
            dbUpdateApplyBtn: $('#db-update-apply-btn'),
            dbUpdateDismissBtn: $('#db-update-dismiss-btn'),
            appUpdateNotification: $('#app-update-notification'),
            appUpdateApplyBtn: $('#app-update-apply-btn'),
        };
    }

    async function initializeApp() {
        console.log(`PWA Initializing... (${Config.env})`);
        cacheDomElements();
        
        if (dom.appVersionInfo) dom.appVersionInfo.textContent = APP_VERSION;
        if (dom.envInfo) dom.envInfo.textContent = Config.isBeta ? 'BETA' : 'Production';
        if (Config.isBeta && dom.envBadge) dom.envBadge.style.display = 'block';

        registerServiceWorker();
        setupEventListeners();
        try {
            await initDB();
        } catch (dbError) {
            console.error("Critical error:", dbError);
            return;
        }
        if (db) await checkCardDataVersion();
        setDefaultColumnLayout();
    }

    // === 4. データ管理 (DB, JSON) ===
    // ※ 既存の initDB, checkCardDataVersion, fetchAndUpdateCardData, loadCardsFromDB は変更なし
    async function initDB() {
        try {
            db = await idb.openDB(DB_NAME, DB_VERSION, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    if (!db.objectStoreNames.contains(STORE_CARDS)) db.createObjectStore(STORE_CARDS, { keyPath: 'cardNumber' });
                    if (!db.objectStoreNames.contains(STORE_METADATA)) db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
                    if (!db.objectStoreNames.contains(STORE_DECKS)) {
                        const deckStore = db.createObjectStore(STORE_DECKS, { keyPath: 'id' });
                        deckStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    }
                },
            });
        } catch (error) { console.error(error); }
    }

    async function checkCardDataVersion() {
        if (!db) return;
        await loadCardsFromDB();
        // オンラインチェック省略（既存コードと同様）
    }
    
    async function fetchAndUpdateCardData(serverLastModified) {
        // 既存コードと同様
         if (!db) return;
        dom.loadingIndicator.style.display = 'flex';
        dom.loadingIndicator.querySelector('p').textContent = 'カードデータを更新中...';
        
        try {
            const response = await fetch(CARDS_JSON_PATH, { cache: 'no-store' });
            const cardsData = await response.json();
            let cardsArray = Array.isArray(cardsData) ? cardsData : Object.values(cardsData).flat();
            
            const tx = db.transaction([STORE_CARDS, STORE_METADATA], 'readwrite');
            const cardStore = tx.objectStore(STORE_CARDS);
            await cardStore.clear();
            for (const card of cardsArray) {
                if (card && card.cardNumber) await cardStore.put(card);
            }
            await tx.objectStore(STORE_METADATA).put({ key: 'cardsLastModified', value: serverLastModified });
            await tx.done;
            
            showMessageToast(`カードデータを更新しました (${cardsArray.length}枚)`, 'success');
            await loadCardsFromDB();
        } catch (e) {
            console.error(e);
            showMessageToast('更新に失敗しました', 'error');
        } finally {
            dom.loadingIndicator.style.display = 'none';
        }
    }

    async function loadCardsFromDB() {
        if (!db) return;
        allCards = await db.getAll(STORE_CARDS);
        if (allCards.length > 0) {
            dom.loadingIndicator.style.display = 'none';
            populateFilters();
            applyFiltersAndDisplay();
        }
    }

    // === 5. カード表示 & デッキ操作ロジック ===

    function getGeneratedImagePath(cardNumber) {
        if (!cardNumber) return '';
        const parts = cardNumber.split('-');
        if (parts.length < 2) return '';
        return `Cards/${parts[0]}/${cardNumber}.jpg`;
    }

    function displayCards(cards) {
        const fragment = document.createDocumentFragment();
        dom.cardListContainer.innerHTML = '';

        if (cards.length === 0) {
            dom.cardListContainer.innerHTML = '<p class="no-results">該当するカードがありません。</p>';
            return;
        }

        // ★ パフォーマンス改善: 
        // requestAnimationFrameを使ってチャンク（分割）レンダリングするか、
        // CSSのcontent-visibilityに頼る。今回はCSSで対応済みだが、
        // DOM操作を最小限にするため、DocumentFragmentを使用。
        
        cards.forEach((card, index) => {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            cardItem.dataset.index = index;
            cardItem.dataset.id = card.cardNumber;
            
            // 画像パス
            let largeImagePath = card.imagePath || getGeneratedImagePath(card.cardNumber);
            if(largeImagePath.startsWith('Cards/')) largeImagePath = './' + largeImagePath;

            const img = document.createElement('img');
            img.className = 'card-image';
            img.src = largeImagePath;
            img.alt = card.cardName || card.cardNumber;
            img.loading = 'lazy'; // 遅延読み込み
            img.decoding = 'async'; // 非同期デコード

            img.onerror = () => {
                const fallback = document.createElement('div');
                fallback.className = 'card-fallback';
                fallback.textContent = card.cardNumber;
                if(cardItem.contains(img)) cardItem.replaceChild(fallback, img);
            };
            
            cardItem.appendChild(img);

            // デッキ編集モード時: 枚数バッジ
            if (currentMode === 'deck_edit' && editingDeckData[card.cardNumber]) {
                const count = editingDeckData[card.cardNumber];
                const badge = document.createElement('div');
                badge.className = 'card-badge';
                badge.textContent = count;
                badge.dataset.count = count;
                cardItem.appendChild(badge);
            }

            fragment.appendChild(cardItem);
        });

        dom.cardListContainer.appendChild(fragment);
    }

    // --- タッチイベントハンドラ ---
    function setupCardTouchEvents() {
        const container = dom.cardListContainer;
        
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            const cardItem = e.target.closest('.card-item');
            if (!cardItem) return;

            activeCardIndex = parseInt(cardItem.dataset.index, 10);
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchMoved = false;
            isLongPress = false;

            longPressTimer = setTimeout(() => {
                if (!touchMoved) {
                    isLongPress = true;
                    if (navigator.vibrate) navigator.vibrate(50);
                    showLightbox(activeCardIndex);
                }
            }, 500); // 500ms長押し
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (touchMoved) return;
            if (Math.abs(e.touches[0].clientX - touchStartX) > 10 || Math.abs(e.touches[0].clientY - touchStartY) > 10) {
                touchMoved = true;
                clearTimeout(longPressTimer);
            }
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
            if (isLongPress || touchMoved || activeCardIndex === -1) {
                activeCardIndex = -1;
                return;
            }
            
            // タップ確定
            if(e.cancelable) e.preventDefault(); // クリックイベント重複防止
            handleCardTap(activeCardIndex);
            activeCardIndex = -1;
        });
    }

    function handleCardTap(index) {
        if (index < 0 || index >= currentFilteredCards.length) return;
        const card = currentFilteredCards[index];
        
        if (currentMode === 'leader_select') {
            // リーダー選択モード: 即座にデッキ作成へ
            confirmLeaderSelection(card);
        } else if (currentMode === 'deck_edit') {
            // デッキ編集モード: 枚数変更
            toggleDeckCardCount(card.cardNumber);
        } else {
            // 閲覧モード: 拡大
            showLightbox(index);
        }
    }

    // リーダー選択確定
    async function confirmLeaderSelection(card) {
        if (!confirm(`「${card.cardName}」をリーダーにしますか？`)) return;
        
        const newDeck = {
            id: crypto.randomUUID(),
            name: '新規デッキ', // 後で変更可能にするか、ここで入力させる
            leader: card.cardNumber,
            cards: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // デッキを保存して編集開始
        await saveDeck(newDeck);
        startDeckEdit(newDeck);
    }

    // デッキ内カード枚数トグル (0-4)
    function toggleDeckCardCount(cardNumber) {
        let count = editingDeckData[cardNumber] || 0;
        count++;
        if (count > 4) count = 0;

        if (count === 0) delete editingDeckData[cardNumber];
        else editingDeckData[cardNumber] = count;

        // ★パフォーマンス改善: 全再描画せず、バッジのみ更新
        const cardItem = dom.cardListContainer.querySelector(`.card-item[data-id="${cardNumber}"]`);
        if (cardItem) {
            let badge = cardItem.querySelector('.card-badge');
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'card-badge';
                    cardItem.appendChild(badge);
                }
                badge.textContent = count;
                badge.dataset.count = count;
            } else {
                if (badge) badge.remove();
            }
        }
        updateDeckStatusBar();
    }

    function updateDeckStatusBar() {
        const total = Object.values(editingDeckData).reduce((sum, num) => sum + num, 0);
        dom.deckStatusInfo.textContent = `デッキ編集中: ${total}/50枚`;
        dom.deckStatusInfo.style.color = (total === 50) ? '#03dac6' : 'white';
    }

    // === 6. デッキ管理 ===

    async function loadDeckList() {
        if (!db) return;
        const tx = db.transaction(STORE_DECKS, 'readonly');
        const decks = await tx.store.getAll();
        decks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        dom.deckListContainer.innerHTML = '';
        if (decks.length === 0) {
            dom.deckListContainer.innerHTML = '<p style="text-align:center; padding:20px;">デッキがありません。</p>';
            return;
        }
        
        decks.forEach(deck => {
            const el = document.createElement('div');
            el.className = 'deck-item';
            el.innerHTML = `
                <div class="deck-info">
                    <div class="deck-name">${deck.name}</div>
                    <div class="deck-meta">更新: ${new Date(deck.updatedAt).toLocaleDateString()}</div>
                </div>
                <div class="deck-actions">
                    <button class="deck-btn btn-edit">編集</button>
                    <button class="deck-btn btn-delete">削除</button>
                </div>
            `;
            // イベントリスナー設定
            el.querySelector('.btn-edit').onclick = () => startDeckEdit(deck);
            el.querySelector('.btn-delete').onclick = () => deleteDeck(deck.id);
            dom.deckListContainer.appendChild(el);
        });
    }

    function startLeaderSelection() {
        currentMode = 'leader_select';
        dom.deckListView.style.display = 'none';
        dom.cardListView.style.display = 'block';
        dom.modeMessageBar.style.display = 'block';
        dom.modeMessageBar.textContent = 'リーダーカードを選択してください';
        
        // 検索条件リセット＆リーダーのみ表示
        dom.searchBar.value = '';
        currentFilter = {}; // フィルタクリア
        
        applyFiltersAndDisplay(); // ここで自動的に LEADER フィルタがかかる
    }

    async function startDeckEdit(deck) {
        currentMode = 'deck_edit';
        editingDeckId = deck.id;
        editingDeckData = { ...deck.cards };
        editingDeckMeta = { name: deck.name, leader: deck.leader };

        dom.deckListView.style.display = 'none';
        dom.cardListView.style.display = 'block';
        dom.deckStatusBar.classList.add('active');
        dom.modeMessageBar.style.display = 'none'; // メッセージバー非表示

        updateDeckStatusBar();
        applyFiltersAndDisplay(); // リーダー除外フィルタがかかる
    }

    async function saveDeck(deck) {
        if (!db) return;
        const tx = db.transaction(STORE_DECKS, 'readwrite');
        await tx.store.put(deck);
        await tx.done;
    }

    async function saveCurrentDeck() {
        if (!editingDeckId) return;
        const deck = {
            id: editingDeckId,
            name: editingDeckMeta.name, // 名前編集機能は別途必要だが今回は簡易維持
            leader: editingDeckMeta.leader,
            cards: editingDeckData,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString() // 簡易
        };
        await saveDeck(deck);
        showMessageToast("デッキを保存しました", "success");
        
        // 編集終了 -> デッキ一覧へ
        currentMode = 'view';
        editingDeckId = null;
        dom.deckStatusBar.classList.remove('active');
        
        dom.cardListView.style.display = 'none';
        dom.deckListView.style.display = 'block';
        loadDeckList();
    }

    async function deleteDeck(id) {
        if(!confirm('デッキを削除しますか？')) return;
        await db.delete(STORE_DECKS, id);
        loadDeckList();
    }

    // === 7. フィルタロジック (モードによる強制フィルタ) ===

    function populateFilters() {
         // 簡略化のため既存コードのロジックを維持しつつ生成
         // (実際にはここに全フィルタ生成コードが入る)
         if (allCards.length === 0) return;
         
         // ... フィルタ生成ロジック (色は省略) ...
         const colors = new Set();
         const types = new Set();
         const rarities = new Set();
         const costs = new Set();
         const seriesSet = new Map();

         allCards.forEach(card => {
             if (!card.cardNumber) return;
             if (Array.isArray(card.color)) card.color.forEach(c => colors.add(c));
             if(card.cardType && card.cardType !== 'ドン!!') types.add(card.cardType);
             if(card.rarity) rarities.add(card.rarity);
             if(card.cost !== undefined && card.cost !== null) costs.add(card.cost);
             const sid = card.cardNumber.split('-')[0];
             if(sid) seriesSet.set(sid, sid);
         });
         
         // ソートしてDOM生成 (省略形)
         const sortedColors = [...colors].sort();
         // ...
         dom.filterOptionsContainer.innerHTML = `
            ${createFilterGroup('colors', '色', sortedColors, 'colors')}
            ${createFilterGroup('types', '種別', [...types].sort(), 'types')}
            ${createFilterGroup('rarities', 'レアリティ', [...rarities].sort(), 'rarities')}
            ${createFilterGroup('costs', 'コスト', [...costs].map(String).sort((a,b)=>a-b), 'costs')}
            <!-- シリーズフィルタは省略 -->
         `;
    }

    function createFilterGroup(name, legend, options, gridClass='') {
        if(options.length === 0) return '';
        const html = options.map(opt => `
            <label class="filter-checkbox-label" data-color="${name === 'colors' ? opt : ''}">
                <input type="checkbox" class="filter-checkbox" name="${name}" value="${opt}">
                <span class="filter-checkbox-ui">${opt}</span>
            </label>`).join('');
        return `<fieldset class="filter-group"><legend>${legend}</legend><div class="filter-grid ${gridClass}">${html}</div></fieldset>`;
    }

    function applyFiltersAndDisplay() {
        if (allCards.length === 0) return;
        
        let searchTerm = dom.searchBar.value.trim();
        searchTerm = toKatakana(searchTerm);
        searchTerm = toHalfWidth(searchTerm);
        searchTerm = searchTerm.toUpperCase();
        const searchWords = searchTerm.replace(/　/g, ' ').split(' ').filter(w => w.length > 0);

        currentFilteredCards = allCards.filter(card => {
            // ★ モードによる強制フィルタ
            if (currentMode === 'leader_select') {
                if (card.cardType !== 'LEADER') return false;
            } else if (currentMode === 'deck_edit') {
                // デッキ編集時はリーダーを除外
                if (card.cardType === 'LEADER') return false;
            }

            if (!card.cardNumber) return false;
            
            // 検索ワード
            if (searchWords.length > 0) {
                let text = [card.cardName, card.effectText, (card.features||[]).join(' '), card.cardNumber].join(' ');
                text = toHalfWidth(toKatakana(text)).toUpperCase();
                if (!searchWords.every(w => text.includes(w))) return false;
            }

            // 既存フィルタ
            const f = currentFilter;
            if (f.colors?.length > 0 && (!card.color || !f.colors.some(c => card.color.includes(c)))) return false;
            if (f.types?.length > 0 && !f.types.includes(card.cardType)) return false;
            if (f.rarities?.length > 0 && !f.rarities.includes(card.rarity)) return false;
            if (f.costs?.length > 0 && !f.costs.includes(String(card.cost))) return false;

            return true;
        });

        displayCards(currentFilteredCards);
    }

    function readFiltersFromModal() {
        const getVal = (name) => [...$$(`input[name="${name}"]:checked`)].map(c=>c.value);
        currentFilter = {
            colors: getVal('colors'),
            types: getVal('types'),
            rarities: getVal('rarities'),
            costs: getVal('costs')
        };
    }

    // === 8. イベントリスナー ===
    function setupEventListeners() {
        if (!dom.searchBar) return;

        // 検索
        dom.searchBar.addEventListener('input', () => {
            dom.clearSearchBtn.style.display = dom.searchBar.value.length > 0 ? 'block' : 'none';
            setTimeout(applyFiltersAndDisplay, 300);
        });
        dom.clearSearchBtn.addEventListener('click', () => {
            dom.searchBar.value = '';
            dom.clearSearchBtn.style.display = 'none';
            applyFiltersAndDisplay();
        });

        // フィルタ
        dom.filterBtn.addEventListener('click', () => dom.filterModal.style.display = 'flex');
        dom.closeFilterModalBtn.addEventListener('click', () => dom.filterModal.style.display = 'none');
        dom.applyFilterBtn.addEventListener('click', () => {
            readFiltersFromModal();
            applyFiltersAndDisplay();
            dom.filterModal.style.display = 'none';
        });
        dom.resetFilterBtn.addEventListener('click', () => {
            $$('.filter-checkbox').forEach(c => c.checked = false);
            currentFilter = {};
        });

        // ナビゲーション
        dom.navCards.addEventListener('click', () => {
            if (currentMode === 'leader_select' || currentMode === 'deck_edit') {
                if(!confirm('デッキ作成・編集を中断しますか？')) return;
            }
            currentMode = 'view';
            dom.cardListView.style.display = 'block';
            dom.deckListView.style.display = 'none';
            dom.deckStatusBar.classList.remove('active');
            dom.modeMessageBar.style.display = 'none';
            dom.navCards.classList.add('active');
            dom.navDecks.classList.remove('active');
            applyFiltersAndDisplay();
        });

        dom.navDecks.addEventListener('click', () => {
            currentMode = 'view'; // 一旦リセット
            dom.cardListView.style.display = 'none';
            dom.deckListView.style.display = 'block';
            dom.deckStatusBar.classList.remove('active');
            dom.modeMessageBar.style.display = 'none';
            dom.navCards.classList.remove('active');
            dom.navDecks.classList.add('active');
            loadDeckList();
        });

        // デッキ作成
        dom.createNewDeckBtn.addEventListener('click', startLeaderSelection);
        dom.deckSaveBtn.addEventListener('click', saveCurrentDeck);

        // 設定
        dom.settingsBtn.addEventListener('click', () => dom.settingsModal.style.display = 'flex');
        dom.closeSettingsModalBtn.addEventListener('click', () => dom.settingsModal.style.display = 'none');
        dom.columnToggleBtn.addEventListener('click', () => {
            let c = parseInt(localStorage.getItem('gridColumns')||3);
            c = c >= 5 ? 1 : c+1;
            setGridColumns(c);
        });

        // タッチ
        setupCardTouchEvents();

        // ライトボックス
        dom.lightboxCloseBtn.addEventListener('click', () => {
            dom.lightboxModal.style.display = 'none';
            dom.lightboxImage.src = '';
        });
    }

    // 補助関数
    function showLightbox(index) {
        if (index < 0 || index >= currentFilteredCards.length) return;
        const card = currentFilteredCards[index];
        let path = card.imagePath || getGeneratedImagePath(card.cardNumber);
        if(path.startsWith('Cards/')) path = './' + path;
        dom.lightboxImage.src = path;
        dom.lightboxModal.style.display = 'flex';
    }
    
    function setGridColumns(cols) {
        document.documentElement.style.setProperty('--grid-columns', cols);
        if(dom.columnCountDisplay) dom.columnCountDisplay.textContent = String(cols);
        localStorage.setItem('gridColumns', cols);
    }
    function setDefaultColumnLayout() {
        setGridColumns(localStorage.getItem('gridColumns') || 3);
    }
    function showMessageToast(msg, type='info') {
        dom.messageToastText.textContent = msg;
        dom.messageToast.className = `notification-toast ${type}`;
        dom.messageToast.style.display = 'flex';
        setTimeout(() => dom.messageToast.style.display = 'none', 3000);
    }
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try { await navigator.serviceWorker.register(SERVICE_WORKER_PATH); } catch(e){}
        }
    }

    window.addEventListener('load', initializeApp);
})();