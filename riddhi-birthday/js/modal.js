// A chapter may keep an unopened dialog in the DOM between messages.
// Only a visible, open modal should block secrets or pause a game.
export function activeModal(root = document) {
  return [...root.querySelectorAll('[aria-modal="true"], dialog[open], [data-modal-pending="true"]')].find((element) =>
    !element.closest('[hidden], [aria-hidden="true"]')
    && (!element.matches('dialog') || element.hasAttribute('open'))
    && element.getClientRects().length > 0) ?? null;
}

export function modalAllowsSecret(id, target, modal) {
  // Balloon messages have their own guide. Its nose is part of that dialog,
  // so it remains available without allowing background controls through.
  return !modal || (id === 3 && target?.dataset?.egg === 'dog' && modal.contains(target));
}
