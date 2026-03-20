# ロボコン情報共有サービス バックエンド追加仕様書

**バージョン:** 0.1.0  
**元資料:** `spec.md` v0.3.0, `spec-frontend.md` v0.1.0  
**対象範囲:** フロントエンド実装に必要だが、現行 API に不足している追加・修正要件

---

## 1. 目的

本書は、`spec-frontend.md` で洗い出した不足点を「要修正 API」として整理し、バックエンドに追加・変更すべき仕様を定義するものである。

方針は以下のとおりとする。

- 既存 API はできるだけ維持する
- 破壊的変更より、追加エンドポイントまたはレスポンス拡張を優先する
- フロントエンドが画面を安定して構築できる粒度で返す
- Better Auth に委譲する領域も、フロントが利用する入口は明示する

---

## 2. 追加・修正が必要な論点

現時点で特に優先度が高いのは以下である。

1. 公開大会詳細を `seriesSlug + year` で解決する API
2. 自校の複数チーム提出 UI を支える API
3. チーム詳細画面用の participation 読み取り API
4. ダッシュボード用 API
5. 大学設定の不足 API
6. 招待承認・セッション取得のフロント向け利用方針
7. ルール資料の公開ダウンロード API

---

## 3. 追加・修正方針

### 3.1 方針

- 公開画面で必要なデータは、公開 API だけで完結できるようにする
- 認証済み画面で必要な「画面構成用の集約データ」は、フロントで複数 API を無理に合成しなくてよい形で返す
- 既存の一覧系 API は維持し、画面専用の読み取り API を追加する
- レスポンスの日時は ISO 8601 文字列で返す
- OpenAPI スキーマを必ず定義し、フロントの型生成に耐えるようにする

### 3.2 優先度

- P0
  - 公開大会詳細解決 API
  - 自校 participation 一覧 API
  - participation 詳細 / submissions API
  - セッション取得 API
- P1
  - ダッシュボード API
  - ルール資料ダウンロード API
  - 大学設定の role 更新 / member 削除 API
  - 管理用 participation 一覧 API
- P2
  - コメント投稿時の所属大学確定
  - 履歴表示用の更新者表示名拡張

---

## 4. 要修正 API 一覧

### 4.1 公開大会詳細解決 API

#### 目的

公開ルート `/competitions/:seriesSlug/:year` を 1 回の API 呼び出しで解決できるようにする。

#### 追加エンドポイント

`GET /api/public/competitions/:seriesSlug/:year`

#### 認可

- 未認証可

#### レスポンス

```json
{
  "data": {
    "series": {
      "id": "uuid",
      "name": "NHK学生ロボコン",
      "slug": "nhk-student-robocon",
      "description": "..."
    },
    "edition": {
      "id": "uuid",
      "year": 2024,
      "name": "NHK学生ロボコン2024",
      "description": "...",
      "sharingStatus": "sharing",
      "externalLinks": [
        { "label": "公式サイト", "url": "https://example.com" }
      ],
      "ruleDocuments": [
        {
          "label": "ルールブック",
          "downloadPath": "/api/public/rule-documents/{documentId}/download",
          "mimeType": "application/pdf"
        }
      ],
      "createdAt": "2026-03-15T00:00:00.000Z",
      "updatedAt": "2026-03-15T00:00:00.000Z"
    }
  }
}
```

#### エラー

- `404 Not found`

#### 補足

- `organization.slug` は現行 DB に存在するため、series にも `slug` を追加するか、別の URL 設計へ寄せる必要がある
- 既存の `competition_series` には `slug` カラムがないため、以下のいずれかを先に決める
  - `competition_series.slug` を追加する
  - 公開 URL を `/competitions/:seriesId/:year` に変更する

本仕様では、URL を維持する前提で `competition_series.slug` を追加する案を採用する。

### 4.2 公開ルール資料ダウンロード API

#### 目的

公開大会詳細でルール資料を実際に開けるようにする。

#### 追加エンドポイント案

`GET /api/public/rule-documents/:editionId/:index/download`

または

`GET /api/public/rule-documents/:documentId/download`

#### 推奨

`documentId` を持たない現行データ構造では `editionId + index` の方が実装しやすい。  
ただし将来的な差し替えや順序変更に強いのは `documentId` 方式である。

初期実装では以下を推奨する。

`GET /api/public/editions/:id/rule-documents/:index/download`

#### 認可

- 未認証可

#### レスポンス

```json
{
  "data": {
    "url": "https://signed.example.com/...",
    "expiresIn": 300
  }
}
```

#### エラー

- `404 Not found`
- `400 Invalid rule document index`

---

### 4.3 セッション取得 API

#### 目的

フロントで以下を安定して初期化できるようにする。

- ログイン状態
- `admin` 判定
- 所属大学一覧
- 現在の推奨 active organization

#### 追加エンドポイント

`GET /api/me`

#### 認可

- 認証必須

#### レスポンス

```json
{
  "data": {
    "user": {
      "id": "user-id",
      "name": "田中太郎",
      "email": "user@example.com",
      "isAdmin": false
    },
    "organizations": [
      {
        "id": "org-id",
        "name": "○○大学",
        "slug": "sample-univ",
        "role": "owner"
      }
    ],
    "activeOrganizationId": "org-id"
  }
}
```

#### エラー

- `401 Unauthorized`

#### 補足

- Better Auth の既存機能だけでフロントが十分に組めるなら内部で委譲してよい
- ただしフロントからは `/api/me` を唯一の参照 API とすることで、認証ライブラリ変更の影響を抑えられる

---

### 4.4 招待詳細取得 API

#### 目的

`/invite/:invitationId` 画面で、招待内容をログイン前から表示できるようにする。

#### 追加エンドポイント

`GET /api/invitations/:id`

#### 認可

- 未認証可

#### レスポンス

```json
{
  "data": {
    "id": "invitation-id",
    "organization": {
      "id": "org-id",
      "name": "○○大学",
      "slug": "sample-univ"
    },
    "role": "member",
    "email": "invitee@example.com",
    "expiresAt": "2026-03-27T00:00:00.000Z",
    "status": "pending"
  }
}
```

#### エラー

- `404 Not found`
- `410 Expired`

### 4.5 招待承認 API

#### 目的

フロント独自画面から招待承認を行えるようにする。

#### 追加エンドポイント

`POST /api/invitations/:id/accept`

#### 認可

- 認証必須

#### リクエスト

不要、または空 body

#### レスポンス

```json
{
  "data": {
    "organizationId": "org-id",
    "organizationName": "○○大学",
    "role": "member"
  }
}
```

#### エラー

- `401 Unauthorized`
- `403 Invitation email mismatch`
- `404 Not found`
- `410 Expired`
- `409 Already accepted`

---

### 4.6 自校 participation 一覧 API

#### 目的

大会回提出画面で、自校に複数チームがある場合の提出先切り替えを可能にする。

#### 追加エンドポイント

`GET /api/editions/:id/my-participations`

#### 認可

- 認証必須
- `X-Organization-Id` 必須

#### レスポンス

```json
{
  "data": [
    {
      "id": "participation-id",
      "editionId": "edition-id",
      "universityId": "org-id",
      "universityName": "○○大学",
      "teamName": "Aチーム",
      "createdAt": "2026-03-15T00:00:00.000Z"
    }
  ]
}
```

#### エラー

- `400 x-organization-id is required`
- `403 Forbidden`

---

### 4.7 自校提出状況 API の拡張

#### 目的

提出画面で template ごとの「提出済み / 未提出」を判定できるようにする。

#### 現状の問題

- `GET /api/editions/:id/my-submissions` は submission のみ返す
- template 一覧と participation 一覧をフロントで合成しないと、未提出状態がわからない

#### 推奨方針

既存 API は維持しつつ、新しい集約 API を追加する。

#### 追加エンドポイント

`GET /api/editions/:id/my-submission-status`

#### 認可

- 認証必須
- `X-Organization-Id` 必須

#### レスポンス

```json
{
  "data": {
    "edition": {
      "id": "edition-id",
      "sharingStatus": "accepting"
    },
    "participations": [
      {
        "id": "participation-id",
        "teamName": "Aチーム"
      }
    ],
    "templates": [
      {
        "id": "template-id",
        "name": "コンセプトシート",
        "acceptType": "file",
        "isRequired": true,
        "allowedExtensions": ["pdf"],
        "urlPattern": null,
        "maxFileSizeMb": 100,
        "sortOrder": 0
      }
    ],
    "items": [
      {
        "participationId": "participation-id",
        "templateId": "template-id",
        "submission": {
          "id": "submission-id",
          "version": 2,
          "fileName": "concept.pdf",
          "url": null,
          "updatedAt": "2026-03-15T00:00:00.000Z"
        }
      }
    ]
  }
}
```

#### 補足

- 提出画面向けにはこの API を使用し、既存の `GET /api/editions/:id/my-submissions` は互換維持のため残す

---

### 4.8 participation 詳細 API

#### 目的

チーム詳細画面で、対象 participation の基本情報を取得できるようにする。

#### 追加エンドポイント

`GET /api/participations/:id`

#### 認可

- 認証必須
- 自校 team か、他校閲覧条件を満たす場合のみ

#### レスポンス

```json
{
  "data": {
    "id": "participation-id",
    "editionId": "edition-id",
    "universityId": "org-id",
    "universityName": "○○大学",
    "teamName": "Aチーム",
    "createdAt": "2026-03-15T00:00:00.000Z"
  }
}
```

#### エラー

- `403 Forbidden`
- `404 Not found`

### 4.9 participation 提出資料一覧 API

#### 目的

チーム詳細画面で、対象チームの全提出資料を一覧表示できるようにする。

#### 追加エンドポイント

`GET /api/participations/:id/submissions`

#### 認可

- 認証必須
- 自校 team か、他校閲覧条件を満たす場合のみ

#### レスポンス

```json
{
  "data": [
    {
      "id": "submission-id",
      "template": {
        "id": "template-id",
        "name": "コンセプトシート",
        "acceptType": "file"
      },
      "version": 3,
      "fileName": "concept-v3.pdf",
      "url": null,
      "updatedAt": "2026-03-15T00:00:00.000Z"
    }
  ]
}
```

#### 補足

- team 単位で資料を出す画面ではページング不要
- 将来件数増加に備えてページング対応してもよいが、初期版は非ページングを推奨する

---

### 4.10 履歴 API の表示名拡張

#### 目的

履歴画面で `submittedBy` の ID ではなくユーザー表示名を出せるようにする。

#### 修正対象

`GET /api/submissions/:id/history`

#### 変更内容

各履歴要素に以下を追加する。

```json
{
  "submittedByUser": {
    "id": "user-id",
    "name": "田中太郎"
  }
}
```

#### 互換性

- 既存の `submittedBy` は残してよい
- フロントは `submittedByUser.name` を優先使用する

---

### 4.11 コメント投稿時の所属大学確定

#### 目的

コメント一覧の「投稿者所属大学名」を、実際に投稿した大学コンテキストで表示できるようにする。

#### 現状の問題

- 現行実装は、投稿者の所属大学のうち最古のものを返している
- 複数大学所属時に、投稿時の active organization と一致しない

#### 推奨変更

`comment` テーブルに以下を追加する。

- `author_organization_id text NOT NULL`

#### API 変更

- `POST /api/participations/:id/comments`
  - `X-Organization-Id` を検証し、その値を `authorOrganizationId` として保存
- `GET /api/participations/:id/comments`
  - `author.universityName` は `authorOrganizationId` に紐づく大学名を返す

#### 補足

- これにより表示仕様と権限判定の意味が一致する

---

### 4.12 ダッシュボード API

#### 目的

`/dashboard` を複数 API 合成なしで描画できるようにする。

#### 追加エンドポイント

`GET /api/dashboard`

#### 認可

- 認証必須
- `X-Organization-Id` 必須

#### レスポンス

```json
{
  "data": {
    "organization": {
      "id": "org-id",
      "name": "○○大学"
    },
    "editions": [
      {
        "edition": {
          "id": "edition-id",
          "name": "NHK学生ロボコン2024",
          "year": 2024,
          "sharingStatus": "sharing"
        },
        "participationCount": 2,
        "submittedCount": 3,
        "requiredCount": 4,
        "canViewOtherSubmissions": true,
        "updatedAt": "2026-03-15T00:00:00.000Z"
      }
    ],
    "recentUpdates": [
      {
        "type": "submission_updated",
        "editionId": "edition-id",
        "participationId": "participation-id",
        "submissionId": "submission-id",
        "label": "コンセプトシートが更新されました",
        "occurredAt": "2026-03-15T00:00:00.000Z"
      }
    ]
  }
}
```

#### 補足

- `recentUpdates` が重い場合、初期版は空配列でもよい
- その場合は `editions` のみ先行実装し、後から updates を追加してもよい

---

### 4.13 大学設定 API の不足分

#### 目的

`/university/settings` のロール変更とメンバー削除を実装可能にする。

#### 追加エンドポイント

`PUT /api/university/members/:id/role`

`DELETE /api/university/members/:id`

#### 認可

- `owner` または `admin`
- `X-Organization-Id` 必須

#### `PUT /api/university/members/:id/role` リクエスト

```json
{
  "role": "owner"
}
```

#### レスポンス

```json
{
  "data": {
    "id": "member-id",
    "userId": "user-id",
    "role": "owner"
  }
}
```

#### `DELETE /api/university/members/:id`

- 成功時 `204 No Content`

#### 補足

- 最後の `owner` を削除または `member` に降格する操作は禁止する
- 禁止時は `409 Last owner cannot be removed` を返す

---

### 4.14 管理用 participation 一覧 API

#### 目的

`/admin/editions/:id/participations` 画面で、既存出場登録一覧を取得できるようにする。

#### 追加エンドポイント

`GET /api/admin/editions/:id/participations`

#### 認可

- `admin` 必須

#### レスポンス

```json
{
  "data": [
    {
      "id": "participation-id",
      "editionId": "edition-id",
      "universityId": "org-id",
      "universityName": "○○大学",
      "teamName": "Aチーム",
      "createdAt": "2026-03-15T00:00:00.000Z"
    }
  ]
}
```

#### 補足

- 初期版は非ページングでもよい
- 大学数が増える場合は後からページングを追加する

---

## 5. 既存 API の軽微修正

### 5.1 `GET /api/series`

#### 変更推奨

- `slug` を返すようにする

#### 理由

- 公開ルーティングに `seriesSlug` を使うため

### 5.2 `GET /api/editions/:id/submissions`

#### 変更推奨

- participation 情報に `universityName` を含める

#### 理由

- 一覧画面で学校名を表示しやすくするため

### 5.3 `GET /api/submissions/:id/history`

#### 変更推奨

- `submittedByUser` を返す

### 5.4 `GET /api/participations/:id/comments`

#### 変更推奨

- `authorOrganizationId` を返す
- `author.universityName` はその organization に基づいて返す

---

## 6. データモデル追加・変更

### 6.1 `competition_series.slug` の追加

#### 追加カラム

- `slug text NOT NULL UNIQUE`

#### 用途

- 公開ルーティング `/competitions/:seriesSlug/:year`

### 6.2 `comment.author_organization_id` の追加

#### 追加カラム

- `author_organization_id text NOT NULL`

#### FK

- `organization.id`

#### 用途

- コメント表示時の所属大学名を投稿時コンテキストと一致させる

---

## 7. エラー設計方針

追加 API では既存方針に合わせ、以下を統一する。

- `400`
  - クエリ不正
  - body 不正
  - 必須ヘッダー不足
- `401`
  - 未認証
- `403`
  - 認可不足
- `404`
  - 対象未存在
- `409`
  - 状態競合
  - 最後の owner 削除禁止
  - 招待承認済み
- `410`
  - 期限切れ招待
- `422`
  - sort 不正

---

## 8. 実装順の提案

### Phase 1

- `GET /api/me`
- `GET /api/editions/:id/my-participations`
- `GET /api/editions/:id/my-submission-status`
- `GET /api/participations/:id`
- `GET /api/participations/:id/submissions`

これで認証済み主要画面の骨格を実装しやすくなる。

### Phase 2

- `GET /api/public/competitions/:seriesSlug/:year`
- `GET /api/public/editions/:id/rule-documents/:index/download`
- `GET /api/dashboard`

これで公開画面とダッシュボードの UX が固まる。

### Phase 3

- `GET /api/invitations/:id`
- `POST /api/invitations/:id/accept`
- `PUT /api/university/members/:id/role`
- `DELETE /api/university/members/:id`
- `GET /api/admin/editions/:id/participations`

これで設定・管理系が揃う。

### Phase 4

- `competition_series.slug` 導入
- `comment.author_organization_id` 導入
- 履歴 API / コメント API のレスポンス改善

これで表示の整合性と URL 設計を仕上げる。

---

## 9. 結論

フロントエンド実装を無理なく進めるには、単に CRUD を増やすよりも、「画面が必要とする集約済み読み取り API」を追加することが重要である。  
特に `GET /api/me`、`GET /api/editions/:id/my-participations`、`GET /api/editions/:id/my-submission-status`、`GET /api/participations/:id`、`GET /api/participations/:id/submissions` の 5 つは、初期実装の詰まりを大きく減らすため優先度が高い。
