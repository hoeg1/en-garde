import Lv0 from "./cpu.js";
import { Rand } from "../rand.js";
import { Board, Te, calc_legal } from "../engarde.js";

/**
 * これは最初に定義したCPUで、深く考えず「反射的に、相手がされたら嫌だと思い
 * そうなこと」を手鳴りでプレイするだけの敵として定義された。
 * 手鳴りでプレイしてくるだけなので En Garde をよく知っているプレイヤーには
 * クソ弱く感じる（多少後退やパリィを挟めば圧勝できる）。
 * しかし、En Garde を初めて知ったプレイヤーには手応えのある相手になっている
 * ようにも思える。
 *
 * そのあと色々試行錯誤し、乱数だけの Lv0 や賢いフリして超アホな Lv1 が作れた
 * ので、0や1の次にふさわしい「レベル２」としてコイツを採用することにした。
 */
export default class Lv2 extends Lv0 {
  /**
   * @constructor
   * @param {Rand} rnd         命名するため乱数を使う
   * @param {number} my_side   左側なら0
   */
  constructor(rnd, my_side) {
    super( rnd, my_side);
  }

  /**
   * @param {Board} board
   * @return {Te}
   */
  think(board) {
    const lst = calc_legal(this.hand, board);
    // 合法手が投了 or Parryしかないなら
    if (lst.length === 1) {
      return lst[0];
    }

    // usedから自身のハンドを除外※考えてやらないとバグる
    this.hand.forEach((cnt, rank)=>board.used.remove(rank, cnt, 'lv2'));

    const mae = board.mae;

    if (board.is_attack) {
      // parry は、存在するなら１手のみ
      const parry = lst.filter(te=>te.type === Te.Parry);
      /*
      // 攻撃されてparryできるなら候補が１つになるので上で処理される
      if (board.is_parry) {
        // resign でない時点で lst[0] = parry
        return lst[0];
      }
      */
      // is_jump == true
      const jibun = this.my_side == 0? board.pos[0]: 22 - board.pos[1];
      const aite  = this.my_side == 0? 22 - board.pos[1]: board.pos[0];
      const end = board.deck_len - 1 <= 0;
      if (end) {
        if (jibun < aite) { // 後退したら位置判定で負ける
          if (parry.length !== 0) {
            // parry があるならダメもとで parry => 手札判定で勝つかもしれない
            return parry[0];
          } else {
            // なんでもいい
            return this.rnd.sel_one(lst);
          }
        } else {
          // 位置で勝ってるので慎重に後退したい
          const bk = lst.filter(te=>te.type === Te.Backward);
          if (bk.length !== 0) {
            // 後退しても位置判定で勝てるやつがあるか？
            const sa = jibun - aite;
            const fb = bk.filter(te=>sa - te.card_rank >= 0);
            if (fb.length !== 0) {
              // 最小の戻る
              fb.sort((a,b)=>a.card_rank - b.card_rank);
              return fb[0];
            }
            // どれでもいいから後退
            return this.rnd.sel_one(bk);
          } else {
            // parry しかできないぽい
            return lst[0];
          }
        }
      } else {
        // 後退しても終わらない
        if (parry.length !== 0 && this.hand.has(mae) - board.atk_count >= 1) {
          // 次に同じ間合いで攻撃できるので parry してみる
          return parry[0];
        }
        // 後退できるか？
        const bk = lst.filter(te=>te.type === Te.Backward);
        if (bk.length !== 0) {
          // 反撃できる範囲で後退
          const bfb = bk.filter(te=>this.hand.has(mae + te.card_rank) >= 2);
          if (bfb.length !== 0) {
            // 枚数が多いのを出す
            bfb.sort((a,b)=>b.count - a.count);
            return bfb[0];
          }
          // 後退すると間合いが６以上になる
          const bk6 = bk.filter(te=>mae + te.card_rank >= 6);
          if (bk6.length !== 0) {
            // 最小ランク
            bk6.sort((a,b)=>a.card_rank - b.card_rank);
            return bk6[0] ;
          }
          // てきとーに後退
          return this.rnd.sel_one(bk);
        }
        return lst[0]; // parryしかできないっぽい
      } // not end
    }

    // 攻撃できる手札があるか？
    const atk = this.hand.has(mae);
    // 必勝のとき
    // 3枚以上で攻撃 or
    // カウンティングで必勝とわかってる場合は攻撃
    //   board.used.has(mae) ボード上にプレイされていない mae の枚数
    //       ただし自分が持ってる mae の枚数は削除ずみ
    //   その枚数が atk より大きいなら必勝
    if (atk >= 3 || board.used.has(mae) < atk) {
      return Te.make_attack(mae, atk);
    }
    if (atk == 2) {
      // ２枚あるなら１枚で攻撃
      // 同じ間合いで反撃されてもたいていは防御できる
      return Te.make_attack(mae, 1);
    }
    // ジャンプ攻撃可能なら
    const jmp = lst.filter(te=>te.type === Te.Jump);
    if (board.use_jump && jmp.length !== 0) {
      const jmp2 = jmp.filter(te=>te.count >= 2);
      if (jmp2.length !== 0) {
        // 移動が大きいほうがよい
        jmp2.sort((a,b)=>b.jump_rank - a.jump_rank);
        const top = jmp2[0];
        // 反撃できるように１枚残す
        return Te.make_jump(top.jump_rank, top.card_rank, top.count - 1);
      } else {
        // 反撃できずとも大半は移動して大丈夫なはず
        // 使う枚数が多いほうが安全
        jmp.sort((a,b)=>b.count - a.count);
        return jmp[0];
      }
    }

    // 前進・後退するとして、
    // 補充で終わる？
    if (board.deck_len - 1 <= 0) {
      const fff = lst.filter(te=>te.type === Te.Forward);
      const bbb = lst.filter(te=>te.type === Te.Backward);
      // 手札判定にできて、しかも移動後の間合いがある前進
      const fw = fff.filter(te=> this.hand.has(mae - te.card_rank) >= 1 );
      if (fw.length !== 0) {
        // 枚数が多いほうがよい
        fw.sort((a,b)=>this.hand.has(mae - b.card_rank) - this.hand.has(mae - a.card_rank));
        return fw[0];
      }
      // 同様に、後退しても自分の手札に間合いがある後退
      const bw = bbb.filter(te=> this.hand.has(mae + te.card_rank) >= 1 );
      if (bw.length !== 0) {
        bw.sort((a,b)=>this.hand.has(mae - b.card_rank) - this.hand.has(mae - a.card_rank));
        return bw[0];
      }
      // 前進しても手札判定では勝てない => 位置判定に持ち込みたい
      // 相手が前進後の間合いの手札を持っていないとわかるなら前進
      // ※自分の手札にその間合いはない
      const f2 = fff.filter(te=> board.used.has(mae - te.card_rank) === 0 );
      if (f2.length !== 0) {
        // 意味があるかはともかく、なるたけ前進する手を優先
        f2.sort((a,b)=>b.card_rank - a.card_rank);
        return f2[0];
      }
      // 後退でも同じ判定をするが、位置が弱くなるのでそこも加味
      // 後退できる距離(位置判定の強さ)を算出
      const jibun = this.my_side === 0? board.pos[0]: 22 - board.pos[1];
      const aite  = this.my_side === 0? 22 - board.pos[1]: board.pos[0];
      // 後退しても優位を保てて、しかも手札判定にならない手札があるか？
      const b2 = bbb.filter(te=>
        jibun - te.card_rank > aite && board.used.has(mae + te.card_rank) === 0 );
      if (b2.length !== 0) {
        // 意味があるかはともかく、なるたけ位置をキープ
        b2.sort((a,b)=>a.card_rank - b.card_rank);
        return b2[0];
      }
      //
      // 良さそうな手札が少ない
      if (jibun > aite) { // 今は位置で勝ってる
        // 前進すると手札判定されない範囲で、できるだけ前進したい
        const f3 = fff.filter(te=>mae - te.card_rank >= 6);
        if (f3.length !== 0) {
          f3.sort((a,b)=>b.card_rank - a.card_rank);
          return f3[0];
        }
        // 後退して逃げるが、位置の優位を保ちたい
        const b3 = bbb.filter(te=>jibun - te.card_rank > aite);
        if (b3.length !== 0) {
          // なるたけ位置をキープ
          b3.sort((a,b)=>a.card_rank - b.card_rank);
          return b3[0];
        }
        // あきらめる
      } else { // 位置で負けてる
        // 突進する
        if (fff.length !== 0) {
          fff.sort((a,b)=>b.card_rank - a.card_rank);
          return fff[0];
        }
        // あきらめる
      }
      return this.rnd.sel_one( lst );
    }

    // 進んでも間合いが６以上あるなら前進
    const m6 = lst.filter(te=>te.type === Te.Forward && mae - te.card_rank >= 6);
    if (m6.length !== 0) {
      // 大きい順
      m6.sort((a,b) => b.card_rank - a.card_rank);
      return m6[0];
    }
    // 反撃可能なら前進
    const m_han = lst.filter(te=>
      te.type === Te.Forward && this.hand.has(mae - te.card_rank) >= 2);
    if (m_han.length !== 0) {
      // 反撃可能枚数が多い順
      m_han.sort((a,b)=>this.hand.has(b.card_rank) - this.hand.has(a.card_rank));
      return m_han[0];
    }
    // 反撃可能なら後退
    const b_han = lst.filter(te=>
      te.type === Te.Backward && this.hand.has(mae + te.card_rank) >= 2);
    if (b_han.length !== 0) {
      // 反撃可能枚数が多い順
      b_han.sort((a,b)=>this.hand.has(b.card_rank) - this.hand.has(a.card_rank));
      return b_han[0];
    }

    // 間合いが６以上になるなら後退したとき安全
    const bk = lst.filter(te=>te.type === Te.Backward && mae + te.card_rank >= 6);
    if (bk.length !== 0) {
      // 小さい順
      bk.sort((a,b) => a.card_rank - b.card_rank);
      return bk[0];
    }

    // てきとー
    return this.rnd.sel_one(lst);
  }
}

