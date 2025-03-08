/**
 * 速率限制模块 - Rate Limiting Module
 * 
 * 这个模块实现了多种速率限制算法，用于保护应用程序免受滥用和暴力攻击：
 * 1. RefillingTokenBucket（自动填充令牌桶）- 以固定速率恢复令牌的限流器
 * 2. ExpiringTokenBucket（有过期时间的令牌桶）- 在固定时间后完全重置的限流器
 * 3. Throttler（递增延迟节流器）- 随着请求次数增加而增加延迟时间的限流器
 * 
 * 速率限制是Web安全的重要组成部分，可防止：
 * - 暴力密码破解尝试
 * - 账户枚举攻击
 * - 拒绝服务攻击
 * - API滥用
 */

/**
 * 自动填充令牌桶实现
 * 
 * 工作原理：
 * - 每个键（如用户ID或IP地址）维护一个令牌桶
 * - 桶有最大令牌数量(max)
 * - 桶以固定速率自动填充令牌(refillIntervalSeconds)
 * - 每次操作消耗一定数量的令牌
 * - 如果桶中令牌不足，操作被拒绝
 * 
 * 适用于需要以固定速率限制操作的场景，如API调用限制。
 * 
 * @template _Key 桶的键类型，可以是任何类型（如字符串、数字等）
 */
export class RefillingTokenBucket<_Key> {
    /** 桶中的最大令牌数量 */
    public max: number;
    /** 每隔多少秒添加一个令牌 */
    public refillIntervalSeconds: number;
    
    /**
     * 创建一个新的自动填充令牌桶
     * 
     * @param max 桶中的最大令牌数量
     * @param refillIntervalSeconds 每隔多少秒添加一个令牌
     */
    constructor(max: number, refillIntervalSeconds: number) {
        this.max = max;
        this.refillIntervalSeconds = refillIntervalSeconds;
    }
    
    /** 存储所有桶的映射表 */
    private storage = new Map<_Key, RefillBucket>();
    
    /**
     * 检查是否有足够的令牌可用，但不消耗令牌
     * 
     * @param key 桶的唯一标识键
     * @param cost 需要消耗的令牌数量
     * @returns 如果有足够的令牌则返回true，否则返回false
     */
    public check(key: _Key, cost: number): boolean {
        const bucket = this.storage.get(key) ?? null;
        if (bucket === null) {
            return true; // 如果桶不存在，则允许操作
        }
        
        const now = Date.now();
        // 计算自上次补充以来应该添加的令牌数量
        const refill = Math.floor((now - bucket.refilledAt) / (this.refillIntervalSeconds * 1000));
        
        if (refill > 0) {
            // 如果有令牌应该被添加，计算理论上的令牌数量（不实际添加）
            return Math.min(bucket.count + refill, this.max) >= cost;
        }
        
        // 否则只检查当前令牌数量
        return bucket.count >= cost;
    }
    
    /**
     * 尝试消耗指定数量的令牌
     * 
     * @param key 桶的唯一标识键
     * @param cost 需要消耗的令牌数量
     * @returns 如果成功消耗则返回true，否则返回false
     */
    public consume(key: _Key, cost: number): boolean {
        let bucket = this.storage.get(key) ?? null;
        const now = Date.now();
        
        // 如果桶不存在，创建一个新桶
        if (bucket === null) {
            bucket = {
                count: this.max - cost, // 从最大值减去消耗量
                refilledAt: now
            };
            this.storage.set(key, bucket);
            return true;
        }
        
        // 计算自上次补充以来应该添加的令牌数量
        const refill = Math.floor((now - bucket.refilledAt) / (this.refillIntervalSeconds * 1000));
        
        // 更新令牌数量和最后补充时间
        bucket.count = Math.min(bucket.count + refill, this.max);
        bucket.refilledAt = now;
        
        // 检查是否有足够的令牌
        if (bucket.count < cost) {
            return false; // 令牌不足，拒绝请求
        }
        
        // 消耗令牌并更新桶
        bucket.count -= cost;
        this.storage.set(key, bucket);
        return true;
    }
}

/**
 * 递增延迟节流器实现
 * 
 * 工作原理：
 * - 每次请求后，下一次允许的请求时间会增加
 * - 延迟时间按照提供的超时数组递增
 * - 可用于随着尝试次数增加而增加惩罚力度
 * 
 * 适用于需要随着失败尝试增加而延长等待时间的场景，如登录失败。
 * 
 * @template _Key 节流器的键类型
 */
export class Throttler<_Key> {
    /** 超时时间数组（秒），每个级别对应的等待时间 */
    public timeoutSeconds: number[];
    /** 存储所有节流计数器的映射表 */
    private storage = new Map<_Key, ThrottlingCounter>();
    
    /**
     * 创建一个新的递增延迟节流器
     * 
     * @param timeoutSeconds 超时时间数组（秒），按照级别递增
     */
    constructor(timeoutSeconds: number[]) {
        this.timeoutSeconds = timeoutSeconds;
    }
    
    /**
     * 尝试执行一次操作，如果频率过高则拒绝
     * 
     * @param key 节流器的唯一标识键
     * @returns 如果允许操作则返回true，否则返回false
     */
    public consume(key: _Key): boolean {
        let counter = this.storage.get(key) ?? null;
        const now = Date.now();
        
        // 如果计数器不存在，创建一个新计数器
        if (counter === null) {
            counter = {
                timeout: 0, // 初始级别为0
                updatedAt: now
            };
            this.storage.set(key, counter);
            return true;
        }
        
        // 检查是否已经过了当前级别的等待时间
        const allowed = now - counter.updatedAt >= this.timeoutSeconds[counter.timeout] * 1000;
        
        if (!allowed) {
            return false; // 等待时间未到，拒绝请求
        }
        
        // 更新计数器：更新时间戳并增加级别（但不超过最大级别）
        counter.updatedAt = now;
        counter.timeout = Math.min(counter.timeout + 1, this.timeoutSeconds.length - 1);
        this.storage.set(key, counter);
        return true;
    }
    
    /**
     * 重置指定键的节流状态
     * 
     * @param key 要重置的键
     */
    public reset(key: _Key): void {
        this.storage.delete(key);
    }
}

/**
 * 有过期时间的令牌桶实现
 * 
 * 工作原理：
 * - 桶有最大令牌数量(max)和固定的过期时间(expiresInSeconds)
 * - 不像RefillingTokenBucket逐渐恢复，而是在过期后完全重置
 * - 在过期前，令牌耗尽后将无法执行操作
 * 
 * 适用于限制在固定时间窗口内的操作次数，如"10分钟内最多5次尝试"。
 * 
 * @template _Key 桶的键类型
 */
export class ExpiringTokenBucket<_Key> {
    /** 桶中的最大令牌数量 */
    public max: number;
    /** 桶的过期时间（秒） */
    public expiresInSeconds: number;
    /** 存储所有桶的映射表 */
    private storage = new Map<_Key, ExpiringBucket>();
    
    /**
     * 创建一个新的有过期时间的令牌桶
     * 
     * @param max 桶中的最大令牌数量
     * @param expiresInSeconds 桶的过期时间（秒）
     */
    constructor(max: number, expiresInSeconds: number) {
        this.max = max;
        this.expiresInSeconds = expiresInSeconds;
    }
    
    /**
     * 检查是否有足够的令牌可用，但不消耗令牌
     * 
     * @param key 桶的唯一标识键
     * @param cost 需要消耗的令牌数量
     * @returns 如果有足够的令牌则返回true，否则返回false
     */
    public check(key: _Key, cost: number): boolean {
        const bucket = this.storage.get(key) ?? null;
        const now = Date.now();
        
        if (bucket === null) {
            return true; // 如果桶不存在，则允许操作
        }
        
        // 检查桶是否已过期
        if (now - bucket.createdAt >= this.expiresInSeconds * 1000) {
            return true; // 桶已过期，允许操作
        }
        
        // 检查是否有足够的令牌
        return bucket.count >= cost;
    }
    
    /**
     * 尝试消耗指定数量的令牌
     * 
     * @param key 桶的唯一标识键
     * @param cost 需要消耗的令牌数量
     * @returns 如果成功消耗则返回true，否则返回false
     */
    public consume(key: _Key, cost: number): boolean {
        let bucket = this.storage.get(key) ?? null;
        const now = Date.now();
        
        // 如果桶不存在，创建一个新桶
        if (bucket === null) {
            bucket = {
                count: this.max - cost, // 从最大值减去消耗量
                createdAt: now
            };
            this.storage.set(key, bucket);
            return true;
        }
        
        // 检查桶是否已过期
        if (now - bucket.createdAt >= this.expiresInSeconds * 1000) {
            bucket.count = this.max; // 桶已过期，重置令牌数量
        }
        
        // 检查是否有足够的令牌
        if (bucket.count < cost) {
            return false; // 令牌不足，拒绝请求
        }
        
        // 消耗令牌并更新桶
        bucket.count -= cost;
        this.storage.set(key, bucket);
        return true;
    }
    
    /**
     * 重置指定键的桶状态
     * 
     * @param key 要重置的键
     */
    public reset(key: _Key): void {
        this.storage.delete(key);
    }
}

/**
 * 自动填充令牌桶的数据结构
 */
interface RefillBucket {
    /** 当前令牌数量 */
    count: number;
    /** 上次补充令牌的时间（毫秒时间戳） */
    refilledAt: number;
}

/**
 * 有过期时间的令牌桶的数据结构
 */
interface ExpiringBucket {
    /** 当前令牌数量 */
    count: number;
    /** 桶创建时间（毫秒时间戳） */
    createdAt: number;
}

/**
 * 递增延迟节流器的数据结构
 */
interface ThrottlingCounter {
    /** 当前超时级别（对应timeoutSeconds数组的索引） */
    timeout: number;
    /** 上次更新时间（毫秒时间戳） */
    updatedAt: number;
}
