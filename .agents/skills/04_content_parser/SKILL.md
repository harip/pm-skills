---
name: content_parser
description: Phase 4 lead. Generates JSON schemas, Zod contracts, and mock fixtures in src/assets/schemas/.
---

# Content Parser (Phase 4)

**Inputs:** Documents 00, 03, 04. If `persistence: none`, mark Phase 4 `[N/A — CAPABILITY NOT REQUIRED]` and stop.

## Per persistent entity → `src/assets/schemas/`
1. `[entity].schema.json` — Draft-07, `version: "1.0.0"`, `additionalProperties: false`, `x-permissions`, `x-pii: true` on PII fields.
2. `[entity].contract.ts` — Zod schema + types `[Entity]Schema`, `[Entity]`, `Create[Entity]Input`, `Update[Entity]Input`.
3. `[entity].mock.ts` — 5–10 realistic records with valid UUID v4 and ISO 8601 values.
Include the base entity fields defined in Document 04.

## Zod Primitives
| Data | Pattern |
|---|---|
| ID / FK | `z.string().uuid()` |
| Text | `z.string().min(1).max(N)` |
| Money | `z.number().positive().multipleOf(0.01)` |
| Enum | `z.enum([...])` (never plain string) |
| Date | `z.string().datetime()` |

## Verification
Map each contract to its story/AC and to unit/contract cases in Documents 04/05: valid, rejected, boundary, and serialization round-trip. Fixtures are not test evidence. Chat: table of generated schemas + links.
