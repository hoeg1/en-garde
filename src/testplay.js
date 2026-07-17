// デバッグとCPUの強さ確認のため自動で100戦させる

import { EnGarde, Board } from "./engarde.js";
import { Rand } from "./rand.js";
import Lv0 from "./cpu/cpu.js";
import Lv1 from "./cpu/cpu1.js";
import Lv2 from "./cpu/cpu2.js";
import Lv3 from "./cpu/cpu3.js";

class Bot extends EnGarde {
  /**
   * @constructor
   * @param {Player} human
   * @param {Player} cpu
   * @param {Rand}   rnd
   * @param {boolean} [use_jump]
  */
  constructor(pl0, pl1, rnd, use_jump) {
    super(pl0, pl1, rnd, use_jump);
  }
  run() {
    let dcnt = 0;
    let tcnt = 0;
    while (true) {
      this.deal_start();
      while (true) {
        const te = this.teban.think(this.board.clone(), this);
        tcnt += 1;
        try {
          if (!this.play(te)) {
            if (this.deal_end() === Board.Game) {
              dcnt += 1;
              break;
            } else {
              return {
                str: `Win ${this.board.winner} (${this.players[0].vp}vs${this.players[1].vp})`,
                winner: this.board.winner,
                vp: [this.players[0].vp, this.players[1].vp],
              };
            }
          }
        } catch (e) {
          // thinkに使うboardをcloneしなかったり
          // think内部でusedをcloneしなかったり
          // あるいはusedをいい加減に消す(used.data &= ~hand.dataするとか）と
          // バグってここに飛ぶことになる
          console.error(`deal: ${dcnt}`);
          console.error(`tcnt: ${tcnt}`);
          console.error(`te: ${te}`);
          throw e;
        }
      }
    }
  }
}

function lv_to_inst(lv, rnd, side) {
  switch (lv) {
    case  1: return new Lv1(rnd, side);
    case  2: return new Lv2(rnd, side);
    case  3: return new Lv3(rnd, side);
    //
    default: return new Lv0(rnd, side);
  }
}

function vs(lv, LV) {
  const rnd = new Rand();
  const p0 = lv_to_inst(lv, rnd, 0);
  const p1 = lv_to_inst(LV, rnd, 1);
  const eg = new Bot(p0, p1, rnd, true);
  const k = eg.run();
  console.log(`${k.str}, seed: ${rnd}`);
  return k;
}

// lv に使いたいCPUのレベルを設定
const score = [{lv: 1, win: 0, vp: 0}, {lv: 0, win: 0, vp: 0}];
const test_max = 100;
for (let i = 0; i < test_max; ++i) {
  const k = vs(score[0].lv, score[1].lv);
  score[k.winner].win += 1;
  score[k.winner].vp += k.vp[k.winner];
  score[k.winner === 0? 1: 0].vp += k.vp[k.winner === 0? 1: 0];
}
console.log(score);


