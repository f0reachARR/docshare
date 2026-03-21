# ロボコン情報共有サービス フロントエンド仕様書

**バージョン:** 0.5.1  
**元仕様:** `spec.md` v0.3.1（2026-03-21 時点）  
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
- 初期セッション取得には `GET /api/me` を利用し、所属大学一覧と `activeOrganizationId` を復元する

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
| 大会回詳細 | `/competitions/:editionId` | 大会回の説明、ルール資料、外部リンク |
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
- 大会回詳細への遷移は `editionId` ベースで行う

使用 API:
- `GET /api/series`
- 必要に応じて `GET /api/editions?series_id=...`

### 5.3 大会回詳細 `/competitions/:editionId`

- 大会回名、説明、共有状態、外部リンクを表示する
- ルール資料があれば表示する
- 未認証でも閲覧できる
- 認証済みの場合は、権限に応じて「資料提出」「資料一覧」への導線を表示する

必要な表示項目:
- 大会シリーズ名
- 開催年
- 大会回説明
- ルール資料一覧
- 外部リンク
- 共有状態

使用 API:
- `GET /api/editions/:id`
- 必要に応じて `GET /api/series/:id`

### 5.4 ダッシュボード `/dashboard`

- `GET /api/me` でユーザー情報・所属大学一覧・現在の大学コンテキストを初期化する
- 現在の大学コンテキストに紐づく大会回一覧を表示する
- 各大会回について以下を確認できる
  - 提出状況
  - 共有状態
  - 提出画面への導線
  - 閲覧条件を満たす場合の資料一覧への導線
- 最近の更新を表示する想定とするが、表示内容は別途定義が必要

### 5.5 大会回 資料提出 `/editions/:id/submit`

- `GET /api/editions/:id/my-submission-status` を主データソースとして利用する
- 自校の参加チーム一覧を取得し、複数チーム時はチーム切り替え UI を表示する
- 自校の提出対象テンプレート一覧を表示する
- `my-submission-status.items` を用いて、各 participation × template の提出済み / 未提出を判定する
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
- presign リクエストには `File` オブジェクト由来の `fileSizeBytes` を含める
- S3 アップロード完了後に提出 API を呼ぶ
- 提出 API には、実際にアップロードした `File` オブジェクト由来の `fileName` / `fileSizeBytes` / `mimeType` をそのまま渡す
- `s3Key` は presign 時に払い出されたものをそのまま使用する
- S3 `PUT` 時は presign 時と同じ `Content-Type` と実ファイル長で送信する
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
- `GET /api/editions/:id/my-participations`
- `GET /api/editions/:id/my-submission-status`
- 必要に応じて `GET /api/editions/:id/my-submissions`
- `POST /api/upload/presign`
- `POST /api/submissions`
- `PUT /api/submissions/:id`
- `DELETE /api/submissions/:id`

### 5.6 大会回 資料一覧 `/editions/:id/submissions`

- 閲覧条件を満たす場合のみ一覧を表示する
- 閲覧条件を満たさない場合は、理由を案内する空状態を表示する
- 一覧には少なくとも以下を表示する
  - 大学名
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
  - 投稿者チーム名（大会内で一意に定まる場合のみ）
  - 投稿日時
  - 更新日時
  - Markdown レンダリング結果
- 自分のコメントには編集・削除操作を表示する
- `admin` は他人のコメントにも削除操作を表示する

使用 API:
- `GET /api/participations/:id`
- `GET /api/participations/:id/submissions`
- `GET /api/participations/:id/comments`
- `POST /api/participations/:id/comments`
- `PUT /api/comments/:id`
- `DELETE /api/comments/:id`
- `GET /api/submissions/:id/download`
- `GET /api/submissions/:id/history`

`GET /api/participations/:id/comments` では、コメント作成時点の所属大学名と、必要に応じてチーム名のスナップショットを表示に利用する。

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

`GET /api/submissions/:id/history` では `submittedByUser.name` を更新者表示に利用する。

### 5.9 大学設定 `/university/settings`

- 現在の大学コンテキストを対象にメンバー一覧を表示する
- `owner` または `admin` のみ編集操作を表示する
- メンバー招待フォームを表示する
- メンバーごとにロール変更・削除操作を表示する
- 最後の `owner` を `member` に変更する操作、および最後の `owner` を削除する操作は不可とする
- 上記制約で `409` が返った場合は、理由を明示したエラーメッセージを表示する

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
- `GET /api/admin/editions/:id/participations`
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
- 認証後は `GET /api/me` を取得し、所属大学と active organization を初期化する
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
- セッションと所属大学一覧の初期取得には `GET /api/me` を使う
- OpenAPI から型生成する前提を推奨する

### 7.2 一覧取得

- すべての一覧 API は `page`, `pageSize`, `sort`, `q` を扱う共通テーブルヘルパーで利用する
- `400` はクエリ不正、`422` はソート不正として扱う

### 7.3 ファイルアップロード

1. `POST /api/upload/presign`
   - Body には `participationId`, `templateId`, `fileName`, `contentType`, `fileSizeBytes` を含める
2. 返却された `presignedUrl` に対してブラウザから `PUT`
   - `Content-Type` は presign 時に送った値を使う
   - `Content-Length` は実ファイルサイズと一致している必要がある
3. 成功後、`POST /api/submissions` または `PUT /api/submissions/:id`

バックエンドは提出登録時に以下を再検証する前提とする。
- `s3Key` が現在の submission context と version に一致すること
- S3 上の `contentLength` と payload の `fileSizeBytes` が一致すること
- S3 上の `contentType` と payload の `mimeType` が一致すること

フロントの責務:
- 進捗表示
- 中断時のリトライ導線
- presign 完了後に S3 送信が失敗した場合のエラー表示
- 送信中の二重操作防止
- 登録 payload に加工済みの MIME type や推測値を使わず、ブラウザが保持する実ファイル情報を優先する

### 7.4 ダウンロード

- file 型は API から署名付き URL を取得して別タブまたは直接ダウンロードする
- url 型は保存済み URL をそのまま開く
- submission / history 系レスポンスは内部の `fileS3Key` を返さない前提で扱う

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
- `409` は用途別に文言を分ける
  - 提出受付期間外
  - 最後の owner を変更または削除できない
  - 重複提出などの状態競合

---

## 10. フロントエンド仕様レビュー

以下は、`spec.md` と現行バックエンド実装を確認したうえで、フロントエンド仕様として不足・矛盾・未確定と判断した項目である。

### 10.1 ダッシュボード要件が未定義

- `spec.md` では「所属大学の大会一覧、最近の更新」とあるが、必要な API と表示定義がない
- 現行バックエンドにもダッシュボード専用 API は存在しない
- フロント仕様としては最低でも以下の定義が必要である
  - 何を「所属大学の大会一覧」とみなすか
  - 「最近の更新」に含める対象
  - 並び順
  - 0 件時の表示

### 10.2 ルール資料のダウンロード仕様が不足

- 公開画面ではルール資料を表示する要件がある
- ただし `rule_documents` は `s3_key` と `mime_type` のみで、公開ダウンロード URL の取得方法が仕様化されていない
- 現行バックエンドにも公開ルール資料ダウンロード API はない
- そのためフロントはルール資料を「表示」できても「実際に開く」手段が未定である

### 10.3 招待承認画面の API が不足

- 画面 `/invite/:invitationId` には招待内容取得と承認操作が必要
- しかし `spec.md` では Better Auth に委譲されており、フロントから何を呼ぶかが明記されていない
- Better Auth の組織招待 API をそのまま使うのか、BFF でラップするのかを確定する必要がある

### 10.4 空状態と誘導文が未定義

- 閲覧不可時に何を表示するかの文言方針が未確定
- 特に以下は UX 上重要である
  - 提出 0 件のため他校資料を見られない場合
  - 所属大学がない場合
  - 招待待ちの場合
  - 対象大会に自校 participation がない場合

---

## 11. フロントエンド実装開始前に確定したい項目

1. ダッシュボードの情報源と優先度をどう定義するか
2. 招待承認フローを Better Auth 素の UI/SDK で組むか、独自画面でラップするか
3. 公開ルール資料のダウンロード方法をどう提供するか

---

## 12. 現時点での結論

追加された `GET /api/me`、`GET /api/editions/:id/my-participations`、`GET /api/editions/:id/my-submission-status`、`GET /api/participations/:id`、`GET /api/participations/:id/submissions`、大学設定 API、管理用 participation 一覧 API により、認証済み主要画面の実装前提はかなり揃った。  
現時点で特に残っている論点は「ダッシュボード要件」「招待承認フロー」「公開ルール資料ダウンロード」の 3 点である。
