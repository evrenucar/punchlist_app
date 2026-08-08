# Origin security & migration design

Written 2026-08-08 against `worker/security-origin-design`. Paper design only; no app code changed.

Every claim about how Punchlist behaves today is cited as `file:line` against `src/` in this worktree. Where I could not verify something without a browser or without asking GitHub, it says UNVERIFIED and names the exact test. The board's own description of the problem is corrected in three places; those corrections are collected at the end.

## The two secrets, and what actually holds them

The GitHub sync token lives in its own localStorage key. `SYNC_STORAGE_KEY` is `STORAGE_KEY + "-sync"` (`src/app/01-constants.js:200`), read by `loadSyncConfig` (`src/app/05-github-sync.js:3`) and written whole, token included, by `saveSyncConfig` (`src/app/05-github-sync.js:12`). One reader uses it: `syncAuthHeaders` puts it in `Authorization: Bearer` (`src/app/05-github-sync.js:196`). One gate consults it: `syncIsActive` requires `enabled`, `repo`, `token` and a non-empty device name (`src/app/05-github-sync.js:22`). The separate key is deliberate and it works: board exports strip by exception (`src/app/04-import-export.js:10-17`) and the token was never in `state` to begin with.

The signing private key lives in the board itself. `createSigningIdentity` generates an ECDSA P-256 pair with `extractable: true` (`src/app/07-identity-signing.js:12`, params at `src/app/06-assets.js:223`), exports the private half to JWK, and parks it at `state.identity.privateKeyJwk` (`src/app/07-identity-signing.js:14-19`). `saveStateToLocalStorage` then writes the whole board, key included, as one JSON string under `scheduling-task-management-board-v1` (`src/app/03-state.js:128`, key at `src/app/01-constants.js:4`). It's read back by `signText`, which re-imports the JWK on every signature (`src/app/07-identity-signing.js:37`). The key isn't created at install; it's created the first time you export a board, because `getBoardExportPayload` is the only caller of `signText` (`src/app/03-state.js:244`).

A third store nobody has boarded: image bytes. `ASSET_DB_NAME` is `"punchlist-assets-v1"` (`src/app/05-github-sync.js:347`), opened with a bare `indexedDB.open` (`src/app/06-assets.js:9`). IndexedDB is scoped to an origin exactly like localStorage. Every screenshot the user has ever pasted sits in that database, readable by anything on the same origin.

So on `https://evrenucar.github.io/punchlist_app/`, six sibling Pages sites (clocktest, kora_aerospace_web, nokta_labs_website_v1, proto_website, thermal-cam, website) share read and write access to: the token, the private key, the whole board, and every pasted image. The board task proved read and write on the token by hand on 2026-07-29. Nothing about the mechanism changes for the other three.

---

## 1. Token & signing-key storage

### Does moving origin fix it?

For the shared-origin problem, yes, completely and by itself. localStorage and IndexedDB are partitioned by origin, so a dedicated hostname is a hard wall, not a mitigation. No code change makes the current arrangement safe while six other sites can execute on the same origin, and no code change is needed once they can't.

For the instruction Evren actually gave, "make sure the private keys can't be read by anyone," moving origin is not sufficient, and the gap is not XSS. It's `getSyncPayload`. That function spreads the entire state object with only `settings` removed (`src/app/05-github-sync.js:103`), so `state.identity` (private JWK and all) is base64'd and PUT into the sync repo on every push. `applySyncedState` then adopts the remote key when the local one is missing (`src/app/05-github-sync.js:129`). This is deliberate; the handoff records it at line 317, and it's what makes one signing identity work across a user's devices. But it means the private key's real security boundary is "who can read that private GitHub repo", which includes any repo collaborator and anyone holding a copy of the token. Moving origin doesn't touch this at all.

### What XSS on the app's own origin would still reach

Everything. `signText` imports the JWK from `state.identity` on demand (`src/app/07-identity-signing.js:37`), the token sits in plaintext in a localStorage key any script can read, and the asset database has no guard on it either. There's no isolation inside a single-file app; the whole thing is one script scope.

Task text is escaped before it reaches `innerHTML` (`escapeHtml` at `src/app/18-rendering-text.js:1`, applied to every plain run at `:59`, to code at `:70`, to link text and href at `:83`), so the obvious injection path from a pasted or imported board is closed. One place is not escaped: image sources are interpolated raw into the `src` attribute, at `src/app/16-rendering-parts.js:284` on the board and `src/app/18-rendering-text.js:99` in focus mode. The only validation is a prefix check in `normalizeTask`, `img.src.startsWith("data:image/")` (`src/app/16-rendering-parts.js:199`), which says nothing about the rest of the string. A hand-crafted board JSON carrying a `src` that starts with `data:image/` and later contains a double quote would break out of the attribute. I did not build the payload and did not test it, so treat this as a lead, not a finding. It deserves its own board item and a one-line fix; it is not part of this design.

### Where each secret should live on the new origin

**Token: leave it exactly where it is.** `SYNC_STORAGE_KEY` in localStorage, plaintext, one key of its own. There's nowhere better in a serverless single-file app. Cookies are worse (they ride every request and add flags nobody will maintain). IndexedDB is the same trust boundary with 30 more lines. A "session-only" token in `sessionStorage` would force a re-paste per tab, which breaks background sync on load, the thing `syncNow("load")` exists for. Encrypting it with a passphrase moves the problem to where the passphrase lives, and in a no-server app the honest answer is "in the user's head, typed on every launch", which nobody will do. The separate key already earns its keep by keeping the token out of exports.

**Signing key: leave it exactly where it is, in `state.identity`, extractable.** Non-extractable WebCrypto keys are the textbook answer and they are the wrong answer here, for a reason that has nothing to do with taste. A non-extractable `CryptoKey` cannot be serialized, so `crypto.subtle.exportKey("jwk", pair.privateKey)` at `src/app/07-identity-signing.js:14` stops working, `state.identity` can't hold the private half, `getSyncPayload` can't carry it (`src/app/05-github-sync.js:103`), and one identity across devices dies. You'd trade a cross-device feature that ships today for protection against exfiltration in an XSS scenario where the attacker can still sign anything they want using the handle. That's a bad trade twice over.

**Token scope: already minimal, so change the clock instead of the scope.** The UI already asks for a fine-grained PAT with Contents read and write on one repository (`src/task-board.html:200`, and the setup gap copy at `src/app/05-github-sync.js:30`). Read-only can't push. Repo-scoped can't go narrower than one repo. The only dial left is expiry. Recommend the sync guide tell people to set 90 days, which caps any future leak at one quarter and costs four re-pastes a year per device. Don't enforce it in code; the app can't see the expiry, and a hard-coded reminder would just rot.

**Rotate the current token now, before anything else ships.** It has been readable by six sites for as long as sync has existed on that origin, one of which loads `https://unpkg.com/lucide@latest`. Rotation is free, takes two minutes, and is the only action in this whole document that reduces existing exposure rather than future exposure.

### Recommendation

Storage stays exactly as it is. The fix is the origin, not the shape of the code. Rotate the token, put a 90-day expiry in the sync guide, and spend zero engineering effort on key storage schemes that a single-file app can't make real.

**Needs Evren:** does the hosted copy at `evrenucar.github.io/punchlist_app/` actually hold *his* token? The handoff says his live board is in this machine's browser under `file://` (line 305), which suggests it might not. Open the hosted app in a normal tab, Settings, GitHub sync, and say whether the Token field has anything in it. If it's empty, rotation is precautionary and the whole timeline relaxes. If it's populated, rotate today.

---

## 2. Migration

Nothing crosses a hostname boundary. Not the board, not the token, not the key, not the images, not the settings, not the device id. The new origin's first `loadStateFromLocalStorage` finds nothing and returns `migrateState(seedState())` (`src/app/03-state.js:116-117`), which is the example board with `example: true` (`src/app/03-state.js:29`). That is worse than an empty screen. It looks like a working board full of somebody else's tasks, with a banner offering "Start my own board" (`src/app/17-rendering-board.js:41-43`) whose button calls `startOwnBoard`. A user who assumes their data is gone and presses it has now wiped nothing real, because their board is still safe on the old origin, but they don't know that.

### What each thing costs to carry

The board travels through export/import, which already exists and already re-embeds images: `getExportState` calls `embedImagesInExport` (`src/app/04-import-export.js:10`), so a JSON export is lossless including pictures, and `handleImportFile` reads it back with a `FileReader` (`src/app/04-import-export.js:130-137`).

Settings do not travel in that file. `getExportState` sets `settings: undefined` (`src/app/04-import-export.js:12`). They have their own export, a separate download, `downloadSettingsExport` (`src/app/04-import-export.js:118-128`). Any migration instruction that mentions one file and not two will silently reset the user to `DEFAULT_SETTINGS` (`src/app/01-constants.js:19-46`), including their completion retention and their delete mode. Two files, or you're handing people a data-shaped surprise.

The token does not travel and should not. It was exposed; it gets rotated, not moved.

The signing key does not travel through export by design. `getExportState` strips `identity` and `contacts` (`src/app/04-import-export.js:13-14`), and the import path refuses to adopt one when a local key exists (`src/app/04-import-export.js:66`). On a fresh origin there is no local key and the file carries none, so `state.identity` is null after import and a brand-new pair gets generated on the first export from the new origin.

The key *does* travel for sync users, automatically, and this is the single most useful fact in this section. The sync payload carries `identity` (`src/app/05-github-sync.js:103`) and a pull adopts the remote key when the local slot is empty (`src/app/05-github-sync.js:129`). So a sync user who opens the new origin, types repo, token and device name, and hits Sync gets their board, their images (`pullMissingAssets`, `src/app/05-github-sync.js:300`) and their original signing identity, in one step. No files, no export, no fingerprint change.

The device id does not travel. `loadDeviceIdentity` mints a fresh one on the new origin (`src/app/02-identity-device.js:3-10`), so one physical laptop shows up twice in the synced roster (`state.devices`, populated by `touchDeviceRoster`, `src/app/02-identity-device.js:26-30`). Cost: a stale row in Settings, and history entries split across two names for the same machine. The user can forget the old one (`forgetDevice`, `src/app/02-identity-device.js:53`). That's the whole fix and it already ships.

### Identity-key continuity: what breaks if the key doesn't migrate

Three things, and all three are cheap today.

History attribution doesn't use the signing key at all; it uses the device name (`deviceDisplayName`, `src/app/02-identity-device.js:18-22`). Unaffected.

Sync reconciliation doesn't use the signing key either. `syncDecision` reads `rev`, `editedAt`, and shas (`src/app/05-github-sync.js:79-95`). Unaffected.

Export provenance is the only real casualty. A recipient who imported one of Evren's boards before the move has his old fingerprint in their `state.contacts`; a board signed by a new key returns `"first-contact"` instead of `"known"` from `importTrustVerdict` (`src/app/07-identity-signing.js:52-57`), and the toast changes from "the same sender as before" to "the first import from this sender" (`src/app/04-import-export.js:96-97`). That's one confusing sentence for someone who imports his exports. Per the handoff at line 105, the count of such people is approximately zero: "I have shared the app with many people but no-one seems to be using it atm."

**Recommendation on the key:** let it ride the sync repo for sync users, and let it regenerate for everyone else. Don't build a key-migration path, and don't build a key-rotation path either. Rotating would be defensible (that key was readable by six sites, so anyone who scraped it can forge his signature forever), but the blast radius is "can sign a JSON file that nobody verifies", against a token whose blast radius is "read and write a private repo". Different urgency. Rotate the token; leave the key alone unless Evren says otherwise.

### The three populations

**The user who follows instructions.** Sync user: open the new URL, Settings, GitHub sync, paste repo + a freshly rotated token + a device name, press Sync now. Board, images and identity land in one pull. Non-sync user: on the old URL, export the board JSON and export the settings JSON; on the new URL, import both; then delete the old board from the old origin if they want it gone. Both paths use shipped code. Nothing new is needed for this population except the words.

**The user who does nothing and one day lands on the new URL.** They see the example board and conclude Punchlist ate their tasks. This population is why the old origin must keep working, and it is the entire reason for the recommendation below. Give them a first-run line on the new origin, shown only when `state.example` is true and the app is not on `file://`: "New here? If you used Punchlist at the old address, your board is still there. Open it, export, come back and import." with the old URL as a link. That's copy plus one condition, not a feature.

**The user who keeps using the old URL because it's bookmarked.** They keep working, forever, and that is fine as long as the old origin keeps serving the app. Their risk is the one we started with, so the old copy is where the strongest warning goes, and it's where sync gets switched off (see section 4, proposal P4). A bookmark that quietly stops working is a worse outcome than a bookmark that works and nags.

### What the old origin should do once the new one is live

Keep serving the full app. Un-redirected. Forever. GitHub Pages costs nothing to leave up, and the alternative loses people's boards.

Add, on the old origin only: a persistent move banner naming the new address, the shared-origin warning at maximum severity, and no Sync section. Sync gets hidden rather than left running, because the whole point of the move is to stop credentials sitting on a shared origin; leaving the token field on the old copy invites people to paste a fresh token straight back into the exposed store. Export stays, import stays, the board stays editable. The old copy becomes a place you can read and rescue your data from, not a place you keep a credential.

**This is why the custom-domain route needs care.** If GitHub 301s `evrenucar.github.io/punchlist_app/` to the custom domain the moment the domain is configured, the bookmarked population and the do-nothing population both lose access to the origin holding their data, and the plan above becomes impossible. I checked two GitHub Pages docs pages and neither states the behaviour for project sites; UNVERIFIED. Test before buying anything: configure the domain on a throwaway repo, then run `curl -sI https://evrenucar.github.io/<throwaway>/` and read the status line. If it's a 301, take the new-repo route in section 5, which sidesteps the question entirely.

### Recommendation

Migration is export/import for file users and a sync pull for sync users, both of which ship today. Write the instructions, ship the first-run line, keep the old origin alive un-redirected with sync disabled, and build no bridge.

I considered and rejected a `postMessage` bridge (the new origin embeds a hidden iframe of an old-origin page, which reads its own storage and posts the payload across with an `event.origin` check). It's about 40 lines, no dependencies, no server, and it's the only mechanism that can move data without the user touching a file. It loses on two counts. It only helps someone who visits the *new* URL, whereas keeping the old origin alive helps whoever visits *either*, including the person who comes back in eleven months. And it would hand the token across, which is the one thing that must not be reused. Keeping the old origin alive is strictly lazier and strictly better.

---

## 3. Shared-origin warning, today

### Trigger

The rule has to be list-free or it rots the first time Evren publishes a seventh Pages site. Use path depth, in this order, with the first two checks first for reasons that section 4 explains:

1. `IS_DEMO` (`src/app/01-constants.js:3`) means no warning. The demo has no secrets to lose: `signingAvailable()` returns false when `IS_DEMO` (`src/app/07-identity-signing.js:2`) so no key is ever generated, and `syncIsActive()` returns false when `IS_DEMO` (`src/app/05-github-sync.js:22`) so no token is ever used. It's also storage-isolated by the `-demo` suffix (`src/app/01-constants.js:4-5`). A warning there would be a lie.
2. `IS_LOCAL_FILE` (`src/app/01-constants.js:9`) means no warning. This check must come *before* any path test, because on `file://` the pathname is a disk path like `/C:/Users/evren/Downloads/task-board.html`, which has depth 3 and would otherwise trip every path rule you could write.
3. Otherwise, strip a trailing `index.html` or `task-board.html` from `location.pathname`. If what's left is `/`, no warning. Anything else, warn.

Why path depth is the right signal. GitHub Pages serves every *project* site at `https://<owner>.github.io/<repo>/`, and the repo segment is itself the proof that the origin is subdivided: something else owns `/`, and by construction every other repo that owner publishes gets its own segment on the same origin. A GitHub *user or org* site (`punchlist-app.github.io`) and a custom domain both serve the app at `/`. So the rule turns itself off on the day the app moves, with no constant to update and nothing to forget. It generalises honestly beyond GitHub too: an app served from a subdirectory is an app sharing a host with whatever else lives at that host's other paths.

It is conservative in one direction. Somebody self-hosting Punchlist at `myserver.example/tools/punchlist/` on a box with nothing else on it gets a warning they don't strictly need. That false positive costs a sentence of copy. The false negative costs a token with write access to a private repo. Take the false positive.

### Evidence line

Add a second sentence, only when it has a number to report: count the localStorage keys that don't start with `"scheduling-task-management-"`. Every key the app owns starts with that string, because `STORAGE_KEY` and `THEME_STORAGE_KEY` both do (`src/app/01-constants.js:4-5`) and the other four are `STORAGE_KEY` plus a suffix (`src/app/01-constants.js:200`, `:203`, `:213`, and `src/app/25-app.js:770`). A non-zero count is direct evidence that another site has already written to this storage, which beats an abstract claim about browser scoping.

Don't use the count as the trigger. Zero foreign keys proves nothing: a sibling site might store its state in IndexedDB, in cookies, or nowhere at all, and still be able to read yours.

### Copy

Two severities, keyed on whether `syncConfig.token` is a non-empty string.

Token present, red, not dismissible, `{host}` from `location.host`:

> **Your sync token is not private on this address.** Punchlist is running at `{host}/{path}`, and browsers give every page on `{host}` the same storage. Any other site published under that name can read your GitHub token and write to this board. Rotate that token, then either run Punchlist from a copy on your own disk or turn sync off here until Punchlist has an address of its own.

No token, amber, dismissible:

> **This address shares storage with other sites.** Punchlist is running at `{host}/{path}`, and every page on `{host}` reads and writes the same browser storage. Another site published there can read and change the tasks on this board. A copy downloaded to your own disk doesn't have this problem.

Append when the foreign-key count is above zero: "Right now this storage holds {n} entries that don't belong to Punchlist."

Every sentence there is checkable and none of it is prediction. It doesn't claim an attack has happened. It doesn't name the six sibling repos, because the app can't see them and hardcoding them would be exactly the list that rots.

The download link must not point at `LATEST_BUILD_URL` (`src/app/01-constants.js:14`), which is the shared origin. Point it at `UPDATE_RELEASES_PAGE` (`src/app/01-constants.js:16`).

### Placement

Two places, both existing patterns.

Settings, GitHub sync section, immediately above the Token input at `src/task-board.html:200-202`. That's the exact moment a person is about to paste a credential, and the section is already conditionally rendered (`src/app/21-settings.js:40`), so the plumbing exists. Note the tooltip on that label currently reads "It stays in this browser and is never exported" (`src/task-board.html:200`). True and, on a shared origin, misleading. Amend it there too.

A board-top strip, in its own host div next to `[data-example-banner-host]` (`src/task-board.html:328`), rendered the same way the example banner is (`src/app/17-rendering-board.js:41-43`) with the `.example-banner` styling (`src/task-board.css:194`) and a warning colour variant. Its own div, not that one, so a new user sees both the example banner and the warning rather than one silently replacing the other.

Never a modal. The warning must not block a board the user can still legitimately use.

### Recommendation

Ship the detector, both severities, both placements, before the domain exists. It's the only thing in this document that helps a hosted user who never reads a release note, it fires on exactly the condition that's true, and it turns itself off on the day the move lands.

---

## 4. `file://` preservation

The downloaded copy is safe because `file://` is its own origin, and the acceptance bar here is that every proposal leaves it working with zero network access, zero dependencies and no server. Each proposal is checked on its own below.

Two general facts first. Every web API this design touches is already guarded in the source: `signingAvailable()` guards `crypto.subtle` and degrades to unsigned exports (`src/app/07-identity-signing.js:2`), `assetsAvailable()` guards `indexedDB` and keeps images embedded in state when it's missing (`src/app/06-assets.js:2`), and network calls are already gated to their purposes (`updateChecksEnabled` requires `IS_LOCAL_FILE`, `src/app/16-rendering-parts.js:673`). The one storage call with no guard anywhere is `localStorage.getItem` in `loadStateFromLocalStorage` (`src/app/03-state.js:116`), which sits outside the `try` that begins on line 118. Nothing in this design makes that worse, but it's the boot path and it deserves its own board item.

And one honest caveat about the premise. Board task-sec-3-plz0 says a downloaded copy is safe because `file://` is its own origin. That's certainly true against web sites. I could not verify whether Chrome gives every `file://` document a *separate* localStorage or one shared `file://` store, which would mean any other local HTML file the user opens can read Punchlist's board. UNVERIFIED, and it matters for whoever writes the user guide. Test: save two different HTML files to disk, have one write `localStorage.setItem("x","1")`, open the other and read `localStorage.getItem("x")`. If it returns `"1"`, the guide should say "safe from websites" rather than "safe".

**P1, move the hosted copy to a dedicated origin.** No app code. The distributable HTML is byte-identical; only where a *copy* of it is served changes. `file://` unaffected. Zero network, zero dependencies.

**P2, keep the old origin alive with a move banner.** The banner is gated by the P3 detector, which returns "no warning" on `file://` at check 2. Nothing renders. The banner text hardcodes no URL fetch; it's a link the user may click. `file://` unaffected. **The trap:** if the detector is implemented with the path test before the `IS_LOCAL_FILE` test, every downloaded copy on earth shows a move banner, because a Downloads folder path has depth. Order matters and it's specified above.

**P3, the shared-origin warning.** Same gate, returns early on `file://`. The foreign-key count never runs, which also sidesteps the unverified `file://` localStorage question entirely. Zero network: the copy in the warning is static text, the download link is an `href` the user chooses to follow. `file://` unaffected.

**P4, hide the Sync section on a shared origin.** This is the one proposal that can silently break the downloaded copy, and only if it's written backwards. Today the section is hidden for exactly one reason: `syncSectionEl.hidden = IS_DEMO` (`src/app/21-settings.js:40`). Adding a second condition is safe if and only if it's phrased *positively*, as "hide when the shared-origin detector says shared". If anyone phrases it negatively, as "hide unless the host is the new domain", every `file://` user loses sync, because on `file://` the host is the empty string and will never match. Same failure mode as the update section, which got this right by testing `!IS_LOCAL_FILE` explicitly (`src/app/21-settings.js:56`). Write it positively and `file://` is unaffected.

**P5, migration by export/import.** Both halves already run on `file://` today: export builds a Blob and clicks a synthetic link (`src/app/04-import-export.js:102-112`), import uses a `FileReader` (`src/app/04-import-export.js:130-137`). No new API, no network, no dependency. `file://` unaffected. The only `file://` consideration is the guide: a downloaded copy has nothing to migrate, so the migration instructions must be scoped to the hosted app or they'll confuse people who were never at risk.

**P6, migration by sync pull.** Uses `fetch` to `api.github.com`, which the downloaded copy already does for sync (`src/app/05-github-sync.js:229`) and for the update check (`src/app/16-rendering-parts.js:681`). No change to either. `file://` unaffected.

**P7, rotate the token and give it a 90-day expiry.** This is the one proposal that costs the `file://` copy something real: a downloaded copy with sync configured stops syncing the moment the old token dies, and shows `Sync failed: GitHub answered 401; check the token` (`src/app/05-github-sync.js:243`). That's a visible, correctly-worded failure rather than silence, so it degrades loudly, which is the acceptable kind. Four re-pastes a year per device. Recommend as sync-guide guidance, never enforced in code, since the app cannot see a token's expiry.

**P8, keep the signing key extractable in `state.identity`.** This is a decision not to change anything, so by construction it can't regress `file://`. Worth stating the inverse: switching to non-extractable keys would break `getSyncPayload` (`src/app/05-github-sync.js:103`) identically on `file://` and on https, so the downloaded copy would lose cross-device identity along with everyone else.

**P9, remove the unpkg script from nokta_labs_website_v1.** Different repository, no Punchlist code. `file://` unaffected.

**P10, sync-guide and README wording.** Documentation. `file://` unaffected, though the guide must be explicit that the origin problem is hosted-only, or downloaded users will think they need to act.

The rejected `postMessage` bridge is worth one more sentence here, because it's the proposal that *would* have broken `file://`. Its receiving half lives in the app, and on the downloaded copy it would have created a hidden iframe pointing at an https URL, which is a network request from a build whose entire rule is that it never phones home (`src/app/01-constants.js:6-9`). It would have needed its own `!IS_LOCAL_FILE` gate, and unlike `crypto.subtle` and `indexedDB` there's no existing guard to hang it on. One more reason it's the wrong tool.

---

## 5. Origin choice inputs

### What a custom domain fixes and costs

Fixes: origin isolation, permanently and completely, for localStorage, IndexedDB, cookies and everything else the browser partitions. Also fixes it against *future* siblings, because the domain is Punchlist's and no other repo can publish onto it.

Costs: a registration fee (a `.com` typically runs around $10 to $15 a year, which Evren should check at his own registrar rather than take from me), DNS records, a `CNAME` file in the published directory, and a wait for the certificate. It is also the one input that requires him to spend money and hold an account, which is why it's his purchase and not ours.

The open risk is the redirect question from section 2. If configuring a custom domain on the `punchlist_app` repo makes GitHub 301 the old project URL to the new domain, then the moment he flips it, every hosted user's board becomes unreachable through any page he controls, and every user who hasn't migrated by that instant loses access. UNVERIFIED, and it's the single highest-consequence unknown in this document.

**There's a route that makes the question irrelevant.** Put the custom domain on a *new* repository that serves the app, and leave `punchlist_app`'s Pages exactly where it is. Nothing about the old URL changes, so nothing can redirect it. The old origin keeps serving the app with the move banner and no Sync section, per section 2, for as long as GitHub Pages exists. Cost: one repo, one Pages setup, and a build that writes the app into it. Roughly an afternoon, against a risk of silently orphaning boards. Take the afternoon.

### What a free dedicated origin fixes and costs

A GitHub organisation site gives `<org>.github.io`, which is a different hostname, which is all the browser cares about. It fixes origin isolation just as completely as a domain, for zero money and about ten minutes.

Three things it does not fix. The org name must be globally unique on GitHub, so `punchlist.github.io` may well be taken and the actual name might be `punchlist-app.github.io` or worse; Evren won't know until he tries. The isolation is only as good as his discipline: the org's `<org>.github.io` repo owns `/`, but any *other* repo in that same org that publishes Pages lands on the same origin under a subpath, so a second project in the org reintroduces exactly the problem being fixed. And it's an account change, which means it's his to make, not ours.

### Sequencing, and the cost of moving twice

Moving origin twice means migrating users twice, which means running the three-population problem twice, writing the instructions twice, and asking everyone to re-paste a token twice. It doubles the only expensive part of this whole project. So the question is what the free origin actually buys during the gap, and the answer is: it closes the same hole that ten minutes of work closes for free.

Board task-sec-1-84za already names the mitigation available today: pin or remove `https://unpkg.com/lucide@latest` on nokta_labs_website_v1. That's the one concrete piece of unpinned third-party code executing on the shared origin. Remove it and the remaining risk is bounded by Evren's own discipline across six repositories he owns, none of which then loads code he didn't write. Add a rotated token with a 90-day expiry and the shared-origin warning from section 3, and the gap is covered without moving anybody.

The free origin's only advantage over that is speed, and ten minutes of deleting a script tag is faster than standing up an org, republishing, and migrating every user. It buys nothing the free mitigation doesn't, and it costs a full extra migration.

### Recommendation

Skip the free org origin. Move once.

Order of operations:

1. Today, no code: remove the `unpkg.com/lucide@latest` script tag from nokta_labs_website_v1, and rotate the GitHub sync token with a 90-day expiry.
2. Next build: ship the shared-origin detector and warning (section 3, proposals P3 and the settings copy fix).
3. When Evren has picked a domain: create a new repo, point the domain at it, publish the app there, and verify with `curl -sI` that `evrenucar.github.io/punchlist_app/` still returns 200 rather than a redirect.
4. Then, and only then, escalate the old origin: move banner, warning at maximum severity, Sync section hidden (P2 and P4). Ship the first-run "your board is still at the old address" line on the new origin at the same time.

Nothing in steps 1 and 2 depends on the purchase, and step 1 is the only step that reduces exposure that already exists.

**Needs Evren, and this is the decision the schedule hangs on:** new repo for the domain, or the domain on `punchlist_app`? The new repo costs an afternoon and removes the redirect risk entirely. The domain on `punchlist_app` costs nothing extra and might be fine, but "might" is doing real work in that sentence, and if it's wrong the failure is other people's boards. I recommend the new repo. If he'd rather not, the `curl -sI` test on a throwaway repo has to happen before the purchase decision, not after.

---

## Corrections to the board's description of the problem

Five things I found that the board records differently or doesn't record.

**The file:line in task-sec-4-1lji is stale.** It cites `src/task-board.js:679`. That file no longer exists; the source was split into 25 numbered parts on 2026-07-29 (AGENTS.md, Layout). Current locations: the sync config is read at `src/app/05-github-sync.js:3` and written at `:12`, and the key is defined at `src/app/01-constants.js:200`.

**The blast radius is bigger than localStorage.** The board describes localStorage only. IndexedDB is partitioned identically, and every image the user has ever pasted lives in `punchlist-assets-v1` (`src/app/05-github-sync.js:347`, opened at `src/app/06-assets.js:9`). The six sibling sites can read the pictures too.

**"Own origin fixes both at once. Nothing short of it does" (task-org-3-3sof) is half right.** It's right about the shared-origin problem. It's wrong that own origin makes the signing key unreadable, because the key leaves the origin by design: `getSyncPayload` spreads the whole state, `identity` included, into the sync repo (`src/app/05-github-sync.js:103`). Against Evren's actual instruction, "make sure the private keys can't be read by anyone", the repo's read access is a second boundary that no amount of origin work touches.

**"Stored in plain text in localStorage" and "the origin is shared" are two different findings.** The first is true on every origin including `file://` and has no fix in a serverless single-file app. The second is the actual defect and has exactly one fix. Conflating them makes the plaintext storage look like something a code change could solve.

**task-org-2-fxix's premise is challenged.** It says a free own-origin route "has to carry it until" the domain lands. Section 5 argues it doesn't: removing one script tag closes the same hole for free and avoids a second migration of every user.

## Open questions for Evren

1. Does the hosted copy at `evrenucar.github.io/punchlist_app/` hold your token? Settings, GitHub sync, is the Token field populated? If it's empty, rotation is precautionary and the timeline relaxes.
2. New repo for the custom domain, or the domain on `punchlist_app`? I recommend the new repo. It costs an afternoon and removes the redirect risk described in section 2.
3. What domain? Nothing goes into a `CNAME`, into copy, or into the first-run line until there's a name.
4. After the move, should the old origin hide its Sync section (my recommendation) or keep it working behind a red warning? Hiding it takes the credential off the exposed origin permanently; keeping it means a user who never migrates keeps syncing and never has to act.
5. Rotate the signing key, or let sync carry the old one across? I recommend carrying it. Your instruction reads like you might want a fresh one, and this is your call, not mine.
6. The `unpkg.com/lucide@latest` tag on nokta_labs_website_v1: pin to a version, or remove it? I recommend removing it. It's ten minutes either way and it's the one live piece of foreign code on the origin.

## Follow-up board items this design produced

Not part of the origin work, found while reading the source, each needs its own item.

- `src/app/16-rendering-parts.js:284` and `src/app/18-rendering-text.js:99` interpolate an image `src` into an HTML attribute without escaping. The only validation is a `startsWith("data:image/")` prefix check at `src/app/16-rendering-parts.js:199`. Not exercised, not proven, worth a one-line fix and a regression test.
- `src/app/03-state.js:116` calls `localStorage.getItem` outside the `try` that starts on line 118. It's the boot path; a browser that blocks storage throws before the app draws anything.
- The token tooltip at `src/task-board.html:200` promises "It stays in this browser and is never exported." Accurate about exports, and on a shared origin the first half reads as a stronger promise than the browser makes.
