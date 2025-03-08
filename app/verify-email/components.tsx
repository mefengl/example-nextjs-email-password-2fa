/**
 * 邮箱验证表单组件模块
 * 
 * 这个文件实现了两个组件：
 * 1. 邮箱验证码验证表单 - 用于用户输入收到的验证码
 * 2. 重新发送验证码表单 - 用于用户请求重新发送验证码
 * 
 * 这些组件是邮箱验证流程的用户界面部分，配合actions.ts中的服务器端逻辑一起工作。
 */

"use client"; // 这个标记表示这是一个客户端组件，会在浏览器中运行

// 导入必要的函数和钩子
import { resendEmailVerificationCodeAction, verifyEmailAction } from "./actions"; // 导入验证邮箱和重发验证码的服务器动作
import { useFormState } from "react-dom"; // 导入表单状态管理钩子

/**
 * 邮箱验证表单初始状态
 * 
 * 定义了邮箱验证表单的初始状态，包含一个空的消息
 * 这个状态会在表单提交后被更新，用于显示验证结果或错误信息
 */
const emailVerificationInitialState = {
	message: "" // 初始时没有消息
};

/**
 * 邮箱验证表单组件
 * 
 * 这个组件创建一个表单，让用户输入从邮箱中收到的验证码
 * 
 * @returns React组件，显示验证码输入表单
 */
export function EmailVerificationForm() {
	// useFormState钩子用于管理表单状态
	// - verifyEmailAction: 表单提交时调用的服务器动作函数
	// - emailVerificationInitialState: 表单的初始状态
	// - state: 当前表单状态，包含服务器返回的消息
	// - action: 提交表单时调用的函数
	const [state, action] = useFormState(verifyEmailAction, emailVerificationInitialState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 验证码输入字段 */}
			<label htmlFor="form-verify.code">Code</label>
			<input 
				id="form-verify.code" // 输入框的ID，与label关联
				name="code" // 输入框的名称，服务器会用这个名称获取值
				required // 必填字段
			/>
			
			{/* 提交按钮 */}
			<button>Verify</button>
			
			{/* 显示验证结果消息 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 重新发送验证码表单初始状态
 * 
 * 定义了重发验证码表单的初始状态，包含一个空的消息
 * 这个状态会在表单提交后被更新，用于显示重发结果
 */
const resendEmailInitialState = {
	message: "" // 初始时没有消息
};

/**
 * 重新发送邮箱验证码表单组件
 * 
 * 这个组件创建一个简单的表单，只有一个按钮，用于请求重新发送验证码
 * 适用于用户未收到验证码或验证码已过期的情况
 * 
 * @returns React组件，显示重发验证码按钮
 */
export function ResendEmailVerificationCodeForm() {
	// useFormState钩子用于管理表单状态
	// - resendEmailVerificationCodeAction: 表单提交时调用的服务器动作函数
	// - resendEmailInitialState: 表单的初始状态
	// - state: 当前表单状态，包含服务器返回的消息
	// - action: 提交表单时调用的函数
	const [state, action] = useFormState(resendEmailVerificationCodeAction, resendEmailInitialState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 重发验证码按钮 */}
			<button>Resend code</button>
			
			{/* 显示重发结果消息 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 组件工作流程说明:
 * 
 * 1. EmailVerificationForm（验证邮箱流程）:
 *    - 用户在注册或更改邮箱后，会收到一封包含验证码的邮件
 *    - 用户输入验证码到表单中并点击"Verify"按钮
 *    - 验证码被发送到服务器进行验证(通过verifyEmailAction)
 *    - 如果验证成功，用户会被重定向到下一个页面
 *    - 如果验证失败，会显示错误消息
 * 
 * 2. ResendEmailVerificationCodeForm（重发验证码流程）:
 *    - 如果用户未收到验证邮件或验证码已过期
 *    - 用户点击"Resend code"按钮
 *    - 系统会生成新的验证码并发送新的验证邮件
 *    - 页面显示重发结果消息
 * 
 * 这两个组件通常会同时出现在邮箱验证页面上，给用户提供完整的验证体验。
 */
