import {
  EnGarde,
  Player,
  calc_legal,
  Te,
  sleep,
  Board,
  VERSION,
} from "./engarde.js";

import Lv0 from "./cpu/cpu.js";
import Lv1 from "./cpu/cpu1.js";
import Lv2 from "./cpu/cpu2.js";
import Lv3 from "./cpu/cpu3.js";

import { Rand } from "./rand.js";

const CARD_STYLES = [ 'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'sel', ];

class Human extends Player {
  constructor() {
    super('あなた', true, 0);
  }
  hide_menu() {
    for (let i = 0; i < 3; ++i) {
      document.getElementById(`action_but${i}`).hidden = true;
    }
  }
  /**
   * @param {Board} board
   * @return {Promise<Te>}
   */
  async on_turn(board) {
    const lst = calc_legal(this.hand, board);
    //
    const mevt = [];
    const cur_menu = [undefined, undefined, undefined];
    const sel_lst = [];
    //
    /**
     * 手札にイベントを設定
     * @param {Hand} hand
     */
    const init_hand = (hand, evt) => {
      const h = hand.split();
      const len = h.length;
      for (let i = 0; i < 5; ++i) {
        const tar = document.getElementById(`hand_but${i}`);
        if (i < len) {
          tar.card_rank = h[i];
          tar.classList.remove(...CARD_STYLES);
          tar.classList.add(`r${h[i]}`);
          tar.addEventListener('click', evt);
          tar.hidden = false;
        } else {
          tar.card_rank = 0;
          tar.hidden = true;
          tar.card_rank = 0;
        }
      }
    };
    const update_menu = () => {
      for (let i = 0; i < 3; ++i) {
        const tar = document.getElementById(`action_but${i}`);
        if (cur_menu[i] !== undefined) {
          tar.textContent = cur_menu[i].txt;
          tar.hidden = false;
        } else {
          tar.hidden = true;
        }
      }
    };
    /**
     * 手札の選択状況からボタンの内容を決定
     */
    const calc_menu = () => {
      cur_menu[0] = undefined;
      cur_menu[1] = undefined;
      cur_menu[2] = undefined;
      if (sel_lst.length === 0) return;
      const sels = sel_lst.map(e=>e.card_rank);
      if (board.is_attack) {
        let tar = 0;
        const pa = lst.find(te => te.type === Te.Parry && te.card_rank === sels[0] && te.count === sels.length);
        if (pa !== undefined) { cur_menu[tar++] = {te: pa, txt: `パリィ ${pa.card_rank} x${pa.count}`}; }
        if (sels.length === 1) {
          const bk = lst.find(te => te.type === Te.Backward && te.card_rank === sels[0]);
          if (bk !== undefined) { cur_menu[tar++] = {te: bk, txt: `${sels[0]} で回避`}; }
        }
      } else {
        let tar = 0;
        if (sels.length === 1) {
          const fd = lst.find(te=>te.type === Te.Forward && te.card_rank === sels[0]);
          if (fd !== undefined) { cur_menu[tar++] = { te: fd, txt: `${sels[0]} 前進` }; }
          const bd = lst.find(te=>te.type === Te.Backward && te.card_rank === sels[0]);
          if (bd !== undefined) { cur_menu[tar++] = { te: bd, txt: `${sels[0]} 退がる` }; }
          const at = lst.find(te=>te.type === Te.Attack && te.card_rank === sels[0] && te.count === 1);
          if (at !== undefined) { cur_menu[tar++] = { te: at, txt: `${sels[0]} で攻撃！` }; }
        } else {
          const fst = sels[0];
          // 最初のカードと異なるカードが１枚も選択されていない
          if (!sels.some(a=> a !== fst)) {
            const that = lst.find(te=>te.type === Te.Attack && te.card_rank == fst && te.count === sels.length);
            if (that !== undefined) cur_menu[tar++] = { te: that, txt: `${fst}x${sels.length} で攻撃` };
          }
          // 二個目以降が全部同じか？
          const snd = sels.slice(1);
          const aj = snd[0]; // ジャンプ攻撃のとき、攻撃のカードランク aj === fst でもよい
          if (!snd.some(a => a !== aj)) {
            const that = lst.find(te=>te.type === Te.Jump &&
              te.jump_rank === fst && te.card_rank == aj &&
              te.count === snd.length);
            if (that !== undefined) {
              const sl = snd.length;
              cur_menu[tar++] = { te: that, txt: `奇襲 ${fst}${'>'.repeat(sl)}${aj}`};
            }
          }
        }
      }
    };
    /**
     * 手札の共通イベント
     * @param {Event} e
     */
    const evt = e => {
      const idx = sel_lst.findIndex(x => x === e.target );
      if (idx === -1) {
        sel_lst.push(e.target);
        e.target.classList.add('sel');
      } else {
        sel_lst.splice(idx, 1);
        e.target.classList.remove('sel');
      }
      calc_menu();
      update_menu();
    };
    /**
     * 手札とメニューボタンからイベントを外す
     */
    const remove_events = () => {
      for (let i = 0; i < 5; ++i) {
        if (i < 3) {
          const mm = document.getElementById(`action_but${i}`);
          mm.removeEventListener('click', mevt[i]);
          mm.hidden = true;
        }
        const cc = document.getElementById(`hand_but${i}`);
        cc.removeEventListener('click', evt);
      }
    };
    /**
     * メニューボタンにイベントを設定
     * @param {Promise} solv
     */
    const init_menu_evt = solv => {
      for (let i = 0; i < 3; ++i) {
        const tar = document.getElementById(`action_but${i}`);
        tar.hidden = cur_menu[i] === undefined;
        tar.textContent = cur_menu[i] === undefined? '': cur_menu[i].txt;
        const ev = () => {
          const m = cur_menu[i];
          if (m !== undefined) {
            remove_events();
            solv(m.te);
          }
        };
        tar.addEventListener('click', ev);
        mevt.push(ev);
      }
    };
    //
    //
    //
    if (lst.length === 1 && lst[0].type === Te.Resign) {
      cur_menu[0] = { te: lst[0], txt: '投了' };
      cur_menu[1] = undefined;
      cur_menu[2] = undefined;
    } else {
      init_hand(this.hand.clone(), evt);
      this.hide_menu();
    }

    return new Promise(solv => {
      init_menu_evt(solv);
    });
  }
}


// CPU の行動にウェイトをかける
const make_on_turn = self => {
  /**
   * @async
   * @param {Board} board
   */
  const func = async (board) => {
    // 手を決める
    const te = self.think(board);
    // 投了しかない
    if (te.type === Te.Resign) {
      await sleep(self.speed); // 少し待ってから
      return te;
    }
    // 打つ手がある
    const v = []; // この配列に表示すべきカードをリストアップ
    if (te.type === Te.Forward || te.type === Te.Backward) {
      v.push(te.card_rank);
    } else if (te.type === Te.Parry || te.type === Te.Attack) {
      v.push(te.card_rank);
      // 上でプッシュ +1 したから、枚数は -1 すべき
      for (let i = 0; i < te.count - 1; ++i) v.push(te.card_rank); // cnt -1
    } else if (te.type === Te.Jump) {
      v.push(te.jump_rank);
      for (let i = 0; i < te.count; ++i) v.push(te.card_rank);
    }
    // 使う手札を表示
    for (let i = 0; i < 5; ++i) {
      const tar = document.getElementById(`ophand_${i}`);
      if (i < self.hand.length) {
        tar.classList.remove(...CARD_STYLES);
        tar.hidden = false;
        if (i < v.length) {
          tar.classList.add(`r${v[i]}`, 'sel');
        } else {
          tar.classList.add('r0');
        }
      } else {
        tar.hidden = true;
      }
    }
    // 少し待ってから
    await sleep(self.speed);
    // 使った手札を非表示に
    for (let i = 0; i < v.length; ++i) {
      const tar = document.getElementById(`ophand_${i}`);
      tar.hidden = true;
    }
    // 手札を返す
    return te;
  };
  // return
  return func;
};



class EnGardeGui extends EnGarde {
  constructor(rnd, level, use_jump, speed) {
    const human = new Human();
    const cpu = level === 0? new Lv0(rnd, 1):
      level === 1? new Lv1(rnd, 1):
      level === 2? new Lv2(rnd, 1):
      new Lv3(rnd, 1);
    super(human, cpu, rnd, use_jump);

    this.level = level;
    this.speed = speed;
    this.human = human;
    this.cpu   = cpu;
    this.cpu.speed = speed;
    this.cpu.on_turn = make_on_turn(this.cpu);
  }
  redraw_all_hand() {
    for (let i = 0; i < 2; ++i) this.redraw_hand(i);
  }
  /**
   * プレイヤーに補充があったら
   * @param {number} turn 補充されたプレイヤー
   */
  redraw_hand(turn) {
    const ss = this.players[turn].hand.split();
    const len = ss.length;
    for (let i = 0; i < 5; ++i) {
      const tar = document.getElementById(turn === 0? `hand_but${i}`: `ophand_${i}`);
      if (i < len) {
        tar.classList.remove(...CARD_STYLES);
        tar.classList.add(turn === 0 || this.board.winner !== Board.Game? `r${ss[i]}`: 'r0');
        tar.card_rank = ss[i];
        tar.hidden = false;
      } else {
        tar.card_rank = 0;
        tar.hidden = true;
      }
    }
  }
  /**
   * ボードを再描画
   * @param {number} turn  プレイした手番
   * @param {Te}     te    プレイされた手
   */
  redraw_board(turn, te) {
    // 今のPQ
    const PQ = [document.querySelector('.p-here'), document.querySelector('.q-here')];
    const aite = turn === 0? 1: 0;
    const NOR = ['P/', '\\Q'];
    // まずは位置を更新
    for (let tu = 0; tu < 2; ++tu) {
      if (PQ[tu] === undefined) throw new Error('panic');
      const m = PQ[tu].id.match(/^td-cell-(\d+)$/);
      const nid = parseInt(m[1]);
      if (this.board.pos[tu] !== nid) {
        PQ[tu].textContent = '';
        const cn = `${tu==0?'p':'q'}-here`;
        PQ[tu].classList.remove(cn);
        PQ[tu] = document.getElementById(`td-cell-${this.board.pos[tu]}`);
        PQ[tu].classList.add(cn);
      }
    }
    // 記号を更新
    if (this.board.winner !== Board.Game) {
      PQ[0].textContent = this.board.winner !== Board.Win1? NOR[0]: 'P_';
      PQ[1].textContent = this.board.winner !== Board.Win0? NOR[1]: '_Q';
    }
    else if (te.type === Te.Parry) {
      PQ[ turn ].textContent = ['P|', '|Q'][turn];
      PQ[ aite ].textContent = NOR[aite];
    } else if (te.type === Te.Backward) {
      PQ[ turn ].textContent = ['P~', '~Q'][turn];
      PQ[ aite ].textContent = NOR[aite];
    } else if (this.board.is_attack) {
      PQ[ turn ].textContent = ['P>', '<Q'][turn];
      PQ[ aite ].textContent = NOR[aite];
    } else {
      PQ[0].textContent = NOR[0];
      PQ[1].textContent = NOR[1];
    }
  }

  /**
   * メッセージを表示
   * @param {string} msg
   * @param {boolean} htm  innerHTML か
   */
  mes(msg, htm) {
    const tar = document.getElementById("msg_area");
    if (htm) {
      tar.innerHTML = msg;
    } else {
      tar.textContent = msg;
    }
  }
  /**
   * @param {number} turn
   * @param {Te} te
   */
  show_te(turn, te) {
    const name = this.players[turn].name;
    switch (te.type) {
      case Te.Resign:
        {
          const reason = ['防御できず', '身動きできず', ''][te.card_rank - 1];
          this.mes(`${name}は${reason} 投了`, false);
        }
        break;
      case Te.Parry:
        this.mes(`パリィ！ - '${te.card_rank}x${te.count}'`, false);
        break;
      case Te.Forward:
        this.mes(`${name}は ${te.card_rank} 前進`, false);
        break;
      case Te.Backward:
        this.mes(`${name}は ${te.card_rank} マス後退`, false);
        break;
      case Te.Attack:
        this.mes(te.count === 1? `${name}は '${te.card_rank}' で攻撃！`:
          `${name}の '${te.card_rank}<font color="red">x${te.count}枚'</font> 攻撃！`, true);
        break;
      case Te.Jump:
        this.mes(te.count === 1?
          `${name}の奇襲！ ${te.jump_rank}→'${te.card_rank}'`:
          `${name}の奇襲！ ${te.jump_rank}→'${te.card_rank
          }<font color="red">x${te.count}</font>'`, true);
        break;
      default:
        throw new Error('panic at show_te');
    }
  }
  redraw_vp() {
    for (let i = 0; i < 2; ++i) {
      const s = '★'.repeat(this.players[i].vp);
      document.getElementById(`td-vp${i}`).textContent =
        i == 0? s.padEnd(5, '☆') :
        s.padStart(5, '☆');
    }
  }
  show_stock() {
    const dl = this.deck.length;
    const c = dl < 5? 'red': dl < 10? 'orange': 'white';
    document.getElementById('deck_count').innerHTML = `<font color="${c}">${dl}</font>`;
  }
  show_mae() {
    document.getElementById("td-maai").textContent = this.board.mae;
  }
  redraw_all(msg) {
    this.mes(msg);
    if (this.board.pos[0] !== 0 || this.board.pos[1] !== 22) throw new Error(`panic ${this.board.pos}`);
    // PQ
    for (let i = 0; i < 2; ++i) {
      const here = `${i==0?'p':'q'}-here`;
      const now = document.querySelector('.'+here);
      const def = document.getElementById(`td-cell-${i==0?0:22}`);
      if (now !== def) {
        now.textContent = '';
        now.classList.remove(here);
        def.classList.add(here);
      }
      // いずれにしろリセット
      def.textContent = i == 0? 'P/': '\\Q';
      // hand
      this.redraw_hand(i);
    }
    // score, stock, menu
    this.redraw_vp();
    this.show_stock();
    this.show_mae();
    this.human.hide_menu();
  }
  but_wait(msg) {
    const but = document.getElementById('action_but0');
    but.textContent = msg;
    but.hidden = false;
    return new Promise(solv => {
      but.addEventListener('click', () => {
        but.hidden = true;
        solv();
      }, { once: true });
    });
  }
  async game_loop() {
    let round = 1;
    gameLoop: while (true) {
      this.deal_start();
      this.redraw_all(`第 ${round} ラウンドは${this.teban.name}から`);
      if (!this.teban.is_human) await sleep(this.speed * 1.5);
      roundLoop: while (true) {
        // show_redeal(play前の手番);
        const old_turn = this.teban.my_side;
        const te = await this.teban.on_turn(this.board.clone());
        const round_end = this.play( te );
        // 再描画
        this.show_te(old_turn, te);
        this.redraw_board(old_turn, te);
        // 補充した手札を表示（Parryでも表示を整えるため呼ぶ）
        this.redraw_hand( old_turn );
        // stock
        this.show_stock();
        // 間合い
        this.show_mae();
        if ( round_end ) {
          if (te.type === Te.Parry) {
            await sleep(this.speed);
            this.mes(`手番はまだ ${this.players[old_turn].name} です`, false);
            if (old_turn === 1) await sleep(this.speed);
          }
        } else {
          // 少し待ってから
          await sleep(this.speed * 1.5);
          const w = this.board.winner === Board.Draw? '引き分けです':
            `${this.board.win_kind === Board.KindResign? '投了により':
               this.board.win_kind === Board.KindHand? '手札判定で':
              '位置判定で'}<font color="red">${
            this.players[ this.board.winner ].name}</font>に 1vp`;
          this.mes(`${w}`, true);
          // 双方の手札も表示
          this.redraw_all_hand();
          if ( this.deal_end() === Board.Game ) {
            // スコア表示
            this.redraw_vp();
            await this.but_wait('OK');
            round += 1;
            break roundLoop;
          } else {
            // スコア表示
            this.redraw_vp();
            await this.but_wait('OK');
            this.mes(`<font color="red">ゲーム終了: ${this.players[this.board.winner].name}の勝ち</font>`, true);
            break gameLoop;
          }
        } // round end?
      } // roundLoop
    } // gameLoop
  }
}

window.onload = () => {
  document.getElementById('ver-no').textContent = VERSION;
  const start_but = document.getElementById("start-button");
  start_but.addEventListener('click', async () => {
    const level = parseInt(document.getElementById("cpu-sel").value);
    const wait  = parseInt(document.getElementById("wait-sel").value);
    const use_jump = document.getElementById("use-jump-chk").checked;
    //
    const rnd = new Rand();
    console.log(`seed: 0x${rnd.seed.toString(16)}, Jump: ${use_jump}, Lv: ${level}`);
    const egg = new EnGardeGui(rnd, level, use_jump, wait);
    //
    document.getElementById("option_cont").hidden = true;
    await egg.game_loop();
    document.getElementById("option_cont").hidden = false;
  });
};


