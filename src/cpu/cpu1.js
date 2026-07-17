import Lv0 from "./cpu.js";
import { Rand } from "../rand.js";
import { Board, Te, calc_legal } from "../engarde.js";

/**
 * アンギャルドのような複雑なゲームにおいて、中途半端なアホは有用なはず
 *
 * ヒトならたやすく思いつく戦略をまずはリストにして、そのリストから乱数で雑に
 * 手を決めるようなＣＰＵは「適度に雑魚」と感じられるはず……と思って作ったが、
 * バランス調整が難しい。
 *    testplay.js で対戦させると Lv0 より弱くなってしまった……
 *
 * => でも、それはそれで面白いと思ったので以下のプログラムを採用する：
 * 好意的に見ればただの乱数で行動する Lv0 より Lv1 のほうが「ヒトっぽいプレイ」
 * をするので、この Lv.1 のCPUは人間プレイヤーがルールを覚えるために有用なので
 * はないだろうか？
 * ルールに不慣れなプレイヤーは「でたらめ」をプレイしてくるLv.0と対戦したら
 * 理性を持った人間も同じような手を打つと誤解するだろうが、以下で定義するLv1に
 * その心配は無い。
 * 彼はどうしようもないくらい弱いが、適度にヒトっぽいプレイをするので、ユーザー
 * のルール理解を妨げないと期待できる。
 *
 * てことで弱いけど以下のCPUを採用するものとする。しかも（Lv0より弱いけど)
 * ゲームのデフォルトにする。
 */
export default class Lv1 extends Lv0 {
  /**
   * @constructor
   * @param {Rand} rnd         命名するため乱数を使う
   * @param {number} my_side   左側なら0
   */
  constructor(rnd, my_side) {
    super(rnd, my_side);
    if (this.rnd === undefined) throw new Error('panic');
  }

  /**
   * @param {number} n
   * @return {boolean} 現在の山札からn枚使ったら0以下になるか
   */
  n_to_end(n) {
    return this.board.deck_len - n <= 0;
  }

  /**
   * 防御すべき局面のとき
   * 通常攻撃 = Parry が絶対必要なときはすでに処理しているので、
   * jump の対応だけする
   * 必ず「後退」が存在する（なければ前処理でリターンされてる）
   * @param {Array<Te>} legal
   * @return {Te}
   */
  on_jump(legal) {
    // 終了フラグが立っているか、この後退で立つ => 防御なので位置判定になる
    const back = legal.filter(te => te.type === Te.Backward); // 必ず存在
    if (back.length === 0) throw new Error('panic');
    if (this.n_to_end(1)) {
      const bb = back.filter(te => this.ato - te.card_rank > this.op_ato);
      if (bb.length !== 0) {
        // 必勝を発見
        return this.rnd.sel_one(bb);
      }
    }
    const parry = legal.find(te => te.type === Te.Parry);
    if (parry !== undefined) {
      // 終了フラグが立っているか、このプレイで立つ => 手札判定
      // フラグが立ってる時点で used は相手の手札に等しい
      if (this.n_to_end(parry.count)) {
        if (this.hand.has(this.mae) - parry.count > this.used.has(this.mae)) {
          // 防御したあとも mae に等しいランクがあり、その枚数が相手以上なら必勝
          return parry;
        }
      }
    }
    //
    // 退却したタイミングで攻撃されても反撃のカードがある
    const fight_back = back.filter( te => this.hand.has(this.ato - te.card_rank) > 0);
    // しかもその枚数が相手のあり得る手札より多い
    if (fight_back.length !== 0) {
      const fb = fight_back.filter( te =>
        this.hand.has(te.card_rank) > this.used.has(te.card_rank) );
      if (fb.length !== 0) {
        // 中でも特に枚数差が優秀なのを返す
        fb.sort((a,b)=>this.hand.has(b.card_rank) - this.hand.has(a.card_rank));
        return fb[0];
      }
    }
    if (fight_back.length !== 0) {
      // 相手より位置が良い
      const fb = fight_back.filter( te => this.ato - te.card_rank > this.op_ato );
      if (fb.length !== 0) {
        // 中でも特に位置が優秀なのを返す
        fb.sort((a,b)=>(this.ato - b.card_rank) - (this.ato - a.card_rank));
        return fb[0];
      }
    }
    if (this.seikaku < 0.5 && fight_back.length !== 0) {
      // 性格で戦術を変える < 0.5 なら攻めた戦術をとる
      // 攻撃されても反撃のカードが少なくとも１枚あれば位置を優先
      // 中でも特に位置が優秀なのを返す
      fight_back.sort((a,b)=>(this.ato - b.card_rank) - (this.ato - a.card_rank));
      return fight_back[0];
    }
    // 間合いが６以上になる
    const p6 = back.filter( te => this.mae + te.card_rank >= 6);
    if (p6.length !== 0) {
      // より下がらずに済むのを優先
      p6.sort((a,b)=>a.card_rank - b.card_rank);
      return p6[0];
    }

    //
    return this.rnd.sel_one(legal);
  }

  /**
   * 防御が必要ない手番の処理
   * 投了しかないケースはすでに処理している
   * @param {Array<Te>} legal
   * @return {Te}
   */
  on_normal(legal) {
    // 必勝ならそれ
    if (this.hand.has(this.mae) > this.used.has(this.mae)) {
      const k = this.used.has(this.mae);
      const must_win = legal.filter(te=>te.type === Te.Attack && te.count > k);
      if (must_win.length === 0) throw new Error('panic');
      must_win.sort((a,b)=>b.count-a.count);
      return must_win[0];
    }
    const search_under = n => {
      for (let i = n; i >= 1; --i) {
        if (this.used.has(i) !== 0) return false;
      }
      return true;
    };
    // 必ず雪隠詰めできる
    if (this.op_ato <= 5 && search_under(this.op_ato)) {
      const snow = legal.filter(te=>te.type===Te.Jump);
      if (snow.length !== 0) {
        return this.rnd.sel_one(snow);
      }
    }
    // プレイするとディールが終わり、判定で勝てる手
    const end_te = legal.filter(te=>{
      switch (te.type) {
        case Te.Attack:
          return this.n_to_end(te.count * 2) && // 必ず手札判定
            this.hand.has(te.card_rank) - te.count > this.used.has(te.card_rank);
        case Te.Jump:
          {
            const uc = te.count + (te.card_rank === te.jump_rank? 1: 0);
            const parry = this.used.has(te.card_rank) - te.count;
            const parry_to_win = this.n_to_end(te.count) &&
              (parry <= 0 || this.hand.has(te.card_rank) - uc > parry);
            let min_back = 6;
            for (let i = 1; i <= 5; ++i) {
              const n = this.used.has(i);
              if (n !== 0) { min_back = n; break; }
            }
            const back_to_win = this.n_to_end(te.count + 2) &&
              this.ato + te.jump_rank > this.op_ato - min_back;
            return this.seikaku < 0.5? parry_to_win || back_to_win:
              parry_to_win && back_to_win;
          }
        case Te.Forward:
        case Te.Backward:
          if (this.n_to_end(1)) {
            const p = te.type == Te.Backward? te.card_rank: -te.card_rank;
            if (this.mae + p <= 5) { // 手札判定
              const k = this.mae + p;
              return this.hand.has(k) - (k==te.card_rank?1:0) > this.used.has(k);
            } else { // 位置判定
              return this.ato - p > this.op_ato;
            }
          } else {
            return false;
          }
      }
    });
    if (end_te.length !== 0) {
      return this.rnd.sel_one(end_te);
    }

    // ジャンプ後 反撃されない or 反撃可能ならジャンプする
    {
      const jmp = legal.filter(te=>te.type === Te.Jump &&
        this.used.has(te.card_rank) <=
        this.hand.has(te.card_rank) - te.count -
          (te.card_rank === te.jump_rank? 1: 0));
      if (jmp.length !== 0) {
        return this.rnd.sel_one(jmp);
      }
    }
    // 攻撃後 反撃されない or 反撃可能なら攻撃
    {
      const atk = legal.filter(te=>te.type === Te.Attack &&
        this.used.has(te.card_rank) <= this.hand.has(te.card_rank) - te.count);
      if (atk.length !== 0) {
        return this.rnd.sel_one(atk);
      }
    }
    // 危険な手を打つ
    {
      const jmp = legal.filter(te=>te.type === Te.Jump);
      if (jmp.length !== 0) {
        // １枚攻撃なら反撃可能なやつを優先
        const j2 = jmp.filter(te=>te.count>=2);
        if (j2.length !== 0) {
          j2.sort((a,b)=>b.count-a.count);
          const te = j2[0];
          te.count = 1;
          return te;
        }
        if (this.seikaku < 0.5) {
          // 最も前進できるのを使う
          jmp.sort((a,b)=>b.card_rank - a.card_rank);
          return jmp[0];
        }
      }
    }
    // なるべく前進
    const fd = legal.filter(te=>te.type === Te.Forward);
    if (fd.length !== 0) {
      const fb = fd.filter(te=> {
        const k = this.mae - te.card_rank;
        const p = k === te.card_rank? 1: 0;
        return k <= 5 && this.hand.has(k) - p >= this.used.has(k);
      });
      if (fb.length !== 0) {
        fb.sort((a,b)=>this.hand.has(b.card_rank)-this.hand.has(a.card_rank));
        return fb[0];
      }
      const f6 = fd.filter(te=>{
        const n = this.mae - te.card_rank;
        return this.used.has(n) == 0 || n >= 6}); // 攻撃できない場所は安全
      if (f6.length !== 0) {
        f6.sort((a,b)=>b.card_rank-a.card_rank);
        return f6[0];
      }
    }
    // 後退
    {
      const bw = legal.filter(te=>te.type === Te.Backward);
      if (bw.length !== 0) {
        const fb = bw.filter(te=> {
          const k = this.mae + te.card_rank;
          const p = k === te.card_rank? 1: 0;
          return k <= 5 && this.hand.has(k) - p >= this.used.has(k);
        });
        if (fb.length !== 0) {
          fb.sort((a,b)=>this.used.has(a.card_rank)-this.used.has(b.card_rank));
          return fb[0];
        }
        const b6 = bw.filter(te=>this.mae + te.card_rank >= 6);
        if (b6.length !== 0) {
          b6.sort((a,b)=>a.card_rank-b.card_rank);
          return b6[0];
        }
      }
    }

    if (fd.length !== 0) return this.rnd.sel_one(fd);
    return this.rnd.sel_one(legal);
  }

  /**
   * @param {Board} board
   * @return {Te}
   */
  think(board) {
    const legal = calc_legal(this.hand, board);
    if (legal.length === 0) throw new Error('panic');
    // board.is_parry で parry があるか 投了しかない場合等は length == 1
    if (legal.length === 1) {
      return legal[0];
    }
    // 情報を用意
    this.mae = board.mae;
    this.ato = board.ato;
    this.op_ato = this.my_side === 0? 22 - board.pos[1]: board.pos[0];
    //board.used.data &= ~this.hand.data;
    board.used.remove_hand_bits(this.hand, 'lv1');
    this.board = board;
    this.used = board.used;
    //
    return board.is_jump? this.on_jump(legal): this.on_normal(legal);
  }
}

