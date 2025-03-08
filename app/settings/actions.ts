/**
 * 用户设置功能模块
 * 
 * 这个文件负责处理用户设置相关的服务器端操作，包括：
 * 1. 更新用户密码
 * 2. 更新用户邮箱
 * 3. 重新生成2FA恢复码
 * 
 * 用户设置功能使用户能够管理自己的账号安全信息，
 * 是应用程序用户管理体系的重要组成部分。
 */

"use server"; // 标记这是一个服务器端动作，只在服务器上执行

// 导入所需的功能模块
import { verifyPasswordHash, verifyPasswordStrength } from "@/lib/server/password"; // 密码验证和强度检查
import { ExpiringTokenBucket } from "@/lib/server/rate-limit"; // 速率限制
import {
	createSession,
	generateSessionToken,
	getCurrentSession,
	invalidateUserSessions,
	setSessionTokenCookie
} from "@/lib/server/session"; // 会话管理
import { getUserPasswordHash, resetUserRecoveryCode, updateUserPassword } from "@/lib/server/user"; // 用户管理
import {
	createEmailVerificationRequest,
	sendVerificationEmail,
	sendVerificationEmailBucket,
	setEmailVerificationRequestCookie
} from "@/lib/server/email-verification"; // 邮箱验证
import { checkEmailAvailability, verifyEmailInput } from "@/lib/server/email"; // 邮箱检查
import { redirect } from "next/navigation"; // 页面重定向
import { globalPOSTRateLimit } from "@/lib/server/request"; // 全局请求限制
import type { SessionFlags } from "@/lib/server/session"; // 会话标志类型

/**
 * 密码更新操作限制器
 * 
 * 这个变量创建了一个"过期令牌桶"，用于限制密码更新操作的频率：
 * - 每个会话最多可以尝试5次密码更新
 * - 令牌在30分钟后过期并刷新
 * 
 * 这样可以防止暴力破解攻击和频繁的密码更改请求
 */
const passwordUpdateBucket = new ExpiringTokenBucket<string>(5, 60 * 30);

/**
 * 更新密码动作处理函数
 * 
 * 这个函数处理用户在设置页面提交的更新密码表单，验证当前密码，并设置新密码
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果对象
 */
export async function updatePasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// 第一步：检查全局请求速率限制
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第二步：获取当前用户的会话信息
	const { session, user } = getCurrentSession();
	
	// 如果用户未登录，返回未认证信息
	if (session === null) {
		return {
			message: "Not authenticated" // 返回"未认证"的错误信息
		};
	}
	
	// 第三步：检查2FA验证状态
	// 如果用户已启用2FA但会话未验证2FA，禁止操作
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden" // 返回"禁止访问"的错误信息
		};
	}
	
	// 第四步：检查密码更新频率限制
	if (!passwordUpdateBucket.check(session.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第五步：获取并验证表单数据
	const password = formData.get("password"); // 获取当前密码
	const newPassword = formData.get("new_password"); // 获取新密码
	
	// 检查密码是否是字符串
	if (typeof password !== "string" || typeof newPassword !== "string") {
		return {
			message: "Invalid or missing fields" // 返回"无效或缺失字段"的错误信息
		};
	}
	
	// 第六步：验证新密码强度
	const strongPassword = await verifyPasswordStrength(newPassword);
	if (!strongPassword) {
		return {
			message: "Weak password" // 返回"密码强度不足"的错误信息
		};
	}
	
	// 第七步：消耗密码更新令牌（实际操作前的最终检查）
	if (!passwordUpdateBucket.consume(session.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第八步：验证当前密码是否正确
	const passwordHash = getUserPasswordHash(user.id); // 获取用户当前密码的哈希值
	const validPassword = await verifyPasswordHash(passwordHash, password); // 验证密码
	if (!validPassword) {
		return {
			message: "Incorrect password" // 返回"密码错误"的错误信息
		};
	}
	
	// 第九步：重置密码更新尝试次数
	// 密码验证成功，重置限制器，避免合法用户被锁定
	passwordUpdateBucket.reset(session.id);
	
	// 第十步：使用户的所有现有会话失效
	// 这是一个重要的安全措施，确保密码更改后所有设备都需要重新登录
	invalidateUserSessions(user.id);
	
	// 第十一步：更新用户密码
	await updateUserPassword(user.id, newPassword);
	
	// 第十二步：创建新的用户会话（自动重新登录当前设备）
	const sessionToken = generateSessionToken(); // 生成新的会话令牌
	const sessionFlags: SessionFlags = {
		twoFactorVerified: session.twoFactorVerified // 保留2FA验证状态
	};
	const newSession = createSession(sessionToken, user.id, sessionFlags); // 创建新会话
	
	// 第十三步：设置新的会话Cookie
	setSessionTokenCookie(sessionToken, newSession.expiresAt);
	
	// 第十四步：返回成功信息
	return {
		message: "Updated password" // 返回"密码已更新"的成功信息
	};
}

/**
 * 更新邮箱动作处理函数
 * 
 * 这个函数处理用户在设置页面提交的更新邮箱表单，验证新邮箱，并发送验证邮件
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果或重定向指令
 */
export async function updateEmailAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// 第一步：检查全局请求速率限制
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第二步：获取当前用户的会话信息
	const { session, user } = getCurrentSession();
	
	// 如果用户未登录，返回未认证信息
	if (session === null) {
		return {
			message: "Not authenticated" // 返回"未认证"的错误信息
		};
	}
	
	// 第三步：检查2FA验证状态
	// 如果用户已启用2FA但会话未验证2FA，禁止操作
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden" // 返回"禁止访问"的错误信息
		};
	}
	
	// 第四步：检查发送验证邮件的频率限制
	if (!sendVerificationEmailBucket.check(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第五步：获取并验证表单数据
	const email = formData.get("email"); // 获取新邮箱
	
	// 检查邮箱是否是字符串
	if (typeof email !== "string") {
		return { message: "Invalid or missing fields" }; // 返回"无效或缺失字段"的错误信息
	}
	
	// 检查邮箱是否为空
	if (email === "") {
		return {
			message: "Please enter your email" // 返回"请输入邮箱"的提示
		};
	}
	
	// 第六步：验证邮箱格式
	if (!verifyEmailInput(email)) {
		return {
			message: "Please enter a valid email" // 返回"请输入有效的邮箱"的提示
		};
	}
	
	// 第七步：检查邮箱是否已被其他用户使用
	const emailAvailable = checkEmailAvailability(email);
	if (!emailAvailable) {
		return {
			message: "This email is already used" // 返回"该邮箱已被使用"的错误信息
		};
	}
	
	// 第八步：消耗发送验证邮件令牌（实际操作前的最终检查）
	if (!sendVerificationEmailBucket.consume(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第九步：创建邮箱验证请求
	const verificationRequest = createEmailVerificationRequest(user.id, email);
	
	// 第十步：发送验证邮件
	// 邮件中包含验证码，用于验证用户对新邮箱的所有权
	sendVerificationEmail(verificationRequest.email, verificationRequest.code);
	
	// 第十一步：设置邮箱验证请求Cookie
	setEmailVerificationRequestCookie(verificationRequest);
	
	// 第十二步：重定向用户到邮箱验证页面
	return redirect("/verify-email");
}

/**
 * 重新生成恢复码动作处理函数
 * 
 * 这个函数用于重新生成用户的2FA恢复码
 * 恢复码可在用户无法访问2FA验证器时用于登录账户
 * 
 * @returns 操作结果，包含新的恢复码或错误信息
 */
export async function regenerateRecoveryCodeAction(): Promise<RegenerateRecoveryCodeActionResult> {
	// 第一步：检查全局请求速率限制
	if (!globalPOSTRateLimit()) {
		return {
			error: "Too many requests", // 返回"请求过多"的错误信息
			recoveryCode: null
		};
	}
	
	// 第二步：获取当前用户的会话信息
	const { session, user } = getCurrentSession();
	
	// 如果用户未登录，返回未认证信息
	if (session === null || user === null) {
		return {
			error: "Not authenticated", // 返回"未认证"的错误信息
			recoveryCode: null
		};
	}
	
	// 第三步：检查邮箱验证状态
	// 用户必须先验证邮箱，才能重置恢复码（安全措施）
	if (!user.emailVerified) {
		return {
			error: "Forbidden", // 返回"禁止访问"的错误信息
			recoveryCode: null
		};
	}
	
	// 第四步：检查2FA验证状态
	// 用户必须已通过2FA验证，才能重置恢复码（安全措施）
	if (!session.twoFactorVerified) {
		return {
			error: "Forbidden", // 返回"禁止访问"的错误信息
			recoveryCode: null
		};
	}
	
	// 第五步：重置并获取用户的恢复码
	const recoveryCode = resetUserRecoveryCode(session.userId);
	
	// 第六步：返回新生成的恢复码
	return {
		error: null,
		recoveryCode
	};
}

/**
 * 操作结果接口定义
 * 
 * 这个接口定义了普通操作结果的数据结构，包含一个消息字段
 */
interface ActionResult {
	message: string; // 操作结果消息
}

/**
 * 重新生成恢复码结果类型
 * 
 * 这个类型定义了重新生成恢复码操作的两种可能结果：
 * 1. 操作失败，包含错误信息
 * 2. 操作成功，包含新的恢复码
 */
type RegenerateRecoveryCodeActionResult =
	| {
			error: string;       // 错误信息
			recoveryCode: null;  // 恢复码为空
	  }
	| {
			error: null;         // 无错误
			recoveryCode: string; // 新的恢复码
	  };

/**
 * 用户设置功能模块完整说明：
 * 
 * 1. 更新密码流程：
 *    - 用户需要先验证当前密码，确保是账号所有者操作
 *    - 系统检查新密码的强度，确保安全
 *    - 更新密码后，所有现有会话（其他设备的登录状态）会被注销
 *    - 当前设备会自动创建新会话，保持登录状态
 * 
 * 2. 更新邮箱流程：
 *    - 用户输入新的邮箱地址
 *    - 系统验证邮箱格式和可用性
 *    - 发送验证码到新邮箱
 *    - 用户被重定向到邮箱验证页面，完成验证
 * 
 * 3. 重新生成恢复码流程：
 *    - 用户请求生成新的恢复码
 *    - 系统验证用户身份和权限
 *    - 生成并显示新的恢复码
 *    - 旧的恢复码立即失效
 * 
 * 安全机制：
 * - 所有敏感操作都需要验证用户身份
 * - 启用2FA的用户需要完成2FA验证才能执行操作
 * - 严格的速率限制防止暴力破解和滥用
 * - 密码更改会使所有设备的会话失效，确保安全
 * - 邮箱更改需要进行验证，确保新邮箱的所有权
 */
