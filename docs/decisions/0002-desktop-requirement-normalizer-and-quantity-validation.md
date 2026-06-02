# ADR 0002: Desktop Requirement Normalizer and Quantity-Aware Validation

**Status**: Accepted  
**Date**: 2026-06-01  
**Feature**: 001 — plugin-desktop-core-workflow

## Context

The desktop app previously parsed requirement JSON inside the import IPC path and mostly treated target sizes as a list of resolutions. That meant it could tell whether a folder had a size, but not whether it had enough files for that size. It also had to keep compatibility with existing JSON exports and older `{ projectName, sizes }` files.

The main process already owns filesystem access, image/video inspection, and validation. The renderer already stores selected sizes and project lists.

## Decision

Introduce `src/main/requirements.ts` as the desktop-side normalization boundary. It parses v1 JSON, current Chinese-key plugin JSON, and old object formats into one internal `RequirementProject` shape. It also owns reusable helpers for resolution normalization, quantity parsing, safe path segments, and missing quantity calculation.

Validation now accepts either legacy resolution strings or requirement objects with `requiredQuantity`, counts valid assets per normalized resolution, and emits `missing` rows with `requiredQuantity`, `actualQuantity`, and `missingCount`.

## Rationale

Keeping normalization in the main process matches the app's existing IPC structure: the main process reads JSON files and validates media. A focused pure module gives testable behavior without splitting the entire large `src/main/index.ts` IPC file.

Backward compatibility was necessary because the user has existing files and workflows. Treating old size arrays as "at least one item per size" preserves old behavior while letting new JSON drive exact quantities.

## Alternatives Considered

- **Parse everything in the renderer**: Easier for UI state, but the main process already owns file reads and validation, and renderer parsing would duplicate logic before IPC calls.
- **Rewrite the main process IPC structure first**: Cleaner long-term, but too much refactor for this appetite.
- **Require only the new JSON schema**: Simpler, but it would break existing exports and local historical data.

## Consequences

**Positive**:

- New and old JSON formats converge into one internal model.
- Quantity shortages are represented directly in validation results.
- Core parsing and quantity logic now have focused unit tests.

**Negative / Trade-offs**:

- `src/main/index.ts` remains large; only the requirements logic was extracted.
- Validation still depends on folder-to-project matching heuristics for multi-project workflows.

**Future considerations**:

- If more workflow logic moves into the main process, split IPC handlers by domain.
- Add fixture-based validation tests around real media folders if this area keeps changing.
