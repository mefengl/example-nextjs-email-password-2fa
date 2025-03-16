/**
 * 应用级共享组件
 * 
 * 这个文件包含了在应用多个页面中共享的React组件。
 * 主要职责：
 * 1. 提供通用的UI组件
 * 2. 处理客户端交互
 * 3. 集成服务端动作
 */

"use client";

import { logoutAction } from "./actions";
import { useFormState } from "react-dom";

/**
 * 初始表单状态
 * 用于存储表单操作的反馈信息
 */
const initialState = {
	message: ""
};

/**
 * 登出按钮组件
 * 
 * 提供用户登出功能的按钮组件。
 * 功能特点：
 * 1. 使用 React Server Actions 处理登出逻辑
 * 2. 集成表单状态管理
 * 3. 提供简洁的用户界面
 * 
 * @returns {JSX.Element} 返回登出按钮组件
 */
export function LogoutButton() {
	const [, action] = useFormState(logoutAction, initialState);
	return (
		<form action={action}>
			<button>Sign out</button>
		</form>
	);
}
