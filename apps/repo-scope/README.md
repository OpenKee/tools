# Repo Scope

GitHub user and repository analysis dashboard. Paste a username, get a health snapshot.

## Features

- user profile overview with follower/repo/star stats
- repository list sorted by stars with health tags (active, dormant, star-heavy, solo-maintained)
- language distribution breakdown
- click any repo for detailed stats (stars, forks, issues, watchers, size, last activity)
- bilingual UI: English by default, Chinese toggle
- loading states and error handling (rate-limit aware)

## Stack

- vanilla HTML / CSS / JavaScript — zero dependencies, zero build step
- GitHub REST API (public endpoints, no auth required)
- IBM Plex Sans + Mono typography

## Usage

Open `index.html` in any browser. No server needed.

## Rate Limits

GitHub allows 60 requests/hour for unauthenticated users. Each user analysis = 2 requests, each repo click = 1 request. If you hit the limit, the app shows a clear error message.

## License

MIT
