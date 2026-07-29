# Formatting round two

Shipped in v1.5.37, built to the answers you gave in the grill on 2026-07-29.

Round one was pulled on the 28th because of one bug you reported in one sentence: two asterisks went to the line below when you pressed Enter with a bolded word at the end of a line. That bug was never really about asterisks. It was about a caret sitting inside a rendered span, with characters either side of it that existed in your text but not on your screen.

## What you can do now

Type these inside a task and they render:

| You type | You get |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `~~struck out~~` | ~~struck out~~ |
| a backtick either side of the words | a monospace chip |
| `__bold__`, `_italic_`, `___both___` | the underscore spellings, same result |
| `***both***` | bold and italic together, nested |

Ctrl+B, Ctrl+I and Ctrl+Shift+S are back. They write plain Markdown into the task, so a copy, an export or a paste into Obsidian carries the formatting with it. Pressing the same pair again takes it off.

Links are not formatting and render in every mode. That was your line, and it is the rule.

## The one decision the whole thing rests on

You said it yourself: raw while editing the row, rendered everywhere else. I did not build that by swapping the row's contents when you click in. Swapping is what round one did, in effect, and swapping is what moves carets.

The markers are never removed at all. They sit in the row as ordinary text, wrapped in a span, and one line of CSS decides whether that span is displayed.

So when you click into a row, nothing re-renders. The text does not change, the DOM does not change, the caret does not move. The asterisks simply become visible.

That has three consequences worth knowing, because they are why this round should hold where the last one did not.

**What you see is the stored text.** While you are editing, the row shows exactly the characters saved on disk. Not a representation of them. Them.

**Enter splits where you can see it split.** Put the caret after the d in `**bold**` and press Enter, and you get `**bold` and `**`. That is not the old bug coming back. The old bug was that you could not see the asterisks and the split surprised you. Now they are on screen, in front of the caret, and the split is the one you aimed at.

**Nested marks work.** `***both***` puts an italic inside a bold. Under round one's machinery that arrangement reproduced your original bug exactly. It cannot here, because neither tag hides a single character.

## Settings, Formatting

Three controls, all of them yours from the grill.

**Markdown** is the mode. *Raw while editing* is your mode E and the default. *Always rendered* never shows a marker. *Never rendered* formats nothing at all, so the row reads as the characters you typed.

**Formatting shortcuts** turns Ctrl+B and friends on or off. Your words: "default can be standard shortcuts tho".

**Whole words only** is the literals rule. On by default.

## The literals rule, and the one case that will surprise you

Your test, quoted: the spaces are OUTSIDE the asterisks, not inside. So a marker only counts when there is a space, a bracket or nothing at all on the outside of it.

Safe, all of these stay literal: `2*3*4`, `some_file_name.txt`, `build_task_board`, `a*b*c`.

Still works, because the spaces are outside: `**a whole sentence bolded**`. And `**bold**.` at the end of a sentence renders, because I let punctuation close a marker. Without that, every bolded word at the end of a sentence would have stayed raw, which is not what you meant.

Here is the case worth knowing before you hit it. `__init__` standing on its own DOES go bold. The spaces are outside it, so by your own rule it qualifies, and CommonMark agrees. Inside a word it is safe again: `a__init__b` stays literal. If that annoys you, turn Whole words only off and the looser behaviour is one click away, or say so and I will special-case a double underscore.

## What I did not build, and why

Two answers on the board disagreed with each other, so I went with the later one.

The grill said build D and E both, because you defined both and asked for the menu. The v1.5.35 round, which came after it, said "Ship A, B and E first, add C and D once E is proven" with a note to board the others as future.

So the menu offers A, B and E. Mode D, where only the visual line your caret is on goes raw, is still on the board as future and is now the only piece of round two left. It needs machinery to find which wrapped line a caret sits on, which is the kind of thing that broke round one, and E does not need it at all.

Tell me if you want D anyway and I will build it.

## What I checked, rather than assumed

154 tests pass, up from 149.

In a real browser, against the built file, at desktop and phone width: rendered when the row is idle, raw with markers showing while editing, the caret offset exact on both sides of a bold word, Enter splitting where the markers say it will, Ctrl+B applying to a selection, and the three settings rows each sitting on one line.

One bug fixed on the way past, and it was in shipped code rather than in the new work: a line break in the text between two matches lost its break. It was invisible while links were the only thing that matched. With bold and friends matching too, it would not have stayed invisible.
