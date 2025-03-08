/**
 * 用户设置组件模块
 * 
 * 这个文件实现了用户设置页面的三个主要组件：
 * 1. 更新密码表单
 * 2. 更新邮箱表单
 * 3. 恢复码管理部分
 * 
 * 通过这些组件，用户可以管理自己的账号安全信息，
 * 提高账号的安全性和可恢复性。
 */

"use client"; // 这个标记表示这是一个客户端组件，会在浏览器中运行

// 导入必要的函数和钩子
import { useState } from "react"; // React状态钩子
import { regenerateRecoveryCodeAction, updateEmailAction, updatePasswordAction } from "./actions"; // 导入服务器动作
import { useFormState } from "react-dom"; // 表单状态管理钩子

/**
 * 更新密码表单初始状态
 * 
 * 定义了更新密码表单的初始状态，包含一个空的消息
 * 这个状态会在表单提交后被更新，用于显示处理结果或错误信息
 */
const initialUpdatePasswordState = {
	message: "" // 初始时没有消息
};

/**
 * 更新密码表单组件
 * 
 * 这个组件创建一个表单，让用户输入当前密码和新密码
 * 以便更新账号密码
 * 
 * @returns React组件，显示更新密码表单界面
 */
export function UpdatePasswordForm() {
	// useFormState钩子用于管理表单状态
	// - updatePasswordAction: 表单提交时调用的服务器动作函数
	// - initialUpdatePasswordState: 表单的初始状态
	const [state, action] = useFormState(updatePasswordAction, initialUpdatePasswordState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 当前密码输入字段 */}
			<label htmlFor="form-password.password">Current password</label>
			<input 
				type="password" // 输入类型为password，输入内容会被隐藏
				id="form-email.password" // 输入框的ID，与label关联
				name="password" // 输入框的名称，服务器会用这个名称获取值
				autoComplete="current-password" // 告诉浏览器这是当前密码字段
				required // 必填字段
			/>
			<br />
			
			{/* 新密码输入字段 */}
			<label htmlFor="form-password.new-password">New password</label>
			<input 
				type="password" // 输入类型为password，输入内容会被隐藏
				id="form-password.new-password" // 输入框的ID，与label关联
				name="new_password" // 输入框的名称，服务器会用这个名称获取值
				autoComplete="new-password" // 告诉浏览器这是新密码字段
				required // 必填字段
			/>
			<br />
			
			{/* 提交按钮 */}
			<button>Update</button>
			
			{/* 显示处理结果消息 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 更新邮箱表单初始状态
 * 
 * 定义了更新邮箱表单的初始状态，包含一个空的消息
 * 这个状态会在表单提交后被更新，用于显示处理结果或错误信息
 */
const initialUpdateFormState = {
	message: "" // 初始时没有消息
};

/**
 * 更新邮箱表单组件
 * 
 * 这个组件创建一个表单，让用户输入新的邮箱地址
 * 以便更新账号关联的邮箱
 * 
 * @returns React组件，显示更新邮箱表单界面
 */
export function UpdateEmailForm() {
	// useFormState钩子用于管理表单状态
	// - updateEmailAction: 表单提交时调用的服务器动作函数
	// - initialUpdateFormState: 表单的初始状态
	const [state, action] = useFormState(updateEmailAction, initialUpdateFormState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 新邮箱输入字段 */}
			<label htmlFor="form-email.email">New email</label>
			<input 
				type="email" // 输入类型为email，浏览器会验证格式
				id="form-email.email" // 输入框的ID，与label关联
				name="email" // 输入框的名称，服务器会用这个名称获取值
				required // 必填字段
			/>
			<br />
			
			{/* 提交按钮 */}
			<button>Update</button>
			
			{/* 显示处理结果消息 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 恢复码部分组件
 * 
 * 这个组件显示用户的恢复码，并提供生成新恢复码的功能
 * 恢复码用于在用户无法使用2FA设备时，作为备用登录方式
 * 
 * @param props - 组件属性，包含用户当前的恢复码
 * @returns React组件，显示恢复码和管理功能
 */
export function RecoveryCodeSection(props: { recoveryCode: string }) {
	// useState钩子用于管理恢复码状态
	// 初始值是从props传入的当前恢复码
	const [recoveryCode, setRecoveryCode] = useState(props.recoveryCode);

	return (
		<section>
			{/* 部分标题 */}
			<h1>Recovery code</h1>
			
			{/* 显示当前恢复码 */}
			<p>Your recovery code is: {recoveryCode}</p>
			
			{/* 生成新恢复码按钮 */}
			<button
				onClick={async () => {
					// 点击按钮时调用重新生成恢复码的服务器动作
					const result = await regenerateRecoveryCodeAction();
					
					// 如果成功获取到新的恢复码，更新状态
					if (result.recoveryCode !== null) {
						setRecoveryCode(result.recoveryCode);
					}
				}}
			>
				Generate new code
			</button>
		</section>
	);
}

/**
 * 组件工作流程说明:
 * 
 * 1. 更新密码流程:
 *    - 用户输入当前密码（验证身份）和新密码
 *    - 提交后，服务器验证当前密码并检查新密码强度
 *    - 如果验证通过，密码被更新，所有其他会话被终止
 *    - 当前会话被保留（自动重新登录）
 * 
 * 2. 更新邮箱流程:
 *    - 用户输入新的邮箱地址
 *    - 提交后，服务器验证邮箱格式和可用性
 *    - 系统发送验证码到新邮箱
 *    - 用户被重定向到邮箱验证页面
 * 
 * 3. 恢复码管理流程:
 *    - 页面加载时显示当前的恢复码
 *    - 用户可以点击按钮生成新的恢复码
 *    - 生成新恢复码后，旧恢复码立即失效
 *    - 用户应当立即保存新的恢复码（安全考量）
 * 
 * 安全考量:
 * - 所有表单操作在服务器端验证和执行，客户端仅负责用户界面
 * - 密码输入不可见，保护用户隐私
 * - 使用autoComplete属性帮助浏览器正确管理密码
 * - 恢复码使用客户端状态管理，确保即时反馈新生成的恢复码
 */
