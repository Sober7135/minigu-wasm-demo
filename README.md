# minigu-demo-wasm

Static GitHub Pages site for demonstrating that `minigu-wasm` runs in a browser.

## What this repo contains

- A small browser UI that initializes `MiniGuDb`
- A GitHub Pages workflow in `.github/workflows/pages.yml`
- No committed WASM build artifacts; the workflow builds them from the source repository on demand

The page demonstrates:

- `CALL create_test_graph_data("g", 5)`
- `SESSION SET GRAPH g`
- A read-only `MATCH (n:PERSON) RETURN n` query rendered via both `query_table(...)` and
  `query_json(...)`

## Publish

1. Push this repository to GitHub with the default branch named `main`.
2. In repository Settings -> Pages, set the source to `GitHub Actions`.
3. Push to `main` again or run the `Deploy GitHub Pages` workflow manually.

The workflow currently pulls source from:

```text
Sober7135/MiniGU @ 25-support-wasm
```

If you want to build from a different repository or branch, edit `SOURCE_REPOSITORY` and
`SOURCE_REF` in `.github/workflows/pages.yml`.

The published URL will be:

```text
https://<github-username>.github.io/minigu-demo-wasm/
```

## How deployment works

On each deployment, GitHub Actions:

1. Checks out this demo repository.
2. Checks out the source repository configured in the workflow.
3. Builds `minigu-wasm` for `wasm32-unknown-unknown`.
4. Runs `wasm-bindgen --target web`.
5. Publishes the generated static site to GitHub Pages.

This repository therefore does not need committed `minigu_wasm*.js/.wasm` files.

## Private repository note

If `SOURCE_REPOSITORY` is private and different from the demo repository, the default
`GITHUB_TOKEN` will usually not be enough. In that case, change the checkout step to use a PAT
stored in repository secrets.
