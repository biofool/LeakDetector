# LeakDetector — Mini Wiki

LeakDetector is a citizen water-leak reporting app for NZ councils — a mobile-first web form where residents drop a pin, snap a photo, and report leaks (footpath/berm/road/meter/outside tap) in under 30 seconds, with duplicate detection, SLA timers, duty-officer email alerts, and a public status map. Modelled on FixMyStreet / SeeClickFix / MAWC Citizen Leak Reporter patterns.

**Stack:** GitHub Actions
**Default branch:** main

## Pages
- [[Architecture]] — repo layout and key components
- [[Development]] — build / test / deploy commands
- [[Security]] — 2026-10 audit outcome and open security tickets

## Recent activity
```
5e62c3e docs: sync global rules — don't-trust-verify + automate-the-annoying-stuff
fbecf44 chore(hooks): post-edit lint hook + settings
042c68f Merge branch 'fix/cf-credential-diagnostics'
00d0683 security: workflow action pins, non-root backend Dockerfile
6e10828 frontend: LINZ Basemaps when VITE_LINZ_BASEMAPS_KEY is set (#29)
8378787 email-golive.sh: group pending counts by domain expression (fixes #47)
b1e77ca Email go-live script; stop prod demo seeding; yearly boundary reminder
afb4bf7 Send from leaks@aikifield.com; absolute OG URLs at build (fixes #28)
```
