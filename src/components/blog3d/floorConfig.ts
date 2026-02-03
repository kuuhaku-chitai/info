/**
 * 床（空間）の設定
 *
 * 3D空間の床サイズとマージンを定義。
 * 記事ポリゴンやGLBキャラクターはこの境界内に制限される。
 */

// 床の実サイズ
export const FLOOR_SIZE = {
  width: 20,  // X方向
  depth: 10,  // Z方向
};

// マージン（床サイズの1/10）
export const FLOOR_MARGIN = {
  x: FLOOR_SIZE.width * 0.1,  // 2
  z: FLOOR_SIZE.depth * 0.1,  // 1
};

// 有効境界（マージンを考慮した領域）
export const FLOOR_BOUNDS = {
  x: {
    min: -FLOOR_SIZE.width / 2 + FLOOR_MARGIN.x,  // -8
    max: FLOOR_SIZE.width / 2 - FLOOR_MARGIN.x,   // 8
  },
  z: {
    min: -FLOOR_SIZE.depth / 2 + FLOOR_MARGIN.z,  // -4
    max: FLOOR_SIZE.depth / 2 - FLOOR_MARGIN.z,   // 4
  },
};

// 床のY位置
export const FLOOR_Y = -2;

// 天井の高さ
export const CEILING_Y = 4;
