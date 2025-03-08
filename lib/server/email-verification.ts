/**
 * 邮箱验证模块 - Email Verification Module
 * 
 * 这个模块负责处理电子邮件验证的所有功能，包括：
 * - 创建和管理邮箱验证请求
 * - 生成和验证一次性验证码
 * - 在验证流程中使用cookie跟踪验证状态
 * - 发送验证邮件给用户
 * - 对发送验证邮件的频率进行速率限制
 * 
 * 邮箱验证是确认用户身份和防止恶意注册的重要安全机制。
 * 通过验证用户能够访问指定的电子邮箱，我们可以确保账户注册的真实性，
 * 并为找回密码等功能提供安全基础。
 */

import { generateRandomOTP } from "./utils";
import { db } from "./db";
import { ExpiringTokenBucket } from "./rate-limit";
import { encodeBase32 } from "@oslojs/encoding";
import { cookies } from "next/headers";
import { getCurrentSession } from "./session";

/**
 * 获取用户的邮箱验证请求
 * 
 * 通过用户ID和请求ID从数据库中检索邮箱验证请求，
 * 这确保了只有请求的所有者才能访问该验证请求。
 * 
 * @param userId 用户ID
 * @param id 邮箱验证请求ID
 * @returns 如果找到则返回邮箱验证请求对象，否则返回null
 */
export function getUserEmailVerificationRequest(userId: number, id: string): EmailVerificationRequest | null {
	const row = db.queryOne(
		"SELECT id, user_id, code, email, expires_at FROM email_verification_request WHERE id = ? AND user_id = ?",
		[id, userId]
	);
	if (row === null) {
		return row; // 未找到验证请求
	}
	
	// 将查询结果转换为EmailVerificationRequest对象
	const request: EmailVerificationRequest = {
		id: row.string(0),
		userId: row.number(1),
		code: row.string(2),
		email: row.string(3),
		expiresAt: new Date(row.number(4) * 1000) // 转换UNIX时间戳为JS日期对象
	};
	return request;
}

/**
 * 创建邮箱验证请求
 * 
 * 工作流程：
 * 1. 首先删除用户的所有现有验证请求（确保每个用户只有一个活跃的验证流程）
 * 2. 生成随机ID和验证码
 * 3. 设置10分钟的过期时间
 * 4. 将验证请求保存到数据库
 * 5. 返回创建的验证请求对象
 * 
 * @param userId 请求所属的用户ID
 * @param email 要验证的电子邮件地址
 * @returns 创建的邮箱验证请求对象
 */
export function createEmailVerificationRequest(userId: number, email: string): EmailVerificationRequest {
	// 删除用户的所有现有验证请求
	deleteUserEmailVerificationRequest(userId);
	
	// 生成随机ID（20字节，使用Base32编码）
	const idBytes = new Uint8Array(20);
	crypto.getRandomValues(idBytes);
	const id = encodeBase32(idBytes).toLowerCase();
	
	// 生成随机验证码
	const code = generateRandomOTP();
	
	// 设置10分钟的过期时间
	const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10分钟后过期
	
	// 将验证请求插入数据库
	db.queryOne(
		"INSERT INTO email_verification_request (id, user_id, code, email, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
		[id, userId, code, email, Math.floor(expiresAt.getTime() / 1000)]
	);
	
	// 创建并返回验证请求对象
	const request: EmailVerificationRequest = {
		id,
		userId,
		code,
		email,
		expiresAt
	};
	return request;
}

/**
 * 删除用户的所有邮箱验证请求
 * 
 * 在以下情况下调用：
 * - 创建新的验证请求前清除旧请求
 * - 验证成功后清理
 * - 验证流程超时或放弃时清理
 * 
 * @param userId 要删除其验证请求的用户ID
 */
export function deleteUserEmailVerificationRequest(userId: number): void {
	db.execute("DELETE FROM email_verification_request WHERE user_id = ?", [userId]);
}

/**
 * 发送验证邮件
 * 
 * 向用户的电子邮箱发送包含验证码的邮件。
 * 注意：这里只是简单地打印到控制台，在实际应用中应替换为真正的邮件发送功能。
 * 
 * @param email 接收验证码的电子邮件地址
 * @param code 验证码
 */
export function sendVerificationEmail(email: string, code: string): void {
	// 注意：这只是演示用途。在真实环境中，应该使用邮件发送服务
	console.log(`To ${email}: Your verification code is ${code}`);
}

/**
 * 设置邮箱验证请求cookie
 * 
 * 将验证请求ID存储在HTTP-only cookie中，用于在验证流程中跟踪状态。
 * 验证请求ID是随机生成的，不包含敏感信息，但仍使用HTTP-only cookie
 * 作为安全措施。
 * 
 * @param request 要存储在cookie中的验证请求
 */
export function setEmailVerificationRequestCookie(request: EmailVerificationRequest): void {
	cookies().set("email_verification", request.id, {
		httpOnly: true, // 防止JavaScript访问
		path: "/", // 在整个站点中可用
		secure: process.env.NODE_ENV === "production", // 在生产环境中要求HTTPS
		sameSite: "lax", // 防止跨站请求携带cookie
		expires: request.expiresAt // 设置与验证请求相同的过期时间
	});
}

/**
 * 删除邮箱验证请求cookie
 * 
 * 在以下情况下调用：
 * - 验证成功完成
 * - 验证流程被放弃
 * - 验证请求过期
 */
export function deleteEmailVerificationRequestCookie(): void {
	cookies().set("email_verification", "", { // 设置空值
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 0 // 立即过期
	});
}

/**
 * 从HTTP请求中获取用户的邮箱验证请求
 * 
 * 工作流程：
 * 1. 获取当前会话信息，确认用户已登录
 * 2. 从cookie中获取验证请求ID
 * 3. 根据ID和用户ID获取完整的验证请求信息
 * 4. 如果验证请求不存在，则删除cookie
 * 
 * 这确保了只有验证请求的创建者能够继续验证流程。
 * 
 * @returns 如果存在有效的验证请求则返回该请求对象，否则返回null
 */
export function getUserEmailVerificationRequestFromRequest(): EmailVerificationRequest | null {
	// 获取当前会话的用户
	const { user } = getCurrentSession();
	if (user === null) {
		return null; // 用户未登录
	}
	
	// 从cookie中获取验证请求ID
	const id = cookies().get("email_verification")?.value ?? null;
	if (id === null) {
		return null; // 未找到cookie
	}
	
	// 获取验证请求对象
	const request = getUserEmailVerificationRequest(user.id, id);
	if (request === null) {
		// 如果请求不存在（可能已过期或被删除），则删除cookie
		deleteEmailVerificationRequestCookie();
	}
	
	return request;
}

/**
 * 发送验证邮件的速率限制桶
 * 
 * 限制用户请求发送验证邮件的频率：
 * - 每个用户ID每10分钟最多允许3次请求
 * - 用完尝试次数后，用户必须等待时间到期
 * 
 * 这可以防止用户滥用系统发送大量邮件，保护邮件服务器免受过载。
 */
export const sendVerificationEmailBucket = new ExpiringTokenBucket<number>(3, 60 * 10); // 3次尝试，10分钟过期

/**
 * 邮箱验证请求接口
 * 
 * 定义了表示邮箱验证请求的数据结构，包含以下字段：
 * - id: 验证请求的唯一标识符
 * - userId: 请求所属的用户ID
 * - code: 随机生成的验证码
 * - email: 要验证的电子邮件地址
 * - expiresAt: 验证请求的过期时间
 */
export interface EmailVerificationRequest {
	id: string;
	userId: number;
	code: string;
	email: string;
	expiresAt: Date;
}
