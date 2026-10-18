# Repository guidance

This is the Godot 4.5.2 Standard / typed GDScript RTS prototype: Stage 1 playable
economy/navigation, Stage 2 combat, Stage 3 maps/missions, Stage 4 presentation
and Stage 5 data-driven balance tools.

## Before changing gameplay

- Read README.md and docs/STAGE_1_ARCHITECTURE.md.
- For unit stats/reload/arena work read docs/STAGE_5_BALANCE.md. JSON is the sole
  combat base-stat source. Keep Python and Godot validators on the shared schema;
  reject invalid candidates atomically and retain the last good revision.
- Heavy Gendarme maps to base Armoured Ritter (125 HP), not the Elite tier.
  Preserve Phase 2 base costs and explicit Stage 2 counter/aura overrides.
- Spawned units retain their stat/cost/HP/cooldown snapshot. Arena runs pin a
  whole revision; watch starts a new fight after valid reload, never mixes stats.
- Use real CombatWorld for simulations. Keep 20 Hz ticks at 10x; report measured
  wall speed separately. Do not duplicate combat math in the Python launcher.
- Keep report folders out of Godot asset import (CSV otherwise becomes a
  translation asset). Do not hide source folders to achieve this.
- A closed flat arena with swept-circle steering is not general military
  pathfinding, an equal-resource test or proof of ranked faction balance.
- For combat also read docs/STAGE_2_COMBAT.md. Its explicit Stage 2 rules supersede
  the older GDD's aura/payroll tuning for this opt-in backend only.
- For map/height/stealth changes also read docs/STAGE_3_MAPS_MISSIONS.md.
  Stage 3 explicitly overrides the old GDD with +25% post-counter high-ground
  damage and Joß Fritz failing after three rearmed detection episodes. Do not
  silently restore the old no-damage height rule or Allstedt Alert/chase model.
- Keep logical elevation separate from map/screen Y. Sample actual body centers.
- Keep generation bounded and seeded with local RNG; preserve protected routes
  and ore access. Do not advertise the compact map as a balanced ranked RMS.
- Stealth takes the union of enemy guard sightings, with one clock, full unseen
  rearming and a one-shot terminal result. LOS Areas are authored volumes, not
  terrain-occluding vision. Map choice must not auto-enable campaign systems.
- For animation/audio read docs/STAGE_4_ASSETS_AUDIO.md. Simulation owns impact:
  sprites must never apply damage. Wind-up is opt-in (default marker 0); preserve
  full attack-period cadence, cancellation cooldown and simultaneous hit batches.
- Music counts distinct recent, permitted, on-camera living participants, not hit
  event volume. More than 10 means at least 11. Filter visibility before recording.
- No load/instantiate in unit feedback or hit handlers. Compile shared profiles
  and prewarm pools during loading. Release unit/texture/stream references on reuse.
- Shipped audio is diagnostic synthesis, not historical instruments or recorded
  German. Draft casting text is not certified Frühneuhochdeutsch. Keep this clear.
- Consult the relevant docs/gdd phase for costs, faction rules and future scope.
- Keep simulation models independent from Node/UI APIs. Inject the world/services;
  do not introduce global scene-tree lookups inside workers.
- Static terrain belongs to WorldGrid. Dynamic bodies belong to TrafficController.
  Do not bake every moving unit into static A* solidity.
- Preserve integer resource conservation, exclusive interaction claims, bounded
  path requests and one-shot building completion.
- Keep the distinction between a movement reservation endpoint and the sampled
  continuous position. Work occurs only after arrival.
- Changes to unit radius, movement cadence, path arbitration or interaction slots
  require the crowd/resource regression cases. Uniform foot-unit passing is not
  a clearance system for cavalry/siege.
- Do not label new prototype tuning as a historical fact or a verified GDD balance.
- Do not introduce campaign-only Zeal/Fear, payroll or printing buffs into the
  default sandbox as faction passives.
- The user explicitly requested Stage 2's 6-tile / 15% speed aura and 30-second
  mercenary payroll with mutiny at zero Gold. Do not silently restore the older
  damage aura or 120-second campaign grace rules. Payroll remains scenario opt-in.
- Use the existing player ResourceBank and simulation clock. Keep modifier keys
  idempotent, same-tick lethal trades simultaneous, and desertion ownership real.
- Combat positions are physical centers, never Stage 1 reservation endpoints.
  Do not claim varied-speed enemy/cavalry traffic is solved by the friendly
  villager controller. The Stage 2 host/navigation adapter contract is explicit.

## Validation and delivery

Run:
    python3 tools/verify.py --godot /absolute/path/to/godot

Use the pinned 4.5.2 executable. Update meaningful tests when behavior changes.
Godot can exit 0 on some script errors; use the wrapper, which checks its output
and requires the fresh JSON report.

Commit .gd.uid sidecars with their scripts. Do not commit .godot, test-results,
engine binaries, temporary screenshots or build output. Avoid adding dependencies
without an actual requirement. Keep Vietnamese onboarding instructions usable.

This project is already backed by Git; source and its docs belong in this repo.

## Standalone browser gameplay demo

`demo/bundschuh_rebellion.html` is a one-file offline Canvas/JavaScript vertical
slice, not a Godot Web export. Keep its scenario tuning separate from core
balance and retain its documented limitations in `demo/README.md`. No CDN,
remote fonts, external assets or runtime npm dependencies may be required for
core gameplay. Menu music now belongs exclusively to `demo/index.html`: embed the
supplied M4A verbatim as base64 (`audio/mp4`), plus the existing AAC copy from
`sources/menu_music_aac.m4a` for browsers that cannot decode ALAC. Keep all music
UI hidden; request autoplay on menu entry and retry blocked playback during a
menu interaction. Browser policy may still prevent autoplay before a gesture.
Selecting a faction/mission must keep music playing. Stop and release the player
before launching gameplay, leaving the page or hiding it. Network transitions
must not interrupt embedded audio. Index shows mission briefing and launches the
selected HTML with `?play=1` to enter gameplay directly; standalone game files
retain their briefing menus but no music. Generate index from
`demo/src/mission_index.html`; do not overwrite its style with the old card grid.
Fly the introduction block in from the left after the menu's first paint; replay
on menu entry and respect reduced motion. Offline gameplay must work.

Combat base stats are embedded from the shared JSON, never hand-edited in HTML:
    python3 tools/sync_browser_demo.py
    python3 tools/sync_browser_demo.py --check
    node tests/browser_demo_model.cjs

The Node test runner extracts the actual pure model before `MODEL_END`; preserve
that boundary. `tests/browser_demo_ui.cjs` optionally uses Playwright for real
file:// offline interaction checks. Its test hook exists only with `?test=1`.
Keep browser binaries, npm dependencies, screenshots and reports outside tracked
source. Run model checks for browser changes; retain the Godot validation gate.
