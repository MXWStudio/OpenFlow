# ADR 0001: Versioned Requirements JSON Contract for Plugin-to-Desktop Handoff

**Status**: Accepted  
**Date**: 2026-06-01  
**Feature**: 001 — plugin-desktop-core-workflow

## Context

OpenFlow's high-frequency workflow starts in a browser extension and continues in the desktop app. Before this feature, the two sides exchanged data through downloaded JSON whose meaning depended on Chinese field names and fallback parsing. The workflow worked, but field drift, missing quantity data, and page extraction changes could silently produce a JSON file that looked usable while losing important requirements.

The team also wanted to keep this iteration focused on stabilizing the existing workflow, not on adding native messaging, custom URL protocols, or a large cross-repo package setup.

## Decision

Keep the file-based handoff, but make JSON export versioned and explicit with `schemaVersion: "openflow.requirements.v1"`, source metadata, extraction time, warnings, and `projects[]` containing normalized `requirements[]` rows.

The plugin still exports legacy Chinese fields during the transition, while the desktop app treats the new schema as the preferred contract.

## Rationale

A versioned JSON contract improves reliability without changing the user's installation or runtime model. It lets the plugin and desktop agree on the minimum data needed for folder creation, quantity-aware validation, and rename decisions while keeping backward compatibility with existing files.

Direct plugin-to-desktop communication would shorten the workflow, but it would add setup and cross-platform risk before the core data contract was stable.

## Alternatives Considered

- **Chrome native messaging or custom protocol**: Potentially smoother, but out of appetite because it adds install, permission, Windows/macOS, and debugging complexity.
- **Cross-repo shared TypeScript package**: Cleaner long-term, but the plugin is plain MV3 JavaScript and the desktop app is Electron/TypeScript. A shared package would add build plumbing before the contract had proven itself.
- **Continue relying on legacy Chinese keys only**: Lowest effort, but it leaves quantity and field drift risks in the main workflow.

## Consequences

**Positive**:

- Plugin exports now carry enough metadata to judge freshness and source.
- Desktop import can prefer a stable schema while still supporting old JSON files.
- Future schema changes have an obvious place to declare versioned behavior.

**Negative / Trade-offs**:

- Normalizer helpers are duplicated in plugin JavaScript and desktop TypeScript for now.
- The workflow still requires downloading and importing a JSON file.

**Future considerations**:

- If direct handoff becomes worth the setup cost, build it on top of this schema instead of inventing a second contract.
- If more shared parsing logic accumulates, revisit a shared package or generated schema.
