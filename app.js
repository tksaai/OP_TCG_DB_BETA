document.addEventListener('DOMContentLoaded', () => {
    let allCards = [];
    let currentTab = 'search';
    let deck = {
        leader: null,
        main: {} // key: card.id, value: count
    };

    const cardList = document.getElementById('cardList');
    const deckCardList = document.getElementById('deckCardList');
    const searchInput = document.getElementById('searchInput');
    const filterButton = document.getElementById('filterButton');
    const resetButton = document.getElementById('resetButton');

    // モーダル
    const cardModal = document.getElementById('cardModal');
    const filterModal = document.getElementById('filterModal');
    const closeModal = document.querySelector('.close');
    const closeFilterModal = document.querySelector('.close-filter');
    const applyFiltersButton = document.getElementById('applyFilters');
    const resetFiltersInModalButton = document.getElementById('resetFiltersInModal');

    // フィルターコンテナ
    const colorFilters = document.getElementById('colorFilters');
    const cardTypeFilters = document.getElementById('cardTypeFilters');
    const rarityFilters = document.getElementById('rarityFilters');
    const costFilters = document.getElementById('costFilters');
    const powerFilters = document.getElementById('powerFilters');
    const counterFilters = document.getElementById('counterFilters');
    const abilityFilters = document.getElementById('abilityFilters');
    const attributeFilters = document.getElementById('attributeFilters');
    const packFilters = document.getElementById('packFilters');

    // タブ
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // デッキ構築
    const leaderCardSlot = document.getElementById('leaderCardSlot');
    const mainDeckList = document.getElementById('mainDeckList');
    const deckCountSpan = document.getElementById('deckCount');
    const mainDeckCountSpan = document.getElementById('mainDeckCount');
    const clearDeckButton = document.getElementById('clearDeckButton');
    const generateDeckCodeButton = document.getElementById('generateDeckCodeButton');
    const copyDeckCodeButton = document.getElementById('copyDeckCodeButton');
    const deckCodeOutput = document.getElementById('deckCodeOutput');
    const deckCodeInput = document.getElementById('deckCodeInput');
    const loadDeckCodeButton = document.getElementById('loadDeckCodeButton');

    // --- 初期化 ---
    
    // カードデータの読み込み
    async function loadCards() {
        try {
            const response = await fetch('cards.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allCards = await response.json();
            // console.log(`Loaded ${allCards.length} cards`);
            setupFilters(allCards);
            displayCards(allCards, cardList, 'modal');
            displayCards(allCards, deckCardList, 'deck');
        } catch (error) {
            console.error("カードデータの読み込みに失敗しました:", error);
            cardList.innerHTML = "<p>カードデータの読み込みに失敗しました。</p>";
        }
    }

    // フィルターのセットアップ
    function setupFilters(cards) {
        const colors = new Set();
        const cardTypes = new Set();
        const rarities = new Set();
        const costs = new Set();
        const powers = new Set();
        const counters = new Set();
        const attributes = new Set();
        const packs = new Set();

        cards.forEach(card => {
            card.color.split('/').forEach(c => colors.add(c));
            cardTypes.add(card.cardType);
            rarities.add(card.rarity);
            costs.add(card.cost);
            powers.add(card.power);
            counters.add(card.counter);
            attributes.add(card.attribute);
            packs.add(card.pack);
        });

        createFilterToggles(colors, colorFilters);
        createFilterToggles(cardTypes, cardTypeFilters);
        createFilterToggles(rarities, rarityFilters);
        createFilterToggles(costs, costFilters, (a, b) => (a === '-' ? -1 : b === '-' ? 1 : parseInt(a) - parseInt(b)));
        createFilterToggles(powers, powerFilters, (a, b) => (a === '-' ? -1 : b === '-' ? 1 : parseInt(a) - parseInt(b)));
        createFilterToggles(counters, counterFilters, (a, b) => (a === '-' ? -1 : b === '-' ? 1 : parseInt(a) - parseInt(b)));
        createFilterToggles(attributes, attributeFilters);
        createFilterToggles(packs, packFilters);
    }

    // フィルタートグルボタンの動的生成
    function createFilterToggles(valueSet, container, sortFn = null) {
        container.innerHTML = ''; // 既存の要素をクリア
        let values = Array.from(valueSet);
        if (sortFn) {
            values.sort(sortFn);
        }
        
        values.forEach(value => {
            if (!value) return; // 空の値をスキップ
            const label = document.createElement('label');
            label.className = 'filter-toggle';
            
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = value;
            
            const span = document.createElement('span');
            span.textContent = value;
            
            label.appendChild(input);
            label.appendChild(span);
            container.appendChild(label);
        });
    }

    // --- カード表示 ---

    // カードリストの表示
    function displayCards(cards, container, clickAction) {
        container.innerHTML = ''; // コンテナをクリア
        if (cards.length === 0) {
            container.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">該当するカードがありません。</p>';
            return;
        }
        
        cards.forEach(card => {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            
            const img = document.createElement('img');
            img.src = card.imagePath;
            img.alt = card.name;
            img.loading = 'lazy'; // 遅延読み込み
            img.onerror = () => {
                // 画像読み込みエラー時の処理
                const placeholder = document.createElement('div');
                placeholder.className = 'card-placeholder';
                placeholder.setAttribute('data-card-id', card.id); // カードIDをdata属性にセット
                cardItem.replaceChild(placeholder, img); // img を placeholder に置き換え
            };
            
            cardItem.appendChild(img);
            
            // クリック時の動作を分岐
            if (clickAction === 'modal') {
                cardItem.addEventListener('click', () => openModal(card));
            } else if (clickAction === 'deck') {
                cardItem.addEventListener('click', () => addCardToDeck(card));
            }
            
            container.appendChild(cardItem);
        });
    }

    // --- フィルターロジック ---

    // フィルターの実行
    function filterAndDisplay() {
        const searchText = searchInput.value.toLowerCase();

        // 選択されたフィルターを取得
        const selectedColors = getSelectedFilters(colorFilters);
        const selectedCardTypes = getSelectedFilters(cardTypeFilters);
        const selectedRarities = getSelectedFilters(rarityFilters);
        const selectedCosts = getSelectedFilters(costFilters);
        const selectedPowers = getSelectedFilters(powerFilters);
        const selectedCounters = getSelectedFilters(counterFilters);
        const selectedAbilities = getSelectedFilters(abilityFilters);
        const selectedAttributes = getSelectedFilters(attributeFilters);
        const selectedPacks = getSelectedFilters(packFilters);

        const filteredCards = allCards.filter(card => {
            const cardEffectText = (card.name + card.cardEffect + card.trigger).toLowerCase();

            // テキスト検索
            if (searchText && !cardEffectText.includes(searchText)) {
                return false;
            }
            // 色 (AND/OR: カードの色が、選択された色のいずれかを含んでいればOK)
            if (selectedColors.length > 0 && !selectedColors.some(color => card.color.split('/').includes(color))) {
                return false;
            }
            // カード種類
            if (selectedCardTypes.length > 0 && !selectedCardTypes.includes(card.cardType)) {
                return false;
            }
            // レアリティ
            if (selectedRarities.length > 0 && !selectedRarities.includes(card.rarity)) {
                return false;
            }
            // コスト
            if (selectedCosts.length > 0 && !selectedCosts.includes(card.cost)) {
                return false;
            }
            // パワー
            if (selectedPowers.length > 0 && !selectedPowers.includes(card.power)) {
                return false;
            }
            // カウンター
            if (selectedCounters.length > 0 && !selectedCounters.includes(card.counter)) {
                return false;
            }
            // 属性
            if (selectedAttributes.length > 0 && !selectedAttributes.includes(card.attribute)) {
                return false;
            }
            // パック
            if (selectedPacks.length > 0 && !selectedPacks.includes(card.pack)) {
                return false;
            }

            // 能力フィルター
            if (selectedAbilities.length > 0) {
                const isVanilla = card.cardEffect === '-' && card.trigger === '-';
                const isBlocker = card.cardEffect.includes('【ブロッカー】');
                const hasTrigger = card.trigger !== '-';

                if (selectedAbilities.includes('vanilla') && !isVanilla) return false;
                if (selectedAbilities.includes('blocker') && !isBlocker) return false;
                if (selectedAbilities.includes('trigger') && !hasTrigger) return false;
            }

            return true;
        });

        // 現在のアクティブなタブに応じて表示を更新
        if (currentTab === 'search') {
            displayCards(filteredCards, cardList, 'modal');
        } else if (currentTab === 'deck') {
            displayCards(filteredCards, deckCardList, 'deck');
        }
    }

    // 選択されたフィルターの値を取得するヘルパー関数
    function getSelectedFilters(container) {
        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    }

    // フィルターリセット
    function resetFilters() {
        searchInput.value = '';
        const allCheckboxes = filterModal.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(cb => cb.checked = false);
        filterAndDisplay();
    }

    // --- モーダル制御 ---
    
    // カード詳細モーダルを開く
    function openModal(card) {
        document.getElementById('modalImage').src = card.imagePath;
        document.getElementById('modalImage').alt = card.name;
        document.getElementById('modalName').textContent = card.name;
        document.getElementById('modalId').textContent = `${card.pack} / ${card.id}`;
        document.getElementById('modalCardType').textContent = card.cardType;
        document.getElementById('modalColor').textContent = card.color;
        document.getElementById('modalRarity').textContent = card.rarity;
        document.getElementById('modalCost').textContent = card.cost;
        document.getElementById('modalPower').textContent = card.power;
        document.getElementById('modalCounter').textContent = card.counter;
        document.getElementById('modalAttribute').textContent = card.attribute;
        document.getElementById('modalEffect').textContent = card.cardEffect;
        document.getElementById('modalTrigger').textContent = card.trigger;
        cardModal.style.display = 'block';
    }

    // モーダルを閉じる
    closeModal.onclick = () => cardModal.style.display = 'none';
    closeFilterModal.onclick = () => filterModal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == cardModal) {
            cardModal.style.display = 'none';
        }
        if (event.target == filterModal) {
            filterModal.style.display = 'none';
        }
    };

    // フィルターモーダル制御
    filterButton.onclick = () => filterModal.style.display = 'block';
    applyFiltersButton.onclick = () => {
        filterAndDisplay();
        filterModal.style.display = 'none';
    };
    resetFiltersInModalButton.onclick = resetFilters;
    
    // --- タブ制御 ---
    
    function setupTabs() {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                if (targetTab === currentTab) return; // 同じタブなら何もしない

                currentTab = targetTab;

                // ボタンのアクティブ状態を切り替え
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // コンテンツの表示を切り替え
                tabContents.forEach(content => {
                    if (content.id === targetTab) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });

                // フィルター結果を再表示
                filterAndDisplay();
            });
        });
    }

    // --- デッキ構築 ---

    function setupDeckBuilder() {
        clearDeckButton.addEventListener('click', clearDeck);
        generateDeckCodeButton.addEventListener('click', generateDeckCode);
        copyDeckCodeButton.addEventListener('click', copyDeckCode);
        loadDeckCodeButton.addEventListener('click', loadDeckFromCode);
        leaderCardSlot.addEventListener('click', () => {
            if (deck.leader) {
                // リーダーをクリックしたら詳細モーダルを開く
                openModal(allCards.find(c => c.id === deck.leader));
            }
        });
    }

    // デッキにカードを追加
    function addCardToDeck(card) {
        if (card.cardType === 'リーダー') {
            if (deck.leader && deck.leader !== card.id) {
                if (!confirm('リーダーを変更しますか？ (現在のリーダーはデッキから削除されます)')) {
                    return;
                }
            }
            deck.leader = card.id;
        } else if (card.cardType === 'キャラ' || card.cardType === 'イベント' || card.cardType === 'ステージ') {
            const currentCount = deck.main[card.id] || 0;
            const totalMainDeckCards = Object.values(deck.main).reduce((sum, count) => sum + count, 0);

            if (totalMainDeckCards >= 50) {
                showToast('デッキが50枚の上限に達しています。');
                return;
            }
            if (currentCount >= 4) {
                showToast(`カード '${card.name}' は既に4枚デッキに入っています。`);
                return;
            }
            deck.main[card.id] = currentCount + 1;
        } else if (card.cardType === 'ドン!!') {
            showToast('ドン!!カードは自動的に10枚含まれます。');
        }
        
        updateDeckView();
    }

    // デッキからカードを削除
    function removeCardFromDeck(cardId, isLeader = false) {
        if (isLeader) {
            deck.leader = null;
        } else {
            if (deck.main[cardId]) {
                deck.main[cardId]--;
                if (deck.main[cardId] <= 0) {
                    delete deck.main[cardId];
                }
            }
        }
        updateDeckView();
    }

    // デッキ表示を更新
    function updateDeckView() {
        // リーダー表示
        if (deck.leader) {
            const leaderCard = allCards.find(c => c.id === deck.leader);
            if (leaderCard) {
                leaderCardSlot.innerHTML = `<img src="${leaderCard.imagePath}" alt="${leaderCard.name}" title="クリックで詳細表示">`;
            } else {
                leaderCardSlot.innerHTML = '<p>リーダーなし</p>';
                deck.leader = null; // 見つからない場合はクリア
            }
        } else {
            leaderCardSlot.innerHTML = '<p>リーダーカードを<br>選択してください</p>';
        }

        // メインデッキ表示
        mainDeckList.innerHTML = '';
        let totalCount = 0;

        // IDでソートして表示
        const sortedDeckIds = Object.keys(deck.main).sort();

        for (const cardId of sortedDeckIds) {
            const card = allCards.find(c => c.id === cardId);
            const count = deck.main[cardId];
            if (card && count > 0) {
                totalCount += count;
                const item = document.createElement('div');
                item.className = 'deck-card-item';
                item.innerHTML = `
                    <span>${card.name} (${card.id})</span>
                    <span class="card-count">x${count}</span>
                `;
                item.addEventListener('click', () => removeCardFromDeck(cardId));
                mainDeckList.appendChild(item);
            }
        }

        // デッキ枚数更新
        deckCountSpan.textContent = `メインデッキ: ${totalCount}/50枚`;
        mainDeckCountSpan.textContent = totalCount;
    }

    // デッキクリア
    function clearDeck() {
        if (confirm('本当にデッキをクリアしますか？')) {
            deck.leader = null;
            deck.main = {};
            deckCodeOutput.value = '';
            deckCodeInput.value = '';
            updateDeckView();
        }
    }

    // デッキコード生成
    function generateDeckCode() {
        if (!deck.leader && Object.keys(deck.main).length === 0) {
            showToast('デッキが空です。');
            deckCodeOutput.value = '';
            return;
        }

        let code = '';
        if (deck.leader) {
            code += `L:${deck.leader}\n`;
        }

        const mainDeckEntries = Object.entries(deck.main)
            .sort(([idA], [idB]) => idA.localeCompare(idB)) // IDでソート
            .map(([id, count]) => `${id}*${count}`);
        
        code += mainDeckEntries.join('\n');
        deckCodeOutput.value = code;
        showToast('デッキコードを生成しました。');
    }

    // デッキコードコピー
    function copyDeckCode() {
        if (!deckCodeOutput.value) {
            showToast('コピーするデッキコードがありません。');
            return;
        }
        
        // navigator.clipboard が使えない環境（httpなど）を考慮
        try {
            deckCodeOutput.select();
            document.execCommand('copy');
            showToast('デッキコードをクリップボードにコピーしました。');
        } catch (err) {
            console.error('コピーに失敗:', err);
            showToast('コピーに失敗しました。');
        }
    }

    // デッキコード読み込み
    function loadDeckFromCode() {
        const code = deckCodeInput.value.trim();
        if (!code) {
            showToast('デッキコードを入力してください。');
            return;
        }

        try {
            const newDeck = { leader: null, main: {} };
            const lines = code.split('\n');
            let mainDeckCount = 0;

            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('L:')) {
                    const leaderId = line.substring(2);
                    const leaderCard = allCards.find(c => c.id === leaderId && c.cardType === 'リーダー');
                    if (leaderCard) {
                        newDeck.leader = leaderId;
                    } else {
                        throw new Error(`無効なリーダーID: ${leaderId}`);
                    }
                } else if (line.includes('*')) {
                    const [cardId, countStr] = line.split('*');
                    const count = parseInt(countStr);
                    const card = allCards.find(c => c.id === cardId);

                    if (!card || !(card.cardType === 'キャラ' || card.cardType === 'イベント' || card.cardType === 'ステージ')) {
                        throw new Error(`無効なカードID: ${cardId}`);
                    }
                    if (isNaN(count) || count < 1 || count > 4) {
                        throw new Error(`無効な枚数 (${count}) for ${cardId}`);
                    }
                    if (mainDeckCount + count > 50) {
                        throw new Error('デッキが50枚を超えています。');
                    }
                    
                    newDeck.main[cardId] = count;
                    mainDeckCount += count;
                }
            });

            // 読み込み成功
            deck = newDeck;
            updateDeckView();
            deckCodeInput.value = ''; // 入力欄をクリア
            showToast('デッキコードを読み込みました。');

        } catch (error) {
            console.error('デッキコードの読み込みエラー:', error);
            showToast(`読み込みエラー: ${error.message}`);
        }
    }

    // --- ユーティリティ ---
    
    // トースト通知（簡易版）
    function showToast(message) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
        
        // スタイルをJSで追加（CSSファイルに .toast を追加する方が望ましい）
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#333',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '25px',
            zIndex: '3000',
            fontSize: '1rem',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
        });
    }

    // --- イベントリスナー ---
    searchInput.addEventListener('input', filterAndDisplay);
    resetButton.addEventListener('click', resetFilters);

    // --- 実行 ---
    setupTabs();
    setupDeckBuilder();
    loadCards();
});