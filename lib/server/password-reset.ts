/**
 * 密码重置模块 - Password Reset Module
 * 
 * 这个模块负责处理密码重置的全部流程，包括：
 * - 创建和验证密码重置会话
 * - 生成和验证一次性重置码
 * - 跟踪重置流程的电子邮件验证和2FA验证状态
 * - 管理密码重置会话的cookie
 * - 发送密码重置邮件
 * 
 * 密码重置是关键的账户恢复机制，允许用户在忘记密码时重新获得账户访问权限。
 * 该流程必须严格安全，确保只有真正的账户所有者才能完成重置。
 */

import { db } from "./db";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { generateRandomOTP } from "./utils";
import { sha256 } from "@oslojs/crypto/sha2";
import { cookies } from "next/headers";

import type { User } from "./user";

/**
 * 创建密码重置会话
 * 
 * 工作流程：
 * 1. 将令牌转换为会话ID（使用SHA-256哈希）
 * 2. 创建密码重置会话对象，包括：
 *    - 设置10分钟过期时间
 *    - 生成随机验证码
 *    - 初始状态为未验证邮箱和未验证2FA
 * 3. 将会话保存到数据库
 * 
 * @param token 密码重置令牌
 * @param userId 用户ID
 * @param email 用户电子邮件
 * @returns 创建的密码重置会话对象
 */
export function createPasswordResetSession(token: string, userId: number, email: string): PasswordResetSession {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token))); // 将令牌转换为会话ID
	
	// 创建会话对象
	const session: PasswordResetSession = {
		id: sessionId,
		userId,
		email,
		expiresAt: new Date(Date.now() + 1000 * 60 * 10), // 10分钟后过期
		code: generateRandomOTP(), // 生成随机验证码
		emailVerified: false, // 初始状态为未验证电子邮件
		twoFactorVerified: false // 初始状态为未验证2FA
	};
	
	// 将会话保存到数据库
	db.execute("INSERT INTO password_reset_session (id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, ?)", [
		session.id,
		session.userId,
		session.email,
		session.code,
		Math.floor(session.expiresAt.getTime() / 1000) // 将JS日期转换为UNIX时间戳
	]);
	
	return session;
}

/**
 * 验证密码重置会话令牌
 * 
 * 工作流程：
 * 1. 将令牌转换为会话ID
 * 2. 在数据库中查找会话，同时获取关联用户信息
 * 3. 如果找到会话，检查是否已过期
 *    - 如果已过期，删除会话并返回无效结果
 * 4. 返回会话和用户信息
 * 
 * @param token 密码重置令牌
 * @returns 包含会话和用户信息的验证结果，如果无效则两者均为null
 */
export function validatePasswordResetSessionToken(token: string): PasswordResetSessionValidationResult {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token))); // 将令牌转换为会话ID
	
	// 查询会话和相关用户信息
	const row = db.queryOne(
		`SELECT password_reset_session.id, password_reset_session.user_id, password_reset_session.email, password_reset_session.code, password_reset_session.expires_at, password_reset_session.email_verified, password_reset_session.two_factor_verified,
user.id, user.email, user.username, user.email_verified, IIF(user.totp_key IS NOT NULL, 1, 0)
FROM password_reset_session INNER JOIN user ON user.id = password_reset_session.user_id
WHERE password_reset_session.id = ?`,
		[sessionId]
	);
	
	if (row === null) {
		return { session: null, user: null }; // 会话不存在
	}
	
	// 从查询结果构建会话对象
	const session: PasswordResetSession = {
		id: row.string(0),
		userId: row.number(1),
		email: row.string(2),
		code: row.string(3),
		expiresAt: new Date(row.number(4) * 1000), // 将UNIX时间戳转换为JS日期
		emailVerified: Boolean(row.number(5)),
		twoFactorVerified: Boolean(row.number(6))
	};
	
	// 从查询结果构建用户对象
	const user: User = {
		id: row.number(7),
		email: row.string(8),
		username: row.string(9),
		emailVerified: Boolean(row.number(10)),
		registered2FA: Boolean(row.number(11)) // 如果totp_key不为null，则表示已注册2FA
	};
	
	// 检查会话是否已过期
	if (Date.now() >= session.expiresAt.getTime()) {
		db.execute("DELETE FROM password_reset_session WHERE id = ?", [session.id]); // 删除过期会话
		return { session: null, user: null };
	}
	
	return { session, user };
}

/**
 * 将密码重置会话标记为已验证电子邮件
 * 
 * 当用户成功输入发送到其邮箱的验证码时调用此函数。
 * 更新会话状态，表明用户已通过邮箱验证步骤。
 * 
 * @param sessionId 密码重置会话ID
 */
export function setPasswordResetSessionAsEmailVerified(sessionId: string): void {
	db.execute("UPDATE password_reset_session SET email_verified = 1 WHERE id = ?", [sessionId]);
}

/**
 * 将密码重置会话标记为已通过两因素认证
 * 
 * 当用户成功完成2FA验证（如果启用了2FA）时调用此函数。
 * 更新会话状态，表明用户已通过2FA验证步骤。
 * 
 * @param sessionId 密码重置会话ID
 */
export function setPasswordResetSessionAs2FAVerified(sessionId: string): void {
	db.execute("UPDATE password_reset_session SET two_factor_verified = 1 WHERE id = ?", [sessionId]);
}

/**
 * 使用户的所有密码重置会话失效
 * 
 * 在以下情况下调用：
 * - 用户成功重置密码后
 * - 检测到可疑活动时
 * - 用户主动取消所有重置请求时
 * 
 * @param userId 要使其所有密码重置会话失效的用户ID
 */
export function invalidateUserPasswordResetSessions(userId: number): void {
	db.execute("DELETE FROM password_reset_session WHERE user_id = ?", [userId]);
}

/**
 * 从HTTP请求中验证密码重置会话
 * 
 * 工作流程：
 * 1. 从cookie中获取密码重置令牌
 * 2. 验证令牌的有效性
 * 3. 如果令牌无效或会话不存在，删除cookie
 * 
 * 这个函数用于密码重置流程中的每个步骤，以确保用户正在进行有效的重置流程。
 * 
 * @returns 包含会话和用户信息的验证结果
 */
export function validatePasswordResetSessionRequest(): PasswordResetSessionValidationResult {
	// 从cookie中获取密码重置令牌
	const token = cookies().get("password_reset_session")?.value ?? null;
	if (token === null) {
		return { session: null, user: null }; // 未找到cookie
	}
	
	// 验证令牌并获取会话和用户信息
	const result = validatePasswordResetSessionToken(token);
	
	// 如果会话无效，删除cookie
	if (result.session === null) {
		deletePasswordResetSessionTokenCookie();
	}
	
	return result;
}

/**
 * 设置密码重置会话令牌cookie
 * 
 * 在用户启动密码重置流程时调用，将会话令牌存储在HTTP-only cookie中。
 * 
 * Cookie设置包括：
 * - httpOnly: 防止JavaScript访问cookie
 * - secure: 在生产环境中要求HTTPS
 * - sameSite: 防止跨站请求携带cookie
 * - expires: cookie的过期时间（与会话过期时间相同）
 * 
 * @param token 密码重置令牌
 * @param expiresAt cookie的过期日期
 */
export function setPasswordResetSessionTokenCookie(token: string, expiresAt: Date): void {
	cookies().set("password_reset_session", token, {
		expires: expiresAt,
		sameSite: "lax", // 防止跨站请求携带cookie
		httpOnly: true, // 防止JavaScript访问
		path: "/", // 在整个站点中可用
		secure: process.env.NODE_ENV === "production" // 在生产环境中要求HTTPS
	});
}

/**
 * 删除密码重置会话令牌cookie
 * 
 * 在以下情况下调用：
 * - 密码重置流程完成
 * - 密码重置会话过期
 * - 用户放弃密码重置流程
 */
export function deletePasswordResetSessionTokenCookie(): void {
	cookies().set("password_reset_session", "", { // 设置空值
		maxAge: 0, // 立即过期
		sameSite: "lax",
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production"
	});
}

/**
 * 发送密码重置邮件
 * 
 * 向用户的电子邮箱发送包含重置码的邮件。
 * 注意：这里只是简单地打印到控制台，在实际应用中应替换为真正的邮件发送功能。
 * 
 * @param email 接收重置码的电子邮件地址
 * @param code 重置码
 */
export function sendPasswordResetEmail(email: string, code: string): void {
	// 注意：这只是演示用途。在真实环境中，应该使用邮件发送服务
	console.log(`To ${email}: Your reset code is ${code}`);
}

/**
 * 密码重置会话接口
 * 
 * 定义了表示密码重置会话的数据结构，包含以下字段：
 * - id: 会话的唯一标识符（基于令牌的哈希）
 * - userId: 会话所属的用户ID
 * - email: 用户的电子邮件地址
 * - expiresAt: 会话的过期时间
 * - code: 发送给用户的验证码
 * - emailVerified: 是否已通过电子邮件验证
 * - twoFactorVerified: 是否已通过两因素认证（如果启用）
 */
export interface PasswordResetSession {
	id: string;
	userId: number;
	email: string;
	expiresAt: Date;
	code: string;
	emailVerified: boolean;
	twoFactorVerified: boolean;
}

/**
 * 密码重置会话验证结果类型
 * 
 * 用于返回密码重置会话验证的结果：
 * - 成功时返回会话对象和用户对象
 * - 失败时两者均为null
 */
export type PasswordResetSessionValidationResult =
	| { session: PasswordResetSession; user: User }
	| { session: null; user: null };
