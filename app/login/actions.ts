/**
 * 用户登录功能模块
 * 
 * 这个文件负责处理用户登录过程中的所有操作，包括：
 * 1. 验证用户提交的登录表单数据（邮箱、密码）
 * 2. 检查用户账号是否存在
 * 3. 验证密码是否正确
 * 4. 创建用户会话（登录状态）
 * 5. 根据用户状态进行适当的重定向
 * 
 * 整个过程中实施了多重安全机制：
 * - 全局请求速率限制
 * - IP地址速率限制
 * - 用户账号登录失败递增延迟（防止暴力破解）
 */

"use server"; // 标记这是一个服务器端动作，只在服务器上执行

// 导入所需的功能模块
import { verifyEmailInput } from "@/lib/server/email";
import { verifyPasswordHash } from "@/lib/server/password";
import { RefillingTokenBucket, Throttler } from "@/lib/server/rate-limit";
import { createSession, generateSessionToken, setSessionTokenCookie } from "@/lib/server/session";
import { getUserFromEmail, getUserPasswordHash } from "@/lib/server/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { globalPOSTRateLimit } from "@/lib/server/request";
import type { SessionFlags } from "@/lib/server/session";

/**
 * 账号登录失败延迟器
 * 
 * 这个变量创建了一个"节流器"，用来限制用户登录失败后的重试速度：
 * - 数组中的每个数字代表失败后需要等待的秒数
 * - 随着连续失败次数增加，等待时间逐渐增长
 * 
 * 例如:
 * - 第一次失败后需等待1秒
 * - 第二次失败后需等待2秒
 * - 第三次失败后需等待4秒
 * ...以此类推，最长等待300秒（5分钟）
 * 
 * 这种递增延迟可以有效防止暴力破解密码
 */
const throttler = new Throttler<number>([1, 2, 4, 8, 16, 30, 60, 180, 300]);

/**
 * IP地址速率限制器
 * 
 * 这个变量创建了一个"令牌桶"，用来限制同一个IP地址的登录请求数量：
 * - 每个桶最多有20个令牌
 * - 每1秒钟添加1个新令牌
 * 
 * 这意味着同一个IP地址：
 * - 短时间内最多可以尝试20次登录
 * - 之后每秒才能尝试1次新的登录
 */
const ipBucket = new RefillingTokenBucket<string>(20, 1);

/**
 * 登录动作处理函数
 * 
 * 这个函数处理用户提交的登录表单，验证数据，并完成登录过程
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果或重定向指令
 */
export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
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
	const email = formData.get("email");    // 获取邮箱
	const password = formData.get("password"); // 获取密码
	
	// 检查所有字段是否都是字符串类型
	if (typeof email !== "string" || typeof password !== "string") {
		return {
			message: "Invalid or missing fields" // 返回"无效或缺失字段"的错误信息
		};
	}
	
	// 检查是否有空字段
	if (email === "" || password === "") {
		return {
			message: "Please enter your email and password." // 返回提示用户填写所有字段的信息
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
	
	// 第六步：消耗IP令牌（实际验证前的最终IP限制检查）
	if (clientIP !== null && !ipBucket.consume(clientIP, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第七步：检查用户账号是否被限制登录（连续失败后需要等待）
	// consume方法会检查是否需要等待，并更新失败计数
	if (!throttler.consume(user.id)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第八步：获取用户的密码哈希值
	const passwordHash = getUserPasswordHash(user.id);
	
	// 第九步：验证密码是否正确
	const validPassword = await verifyPasswordHash(passwordHash, password);
	if (!validPassword) {
		return {
			message: "Invalid password" // 返回"密码错误"的错误信息
		};
	}
	
	// 第十步：密码正确，重置节流器（清除失败计数）
	throttler.reset(user.id);
	
	// 第十一步：设置会话标记，标明用户尚未完成双因素认证
	const sessionFlags: SessionFlags = {
		twoFactorVerified: false
	};
	
	// 第十二步：创建用户会话（登录状态）
	const sessionToken = generateSessionToken(); // 生成会话令牌
	const session = createSession(sessionToken, user.id, sessionFlags); // 创建会话记录
	setSessionTokenCookie(sessionToken, session.expiresAt); // 设置会话cookie
	
	// 第十三步：根据用户状态重定向到适当的页面
	
	// 如果邮箱未验证，重定向到邮箱验证页面
	if (!user.emailVerified) {
		return redirect("/verify-email");
	}
	
	// 如果尚未设置双因素认证，重定向到双因素认证设置页面
	if (!user.registered2FA) {
		return redirect("/2fa/setup");
	}
	
	// 用户已设置双因素认证，重定向到双因素认证页面
	return redirect("/2fa");
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
 * 登录流程完整说明：
 * 
 * 1. 用户提交登录表单（包含邮箱和密码）
 * 2. 系统验证邮箱格式和账号存在性
 * 3. 系统检查该用户是否因连续登录失败而被限制（需要等待）
 * 4. 系统验证密码是否正确
 * 5. 如果密码错误，增加失败计数（下次登录需等待更长时间）
 * 6. 如果密码正确，重置失败计数，创建用户会话
 * 7. 根据用户状态重定向到不同页面：
 *    - 邮箱未验证 → 邮箱验证页面
 *    - 未设置2FA → 2FA设置页面
 *    - 已设置2FA → 2FA验证页面
 * 
 * 安全机制：
 * - 多层速率限制防止暴力破解
 * - 递增延迟机制使暴力破解变得极其困难
 * - 密码以哈希形式存储和比较，不直接处理明文密码
 * - 严格的重定向逻辑确保用户完成所有必要的安全步骤
 */
