import { loginUsersList } from '@/lib/actions/auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const users = await loginUsersList();

  return (
    <main className="min-h-dvh bg-black flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-8">
          <span className="font-[var(--font-core)] font-extrabold text-[28px] text-[var(--gg-orange)] tracking-tight">
            GETGLOW
          </span>{' '}
          <span className="font-[var(--font-core)] font-semibold text-[12px] text-[var(--gg-pearl)] tracking-[0.18em]">
            STOCK
          </span>
        </div>
        <p className="gg-kicker mb-2">Sign in</p>
        <h1 className="font-[var(--font-core)] font-extrabold text-[30px] leading-[1.1] text-white mb-2">
          เข้าสู่ระบบคลังยา
        </h1>
        <p className="text-[var(--gg-grey-300)] text-[15px] mb-6">เลือกชื่อของคุณ แล้วใส่ PIN 4 หลัก</p>

        <LoginForm users={users} />
      </div>
    </main>
  );
}
