'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, Eye, EyeOff, Mail, Lock, ArrowRight, MessageSquare, Users, Megaphone, Bot, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoginPageProps {
  onLogin: (user: { id: string; email: string; name: string; role: string }, token?: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.error?.includes('pending approval')) {
          toast({
            title: 'Account Pending Approval',
            description: 'Your account has not been approved yet. Please contact the admin.',
            duration: 6000,
            variant: 'destructive',
          });
        } else if (res.status === 403 && data.error?.includes('deactivated')) {
          toast({
            title: 'Account Deactivated',
            description: 'Your account has been deactivated. Please contact the admin.',
            duration: 6000,
            variant: 'destructive',
          });
        } else {
          throw new Error(data.error || 'Login failed');
        }
        return;
      }
      onLogin(data.user, data.token);
      toast({ title: 'Welcome!', description: 'Signed in successfully' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast({ title: 'Error', description: "Passwords don't match", variant: 'destructive' });
      return;
    }
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      if (data.isApproved && data.token) {
        onLogin(data.user, data.token);
        toast({ title: 'Welcome!', description: 'Admin account created successfully' });
      } else {
        setRegisterForm({ name: '', email: '', password: '', confirmPassword: '' });
        setIsLoginView(true);
        toast({
          title: 'Registration Submitted',
          description: 'Your account is pending admin approval. You will be able to login once approved.',
          duration: 6000,
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: MessageSquare,
      text: 'Manage conversations efficiently',
    },
    {
      icon: Users,
      text: 'Organize your contacts and leads',
    },
    {
      icon: Megaphone,
      text: 'Run targeted campaigns',
    },
    {
      icon: Bot,
      text: 'Automate workflows with smart rules',
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #00a885 0%, #00c896 50%, #00d4a0 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute top-1/4 -right-16 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute bottom-1/4 left-10 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute -bottom-10 right-1/4 w-56 h-56 bg-white/5 rounded-full" />
        </div>

        {/* Top: Logo + Title */}
        <div className="relative z-10 px-12 pt-16">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.12 1.52 5.856L0 24l6.336-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.984 0-3.827-.546-5.407-1.494l-.388-.231-3.76.988.998-3.648-.253-.404A9.776 9.776 0 012.18 12c0-5.422 4.398-9.82 9.82-9.82 5.422 0 9.82 4.398 9.82 9.82 0 5.422-4.398 9.82-9.82 9.82z"/>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-1">WhatsApp Business</h1>
          <p className="text-xl text-white/90 font-medium">Management System</p>
        </div>

        {/* Middle: Feature cards */}
        <div className="relative z-10 px-12 space-y-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/95 text-base font-medium">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Bottom: Copyright */}
        <div className="relative z-10 px-12 pb-10">
          <p className="text-white/50 text-sm">
            &copy; {new Date().getFullYear()} WhatsApp Business Manager. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative"
        style={{ backgroundColor: '#f5f7fa' }}
      >
        {/* Mobile top branding — only visible on small screens */}
        <div className="absolute top-0 left-0 right-0 lg:hidden flex flex-col items-center pt-8 pb-4"
          style={{
            background: 'linear-gradient(135deg, #00a885 0%, #00c896 100%)',
          }}
        >
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-2">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.12 1.52 5.856L0 24l6.336-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.984 0-3.827-.546-5.407-1.494l-.388-.231-3.76.988.998-3.648-.253-.404A9.776 9.776 0 012.18 12c0-5.422 4.398-9.82 9.82-9.82 5.422 0 9.82 4.398 9.82 9.82 0 5.422-4.398 9.82-9.82 9.82z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">WhatsApp Business</h1>
          <p className="text-sm text-white/80">Management System</p>
        </div>

        <div className="w-full max-w-md px-6 pt-32 lg:pt-0">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10">
            {/* Back to login button (register view only) */}
            {!isLoginView && (
              <button
                type="button"
                onClick={() => setIsLoginView(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>
            )}

            {isLoginView ? (
              <>
                {/* Login Header */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                  <p className="text-gray-500 text-sm md:text-base">
                    Sign in to your WhatsApp Business Manager
                  </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium text-gray-700">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10 h-11 bg-gray-50/80 border-gray-200 focus:border-[#00a885] focus:ring-[#00a885]/20 rounded-lg"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className="pl-10 pr-10 h-11 bg-gray-50/80 border-gray-200 focus:border-[#00a885] focus:ring-[#00a885]/20 rounded-lg"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me + Forgot Password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-[#00a885] focus:ring-[#00a885]/20"
                      />
                      <span className="text-sm text-gray-600">Remember me</span>
                    </label>
                    <button
                      type="button"
                      className="text-sm font-medium hover:underline transition-colors"
                      style={{ color: '#00a885' }}
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Sign In Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg text-white font-medium text-base transition-all duration-300 hover:shadow-lg hover:shadow-[#00a885]/25"
                    style={{
                      background: 'linear-gradient(135deg, #00a885 0%, #00c896 100%)',
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing In...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Sign In
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </form>

                {/* Create account link */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsLoginView(false)}
                      className="font-semibold hover:underline transition-colors"
                      style={{ color: '#00a885' }}
                    >
                      Create one
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Register Header */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
                  <p className="text-gray-500 text-sm md:text-base">
                    Join the WhatsApp Business Manager
                  </p>
                </div>

                {/* Register Form */}
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Info notice */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      First user becomes admin automatically. Subsequent accounts require admin approval before login.
                    </p>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-sm font-medium text-gray-700">
                      Full Name
                    </Label>
                    <Input
                      id="reg-name"
                      placeholder="John Doe"
                      className="h-11 bg-gray-50/80 border-gray-200 focus:border-[#00a885] focus:ring-[#00a885]/20 rounded-lg"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-sm font-medium text-gray-700">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10 h-11 bg-gray-50/80 border-gray-200 focus:border-[#00a885] focus:ring-[#00a885]/20 rounded-lg"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="reg-password"
                        type={showRegisterPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className="pl-10 pr-10 h-11 bg-gray-50/80 border-gray-200 focus:border-[#00a885] focus:ring-[#00a885]/20 rounded-lg"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm" className="text-sm font-medium text-gray-700">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="reg-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        className="pl-10 pr-10 h-11 bg-gray-50/80 border-gray-200 focus:border-[#00a885] focus:ring-[#00a885]/20 rounded-lg"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Create Account Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg text-white font-medium text-base transition-all duration-300 hover:shadow-lg hover:shadow-[#00a885]/25"
                    style={{
                      background: 'linear-gradient(135deg, #00a885 0%, #00c896 100%)',
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating Account...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Create Account
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </form>

                {/* Sign in link */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsLoginView(true)}
                      className="font-semibold hover:underline transition-colors"
                      style={{ color: '#00a885' }}
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Mobile copyright */}
          <p className="mt-6 text-center text-xs text-gray-400 lg:hidden">
            &copy; {new Date().getFullYear()} WhatsApp Business Manager. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
