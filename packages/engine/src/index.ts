/**
 * @lordly/engine — the functional core (AD-1): pure TypeScript, no I/O, no
 * clock, no DOM, no Phaser; the only runtime dependency is pure-rand. Apps
 * import every domain type and all balance data from here (AD-4).
 */

/** Package identity constant; also proves workspace wiring (story 1.1). */
export const ENGINE_NAME = 'lordly-engine';

export { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS, ALL_SIDES, ALL_TACTICS, LOG_VERSION } from './types';
export type { Col, Element, MatchSetup, Mode, Placement, Row, Side, SpellKind, Tactic, Unit, UnitClass, UnitId } from './types';
export type {
  ActionFizzled,
  ActionMisfired,
  ActionSkipped,
  AttackTarget,
  BattleEnded,
  BattleEvent,
  BattleLog,
  BattleStarted,
  EngagementEnded,
  GuardEnded,
  GuardRaised,
  LeaderFell,
  MoveKind,
  PassStarted,
  PoisonTicked,
  StatusApplied,
  StatusCleared,
  UnitAttacked,
  UnitDied,
  UnitHealed,
  UnitSnapshot,
} from './types';
export { blastDamage, healAmount, magicDamage, physicalDamage, resolveBattle } from './resolve';
export { chooseSetup, STRATEGY_POOL } from './ai';
export type { AiChoice, ChooseSetupOptions, StrategyArchetype } from './ai';
export { InvalidMatchSetupError, validateMatchSetup } from './validate';
export type { MatchSetupViolation } from './validate';
export { BALANCE, SLOT_COST, slotTotal } from './balance';
export type { BalanceData, ClassStats, Ratio, SizeClass } from './balance';
export { contentHash } from './hash';
export { CLASS_SEX, FEMALE_NAMES, MALE_NAMES, NAME_TABLES, rollName } from './names';
export type { NameSex } from './names';
export { createStreams, nextInt, rollElement, STREAM_LABELS } from './rng';
export type { Stream, StreamLabel, Streams } from './rng';
