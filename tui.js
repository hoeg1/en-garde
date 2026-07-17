import { stdin as input, stdout as output, exit } from "node:process";
import * as readline from "node:readline/promises";
import { parseArgs, styleText } from 'node:util';

import { Rand, sys_rand_int } from "./src/rand.js";
import {
  Te,
  Player,
  EnGarde,
  Board,
  sleep,
  VERSION,
} from "./src/engarde.js";
import Lv0 from "./src/cpu/cpu.js";
import Lv1 from "./src/cpu/cpu1.js";
import Lv2 from "./src/cpu/cpu2.js";
import Lv3 from "./src/cpu/cpu3.js";

const press_enter = async() => {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(styleText('dim', '[press Enter]\n'));
  } finally {
    rl.close();
  }
};

class TCard {
  constructor(rank) {
    this.rank = rank;
    this.sel = false;
  }
}
class TPad {
  /**
   * @param {Hand} hand
   */
  constructor(hand) {
    this.menu = [{te:null,txt:''}, {te:null,txt:''}, {te:null,txt:''}];
    this.menu_pos = -1;
    this.first_sel = null;
    this.cards = [];
    hand.forEach((cnt, rank) => {
      for (let i = 0; i < cnt; ++i) {
        this.cards.push(new TCard(rank));
      }
    });
    for (let i = 0; i < 5 - this.cards.length; ++i) {
      this.cards.push(new TCard(0));
    }
    this.mar = '  ';
    this.m_mar = '  ';
  }
  /**
   * @param {Board} board
   */
  get_te(board, solv) {
    if (board.is_attack) {
      this.menu[0] = {te:Te.make_resign(Te.Penetrated), txt:"Resign"}; // 防御不可能
      this.menu_pos = 0;
    }
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf-8');
    const redraw = (msg='>> 手札を選択') => {
      output.write('\x1b[1A');output.write('\x1b[2K');
      output.write('\x1b[1A');output.write('\x1b[2K');
      output.write('\x1b[1A');output.write('\x1b[2K');
      output.write('\x1b[1A');output.write('\x1b[2K');
      output.write('\x1b[1A');output.write('\x1b[2K');
      output.write('\x1b[1A');output.write('\x1b[2K');
      //
      console.log(msg);
      console.log(this.toString());
    };
    const all_off = () => {
      for (let c of this.cards) c.sel = false;
      this.menu[0] = {te:null,txt:''};
      this.menu[1] = {te:null,txt:''};
      this.menu[2] = {te:null,txt:''};
      this.menu_pos = -1;
      this.first_sel = null;
      redraw();
    };
    console.log('\n\n\n\n\n\n');
    redraw();
    const key_parse = key => {
      if (key === '\u0003') {
        console.log('強制終了します');
        input.removeListener('data', key_parse);
        input.setRawMode(false);
        exit();
      }
      if (key === '1' || key === '2' || key === '3' || key === '4' || key === '5') {
        const n = parseInt(key);
        let f = false;
        const sels = [];
        for (let c of this.cards) {
          if (!f && c.rank === n && !c.sel) {
            c.sel = true;
            f = true;
            if (this.first_sel === null) this.first_sel = c;
          }
          if (c.sel) sels.push(c.rank);
        }
        if (f) {
          if (sels.length === 0) { all_off(); }
          this.menu[0] = {te:Te.make_resign(Te.NoReason),txt:'Resign'};
          this.menu[1] = {te:null,txt:''};
          this.menu[2] = {te:null,txt:''};
          this.menu_pos = 0;
          let tar = 0;
          //
          const mae = board.mae;
          const ato = board.ato;
          if (board.is_attack) {
            const rcnt = sels.reduce((a,c)=>a+(c===mae?1:0), 0);
            if (board.atk_count === rcnt) {
              this.menu[tar++] = {te: Te.make_parry(mae, board.atk_count), txt:"Parry"};
            }
            if (board.is_jump) {
              if (sels.length === 1 && sels[0] <= ato) {
                this.menu[tar++] = {te: Te.make_backward(sels[0]), txt:`Backward ${sels[0]}`};
              }
            }
            if (tar == 0) {
              this.menu[0] = {te: Te.make_resign(Te.Penetrated), txt:'Resign'}; // 貫通
            }
          } else {
            if (sels.length === 1) {
              if (sels[0] < mae) {
                this.menu[tar++] = {te: Te.make_forward(sels[0]), txt:`Forward ${sels[0]}`};
              }
              if (sels[0] <= ato) {
                this.menu[tar++] = {te: Te.make_backward(sels[0]), txt:`Backward ${sels[0]}`};
              }
              if (sels[0] === mae) {
                this.menu[tar++] = {te: Te.make_attack(sels[0], 1), txt:`Attack '${mae}'`};
              }
            } else {
              const fst = sels[0];
              const all_same = sels.reduce((a,b)=>a&&fst==b, true);
              if (all_same) {
                if (sels[0] === mae) {
                  this.menu[tar++] = {te: Te.make_attack(sels[0], sels.length), txt:`Attack '${sels[0]}' x ${sels.length}`};
                }
                if (board.use_jump && sels[0] * 2 === mae) {
                  this.menu[tar++] = {te: Te.make_jump(sels[0], sels[0], sels.length - 1),
                    txt:`Jump ${sels[0]}, '${sels[0]}' x ${sels.length - 1}`};
                }
              } else if (board.use_jump) {
                const fr = this.first_sel.rank;
                const other = sels.filter(a=>a!==fr);
                if (other.length !== 0) {
                  const fst = other[0];
                  const al_s = other.reduce((a,b)=>a&&fst==b, true);
                  if (al_s && fr + other[0] === mae) {
                    this.menu[tar++] = {te: Te.make_jump(fr, other[0], other.length),
                      txt:`Jump ${fr}, '${other[0]}' x ${other.length}`};
                  }
                }
              }
            }
          }
          if (tar === 0) {
            this.menu[0].card_rank = Te.Stucked; // プレイヤーが打つ手なしと判断
            this.menu[1] = {te:null, txt:"diselect"};
            this.menu_pos = 1;
          }
          redraw();
        }
      }
      if (key === ' ') { all_off(); }
      if (key === 'k' || key === '\u001b[A') {
        if (this.menu_pos === -1) return;
        const p = (this.menu_pos - 1) < 0? 2: (this.menu_pos - 1);
        if (this.menu[p].te !== null) {
          this.menu_pos = p;
          redraw();
        }
      }
      if (key === 'j' || key === '\u001b[B') {
        if (this.menu_pos === -1) return;
        const p = (this.menu_pos + 1) % 3;
        if (this.menu[p].te !== null) {
          this.menu_pos = p;
          redraw();
        }
      }
      if (key === '\r' || key === '\n' || key === 'm') {
        if (this.menu_pos !== -1) {
          if (this.menu[this.menu_pos].te !== null) {
            input.removeListener('data', key_parse);
            input.setRawMode(false);
            solv(this.menu[this.menu_pos].te);
          } else {
            all_off();
          }
        }
      }
    };
    input.on('data', key_parse);
  }
  toString() {
    const cap = n => `${this.m_mar}${this.menu_pos===n?'> ':'  '}${this.menu[n].txt}\n`;
    let s = this.mar;
    for (let c of this.cards) {
      s += c.sel? '+---+ ': '      ';
    }
    s += `\n${this.mar}`;
    for (let c of this.cards) {
      s += c.sel? `| ${c.rank} | `: (c.rank !== 0? '+---+ ': '      ');
    }
    s += `${cap(0)}${this.mar}`;
    for (let c of this.cards) {
      s += c.sel? '+---+ ': (c.rank !== 0? `| ${c.rank} | `: '      ');
    }
    s += `${cap(1)}${this.mar}`;
    for (let c of this.cards) {
      s += c.sel? '      ': (c.rank !== 0? '+---+ ': '      ');
    }
    s += `${cap(2)}`;
    return s;
  }
}


class Human extends Player {
  constructor() {
    super('あなた', true, 0);
  }
  /**
   * @param {Board} board
   * @return {Promise}
   */
  async on_turn(board) {
    const pad = new TPad(this.hand);
    return new Promise(solv => {
      pad.get_te(board, solv);
    });
  }
}

class EnGardeTUI extends EnGarde {
  constructor(human, cpu, rnd, no_jump, lv, speed, is_debug) {
    super(human, cpu, rnd, no_jump);
    this.lv = lv;
    this.speed = speed;
    this.is_debug = is_debug;
  }
  ////////////////////////////////////////////////////////////////////////////
  draw_board(msg, te) {
    /////////// En Garde (no-jump) Lv0                        +
    const opt = `${this.use_jump? '':'(no-jump) '}Lv${this.lv} `.padEnd(14, '-');
    const dl = styleText(this.deck.length<5?'red':'none',this.deck.length.toString().padStart(2,' '));
    let s = `+- En Garde ${opt}------------- Deck ${dl} -+\n`;
    //let s = `+- En Garde ${opt}-----------------------+\n`;
    s += `| ${(msg.padStart(23 + msg.length / 2, ' ')).padEnd(46, ' ')} |\n`;
    s += '+------------------------------------------------+\n';

    const plc = tar => {
      const tt = this.board.turn === tar;
      const tet = te === undefined? 0: (te.type === Te.Parry? 1: te.type === Te.Backward? 2: 0);
      if (tt && tet == 1) return ['P|', '|Q'][tar];
      else if (!tt && this.board.is_attack) return ['P>', '<Q'][tar];
      else if (!tt && tet === 2) return ['P-', '-Q'][tar];
      else if (this.board.winner === Board.Game || this.board.winner === tar) {
        return ['P/', '\\Q'][tar];
      } else {
        return ['P_', '_Q'][tar];
      }
    };
    s += '| ';
    for (let i = 0; i < 23; ++i) {
      if (this.board.pos[0] === i || this.board.pos[1] === i) {
        s += plc( this.board.pos[0] === i? 0: 1 );
      } else {
        s += '  ';
      }
    }
    s += ' |\n';
    s += `| ${this.board.pos[0].toString().padEnd(2, ' ')}`;
    s += `--  --**  **--  --*|${this.board.mae.toString().padStart(2,' ')}|*--  --**  **--  --`;
    s += `${(22 - this.board.pos[1]).toString().padStart(2, ' ')} |\n`;
    const vp2s = vp => '*'.repeat(vp);
    s += `| ${vp2s(this.players[0].vp).padEnd(5, ' ')}                   `;
    s += `                 ${vp2s(this.players[1].vp).padStart(5, ' ')} |\n`;
    s += '+------------------------------------------------+\n';

    // draw
    if (this.is_debug) {
      console.log(`${s}${this.hands2str()}\n`);
    } else {
      console.log(s);
    }
  }

  hands2str() {
    const p0 = this.players[0].hand.reduce((acc, cnt, rank)=>
      `${acc}${rank.toString().repeat(cnt)}`, '');
    const p1 = this.players[1].hand.reduce((acc, cnt, rank)=>
      `${acc}${rank.toString().repeat(cnt)}`, '');
    return `   P: ${p0.padEnd(5,' ')}                            Q: ${p1}`;
  }

  ////////////////////////////////////////////////////////////////////////////
  async game_loop() {
    let dcnt = 1;
    deal_loop: while (true) {
      this.deal_start();
      this.draw_board(`Deal ${dcnt}: Start`);
      play_loop: while (true) {
        const te_is_human = this.teban.is_human;
        const te = await this.teban.on_turn(this.board.clone());
        const turn_char = this.board.turn === 0? 'P': 'Q';
        if (this.play( te )) {
          console.clear();
          this.draw_board(`${turn_char}: ${te}`, te);
          if (!te_is_human && te.type === Te.Parry) await sleep(this.speed);
        } else {
          console.clear();
          this.draw_board(`${turn_char}: ${te}`);
          // await sleep(this.speed); // 待たないほうがスムーズ

          console.log(`==================================================\n${
            this.hands2str() }\n  Deal End >> ${
            this.board.win_kind === Board.KindResign? '投了により':
            this.board.win_kind === Board.KindHand?   '手札判定により':
            '位置判定により'}${[" P に 1vp", " Q に 1vp", "引き分け"][this.board.winner]}\n`);
          dcnt += 1;
          if (this.deal_end() === Board.Game) {
            await press_enter();
            console.clear();
            // deal_startを呼ぶ
            break play_loop;
          } else {
            await press_enter();
            console.clear();
            this.draw_board("Game Over");
            // gameover -> その時のディール勝者が 5vp 取ってる
            console.log(`==================================================\n  Game Over >> ${
              ["P の勝ち", "Q の勝ち", "Error"][this.board.winner]}\n`);
            break deal_loop;
          }
        } // play() -> next or end
      } // play_loop
    } // deal_loop
  } // game_loop
}

/**
 * @param {Player} self
 */
const make_on_turn = (self, speed) => {
  /**
   * @param {Board} board
   */
  return async (board) => {
    const te = self.think(board);
    await sleep(speed);
    return te;
  };
};


const show_version = () => { console.log(`Reiner Knizia's En Garde   ver. ${VERSION}`); }
const show_help = () => {
  console.log(`En Garde   ver. ${VERSION}
  --version, -v         バージョンを表示
  --help, -h            このヘルプを表示
  --rule, -r            詳細なルールを表示

  --nojump, -n          奇襲（ジャンプ）攻撃ができないルールで遊びます

  --level, -l  N        0 以上の自然数 N で対戦相手の強さを指定します
                        初期値は 1 です
  --wait, -w   N        1 以上の自然数 N で CPUの待ち時間を指定します(ミリ秒)
                        初期値は 500ms で、小さくするほど動作が早くなります

  --seed, -s   N        1 以上の自然数 N で 乱数シードを指定します
                        0xFF のような16進数も可能です。デバッグ用です
  --debug, -d           手札が丸見えになります。デバッグ用です

【操作方法】
1 - 5 ... カードを選択
j, ↓ ... カーソルを下に
k, ↑ ... カーソルを上に
Enter ... 決定

　あなたはＰという名前でプレイします。対戦相手はＱです。
　手番になったら手札が表示されるので、１〜５のキーで使うカードを選びます。選ん
だカードで可能なコマンドが右側に表示されるので j, k キーか上下キーで選び、エン
ターキーで決定します。奇襲（ジャンプ）攻撃は最初に選んだカードで移動、次に選ん
だカードで攻撃します。複数枚での攻撃はそのランクを連続で入力します。
　スペースを押すとカードを選び直せます。
　コマンドを発見できなければ Resign（投了） が表示されます。投了は相手から攻撃
を受けたときも表示されます。
　ゲームは Ctrl+C で強制終了できます。
`);
};

const show_rule = () => {
  console.log(`【En Garde のあそびかた】
　En Garde はドイツのゲームデザイナー Reiner Knizia 博士が発明した２人用のフェ
ンシングゲームです。


【目的】
　カードを使ってボード上の剣士を操作し、相手の剣士に一撃を決めるか、相手を行動
不能に追い込むと 1vp が手に入ります（アプリでは * で表現されます）。
　先に 5vp を取ったプレイヤーの勝ちです。


【使う道具】
　１〜５のランクを持つカードがそれぞれ５枚ずつ、合計２５枚のカードを使います。


【ディール】
　最初のディーラーは乱数で決定されます。以降ディーラーは勝負ごとに後退です。
　ディーラーは５枚の手札を配り、残りは山札にします。
　ディーラーではないプレイヤーからプレイを始めます。


【プレイ】
　プレイヤーは手札から１枚以上のカードを出し、次のいずれかを宣言します。

・前進(Forward)
　出したカードのランクだけ自分の駒を前進（相手駒の方向）させます。
　相手の駒を飛び越すことはできません。相手の駒がある場所ちょうどに行くことも
　できません。
　ボード中央に |22| と表示されている数値は両者の間合いで、この数より小さいカ
　ードのみを前進に使えます。

・後退(Backward)
　出したカードのランクだけ自分の駒を後退（相手駒と逆方向）させます。
　場外になってしまうような後退はできません。プレイヤーの初期位置の真下に表示
　されている数が後退可能なマス数です。

・攻撃(Attack)
　出したカードのランクがちょうど間合いに等しいなら（|22| などとと表示されてい
　る間合いと同じランクなら）、相手プレイヤーに攻撃を仕掛けます。
　同じランクのカードが複数あるなら重ねて出すこともでき、その場合、攻撃力が強
　化されます。※攻撃力については後述

・奇襲攻撃(Jump)
　最初に１枚のカードを選び、続いて同じランクの１枚以上のカードを選びます。
　２種類のカードのランクを足し合わせた数が間合いに等しいなら、まず最初に選ん
　だカードランクだけ駒を進めたあと、２つ目に選んだカード（２枚以上でもよい）
　で　先述の「攻撃」をします。
　例えば間合いが８のとき、「３５５」を選び、３進んだあと２枚の「５」で攻撃で
　きるということです。
　２種類のカードは同じランクでも構いません。例えば間合いが６のとき、３のカー
　ドを２枚出し、３つ前進して３で攻撃して構いません。
　奇襲攻撃はオプションでオフにできます。じりじりとした展開が続き、後述の手札
　判定による決着が多いゲームになります。


【攻撃があったとき】

・防御(Parry)
　攻撃を受けたプレイヤーは、それが奇襲攻撃でない場合、相手が攻撃に使ったのと
　「同じランク」で「同じ枚数」のカードを手札から出さなければなりません。
　不可能なら攻撃が当たったことになり、投了するしかなくなります。

・回避(Backward)
　攻撃が奇襲攻撃だった場合、攻撃を受けたプレイヤーは先述の Parry で防御するか、
　先に説明した Backward のプレイをすることで攻撃を受け流すことができます。
  この守り方ができるのは攻撃の種類が奇襲攻撃のときだけです。
  Parry も Backward も不可能なら投了するしかありません。


【投了(Resign)】
　攻撃を防ぐことができないか、どの手札も出すことのできないプレイヤーは投了を宣
言しなくてはなりません。勝負はただちに終了し、相手に 1vp が入ります。
　例えば自分の初期位置に自分の駒があり、眼の前に相手がいて、１のカードを持って
いない場合、前進・後退・攻撃・奇襲のどれも不可能なので、投了するしかありません。


【手札の補充】
　手番プレイヤーは手札をプレイし終えたらただちに５枚になるまで手札を補充します。
　ただし、攻撃があり、それに対して Parry を選んだプレイヤーは補充せずにプレイを
し、プレイしたあとで手札を補充します。
　そうして山札が枯れた場合、そこで勝負は終了します。それが攻撃直後に枯れたのな
ら相手プレイヤーが防御したあとで終了です。このとき、Parry したあとに行動するこ
とはできません。


【判定勝ち】
　山札が枯れたせいで勝負が終了したときは、次のように勝敗を決めます。

・手札判定
　その勝負の最後の行動が奇襲攻撃に対する Backward ではなく、しかも間合いが５
　以下であれば、各プレイヤーの手札を見比べます。現在の間合いに等しいランクの
　カードをたくさん持っているほうが勝利です。
　同数なら次に説明する「位置判定」で勝者を決めます。

・位置判定
　最後が奇襲攻撃に対する受け流しの Backward であるか、手札判定で勝敗が決まら
　なかった場合は、各プレイヤーが Backward で移動可能な距離を比べ、大きいほう
　の勝ちです。

・引き分け
　位置判定すら同数だった場合はどちらも勝者とはならず、次の勝負を始めます。


【次の勝負】
　すべてのカードを回収し、ディーラーを交代して次の勝負を始めます。
　先に 5vp を取ったほうの勝ちです。
`);
};

// start
async function start() {
  const { values } = parseArgs({
    options: {
      version: {
        type: 'boolean',
        short: 'v',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
      rule: {
        type: 'boolean',
        short: 'r',
      },
      nojump: {
        type: 'boolean',
        short: 'n',
      },
      debug: {
        type: 'boolean',
        short: 'd',
      },
      seed: {
        type: 'string',
        short: 's',
      },
      wait: {
        type: 'string',
        short: 'w',
      },
      level: {
        type: 'string',
        short: 'l',
      },
    },
  });
  if (values.version) { show_version(); exit() }
  if (values.help) { show_help(); exit() }
  if (values.rule) { show_rule(); exit() }
  let seed = sys_rand_int();
  if (values.seed !== undefined) {
    const s = parseInt(values.seed, /^0x[a-fA-F0-9]+$/.test(values.seed)? 16: 10);
    if (s === NaN || s <= 0) {
      console.error(`--seed '${values.seed}' を解釈できません`);
      exit();
    } else {
      seed = s;
    }
  }
  let lv = 1;
  if (values.level !== undefined) {
    const s = parseInt(values.level);
    if (s === NaN || s < 0) {
      console.error(`--level '${values.level}' を解釈できません`);
      exit();
    } else {
      lv = s;
    }
  }
  let wait = 500;
  if (values.wait !== undefined) {
    const s = parseInt(values.wait);
    if (s === NaN || s <= 0) {
      console.error(`--wait '${values.wait}' を解釈できません`);
      exit();
    } else {
      wait = s;
    }
  }

  console.clear();
  const rnd = new Rand(seed);
  const p = new Human();
  const q = lv === 0? new Lv0(rnd, 1):
    lv === 1? new Lv1(rnd, 1):
    lv === 2? new Lv2(rnd, 1):
    new Lv3(rnd, 1);
  q.on_turn = make_on_turn(q, wait);
  const eg = new EnGardeTUI(p, q, rnd, !values.nojump, lv, wait, values.debug);
  await eg.game_loop();
  console.log(styleText('dim', `seed: 0x${rnd.seed.toString(16)}`));
  exit();
};

await start();


