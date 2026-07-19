// デバッグとCPUの強さ確認のため自動で100戦させる
// node testplay.js -p N -q N -m N
//
import { parseArgs } from 'node:util';
import { stdin as input, stdout as output, exit } from "node:process";

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
              return this.board.winner;
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

(function(){
  const { values } = parseArgs({
    options: {
      player0: {
        type: 'string',
        short: 'p',
      },
      player1: {
        type: 'string',
        short: 'q',
      },
      max: {
        type: 'string',
        short: 'm',
      },
    },
  });
  const max_level = 3;
  let pl0 = 3;
  let pl1 = 2;
  let max = 100;
  if (values.player0 !== undefined) {
    const n = parseInt(values.player0);
    if (n === NaN || n < 0 || max_level < n) {
      console.error(`-p '${values.player0}' の解析に失敗`);
      exit();
    }
    pl0 = n;
  }
  if (values.player1 !== undefined) {
    const n = parseInt(values.player1);
    if (n === NaN || n < 0 || max_level < n) {
      console.error(`-q '${values.player1}' の解析に失敗`);
      exit();
    }
    pl1 = n;
  }
  if (values.max !== undefined) {
    const n = parseInt(values.max);
    if (n === NaN || n < 1) {
      console.error(`-m '${values.max}' の解析に失敗`);
      exit();
    }
    max = n;
  }
  console.log(`[ Lv${pl0} vs Lv${pl1} ]`);
  const w_cnt = [0, 0];
  for (let i = 0; i < max; ++i) {
    output.write(`\r\x1b[KWait... ${i.toString().padStart(3,' ')}/${max.toString().padStart(3,' ')}`);
    const rnd = new Rand();
    const p0 = lv_to_inst(pl0, rnd, 0);
    const p1 = lv_to_inst(pl1, rnd, 1);
    const eg = new Bot(p0, p1, rnd, true);
    const w = eg.run();
    w_cnt[w] += 1;
  }
  output.write(`\r\x1b[KLv${pl0}: ${(w_cnt[0]/max*100).toFixed(1)}% (${w_cnt[0]}/${max}), Lv${pl1}: ${(w_cnt[1]/max*100).toFixed(1)}% (${w_cnt[1]}/${max})\n`);
})();


