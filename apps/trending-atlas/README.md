# Trending Atlas

Discover what's trending on GitHub right now. Filter by time range and programming language.

## Features

- trending repos by today / this week / this month
- filter by programming language (top 30)
- star count, fork count, language color dots
- "hot" badge for repos with high star velocity
- pagination (up to 1000 results)
- bilingual UI: English / Chinese
- uses GitHub Search API (reuses repo-scope token if available)

## Stack

- vanilla HTML / CSS / JavaScript — zero dependencies
- GitHub REST API (search endpoint)
- IBM Plex Sans + Mono typography

## Usage

Open `index.html` in any browser. No server needed.

## Rate Limits

GitHub Search API allows 10 req/min unauthenticated, 30 req/min with token. If you've set a token in [Repo Scope](https://openkee.github.io/repo-scope/), it carries over here.

## License

MIT
