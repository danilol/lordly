import { GameObjects, Input, Scene, Time } from 'phaser';
import { ALL_CLASSES, BALANCE, slotTotal } from '@lordly/engine';
import type { Element, Role, UnitClass } from '@lordly/engine';
import {
  BASE_WIDTH,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
  CLASS_DISPLAY_NAME,
  DRAFT_CONTINUE_LABEL,
  DRAFT_DETAIL,
  DRAFT_GRID,
  DRAFT_HINT_Y,
  DRAFT_TABS,
  LONG_PRESS_MS,
  TAP_DISTANCE_PX,
  draftGridTile,
  draftHint,
  DRAFT_RULES_LABEL,
  DRAFT_TITLE,
  HOME_BACK_LABEL,
  MIN_FONT_PX,
  PALETTE,
} from '../config/constants';
import {
  ALL_DRAFT_TABS,
  canAddUnit,
  canContinue,
  classRulesCard,
  draftBlockReason,
  DRAFT_TAB_LABELS,
  draftTabClasses,
  moveLabel,
  movesVaryByRow,
} from '../flow/draftModel';
import type { DraftTabId } from '../flow/draftModel';
import type { MatchFlow } from '../flow/MatchFlow';
import { addButton, addSceneGround, addFramedPanel, applyHiDpiCamera, addBackAffordance, addElementBadge, addUnitSprite, crispText } from '../config/ui';
import { buildUnitCardOverlay } from '../config/unitCardOverlay';
import { attachPerfSampler } from '../config/perf';

/**
 * Icon-grid layout (story 4.3 redesign; re-laid for 17 classes by story 5.4):
 * a compact tile per class — all classes on one screen, no scroll. Geometry
 * lives in constants.ts (DRAFT_GRID/DRAFT_DETAIL) so the arithmetic is
 * testable without Phaser; these aliases keep the scene readable.
 */
const GRID = DRAFT_GRID;
/** The class-detail panel (below the grid) that fills in on selection. */
const DETAIL = DRAFT_DETAIL;
/** Two taps on the same tile within this window count as a double-tap (draft shortcut). */
const DOUBLE_TAP_MS = 300;

/**
 * Matchups are shown by DAMAGE TYPE, not by listing classes (Danilo's call —
 * "weak to magic/physical/projectiles" reads cleaner and stays short as the
 * roster grows). Each attacking role maps to the type it deals; Support/Control
 * never attack in a relation, so they carry no type. Derived, not hardcoded per
 * class: a class is weak to the types of the roles that beat it, strong vs the
 * types of the roles it beats.
 */
const ROLE_DAMAGE_TYPE: Partial<Record<Role, string>> = {
  vanguard: 'physical',
  skirmisher: 'physical',
  sniper: 'projectiles',
  artillery: 'magic',
};

/**
 * Draft scene (FR1/FR2/FR3). Story 4.3 redesign (Danilo's mock): the roster is
 * a compact ICON GRID — one small tile (sprite + name) per class, every class
 * visible at once, no scroll. Tapping a tile SELECTS it and fills a detail
 * panel below (role, behavior, matchups, action counts); an explicit **Add to
 * army** button drafts the selected class. The army tray + Continue sit below.
 * A thin renderer over `MatchFlow` + the pure `draftModel` — no match truth
 * (AD-5/AD-13); the dynamic parts re-render from `flow.getState()`.
 */
export class DraftScene extends Scene {
  private flow!: MatchFlow;
  /** The currently highlighted class in the grid — its detail shows in the panel. Reset every create() (singleton scenes). */
  private selected: UnitClass = ALL_CLASSES[0];
  /** The active picker tab (story 5.5 — Humans/Monsters). Reset every create() (singleton scenes). */
  private tab: DraftTabId = 'humans';
  /** The active tab's grid objects (tab strip + tiles) — destroyed and rebuilt on tab switch. */
  private gridObjects: GameObjects.GameObject[] = [];
  /** The active tab's tile geometry, for drawing the selection highlight. */
  private tiles: { cls: UnitClass; x: number; y: number }[] = [];
  /** Selection-dependent objects (highlight + detail panel + army tray + Continue), rebuilt on each redraw. */
  private dynamic: GameObjects.GameObject[] = [];
  /** Double-tap-to-add tracking: a second tap on the same tile within the window drafts it (Danilo's request). Reset every create() (singleton scenes). */
  private lastTapClass: UnitClass | null = null;
  private lastTapAt = 0;
  /** The transient "crown cleared" toast (story 4.5). Reset every create() (singleton scenes). */
  private crownNotice?: GameObjects.Text;
  /** The open unit-data card's objects (story 5.6 round 5 — the same card as Placement's; grid tiles show a class PREVIEW, tray units the full card). Reset every create() (singleton scenes). */
  private cardObjects: GameObjects.GameObject[] = [];
  /** The armed long-press timer (story 5.6 round 5) — one at a time; cancelled by release or pointer-out (Draft has no drag). Reset every create() (singleton scenes). */
  private longPressTimer?: Time.TimerEvent;

  constructor() {
    super('Draft');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    // Story 3.4 (NFR1): no-op unless `?perf=1`.
    attachPerfSampler(this);
    this.selected = ALL_CLASSES[0]; // reset: Phaser scenes are singletons
    this.tab = 'humans'; // reset tab (singleton scenes — story 5.5)
    this.dynamic = [];
    this.gridObjects = [];
    this.lastTapClass = null; // reset double-tap state (singleton lesson: no stale carry-over)
    this.lastTapAt = 0;
    this.crownNotice = undefined;
    this.tiles = [];
    this.cardObjects = []; // the objects died with the scene shutdown; the ARRAY must not carry stale refs (story 5.6)
    this.longPressTimer?.remove(); // no stale card-open fires into a fresh match (the pendingCrownTimers precedent)
    this.longPressTimer = undefined;

    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);
    addSceneGround(this); // story 5.2: the medieval stone floor under the menu chrome
    addBackAffordance(this, HOME_BACK_LABEL, () => this.scene.start('Home'));

    crispText(this, BASE_WIDTH / 2, 26, DRAFT_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);
    crispText(this, BASE_WIDTH / 2, DRAFT_HINT_Y, draftHint(BALANCE.slotBudget), {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    }).setOrigin(0.5);

    // Rules spur (story 2.4, FR27): top-right. Help returns HERE with the same flow (the 1.8 pattern).
    const rules = crispText(this, BASE_WIDTH - 44, 22, DRAFT_RULES_LABEL, { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.add
      .rectangle(rules.x, rules.y, 72, 36, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Help', { from: 'Draft', flow: this.flow }));

    this.buildGrid();
    this.redraw();
  }

  /**
   * The active tab's icon grid + the tab strip (story 5.5): 27 classes split
   * across Humans/Monsters tabs, each reusing the same DRAFT_GRID geometry.
   * Rebuilt wholesale on a tab switch; tapping a tile SELECTS (does not draft).
   */
  private buildGrid() {
    // A rebuild invalidates an armed card-press (review 2026-07-29): the
    // pressed tile dies here and emits no further cancel signals.
    this.cancelLongPress();
    for (const o of this.gridObjects) o.destroy();
    this.gridObjects = [];
    this.tiles = [];

    // The tab strip (replaces 4.3's static "CHOOSE A CLASS" heading): two
    // labels above the grid — the active one gold with an underline. Geometry
    // lives in DRAFT_TABS (constants.ts) so the tap zone is tested numbers,
    // not literals buried here: the width grows with the label between the
    // tapW floor (FR30) and the tapMaxW ceiling, and it is the CEILING that
    // guarantees the two zones never touch at the ±offsetX centres (review
    // 2026-07-28 — "MONSTERS" already outgrows the floor).
    ALL_DRAFT_TABS.forEach((tab, t) => {
      const x = BASE_WIDTH / 2 + (t === 0 ? -DRAFT_TABS.offsetX : DRAFT_TABS.offsetX);
      const active = tab === this.tab;
      const label = crispText(this, x, DRAFT_TABS.y, DRAFT_TAB_LABELS[tab], {
        fontFamily: 'Arial Black',
        fontSize: '13px',
        color: active ? PALETTE.title : PALETTE.mutedText,
      }).setOrigin(0.5);
      const parts: GameObjects.GameObject[] = [label];
      // GOLD underline, not a side colour: DESIGN's "gold is the metal" rule
      // reserves blue/red for whose side a thing is on, and a picker tab
      // belongs to neither. `buttonFillEnabled` is the numeric twin of
      // `PALETTE.title`'s #e3b64b (rectangles take numbers, text takes strings).
      if (active) parts.push(this.add.rectangle(x, DRAFT_TABS.underlineY, label.width + 8, 2, PALETTE.buttonFillEnabled).setOrigin(0.5));
      parts.push(
        this.add
          .rectangle(x, DRAFT_TABS.y, Math.min(Math.max(label.width + 24, DRAFT_TABS.tapW), DRAFT_TABS.tapMaxW), DRAFT_TABS.tapH, 0, 0)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => {
            if (tab === this.tab) return;
            this.tab = tab;
            this.lastTapClass = null; // a tab switch is never half a double-tap
            const classes = draftTabClasses(tab);
            if (!classes.includes(this.selected)) this.selected = classes[0] as UnitClass;
            // Rebuild ONE TICK LATER (review 2026-07-28): buildGrid() destroys
            // every gridObject — including this very rectangle, mid-event-
            // dispatch. Phaser tolerates a synchronous destroy today, but it
            // is a documented hazard pattern; the scene-scoped clock also
            // drops the call on shutdown, so a scene exit mid-tick leaks
            // nothing. One frame (~16ms) is imperceptible on a tab switch.
            this.time.delayedCall(0, () => {
              this.buildGrid();
              this.redraw();
            });
          }),
      );
      this.gridObjects.push(...parts);
    });

    draftTabClasses(this.tab).forEach((cls, i) => {
      const { x, y } = draftGridTile(i);
      this.tiles.push({ cls, x, y });
      this.gridObjects.push(this.add.rectangle(x, y, GRID.tileW, GRID.tileH, PALETTE.cardFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.cardStroke));
      this.gridObjects.push(addUnitSprite(this, x + GRID.tileW / 2, y + 16, cls, 26));
      // 8px on the 80px tile (story 5.5): the 76px wrap width carries every
      // single-word name including "EMBERDRAKE"/"STORMSCALE" (10 chars, which
      // the 5.4 62px tile could not); "DRAGON HUNTER" word-wraps to two
      // (origin-top so line 1 stays anchored). Two 8px lines from y+30 end at
      // y+46, inside the 48px tile.
      this.gridObjects.push(
        crispText(this, x + GRID.tileW / 2, y + 30, CLASS_DISPLAY_NAME[cls].toUpperCase(), {
          fontFamily: 'Arial Black',
          fontSize: '8px',
          color: PALETTE.bodyText,
          align: 'center',
          wordWrap: { width: GRID.tileW - 4 },
        }).setOrigin(0.5, 0),
      );
      const tileZone = this.add
        .rectangle(x, y, GRID.tileW, GRID.tileH, 0, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', (pointer: Input.Pointer) => {
          // While the card is up the scrim swallows everything (topOnly) —
          // belt guard only (review 2026-07-29: the old consume flag went
          // stale and ate later taps; the overlay's armed close handshake
          // replaced it).
          if (this.cardObjects.length > 0) return;
          this.cancelLongPress(); // released before the hold matured — a tap, handled below
          if (pointer.getDistance() > TAP_DISTANCE_PX) return; // a wander is not a select-tap (parity with Placement's classifier)
          {
            // First tap SELECTS (fills the detail panel); a second tap on the SAME
            // tile within the window DRAFTS it — the Add-to-army shortcut (Danilo).
            const now = this.time.now;
            const doubleTap = this.lastTapClass === cls && now - this.lastTapAt < DOUBLE_TAP_MS;
            this.selected = cls;
            this.lastTapAt = now;
            this.lastTapClass = doubleTap ? null : cls; // consume on double so a triple tap isn't two adds
            if (doubleTap) this.addToArmy(cls); // drafts only if a slot remains
            this.redraw();
          }
        });
      this.armCardPress(
        tileZone,
        () => cls,
        () => undefined,
      ); // class preview: no element until drafted
      this.gridObjects.push(tileZone);
    });
  }

  /** Drafts `cls` if a slot budget remains (shared by the Add-to-army button and double-tap). */
  private addToArmy(cls: UnitClass) {
    if (!canAddUnit(this.flow.getState().playerArmy, cls)) return;
    const hadCrown = this.flow.getState().playerLeader !== null;
    this.flow.draftUnit(cls); // AD-9: any army mutation clears the leader crown
    if (hadCrown) this.flashCrownCleared();
  }

  /**
   * The EXPERIENCE.md "army mutation clears the crown WITH a visible notice"
   * (story 4.5, AD-9): a transient toast when a draft/remove drops a live crown.
   * NOTE: in the current forward-only flow (Draft → Placement → Reveal, no
   * back-path) the crown is set only in PlacementScene, AFTER drafting, so this
   * cannot fire in normal play — it is a defensive guard on the real invariant
   * that becomes live the moment a Placement→Draft return is added. The clearing
   * itself is enforced + tested in MatchFlow regardless.
   */
  private flashCrownCleared() {
    this.crownNotice?.destroy();
    const toast = crispText(this, BASE_WIDTH / 2, 68, '♛ Leader crown cleared — crown a unit again in Placement', {
      fontFamily: 'Arial',
      fontSize: `${MIN_FONT_PX}px`,
      color: PALETTE.title,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    })
      .setOrigin(0.5)
      .setDepth(200);
    this.crownNotice = toast;
    this.tweens.add({ targets: toast, alpha: 0, delay: 1400, duration: 500, onComplete: () => toast.destroy() });
  }

  /** Kills any armed (not yet fired) card-open timer — a release or a pointer-out means this gesture is not a hold (story 5.6 round 5; Draft has no drag to cancel on). */
  private cancelLongPress() {
    this.longPressTimer?.remove();
    this.longPressTimer = undefined;
  }

  /** Arms the card long-press on `target` (a grid tile or a tray unit). `element` is undefined for a grid tile — elements are rolled at draft, so a class tile shows a PREVIEW card (no dot, generic Witch "Cast"). */
  private armCardPress(target: GameObjects.GameObject, cls: () => UnitClass, element: () => Element | undefined) {
    target.on('pointerdown', (pointer: Input.Pointer) => {
      this.longPressTimer?.remove();
      this.longPressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
        this.longPressTimer = undefined;
        // Draft has NO drag, so nothing cancels a moving hold for free
        // (review 2026-07-29): enforce LONG_PRESS_MS's movement contract at
        // fire time — a wander past the shared threshold is not a hold.
        if (pointer.getDistance() > TAP_DISTANCE_PX) return;
        this.openCard(cls(), element());
      });
    });
    target.on('pointerout', () => this.cancelLongPress());
  }

  /**
   * The unit-data card (story 5.6 round 5 — Danilo: "Could we also have that
   * in the char selection?"): the shared overlay builder renders it; this
   * scene owns the gesture and lifecycle, exactly like PlacementScene.
   */
  private openCard(cls: UnitClass, element: Element | undefined) {
    this.closeCardNow(); // never two cards
    this.cardObjects = buildUnitCardOverlay(this, cls, element, () => this.closeCard());
  }

  /** Closes the card ONE TICK later — the caller is an input handler on an object about to be destroyed (the 5.5 lesson). */
  private closeCard() {
    this.time.delayedCall(0, () => this.closeCardNow());
  }

  /** The synchronous teardown — create()'s reset path and openCard's never-two-cards guard use this directly. */
  private closeCardNow() {
    for (const o of this.cardObjects) o.destroy();
    this.cardObjects = [];
  }

  /**
   * A small colored matchup pill; returns its right edge x so the next pill
   * can follow. Story 5.4 closes the 4.3 review deferral: a pill that would
   * run past the panel's right edge is ELLIPSIZED to fit, and one with no
   * room at all is dropped — chips can never escape the frame (17 classes
   * mean longer type lists, e.g. the Sniper's three-way hunt).
   */
  private chip(x: number, y: number, label: string, fill: number, color: string): number {
    const maxRight = DETAIL.x + DETAIL.w - 8;
    const text = crispText(this, x + 6, y, label, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color }).setOrigin(0, 0.5);
    let shown = label;
    while (x + text.width + 12 > maxRight && shown.length > 2) {
      shown = `${shown.slice(0, -2).trimEnd()}…`;
      text.setText(shown);
    }
    if (x + text.width + 12 > maxRight) {
      text.destroy(); // no room even for "…" — drop the pill rather than overflow
      return x;
    }
    const w = text.width + 12;
    const box = this.add.rectangle(x, y, w, 16, fill, 0.85).setOrigin(0, 0.5);
    // Pill above the panel (insertion order), label above the pill (depth).
    // The old `box.setDepth(-1)` sank the pill BELOW the detail panel, leaving
    // ink-colored labels naked on the dark body (device pass, 2026-07-27).
    text.setDepth(1);
    this.dynamic.push(box, text);
    return x + w + 6;
  }

  /** Rebuilds the selection highlight, the detail panel, the army tray, and Continue. */
  private redraw() {
    this.cancelLongPress(); // the pressed tray slot may die below — no orphaned timer (review 2026-07-29)
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];

    // 1. Selection highlight over the chosen tile.
    const tile = this.tiles.find((t) => t.cls === this.selected);
    if (tile) {
      this.dynamic.push(
        this.add.rectangle(tile.x, tile.y, GRID.tileW, GRID.tileH, PALETTE.playerLine, 0.12).setOrigin(0, 0).setStrokeStyle(2, PALETTE.playerLine),
      );
    }

    // 2. Detail panel for the selected class. A compact Add button sits in the
    //    top-right; the text column wraps to its LEFT so they never collide.
    const card = classRulesCard(this.selected);
    const a = card.actions;
    const canAdd = canAddUnit(this.flow.getState().playerArmy, this.selected);
    const addW = 66;
    const addH = 46;
    const addCx = DETAIL.x + DETAIL.w - 8 - addW / 2; // right edge padded 8 from the panel
    const textW = addCx - addW / 2 - (DETAIL.x + 92) - 8; // wrap width that clears the button column
    this.dynamic.push(addFramedPanel(this, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, { origin: [0, 0] }));
    this.dynamic.push(addUnitSprite(this, DETAIL.x + 44, DETAIL.y + 48, this.selected, 48));
    const tx = DETAIL.x + 92;
    // Content offsets compressed for the 108px panel (story 5.4 re-lay: the
    // 17-class grid claims the vertical the old 116px panel used).
    this.dynamic.push(crispText(this, tx, DETAIL.y + 10, card.name.toUpperCase(), { fontFamily: 'Arial Black', fontSize: '18px', color: PALETTE.title }));
    // Review fix (2026-07-20): the slot cost is ONLY worth stating for a
    // monster (SLOT_COST.small === 1 is the assumed default — restating "1
    // slot" on all 11 small classes added nothing and pushed this line's
    // length past its ~170px wrap budget for nearly every class, colliding
    // with the fixed-position line 18px below). Tightened separators (single
    // space, not double) free a little more room across the board.
    const costSegment = card.slotCost > 1 ? `${card.slotCost} slots · ` : '';
    this.dynamic.push(
      crispText(this, tx, DETAIL.y + 34, `${card.role} · ${costSegment}act ${a.front}/${a.mid}/${a.back}`, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: PALETTE.bodyText,
        wordWrap: { width: textW },
      }),
    );
    // The per-row move breakdown (FR32/FR33, story 4.7) REPLACES the prose
    // behavior line for the four classes whose move actually VARIES by row
    // (Knight, Phalanx, Wizard, Sorceress) — the DETAIL panel has room for
    // exactly one text block here (device review: stacking both wrapped onto
    // the matchup chips below). Compact F/M/B prefixes keep it short enough
    // to fit; everyone else keeps the unchanged prose line (their move IS
    // uniform, so a restated "front/mid/back: X" would be redundant noise).
    const varies = movesVaryByRow(this.selected);
    const m = card.moves;
    this.dynamic.push(
      crispText(
        this,
        tx,
        DETAIL.y + 50,
        varies ? `F ${moveLabel(m.front, this.selected)} · M ${moveLabel(m.mid, this.selected)} · B ${moveLabel(m.back, this.selected)}` : card.behavior,
        {
          fontFamily: 'Arial',
          fontSize: `${MIN_FONT_PX}px`,
          color: varies ? PALETTE.title : PALETTE.mutedText,
          wordWrap: { width: textW },
        },
      ),
    );
    // Matchup pills by DAMAGE TYPE (green strong / red weak): a class is weak to
    // the types of the roles that beat it, strong vs the types it beats.
    const myRole = BALANCE.classes[this.selected].role;
    const uniq = (xs: string[]) => [...new Set(xs)];
    // Support/Control deal no damage type of their own, so a hunt landing on
    // them (e.g. sniper->support) falls back to the role name itself — a hunt
    // against them must still show as a strength/weakness, not vanish silently.
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const types = (rels: readonly { attacker: Role; defender: Role }[], pick: 'attacker' | 'defender') =>
      uniq(rels.map((r) => ROLE_DAMAGE_TYPE[r[pick]] ?? capitalize(r[pick])));
    const weakTo = types(
      BALANCE.roleRelations.filter((r) => r.defender === myRole),
      'attacker',
    );
    const strongVs = types(
      BALANCE.roleRelations.filter((r) => r.attacker === myRole),
      'defender',
    );
    let cx = tx;
    // Chip contrast (story 5.2): the strong-vs chip sits on the gold enabled
    // fill, so its label is ink; the weak-to chip keeps its red ground with a
    // light-tint label (gold-on-gold and gold-on-red were the re-tone traps).
    if (strongVs.length) cx = this.chip(cx, DETAIL.y + 90, `strong vs ${strongVs.join(', ')}`, PALETTE.buttonFillEnabled, PALETTE.buttonTextOnGold);
    if (weakTo.length) this.chip(cx, DETAIL.y + 90, `weak to ${weakTo.join(', ')}`, PALETTE.enemyLine, PALETTE.codeTextEnemy);
    if (!strongVs.length && !weakTo.length) this.chip(cx, DETAIL.y + 90, 'neutral matchups', PALETTE.buttonFill, PALETTE.mutedText);

    // Add-to-army button — compact, top-right, gated on remaining slots.
    // Label is the single word "Add" since the art drop (device pass
    // 2026-07-27): the two-line "Add to army" overflowed the 9-slice frame's
    // inner box on the 66×46 button; one word fits inside the gold fill.
    const addBtn = addButton(this, addCx, DETAIL.y + 8 + addH / 2, {
      width: addW,
      height: addH,
      label: 'Add',
      fontSize: 15,
      style: canAdd ? 'primary' : 'disabled',
      onTap: () => {
        this.addToArmy(this.selected);
        this.redraw();
      },
    });
    this.dynamic.push(...addBtn.parts);

    // 3. The army tray.
    const army = this.flow.getState().playerArmy;
    this.dynamic.push(
      crispText(this, BASE_WIDTH / 2, 426, `YOUR ARMY  (${slotTotal(army)}/${BALANCE.slotBudget})`, {
        fontFamily: 'Arial Black',
        fontSize: '12px',
        color: PALETTE.mutedText,
      }).setOrigin(0.5),
    );
    const slotW = 60;
    const gap = 8;
    const trayY = 444;
    const startX = (BASE_WIDTH - (BALANCE.slotBudget * slotW + (BALANCE.slotBudget - 1) * gap)) / 2;
    for (let i = 0; i < BALANCE.slotBudget; i++) {
      const x = startX + i * (slotW + gap);
      const unit = army[i];
      const slot = unit
        ? this.add.rectangle(x, trayY, slotW, 52, PALETTE.cardFillYou).setOrigin(0, 0).setStrokeStyle(2, PALETTE.playerLine)
        : this.add.rectangle(x, trayY, slotW, 52, PALETTE.gridCellFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gridCellStroke);
      this.dynamic.push(slot);
      if (unit) {
        this.dynamic.push(addUnitSprite(this, x + slotW / 2, trayY + 20, unit.class, 26));
        this.dynamic.push(addElementBadge(this, x + slotW - 9, trayY + 9, unit.element));
        this.dynamic.push(
          crispText(this, x + slotW / 2, trayY + 42, CLASS_ABBREVIATIONS[unit.class], {
            fontFamily: 'Arial Black',
            fontSize: `${CARD_CLASS_FONT_PX}px`,
            color: PALETTE.playerText,
          }).setOrigin(0.5),
        );
        slot.setInteractive({ useHandCursor: true }).on('pointerup', (pointer: Input.Pointer) => {
          // Belt guard while the card is up (see the tile handler) — and a
          // REMOVE especially must never fire from a card session's residue:
          // inspecting a soldier is not discharging it.
          if (this.cardObjects.length > 0) return;
          this.cancelLongPress();
          if (pointer.getDistance() > TAP_DISTANCE_PX) return; // a wander is not a remove-tap
          const hadCrown = this.flow.getState().playerLeader !== null;
          this.flow.removeUnit(i); // AD-9: any army mutation clears the leader crown
          if (hadCrown) this.flashCrownCleared();
          this.redraw();
        });
        // A drafted unit HAS an element — its card is the full one (story 5.6 round 5).
        this.armCardPress(
          slot,
          () => unit.class,
          () => unit.element,
        );
      } else {
        this.dynamic.push(crispText(this, x + slotW / 2, trayY + 26, '+', { fontFamily: 'Arial', fontSize: '22px', color: PALETTE.mutedText }).setOrigin(0.5));
      }
    }
    // The hint line doubles as the no-dead-end gate reason (story 5.5,
    // E5-D13): a full army with no human names WHY Continue stays dark.
    const blockReason = draftBlockReason(army);
    this.dynamic.push(
      crispText(this, BASE_WIDTH / 2, trayY + 62, blockReason ?? 'Tap a drafted unit to remove it', {
        fontFamily: 'Arial',
        fontSize: `${MIN_FONT_PX}px`,
        color: blockReason ? PALETTE.title : PALETTE.mutedText,
        align: 'center',
        wordWrap: { width: BASE_WIDTH - 24 },
      }).setOrigin(0.5),
    );

    // 4. Continue.
    const ready = canContinue(army);
    const btn = addButton(this, BASE_WIDTH / 2, 540, {
      width: 200,
      height: 48,
      label: DRAFT_CONTINUE_LABEL,
      fontSize: 18,
      style: ready ? 'primary' : 'disabled',
      onTap: () => this.scene.start('Placement', { flow: this.flow }),
    });
    this.dynamic.push(...btn.parts);
  }
}
