/**
 * アプリケーション設定ファイル
 *
 * GitHub Pagesへ公開する際は、Supabaseの「Project Settings」>「API」から
 * URLとanon keyを取得してここに設定するか、画面上の「設定（歯車）」アイコンから
 * 直接入力・LocalStorageへ保存することも可能です。
 */
window.APP_CONFIG = {
  // デフォルト合言葉（4〜6桁のパスコード）
  DEFAULT_PASSCODE: "1234",

  // Supabase 接続情報（初期値は空。画面上からでも入力・保存可能）
  SUPABASE_URL: "https://cdeilrrraattivjrjxxc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_bxwBFYPmtMP8Vv_14zmvPg_-T5s8we2",

  // チームメンバー一覧
  MEMBERS: [
    "全員",
    "メンバーA",
    "メンバーB",
    "メンバーC",
    "メンバーD",
    "メンバーE",
  ],

  // カテゴリ一覧（自由追加・変更可）
  CATEGORIES: ["業務", "会議", "雑務", "開発", "連絡", "その他"],
};
