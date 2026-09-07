import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {placeSelectMenu} from "../app/game/menuPlacement.ts";
import {FLIP_SWAP_DURATION_MS} from "../app/game/core.ts";

for(const [width,height] of [[412,915],[430,932],[768,1024],[1440,900],[932,430]]) {
  test(`dropdown stays within ${width} × ${height} at either screen edge`,()=>{
    for(const top of [100,height-100]) {
      const anchor={left:width-180,top,bottom:top+40,width:200};
      const box=placeSelectMenu(anchor,{width,height},220);
      assert.ok(box.left>=8 && box.left+box.width<=width-8);
      assert.ok(box.top>=8 && box.top+Math.min(box.maxHeight,220)<=height-8);
    }
  });
}

test("game-critical movement remains readable and paused in reduced-motion mode",()=>{
  const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.equal(FLIP_SWAP_DURATION_MS,680);
  assert.match(css,/\.flip-game\[data-paused="true"\][\s\S]*?animation-play-state: paused/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: var\(--swap-duration, 680ms\) !important/);
  assert.match(css,/\.reaction-pad.is-target\s*\{\s*transition: none/);
  assert.doesNotMatch(css,/animation: reaction-target-in/);
  assert.match(css,/\.score-ring\.reaction-score-ring \{ background: var\(--orange\);/);
});
