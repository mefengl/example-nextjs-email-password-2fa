/**
 * 忘记密码功能模块
 * 
 * 这个文件负责处理用户忘记密码流程的第一步，包括：
 * 1. 验证用户输入的邮箱地址
 * 2. 创建密码重置会话
 * 3. 发送密码重置邮件
 * 4. 设置密码重置Cookie
 * 
 * 忘记密码功能是账号安全恢复的重要一环，让用户在忘记密码时不必创建新账号。
 */

"use server"; // 标记这是一个服务器端动作，只在服务器上执行

// 导入所需的功能模块
import { verifyEmailInput } from "@/lib/server/email";  // 验证邮箱格式
import {
	createPasswordResetSession,
	invalidateUserPasswordResetSessions,
	sendPasswordResetEmail,
	setPasswordResetSessionTokenCookie
} from "@/lib/server/password-reset";  // 密码重置相关功能
import { RefillingTokenBucket } from "@/lib/server/rate-limit";  // 速率限制
import { globalPOSTRateLimit } from "@/lib/server/request";  // 全局POST请求限制
import { generateSessionToken } from "@/lib/server/session";  // 生成会话令牌
import { getUserFromEmail } from "@/lib/server/user";  // 根据邮箱获取用户
import { headers } from "next/headers";  // 获取HTTP头信息
import { redirect } from "next/navigation";  // 页面重定向

/**
 * IP地址密码重置请求限制器
 * 
 * 这个变量创建了一个"令牌桶"，用来限制同一个IP地址的密码重置请求：
 * - 每个IP最多可以发送3次密码重置邮件
 * - 每60秒钟添加1个新令牌
 * 
 * 这样可以防止恶意用户大量发送密码重置邮件，避免滥用系统
 */
const passwordResetEmailIPBucket = new RefillingTokenBucket<string>(3, 60);

/**
 * 用户密码重置请求限制器
 * 
 * 这个变量创建了一个"令牌桶"，用来限制同一个用户ID的密码重置请求：
 * - 每个用户最多可以发送3次密码重置邮件
 * - 每60秒钟添加1个新令牌
 * 
 * 这样可以防止针对特定用户的密码重置请求过于频繁
 */
const passwordResetEmailUserBucket = new RefillingTokenBucket<number>(3, 60);

/**
 * 忘记密码动作处理函数
 * 
 * 这个函数处理用户在忘记密码页面提交的表单，验证邮箱，并发送密码重置邮件
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果或重定向指令
 */
export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// 第一步：检查全局请求速率限制
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第二步：基于IP地址的速率限制检查
	// 获取客户端IP地址（通常由前端代理如Nginx设置）
	const clientIP = headers().get("X-Forwarded-For");
	
	// 如果能获取到IP地址，则检查该IP是否已经超过请求限制
	if (clientIP !== null && !passwordResetEmailIPBucket.check(clientIP, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第三步：获取并验证表单数据
	const email = formData.get("email"); // 获取用户输入的邮箱
	
	// 检查邮箱是否是字符串
	if (typeof email !== "string") {
		return {
			message: "Invalid or missing fields" // 返回"无效或缺失字段"的错误信息
		};
	}
	
	// 第四步：验证邮箱格式
	if (!verifyEmailInput(email)) {
		return {
			message: "Invalid email" // 返回"无效邮箱"的错误信息
		};
	}
	
	// 第五步：检查用户是否存在
	const user = getUserFromEmail(email);
	if (user === null) {
		return {
			message: "Account does not exist" // 返回"账号不存在"的错误信息
		};
	}
	
	// 第六步：消耗IP令牌（实际操作前的最终IP限制检查）
	if (clientIP !== null && !passwordResetEmailIPBucket.consume(clientIP, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第七步：消耗用户令牌（检查同一用户的请求频率）
	if (!passwordResetEmailUserBucket.consume(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第八步：使当前用户的所有已有密码重置会话失效
	// 这样可以确保只有最新的密码重置链接可用，提高安全性
	invalidateUserPasswordResetSessions(user.id);
	
	// 第九步：生成密码重置会话
	const sessionToken = generateSessionToken(); // 生成会话令牌
	const session = createPasswordResetSession(sessionToken, user.id, user.email); // 创建密码重置会话
	
	// 第十步：发送密码重置邮件
	// 邮件中包含验证码，用于验证这是用户本人发起的密码重置请求
	sendPasswordResetEmail(session.email, session.code);
	
	// 第十一步：设置密码重置会话的Cookie
	// 这样用户在访问密码重置页面时，系统可以知道他们在重置哪个账号的密码
	setPasswordResetSessionTokenCookie(sessionToken, session.expiresAt);
	
	// 第十二步：重定向用户到邮箱验证页面
	// 用户需要先验证邮箱（输入收到的验证码），然后才能设置新密码
	return redirect("/reset-password/verify-email");
}

/**
 * 操作结果接口定义
 * 
 * 这个接口定义了操作结果的数据结构，包含一个消息字段
 */
interface ActionResult {
	message: string; // 操作结果消息
}

/**
 * 忘记密码流程完整说明：
 * 
 * 1. 用户在登录页点击"忘记密码"链接，进入忘记密码页面
 * 2. 用户输入注册时使用的邮箱地址
 * 3. 系统验证邮箱格式和账号存在性
 * 4. 系统生成密码重置会话和验证码
 * 5. 系统发送包含验证码的邮件到用户邮箱
 * 6. 用户被重定向到邮箱验证页面
 * 7. 用户需要查看邮箱，获取验证码
 * 8. 用户输入验证码，验证成功后才能设置新密码
 * 
 * 安全机制：
 * - 双重速率限制（IP和用户ID）防止滥用
 * - 新的密码重置请求会使旧的请求失效，避免多个有效的重置链接
 * - 需要先验证邮箱后才能重置密码，确保是账号所有者操作
 * - 整个流程都有时效性限制，过期后需要重新发起请求
 */
