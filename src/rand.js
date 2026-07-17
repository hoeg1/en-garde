// シードで再現可能な疑似乱数生成器を定義

/**
 * @return {number}  疑似乱数生成器のために適当な初期値（１以上の自然数）を作る
 */
export const sys_rand_int = () => Math.trunc(Math.random() * 12345678) + 1;

/**
 * 疑似乱数生成器
 */
export class Rand {
/**
 * 疑似乱数生成器をつくる
 * 引数を指定しなければjsが提供する適当な乱数が設定される
 * @constructor
 * @param {number} [seed] 乱数の種
 */
  constructor(seed=sys_rand_int()) {
    this.seed = seed;
    this.x = 123456789;
    this.y = 362436069;
    this.z = 521288629;
    this.w = seed;
  }
  /**
   * ゼロ以上の整数で疑似乱数を返す
   * @returns {number} - 0~INT_MAX
   */
  next() {
    const t = this.x ^ (this.x << 11);
    this.x = this.y;
    this.y = this.z;
    this.z = this.w;
    this.w = (this.w ^ (this.w >>> 19)) ^ (t ^ (t >>> 8));
    return (this.w >>> 0) - 1;
  }
  /**
   * 実数の乱数を返す
   * @returns {number} - 0~1
   */
  random() {
    return this.next() / 0xffffffff;
  }
  /**
   * ゼロから自然数nまでの乱数を返す
   * n がゼロなら除算エラーだし、ゼロ以下のときは知らん
   * @param {number} n - 正の整数
   * @returns {number} - 0 <= x < n; つまり n より小さい正の整数 or ゼロ
   */
  rand(n) {
    return this.next() % n;
  }
  /**
   * 与えられた配列を破壊的にシャッフルして返す
   * 戻り値を使っても使わなくても引数に与えられた配列は順序が変わる
   * @param {Array} ary - ターゲットの配列
   * @returns {Array} - シャッフルした ary
   */
  shuffle(ary) {
    for (let i = ary.length - 1; i > 0; --i) {
      const r = this.rand( i + 1 );
      [ary[i], ary[r]]  =  [ary[r], ary[i]];
    }
    return ary;
  }
  /**
   * 配列をスプレッド構文で表面的に複製し、複製したそれをシャッフルして返す
   * @param {Array} ary - ターゲットの配列
   * @returns {Array} - ary とは別のシャッフルした配列を返す
   */
  to_shuffled(orig_ary) {
    return this.shuffle([...orig_ary]);
  }

  /**
   * 与えられた配列 ary から適当にひとつを選んで返す
   * @param {Array<any>} ary
   * @return {any}
   */
  sel_one(ary) {
    return ary[ this.rand(ary.length) ];
  }

  /**
   * @return {string}  シードを /^0x[0-9A-F]+$/ にマッチする16進数文字列で返す
   */
  toString() {
    return `0x${this.seed.toString(16).toUpperCase()}`;
  }
}


