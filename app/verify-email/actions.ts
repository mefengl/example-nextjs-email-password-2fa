/**
 * 邮箱验证功能模块
 * 
 * 这个文件负责处理用户邮箱验证流程，包括：
 * 1. 验证用户输入的邮箱验证码
 * 2. 重新发送验证码
 * 3. 更新用户邮箱验证状态
 * 4. 限制验证尝试次数，防止滥用
 * 
 * 邮箱验证是确保用户提供的邮箱是真实有效的重要步骤，
 * 可以防止垃圾账号和提高系统安全性。
 */

"use server"; // 标记这是一个服务器端动作，只在服务器上执行

// 导入所需的功能模块
import {
	createEmailVerificationRequest,
	deleteEmailVerificationRequestCookie,
	deleteUserEmailVerificationRequest,
	getUserEmailVerificationRequestFromRequest,
	sendVerificationEmail,
	sendVerificationEmailBucket,
	setEmailVerificationRequestCookie
} from "@/lib/server/email-verification";
import { invalidateUserPasswordResetSessions } from "@/lib/server/password-reset";
import { ExpiringTokenBucket } from "@/lib/server/rate-limit";
import { globalPOSTRateLimit } from "@/lib/server/request";
import { getCurrentSession } from "@/lib/server/session";
import { updateUserEmailAndSetEmailAsVerified } from "@/lib/server/user";
import { redirect } from "next/navigation";

/**
 * 邮箱验证尝试次数限制器
 * 
 * 这个变量创建了一个"过期令牌桶"，用于限制用户验证邮箱的尝试次数：
 * - 每个用户最多有5次尝试机会
 * - 令牌在30分钟后过期并刷新
 * 
 * 这样可以防止用户无限制地尝试验证码，提高安全性
 */
const bucket = new ExpiringTokenBucket<number>(5, 60 * 30);

/**
 * 验证邮箱动作处理函数
 * 
 * 这个函数处理用户提交的验证码，验证其有效性，并完成邮箱验证过程
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果或重定向指令
 */
export async function verifyEmailAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
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
	
	// 第三步：检查用户状态是否允许进行邮箱验证
	// 如果用户已设置2FA但当前会话未通过2FA验证，则禁止操作
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden" // 返回"禁止访问"的错误信息
		};
	}
	
	// 第四步：检查用户是否超过验证尝试次数限制
	if (!bucket.check(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第五步：获取用户的邮箱验证请求
	let verificationRequest = getUserEmailVerificationRequestFromRequest();
	
	// 如果没有找到验证请求，返回未认证信息
	if (verificationRequest === null) {
		return {
			message: "Not authenticated" // 返回"未认证"的错误信息
		};
	}
	
	// 第六步：获取并验证表单数据
	const code = formData.get("code"); // 获取验证码
	
	// 检查验证码是否是字符串
	if (typeof code !== "string") {
		return {
			message: "Invalid or missing fields" // 返回"无效或缺失字段"的错误信息
		};
	}
	
	// 检查验证码是否为空
	if (code === "") {
		return {
			message: "Enter your code" // 返回"请输入验证码"的提示
		};
	}
	
	// 第七步：消耗用户的验证尝试次数（实际验证前的最终检查）
	if (!bucket.consume(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第八步：检查验证码是否已过期
	if (Date.now() >= verificationRequest.expiresAt.getTime()) {
		// 验证码已过期，创建新的验证请求
		verificationRequest = createEmailVerificationRequest(verificationRequest.userId, verificationRequest.email);
		// 发送新的验证邮件
		sendVerificationEmail(verificationRequest.email, verificationRequest.code);
		return {
			message: "The verification code was expired. We sent another code to your inbox." // 返回"验证码已过期，我们已发送新的验证码"的提示
		};
	}
	
	// 第九步：检查验证码是否正确
	if (verificationRequest.code !== code) {
		return {
			message: "Incorrect code." // 返回"验证码错误"的提示
		};
	}
	
	// 第十步：验证成功，清理验证请求
	deleteUserEmailVerificationRequest(user.id); // 从数据库中删除验证请求
	
	// 第十一步：使当前用户的所有密码重置会话失效（增强安全性）
	invalidateUserPasswordResetSessions(user.id);
	
	// 第十二步：更新用户邮箱并标记为已验证
	updateUserEmailAndSetEmailAsVerified(user.id, verificationRequest.email);
	
	// 第十三步：删除验证请求cookie
	deleteEmailVerificationRequestCookie();
	
	// 第十四步：根据用户状态重定向到适当的页面
	// 如果用户尚未设置双因素认证，重定向到双因素认证设置页面
	if (!user.registered2FA) {
		return redirect("/2fa/setup");
	}
	
	// 如果用户已设置双因素认证，重定向到首页
	return redirect("/");
}

/**
 * 重新发送邮箱验证码动作处理函数
 * 
 * 这个函数用于处理用户请求重新发送验证码的情况
 * 
 * @returns 操作结果
 */
export async function resendEmailVerificationCodeAction(): Promise<ActionResult> {
	// 第一步：获取当前用户的会话信息
	const { session, user } = getCurrentSession();
	
	// 如果用户未登录，返回未认证信息
	if (session === null) {
		return {
			message: "Not authenticated" // 返回"未认证"的错误信息
		};
	}
	
	// 第二步：检查用户状态是否允许请求验证码
	// 如果用户已设置2FA但当前会话未通过2FA验证，则禁止操作
	if (user.registered2FA && !session.twoFactorVerified) {
		return {
			message: "Forbidden" // 返回"禁止访问"的错误信息
		};
	}
	
	// 第三步：检查用户是否超过发送验证码的频率限制
	if (!sendVerificationEmailBucket.check(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第四步：获取用户的邮箱验证请求
	let verificationRequest = getUserEmailVerificationRequestFromRequest();
	
	// 第五步：根据不同情况处理验证请求
	if (verificationRequest === null) {
		// 情况一：没有找到验证请求
		
		// 如果用户邮箱已验证，则禁止操作
		if (user.emailVerified) {
			return {
				message: "Forbidden" // 返回"禁止访问"的错误信息
			};
		}
		
		// 消耗用户的发送验证码次数
		if (!sendVerificationEmailBucket.consume(user.id, 1)) {
			return {
				message: "Too many requests" // 返回"请求过多"的错误信息
			};
		}
		
		// 为用户创建新的验证请求
		verificationRequest = createEmailVerificationRequest(user.id, user.email);
	} else {
		// 情况二：找到了验证请求
		
		// 消耗用户的发送验证码次数
		if (!sendVerificationEmailBucket.consume(user.id, 1)) {
			return {
				message: "Too many requests" // 返回"请求过多"的错误信息
			};
		}
		
		// 创建新的验证请求，替换旧的
		verificationRequest = createEmailVerificationRequest(user.id, verificationRequest.email);
	}
	
	// 第六步：发送验证邮件
	sendVerificationEmail(verificationRequest.email, verificationRequest.code);
	
	// 第七步：设置验证请求cookie
	setEmailVerificationRequestCookie(verificationRequest);
	
	// 第八步：返回成功消息
	return {
		message: "A new code was sent to your inbox." // 返回"新的验证码已发送到您的邮箱"的提示
	};
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
 * 邮箱验证完整流程说明：
 * 
 * 1. 用户注册账号或更新邮箱后，系统自动向用户邮箱发送验证码
 * 2. 用户收到验证码邮件，并在验证页面输入验证码
 * 3. 系统验证用户输入的验证码是否正确、是否过期
 * 4. 验证成功后，用户的邮箱被标记为"已验证"状态
 * 5. 如果用户未设置2FA，会被引导设置双因素认证
 * 6. 如果验证码过期或用户未收到，可以请求重新发送
 * 
 * 安全机制：
 * - 限制验证尝试次数，防止暴力破解
 * - 限制验证码发送频率，防止滥用
 * - 验证码有有效期限制
 * - 邮箱验证成功后会使所有密码重置会话失效，防止攻击者利用旧的密码重置链接
 */
