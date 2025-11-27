// config.js
// 環境設定と定数管理
// このファイルは app.js よりも先に読み込まれる必要があります。

(function() {
    'use strict';

    // 現在のURLパスを取得
    const path = window.location.pathname;

    // 環境判定ロジック
    // リポジトリ名 (OP_TCG_DB_BETA) がパスに含まれているか、
    // またはローカルホストや特定のテスト環境かを判定
    const isBeta = path.includes('OP_TCG_DB_BETA') || 
                   path.includes('localhost') || 
                   path.includes('127.0.0.1');

    // 設定オブジェクト
    const Config = {
        // 環境情報
        env: isBeta ? 'beta' : 'production',
        isBeta: isBeta,

        // データベース設定
        // 環境ごとにDB名を分けることでデータを分離する
        dbName: isBeta ? 'OPCardDB_BETA' : 'OPCardDB',
        dbVersion: 3, // デッキ機能追加のためバージョンアップ

        // キャッシュ名
        // 環境ごとにキャッシュを分ける
        cacheNames: {
            appShell: isBeta ? 'app-shell-beta-v1' : 'app-shell-v1',
            images: isBeta ? 'card-images-beta-v1' : 'card-images-v1',
        },

        // アプリケーション情報
        appVersion: '1.1.0',
        
        // ファイルパス
        paths: {
            cardsJson: './cards.json',
            serviceWorker: './service-worker.js'
        }
    };

    // グローバルに公開
    window.AppConfig = Config;

    console.log(`[Config] Environment: ${Config.env}, DB: ${Config.dbName}`);

})();