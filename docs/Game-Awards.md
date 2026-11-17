# GS Game Awards

The current-year edition is available to authenticated GSPlay accounts at `/awards`.
Administrators manage it at `/admin/awards`; helpers have member access only. No Discord
link, owned-library membership, platform filter or automatic release-year eligibility rule applies.
Administrators curate eligibility during review, including categories intentionally covering older games.

## Workflow

1. Create the current-year edition and prepare nomination category names and descriptions.
2. Save the categories, then start nominations with a required closing date/time in Europe/Rome.
3. Members choose up to four distinct IGDB games per category. Categories may be skipped,
   but the complete submission must contain at least one selection. The confirmation dialog
   previews the choices before the final submission. No edits or resubmissions are supported.
4. At the deadline, nominations close into review. Administrators can also close them early.
   Review is manual: raw selections, participant account IDs/names/timestamps and per-title
   counts are reference material. Administrators build a separate set of voting categories and
   finalists using canonical IGDB URLs. Saving an empty finalist list is allowed during review;
   every category on the launched ballot must have at least one finalist. No automatic deduplication,
   promotion of nominees, category copying or finalist selection occurs.
5. Save the voting categories and explicitly confirm the shortlist/start voting, choosing a required
   closing date/time in Europe/Rome. Categories, finalists and deadlines are fixed after launch.
6. Members submit one final ballot with at most one finalist per category and at least one vote overall.
   Voting uses the same preview/confirmation step and permits no edits or resubmissions.
7. At the deadline (or explicit admin close), voting closes. Results and voter identities remain
   admin-only. Administrators manually confirm one finalist as winner for each category, resolving
   ties or choosing a winner even if a category has no votes. Confirmation does not publish anything.
8. A separate explicit publish action reveals winners and their game metadata to members.
   Public vote counts, standings, raw ballots and participant identities are never returned.
   Published records cannot be edited or reopened.

The member page polls for phase changes every 30 seconds. The server enforces deadlines on every
submission independently of polling. Deadline expiration never opens voting or publishes results.
There is no past-edition browsing UI; all edition data carries its year through the persisted edition
aggregate, including nomination categories, voting categories, game snapshots, submissions and winners.

## Ownership and persistence

- `src/core/models/AwardsEdition.js`: MongoDB edition aggregate.
- `src/core/services/awardsService.js`: phases, validation, IGDB resolution, submission and publication rules.
- `src/api/routes/awardsRoutes.js`: existing GSPlay authentication and admin-only HTTP boundary.
- `gsplay-frontend/src/pages/Awards.jsx` and `AdminAwards.jsx`: member and admin screens.

The new `awards_editions_v2` collection has a unique year index, registered in the standard schema
bootstrap. No existing collection migration or new environment variable is needed. Existing server-side
IGDB credentials are required for nomination search, nomination validation and finalist URL resolution.
IGDB games are snapshots in Awards, independent of `CanonicalGame` and owned libraries.

An edition is a single consistency boundary. Final submission uses one conditional atomic update
checking phase, database time against the deadline, and absence of a previous submission by that user.
This works with the existing standalone MongoDB setup and does not require replica-set transactions.
Submissions are excluded from ordinary model queries and exposed only through the explicit admin DTO.
Admin configuration changes use phase/version conditions to reject concurrent or stale updates.

This aggregate is intended for the community's annual event, and is subject to MongoDB's 16 MiB
per-document limit. A substantially larger audience would require partitioning submissions with an
appropriate transactional strategy; there is no such audience-size assumption elsewhere in GSPlay.

## HTTP endpoints

All paths are below `/api/v2` and require an authenticated GSPlay account.

| Method | Path                              | Behavior                                                                           |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------- |
| GET    | `/awards`                         | Current-year phase, own submission flags, and phase-appropriate categories/winners |
| GET    | `/awards/games?q=...`             | IGDB search during nominations; minimum three characters                           |
| POST   | `/awards/nominations`             | Final nomination submission                                                        |
| POST   | `/awards/ballots`                 | Final ballot submission                                                            |
| GET    | `/admin/awards`                   | Admin-only configuration, participation, raw selections and totals                 |
| POST   | `/admin/awards`                   | Create current-year draft                                                          |
| PUT    | `/admin/awards/categories`        | Save nomination categories in draft or independent voting categories in review     |
| POST   | `/admin/awards/start-nominations` | Start nominations with `closesAt`                                                  |
| POST   | `/admin/awards/close-nominations` | Close nominations early into review                                                |
| POST   | `/admin/awards/start-voting`      | Freeze shortlist and start voting with `closesAt`                                  |
| POST   | `/admin/awards/close-voting`      | Close voting early, keeping results private                                        |
| PUT    | `/admin/awards/winners`           | Confirm one winner per voting category after close                                 |
| POST   | `/admin/awards/publish`           | Publish confirmed winners explicitly                                               |

Admin updates require the current `version`. Phase launch receives `closesAt` as a
`YYYY-MM-DDTHH:mm` Europe/Rome local time; stored deadlines are UTC instants. Member submissions
receive `{ editionId, selections: [{ categoryId, igdbIds: [...] }] }`. Identity always comes from
the authenticated session, never the request body.

## Verification

API coverage includes permissions, phase order, immutable configurations, deadlines, in-flight provider
lookups, concurrent submissions, selection validation, independent review categories, zero-vote winner
fallback, tie resolution and unpublished-result confidentiality. IGDB provider tests verify unrestricted
platform/partial-title search. Playwright checks final confirmations and submitted states across all
six configured viewports, plus a full admin/member lifecycle against the isolated real API with fake IGDB.
