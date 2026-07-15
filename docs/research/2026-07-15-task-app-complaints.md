# What people actually complain about in task apps

Research run: 2026-07-15. Method: 5 search angles, 7 sources fetched, 29 claims extracted, 25 put through 3-vote adversarial verification. 18 survived, 7 died. Every quote below was re-fetched and checked verbatim by a verifier that was told to kill it.

This fills the "Task-management workflow research" item in `ROADMAP.md`. It informs later releases; it does not expand current scope.

## The three loudest complaints

**1. Recurring tasks that punish you for missing a day.** Todoist users wake up to piles of overdue recurring items and clean them up by hand, one postpone at a time ([GTD forum, 2019](https://forum.gettingthingsdone.com/threads/new-to-todoist-questions-about-recurring-items.15411/)). The praised alternative is Nirvana's model: upcoming instances stay hidden until their date. Users built structural workarounds (one daily-repeating parent, non-repeating subtasks) popular enough that Todoist absorbed the pattern as a native feature in 2022.

**2. One date field for three different things.** "How do you distinguish between 'actual external deadline,' 'fake deadline I set to motivate myself,' and 'day when I put the task on my schedule to work on'?" ([Ask MetaFilter, 2020](https://ask.metafilter.com/341806/Distinguishing-different-kinds-of-deadlines-in-to-do-apps)). The poster said they'd switch apps over it. Amazing Marvin got the best-answer mark for shipping all three date types. Todoist validated the gap by shipping a separate Deadlines field in Dec 2024. Habitual rescheduling of soft dates makes users "somewhat numb" to the hard ones — same thread, quote verified via Wayback.

**3. The app becomes the procrastination.** Three HN commenters independently framed configuring productivity software as "gamified procrastination" ([HN, Aug 2025, ~800 comments](https://news.ycombinator.com/item?id=44864134)). A GTD forum replier named the ADHD version in 2011: "every new idea seems revolutionary so you feel like you need to rebuild everything every few days." Fourteen years apart, same failure.

## What users call indispensable

The mirror image of the complaints:

- **Ubiquitous low-friction capture.** The user who dropped OmniFocus ("too much. Overwhelming and not as omnipresent as I needed it to be") kept the tool that gave them email-in, audio capture while driving, photo capture, and sync across four devices ([GTD forum, 2011](https://forum.gettingthingsdone.com/threads/is-gtd-scalable-for-someone-with-adhd.9528/)).
- **Recurrence that stays invisible until its date.**
- **Multiple date types per task** (due vs. planned vs. self-imposed).
- **Plain-text portability and free sync.** todo.txt/org-mode + Syncthing praised across the HN thread — with the counterweight that plain-text devotees end up building "quite a lot of snowflake software to regain functionality offered by more structured TODO applications."

## The ADHD niche

Distinct failure signature, all first-person forum testimony (not prevalence data):

- Capture outpaces processing: "my brain is creating more Inbox entries than my body can process each day... a Daily Review of the Inbox is counter-productive" (2011).
- Heavyweight apps overwhelm; omnipresent capture beats features.
- Friction can help: an ADHD commenter says a paper Bullet Journal "works because of the friction of paper and pen. It mostly solves the accumulating backlog problem" (2025).

A widely-shared blog claiming a two-week abandonment cycle for ADHD users was refuted 0-3: single anecdote from a page selling $19 Notion templates.

## Vendor-side corroboration

Todoist's own 2026 changelog admits the mobile complaints: Android subtasks that "stubbornly jump around or reset their position while you're trying to reorder them" (fixed July 2), captured tasks falling out of their hierarchy to root level (July 2), and delete/rename/collapse actions that "wouldn't stick" (March 5). Changelogs prove the bugs existed, not how many people complained.

## What this means for Punchlist

- **Capture speed on phone is the gap that matters.** Every indispensable-feature list starts with omnipresent capture. Punchlist lives on one PC. This is the daily-driver blocker, and it should be decided before any feature work.
- **The P2 date model should separate "due" from "planned" from day one.** The single-date conflation is the most-cited scheduling gripe in the space, and vendors keep retrofitting the fix.
- **If recurrence ever ships: hidden until its date, never auto-overdue.** The overdue-pile mechanism is the top recurring-task complaint.
- **Flags-default-off is validated.** Over-configuration as procrastination is a named churn driver; Punchlist's zero-config default is the direct counter.
- **Export/Markdown portability is validated** — the local-first crowd's top praise. But the "snowflake software" warning applies to us: rebuilding sync/reminders/notifications one-off is exactly how single-file tools rot. Prefer rituals (copy a file) over infrastructure.

## Caveats

Surviving evidence concentrates on Todoist, GTD-forum power users, one MetaFilter thread, and one HN thread. Things, TickTick, Notion, ClickUp, Apple Reminders have no surviving complaint threads of their own here. Dates matter: the ADHD/GTD thread is 2011, recurring-tasks 2019, deadlines 2020; only the HN thread (Aug 2025) and Todoist changelog (2026) are current. Reddit specifically is underrepresented despite the brief — the forum/HN evidence is Reddit-adjacent, not reddit.com. Two findings rest on 2-1 verification votes (recurrence workarounds; the date-types app list).

## Open questions

- Did Todoist's Deadlines field and Reset sub-tasks actually reduce churn, or do users still leave over them?
- What do mainstream consumer-app users (Apple Reminders, Microsoft To Do, TickTick) complain about in their own threads?
- Does friction-based paper capture generalize for ADHD users beyond individual testimony?
- How common is mobile drag-drop pain as a stated churn reason, user-side, across apps?

## Sources

| Source | Date | Quality | Claims used |
|---|---|---|---|
| [HN: "I tried every todo app and ended up with a .txt file"](https://news.ycombinator.com/item?id=44864134) | Aug 2025 | forum | 5 |
| [GTD forum: Todoist recurring items](https://forum.gettingthingsdone.com/threads/new-to-todoist-questions-about-recurring-items.15411/) | Sep 2019 | forum | 4 |
| [Ask MetaFilter: kinds of deadlines](https://ask.metafilter.com/341806/Distinguishing-different-kinds-of-deadlines-in-to-do-apps) | Feb 2020 | forum | 5 |
| [GTD forum: GTD scalable with ADHD?](https://forum.gettingthingsdone.com/threads/is-gtd-scalable-for-someone-with-adhd.9528/) | Apr 2011 | forum | 5 |
| [Todoist 2026 changelog](https://www.todoist.com/help/articles/2026-changelog-HD3jJAtLd) | 2026 | primary | 5 |
| chudi.dev ADHD productivity post | 2025 | blog | 0 (all refuted) |
| Medium: Notion as a todo app | 2023 | unreliable | 0 |
