"use client"; // 声明这是一个客户端组件，会在浏览器中运行而不是服务器上

/**
 * 双因素认证重置页面的组件
 * ===================
 * 
 * 本文件实现了用户重置双因素认证(2FA)时使用的表单组件。
 * 当用户无法访问其身份验证器应用（如丢失手机）时，
 * 可以使用之前保存的恢复码来重置2FA。
 */

import { reset2FAAction } from "./actions";
import { useFormState } from "react-dom";

/**
 * 表单初始状态
 * 定义了表单的初始状态，最开始没有任何消息显示
 */
const initial2FAResetState = {
	message: ""
};

/**
 * 双因素认证重置表单组件
 * 提供一个输入框让用户输入恢复码，以重置其2FA设置
 * 
 * 当用户提交表单时，会调用reset2FAAction函数验证恢复码
 */
export function TwoFactorResetForm() {
	// 使用React的useFormState钩子处理表单状态和提交
	// state包含表单的当前状态，比如验证消息
	// action是绑定到表单的处理函数
	const [state, action] = useFormState(reset2FAAction, initial2FAResetState);
	
	return (
		<form action={action}>
			{/* 恢复码输入字段 */}
			<label htmlFor="form-totp.code">Recovery code</label>
			<input id="form-totp.code" name="code" required />
			<br />
			
			{/* 提交按钮 */}
			<button>Verify</button>
			
			{/* 显示操作结果消息，比如错误提示或成功消息 */}
			<p>{state.message ?? ""}</p>
		</form>
	);
}

/**
 * 使用说明：
 * 1. 当用户无法访问其身份验证器应用时，可以访问此恢复页面
 * 2. 用户需要输入之前在设置2FA时获取的恢复码
 * 3. 如果恢复码正确，用户的2FA将被重置，用户会被重定向到2FA设置页面
 * 4. 如果恢复码错误，表单将显示错误消息
 * 
 * 注意：恢复码是用户在初次设置2FA后获得的一次性代码，
 * 用户应该将这些代码保存在安全的地方，以备在无法访问身份验证器应用时使用。
 * 每个恢复码只能使用一次，使用后即失效。
 */
