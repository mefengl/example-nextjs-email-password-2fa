"use server"; // 声明这是一个服务器端组件，这意味着这个文件中的代码只会在服务器上运行

/**
 * 双因素认证(2FA)重置功能
 * ===================
 * 
 * 本文件实现了用户使用恢复码重置双因素认证的服务器端功能。
 * 恢复码是用户在启用2FA时生成的备用码，当用户无法访问其身份验证器应用
 * (例如丢失手机或更换设备)时，可以使用恢复码来重置2FA。
 */

import { recoveryCodeBucket, resetUser2FAWithRecoveryCode } from "@/lib/server/2fa";
import { getCurrentSession } from "@/lib/server/session";
import { redirect } from "next/navigation";

/**
 * 重置双因素认证的服务器端函数
 * 
 * @param _prev 前一个操作的结果（Next.js的表单处理机制需要）
 * @param formData 包含用户提交的表单数据，主要是恢复码
 * @returns 返回操作结果，可能是错误信息或重定向指令
 */
export async function reset2FAAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	// 获取当前用户的会话和用户信息
	const { session, user } = getCurrentSession();
	
	// 检查用户是否已登录，未登录则拒绝操作
	if (session === null) {
		return {
			message: "Not authenticated" // 用户未登录
		};
	}

	// 权限检查：
	// 1. 用户必须已验证邮箱
	// 2. 用户必须已注册2FA
	// 3. 当前会话不能已经通过2FA验证（如果已通过，就不需要重置了）
	if (!user.emailVerified || !user.registered2FA || session.twoFactorVerified) {
		return {
			message: "Forbidden" // 没有权限进行此操作
		};
	}

	// 检查用户是否达到了尝试次数限制
	// 这是为了防止暴力破解恢复码
	if (!recoveryCodeBucket.check(user.id, 1)) {
		return {
			message: "Too many requests" // 用户尝试次数过多，被限流
		};
	}

	// 从表单数据中获取恢复码
	const code = formData.get("code");
	
	// 验证恢复码是否为字符串类型
	if (typeof code !== "string") {
		return {
			message: "Invalid or missing fields" // 恢复码格式不正确
		};
	}

	// 验证恢复码是否为空
	if (code === "") {
		return {
			message: "Please enter your code" // 提示用户输入恢复码
		};
	}

	// 消耗用户的尝试次数配额
	// 这一步放在实际验证前，是为了防止暴力破解攻击
	if (!recoveryCodeBucket.consume(user.id, 1)) {
		return {
			message: "Too many requests" // 再次检查限流，以防在处理过程中达到限制
		};
	}

	// 使用恢复码尝试重置用户的2FA
	// 如果恢复码正确，这个函数会重置用户的2FA设置
	const valid = resetUser2FAWithRecoveryCode(user.id, code);
	
	// 如果恢复码无效，返回错误消息
	if (!valid) {
		return {
			message: "Invalid recovery code" // 恢复码不正确
		};
	}

	// 重置成功后，重置用户的恢复码尝试次数限制
	// 这样用户可以立即开始新的2FA设置而不受之前尝试次数的限制
	recoveryCodeBucket.reset(user.id);
	
	// 重定向用户到2FA设置页面，让用户重新设置2FA
	return redirect("/2fa/setup");
}

/**
 * 定义操作结果的接口类型
 * 操作结果包含一个message字段，用于向用户显示操作状态或错误信息
 */
interface ActionResult {
	message: string;
}

/**
 * 总体流程说明：
 * 1. 用户无法访问其身份验证器应用时，进入2FA重置页面
 * 2. 用户输入之前在启用2FA时获得的恢复码
 * 3. 系统验证恢复码是否正确
 * 4. 如果正确，系统会禁用用户的当前2FA设置
 * 5. 用户被重定向到2FA设置页面，可以重新设置2FA
 * 
 * 安全考虑：
 * - 恢复码尝试次数有限制，防止暴力破解
 * - 只有当用户已登录且已验证邮箱时才能重置2FA
 * - 如果当前会话已通过2FA验证，则不允许重置（可能是攻击者尝试降低安全级别）
 */
