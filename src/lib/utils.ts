
/**
 * 画像URLを最適化する
 * ローカル開発環境での絶対パス（localhost:9000）をプロキシパス（/images）に置換
 * これにより、モバイル端末などからアクセスした場合でも画像が表示されるようになる
 */
export function getOptimizedImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    // 文字列でない場合は空文字を返す
    if (typeof url !== 'string') return '';

    // localhost:9000を含むURLを検出して置換
    return url.replace('http://localhost:9000/kuuhaku-chitai-images', '/images');
}
