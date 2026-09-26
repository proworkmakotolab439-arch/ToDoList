/**
 * アプリケーション設定ファイル
 *
 * GitHub Pagesへ公開する際は、Supabaseの「Project Settings」>「API」から
 * URLとanon keyを取得してここに設定するか、画面上の「設定（歯車）」アイコンから
 * 直接入力・LocalStorageへ保存することも可能です。
 */
window.APP_CONFIG = {
  // 管理者初期アカウント
  ADMIN_USER: "admin",
  DEFAULT_ADMIN_PASS: "bell",

  // Supabase 接続情報
  SUPABASE_URL: "https://cdeilrrraattivjrjxxc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_bxwBFYPmtMP8Vv_14zmvPg_-T5s8we2",

  // デフォルトチームメンバー一覧（空。各ユーザーが各自の個別パスワードで新規登録または管理者が設定）
  DEFAULT_MEMBERS: [],

  // デフォルトカテゴリー一覧（自由追加・変更可）
  DEFAULT_CATEGORIES: ["業務", "会議", "雑務", "開発", "連絡", "その他"]
};
