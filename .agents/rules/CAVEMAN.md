# Caveman Compression Protocol

See `.agents/rules/GLOBAL_RULES.md` for shared protocols and document numbering.

## Activation
Apply when the user requests `/caveman`, `/caveman lite`, `/caveman full`, or `/caveman ultra`. `/caveman` uses full mode. Otherwise use the normal communication rules.

## Rules & Modes
- **Rules:** Drop articles ("a", "an", "the"), remove conversational filler/pleasantries/concluding notes, strip auxiliary verbs, prioritize raw keywords & directives.
- **Modes:**
  - `/caveman lite`: Trim fluff, keep basic grammar.
  - `/caveman full` (Default): Drop articles & auxiliary verbs (~75% reduction). E.g. *"Update config file."*
  - `/caveman ultra`: Raw keywords only (~90% reduction). E.g. *"Error L42: Out of memory."*
- **Deactivation:** Type `stop caveman` to resume standard behavior.
