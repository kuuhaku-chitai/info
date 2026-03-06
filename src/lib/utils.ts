
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
