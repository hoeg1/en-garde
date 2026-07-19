// ver.0.0.1 のラスボス


import Lv0 from "./cpu.js";
import { calc_prob_for_rank } from "./cpu.js";
import { Rand } from "../rand.js";
import { EnGarde, Deck, Te, Board, Hand, calc_legal } from "../engarde.js";

/**
 * Lv.3 のためにプレイアウトするクラス。
 * Board(状態) と EnGarde(ルール) をわけてみたものの、
 * ボードゲームの現実を考えると「設計を失敗した」という気持ちが強い。
 * 変にわけないほうが実装が遥かに簡単だった。
 *
 * 以下はリファクタリングを諦めて試行錯誤した結果、動くようになったコード：
 */
class Bot extends EnGarde {
  /**
   * @constructor
   * @param {Rand} rnd
   * @param {boolean} ujump
   */
  constructor(rnd, side, seikaku, ujump) {
    const cpu = [new Lv3(rnd, 0), new Lv3(rnd, 1)];
    cpu[0].is_playout = true;
    cpu[1].is_playout = true;
    cpu[side].seikaku = seikaku;
    super(cpu[0], cpu[1], rnd, ujump);
  }
  run(board, side, hand, te) {
    // まずはボードをクローン: そうしないと予想外のバグに悩む
    this.board = board.clone();
    // usedもクローンしないと壊れるので複製
    this.deck  = new Deck(this.board.used.clone().remove_hand_bits(hand, 'bot remove'));
    //
    this.players[side].hand = hand.clone();
    const aite = side === 0? 1: 0;
    this.players[aite].hand = new Hand(
      this.deck.deal_n(this.rnd, board.ph_count[aite]));
    this.board.deck_len = this.deck.length;
    // 引数の te を最初としてプレイアウトを始める
    // その一手でプレイが終わったら結果を返す
    if (!this.play(te)) return this.board.winner === side;
    // 終わらなければラウンドが終わるまでループ
    while (true) {
      // boardは破壊されるので必ずクローン
      const te = this.teban.think(this.board.clone());
      // ラウンドが終わったら次のディールは考慮せずラウンド勝者が自分かを返す
      if (!this.play(te)) return this.board.winner === side;
    }
  }
}

/**
 * ある程度合理的に動くプレイヤーを定義しようとすると、山札の残り枚数が少なく
 * なったタイミングで価値判断の基準を変える必要があると気づく。
 * 同じ前進でも「次にラウンドが終わる」か「終わらない」かでは一手の価値が激変
 * するので、安直に「１手先を読んだときのプログラム」を書きたくなるけれど、
 * それを始めると「ｎ手先を読んだときのプログラム」を延々と書かなければならない。
 * ここではゲームに「中盤・終盤」の別を持ち込み、「山札が１０枚」がその基準だと
 * （testpley.jsの感じからなんとなく）決めつけ、
 * 山が10枚以下になったら行動を変えるようにした
 */
export default class Lv3 extends Lv0 {
  /**
   * @constructor
   * @param {Rand} rnd
   * @param {number} side
   */
  constructor(rnd, side) {
    super(rnd, side);
    // 乱数で選ばれた名前から算出した .seikaku という値が使える。０から１の実数
    // 乱数は this.rnd から使える
    this.is_playout = false;
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

    // 中終盤、このあと手番が終わる可能性を考慮し「先の先」を読む
    // 最初に１５枚あるので、ざっくり10枚くらいからを中終盤とみなす
    if (board.deck_len <= 10 && !this.is_playout) {
      return this.do_playout(legal, board);
    }

    // board.used はデッキ全体からプレイされたカードを差し引いたもの
    //    言い換えると相手が持っている可能性のある手
    //    そこから自分の手札を削除しておく
    board.used.remove_hand_bits(this.hand, 'lv3 think');

    // よく使う変数を計算しておいて、このあとの関数にわたす

    // 対戦相手の背後
    const op_ato = this.my_side === 0? 22 - board.pos[1]: board.pos[0];
    const arg = [legal, board, board.deck_len, board.used,
      board.mae, board.ato, op_ato];


    // 防御すべきならそれを考え（移動攻撃のみ）、でなければノーマルの手を考える
    return board.is_jump?
      this.think_jump(...arg):
      this.think_normal(...arg);
  }

  /**
   * プレイアウトする：
   * ある合法手をプレイしたらどうなるかを「自分ならこうする」の形で最後までやる
   * @param {Array<Te>} legal   最初の１手としてありえる合法手のリスト（必ず合法手）
   * @param {Board} board       最初の１手を打てる局面情報（クローンして使う）
   * @return {Te}               合法手のうち得点最多の１手
   */
  do_playout(legal, board) {
    const max_playout = board.deck_len >= 7? 50: 100; // プレイアウト回数
    for (let i = 0; i < max_playout; ++i) {
      // プレイアウトしまくる
      for (let te of legal) {
        if (te.pl_vp === undefined) te.pl_vp = 0;
        const bot = new Bot(this.rnd, this.my_side, this.seikaku, board.use_jump);
        const vp = bot.run(board, this.my_side, this.hand, te);
        if (vp) te.pl_vp += 1; // 結果を初手オブジェクトに記録
      }
    }
    // 得点最多を返す
    legal.sort((a,b) => b.pl_vp - a.pl_vp);
    // TODO: 無駄な乱雑さ？
    // const top = legal[0].pl_vp;
    // return this.random( legal.filter(a=>a.pl_vp === top) )
    return legal[0];
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
   * 雪隠詰め可能か
   * 相手の後が６以上あるときは何を出しても逃げられる。
   * ５以下のとき、
   *   相手がパリィ可能か？
   *        可能なら、パリィ後に移動できる手がないなら成立
   *   不可能なら、相手の後の範囲でカードが存在しなければ成立
   * @param {Array<Te>}     jump    今の移動攻撃リスト
   * @param {Array<number>} phand   プレイヤーが持っているかもしれない手札
   * @param {number}        op_ato
   * @return {Array<Te>}            雪隠詰めできる手が（あれば）返す
   */
  find_secchin(jump, phand, op_ato) {
    if (op_ato >= 6) return [];
    return jump.filter( te => {
      const ph = [...phand];
      if (ph[te.card_rank] !== 0) { // パリィ可能
        // パリィしたとして枚数を差し引く
        ph[te.card_rank] -= te.count;
      }
      // Parry可能でも そうでなくても
      for (let i = op_ato; i >= 1; --i) {
        if (ph[i] >= 1) return false; // 退却しうる
      }
      return true;
    });
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
    const parry = legal.find(te => te.type === Te.Parry);
    if (parry !== undefined) {
      // deck_len === 0 を含め
      // パリィできるとき、次のターンでその間合いの攻撃力 > 相手ならパリィ
      if (this.hand.has(mae) - parry.count > used.has(mae))
        return parry;
    }
    // ほとんどの場合は後退することになるし、後退の手は確実に存在する
    // => なければ「投了」として処理されている
    const backward = this.filter(legal, Te.Backward);
    if (backward.length === 0) throw new Error('panic');

    // 相手が持ちうる手札を分割しておく
    const phand = used.to_array();

    // この１手で終わる
    if (deck_len === 0) {
      const w = backward.filter( te => ato - te.card_rank > op_ato );
      if (w.length !== 0) {
        // 位置判定で勝てる
        return this.random(w);
      }
    }

    // 移動した結果、間合いが５以下になる後退をまずは抽出
    const b5 = backward.filter( te => mae + te.card_rank <= 5 );
    if (b5.length !== 0) { // あれば
      // そのうちで、攻撃＝反撃されても確実に防御できる間合いの前進を選択
      // このあとの補充で終わる = 手札判定になる場合を含む
      const fight_back = b5.filter( te => {
        const k = mae + te.card_rank;
        // 前進ではないからここの引き算は不要
        const p = this.hand.has(k);// - (k===te.card_rank? 1: 0);
        te.bl_p = p;
        return p >= phand[k];
      });
      if (fight_back.length !== 0) {
        if (deck_len === 1) {
          // 手札判定に備え、最も攻撃枚数が高くなる移動をする
          fight_back.sort((a,b) => b.bl_p - a.bl_p);
          return fight_back[0];
        }
        // 最も少ない後退で済むのを返す
        return this.rank_min(fight_back);
      }
      // 自分の手札によらず、相手が持ってないランクの場所は安全
      const anchi = b5.filter( te => phand[ te.card_rank + mae ] === 0 );
      if (anchi.length !== 0) {
        return this.rank_min(anchi);
      }
      // 冒険的な後退
      // 一番持ってる確率が少ない場所に移動してみる
      if (this.seikaku > 0.5) {
        const prob = calc_prob_for_rank(board.ph_count[ this.my_side == 0? 1: 0], used);
        const adv = b5.toSorted((a, b) => prob[a.card_rank] - prob[b.card_rank]);
        return adv[0];
      }
      // それもダメなら間合いが６以上を探して、最も間合いを保てる場所
      const lb5 = backward.filter(te => te.card_rank + mae >= 6);
      if (lb5.length !== 0) {
        return this.rank_min(lb5);
      }
    } // else {}

    // deck_len が 1 のとき含め
    // 間合いが５以下を保てないなら最も後を保てるカード
    return this.rank_min(backward);
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
    this.kill = false;
    // 必勝ならそれを出す
    if (mae <= 5 && this.hand.has(mae) > used.has(mae)) {
      this.kill = true;
      return this.count_max(this.filter(legal, Te.Attack));
    }
    // あとでたくさん使うので、used を配列にしとく
    // phand[0]...ダミー
    // phand[n]...そのランクの枚数
    const phand = used.to_array();

    // 雪隠詰め可能か調べる
    const jump = this.filter(legal, Te.Jump);
    if (jump.length !== 0 && op_ato <= 5) {
      const s = this.find_secchin(jump, phand, op_ato);
      if (s.length !== 0) { // 雪隠詰めが存在するなら
        this.kill = true;
        return this.random(s);
      }
    }

    // 次の１手で終わるとき
    if (deck_len === 1) {
      // 手札判定で勝つか、手札で負けず、位置で勝てる前進・後退があれば出す
      const func = fd => {
        return te => {
          const tcr = te.card_rank;
          const m = mae + (fd? -tcr:  tcr);
          const a = ato + (fd?  tcr: -tcr);
          const h = this.hand.has(m) - (m === tcr? 1: 0);
          te.hcnt = h;
          const u = used.has(m);
          return h > u || (h >= u && a > op_ato);
        };
      };
      const forward = this.filter(legal, Te.Forward);
      if (forward.length !== 0) {
        const f2 = forward.filter(func(true));
        if (f2.length !== 0) {
          this.kill = true;
          f2.sort((a,b)=>b.hcnt - a.hcnt);
          return f2[0];
        }
      }
      const backward = this.filter(legal, Te.Backward);
      if (backward.length !== 0) {
        const b2 = backward.filter(func(false));
        if (b2.length !== 0) {
          this.kill = true;
          b2.sort((a,b)=>b.hcnt - a.hcnt);
          return b2[0];
        }
      }
    }

    // 次の２つをどちらも実行するが、性格で評価順を変える
    const act_one = () => {
      if (jump.length === 0) return null;
      // パリィされても直後に反撃できない（防げる）移動攻撃があれば出す。
      // 候補が複数あるなら最初のジャンプが多いのを優先。
      const j2 = jump.filter( te =>
        this.hand.has(te.card_rank) - te.count >= phand[te.card_rank] );
      return j2.length !== 0? this.rank_max(j2): null;
    };
    const attack = this.filter(legal, Te.Attack);
    const act_two = () => {
      if (attack.length === 0) return null;
      // 攻撃しても反撃されない（防げる）攻撃があるなら出す
      // 候補が複数あるなら最小枚数で攻撃（反撃されたらやばいので）
      const a2 = attack.filter( te => te.count >= phand[te.card_rank] );
      return a2.length !== 0? this.count_min(a2): null;
    };
    // 性格で評価順を変える
    if (this.seikaku < 0.5) {
      const act1 = act_one(); if (act1 !== null) return act1;
      const act2 = act_two(); if (act2 !== null) return act2;
    } else {
      const act2 = act_two(); if (act2 !== null) return act2;
      const act1 = act_one(); if (act1 !== null) return act1;
    }

    const prob = calc_prob_for_rank(board.ph_count[ this.my_side == 0? 1: 0], used);

    // 前進する
    const forward = this.filter(legal, Te.Forward);
    if (forward.length !== 0) {
      // 移動した結果、間合いが５以下になる前進を抽出
      const f5 = forward.filter( te => mae - te.card_rank <= 5 );
      // そのうちで、攻撃されても確実に防御できる間合いの前進を選択
      if (f5.length !== 0) {
        const fight_back = f5.filter( te => {
          const k = mae - te.card_rank;
          // 間合いが２で１前進の場合、みたい枚数は「１」のカード
          // ＝＞その手札を前進に使っている場合は差し引く必要がある
          return this.hand.has(k) - (k===te.card_rank? 1: 0) > phand[k];
        });
        if (fight_back.length !== 0) {
          // 最も前進できるのを返す
          return this.rank_max(fight_back);
        }
        // 自分の手札によらず、相手が持ってないランクの場所は安全
        const anchi = f5.filter( te => phand[ mae - te.card_rank ] === 0 );
        if (anchi.length !== 0) {
          return this.rank_max(anchi);
        }
        // 性格による冒険的な前進
        // 一番持ってる確率が少ない場所に突っ込んでみる
        const adv = f5.toSorted((a, b) => prob[a.card_rank] - prob[b.card_rank]);
        // 性格は、数値が高いほど猪突猛進
        if (prob[ adv[0].card_rank ] < this.seikaku / 2) return adv[0];
      } else {
        // 間合いが５以下になる前進が存在しないなら、最も前進できるカード
        return this.rank_max(forward);
      }
    } // has forward

    const backward = this.filter(legal, Te.Backward);
    if (backward.length !== 0) {
      // 移動した結果、間合いが５以下になる後退をまずは抽出
      const b5 = backward.filter( te => mae + te.card_rank <= 5 );
      // そのうちで、攻撃されても確実に防御できる間合いの後退を選択
      if (b5.length !== 0) {
        const fight_back = b5.filter( te => {
          const k = mae + te.card_rank;
          // 後退だから差し引く必要はない
          return this.hand.has(k) > phand[k];
        });
        if (fight_back.length !== 0) {
          // 最も少ない後退で済むのを返す
          return this.rank_min(fight_back);
        }
        // 自分の手札によらず、相手が持ってないランクの場所は安全
        const anchi = b5.filter( te => phand[ te.card_rank + mae ] === 0 );
        if (anchi.length !== 0) {
          return this.rank_min(anchi);
        }
        // 冒険的な後退
        // 一番持ってる確率が少ない場所に移動してみる
        if (this.seikaku > 0.6) {
          const adv = b5.toSorted((a, b) => prob[a.card_rank] - prob[b.card_rank]);
          return adv[0];
        }
        // それもダメなら間合いが６以上を探して、最も間合いを保てる場所
        const lb5 = backward.filter(te => te.card_rank + mae >= 6);
        if (lb5.length !== 0) {
          return this.rank_min(lb5);
        }
      } else {
        // 良さげな手が無いならやむなく後退
        // 間合いが５以下になる後退が存在しないなら、最も後を保てるカード
        return this.rank_min(backward);
      }
    } // has backward

    // 考えるのを諦める
    return this.random(legal);
  }
}
