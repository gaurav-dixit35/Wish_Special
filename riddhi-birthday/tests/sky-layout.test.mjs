import test from 'node:test';
import assert from 'node:assert/strict';
import { skyLandmarks } from '../js/sky-layout.js';

test('small-phone sky targets stay outside the HUD and inside the viewport', () => {
  for (const width of [320, 360, 375, 390, 430, 640]) {
    const points = skyLandmarks(width, 844, true);
    const hudLeft = Math.max(16, width / 2 - 170);
    const hudRight = hudLeft + Math.min(292, width - 88);
    for (const point of [points.moon, points.restingStar]) {
      assert.ok(point.x - 28 > hudRight, `clear 56px target at ${width}px`);
      assert.ok(point.x + 28 <= width);
    }
    for (const point of Object.values(points.wishes)) {
      assert.ok(point.x - 10 > hudRight, `visible wish keepsake at ${width}px`);
      assert.ok(point.x + 10 < width);
    }
  }
});

test('wish stars remain distinct from each other and the moon and meteor', () => {
  for (const [width, height, mobile] of [[320,568,true], [390,844,true], [768,1024,false], [1440,1000,false]]) {
    const points = skyLandmarks(width, height, mobile);
    const stars = Object.values(points.wishes);
    assert.ok(Math.hypot(stars[0].x-stars[1].x, stars[0].y-stars[1].y) >= 60);
    for (const star of stars) {
      assert.ok(Math.abs(star.y-points.moon.y) >= 30);
      assert.ok(Math.abs(star.y-points.restingStar.y) >= 30);
      assert.ok(star.y < height);
    }
  }
});
