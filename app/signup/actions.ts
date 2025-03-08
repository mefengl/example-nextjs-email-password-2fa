/**
 * 用户注册功能模块
 * 
 * 这个文件负责处理用户注册过程中的所有操作，包括：
 * 1. 验证用户提交的表单数据（邮箱、用户名、密码）
 * 2. 检查邮箱是否已被使用
 * 3. 验证密码强度
 * 4. 创建新用户账号
 * 5. 发送邮箱验证邮件
 * 6. 创建用户会话（登录状态）
 * 7. 引导用户设置双因素认证
 * 
 * 整个过程中还实施了请求速率限制，防止恶意注册攻击。
 */

"use server"; // 这行代表这是一个服务器端动作，只在服务器上执行，不会在用户浏览器中运行

// 导入所需的功能模块
import { checkEmailAvailability, verifyEmailInput } from "@/lib/server/email";
import {
	createEmailVerificationRequest,
	sendVerificationEmail,
	setEmailVerificationRequestCookie
} from "@/lib/server/email-verification";
import { verifyPasswordStrength } from "@/lib/server/password";
import { RefillingTokenBucket } from "@/lib/server/rate-limit";
import { createSession, generateSessionToken, setSessionTokenCookie } from "@/lib/server/session";
import { createUser, verifyUsernameInput } from "@/lib/server/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { globalPOSTRateLimit } from "@/lib/server/request";
import type { SessionFlags } from "@/lib/server/session";

/**
 * IP地址速率限制器
 * 
 * 这个变量创建了一个"令牌桶"，用来限制同一个IP地址的注册请求数量：
 * - 每个桶最多有3个令牌
 * - 每10秒钟添加1个新令牌
 * 
 * 这意味着同一个IP地址：
 * - 一次最多可以尝试3次注册
 * - 之后每10秒才能尝试1次新的注册
 * 这样可以有效防止机器人大量注册账号
 */
const ipBucket = new RefillingTokenBucket<string>(3, 10);

/**
 * 注册动作处理函数
 * 
 * 这个函数处理用户提交的注册表单，验证数据，并完成注册过程
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果或重定向指令
 */
export async function signupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// 第一步：全局请求速率限制检查
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第二步：基于IP地址的速率限制检查
	// 获取客户端IP地址（通常由前端代理如Nginx设置）
	const clientIP = headers().get("X-Forwarded-For");
	
	// 如果能获取到IP地址，则检查该IP是否已经超过请求限制
	if (clientIP !== null && !ipBucket.check(clientIP, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第三步：获取并验证表单数据
	const email = formData.get("email");       // 获取邮箱
	const username = formData.get("username"); // 获取用户名
	const password = formData.get("password"); // 获取密码
	
	// 检查所有字段是否都是字符串类型
	if (typeof email !== "string" || typeof username !== "string" || typeof password !== "string") {
		return {
			message: "Invalid or missing fields" // 返回"无效或缺失字段"的错误信息
		};
	}
	
	// 检查是否有空字段
	if (email === "" || password === "" || username === "") {
		return {
			message: "Please enter your username, email, and password" // 返回提示用户填写所有字段的信息
		};
	}
	
	// 第四步：验证邮箱格式
	if (!verifyEmailInput(email)) {
		return {
			message: "Invalid email" // 返回"无效邮箱"的错误信息
		};
	}
	
	// 第五步：检查邮箱是否已被注册
	const emailAvailable = checkEmailAvailability(email);
	if (!emailAvailable) {
		return {
			message: "Email is already used" // 返回"邮箱已被使用"的错误信息
		};
	}
	
	// 第六步：验证用户名格式
	if (!verifyUsernameInput(username)) {
		return {
			message: "Invalid username" // 返回"无效用户名"的错误信息
		};
	}
	
	// 第七步：验证密码强度
	const strongPassword = await verifyPasswordStrength(password);
	if (!strongPassword) {
		return {
			message: "Weak password" // 返回"密码强度不足"的错误信息
		};
	}
	
	// 第八步：再次检查IP速率限制，并消耗一个令牌（实际操作前的最终检查）
	if (clientIP !== null && !ipBucket.consume(clientIP, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第九步：创建用户账号
	// createUser会处理密码加密等安全操作
	const user = await createUser(email, username, password);
	
	// 第十步：创建邮箱验证请求
	const emailVerificationRequest = createEmailVerificationRequest(user.id, user.email);
	
	// 第十一步：发送验证邮件
	sendVerificationEmail(emailVerificationRequest.email, emailVerificationRequest.code);
	
	// 第十二步：设置邮箱验证请求cookie
	// 这样用户访问验证页面时，系统知道他们正在验证哪个请求
	setEmailVerificationRequestCookie(emailVerificationRequest);
	
	// 第十三步：设置会话标记，标明用户尚未完成双因素认证
	const sessionFlags: SessionFlags = {
		twoFactorVerified: false
	};
	
	// 第十四步：创建用户会话（相当于用户登录）
	// 生成会话令牌
	const sessionToken = generateSessionToken();
	// 创建会话记录
	const session = createSession(sessionToken, user.id, sessionFlags);
	// 设置会话cookie
	setSessionTokenCookie(sessionToken, session.expiresAt);
	
	// 第十五步：重定向用户到双因素认证设置页面
	// 这意味着注册成功后，用户会被引导设置两步验证
	return redirect("/2fa/setup");
}

/**
 * 操作结果接口定义
 * 
 * 这个接口定义了操作结果的数据结构，包含一个消息字段
 */
interface ActionResult {
	message: string; // 操作结果消息
}
