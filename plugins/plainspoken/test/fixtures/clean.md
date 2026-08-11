# Release notes, v2.3.0

Jenkins now builds the site on Node 24.13. The agent lacks the Sora font, so PDFs
generated there came out in DejaVuSans; we commit them from a local build instead.

Cassandra replaced MySQL for the event log in March. Read latency at the 99th
percentile fell from 340ms to 45ms, and the nightly export finishes in 11 minutes
rather than the 50 it used to take. Kochi and Dubai both run the same image now.

## Fixes

- Angular 17 upgrade broke the date picker on Safari 16; pinned the locale bundle
- Dropped 106 `!important` overrides after re-pointing the slate scale at tokens
- Redis evictions spiked to 4,000/minute under load, so maxmemory-policy is now allkeys-lru
- Ported the CRM importer from Java to C#, which cut the cold start to 900ms

Ranjith found the Safari bug during a demo in Muscat, roughly four hours before
the client saw it. We shipped the fix that evening.
