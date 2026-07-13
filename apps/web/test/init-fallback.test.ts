import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_NAME } from '../src/config/constants';
import { resetInitFallbackForTest, showInitFallback } from '../src/flow/initFallback';

/**
 * Story 2.0 AC5: the Phaser-init fallback must never leave a silent blank page.
 * These exercise the DOM path against a minimal hand-rolled stub (node env, no
 * jsdom, no Phaser) — the verification the story's own rule requires, made a
 * permanent regression test instead of a one-time manual trigger.
 */
interface StubElement {
  id: string;
  children: StubElement[];
  textContent: string;
  style: { cssText: string };
  appendChild(child: StubElement): void;
}

function makeElement(id = ''): StubElement {
  return {
    id,
    children: [],
    textContent: '',
    style: { cssText: '' },
    appendChild(child) {
      this.children.push(child);
    },
  };
}

/** A just-enough `Document`: a body plus an optional registry of getById hits. */
function makeDoc(byId: Record<string, StubElement>): { doc: Document; body: StubElement } {
  const body = makeElement('body');
  const doc = {
    body,
    getElementById: (id: string) => byId[id] ?? null,
    createElement: () => makeElement(),
  } as unknown as Document;
  return { doc, body };
}

describe('showInitFallback (AC5)', () => {
  beforeEach(() => {
    resetInitFallbackForTest();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders the failure message into #game-container when present', () => {
    const container = makeElement('game-container');
    const { doc, body } = makeDoc({ 'game-container': container });

    showInitFallback(doc, new Error('WebGL unavailable'));

    expect(container.children).toHaveLength(1);
    expect(container.children[0]?.textContent).toContain(GAME_NAME);
    expect(container.children[0]?.textContent).toContain('failed to start');
    expect(body.children).toHaveLength(0); // did not double-render into body
  });

  it('falls back to document.body when #game-container is missing (no silent blank page)', () => {
    const { doc, body } = makeDoc({});

    showInitFallback(doc, 'boot error');

    expect(body.children).toHaveLength(1);
    expect(body.children[0]?.textContent).toContain('failed to start');
  });

  it('is idempotent — a second call (sync catch + async backstop both firing) does not duplicate', () => {
    const container = makeElement('game-container');
    const { doc } = makeDoc({ 'game-container': container });

    showInitFallback(doc, new Error('first'));
    showInitFallback(doc, new Error('second'));

    expect(container.children).toHaveLength(1);
  });
});
