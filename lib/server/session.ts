/**
 * 会话管理模块 - Session Management Module
 * 
 * 这个模块负责处理用户会话的所有功能，包括：
 * - 创建会话并生成会话令牌
 * - 验证会话令牌的有效性
 * - 管理会话的过期和续期
 * - 管理两因素认证(2FA)状态
 * - 处理用户会话的cookie设置
 * 
 * 会话是保持用户登录状态的关键机制。每次验证会话令牌时，
 * 系统会检查令牌是否有效，是否过期，并在必要时自动延长会话生命周期。
 */

import { db } from "./db";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { cookies } from "next/headers";
import { cache } from "react";

import type { User } from "./user";

/**
 * 验证会话令牌的有效性
 * 
 * 工作流程：
 * 1. 将令牌转换为会话ID（使用SHA-256哈希）
 * 2. 在数据库中查找此会话ID
 * 3. 如果找到会话，同时获取关联的用户信息
 * 4. 检查会话是否已过期：
 *    - 如果已过期，删除会话并返回无效结果
 *    - 如果接近过期（15天内），自动续期30天
 * 5. 返回会话和用户信息
 * 
 * @param token 会话令牌字符串
 * @returns 包含会话和用户信息的验证结果，如果无效则两者均为null
 */
export function validateSessionToken(token: string): SessionValidationResult {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token))); // 将令牌转换为会话ID
	const row = db.queryOne(
		`
SELECT session.id, session.user_id, session.expires_at, session.two_factor_verified, user.id, user.email, user.username, user.email_verified, IIF(user.totp_key IS NOT NULL, 1, 0) FROM session
INNER JOIN user ON session.user_id = user.id
WHERE session.id = ?
`,
		[sessionId]
	);

	if (row === null) {
		return { session: null, user: null }; // 会话不存在
	}
	
	// 从查询结果构建会话对象
	const session: Session = {
		id: row.string(0),
		userId: row.number(1),
		expiresAt: new Date(row.number(2) * 1000), // 将UNIX时间戳转换为JS日期对象
		twoFactorVerified: Boolean(row.number(3)) // 转换为布尔值
	};
	
	// 从查询结果构建用户对象
	const user: User = {
		id: row.number(4),
		email: row.string(5),
		username: row.string(6),
		emailVerified: Boolean(row.number(7)),
		registered2FA: Boolean(row.number(8)) // 如果totp_key不为null，则表示已注册2FA
	};
	
	// 检查会话是否已过期
	if (Date.now() >= session.expiresAt.getTime()) {
		db.execute("DELETE FROM session WHERE id = ?", [session.id]); // 删除过期会话
		return { session: null, user: null };
	}
	
	// 会话自动续期策略
	// 想象一下：这就像你在图书馆借的书。如果借期快到了（还剩15天）
	// 但你还在经常看这本书（用户活跃使用网站），
	// 系统就会自动帮你续借（再给30天），这样你就不用频繁去柜台办理续借手续（重新登录）
	if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
		// 现在离过期时间不到15天了，自动延长30天
		session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
		db.execute("UPDATE session SET expires_at = ? WHERE session.id = ?", [
			Math.floor(session.expiresAt.getTime() / 1000), // 将JS日期转换回UNIX时间戳
			session.id
		]);
	}
	
	return { session, user };
}

/**
 * 获取当前会话（带缓存）
 * 
 * 这个函数从HTTP请求的cookie中获取会话令牌，并验证其有效性。
 * 使用React的cache函数进行缓存，避免在同一请求中多次验证相同的会话令牌。
 * 
 * @returns 包含会话和用户信息的验证结果
 */
export const getCurrentSession = cache((): SessionValidationResult => {
	const token = cookies().get("session")?.value ?? null; // 从cookie中获取会话令牌
	if (token === null) {
		return { session: null, user: null }; // 无cookie，用户未登录
	}
	const result = validateSessionToken(token); // 验证令牌
	return result;
});

/**
 * 使单个会话失效
 * 
 * 从数据库中删除指定的会话，通常在用户注销时使用。
 * 
 * @param sessionId 要使其失效的会话ID
 */
export function invalidateSession(sessionId: string): void {
	db.execute("DELETE FROM session WHERE id = ?", [sessionId]);
}

/**
 * 使用户的所有会话失效
 * 
 * 从数据库中删除用户的所有会话，通常在以下情况使用：
 * - 用户更改密码
 * - 检测到可疑活动
 * - 用户请求从所有设备注销
 * 
 * @param userId 要使其所有会话失效的用户ID
 */
export function invalidateUserSessions(userId: number): void {
	db.execute("DELETE FROM session WHERE user_id = ?", [userId]);
}

/**
 * 设置会话令牌cookie
 * 
 * 在用户成功登录后调用，将会话令牌存储在HTTP-only cookie中。
 * HTTP-only cookie不能被JavaScript读取，这是一项安全措施。
 * 
 * Cookie设置包括：
 * - httpOnly: 防止JavaScript访问cookie
 * - secure: 在生产环境中要求HTTPS
 * - sameSite: 防止跨站请求携带cookie（防御CSRF攻击）
 * - expires: cookie的过期时间
 * 
 * @param token 会话令牌字符串
 * @param expiresAt cookie的过期日期
 */
export function setSessionTokenCookie(token: string, expiresAt: Date): void {
	cookies().set("session", token, {
		httpOnly: true, // 防止JavaScript访问
		path: "/", // 在整个站点中可用
		secure: process.env.NODE_ENV === "production", // 在生产环境中要求HTTPS
		sameSite: "lax", // 防止跨站请求携带cookie
		expires: expiresAt // 设置过期时间
	});
}

/**
 * 删除会话令牌cookie
 * 
 * 在用户注销时调用，通过设置空值和立即过期来删除cookie。
 */
export function deleteSessionTokenCookie(): void {
	cookies().set("session", "", { // 设置空值
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 0 // 立即过期
	});
}

/**
 * 生成随机会话令牌
 * 
 * 创建一个安全的随机令牌，用于新会话。
 * 使用20字节（160位）的随机数，提供足够的熵以防止猜测攻击。
 * 
 * @returns Base32编码的会话令牌字符串
 */
export function generateSessionToken(): string {
	const tokenBytes = new Uint8Array(20); // 创建20字节的随机数据
	crypto.getRandomValues(tokenBytes); // 使用加密安全的随机数生成器
	const token = encodeBase32LowerCaseNoPadding(tokenBytes).toLowerCase(); // 编码为Base32
	return token;
}

/**
 * 创建新会话
 * 
 * 在用户登录成功后调用，将会话信息存储到数据库中。
 * 1. 将令牌转换为会话ID
 * 2. 创建会话对象（包括30天的到期时间）
 * 3. 将会话插入数据库
 * 
 * @param token 会话令牌字符串
 * @param userId 用户ID
 * @param flags 会话标志（包括两因素验证状态）
 * @returns 创建的会话对象
 */
export function createSession(token: string, userId: number, flags: SessionFlags): Session {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token))); // 将令牌转换为会话ID
	const session: Session = {
		id: sessionId,
		userId,
		expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30天后过期
		twoFactorVerified: flags.twoFactorVerified // 设置2FA验证状态
	};
	db.execute("INSERT INTO session (id, user_id, expires_at, two_factor_verified) VALUES (?, ?, ?, ?)", [
		session.id,
		session.userId,
		Math.floor(session.expiresAt.getTime() / 1000), // 将JS日期转换为UNIX时间戳
		Number(session.twoFactorVerified) // 将布尔值转换为0/1
	]);
	return session;
}

/**
 * 将会话标记为已通过两因素认证
 * 
 * 当用户成功完成2FA验证后调用此函数。
 * 更新数据库中会话的two_factor_verified字段为1（true）。
 * 
 * @param sessionId 要更新的会话ID
 */
export function setSessionAs2FAVerified(sessionId: string): void {
	db.execute("UPDATE session SET two_factor_verified = 1 WHERE id = ?", [sessionId]);
}

/**
 * 会话标志接口
 * 
 * 包含影响会话行为的各种标志：
 * - twoFactorVerified: 指示用户是否已完成2FA验证
 */
export interface SessionFlags {
	twoFactorVerified: boolean;
}

/**
 * 会话接口
 * 
 * 定义了表示用户会话的数据结构，包含以下字段：
 * - id: 会话的唯一标识符（基于令牌的哈希）
 * - expiresAt: 会话的过期时间
 * - userId: 关联的用户ID
 * - twoFactorVerified: 是否已通过2FA验证
 */
export interface Session extends SessionFlags {
	id: string;
	expiresAt: Date;
	userId: number;
}

/**
 * 会话验证结果类型
 * 
 * 用于返回会话验证的结果：
 * - 成功时返回会话对象和用户对象
 * - 失败时两者均为null
 */
type SessionValidationResult = { session: Session; user: User } | { session: null; user: null };
