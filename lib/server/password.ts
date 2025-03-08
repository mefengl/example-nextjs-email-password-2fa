/**
 * 密码管理模块 - Password Management Module
 * 
 * 这个模块负责处理与密码相关的所有安全操作，包括：
 * - 使用Argon2算法进行密码哈希
 * - 验证密码是否匹配已存储的哈希值
 * - 检查密码强度，包括使用"Have I Been Pwned"服务验证密码是否曾被泄露
 * 
 * Argon2是目前最安全的密码哈希算法之一，专为抵抗各种攻击而设计，
 * 包括暴力破解、字典攻击、彩虹表攻击和硬件加速攻击。
 */

import { hash, verify } from "@node-rs/argon2";
import { sha1 } from "@oslojs/crypto/sha1";
import { encodeHexLowerCase } from "@oslojs/encoding";

/**
 * 对密码进行哈希处理
 * 
 * 使用Argon2id算法，这是Argon2的一个变种，结合了Argon2i和Argon2d的优点：
 * - 内存成本(memoryCost): 19456 KiB (约19MB)，增加内存使用使暴力破解更困难
 * - 时间成本(timeCost): 2 次迭代，增加计算时间
 * - 输出长度(outputLen): 32 字节(256位)哈希
 * - 并行度(parallelism): 1 线程
 * 
 * 这些参数提供了良好的安全性和性能平衡，使密码哈希既安全又不会过度延迟用户体验。
 * 
 * @param password 要哈希的原始密码
 * @returns 哈希后的密码字符串，格式符合Argon2标准，包含算法版本、参数和哈希值
 */
export async function hashPassword(password: string): Promise<string> {
	return await hash(password, {
		memoryCost: 19456, // 内存成本：19MB
		timeCost: 2,       // 迭代次数
		outputLen: 32,     // 输出哈希长度：32字节
		parallelism: 1     // 并行度：单线程
	});
}

/**
 * 验证密码是否匹配哈希值
 * 
 * 在用户登录时使用此函数验证提供的密码是否匹配存储的哈希值。
 * Argon2的verify函数会自动从哈希字符串中提取参数，因此无需手动指定。
 * 
 * @param hash 从数据库中检索到的密码哈希
 * @param password 用户提供的密码
 * @returns 如果密码匹配哈希值则返回true，否则返回false
 */
export async function verifyPasswordHash(hash: string, password: string): Promise<boolean> {
	return await verify(hash, password);
}

/**
 * 验证密码强度
 * 
 * 这个函数通过两种方式验证密码强度：
 * 1. 检查基本要求（长度在8到255个字符之间）
 * 2. 使用"Have I Been Pwned"API检查密码是否已知被泄露
 * 
 * "Have I Been Pwned"的API使用k-匿名模型，保护用户隐私：
 * - 只发送密码SHA1哈希的前5个字符给API
 * - 服务器返回所有匹配这些前5个字符的哈希后缀
 * - 在客户端比较完整哈希，这样完整密码或完整哈希永远不会发送到服务器
 * 
 * @param password 要验证的密码
 * @returns 如果密码强度足够且未曾泄露则返回true，否则返回false
 */
export async function verifyPasswordStrength(password: string): Promise<boolean> {
	// 检查密码长度是否符合要求
	if (password.length < 8 || password.length > 255) {
		return false;
	}
	
	// 计算密码的SHA1哈希（Have I Been Pwned API使用SHA1）
	const hash = encodeHexLowerCase(sha1(new TextEncoder().encode(password)));
	const hashPrefix = hash.slice(0, 5); // 获取哈希前缀（前5个字符）
	
	// 查询Have I Been Pwned API
	const response = await fetch(`https://api.pwnedpasswords.com/range/${hashPrefix}`);
	const data = await response.text();
	
	// 分析API返回的哈希后缀列表
	const items = data.split("\n");
	for (const item of items) {
		const hashSuffix = item.slice(0, 35).toLowerCase(); // 从API响应中提取哈希后缀
		if (hash === hashPrefix + hashSuffix) {
			return false; // 密码已被泄露，不安全
		}
	}
	
	return true; // 密码符合长度要求且未见于已知泄露数据库
}
