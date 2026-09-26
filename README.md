# 小規模チーム向けToDo管理Webアプリ (SPA)

スマートフォン縦画面に最適化した、最大5名のチームメンバー向け完全無料ToDo管理Webアプリケーションです。  
GitHub Pages（無料静的ホスティング）とSupabase（無料枠Database）で動作します。

---

## 🚀 主な機能
1. **合言葉（簡易パスコード）ゲート:** 初回アクセス時に4〜6桁のパスコードを入力してログイン（以降は自動ログイン）。
2. **全員タスク / 個人タスク切替:** チーム全体の共有タスクと、自分自身の個人タスクをワンタップで切り替え。
3. **リスト表示 & カレンダー表示:**
   - **リスト表示:** 期限アラート（超過: 赤、本日: 黄、余裕あり: 緑）、ワンタップ完了切替、優先度・期限ソート、カテゴリ絞り込み。
   - **カレンダー表示:** 月間カレンダーの日付グリッド上にタスク状態のドットを表示し、日付タップで下部に当日のタスクを展開。
4. **PWA対応:** スマートフォンの「ホーム画面に追加」を行うことで、アプリ感覚でフルスクリーン起動可能。
5. **ポカヨケ・安全設計:** タスク削除時の確認ダイアログ、二重送信防止ローディング、入力必須チェック。

---

## 🛠️ Supabase セットアップ手順（完全無料）

1. [Supabase](https://supabase.com/) にアクセスし、無料アカウント作成・ログインします。
2. **「New Project」** を作成します（リージョンは日本に近い `Tokyo (ap-northeast-1)` 推奨）。
3. 左側メニューの **「SQL Editor」** を開きます。
4. プロジェクト内の `supabase_schema.sql` の内容をコピー＆ペーストし、**「Run」** を実行します。
   - これにより、`tasks` テーブルの作成、インデックス設定、RLS（行単位セキュリティ）ポリシーが自動設定されます。
5. 左側メニューの **「Project Settings」** > **「API」** を開きます。
   - **Project URL**（例: `https://xxxxxxxx.supabase.co`）
   - **Project API Keys** の `anon` / `public` キー
   の2つをメモします。

---

## ⚙️ アプリへのSupabase設定反映方法

設定方法は以下の2通りあります：

### 方法A: アプリ画面から入力（簡単）
1. アプリをブラウザで開きます。
2. 右上の **歯車（設定）アイコン** をタップします。
3. メモした **Project URL** と **Anon API Key** を入力して「設定を保存」をタップします。
   - ブラウザのLocalStorageに保存され、即座にクラウド同期が有効になります。

### 方法B: `js/config.js` に直接書き込む（チーム配布向け）
`js/config.js` をエディタで開き、メモした値を直接指定してコミットします：
```javascript
window.APP_CONFIG = {
  DEFAULT_PASSCODE: "1234", // チームの合言葉
  SUPABASE_URL: "https://your-project-id.supabase.co", 
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsIn...",
  ...
};
```
※Supabaseの `anon` キーはフロントエンド公開を前提とした安全な公開キーです（RLSで保護されています）。

---

## 🌐 GitHub Pages への公開手順

1. GitHub で新しい公開リポジトリ（Public）を作成します（例: `team-todo`）。
2. 本フォルダ（`c:\apps\ToDoList`）の全ファイルをリポジトリのルートにプッシュします：
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit of team todo app"
   git branch -M main
   git remote add origin https://github.com/<あなたのユーザー名>/team-todo.git
   git push -u origin main
   ```
3. GitHub リポジトリの **「Settings」** > **「Pages」** を開きます。
4. **Build and deployment** の **Source** で `Deploy from a branch` を選択し、Branch を `main` / `/(root)` に設定して **「Save」** をクリックします。
5. 数分後、`https://<あなたのユーザー名>.github.io/team-todo/` にアプリがデプロイされ、チーム全員がアクセスできるようになります。

---

## 📱 スマートフォンでの利用（PWA）
- **iPhone (Safari):** 共有ボタン（四角から矢印）をタップし、「ホーム画面に追加」を選択。
- **Android (Chrome):** メニュー（三点リーダー）から「アプリをインストール」または「ホーム画面に追加」を選択。
