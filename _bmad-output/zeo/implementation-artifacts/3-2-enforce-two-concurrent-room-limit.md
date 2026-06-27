# Story 3.2: Enforce two concurrent room limit

**Epic:** 3 — Room lifecycle and capacity enforcement  
**Status:** done

## Acceptance criteria

- [x] Count rooms with status `waiting` or `active` before create
- [x] Return 409 when count ≥ 2
- [x] Home shows "X of 2 rooms in use"
