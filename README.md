# Zoom Recording Downloader（Chrome拡張機能）

ユーザー自身がアクセス権限を持つZoomクラウド録画を、Chromeで開いている録画ページから保存します。外部サーバー、Zoom OAuth、課金サービスは使用しません。

## インストール

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を押す
4. この `extension` フォルダを選ぶ

## 使い方

1. ChromeでZoom録画を再生できるページまで開く
2. ツールバーの拡張機能アイコンを押す
3. 「開いている動画を保存」を押す
4. 同じタブに表示される保存画面で「保存先を選ぶ」を押す

## セキュリティ

- Cookie、CSRF token、署名付き動画URLを外部へ送信しません。
- Zoom以外のURLは拒否します。
- ユーザー自身が視聴権限を持つ録画だけに使用してください。

## 権限

- `tabs`: 開いているZoom録画タブを確認し、同じタブに保存画面を表示
- `storage`: 処理中の状態をブラウザメモリに保持
- `webRequest`: Zoomが実際に読み込んだMP4通信を検出
- `declarativeNetRequestWithHostAccess`: ダウンロード時にZoom由来のRefererを維持
- `https://*.zoom.us/*`: Zoomページと配信URLだけへアクセス

Zoomの認証やパスコード入力は拡張機能では操作しません。Chrome上で視聴できる状態にしてから使用します。

## 注意事項

- 自分が保存を許可されている録画だけに使用してください。
- 録画の所有者が設定した共有条件とZoomの利用規約に従ってください。
- このプロジェクトはZoom Video Communications, Inc.の公式製品ではなく、同社との提携・承認関係もありません。

## 動画を開いたときの左側の一覧

ChromeでMP4を開いたときに表示されるサムネイル列はChromeのプレビュー画面で、動画には含まれていません。画面右上の「QuickTime Playerで開く」を押すと、一覧なしで再生できます。

## ライセンス

[MIT License](LICENSE)
