# Mobile focus, navigation, and safe-area evidence

Captured from the generated `outputs/task-board.html` in Chromium mobile emulation at 390×844 on 2026-08-13.

## Root causes

- Focus mode inherited desktop-sized intrinsic widths. Deep outline indentation, long editable strings, and wide images could therefore expand grid/flex descendants beyond the visual viewport.
- Back and Fold all were direct children of the desktop top bar, with no mobile action dock or bottom safe-area offset.
- The only hamburger stayed in normal document flow, so it scrolled away. Moving that same control to fixed positioning also needed a reserved 44px header slot to avoid a layout shift and touch-coordinate regression.
- Mobile `main` ended with only 20px padding, leaving Completed and Trash too close to iPhone Safari's bottom chrome.

## Rendered proof

- `focus-mode-390x844.png`: long unbroken title and outline text wrap; wide image fits; Back and Fold all are in the bottom-left dock.
- `hamburger-pinned-deep-scroll-390x844.png`: the single hamburger is fixed at viewport top-right after deep scrolling.
- `hamburger-reattached-top-390x844.png`: the same control returns to its normal topbar geometry at scroll top.
- `completed-trash-max-scroll-390x844.png`: Completed and Trash are fully visible at maximum scroll with safe blank end space.

Rendered max-scroll geometry: document `scrollWidth=390`, main `scrollWidth=390`, Trash bottom `751.94`, blank after Trash `92.06` CSS px. Browser console/page errors: none.

Automated geometry additionally covers 320×568, 360×780, and 390×844. Real iPhone Safari remains required to confirm the physical browser-chrome and nonzero safe-area behavior.
