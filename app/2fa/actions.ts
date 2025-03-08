/**
 * 双因素认证(2FA)验证功能模块
 * 
 * 这个文件负责处理用户进行双因素认证验证的流程，包括：
 * 1. 验证用户输入的2FA验证码
 * 2. 限制验证尝试次数，防止暴力破解
 * 3. 验证成功后，标记当前会话为已通过2FA验证
 * 
 * 双因素认证是一种安全机制，要求用户除了使用密码外，还需要提供第二种验证方式
 * （通常是手机验证器app生成的一次性代码），提高账号安全性。
 */

"use server"; // 标记这是一个服务器端动作，只在服务器上执行

// 导入所需的功能模块
import { totpBucket } from "@/lib/server/2fa";  // 2FA请求限制器
import { globalPOSTRateLimit } from "@/lib/server/request";  // 全局POST请求限制
import { getCurrentSession, setSessionAs2FAVerified } from "@/lib/server/session"; // 会话管理
import { getUserTOTPKey } from "@/lib/server/user";  // 获取用户的TOTP密钥
import { verifyTOTP } from "@oslojs/otp";  // TOTP验证工具
import { redirect } from "next/navigation";  // 页面重定向

/**
 * 2FA验证动作处理函数
 * 
 * 这个函数处理用户提交的2FA验证码，验证其有效性，并完成2FA验证过程
 * 
 * @param _prev - 上一次操作的结果（这里不使用）
 * @param formData - 用户提交的表单数据
 * @returns 操作结果或重定向指令
 */
export async function verify2FAAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
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
	
	// 第三步：检查用户状态是否允许进行2FA验证
	// 需要满足：邮箱已验证 && 已设置2FA && 当前会话未通过2FA验证
	if (!user.emailVerified || !user.registered2FA || session.twoFactorVerified) {
		return {
			message: "Forbidden" // 返回"禁止访问"的错误信息
		};
	}
	
	// 第四步：检查用户是否超过2FA验证尝试次数限制
	if (!totpBucket.check(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第五步：获取并验证表单数据
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
	
	// 第六步：消耗用户的2FA验证尝试次数（实际验证前的最终检查）
	if (!totpBucket.consume(user.id, 1)) {
		return {
			message: "Too many requests" // 返回"请求过多"的错误信息
		};
	}
	
	// 第七步：获取用户的TOTP密钥
	const totpKey = getUserTOTPKey(user.id);
	
	// 如果用户没有TOTP密钥（理论上不应该发生，因为前面已检查registered2FA）
	if (totpKey === null) {
		return {
			message: "Forbidden" // 返回"禁止访问"的错误信息
		};
	}
	
	// 第八步：验证TOTP代码是否正确
	// 参数说明：
	// - totpKey: 用户的TOTP密钥
	// - 30: TOTP的时间窗口（30秒）
	// - 6: 验证码长度（6位数字）
	// - code: 用户输入的验证码
	if (!verifyTOTP(totpKey, 30, 6, code)) {
		return {
			message: "Invalid code" // 返回"无效验证码"的错误信息
		};
	}
	
	// 第九步：验证成功，重置用户的2FA验证尝试次数限制
	totpBucket.reset(user.id);
	
	// 第十步：标记当前会话为已通过2FA验证
	setSessionAs2FAVerified(session.id);
	
	// 第十一步：重定向用户到首页
	return redirect("/");
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
 * 双因素认证完整流程说明：
 * 
 * 1. 用户先通过用户名和密码登录
 * 2. 如果账号已设置2FA，系统会导向2FA验证页面
 * 3. 用户打开手机验证器应用程序(如Google Authenticator、Authy等)
 * 4. 应用程序显示与用户账号关联的6位动态码(每30秒更新一次)
 * 5. 用户输入这个6位数字验证码
 * 6. 系统验证代码是否正确
 * 7. 验证成功后，用户可以完全访问其账号
 * 
 * 安全机制：
 * - 速率限制防止暴力破解验证码
 * - 使用标准的TOTP算法(RFC 6238)，与大多数验证器应用兼容
 * - 验证成功后重置尝试限制，避免合法用户被长时间锁定
 * - 严格的状态检查确保用户必须按正确的顺序完成所有认证步骤
 */
