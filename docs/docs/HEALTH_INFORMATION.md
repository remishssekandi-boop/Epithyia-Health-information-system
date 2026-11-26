# Health information API (Stage 4)

The Express API reads and manages health categories and articles using the existing MySQL tables. Responses use `{ "success": true, "data": ... }` on success and `{ "success": false, "message": "..." }` on errors.

## Visibility and permissions

- Public requests (no Authorization header) can read **ACTIVE categories** and **PUBLISHED articles** in active categories.
- `USER` and `HEALTH_WORKER` tokens can read the same published public content. They cannot view drafts/archives or modify categories/articles.
- `ADMIN` and `CONTENT_MANAGER` can list/read active and inactive categories and articles of every status, create/edit/delete categories/articles, and publish or archive articles.
- An invalid or expired Bearer token on a content read request returns `401`; it does not silently fall back to public access.
- All content mutations are authorized by backend role middleware, not frontend visibility.

## Categories

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health/categories` | Public; optional Bearer token | List active categories. Editors see active and inactive categories. |
| GET | `/api/health/categories/:id` | Public; optional Bearer token | Category details and article counts; inactive categories are editor-only. |
| POST | `/api/health/categories` | ADMIN, CONTENT_MANAGER | Create an active category. |
| PUT | `/api/health/categories/:id` | ADMIN, CONTENT_MANAGER | Update `name`, `description`, and/or `status`. |
| DELETE | `/api/health/categories/:id` | ADMIN, CONTENT_MANAGER | Delete only when no article references the category. |

Category `name` is required, 2–120 characters; `description` is a string; `status` is `ACTIVE` or `INACTIVE`. Duplicate names return `409`. Inactive categories are hidden from public reads. Deleting a category still referenced by any article returns `409`; reassign/delete those articles or mark the category inactive instead.

Example:

```http
POST /api/health/categories
Authorization: Bearer <ADMIN_OR_CONTENT_MANAGER_JWT>
Content-Type: application/json

{"name":"Community Health","description":"DEMO CATEGORY: replace with locally approved description."}
```

## Articles

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health/articles` | Public; optional Bearer token | Search/list published content publicly; editors can list all statuses. |
| GET | `/api/health/articles/:id` | Public; optional Bearer token | Read published article publicly; editors can read drafts/archives. |
| POST | `/api/health/articles` | ADMIN, CONTENT_MANAGER | Create a `DRAFT` article. Creation cannot publish directly. |
| PUT | `/api/health/articles/:id` | ADMIN, CONTENT_MANAGER | Update article fields without changing its workflow status. |
| PATCH | `/api/health/articles/:id/publish` | ADMIN, CONTENT_MANAGER | Publish a draft or republish an archived article. |
| PATCH | `/api/health/articles/:id/archive` | ADMIN, CONTENT_MANAGER | Archive an article; archived content is hidden publicly. |
| DELETE | `/api/health/articles/:id` | ADMIN, CONTENT_MANAGER | Delete an article. |

Article creation requires `category_id`, `title` (3–200 characters), `summary` (1–500), and `content` (up to 16 MB). `language` defaults to `English` and is limited to 32 characters. Category must exist and be `ACTIVE`. New records always start in `DRAFT`; change status only through the publish/archive routes. Every mutation records an audit event.

### Search and filters

`GET /api/health/articles` supports:

- `q` — case-insensitive substring search across title, summary, and content (1–120 characters).
- `category_id` — positive category ID.
- `language` — exact language filter (1–32 characters).
- `status` — editors may filter `DRAFT`, `PUBLISHED`, or `ARCHIVED`; public/read-only roles may request only `PUBLISHED`.
- `sort` — `newest` (default), `oldest`, or `title`.
- `limit` — integer 1–100 (default 20).
- `offset` — nonnegative integer (default 0).

Example public query:

```http
GET /api/health/articles?q=nutrition&category_id=5&language=English&sort=newest&limit=10&offset=0
```

Example editor draft query:

```http
GET /api/health/articles?status=DRAFT&sort=oldest
Authorization: Bearer <ADMIN_OR_CONTENT_MANAGER_JWT>
```

List responses include `articles` and `pagination` (`limit`, `offset`, `total`). Article records include category name, author display name, status, and timestamps; password information is never selected. SQL values are parameterized, while sort fields are selected from a fixed allowlist.

### Draft and publication examples

```http
POST /api/health/articles
Authorization: Bearer <CONTENT_MANAGER_JWT>
Content-Type: application/json

{"category_id":5,"title":"Reviewed information title","summary":"Short reviewed summary.","content":"Content reviewed and approved for this project.","language":"English"}
```

The create response has status `DRAFT` and a null `published_at`. Publish only after project editorial review:

```http
PATCH /api/health/articles/123/publish
Authorization: Bearer <CONTENT_MANAGER_JWT>
```

Public requests can then read the article. Archive it to hide it from public requests:

```http
PATCH /api/health/articles/123/archive
Authorization: Bearer <CONTENT_MANAGER_JWT>
```

## Demonstration content safety

The Stage 2 seed contains draft-only records labelled `[DEMO ONLY]`. They contain no medical instructions or claims. Do not publish these placeholders as health guidance. Replace them with information reviewed and approved by qualified local health authorities before public release.

## Testing

From `backend`, ensure MariaDB and the Stage 2 database setup are available, then run:

```powershell
npm test
```

`backend/tests/healthContent.test.js` uses a temporary uniquely named category/article and cleans them up. It exercises public/editor visibility, invalid input, role denial, draft creation, search/filter/sort/pagination, publish/archive/re-publish, hidden inactive categories, and foreign-key deletion restrictions.

For the local persistent SQLite demonstration mode, run `npm run test:demo`. This exercises the public content API, demo authentication, editing, role updates, and persistence without requiring MySQL.