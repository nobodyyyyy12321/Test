# 指派 (Assignment)

Status: design — not implemented.

指派者 (assigner) picks a **private qset they own**, an assignee, and a time window (`start_at`, `end_at`). While the window is open, the assignee can Submit any number of times — each overwrites the previous. After the window closes, the first read triggers grading against the current answer key from the qset.

## Schema

```sql
create table assignments (
  id              uuid primary key default gen_random_uuid(),
  assigner_id     text not null references users(id) on delete cascade,
  assignee_id     text not null references users(id) on delete cascade,
  assign_type     text not null default 'exam',      -- only 'exam' in v1
  source_resource_type  text not null,               -- 'qset' only in v1
  source_resource_id    text not null,
  title           text not null,                      -- display copy, no snapshot
  -- window (store UTC; render local)
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  created_at      timestamptz not null default now(),
  -- submission (NULL until Submit); format: { "題號": 答案 } where answer is
  --   single/true_false → string ("A"), multiple → string[] (["A","C"]), fill → string
  answers         jsonb,
  submitted_at    timestamptz,
  -- grading (NULL until first post-window read)
  score           int,
  total           int,
  graded_at       timestamptz,
  check (assign_type = 'exam'),               -- v1 only; relax when more types are added
  check (source_resource_type = 'qset'),
  check (end_at - start_at >= interval '1 minute'),
  check ((answers is null) = (submitted_at is null)),
  check ((score is null) = (graded_at is null)),
  check ((total is null) = (graded_at is null)),
  check (graded_at is null or submitted_at is not null)
);
create index assignments_assignee_idx on assignments(assignee_id);
create index assignments_assigner_idx on assignments(assigner_id);
create index assignments_window_idx   on assignments(end_at);
```

No `status` column — state is derived from the timestamps. Revoke hard-deletes the row.

## Operations

| Function | Effect | Allowed when |
|---|---|---|
| **指派** (create) | INSERT row; if user now has > 60 rows (assigner or assignee), DELETE the oldest `completed` / `expired` row first | caller owns qset, qset is private, no block relationship, `start_at > now()`, `end_at > start_at` |
| **Submit** | UPSERT `answers`, bump `submitted_at` (last-write-wins) | caller is assignee, `start_at ≤ now() ≤ end_at` |
| **Revoke** | DELETE row | caller is assigner, `submitted_at IS NULL` |
| **Grade** (lazy) | UPDATE `score`, `total`, `graded_at` | server-internal on any read where `submitted_at IS NOT NULL AND graded_at IS NULL AND now() > end_at` |

### Lazy grading

```sql
UPDATE assignments
SET score = $, total = $, graded_at = now()
WHERE id = $ AND graded_at IS NULL;
```

Concurrent first-reads compute the same score deterministically; the conditional WHERE prevents double-write. Submitted-but-never-read rows stay ungraded indefinitely — cheap, harmless.

### Retention

Each user may be listed as assigner or assignee in at most **60** assignment rows at any time. When a new Assignment INSERT would push the user past the cap, the oldest row in a terminal state (`completed` or `expired`) for that user is automatically **DELETE**d as a side-effect of the same transaction. Non-terminal rows (`submitted_at IS NOT NULL AND graded_at IS NULL`) are never evicted. Checked on both `assigner_id` and `assignee_id` independently — a single assignment counts toward both users' caps. The eviction target is the row with the earliest `end_at` among terminal rows for the affected user.

## Policy: assignable resources

Only **private qsets owned by the assigner**. Excluded:
- **Public qsets** — answer key may already be discoverable elsewhere; fork to private first.
- **Other-owned qsets** — privacy boundary; the answer key belongs to the owner, not the assigner.
- **Lists** — no strict answer-key model yet.
- **Folders** — no coherent grading semantics; if the assigner wants folder-worth-of-content, the UI can fan out into N assignments.

## `assign_type` discriminator

v1 value: `'exam'`. Column exists for future extension (relax the CHECK constraint); v1 behavior is uniform.

## API endpoints

```
POST   /api/assignments                              建立指派 (refs the qset by id)
GET    /api/assignments/inbox                        rows where I'm assignee
GET    /api/assignments/outbox                       rows where I'm assigner
GET    /api/assignments/:id                          full row; questions only ≥ start_at; answer key only > end_at
POST   /api/assignments/:id/submit                   gatekept; UPDATE answers + submitted_at
DELETE /api/assignments/:id                          gatekept; hard-DELETE
```

Gatekeeper checks are listed in the Operations table.

## Answer-key audit — results

Existing practice path leaks the key and grades client-side. Practice mode stays as-is; assignments need a parallel path:

| Build | Where |
|---|---|
| Strip `answer` from payload until `now() > end_at` | new `GET /api/assignments/:id` |
| Score server-side at lazy-grade time using the current key from the qset | Grade operation |
| Accept `answers` only — never a client-computed score | `POST /api/assignments/:id/submit` |
| Take-quiz UI variant with client grading disabled | `mode='assignment'` prop on `TestClient` (or fork) |

## Scoring

Each question has a `points` (int, default 1) and a `scoring` strategy (text, nullable). Grading:

| Type | Default rule | `scoring = 'partial'` (future) |
|------|-------------|-------------------------------|
| single / true_false | exact match → full points | N/A |
| multiple | all-or-nothing → full points only if all correct options selected and no extras | proportional points per correct option |
| fill | exact string match → full points | case-insensitive / fuzzy |

`total` = sum of `points` across all questions in the qset. `score` = sum of `points` for correctly answered questions. Unanswered questions (missing key in `answers`) count as wrong — 0 points.

## Open questions

_(none — all resolved)_



## Out of scope

- Public qsets, lists, folders as sources.
- Per-type behavior branches in v1.
- Manual score override by assigner.
- Comments / feedback on submissions.
- Group assignment (fan out at creation if needed).
- Per-session timer (distinct from the global window).
- Real-time observation of the assignee.
- File-upload answers.
- Submission history / per-attempt audit trail.
- Extending `end_at` after creation.

## UI — profile tabs

Two separate tabs in the user profile:

| Tab | API | Content |
|-----|-----|---------|
| **指派紀錄** | `GET /api/assignments/outbox` | Assigner sees their outbox: list of assignments they created, each showing assignee, title, window, status |
| **繳交紀錄** | `GET /api/assignments/inbox` | Assignee sees their inbox: list of assignments assigned to them, each showing assigner, title, deadline, status, score (if completed) |

**繳交紀錄** 再分兩個子頁籤：

| 子頁籤 | 條件 |
|--------|------|
| **待繳交** | `submitted_at IS NULL AND now() ≤ end_at`（未提交，仍在 window 內） |
| **已繳交** | `submitted_at IS NOT NULL`（有提交紀錄，含已批改和等待批改） |

Each tab entry supports:
- **未到 `start_at`**：顯示「尚未開始」
- **`start_at` ~ `end_at`**：顯示「作答中」（inbox）/ 「等待提交」（outbox），點擊進入作答
- **已過 `end_at`**：顯示分數（如已批改）或「等待批改」
- **未提交且已過期**：顯示「已逾期」

## Action items

1. Build table + 7 endpoints.
2. UI: profile tabs（我指派的 / 指派給我的）, take-quiz screen (reuse `TestClient` with `mode='assignment'`), results screen.
3. Notification (in-app badge first; opt-in email at creation and window-open).
