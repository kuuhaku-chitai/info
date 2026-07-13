
/**
 * スライド分割の区切り記法。
 * マークダウン中で単独行に `/--/` を書くと、その位置でページが分割される。
 * 「縦に積む」のではなく「横に移す」ことで、コンセプトの"余白を渡り歩く"体験を作る。
 */
export const SLIDE_DELIMITER = /^[ \t]*\/--\/[ \t]*$/m;

/**
 * マークダウンを `/--/` 区切りでスライド単位に分割する。
 * 区切りが無い（＝従来のページ）場合は要素1つの配列を返すので、表示側は後方互換を保てる。
 * 空のスライド（連続区切り・先頭末尾の区切り）は除去する。
 */
export function splitSlides(markdown: string): string[] {
    const slides = markdown
        .split(SLIDE_DELIMITER)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    // すべて空だった場合でも、元のテキストをそのまま1枚として返す
    return slides.length > 0 ? slides : [markdown];
}

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

/**
 * Markdownからプレーンテキストを抽出する
 * 一覧ページの抜粋やOG descriptionなど、装飾なしのテキストが必要な場面で使用
 *
 * @param markdown - 生のMarkdown文字列
 * @param maxLength - 最大文字数（デフォルト: 100）
 */
export function stripMarkdown(markdown: string, maxLength = 100): string {
    const plain = markdown
        // 画像: ![alt](url) → alt
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        // リンク: [text](url) → text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        // 見出し: ## text → text
        .replace(/^#{1,6}\s+/gm, '')
        // 太字・斜体: **text** / *text* / __text__ / _text_
        .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, '$2')
        // 取り消し線: ~~text~~
        .replace(/~~(.+?)~~/g, '$1')
        // インラインコード: `code`
        .replace(/`([^`]+)`/g, '$1')
        // コードブロック: ```...```
        .replace(/```[\s\S]*?```/g, '')
        // 引用: > text → text
        .replace(/^>\s+/gm, '')
        // リストマーカー: - / * / 1.
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // 水平線: --- / ***
        .replace(/^[-*_]{3,}\s*$/gm, '')
        // HTMLタグ
        .replace(/<[^>]+>/g, '')
        // 連続する空白・改行を半角スペースに
        .replace(/\s+/g, ' ')
        .trim();

    if (plain.length <= maxLength) return plain;
    return plain.slice(0, maxLength) + '...';
}
