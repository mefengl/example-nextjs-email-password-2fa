/**
 * 请求速率限制模块 - Request Rate Limiting Module
 * 
 * 这个模块负责对HTTP请求应用速率限制，防止服务器被大量请求淹没：
 * - 基于客户端IP地址进行限制
 * - 为不同类型的请求(GET、POST)应用不同的限制策略
 * - 使用RefillingTokenBucket实现，允许请求在时间内分配均匀
 * 
 * 速率限制是防御多种攻击的第一道防线，例如：
 * - 分布式拒绝服务攻击(DDoS)
 * - 爬虫滥用
 * - API滥用
 * - 自动化攻击工具
 */

import { headers } from "next/headers";
import { RefillingTokenBucket } from "./rate-limit";

/**
 * 全局请求速率限制桶
 * 
 * 为所有客户端IP地址共享的限流器：
 * - 每秒最多添加1个令牌
 * - 每个IP地址最多可以累积100个令牌
 * 
 * 这意味着客户端可以短时间内发送突发请求（最多100个），
 * 但长期来看平均每秒只能发送1个请求。
 */
export const globalBucket = new RefillingTokenBucket<string>(100, 1);

/**
 * 全局GET请求速率限制
 * 
 * 对GET请求应用速率限制：
 * - 每个GET请求消耗1个令牌
 * - 基于客户端的IP地址进行限制
 * - 如果无法获取IP地址，则放行请求（但应避免这种情况）
 * 
 * GET请求通常是只读操作，威胁较小，因此令牌消耗较低。
 * 
 * @returns 如果请求被允许则返回true，否则返回false
 */
export function globalGETRateLimit(): boolean {
    // 注意：假设X-Forwarded-For总是被定义
    // 在生产环境中，应该由前端代理（如Nginx）设置此头部
    const clientIP = headers().get("X-Forwarded-For");
    
    if (clientIP === null) {
        return true; // 如果无法获取IP，允许请求（不应发生）
    }
    
    return globalBucket.consume(clientIP, 1); // 每个GET请求消耗1个令牌
}

/**
 * 全局POST请求速率限制
 * 
 * 对POST请求应用更严格的速率限制：
 * - 每个POST请求消耗3个令牌
 * - 基于客户端的IP地址进行限制
 * - 如果无法获取IP地址，则放行请求（但应避免这种情况）
 * 
 * POST请求通常会修改数据或执行敏感操作，因此消耗更多令牌。
 * 这意味着客户端平均每3秒才能发送1个POST请求。
 * 
 * @returns 如果请求被允许则返回true，否则返回false
 */
export function globalPOSTRateLimit(): boolean {
    // 注意：假设X-Forwarded-For总是被定义
    const clientIP = headers().get("X-Forwarded-For");
    
    if (clientIP === null) {
        return true; // 如果无法获取IP，允许请求（不应发生）
    }
    
    return globalBucket.consume(clientIP, 3); // 每个POST请求消耗3个令牌
}
