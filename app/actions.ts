/**
 * 应用级别的服务端动作
 * 
 * 这个文件定义了应用级别的服务端动作（Server Actions），主要处理全局性的用户操作。
 * 主要职责：
 * 1. 处理用户登出操作
 * 2. 实现请求频率限制
 * 3. 管理用户会话状态
 * 4. 处理认证相关的重定向
 */

"use server";

import { globalPOSTRateLimit } from "@/lib/server/request";
import { deleteSessionTokenCookie, getCurrentSession, invalidateSession } from "@/lib/server/session";
import { redirect } from "next/navigation";

/**
 * 登出动作处理函数
 * 
 * 处理用户的登出请求，包括：
 * 1. 检查请求频率限制
 * 2. 验证当前会话状态
 * 3. 清理会话数据
 * 4. 重定向到登录页面
 * 
 * @returns {Promise<ActionResult>} 返回操作结果，包含状态消息或重定向
 */
export async function logoutAction(): Promise<ActionResult> {
	if (!globalPOSTRateLimit()) {
		return {
			message: "Too many requests"
		};
	}
	const { session } = getCurrentSession();
	if (session === null) {
		return {
			message: "Not authenticated"
		};
	}
	invalidateSession(session.id);
	deleteSessionTokenCookie();
	return redirect("/login");
}

/**
 * 动作结果接口
 * 
 * @interface ActionResult
 * @property {string} message - 操作结果消息
 */
interface ActionResult {
	message: string;
}
