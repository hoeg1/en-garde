import Lv0 from "./cpu.js";
import { Rand } from "../rand.js";
import { Te, Board, Hand, calc_legal } from "../engarde.js";

// LvX => Lv5 とかにする
export default class LvX extends Lv0 {
  /**
   * @constructor
   * @param {Rand} rnd
   * @param {number} side
   */
  constructor(rnd, side) {
    super(rnd, side);
    // 自分が 0 なのか 1 なのかは .my_side でわかる
    // 乱数で選ばれた名前から算出した .seikaku という値が使える。０から１の実数
    // 乱数は .rnd から使える
  }

  /**
   * 思考して返す
   * @param {Board} board   ゲームの現在の情報。クローンなので破壊してよい
   * @return {Te}           打つべき手。必ず合法手であること
   */
  think(board) {
    // すべての合法手をリストアップ
    // 投了しかないなら要素数１で投了コマンドが入っている
    //  => 逆にいうと打つ手があるとき投了は入ってない
    const legal = calc_legal(this.hand, board);

    // *Parry のときを含め* 投了等打つ手が１択ならそれを返す(以外にない)
    if (legal.length === 1) {
      return legal[0];
    }

    // board.used はデッキ全体からプレイされたカードを差し引いたもの
    //    言い換えると相手が持っている可能性のある手
    //    そこから自分の手札を削除しておく
    board.used.remove_hand_bits(this.hand);

    // よく使う変数を計算しておいて、このあとの関数にわたす

    // 対戦相手の背後
    const op_ato = this.my_side === 0? 22 - board.pos[1]: board.pos[0];
    const arg = [legal, board, board.deck_len, board.used,
      board.mae, board.ato, op_ato];

    // 防御すべきならそれを考え（移動攻撃のみ）、でなければノーマルの手を考える
    return board.is_jump? this.think_jump(...arg): this.think_normal(...arg);
  }

  /**
   * てきとーに一個返す
   * @param {Array<Te>} legal
   * @return {Te}
   */
  random(legal) {
    return this.rnd.sel_one(legal);
  }

  /**
   * te.card_rank が最大のを返す
   * @param {Array<Te>} legal
   * @return {Te}
   */
  rank_max(legal) {
    legal.sort((a,b) => b.card_rank - a.card_rank);
    return legal[0];
  }

  /**
   * te.card_rank が最小のを返す
   * @param {Array<Te>} legal
   * @return {Te}
   */
  rank_min(legal) {
    legal.sort((a,b) => a.card_rank - b.card_rank);
    return legal[0];
  }

  /**
   * te.count が最大のを返す
   * @param {Array<Te>} legal
   * @return {Te}
   */
  count_max(legal) {
    legal.sort((a,b) => b.count - a.count);
    return legal[0];
  }

  /**
   * te.count が最小のを返す
   * @param {Array<Te>} legal
   * @return {Te}
   */
  count_min(legal) {
    legal.sort((a,b) => a.count - b.count);
    return legal[0];
  }

  /**
   * te.jump_rank が最大のを返す
   * @param {Array<Te>} legal
   * @return {Te}
   */
  jump_rank_max(legal) {
    legal.sort((a,b) => b.jump_rank - a.jump_rank);
    return legal[0];
  }

  /**
   * te.jump_rank が最小のを返す
   * @param {Array<Te>} legal
   * @return {Te}
   */
  jump_rank_min(legal) {
    legal.sort((a,b) => a.jump_rank - b.jump_rank);
    return legal[0];
  }

  /**
   * 合法手から特定のタイプを抽出
   * @param {Array<Te>} legal
   * @param {number} ty
   * @return {Array<Te>}
   */
  filter(legal, ty) {
    return legal.filter(te=>te.type === ty);
  }

  /**
   * あるハンドと間合いから合法な移動攻撃を算出
   * @param {Hand} hand
   * @param {number} mae
   * @return {Array<Te>}
   */
  get_jump(hand, mae) {
    const lst = [];
    if (mae <= 5) {
      for (let rank = 1; rank <= 5; ++rank) {
        const cnt = hand.has(rank);
        if (cnt >= 2 && cnt * 2 === mae) {
          for (let i = 1; i < cnt; ++i) lst.push(Te.make_jump(rank, rank, i));
        } else {
          const m = hand.has(mae - rank);
          for (let i = 1; i <= m; ++i) lst.push(Te.make_jump(rank, mae - rank, i));
        }
      }
    }
    return lst;
  }

  /**
   * あるハンドと間合いに合法な移動攻撃があるか返す
   * @param {Hand} hand
   * @param {number} mae
   * @return {boolean}
   */
  has_jump(hand, mae) {
    if (mae <= 5) {
      for (let rank = 1; rank <= 5; ++rank) {
        const cnt = hand.has(rank);
        if (cnt >= 2 && cnt * 2 === mae) {
          return true;
        } else {
          const m = hand.has(mae - rank);
          if (m >= 1) return true;
        }
      }
    }
    return false;
  }

  /**
   * 移動攻撃されているとき = Jump攻撃のときだけ
   * 通常攻撃に対しては Parry or Resign なので think 呼び出し時点で合法手が１択
   * 考える余地がないのでこの関数は呼ばれない
   * @param {Array<Te>} legal      合法手のリスト
   * @param {Board}     board      ゲームの現在の情報の集まり
   * @param {number}    deck_len   デッキの残り枚数
   * @param {Hand}      used       フルデッキから使われたカードを差し引いた残り
   * @param {number}    mae        間合い
   * @param {number}    ato        自分の背後の余裕
   * @param {number}    op_ato     相手の背後の余裕
   * @return {Te}                  打つべき手。必ず合法手であること
   */
  think_jump(legal, board, deck_len, used, mae, ato, op_ato) {
    return this.random(legal);
  }

  /**
   * 別に攻撃されてないとき
   * 投了しかない場合は呼ばれないので投了について考える必要はない
   * @param {Array<Te>} legal      合法手のリスト
   * @param {Board}     board      ゲームの現在の情報の集まり
   * @param {number}    deck_len   デッキの残り枚数
   * @param {Hand}      used       フルデッキから使われたカードを差し引いた残り
   * @param {number}    mae        間合い
   * @param {number}    ato        自分の背後の余裕
   * @param {number}    op_ato     相手の背後の余裕
   * @return {Te}                  打つべき手。必ず合法手であること
   */
  think_normal(legal, board, deck_len, used, mae, ato, op_ato) {
    return this.random(legal);
  }
}
