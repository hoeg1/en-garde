// CPU対戦用の基本形を定義
// このファイルの Lv0 を他のCPUの雛形にする

import {
  Player, Board, calc_legal, Hand,
  Te,
} from "../engarde.js";

import { Rand } from "../rand.js";

//////////////////////////////////////////////////////////////////////////////

/**
 * CPUの名前リスト
 * 選ばれた名前から適当なパラメータ seikaku を算出する
 * @const
 * @type {Array<string>}
 */
const NAMES = ['宮本武蔵','佐々木小次郎',
  '上泉信綱','塚原卜伝','足利義輝','源義経',
  '沖田総司','斎藤一','永倉新八','土方歳三','近藤勇',
  'フィオレ・リベリ', 'Ｄ・マクベイン',
  'リヒテンアウア', 'マッド・ジャック','聖ジョルジュ',
  'Ｊ・ドヴィーニ', 'ランスロット','アーサー王',
];

//////////////////////////////////////////////////////////////////////////////

// 使えそうな関数をいくつか定義しておく

/**
 * 組み合わせの総数を計算 nCr = n!/r!(n-r)!
 * @param  {number} n  n個から
 * @param  {number} r  r個を選ぶ
 * @return {number} 組み合わせの総数
 */
export const nCr = (n, r) => {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  if (r > n / 2) r = n - r; // 対称性により計算量を減らす
  let num = 1;
  let den = 1;
  for (let i = 0; i < r; ++i) {
    num *= (n - 1);
    den *= (i + 1);
  }
  return Math.trunc(num / den);
};

/**
 * 各ランクについて、n枚の手札にそれが少なくとも1枚含まれる確率を配列で返す
 * ※という要求に Gemini が作ってくれた全然動かないコードをコメント文を参考に
 *     ざっと手直し。TODO: たぶん正しいと思うけどテストしてない
 * @param {number} n       手札の枚数
 * @param {Hand} deck      あり得るデッキの状態(board.used)
 * @return {Array<number>} 各ランクの確率(1 >= x)が入った長さ6の配列 (0番目は0)
 */
export const calc_prob_for_rank = (n, deck) => {
  const deck_len = deck.length;
  if (deck_len === 0) return [0, 0, 0, 0, 0, 0]; // 0番目はダミー
  // 全体からn枚選ぶ組み合わせ
  const total_comb = nCr(deck_len, n);
  // 計算
  return deck.map((cnt, i) => {
    if (i === 0) return 0; // ダミーは飛ばす
    // 対象ランク(1-5)を「1枚も選ばない」組み合わせの数
    const not_in_comb = nCr(deck_len - cnt, n);
    // 対象ランクが少なくとも1枚含まれる確率 = 1 - (1枚も含まれない確率)
    //   => 1枚も含まれない確率 = 1枚も選ばない組み合わせ / すべての組み合わせ
    return 1.0 - (not_in_comb / total_comb);
  });
};


//////////////////////////////////////////////////////////////////////////////
// CPUの雛形を定義

/**
 * 最も原始的な対戦相手として、ほぼ乱数で行動を決めるCPUプレイヤーを定義する。
 * このプレイヤーはコンストラクタに乱数装置を要求し、それを使って自分の名前を
 * ランダムに名乗る。
 * また、選んだ名前に応じた適当な値を「this.seikaku = 性格」として保持する。
 */
export default class Lv0 extends Player {
  /**
   * @constructor
   * @param {Rand} rnd         命名するため乱数を使う
   * @param {number} my_side   左側なら0, 右側なら1
   */
  constructor(rnd, my_side) {
    const name = rnd.sel_one(NAMES);
    super( name , false, my_side);
    // 1~1000
    const a = name.split().reduce((a, ch) => a + ch.charCodeAt(0), 0) % 1000 + 1;
    // 0~1
    this.seikaku = a * 0.001;
    // 疑似乱数も使いたいから（念のため新規に）作っておく
    this.rnd = new Rand(rnd.rand(123456789)+1);
  }

  /**
   * この関数を上書きする形でより強いCPUを作る。
   * バグるときは board が本当にクローンか調べること（気づかず１日無駄にした）。
   * また、thinkの中で board.used をいじるときはビット演算を使わないようにする
   * （そのせいで追加の１日を無駄にした）。
   *
   * @param {Board} board - 現在のゲームの状態: クローンなので破壊してよい。
   *                        ここに含まれる used も気軽に破壊可能なことに注意。
   * @return {Te}         - 打つ手(Te)。基本的に合法と信じ実行される点に注意。
   *                        特に、打つ手を作るための Te.make_jump は
   *                        board.use_jump == true のときしか合法でない。
   *                        無意味なバグに悩みたくないなら calc_legal のリスト
   *                        から候補を絞って手を返すこと。
   *                        calc_legal は投了を含め少なくとも要素数１の合法な
   *                        リストを返す。
   */
  think(board) {
    // 合法手のリストを取得: Array<Te>, 要素数は最低でも 1
    const legal = calc_legal(this.hand, board);
    if (legal.length === 1) return legal[0]; // 他に選択肢が無いならそれ。
    //
    // もし攻撃して勝てるなら勝ちに行く。候補が複数あるなら適当に１つ選ぶ
    const atk = legal.filter(te=>te.type === Te.Attack &&
      te.count > board.used.has(te.card_rank) - te.count);
    if (atk.length !== 0) return this.rnd.sel_one(atk);
    // 特に勝てそうも無いなら無条件に移動攻撃を試す
    if (board.use_jump) {
      const jmp = legal.filter(te=>te.type === Te.Jump);
      if (jmp.length !== 0) return this.rnd.sel_one(jmp);
    }
    // それも無理なら乱数で適当な１手を選ぶ
    return this.rnd.sel_one(legal);
  }
}

