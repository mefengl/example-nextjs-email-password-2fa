import Link from "next/link";

import { UpdateEmailForm, UpdatePasswordForm } from "./components";
import { getCurrentSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { getUserRecoverCode } from "@/lib/server/user";

export default function Page() {
	const { session, user } = getCurrentSession();
	if (session === null) {
		return redirect("/login");
	}
	if (user.registered2FA && !session.twoFactorVerified) {
		return redirect("/2fa");
	}
	let recoveryCode: string | null = null;
	if (user.registered2FA) {
		recoveryCode = getUserRecoverCode(user.id);
	}
	return (
		<>
			<header>
				<Link href="/">Home</Link>
				<Link href="/settings">Settings</Link>
			</header>
			<main>
				<h1>Settings</h1>
				<section>
					<h2>Update email</h2>
					<p>Your email: {user.email}</p>
					<UpdateEmailForm />
				</section>
				<section>
					<h2>Update password</h2>
					<UpdatePasswordForm />
				</section>
				{user.registered2FA && (
					<section>
						<h2>Update two-factor authentication</h2>
						<Link href="/2fa/setup">Update</Link>
					</section>
				)}

				{recoveryCode !== null && (
					<section>
						<h1>Recovery code</h1>
						<p>Your recovery code is: {recoveryCode}</p>
						<button>Generate new code</button>
					</section>
				)}
			</main>
		</>
	);
}
