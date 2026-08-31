# README media

Screen recordings embedded in the [README](../../README.md). Each one replaces a
`TODO(#55)` comment in the README, so search for that marker to find the exact
insertion point.

### In use

| File                                    | Shows                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `CommonGrants-shortlist-screenshot.png` | The opportunity shortlist in Claude — ranked results with source, award range, and deadline. Embedded in the README overview. |

### Still wanted

| File                  | Shows                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo.gif`            | The app in use: type a natural-language search, get labeled cross-source results, open the shortlist, click into an opportunity's details. Would replace the still above. |
| `install-claude.gif`  | Claude: **Settings → Connectors → Add custom connector**, paste the server URL, **Add**.                                                                                  |
| `install-chatgpt.gif` | ChatGPT: enable **Developer mode**, **Settings → Plugins → +**, paste the server URL, create.                                                                             |

## Recording guidelines

- **Width:** 1200–1400 px. GitHub renders README images at roughly 850 px wide,
  so anything narrower looks soft on a retina display and anything much wider
  just inflates the file.
- **Size:** keep each file under ~5 MB. GitHub serves them on every README view,
  and large GIFs make the page crawl. Trim dead air, drop to 12–15 fps, and cap
  the color palette before reaching for a lower resolution.
- **Length:** 10–20 seconds. Show one complete action, not a tour.
- **Pacing:** pause about a second on each result screen. A GIF that loops too
  fast to read is worse than no GIF.
- **Scrub before recording:** no real email addresses, org names, API keys, or
  other identifying detail in the browser chrome, tab bar, or sidebar.
- **Theme:** record in light mode. GitHub honors the reader's theme but images
  don't, and a light recording reads acceptably against a dark page while the
  reverse doesn't.

Embed them with plain Markdown and real alt text, e.g.:

```md
![Searching for workforce development grants in Claude and opening a result from the shortlist](docs/media/demo.gif)
```
