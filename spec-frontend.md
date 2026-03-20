# ロボコン情報共有サービス フロントエンド仕様書

**バージョン:** 0.1.0  
**元仕様:** `spec.md` v0.3.0（2026-03-15 時点）  
**対象範囲:** Next.js フロントエンドの画面仕様、画面遷移、UI 状態、クライアント側バリデーション、API 依存

---

## 1. 目的

本書は `spec.md` のうち、フロントエンド実装に必要な仕様のみを切り出したものである。  
バックエンド内部実装、DB 設計、Docker 構成などのうち、画面挙動に直接影響しない内容は原則として含めない。

加えて、元仕様および現行バックエンド実装を確認し、フロントエンド仕様として未確定・不足・矛盾している点を末尾に整理する。

---

## 2. フロントエンド前提

### 2.1 技術前提

- Next.js App Router を使用する
- Server Actions は使用しない
- すべてのデータ取得・更新は Hono REST API を経由する
- 認証は Better Auth の `/api/auth/*` を利用する
- ファイルアップロードは、バックエンドから受け取った署名付き URL を用いてブラウザから S3 互換ストレージへ直接アップロードする

### 2.2 組織コンテキスト

- ユーザーは複数大学に所属できる
- 認証済み画面では「現在の大学コンテキスト」を持つ
- 大学コンテキストが必要な API 呼び出しでは `X-Organization-Id` ヘッダーを付与する
- 現在の大学コンテキストはヘッダーの大学切り替え UI から変更できる

### 2.3 ロール

- `admin`: システム管理者
- `owner`: 大学代表者
- `member`: 大学メンバー

ロールによって表示・操作可能な UI を切り替えるが、最終的な権限判定は常に API レスポンスを正とする。

---

## 3. 情報設計

### 3.1 グローバルナビゲーション

- 未認証
  - トップ
  - 大会一覧
  - ログイン
  - アカウント作成
- 認証済み
  - ダッシュボード
  - 大会一覧
  - 大学切り替え
  - アカウント設定
  - `admin` のみ管理画面への導線

### 3.2 共通 UI 方針

- 一覧画面は PC ではテーブル、モバイルではカード表示にフォールバックする
- 無限スクロールは採用しない
- 一覧の状態は URL クエリに保持する
  - `page`
  - `pageSize`
  - `sort`
  - `q`
- フィルタ変更時は `page=1` に戻す
- `pageSize` 候補は `10`, `20`, `50`
- API の `403` は権限不足、`404` は未存在、`409` は状態競合として扱い、ユーザー向けメッセージを出し分ける

### 3.3 日時・文言

- 画面表示は日本語
- 日時は利用者のローカルタイムゾーンで表示する
- ステータス値は内部値をそのまま表示せず、日本語ラベルに変換する
  - `draft`: 準備中
  - `accepting`: 受付中
  - `sharing`: 共有中
  - `closed`: 締切後

---

## 4. ルーティング仕様

### 4.1 公開画面

| 画面 | パス | 主な内容 |
|------|------|-----------|
| トップページ | `/` | サービス概要、利用の流れ、ログイン導線 |
| 大会シリーズ一覧 | `/competitions` | 大会シリーズの検索・一覧 |
| 大会回詳細 | `/competitions/:seriesSlug/:year` | 大会回の説明、ルール資料、外部リンク |
| ログイン | `/auth/login` | Better Auth を使ったログイン |
| アカウント作成 | `/auth/register` | Better Auth を使った新規登録 |
| 招待承認 | `/invite/:invitationId` | 招待内容の確認、承認、ログイン/新規登録導線 |

### 4.2 認証済み画面

| 画面 | パス | 主な内容 |
|------|------|-----------|
| ダッシュボード | `/dashboard` | 所属大学に関連する大会・提出状況・最近の更新 |
| 大会回 資料提出 | `/editions/:id/submit` | 自校の提出状況確認、提出、差し替え、削除 |
| 大会回 資料一覧 | `/editions/:id/submissions` | 全出場校の提出一覧。閲覧条件を満たす場合のみ閲覧可 |
| チーム詳細 | `/editions/:id/teams/:participationId` | 対象チームの提出資料一覧、コメント一覧・投稿 |
| 資料履歴 | `/editions/:id/submissions/:submissionId/history` | 現行資料の履歴一覧 |
| 大学設定 | `/university/settings` | メンバー一覧、招待、ロール変更 |
| アカウント設定 | `/account/settings` | プロフィール等 |

### 4.3 管理画面

| 画面 | パス | 主な内容 |
|------|------|-----------|
| 管理ダッシュボード | `/admin` | 管理機能への導線 |
| 大会シリーズ管理 | `/admin/series` | シリーズ CRUD |
| 大会回管理 | `/admin/editions` | 大会回 CRUD、共有状態変更 |
| 出場登録管理 | `/admin/editions/:id/participations` | 出場校・チーム登録 |
| 資料種別テンプレート管理 | `/admin/editions/:id/templates` | テンプレート CRUD、前回コピー |
| 大学管理 | `/admin/universities` | 大学作成、代表者招待 |

---

## 5. 画面別仕様

### 5.1 トップページ `/`

- サービス概要を表示する
- 主な利用フローを表示する
- 未認証時はログイン・新規登録への導線を表示する
- 認証済み時はダッシュボードへの導線を表示する

### 5.2 大会シリーズ一覧 `/competitions`

- 大会シリーズ一覧を表示する
- 検索キーワード `q` を指定できる
- ページング・ソートに対応する
- 各行から大会シリーズ詳細または配下の大会回へ遷移できる

使用 API:
- `GET /api/series`
- 必要に応じて `GET /api/editions?series_id=...`

### 5.3 大会回詳細 `/competitions/:seriesSlug/:year`

- 大会回名、説明、共有状態、外部リンクを表示する
- ルール資料があれば表示する
- 未認証でも閲覧できる
- 認証済みの場合は、権限に応じて「資料提出」「資料一覧」への導線を表示する

必要な表示項目:
- シリーズ名
- 開催年
- 大会回説明
- ルール資料一覧
- 外部リンク
- 共有状態

### 5.4 ダッシュボード `/dashboard`

- 現在の大学コンテキストに紐づく大会回一覧を表示する
- 各大会回について以下を確認できる
  - 提出状況
  - 共有状態
  - 提出画面への導線
  - 閲覧条件を満たす場合の資料一覧への導線
- 最近の更新を表示する想定とするが、表示内容は別途定義が必要

### 5.5 大会回 資料提出 `/editions/:id/submit`

- 自校の提出対象テンプレート一覧を表示する
- テンプレートごとに以下を表示する
  - 名称
  - 説明
  - 必須/任意
  - `file` または `url`
  - 許可拡張子
  - 最大ファイルサイズ
  - 現在の提出状態
  - 最終更新日時
  - バージョン番号
- 自校に複数チームがある場合、チーム単位で提出先を切り替えられる必要がある

#### file 型テンプレート

- ファイル選択 UI を表示する
- クライアント側で以下を事前検証する
  - 拡張子
  - ファイルサイズ
  - MIME タイプの簡易整合
- アップロード開始後は進捗バーを表示する
- S3 アップロード完了後に提出 API を呼ぶ
- 提出済みの場合は差し替えとして扱う

#### url 型テンプレート

- URL 入力欄を表示する
- URL 形式を検証する
- `url_pattern` がある場合は、対応ドメインのヒントを表示する
- 提出済みの場合は差し替えとして扱う

#### 削除

- `owner` または `admin` のみ削除ボタンを表示する
- 削除前に確認ダイアログを表示する

#### 状態別 UI

- `draft`: 提出 UI を非表示にし、「受付前」を表示する
- `accepting`: 提出 UI を有効化する
- `sharing`: 提出 UI を有効化する
- `closed`: 提出 UI を無効化し、閲覧専用表示にする

使用 API:
- `GET /api/editions/:id/templates`
- `GET /api/editions/:id/my-submissions`
- `POST /api/upload/presign`
- `POST /api/submissions`
- `PUT /api/submissions/:id`
- `DELETE /api/submissions/:id`

### 5.6 大会回 資料一覧 `/editions/:id/submissions`

- 閲覧条件を満たす場合のみ一覧を表示する
- 閲覧条件を満たさない場合は、理由を案内する空状態を表示する
- 一覧には少なくとも以下を表示する
  - チーム名
  - ファイル名または URL
  - 更新日時
  - バージョン
- 検索、ソート、ページングに対応する
- チーム詳細への導線を持つ

閲覧不可時の主な理由:
- 共有状態が `sharing` または `closed` ではない
- 自校がまだ資料を 1 件も提出していない
- 大学コンテキストが未選択または不正

使用 API:
- `GET /api/editions/:id/submissions`

### 5.7 チーム詳細 `/editions/:id/teams/:participationId`

- チームの基本情報を表示する
  - 大学名
  - チーム名
- 提出資料一覧を表示する
- 資料ごとにダウンロードまたは外部 URL オープン操作を提供する
- コメント一覧を表示する
- 権限がある場合はコメント投稿フォームを表示する

#### コメント UI

- フラット一覧で表示する
- 各コメントに以下を表示する
  - 投稿者名
  - 投稿者所属大学名
  - 投稿日時
  - 更新日時
  - Markdown レンダリング結果
- 自分のコメントには編集・削除操作を表示する
- `admin` は他人のコメントにも削除操作を表示する

使用 API:
- `GET /api/participations/:id/comments`
- `POST /api/participations/:id/comments`
- `PUT /api/comments/:id`
- `DELETE /api/comments/:id`
- `GET /api/submissions/:id/download`
- `GET /api/submissions/:id/history`

### 5.8 資料履歴 `/editions/:id/submissions/:submissionId/history`

- 現行版と過去版の一覧を表示する
- 各版に以下を表示する
  - バージョン番号
  - 更新者
  - 更新日時
  - ファイル名または URL
- file 型はダウンロード操作を、url 型は URL を開く操作を提供する

使用 API:
- `GET /api/submissions/:id/history`
- `GET /api/submission-history/:historyId/download`

### 5.9 大学設定 `/university/settings`

- 現在の大学コンテキストを対象にメンバー一覧を表示する
- `owner` または `admin` のみ編集操作を表示する
- メンバー招待フォームを表示する
- メンバーごとにロール変更・削除操作を表示する

使用 API:
- `GET /api/university/members`
- `POST /api/university/invite`
- `PUT /api/university/members/:id/role`
- `DELETE /api/university/members/:id`

### 5.10 管理画面

#### 管理ダッシュボード `/admin`

- 各管理機能への導線を表示する

#### 大会シリーズ管理 `/admin/series`

- 一覧、検索、ソート、ページング
- 作成、編集、削除

使用 API:
- `GET /api/series`
- `POST /api/admin/series`
- `PUT /api/admin/series/:id`
- `DELETE /api/admin/series/:id`

#### 大会回管理 `/admin/editions`

- 一覧、検索、フィルタ
- 作成、編集、削除
- 共有状態変更
- ルール資料アップロード

使用 API:
- `GET /api/editions`
- `POST /api/admin/editions`
- `PUT /api/admin/editions/:id`
- `DELETE /api/admin/editions/:id`
- `PUT /api/admin/editions/:id/status`
- `POST /api/admin/editions/:id/rules/presign`
- `PUT /api/admin/editions/:id/rules`

#### 出場登録管理 `/admin/editions/:id/participations`

- 対象大会回の出場校・チーム一覧
- 大学選択による追加
- チーム名編集
- 削除

使用 API:
- `POST /api/admin/editions/:id/participations`
- `PUT /api/admin/participations/:id`
- `DELETE /api/admin/participations/:id`
- 参照用に `GET /api/admin/universities`

#### 資料種別テンプレート管理 `/admin/editions/:id/templates`

- テンプレート一覧
- 作成、編集、削除
- 他大会回からのコピー
- `file`/`url` に応じて入力フォームを切り替える

使用 API:
- `GET /api/editions/:id/templates`
- `POST /api/admin/editions/:id/templates`
- `PUT /api/admin/templates/:id`
- `DELETE /api/admin/templates/:id`
- `POST /api/admin/editions/:id/templates/copy-from/:sourceEditionId`

#### 大学管理 `/admin/universities`

- 大学一覧、検索、ソート、ページング
- 大学作成
- 初期代表者メールを指定した招待

使用 API:
- `GET /api/admin/universities`
- `POST /api/admin/universities`

---

## 6. 認証・認可 UI 仕様

### 6.1 ログイン/登録

- Better Auth の認証 API を呼ぶ
- メール/パスワード認証を基本とする
- Google OAuth が有効なら追加導線を表示する
- 認証後は以下の優先順で遷移する
  - 招待承認フロー中なら招待画面に戻る
  - 認証済みで大学所属があれば `/dashboard`
  - 大学未所属なら所属待ち案内

### 6.2 招待承認 `/invite/:invitationId`

- 招待先大学名
- 招待ロール
- 招待メールアドレス
- 有効期限
- 承認ボタン
- 未ログイン時はログインまたは新規登録を促す

### 6.3 ルートガード

- 未認証で認証必須ページに到達した場合はログインへ遷移する
- `admin` 以外が `/admin/*` に到達した場合は 403 相当画面またはダッシュボードへ遷移する
- 大学コンテキストが必須の画面で所属大学が 0 件の場合は案内画面を表示する

---

## 7. API クライアント仕様

### 7.1 共通

- `NEXT_PUBLIC_API_URL` を API ベース URL とする
- Cookie ベース認証を前提とし、必要に応じて認証情報を送信する
- `X-Organization-Id` が必要なエンドポイントでは、選択中大学 ID を必ず付与する
- OpenAPI から型生成する前提を推奨する

### 7.2 一覧取得

- すべての一覧 API は `page`, `pageSize`, `sort`, `q` を扱う共通テーブルヘルパーで利用する
- `400` はクエリ不正、`422` はソート不正として扱う

### 7.3 ファイルアップロード

1. `POST /api/upload/presign`
2. 返却された `presignedUrl` に対してブラウザから `PUT`
3. 成功後、`POST /api/submissions` または `PUT /api/submissions/:id`

フロントの責務:
- 進捗表示
- 中断時のリトライ導線
- presign 完了後に S3 送信が失敗した場合のエラー表示
- 送信中の二重操作防止

### 7.4 ダウンロード

- file 型は API から署名付き URL を取得して別タブまたは直接ダウンロードする
- url 型は保存済み URL をそのまま開く

---

## 8. 状態管理

### 8.1 必須クライアント状態

- 認証セッション
- 現在の大学コンテキスト
- 一覧の URL クエリ状態
- アップロード進捗
- フォーム送信中状態

### 8.2 キャッシュ方針

- 一覧画面はクエリキーに `page`, `pageSize`, `sort`, `q`, `organizationId` を含める
- 作成・更新・削除後は関連一覧を再検証する
- 組織切り替え時は組織依存データのキャッシュを無効化する

---

## 9. バリデーションとエラー表示

### 9.1 フォームバリデーション

- 必須項目未入力
- URL 形式
- メール形式
- ファイル拡張子
- ファイルサイズ上限
- 文字数制限
  - コメントは最大 5000 文字

### 9.2 エラー表示

- フィールド単位エラーは入力欄の近くに表示する
- 画面全体の失敗はトーストまたはアラートで表示する
- 権限エラーは単なる失敗として扱わず、利用条件を説明する

---

## 10. フロントエンド仕様レビュー

以下は、`spec.md` と現行バックエンド実装を確認したうえで、フロントエンド仕様として不足・矛盾・未確定と判断した項目である。

### 10.1 ルーティングと公開 API の不整合

- 公開画面の大会回詳細パスは `/competitions/:seriesSlug/:year` だが、公開 API は `GET /api/editions/:id` と `GET /api/series/:id` しかなく、`slug + year` から大会回を直接引く API がない
- フロントは現状、シリーズ一覧と大会回一覧を総当たりして解決する必要があり非効率である
- `seriesSlug` を使うルーティングを維持するなら、`GET /api/series/by-slug/:slug` や `GET /api/competitions/:seriesSlug/:year` のような公開 API が必要である

### 10.2 ダッシュボード要件が未定義

- `spec.md` では「所属大学の大会一覧、最近の更新」とあるが、必要な API と表示定義がない
- 現行バックエンドにもダッシュボード専用 API は存在しない
- フロント仕様としては最低でも以下の定義が必要である
  - 何を「所属大学の大会一覧」とみなすか
  - 「最近の更新」に含める対象
  - 並び順
  - 0 件時の表示

### 10.3 自校が複数チーム出場している場合の提出 UI が不足

- データモデル上は同一大学が複数 `participation` を持てる
- しかし `GET /api/editions/:id/my-submissions` は submission 一覧のみを返し、参加チーム一覧や template ごとの未提出状態を返さない
- フロントは「どのチームに対して提出するか」を選ぶ必要があるが、そのための読み取り API が不足している
- 最低でも以下のいずれかが必要である
  - `GET /api/editions/:id/my-participations`
  - `GET /api/editions/:id/my-submissions` が participation 情報と template 情報を含む

### 10.4 チーム詳細画面に必要な読み取り API が不足

- 画面 `/editions/:id/teams/:participationId` には「チーム基本情報」と「対象チームの提出資料一覧」が必要
- しかし現行 API は participation 単体取得 API や participation 単位の submission 一覧 API を持たない
- `GET /api/editions/:id/submissions` だけでは一覧から個別チーム画面を安定して構築しづらい
- 追加候補:
  - `GET /api/participations/:id`
  - `GET /api/participations/:id/submissions`

### 10.5 資料履歴画面の表示情報が不足

- `GET /api/submissions/:id/history` は `submittedBy` のユーザー ID を返すが、画面モックでは更新者名を表示している
- ユーザー表示名を得る API がないため、現状のフロント仕様では更新者名表示を確定できない
- 履歴 API に `submittedByName` を含めるか、ユーザー参照 API が必要である

### 10.6 コメント投稿者の所属大学名の定義が曖昧

- ユーザーは複数大学所属可能だが、コメント API は投稿者の「最も古い所属大学」を返す実装になっている
- これは「コメント投稿時点でどの大学コンテキストから投稿したか」と一致しない可能性がある
- フロント表示としては「投稿時のアクティブ大学名」を表示したいはずであり、仕様と実装の再定義が必要である

### 10.7 ルール資料のダウンロード仕様が不足

- 公開画面ではルール資料を表示する要件がある
- ただし `rule_documents` は `s3_key` と `mime_type` のみで、公開ダウンロード URL の取得方法が仕様化されていない
- 現行バックエンドにも公開ルール資料ダウンロード API はない
- そのためフロントはルール資料を「表示」できても「実際に開く」手段が未定である

### 10.8 大学設定画面の API と実装が不一致

- 元仕様には `PUT /api/university/members/:id/role` と `DELETE /api/university/members/:id` がある
- しかし現行バックエンド実装には該当ルートが存在しない
- フロントエンドは現時点ではメンバー一覧と招待までしか確実に実装できない

### 10.9 管理画面の一覧 API が不足している箇所がある

- 出場登録管理には「既存の出場登録一覧」が必要だが、現行バックエンドには管理用 participation 一覧 API がない
- テンプレート管理では `GET /api/editions/:id/templates` を流用できるが、出場登録管理は作成・更新・削除のみで一覧取得がない
- フロント仕様としては `GET /api/admin/editions/:id/participations` が必要である

### 10.10 招待承認画面の API が不足

- 画面 `/invite/:invitationId` には招待内容取得と承認操作が必要
- しかし `spec.md` では Better Auth に委譲されており、フロントから何を呼ぶかが明記されていない
- Better Auth の組織招待 API をそのまま使うのか、BFF でラップするのかを確定する必要がある

### 10.11 認証セッション取得方法が未定義

- フロントでログイン状態、所属大学一覧、admin 判定をどう取得するかが仕様にない
- 画面のガードやヘッダー描画に必須であるため、以下の少なくとも一つが必要
  - Better Auth のセッション取得エンドポイント利用方針
  - セッション + 所属大学一覧を返すフロント専用 API

### 10.12 空状態と誘導文が未定義

- 閲覧不可時に何を表示するかの文言方針が未確定
- 特に以下は UX 上重要である
  - 提出 0 件のため他校資料を見られない場合
  - 所属大学がない場合
  - 招待待ちの場合
  - 対象大会に自校 participation がない場合

---

## 11. フロントエンド実装開始前に確定したい項目

1. 大会回詳細を `seriesSlug + year` で引く API を追加するか、フロントの URL 設計を `editionId` ベースへ変更するか
2. 複数チーム所属時の提出 UI をどう構成するか
3. チーム詳細画面用の participation 読み取り API を追加するか
4. ダッシュボードの情報源と優先度をどう定義するか
5. 大学設定のロール変更・削除 API をこのまま実装するか、初期版では未提供にするか
6. 招待承認フローを Better Auth 素の UI/SDK で組むか、独自画面でラップするか

---

## 12. 現時点での結論

`spec.md` からフロントエンド単体の仕様は概ね切り出せるが、実装に着手するには「公開大会詳細の取得方法」「複数チーム時の提出導線」「チーム詳細表示用 API」「ダッシュボード要件」の 4 点が特に不足している。  
この 4 点を先に確定すると、画面設計・API クライアント設計・状態管理のブレが大きく減る。
