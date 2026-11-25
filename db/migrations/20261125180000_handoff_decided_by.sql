-- SIM-037.3: a handoff has a decider exactly when it is decided (SIM-037.1 security follow-up).
-- Expand-only: no shipped image writes device_handoffs yet, so the previous image is unaffected.
alter table device_handoffs add constraint device_handoffs_decided_by_check
  check ((status = 'pending') = (decided_by_id is null)) not valid;
alter table device_handoffs validate constraint device_handoffs_decided_by_check;
