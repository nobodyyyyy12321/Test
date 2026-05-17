# Share System Redesign

Status: proposal — not implemented.

## 0. Resource model

Three shareable resource types exist in the codebase:

| Type | Table | What it is |
|---|---|---|
| `qset` | `qsets` (renamed from `categories`; some code still uses "category"/"collection" names) | A question set. Takeable. |
| `list` | `lists` | A user-curated list of questions. Takeable. |
| `folder` | `folders` | A container for qsets, lists, and sub-folders. Not takeable. |

"Takeable" = a user can attempt it and produce a score. Folders are containers only; sharing a folder means granting access to its children (see §6).

## 1. Problem

| Area | Problem |
|---|---|
| Storage | `lists.shared_with text[]` (by user **name**), `lists.shared_results jsonb` (by user **name**), and `shared_categories` table (by user **id**) all describe overlapping facts. |
| Writes | `shareListWithUser` dual-writes to the array **and** mirrors into `shared_categories`. Source of truth is unclear; reader dedupes by key prefix. |
| Identity | Name-keyed shares break silently if a user renames. No FK, no cascade. |
| Group share | `shareListWithGroup` fans out to per-user rows at write time. Members who join after the share don't see it; members who leave still do. Group→list link is lost. |
| Resources | `category_key='list:<id>'` is a string. No FK; deleting a list leaves dangling rows. Only lists and qsets can be shared today; folders cannot. |
| Scores | `shared_results` is a JSON column on `lists`, capped at last 3 per recipient, keyed by name. No index. Can't answer "best score on this list" or "all my scores across shared lists" without parsing JSON. Qsets have no equivalent. |
| State | No declined-and-blocked tombstone. No role (viewer/editor). No message. No privacy control over score visibility. |
| UI | The per-list "share" entry was removed from `PersonalListsView`'s context menu. `setShareOpenId` in `ProfileClient` is dead — backend exists with no entry point. |
| Inbox | "Shared with me" is one flat list. No grouping by sender, no unread state, no pagination. |

## 2. Goals

- Single source of truth for who-has-access.
- ID-keyed everything: recipients, senders, resources.
- Groups as first-class share targets, not write-time fan-out.
- All three resource types (`qset`, `list`, `folder`) shareable through one path; folder shares cascade.
- Score history that is queryable, bounded in storage, and privacy-controlled per share.
- Restore per-resource share affordance in `PersonalListsView` and unify it across types.
- Migration path that doesn't break recipients mid-flight.

## 3. Data model

### 3.1 `shares` — who has access

```sql
create table shares (
  id                       uuid primary key default gen_random_uuid(),
  resource_type            text not null,                        -- 'qset' | 'list' | 'folder'
  resource_id              text not null,
  sender_id                text not null references users(id) on delete cascade,
  recipient_user_id        text     references users(id)  on delete cascade,
  recipient_group_id       uuid     references groups(id) on delete cascade,
  role                     text not null default 'viewer',       -- 'viewer' | 'editor'
  status                   text not null default 'accepted',     -- 'accepted' | 'declined'
  scores_visible_to_sender boolean not null default false,
  message                  text,
  created_at               timestamptz not null default now(),
  responded_at             timestamptz,
  check (resource_type in ('qset', 'list', 'folder')),
  check ((recipient_user_id is null) <> (recipient_group_id is null)),
  unique nulls not distinct
    (resource_type, resource_id, sender_id, recipient_user_id, recipient_group_id)
);
create index shares_recipient_user_idx
  on shares(recipient_user_id) where recipient_user_id is not null;
create index shares_recipient_group_idx
  on shares(recipient_group_id) where recipient_group_id is not null;
create index shares_resource_idx on shares(resource_type, resource_id);
```

Semantics:

- Exactly one of `recipient_user_id` / `recipient_group_id` is non-null (CHECK enforced).
- **Group shares stay as one row.** Effective members are resolved at read time by joining `group_members` (status `accepted`). Joiners auto-gain access; leavers auto-lose it.
- `status='accepted'` on insert — instant delivery, no pending gate (see §6).
- `status='declined'` is a tombstone: the row stays, recipient never sees it again, and the unique constraint prevents the sender re-spamming the same resource.
- `scores_visible_to_sender` defaults **false**. Recipient opts in per share. Ignored when `resource_type='folder'` (folders aren't attempted; the flag is read from the leaf qset/list share path — see §6).
- `role` is future-proofing for editor sharing; only `viewer` is implemented in v1.

### 3.2 Folder share resolution

A folder share grants access to the folder and everything reachable through `folders.parent_id` / `lists.folder_id` / `qsets.parent_id` (or whichever parent column applies). Resolution happens at read time, not write time — so adding a list to a shared folder grants access immediately, and moving a list out revokes it.

A SQL view encapsulates the "does user U have access to resource R" question across direct shares + folder cascade + group membership:

```sql
create view effective_shares as
-- direct user shares
select s.id as share_id, s.resource_type, s.resource_id,
       s.recipient_user_id as user_id, s.sender_id,
       s.scores_visible_to_sender, s.role, s.status,
       null::uuid as via_group_id, null::uuid as via_folder_share_id
from shares s
where s.recipient_user_id is not null

union all

-- group shares, expanded to members
select s.id, s.resource_type, s.resource_id,
       gm.user_id, s.sender_id,
       s.scores_visible_to_sender, s.role, s.status,
       s.recipient_group_id, null
from shares s
join group_members gm on gm.group_id = s.recipient_group_id
where s.recipient_group_id is not null and gm.status = 'accepted'

union all

-- folder shares cascading to child qsets/lists/sub-folders (recursive)
select s.id, descendant_type, descendant_id,
       recipient_user_id, s.sender_id,
       s.scores_visible_to_sender, s.role, s.status,
       null, s.id
from shares s
join lateral (
  with recursive descendants(t, id) as (
    select 'folder'::text, s.resource_id
    union all
    select 'folder', f.id     from folders f join descendants d on f.parent_id = d.id where d.t = 'folder'
    union all
    select 'list',   l.id     from lists   l join descendants d on l.folder_id = d.id where d.t = 'folder'
    union all
    select 'qset',   q.id     from qsets   q join descendants d on q.parent_id = d.id where d.t = 'folder'
  )
  select t as descendant_type, id as descendant_id from descendants where (t, id) <> ('folder', s.resource_id)
) expand on true
where s.resource_type = 'folder' and s.recipient_user_id is not null
-- (analogous branch for folder + group shares omitted for brevity; same union-with-group_members shape)
;
```

Effective access for user U on resource R is: `select 1 from effective_shares where user_id = U and resource_type = R.type and resource_id = R.id and status = 'accepted'`. All read-side authorization goes through this view.

### 3.3 `attempts` — score records

```sql
create table attempts (
  id            uuid primary key default gen_random_uuid(),
  resource_type text not null,                         -- 'qset' | 'list' only
  resource_id   text not null,
  user_id       text not null references users(id) on delete cascade,
  answered      int  not null,
  correct       int  not null,
  duration_ms   int,
  attempted_at  timestamptz not null default now(),
  via_share_id  uuid references shares(id) on delete set null,
  check (resource_type in ('qset', 'list'))
);
create index attempts_resource_user_idx
  on attempts(resource_type, resource_id, user_id, attempted_at desc);
create index attempts_user_idx on attempts(user_id, attempted_at desc);
create index attempts_via_share_idx on attempts(via_share_id);
```

- Folders cannot be attempted (CHECK enforced).
- `via_share_id` records which share row delivered access. For a list attempted because it's inside a shared folder, this points at the **folder share row**, not a synthetic list share.
- `via_share_id = null` for owner / public access.
- `ON DELETE SET NULL` so revoking a share preserves attempt history.
- **Retention: last 20 attempts per `(user_id, resource_type, resource_id)`** enforced by trigger (§3.4). Same asymptotic cost as today's cap-at-3, but ~7× the retention.

### 3.4 Retention trigger

```sql
create function trim_attempts() returns trigger language plpgsql as $$
begin
  delete from attempts
  where id in (
    select id from attempts
    where resource_type = new.resource_type
      and resource_id   = new.resource_id
      and user_id       = new.user_id
    order by attempted_at desc
    offset 20
  );
  return new;
end $$;

create trigger attempts_trim_after_insert
  after insert on attempts
  for each row execute function trim_attempts();
```

### 3.5 Tables / columns to drop (after migration)

- `lists.shared_with` column
- `lists.shared_results` column
- `shared_categories` table

## 4. API

All share-related endpoints collapse to two resource-agnostic groups.

### 4.1 Shares

```
POST   /api/shares
  body: { resourceType: 'qset'|'list'|'folder',
          resourceId,
          recipients: [{ kind: 'user' | 'group', id }],
          role?, message? }
  → creates one shares row per recipient. Checks: caller owns the resource,
    no block relationship with user recipients, caller is a member of group
    recipients. Folder shares require ownership of the folder itself
    (not its children — those are reached via cascade).

GET    /api/shares/inbox?status=&resourceType=&senderId=&cursor=
  → rows shared with caller (via effective_shares), joined server-side with
    sender + resource metadata. Group rows returned once per resource (not
    once per group). Folder shares appear as one inbox entry; their children
    are not enumerated in the inbox.

GET    /api/shares/outbox?resourceId=
  → rows where caller is sender. Powers the share-sheet's "current recipients"
    list. Filterable by resource.

PATCH  /api/shares/:id
  body: { status?: 'declined', scoresVisibleToSender?: boolean }
  → recipient action. Status transitions: accepted → declined only.
    scoresVisibleToSender editable any time; ignored for folder shares.

DELETE /api/shares/:id
  → sender revoke OR recipient self-remove. Auth decides which.

POST   /api/shares/:id/copy
  → fork the shared resource into the recipient's account. For folder shares,
    deep-copies the folder tree (replaces today's /api/lists/[id]/copy).
```

### 4.2 Attempts

```
POST   /api/attempts
  body: { resourceType: 'qset'|'list', resourceId, answered, correct, durationMs? }
  → authoritative score-write. Server resolves the share row (if any) that
    granted access via effective_shares; sets via_share_id (may point at a
    folder-typed share row). Owner attempts get via_share_id = null.
    Replaces /api/lists/[listId]/result.

GET    /api/attempts?resourceType=&resourceId=&scope=mine|all
  scope=mine → caller's own attempts on that resource
  scope=all  → all attempts visible to caller, where visibility =
                  caller owns the resource AND attempts.via_share_id refers
                  to a share row with scores_visible_to_sender=true
                OR
                  caller and attempt.user_id share a group-scoped share on
                  this resource (future, behind a per-group flag)

GET    /api/attempts/leaderboard?resourceType=&resourceId=
  → aggregated (best / latest / avg per user) under the same visibility filter.
```

### 4.3 Endpoints retired

- `POST/DELETE /api/lists/[listId]/share`
- `DELETE /api/lists/[listId]/unsubscribe`
- `POST /api/lists/[listId]/copy`
- `POST /api/lists/[listId]/result`
- `POST /api/categories/share`
- `GET /api/categories/shared`
- `POST /api/groups/[groupId]/share-list`

## 5. UI

### 5.1 `PersonalListsView`

- Restore "分享" entry in the per-resource right-click menu. Currently the menu has only "編輯" and "移到資料夾"; add "分享" for qsets (`renderCollectionItem`), lists (`renderListItem`), and folders (`renderFolder`).
- Click opens `<ShareSheet resource={{type, id, name}}/>`.
- Folder share entry should make the cascade explicit in the menu copy, e.g. `分享資料夾（含內容）`.

### 5.2 `ShareSheet` component (new)

- Combined user + group search (lift the logic out of `ProfileClient.handleShareSearch`).
- Current-recipients list with revoke X, driven by `GET /api/shares/outbox?resourceId=`.
- Optional message field.
- For folder shares, a "Includes N qsets, M lists, K sub-folders" preview computed from the cascade.
- "Send my scores to sender" hint shown to recipient when they receive the share, not to the sender. Hidden for folder-type shares.

### 5.3 Inbox (`/[name]?tab=shared`)

- Grouped by sender, collapsible.
- Per-row actions: open, copy, decline.
- One row per share — folder shares are not expanded into their children here. The recipient sees the folder appear in their browsing UI (sidebar or shared-with-me section) and navigates into it normally.
- Unread badge computed as count of accepted shares created since `users.shared_inbox_seen_at`.
- Per-row toggle "send my scores to sender" → `PATCH /api/shares/:id` (hidden for folder shares).

### 5.4 Score views on the qset / list page

- **Owner**: scoreboard tab grouped by recipient — backed by `GET /api/attempts?scope=all`. Shows only recipients who opted in.
- **Recipient**: own attempt history — backed by `?scope=mine`. Unlimited within retention.
- Empty-state copy distinguishes "no attempts yet" from "recipient hasn't opted to share scores."

## 6. Policy decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pending vs instant | **Instant** (`status='accepted'` on insert) | Matches user expectations from Drive / Notion; pending gates add friction for the common case. |
| Decline behavior | **Tombstone** (row stays, sender can't re-share same resource) | Fixes today's "unsubscribe → re-share → re-spam" loop. |
| Block check | Enforced at `POST /api/shares` | Carried over from current `/api/lists/[id]/share`. |
| Score visibility default | **Private** (`scores_visible_to_sender=false`) | Sharing a resource should not implicitly opt the recipient into score telemetry. |
| Folder share semantics | **Recursive grant resolved at read time** | Adding/moving items in a shared folder reflects access immediately. Per-child overrides are not supported in v1 — too much policy complexity for the use case. |
| Folder share + scoreboard | Owner of a folder-shared list sees the recipient's scores only if recipient toggles `scores_visible_to_sender` on the **folder share row** | Single consent point per share, no per-child toggling. |
| Attempt retention | **Last 20 per (user, resource)** via trigger | Bounded growth; ~7× today's cap; no cron / rollup needed. |
| Group share resolution | **At read time** via `group_members` join | Membership changes apply immediately to share visibility. |
| Score history on revoke | **Preserved** (`via_share_id` set null) | Attempts happened; revoking the share doesn't rewrite history. New scores stop flowing. |
| Edit-role sharing | **Schema-ready, not implemented** | `role` column exists; v1 ignores it. |

## 7. Migration

No production share data to preserve → **greenfield**. Single PR:

- Drop old code (see scope below), drop `lists.shared_with`, `lists.shared_results`, and the `shared_categories` table.
- Create `shares`, `attempts`, the `effective_shares` view, the retention trigger.
- Build new `/api/shares/*` and `/api/attempts/*` routes.
- Build new UI surfaces (§5).

No dual-write, no backfill, no reader-flip phase.

**Code to delete in the same PR**:

- `lib/shared-categories-supabase.ts` (whole file)
- `lib/lists-supabase.ts` — `shareListWithUser`, `unshareListWithUser`, `copyList`, `addSharedResult`, `SharedResult` type, `sharedWith` / `sharedResults` fields on `QuestionList`
- `lib/groups-supabase.ts` — `shareListWithGroup`
- `app/api/lists/[listId]/{share,unsubscribe,copy,result}/route.ts`
- `app/api/categories/{share,shared}/route.ts`
- `app/api/groups/[groupId]/share-list/route.ts`
- `app/[name]/ProfileClient.tsx` — share search/panel, "shared with me" tab, group-share input, related state (`shareOpenId`, `shareInput`, `groupShareListId`, etc.) and handlers (`removeShare`, `handleShareSearch`, `handleShareListToGroup`)
- `app/components/HomeContent.tsx` — `inboxCats` and related rendering
- `app/test/[id]/TestClient.tsx` — `/api/lists/[listId]/result` POST

## 8. Storage estimate

Per attempts row: ~80 B columns + 3 indexes ≈ **~250 B effective**.

At **1k active users × 5 attempts/day**, with last-20-per-(user, resource) cap:

- Steady-state ≈ 1k users × ~20 resources actively used × 20 attempts × 250 B ≈ **~100 MB**.
- Without the cap, this grows ~450 MB/year forever. The trigger is the load-bearing piece.

Per shares row: ~120 B + 3 indexes ≈ ~400 B. Even at 100k share rows = **~40 MB**. Negligible.

`effective_shares` is a view, not a materialized view — it costs query-time work but no storage. The recursive folder branch is bounded by folder depth, which is small in practice. If the view ever becomes a hotspot, materializing it with refresh on `shares` / `folders` / `lists` / `qsets` mutations is the escape hatch.

## 9. Out of scope (deliberately)

- Public link sharing ("anyone with the link"). `role` and `status` are wide enough to add later.
- Editor-role sharing (collaborative edit). Schema-ready.
- Group leaderboards (members seeing each other's scores). Requires a per-group setting + visibility branch in `GET /api/attempts`; sketched in §4.2 behind a future flag.
- Per-child overrides inside a shared folder (e.g. "share this folder but exclude list X"). Adds substantial policy complexity; revisit if users ask.
- Score-attempt expiry beyond the per-(user, resource) cap.
- RLS policies for Supabase — current code uses the service-role admin client; if RLS is ever turned on, `shares` and `attempts` need policies mirroring the auth logic in §4.

## 10. Pending decisions

These block the doc being final. Each is structural — they change the shape of the design, not just a detail.

### 10.1 Vocabulary

Should the resource-sharing action stay as **"分享 / Share"**, or split into intent-specific verbs (**Send** to a person, **Invite** to a group, **Publish** to the world, **Post** a score)?

- **Stay with Share**: matches Drive/Notion/Figma convention. One verb covers all modes; modal explains intent. Cost: existing page-URL `ShareButton` component needs a rename (e.g. "Copy link") to free the word.
- **Split verbs**: surfaces intent at the verb itself before the user clicks. Cost: more vocabulary to maintain across UI, both EN and ZH. Doesn't generalize cleanly to "anyone with link" / "publish".

Not determined by accuracy or flexibility alone — it's a UX-principle call.

### 10.2 Pragmatic vs ideal design

The §3 data model is the **pragmatic** version: scoring is implicitly tied to access (recipient's attempts are visible to sender if `scores_visible_to_sender=true`). Score-back is a per-share boolean.

An **ideal** alternative separates publication from attempting:

- `attempts` is private by default — only the attempter sees their own.
- A new `posts(attempt_id, audience)` table records explicit "publish this attempt to that audience" actions.
- Sender's scoreboard reads through `posts`, not directly through `attempts`.
- Mode presets on `shares` (`drop` / `assignment` / `leaderboard` / `publish`) decide what gets auto-posted on attempt creation; user can unpost any attempt at any time.

Ideal is conceptually cleaner (privacy is opt-in per attempt, not per relationship) and handles "I just want to practice without polluting the scoreboard" naturally. Costs: one more table, one more layer of UI (post/unpost controls on the result screen + attempt history), more concepts for the user.

### 10.3 Escape hatches for future features

The roadmap mentions timed tests and real-time competition. Three small additions would avoid future migrations without designing those features now:

| Column | Cost | Buys |
|---|---|---|
| `shares.mode` text enum | 1 column | New share modes (timed assignment, live competition) added later by enum extension, not schema rewrite |
| `attempts.metadata jsonb default '{}'` | 1 column | Per-mode prototyping data without ALTERs; promote stable fields to real columns later |
| `attempts.resource_version_id text` | 1 column + write it from day 1 | Comparing scores across resource edits is meaningless without it. Hard to backfill, trivial to add now |

Add all three? Add a subset? Add none and accept future migrations?

## 11. Open questions

1. Should `POST /api/attempts` accept attempts on **public** resources (no share row), or only when the caller owns the resource or has effective access? Current `/api/lists/[id]/result` requires share-or-owner; this design follows that.
2. Should declining a share also delete the recipient's attempts on that resource? Recommendation: **no** — attempt history is the recipient's, not the share's.
3. Inbox unread state: `users.shared_inbox_seen_at` timestamp is the simplest model. Alternative is per-share `read_at`; more accurate, more writes. Recommendation: timestamp.
4. When a folder is **shared** and then **deleted** by the owner, the share row cascades away (FK). Does the recipient lose access to forks/copies they made of its contents? Recommendation: forks are independent — copy semantics already detach.
