/**
 * 密码重置功能模块
 * 
 * 这个文件负责处理用户密码重置流程的最后一步，包括：
 * 1. 验证密码重置会话的有效性
 * 2. 检查新密码的强度
 * 3. 更新用户密码
 * 4. 使所有旧会话失效（安全措施）
 * 5. 创建新的登录会话
 * 
 * 密码重置是账号恢复系统的核心组成部分，允许用户在忘记密码时
 * 重新获取账号的访问权限，同时保证整个过程的安全性。
 */

"use server"; // 标记这是一个服务器端动作，只在服务器上执行

// 导入所需的功能模块
import { verifyPasswordStrength } from "@/lib/server/password";  // 验证密码强度
import {
	deletePasswordResetSessionTokenCookie,
	invalidateUserPasswordResetSessions,
	validatePasswordResetSessionRequest
} from "@/lib/server/password-reset";  // 密码重置相关功能
import {
	createSession,
	generateSessionToken,
	invalidateUserSessions,
	setSessionTokenCookie
} from "@/lib/server/session";  // 会话管理功能
import { updateUserPassword } from "@/lib/server/user";  // 更新用户密码
import { redirect } from "next/navigation";  // 页面重定向
import { globalPOSTRateLimit } from "@/lib/server/request";  // 全局POST请求限制
import type { SessionFlags } from "@/lib/server/session";  // 会话标志类型

/**
 * 重置密码动作处理函数
 * 
 * 这个函数处理用户在重置密码页面提交的表单，验证会话和新密码，
 * 然后更新用户密码并创建新的登录会话。
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果或重定向指令
 */
export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// 第一步：检查全局请求速率限制
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests"  // 返回"请求过多"的错误信息
		};
	}
	
	// 第二步：验证密码重置会话
	// 这个函数会检查密码重置会话的有效性，包括会话是否存在、是否过期等
	const { session: passwordResetSession, user } = validatePasswordResetSessionRequest();
	
	// 如果密码重置会话无效，返回未认证信息
	if (passwordResetSession === null) {
		return {
			message: "Not authenticated"  // 返回"未认证"的错误信息
		};
	}
	
	// 第三步：检查邮箱是否已验证
	// 用户必须先验证邮箱，才能重置密码（安全措施）
	if (!passwordResetSession.emailVerified) {
		return {
			message: "Forbidden"  // 返回"禁止访问"的错误信息
		};
	}
	
	// 第四步：检查双因素认证状态
	// 如果用户已设置2FA，则必须先通过2FA验证，才能重置密码（安全措施）
	if (user.registered2FA && !passwordResetSession.twoFactorVerified) {
		return {
			message: "Forbidden"  // 返回"禁止访问"的错误信息
		};
	}
	
	// 第五步：获取并验证新密码
	const password = formData.get("password");  // 获取用户输入的新密码
	
	// 检查密码是否是字符串
	if (typeof password !== "string") {
		return {
			message: "Invalid or missing fields"  // 返回"无效或缺失字段"的错误信息
		};
	}
	
	// 第六步：验证密码强度
	// 确保新密码足够强，不容易被暴力破解
	const strongPassword = await verifyPasswordStrength(password);
	if (!strongPassword) {
		return {
			message: "Weak password"  // 返回"密码强度不足"的错误信息
		};
	}
	
	// 第七步：使所有密码重置会话失效
	// 这样可以确保同一用户的其他密码重置请求无法使用
	invalidateUserPasswordResetSessions(passwordResetSession.userId);
	
	// 第八步：使用户的所有现有会话失效
	// 这是重要的安全措施，确保密码更改后，所有设备都需要重新登录
	invalidateUserSessions(passwordResetSession.userId);
	
	// 第九步：更新用户密码
	// 将新密码哈希后存储到数据库
	await updateUserPassword(passwordResetSession.userId, password);
	
	// 第十步：设置会话标记
	// 保留2FA验证状态，这样用户如果已经完成2FA验证，就不需要再次验证
	const sessionFlags: SessionFlags = {
		twoFactorVerified: passwordResetSession.twoFactorVerified
	};
	
	// 第十一步：创建新的用户会话（自动登录）
	const sessionToken = generateSessionToken();  // 生成会话令牌
	const session = createSession(sessionToken, user.id, sessionFlags);  // 创建会话记录
	
	// 第十二步：设置会话Cookie
	setSessionTokenCookie(sessionToken, session.expiresAt);
	
	// 第十三步：删除密码重置会话的Cookie
	// 清理不再需要的状态
	deletePasswordResetSessionTokenCookie();
	
	// 第十四步：重定向用户到首页
	// 密码重置成功，用户已自动登录
	return redirect("/");
}

/**
 * 操作结果接口定义
 * 
 * 这个接口定义了操作结果的数据结构，包含一个消息字段
 */
interface ActionResult {
	message: string;  // 操作结果消息
}

/**
 * 密码重置完整流程说明：
 * 
 * 1. 用户通过"忘记密码"功能发起密码重置请求
 * 2. 用户收到验证邮件，并验证其邮箱所有权
 * 3. 如果用户启用了2FA，需要先完成2FA验证
 * 4. 用户设置新密码
 * 5. 系统验证新密码强度，确保安全
 * 6. 系统更新用户密码，并使所有旧会话失效
 * 7. 系统自动为用户创建新的登录会话
 * 8. 用户被重定向到首页，完成整个重置流程
 * 
 * 安全机制：
 * - 多重身份验证（邮箱验证+可能的2FA验证）确保操作者身份
 * - 密码强度验证防止设置弱密码
 * - 使旧会话失效，确保密码更改后其他设备需重新登录
 * - 重置会话的严格时效性控制
 * - 请求速率限制防止滥用
 */
