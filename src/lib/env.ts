import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * 環境変数を安全に取得するユーティリティ
 * 
 * 1. process.env (Node.js/ローカル開発)
 * 2. getCloudflareContext().env (Cloudflare Workers/本番環境)
 * 
 * の順で検索し、最初に見つかった値を返す。
 */
export async function getEnv(key: string): Promise<string | undefined> {
    // 1. process.env から取得
    const processValue = process.env[key];
    if (processValue) return processValue;

    // 2. Cloudflare Context から取得
    try {
        const context = getCloudflareContext();
        const envValue = (context.env as unknown as Record<string, unknown>)[key];
        if (typeof envValue === 'string') return envValue;
    } catch (error) {
        // Contextが取得できない環境（ローカル実行時など）
    }

    return undefined;
}
