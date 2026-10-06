import test from 'node:test';
import assert from 'node:assert/strict';
import { activeModal, modalAllowsSecret } from '../js/modal.js';

function modal({hidden = false, native = false, open = false, rendered = true} = {}) {
  return {
    closest: () => hidden ? {} : null,
    matches: () => native,
    hasAttribute: () => open,
    getClientRects: () => rendered ? [{}] : [],
  };
}

test('a hidden balloon dialog leaves the secret hunt and games available', () => {
  const hiddenBalloon = modal({hidden:true});
  assert.equal(activeModal({querySelectorAll:() => [hiddenBalloon]}), null);
});

test('a visible custom modal or open native dialog blocks background actions', () => {
  for (const element of [modal(), modal({native:true, open:true})]) {
    assert.equal(activeModal({querySelectorAll:() => [element]}), element);
  }
});

test('closed native dialogs and CSS-hidden dialogs do not block later chapters', () => {
  const closed = modal({native:true});
  const cssHidden = modal({rendered:false});
  assert.equal(activeModal({querySelectorAll:() => [closed, cssHidden]}), null);
});

test('only the guide nose inside a balloon dialog can reveal a secret while it is open', () => {
  const nose = {dataset:{egg:'dog'}};
  const backgroundNose = {dataset:{egg:'dog'}};
  const dialog = {contains:target => target === nose};
  assert.equal(modalAllowsSecret(3, nose, dialog), true);
  assert.equal(modalAllowsSecret(3, backgroundNose, dialog), false);
  assert.equal(modalAllowsSecret(2, nose, dialog), false);
  assert.equal(modalAllowsSecret(1, undefined, dialog), false);
  assert.equal(modalAllowsSecret(1, undefined, null), true);
});
