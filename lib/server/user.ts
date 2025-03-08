/**
 * 用户管理模块 - User Management Module
 * 
 * 这个模块负责处理与用户账户相关的所有功能，包括：
 * - 用户创建和注册
 * - 用户身份验证
 * - 密码管理
 * - 电子邮件验证状态
 * - 两因素认证(2FA)设置
 * - 恢复码管理
 * 
 * 该模块直接与数据库交互，为整个认证系统提供用户管理的核心功能。
 * 所有用户敏感数据（如密码、恢复码和TOTP密钥）都经过加密或哈希处理以确保安全性。
 */

import { db } from "./db";
import { decrypt, decryptToString, encrypt, encryptString } from "./encryption";
import { hashPassword } from "./password";
import { generateRandomRecoveryCode } from "./utils";

/**
 * 验证用户名输入是否有效
 * 
 * 用户名验证规则：
 * 1. 长度必须大于3个字符（确保不会太短）
 * 2. 长度必须小于32个字符（防止用户名过长）
 * 3. 不能包含首尾空格（trim后必须与原字符串相等）
 * 
 * @param username 要验证的用户名
 * @returns 如果用户名符合要求则返回true，否则返回false
 */
export function verifyUsernameInput(username: string): boolean {
	return username.length > 3 && username.length < 32 && username.trim() === username;
}

/**
 * 创建新用户
 * 
 * 这个函数执行以下操作：
 * 1. 对用户密码进行哈希处理（不存储明文密码）
 * 2. 生成随机恢复码（用于账户恢复）
 * 3. 加密恢复码
 * 4. 将用户信息插入数据库
 * 5. 返回新创建的用户对象
 * 
 * 注意：新创建的用户默认邮箱未验证(emailVerified=false)且没有设置2FA(registered2FA=false)
 * 
 * @param email 用户电子邮件
 * @param username 用户名
 * @param password 用户密码（将被哈希处理）
 * @returns 创建的用户对象
 */
export async function createUser(email: string, username: string, password: string): Promise<User> {
	const passwordHash = await hashPassword(password); // 密码哈希，避免明文存储
	const recoveryCode = generateRandomRecoveryCode(); // 生成随机恢复码
	const encryptedRecoveryCode = encryptString(recoveryCode); // 加密恢复码
	const row = db.queryOne(
		"INSERT INTO user (email, username, password_hash, recovery_code) VALUES (?, ?, ?, ?) RETURNING user.id",
		[email, username, passwordHash, encryptedRecoveryCode]
	);
	if (row === null) {
		throw new Error("Unexpected error");
	}
	const user: User = {
		id: row.number(0),
		username,
		email,
		emailVerified: false, // 默认邮箱未验证
		registered2FA: false  // 默认没有开启两因素认证
	};
	return user;
}

/**
 * 更新用户密码
 * 
 * 用于密码重置流程或用户主动更改密码时调用。
 * 将新密码哈希后更新到数据库中。
 * 
 * @param userId 用户ID
 * @param password 新密码（将被哈希处理）
 */
export async function updateUserPassword(userId: number, password: string): Promise<void> {
	const passwordHash = await hashPassword(password); // 对新密码进行哈希
	db.execute("UPDATE user SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
}

/**
 * 更新用户邮箱并将其标记为已验证
 * 
 * 这个函数通常在用户成功验证新邮箱后调用，一步完成邮箱更新和验证状态设置。
 * 
 * @param userId 用户ID
 * @param email 新的已验证电子邮件
 */
export function updateUserEmailAndSetEmailAsVerified(userId: number, email: string): void {
	db.execute("UPDATE user SET email = ?, email_verified = 1 WHERE id = ?", [email, userId]);
}

/**
 * 如果邮箱匹配，将用户标记为邮箱已验证
 * 
 * 这个函数在用户完成邮箱验证流程时调用。
 * 只有当用户ID和邮箱都匹配时才会更新验证状态，这是一个安全措施。
 * 
 * @param userId 用户ID
 * @param email 要验证的电子邮件
 * @returns 如果更新成功（找到匹配的记录）则返回true，否则返回false
 */
export function setUserAsEmailVerifiedIfEmailMatches(userId: number, email: string): boolean {
	const result = db.execute("UPDATE user SET email_verified = 1 WHERE id = ? AND email = ?", [userId, email]);
	return result.changes > 0; // 如果有记录被更新，则返回true
}

/**
 * 获取用户的密码哈希
 * 
 * 通常在验证用户登录时使用，将用户提供的密码哈希后与此哈希进行比较。
 * 
 * @param userId 用户ID
 * @returns 密码哈希字符串
 * @throws 如果用户ID无效则抛出错误
 */
export function getUserPasswordHash(userId: number): string {
	const row = db.queryOne("SELECT password_hash FROM user WHERE id = ?", [userId]);
	if (row === null) {
		throw new Error("Invalid user ID");
	}
	return row.string(0);
}

/**
 * 获取用户的恢复码
 * 
 * 恢复码用于账户恢复，例如当用户无法访问2FA设备时。
 * 注意：从数据库中取出时需要进行解密，因为存储时是加密的。
 * 
 * @param userId 用户ID
 * @returns 解密后的恢复码字符串
 * @throws 如果用户ID无效则抛出错误
 */
export function getUserRecoverCode(userId: number): string {
	const row = db.queryOne("SELECT recovery_code FROM user WHERE id = ?", [userId]);
	if (row === null) {
		throw new Error("Invalid user ID");
	}
	return decryptToString(row.bytes(0)); // 将加密的恢复码解密为字符串
}

/**
 * 获取用户的TOTP密钥
 * 
 * TOTP(基于时间的一次性密码)密钥用于两因素认证(2FA)。
 * 如果用户没有设置2FA，则返回null。
 * 
 * @param userId 用户ID
 * @returns 解密后的TOTP密钥数据，如果未设置则返回null
 * @throws 如果用户ID无效则抛出错误
 */
export function getUserTOTPKey(userId: number): Uint8Array | null {
	const row = db.queryOne("SELECT totp_key FROM user WHERE id = ?", [userId]);
	if (row === null) {
		throw new Error("Invalid user ID");
	}
	const encrypted = row.bytesNullable(0);
	if (encrypted === null) {
		return null; // 用户未设置2FA
	}
	return decrypt(encrypted); // 解密TOTP密钥
}

/**
 * 更新用户的TOTP密钥
 * 
 * 当用户设置或更改2FA时调用此函数。
 * TOTP密钥在存储前会进行加密，提高安全性。
 * 
 * @param userId 用户ID
 * @param key TOTP密钥数据
 */
export function updateUserTOTPKey(userId: number, key: Uint8Array): void {
	const encrypted = encrypt(key); // 加密TOTP密钥
	db.execute("UPDATE user SET totp_key = ? WHERE id = ?", [encrypted, userId]);
}

/**
 * 重置用户的恢复码
 * 
 * 用于当用户请求新的恢复码时，例如在设置2FA后或担心原恢复码泄露时。
 * 生成一个新的随机恢复码，加密后存储，并返回明文恢复码给调用者（仅显示一次给用户）。
 * 
 * @param userId 用户ID
 * @returns 新生成的恢复码（明文）
 */
export function resetUserRecoveryCode(userId: number): string {
	const recoveryCode = generateRandomRecoveryCode(); // 生成新的随机恢复码
	const encrypted = encryptString(recoveryCode); // 加密恢复码
	db.execute("UPDATE user SET recovery_code = ? WHERE id = ?", [encrypted, userId]);
	return recoveryCode; // 返回明文恢复码，仅显示一次给用户
}

/**
 * 通过电子邮件地址查找用户
 * 
 * 常用于登录流程，当用户输入邮箱地址时查询对应用户信息。
 * 查询结果包含用户基本信息，以及是否验证了邮箱和是否设置了2FA。
 * 
 * @param email 电子邮件地址
 * @returns 如果找到用户则返回用户对象，否则返回null
 */
export function getUserFromEmail(email: string): User | null {
	const row = db.queryOne(
		"SELECT id, email, username, email_verified, IIF(totp_key IS NOT NULL, 1, 0) FROM user WHERE email = ?",
		[email]
	);
	if (row === null) {
		return null; // 未找到用户
	}
	const user: User = {
		id: row.number(0),
		email: row.string(1),
		username: row.string(2),
		emailVerified: Boolean(row.number(3)), // 将数字转换为布尔值
		registered2FA: Boolean(row.number(4))  // 如果totp_key不为null，则表示已注册2FA
	};
	return user;
}

/**
 * 用户接口定义
 * 
 * 定义了表示用户的数据结构，包含以下字段：
 * - id: 用户的唯一标识符
 * - email: 用户的电子邮件地址
 * - username: 用户名
 * - emailVerified: 邮箱是否已验证
 * - registered2FA: 是否已设置两因素认证
 */
export interface User {
	id: number;
	email: string;
	username: string;
	emailVerified: boolean;
	registered2FA: boolean;
}
