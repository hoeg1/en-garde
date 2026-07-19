// En Garde に必要な色々を定義する
// ルール参照
// https://www.gamers-jp.com/playgame/archives/000887.html


// 疑似乱数
import { Rand } from "./rand.js";

// バージョン文字列
export const VERSION = '0.0.3';

/**
 * await sleep(x) の形で指定されたミリ秒待つだけの関数
 * @param {number} ms
 */
export const sleep = ms => new Promise(res=>setTimeout(res, ms));

//////////////////////////////////////////////////////////////////////////////

/**
 * 手札のランク等を算出するために、立っているビットの数を返す
 * @param {number} n ターゲットの整数
 * @return {number} 立っているビットの数
 */
export const bit_count = n => {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
};

/**
 * ある整数について、立っているのがひとつのビットのみなら真を返す
 * @param  {number} n ある(整数の)ビット列 n について
 * @return {boolean}  n のうち１つのビットだけが１かどうかを真偽値で返す
 */
export const is_single = n => n > 0 && (n & (n - 1)) === 0;


//     ランク:      5     4     3     2     1
// あるカードは 0b11111_11111_11111_11111_11111 という整数で表現される
// ビット列で定義する。
// ある１枚のカードとは、is_single(card) が真のカードのことで、
// 立っている唯一のビット位置からランクを復元できるデータのこと。
//
// 複数のビットが立っているようなモノは
// Deck or Hand と呼ばれ、
// このうち Deck は残りビットから立っているものを返すだけのクラス
// Handは手札で、あるビットが立っているか否かを返したりなんだり、
// 命令が色々と生えてる
//



//////////////////////////////////////////////////////////////////////////////

/**
 * 本質的には単なるひとつの整数について、それを山札とみなし管理するクラス
 * Hand と似ているが、このクラスの仕事は要請されて１枚のカードを返すだけ
 */
export class Deck {
  /**
   * @constructor
   * @param {number} [def]   初期値はフルデッキ２５枚
   */
  constructor(def=(1 << 25) - 1) {
    this.data = def;
  }
  /**
   * デッキから1枚ディール
   * @param {Rand}      rnd
   * @return {number}   乱数で選ばれたデッキの１枚
   */
  deal_one(rnd) {
    while (this.data) {
      const bit = 1 << rnd.rand(25);
      if ((this.data & bit) !== 0) {
        this.data &= ~bit;
        return bit;
      }
    }
    throw new Error('deck is empty');
  }
  /**
   * デッキからn枚ディール
   * @param {Rand} rnd
   * @param {number} n  配る枚数
   * @return {number}   乱数で選ばれたデッキのn枚（論理和）
   */
  deal_n(rnd, n) {
    if (n <= 0) return 0;
    let result = 0;
    for (let i = 0; i < n; ++i) {
      result |= this.deal_one(rnd);
    }
    return result;
  }
  /**
   * デッキの長さ。残りが無いならゼロを返す
   * @return {number}
   */
  get length() { return bit_count(this.data); }
  /**
   * デッキを複製する
   * @return {Deck}
   */
  clone() {
    return new Deck(this.data);
  }
  /**
   * デッキの文字列表現
   * @return {string}  '[５つのランクの残り枚数]'
   */
  toString() {
    let s = '[';
    for (let r = 1, cp = this.data; r <= 5; ++r, cp >>= 5) {
      s += `${bit_count(cp & 0b11111)}${r === 5? ']': ', '}`;
    }
    return s;
  }
}


//////////////////////////////////////////////////////////////////////////////

/**
 * 本質的にただのひとつの整数について、それを手札とみなし管理する
 * Deck と同じデータを保持するが、役割的にメンバ関数が豊富
 */
export class Hand {
  /**
   * @constructor
   * @param {number} def   このデッキが持つ初期値
   */
  constructor(def=0) {
    this.data = def;
  }
  /**
   * @return {number}  手札の枚数
   */
  get length() { return bit_count(this.data); }
  /**
   * 手札を論理和で追加 => デフォルトでゼロなのでこの論理和は破綻しないはず
   * @param {number} bits
   */
  add_card_bits(bits) {
    this.data |= bits;
  }
  /**
   * あるランクが何枚あるか
   * @param {number} rank 調べたいランク
   * @return {number} 0枚から5枚
   */
  has(rank) {
    // 範囲外なら０を返す
    return rank >= 6 || rank <= 0? 0:
      bit_count(this.data & (0b11111 << ((rank - 1) * 5)));
  }
  /**
   * 手札から指定したカードを複数枚除外
   * @param {number} rank そのランク
   * @param {number} cnt  その枚数
   */
  remove(rank, cnt, kind) {
    let mask = this.data & (0b11111 << ((rank - 1) * 5));
    if (bit_count(mask) < cnt) throw new Error(`${rank} が ${cnt} 枚必要 - ${kind}: ${this}`);
    for (let i = 0; i < cnt; ++i) {
      const bit = mask & -mask;
      this.data &= ~bit;
      mask &= ~bit;
    }
    return this.data;
  }
  /**
   * 手札から指定したカードを1枚除外
   * @param {number} rank そのランク
   */
  remove_one(rank, kind) {
    const mask = this.data & (0b11111 << ((rank - 1) * 5));
    if (bit_count(mask) === 0) throw new Error(`${rank}が存在しない - ${kind}: ${this}`);
    this.data &= ~(mask & -mask);
    return this.data;
  }
  /**
   * 別のハンドとかぶるビットを除去
   * board.used に対して多くのバグを引き起こした凶悪な命令
   *
   * !!! 実際のビットと has(x) が返すものは違うと意識すること !!!
   *
   * @param {Hand} hand
   */
  remove_hand_bits(hand, kind) {
    for (let rank = 1, mask = 0b11111; rank <= 5; ++rank, mask <<= 5) {
      const cnt = bit_count(hand.data & mask);
      const hav = bit_count(this.data & mask);
      if (hav < cnt) throw new Error(`${rank}が存在しない - ${kind}: hand: ${hand}, deck: ${this}`);
      for (let i = 0, bits = this.data & mask; i < cnt; ++i) {
        const bit = bits & -bits;
        this.data &= ~bit;
        bits &= ~bit;
      }
    }
    return this.data;
  }
  /**
   * 各ランクについて枚数とそのランクをfuncに報告するだけの関数
   * func(枚数, ランク)
   * @param {function(count:number, rank:number)} func
   */
  forEach(func) {
    for (let i = 0, cp = this.data; i < 5; ++i, cp >>= 5) {
      func(bit_count(cp & 0b11111), i + 1);
    }
  }
  /**
   * 各ランクについて枚数とそのランクをfuncに報告し、結果で新しい配列を作る
   * func(枚数, ランク)
   * @param {function(count:number, rank:number):any} func
   * @return {Array<any>}  配列の最初の要素はランクを揃えるためのダミー
   */
  map(func) {
    const ret = [ func(0, 0) ]; // 最初にダミーの呼び出し
    for (let rank = 1, cp = this.data; rank <= 5; ++rank, cp >>= 5) {
      ret.push(func(bit_count(cp & 0b11111), rank));
    }
    return ret;
  }
  /**
   * 各ランクについて枚数とそのランクをfuncに報告し、結果を次のfunc呼び出しに渡す
   * func(acc, 枚数, ランク)->acc
   * @param {function(acc:any, count:number, rank:number): acc:any} func
   * @param {any} acc
   */
  reduce(func, acc) {
    for (let i = 0, cp = this.data; i < 5; ++i, cp >>= 5) {
      acc = func(acc, bit_count(cp & 0b11111), i + 1);
    }
    return acc;
  }
  /**
   * 手札を分割して配列にする
   * @return {Array<number>}  1-5 のランク *それぞれに* 分割したリスト
   *                          結果は [1,1, 2,2, 3] みたいになる
   */
  split() {
    const ret = [];
    for (let i = 1, cp = this.data; i <= 5; ++i, cp >>= 5) {
      const cnt = bit_count(cp & 0b11111);
      for (let j = 0; j < cnt; ++j) ret.push(i); // 無いならプッシュされない
    }
    return ret;
  }
  /**
   * 手札を要素数６の配列にする
   * インデックスがランクで、内容が枚数。０番目はダミー
   */
  to_array() {
    const ret = [ 0 ]; // ダミー
    for (let rank = 1, cp = this.data; rank <= 5; ++rank, cp >>= 5) {
      ret.push(  bit_count(cp & 0b11111)  ); // そのランクが無くてもプッシュ
    }
    return ret;
  }
  /**
   * クローンをつくる
   * @return {Hand}
   */
  clone() {
    return new Hand(this.data);
  }
  /**
   * フルデッキからこの手札を差し引いて残りデッキに等しいハンドを返す
   * @return {Hand}
   */
  make_sabun() {
    return new Hand(this.data & ( (1 << 25) - 1 ));
  }

  /**
   * 現在の手札状況を '[r1, r2, r3, r4, r5]' という形の文字列にする
   * ランクゼロは文字列として無視される
   * @return {string}
   */
  toString() {
    let s = '[';
    for (let r = 1, cp = this.data; r <= 5; ++r, cp >>= 5) {
      s += `${bit_count(cp & 0b11111)}${r === 5? ']': ', '}`;
    }
    return s;
  }
}

//////////////////////////////////////////////////////////////////////////////

/**
 * 合法的な「１手」を表現するクラス
 */
export class Te {
  static Resign   = 0;
  static Forward  = 1;
  static Backward = 2;
  static Attack   = 3;
  static Jump     = 4;
  static Parry    = 5;

  static Penetrated = 1; // Resign のうち、攻撃が貫通
  static Stucked    = 2; // 身動きできない
  static NoReason   = 3; // ユーザーが自分の意志で投了した
  /**
   * @constructor
   * @param {number} [type]       手の種類で、６種類ある
   * @param {number} [card_rank]  使うカード（奇襲なら攻撃に使うカード）
   * @param {number} [cont]       攻撃のとき、その枚数
   * @param {number} [jump_rank]  奇襲なら、移動に使うカード
   */
  constructor(type=Te.Resign, card_rank=undefined, count=undefined, jump_rank=undefined) {
    this.type      = type;
    this.card_rank = card_rank;
    this.count     = count;
    this.jump_rank = jump_rank;
  }

  // static な命令として手札宣言に対応する Te を作る関数を用意する

  /**
   * 投了する
   * @return {Te}
   */
  static make_resign(reason) { return new Te(Te.Resign, reason); }
  /**
   * 前進する
   * @param {number} rank   1~5の数値
   * @return {Te}
   */
  static make_forward(rank) { return new Te(Te.Forward, rank, 1); }
  /**
   * 前進する
   * @param {number} rank   1~5の数値
   * @return {Te}
   */
  static make_backward(rank) { return new Te(Te.Backward, rank, 1); }
  /**
   * 攻撃する
   * @param {number} rank   攻撃に使う1~5の数値
   * @param {number} cnt    攻撃に使う枚数
   * @return {Te}
   */
  static make_attack(rank, cnt) { return new Te(Te.Attack, rank, cnt); }
  /**
   * ジャンプ攻撃する
   * @param {number} jump_rank  移動に使う1~5の数値
   * @param {number} atk_rank   攻撃に使う1~5の数値
   * @param {number} cnt        攻撃に使う枚数
   * @return {Te}
   */
  static make_jump(jump_rank, atk_rank, cnt) {
    return new Te(Te.Jump, atk_rank, cnt, jump_rank);
  }
  /**
   * 防御する
   * @param {number} rank   防御に使う1~5の数値 = 間合いと同じであること
   * @param {number} cnt    防御に使う枚数 = 攻撃枚数と同じであること
   * @return {Te}
   */
  static make_parry(rank, cnt) { return new Te(Te.Parry, rank, cnt); }

  /**
   * @return {string}  この手の簡易的な文字列表現を返す
   */
  toString() {
    switch (this.type) {
      case Te.Resign:
        return `Resign (${this.card_rank === Te.Penetrated? "Penetrated":
            this.card_rank === Te.Stucked? "Stucked": "User"})`;
      case Te.Forward:
        return `Forward ${this.card_rank}`;
      case Te.Backward:
        return `Backward ${this.card_rank}`;
      case Te.Attack:
        return this.count === 1? `Attack ${this.card_rank}`:
          `Attack '${this.card_rank}' x ${this.count}`;
      case Te.Jump:
        return this.count === 1? `Jump ${this.jump_rank} -> ${this.card_rank}`:
          `Jump ${this.jump_rank} -> '${this.card_rank}' x ${this.count}`;
      case Te.Parry:
        return this.count === 1? `Parry ${this.card_rank}`:
          `Parry '${this.card_rank}' x ${this.count}`;
      default:
        s += '[ undefined Type ]';
        break;
    }
  }
}


//////////////////////////////////////////////////////////////////////////////

/**
 * ゲームの「誰の目にも見える」状態を表すクラスを作り、そのようなクラスと
 * ゲームの山札や手札（個人に所属する情報）、あるいはゲームの進行状態を知りたい
 * という要望があれば返答する「ステートを管理するクラス」とで分離するため、
 * 「誰の目にも明らか」を分類しようと試みたクラス。
 *
 * => 良いアイデアと思ったが無駄に複雑になってしまった。やんないほうが良かった。
 *  -> このバージョンはとりあえず動いてはいるのでこの方針を採用し、細部は諦める
 *     ことにする。
 */
export class Board {
  // 勝敗がついたかどうか
  static Game = -1; // ゲーム中で勝者は未定
  static Win0 =  0; // 0 の勝ち
  static Win1 =  1; // 1 の勝ち
  static Draw =  2; // 引き分けで決着

  // 勝敗を決めた要素
  static KindHand     = 0; // 手札判定
  static KindPosition = 1; // 位置判定
  static KindResign   = 3; // 投了が宣言された

  /**
   * ボード上に見えているものを集約
   * @constructor
   * @param {number}  turn         手番
   * @param {number}  [pos0]       左プレイヤーの位置
   * @param {number}  [pos1]       右プレイヤーの位置
   * @param {number}  [ph0]        左プレイヤーの手札枚数
   * @param {number}  [ph1]        右プレイヤーの手札枚数
   * @param {number}  [deck_len]   残りのデッキ枚数
   * @param {boolean} [is_parry]   手番が通常攻撃されているか
   * @param {boolean} [is_jump]    手番がジャンプ攻撃されているか
   * @param {number}  [atk_count]  攻撃されているとき、何枚で攻撃されているか
   * @param {boolean} [hoju]       手番はプレイ後に手札を補充できるか
   * @param {number}  [winner]     Game なら勝負はついてない
   * @param {number}  [win_kind]   勝敗を決めた要素
   * @param {boolean} [use_jump]   ジャンプ攻撃を許すルールか
   */
  constructor(turn, pos0=0, pos1=22,
    ph0=5, ph1=5, deck_len=15,
    is_parry=false, is_jump=false, atk_count=0,
    hoju=true, winner=Board.Game, win_kind=Board.KindPosition,
    used=new Hand((1 << 25) - 1),
    use_jump=true,
  ) {
    this.turn      = turn;
    this.pos       = [pos0, pos1];
    this.ph_count  = [ph0, ph1];
    this.deck_len  = deck_len;
    this.is_parry  = is_parry;
    this.is_jump   = is_jump;
    this.atk_count = atk_count;
    this.hoju      = hoju;
    this.winner    = winner; // -1: ゲーム中, 0 or 1: 勝者決定, 2: 引き分け
    this.win_kind  = win_kind;
    this.used      = used;
    this.use_jump  = use_jump;
  }

  /**
   * コピーを返す
   * TODO: 以下の関数をいじるときは、常に Board の引数の順番をチェックすること
   */
  clone() {
    return new Board(
      this.turn,
      this.pos[0], this.pos[1],
      this.ph_count[0], this.ph_count[1],
      this.deck_len,
      this.is_parry, this.is_jump, this.atk_count,
      this.hoju, this.winner, this.win_kind,
      this.used.clone(),
      this.use_jump);
  }

  /**
   * @return {number}   前方の空きマス数
   */
  get mae() { return this.pos[1] - this.pos[0]; }

  /**
   * @return {number}   後方の空きマス数
   */
  get ato() { return this.turn === 0? this.pos[0]: 22 - this.pos[1]; }

  /**
   * @return {boolean}  .is_parry または .is_jump が真なら真を返す
   */
  get is_attack() { return this.is_parry || this.is_jump; }

  /**
   * 破壊的: 手番を次に進める
   */
  turn_next() {
    this.turn = this.turn === 0? 1: 0;
  }


  /**
   * この Board に手札を晒す
   * @param {Te} te       出された手札を表す Te
   * @param {Hand} hand   出した手札を削除されるべき Hand オブジェクト
   */
  put_card(te, hand) {
    this.hoju = true;
    switch (te.type) {
      case Te.Resign:
        this.is_parry  = false;
        this.is_jump   = false;
        this.atk_count = 0;
        this.hoju      = false;
        // 相手の勝ち
        this.winner = this.turn === 0? Board.Win1: Board.Win0;
        break;
      case Te.Parry:
        //if (!this.is_attack) throw new Error('panic');
        this.is_parry  = false;
        this.is_jump   = false;
        this.hoju      = false;
        this.atk_count = 0;
        const mae = this.mae;
        this.used.remove(mae, te.count, 'parry, used');
        hand.remove(mae, te.count, 'parry, hand');
        break;
      case Te.Forward:
        this.pos[ this.turn ] += this.turn === 0? te.card_rank: -te.card_rank;
        this.used.remove_one(te.card_rank, `forward ${te.card_rank}, used`);
        hand.remove_one(te.card_rank, `forward ${te.card_rank}, hand(${this.turn})`);
        break;
      case Te.Backward:
        this.pos[ this.turn ] += this.turn === 0? -te.card_rank: te.card_rank;
        this.is_jump = false;
        this.atk_count = 0;
        this.used.remove_one(te.card_rank, `backward ${te.card_rank}, used`);
        hand.remove_one(te.card_rank, `backward ${te.card_rank}, hand(${this.turn})`);
        break;
      case Te.Attack:
        this.is_parry = true;
        this.atk_count = te.count;
        this.used.remove(te.card_rank, te.count, `attack ${te.card_rank}x${te.count}, used`);
        hand.remove(te.card_rank, te.count, `attack ${te.card_rank}x${te.count}, hand(${this.turn})`);
        break;
      case Te.Jump:
        this.is_jump = true;
        this.atk_count = te.count;
        this.pos[ this.turn ] += this.turn === 0? te.jump_rank: -te.jump_rank;
        this.used.remove_one(te.jump_rank, `jump ${te.jump_rank}, used`);
        this.used.remove(te.card_rank, te.count, `jump atk ${te.card_rank}x${te.count}, used`);
        hand.remove_one(te.jump_rank, `jump ${te.jump_rank}, hand(${this.turn})`);
        hand.remove(te.card_rank, te.count, `jump atk ${te.card_rank}x${te.count}, hand(${this.turn})`);
        break;
      default:
        throw new Error(`unknown type: ${te}`);
    }
  }

  /**
   * @return {string}  このオブジェクトの文字列表現
   */
  toString() {
    let s = 'Board {\n';
    s += `       turn: ${this.turn},\n`;
    s += `        pos: [${this.pos[0]}, ${this.pos[1]}],\n`;
    s += `   ph_count: [${this.ph_count[0]}, ${this.ph_count[1]}],\n`;
    s += `   deck_len: ${this.deck_len},\n`;
    s += `   is_parry: ${this.is_parry},\n`;
    s += `    is_jump: ${this.is_jump},\n`;
    s += `  atk_count: ${this.atk_count},\n`;
    s += `       hoju: ${this.hoju},\n`;
    s += `       hoju: ${this.hoju},\n`;
    s += `     winner: ${
      this.winner === Board.Game? 'now playing':
      this.winner === Board.Win0? 'player 0':
      this.winner === Board.Win1? 'player 1':
      'Draw' },\n`;
    s += `   win_kind: ${
      this.win_kind === Board.KindHand     ? 'Hand':
      this.win_kind === Board.KindPosition ? 'Position':
      'Resign' },\n`;
    s += `       used: ${this.used}\n`;
    s += `   use_jump: ${this.use_jump},\n`;
    return s + '}';
  }
}

//////////////////////////////////////////////////////////////////////////////
/**
 * 合法手のリストを算出する関数
 *
 * @param {Hand} hand    手番プレイヤーの手札
 * @param {Board} board  手番プレイヤーが見ているボード
 * @return {Array<Te>}
 */
export const calc_legal = (hand, board) => {
  /**
   * 攻撃されているとき、防御の手を返す
   * @return {Array<Te>}
   */
  const get_guard = () => {
    const lst = [];
    const p = hand.has(board.mae);
    if (p >= board.atk_count) {
      lst.push( Te.make_parry(board.mae, board.atk_count) );
    }
    if (board.is_jump) {
      const b = Math.min(5, board.ato);
      for (let rank = 1; rank <= b; ++rank) {
        if (hand.has(rank) !== 0) {
          lst.push( Te.make_backward(rank) );
        }
      }
    }
    // だめなら命中
    if (lst.length === 0) return [ Te.make_resign(Te.Penetrated) ];
    return lst;
  }
  /**
   * 攻撃が無い時の合法な手を返す
   * @return {Array<Te>}
   */
  const get_normal = () => {
    const lst = [];
    const mae = board.mae;
    // forward
    const f = Math.min(5, mae - 1); // ５と前方 - 1とで少ないほうについて
    for (let rank = 1; rank <= f; ++rank) {
      if (hand.has(rank) !== 0) {
        lst.push( Te.make_forward(rank) );
      }
    }
    // backward
    const b = Math.min(5, board.ato); // 5と後方とで少ないほうについて
    for (let rank = 1; rank <= b; ++rank) {
      if (hand.has(rank) !== 0) {
        lst.push( Te.make_backward(rank) );
      }
    }
    // attack
    if (mae <= 5) {
      const a = hand.has(mae); // 前方と等しいランクの手札があるなら
      for (let i = 1; i <= a; ++i) { // a=0 なら実行されない
        lst.push( Te.make_attack(mae, i) );
      }
    }
    // jump
    if (board.use_jump && mae >= 2 && mae <= 10) { // 2以上10マス以内なら
      hand.forEach((cnt, rank) => {
        if (cnt === 0) return; // 持ってないカードはスキップ
        if (rank * 2 == mae) {
          // 間合いが6, 3で移動3で攻撃のパターン
          if (cnt >= 2) {
            for (let i = 1; i <= cnt - 1; ++i) { // １枚差し引いた cnt だけ
              lst.push( Te.make_jump(rank, rank, i) );
            }
          }
        } else if (hand.has(mae - rank) !== 0) {
          // 間合いが5, 2で移動3で攻撃とかのパターン
          const ar = mae - rank; // rank だけ進むとして、残りのマス数
          const k = hand.has(ar); // 残りマス数に等しい手札がある
          for (let i = 1; i <= k; ++i) { // 無いなら実行されない
            lst.push( Te.make_jump(rank, ar, i) );
          }
        }
      });
    }
    // 動けないなら投了
    if (lst.length === 0) {
      return [ Te.make_resign(Te.Stucked) ];
    }
    return lst;
  }
  ///////////////////////////////////////////////////////////////
  // 合法手のリストを返す
  //if (hand.data === 0) throw new Error('zero');
  return board.is_attack? get_guard(): get_normal();
};

//////////////////////////////////////////////////////////////////////////////

/**
 * プレイヤーの行動を独立した要素として抜き出したモノ。
 */
export class Player {
  /**
   * @constructor
   * @param {string}  name      名前
   * @param {boolean} is_human  人間か
   * @param {number}  my_side   左側なら0, でなければ1
   */
  constructor(name, is_human, my_side) {
    this.name     = name;
    this.is_human = is_human;
    this.my_side  = my_side;
    // その他の設定
    this.vp    = 0;
  }
  /**
   * カードを受け取る
   * @param {number} bits
   */
  deal(bits) {
    this.hand = new Hand();
    this.hand.data = bits;
    this.on_deal(bits);
  }
  /**
   * カードを受け取ったとき呼び出される
   * @virtual
   * @param {number} bits
   */
  on_deal(bits) { }

  /**
   * 手を決定する
   * @virtual
   * @param {Board} cloned_board
   * @param {EnGarde} _eg
   * @return {Te}
   */
  think(cloned_board, _eg) {
    const lst = calc_legal(this.hand, cloned_board);
    return lst[ Math.trunc(Math.random() * lst.length) ];
  }

  /**
   * 実際のゲームから呼び出される関数
   * ここにプロミスをかませてタイミングとかいじる
   * @virtual
   * @param {Board} cloned_board
   * @param {EnGarde} eg
   * @return {Promise<Te>}
   */
  async on_turn(cloned_board, eg) {
    return new Promise(solv => {
      solv(this.think(cloned_board, eg));
    });
  }
}

//////////////////////////////////////////////////////////////////////////////

/**
 * ゲームの「ルールのみ」を管理させようと思い作ったクラス。
 * 実際には他のクラスとの連絡がうまくいかず、微妙な使い心地
 * 実際のゲームではルールとそのときの状態は弁別し難いのが普通で、１つのクラスで
 * 扱ったほうが簡単になった気がする。
 */
export class EnGarde {
  /**
   * ラウンド数など、ゲーム全体を管理
   * デッキはこのクラスに所属する。
   * また、各プレイヤーの手札や勝利点にもこのクラスを経由しなければアクセスできない。
   * Html/TUI でそれぞれ継承して改造して使う
   *
   * @constructor
   * @param {Player} human
   * @param {Player} cpu
   * @param {Rand}   rnd
   * @param {boolean} [use_jump]
  */
  constructor(human, cpu, rnd, use_jump=true) {
    this.players = [human, cpu]; // 手札と得点はここに
    this.rnd = rnd;
    this.use_jump = use_jump;
    // this.deck
    // this.board
    //
    this.start_player = rnd.rand(2);
  }
  /**
   * @param {number} n
   * @return {number} nより小さい乱数
   */
  rand(n) { return this.rnd.rand(n); }
  /**
   * @return {Player} プレイヤー０を返す
   */
  get p0() { return this.players[0]; }
  /**
   * @return {Player} プレイヤー１を返す
   */
  get p1() { return this.players[1]; }
  /**
   * @return {Player} 手番プレイヤーを返す
   */
  get teban() { return this.players[this.board.turn]; }
  /**
   * @return {Player} 相手プレイヤーを返す
   */
  get aite() { return this.players[this.board.turn === 0? 1: 0]; }

  /**
   * 手札がプレイされたときの処理
   * @param {Te} te     プレイされた手
   * @return {boolean}  偽なら１ゲーム終了
   */
  play(te) {
    /*
    if ((this.board.used & ~this.players[0].hand.data) &
      ~this.players[1].hand.data !== this.deck.data) throw new Error('panic');
      */
    if (this.board.winner !== Board.Game)
      throw new Error('決着済なのにplayが呼ばれた');
    //
    if (te.type == Te.Resign) {
      //this.board.resign();
      this.board.put_card(te, this.teban.hand);
      //
      this.board.win_kind = Board.KindResign;
      return false; // ゲーム終了
    } else {
      const old_jump = this.board.is_jump;
      this.board.is_attack? this.play_guard(te): this.play_normal(te);
      // 補充がオフ => Parry した直後でも、デッキが空ならそこで終了処理
      if (this.board.hoju || this.deck.length === 0) {
        // 手札を補充
        const n = Math.min( 5 - this.teban.hand.length, this.deck.length );
        if (this.board.hoju && n !== 0) {
          this.teban.hand.add_card_bits(this.deck.deal_n(this.rnd, n));
          this.board.deck_len = this.deck.length;
          this.board.ph_count[0] = this.players[0].hand.length;
          this.board.ph_count[1] = this.players[1].hand.length;
        }
        // 補充の結果山札が枯れたら、攻撃状態でない限りディール終了
        // => 攻撃だったら手番はまだ続く
        if (this.deck.length === 0 && !this.board.is_attack) {
          // 引き分けになるのは win_kind が KindPosition のときだけ
          // セットしておく
          this.board.win_kind = Board.KindPosition;
          //
          // 最後が移動攻撃に対する後退でない限り手札判定する
          //
          if (!(old_jump && te.type === Te.Backward)) {
            const mae = this.board.mae;
            const p0c = this.p0.hand.has(mae); // 間合いに等しい手札の枚数
            const p1c = this.p1.hand.has(mae);
            this.board.winner = p0c > p1c? Board.Win0:
              p1c > p0c? Board.Win1: Board.Game; // 決着しないかも
            if (this.board.winner !== Board.Game) {
              // 手札判定が成立したので記録しておく
              this.board.win_kind = Board.KindHand;
            }
          }
          // 手札判定で決着がつかなければ位置判定
          if (this.board.winner === Board.Game) {
            const p0c = this.board.pos[0];
            const p1c = 22 - this.board.pos[1];
            this.board.winner = p0c > p1c? Board.Win0:
              p1c > p0c? Board.Win1: Board.Draw; // 引き分けが有りうる
          }
          return false; // ゲーム終了
        } else {
          // 山札がまだあるか攻撃中なら手番をチェンジ
          this.board.turn_next();
        }
      }
      /*
      else {
        parry したときは補充なしで、手番はそのまま
        次の手番では 攻撃フラグが off => hoju フラグが立つので
        手番終了したら上の処理で手札が補充される
      }
      */
    }
    // ゲーム続行なら手札枚数の情報を更新
    this.board.ph_count[0] = this.players[0].hand.length;
    this.board.ph_count[1] = this.players[1].hand.length;
    return true;
  }

  /**
   * 防御の手札がプレイされたときの処理
   * @param {Te} te     プレイされた手
   */
  play_guard(te) {
    if (te.type === Te.Parry && this.board.atk_count === te.count) {
      //this.board.parry();
      //this.players[this.board.turn].hand.remove(te.card_rank, te.count, 'play_g parry, hand');
      this.board.put_card(te, this.teban.hand);
    } else if (this.board.is_jump && te.type === Te.Backward && this.board.ato >= te.card_rank) {
      //this.board.backward(te.card_rank);
      //this.players[this.board.turn].hand.remove_one(te.card_rank, 'play_g bk, hand');
      this.board.put_card(te, this.teban.hand);
    } else {
      throw new Error(`guard - 無効な手: ${te}`);
    }
  }

  /**
   * 通常状態で手札がプレイされたときの処理
   * @param {Te} te     プレイされた手
   */
  play_normal(te) {
    this.board.hoju = true;
    if (te.type === Te.Forward && this.board.mae - 1 >= te.card_rank) {
      //this.board.forward(te.card_rank);
      //this.players[this.board.turn].hand.remove_one(te.card_rank, 'play_n fd, hand');
      this.board.put_card(te, this.teban.hand);
    } else if (te.type === Te.Backward && this.board.ato >= te.card_rank) {
      //this.board.backward(te.card_rank);
      //this.players[this.board.turn].hand.remove_one(te.card_rank, 'play_n bk, hand');
      this.board.put_card(te, this.teban.hand);
    } else if (te.type === Te.Attack && this.board.mae === te.card_rank) {
      //this.board.attack(te.count);
      //this.players[this.board.turn].hand.remove(te.card_rank, te.count, 'play_n atk, hand');
      this.board.put_card(te, this.teban.hand);
    } else if (te.type === Te.Jump && this.board.mae === te.card_rank + te.jump_rank) {
      //this.board.jump(te.jump_rank, te.count);
      //this.players[this.board.turn].hand.remove_one(te.jump_rank, 'play_n jump_rank, hand');
      //this.players[this.board.turn].hand.remove(te.card_rank, te.count, 'play_n jump atk, hand');
      this.board.put_card(te, this.teban.hand);
    } else {
      throw new Error(`normal - 無効な手: ${te}`);
    }
  }

  /**
   * play(なにかの手) が偽を返したら(=そのディールが終了したら）呼ぶ
   * @return {number} どちらかが５ｖｐ得たら勝者を返す：
   *                  play(te) と違い、返却値は boolean ではなくて number
   *                  => 返却値が Board.Game でなければ終わり
   */
  deal_end() {
    if (this.board.winner === Board.Game)
      throw new Error('ゲーム中なのに精算処理が呼ばれた');
    // 勝利を記録
    if (this.board.winner !== Board.Draw) {
      this.players[ this.board.winner ].vp += 1;
      if (this.players[ this.board.winner ].vp === 5)
        return this.board.winner; // 5vp 取った
    }
    // 続行
    return Board.Game;
  }

  /**
   * 最初に or 新たに   いずれにしろディールを始めるとき呼ぶ
   */
  deal_start() {
    this.start_player = this.start_player == 0? 1: 0;
    //
    this.board = new Board(this.start_player);
    if (!this.use_jump) this.board.use_jump = false;
    this.deck  = new Deck();
    // deal
    this.p0.deal( this.deck.deal_n(this.rnd, 5) );
    this.p1.deal( this.deck.deal_n(this.rnd, 5) );
  }

  /**
   * 継承先で上書きされると期待されるmain関数
   * @virtual
   */
  async game_loop() { }
}


