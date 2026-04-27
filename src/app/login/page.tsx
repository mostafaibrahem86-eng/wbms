'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type FormState = 'login' | 'register' | 'forgot-password';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Add login-page class to body for proper scrolling
  useEffect(() => {
    document.body.classList.add('login-page');
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);
  const [formState, setFormState] = useState<FormState>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [animationClass, setAnimationClass] = useState('form-enter');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const redirect = searchParams.get('redirect');
    if (redirect) {
      // User was redirected from a protected route
    }
  }, [searchParams]);

  const switchForm = useCallback((newState: FormState) => {
    setAnimationClass('form-exit');
    setTimeout(() => {
      setFormState(newState);
      setError('');
      setSuccess('');
      setAnimationClass('form-enter');
    }, 200);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'pending_approval') {
          setError(data.message || 'حسابك في انتظار موافقة المسؤول. يرجى الانتظار حتى يتم اعتماد طلبك.');
        } else if (data.error === 'account_disabled') {
          setError(data.message || 'حسابك معطل. يرجى التواصل مع المسؤول.');
        } else {
          setError(data.error || 'Login failed');
        }
        setLoading(false);
        return;
      }

      // Success - save user to sessionStorage for immediate restore, then redirect
      if (data.user) {
        sessionStorage.setItem('wbms_user', JSON.stringify(data.user));
      }
      const redirect = searchParams.get('redirect') || '/';
      window.location.href = redirect;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Success
      if (data.autoApproved) {
        // First user / auto-approved - go to dashboard
        if (data.user) {
          sessionStorage.setItem('wbms_user', JSON.stringify(data.user));
        }
        const redirect = searchParams.get('redirect') || '/';
        window.location.href = redirect;
      } else {
        // Needs admin approval - show success message
        setSuccess('تم إنشاء حسابك بنجاح! في انتظار موافقة المسؤول. هتقدر تدخل بعد ما يتم الاعتماد.');
        setLoading(false);
        switchForm('login');
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Request failed');
        return;
      }

      setSuccess(data.message);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px 12px 44px',
    borderRadius: '10px',
    border: '1.5px solid #e0e0e0',
    fontSize: '14px',
    outline: 'none',
    background: '#fafafa',
    transition: 'all 0.2s',
    color: '#111b21',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#00a884';
    e.currentTarget.style.background = '#fff';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 168, 132, 0.1)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#e0e0e0';
    e.currentTarget.style.background = '#fafafa';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Left decorative panel - hidden on mobile */}
      <div
        className="hidden lg:flex"
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, #075e54 0%, #00a884 50%, #25d366 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute',
          top: '40%',
          right: '10%',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '420px' }}>
          {/* Logo */}
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}>
            <i className="fab fa-whatsapp" style={{ fontSize: '48px', color: '#fff' }} />
          </div>

          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '12px',
            letterSpacing: '-0.5px',
          }}>
            WhatsApp Business
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '40px',
            lineHeight: 1.5,
          }}>
            Management System
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            {[
              { icon: 'fa-comments', text: 'Manage conversations efficiently' },
              { icon: 'fa-users', text: 'Organize your contacts and leads' },
              { icon: 'fa-bullhorn', text: 'Run targeted campaigns' },
              { icon: 'fa-robot', text: 'Automate workflows with smart rules' },
            ].map((feature, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(5px)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <i className={`fas ${feature.icon}`} style={{ fontSize: '14px', color: '#fff' }} />
                </div>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom text */}
        <div style={{
          position: 'absolute',
          bottom: '32px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px',
        }}>
          &copy; 2025 WhatsApp Business Manager. All rights reserved.
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
      }}>
        {/* Mobile header */}
        <div className="lg:hidden" style={{
          position: 'absolute',
          top: '20px',
          left: '0',
          right: '0',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #075e54, #00a884)',
          }}>
            <i className="fab fa-whatsapp" style={{ fontSize: '24px', color: '#fff' }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Business Manager</span>
          </div>
        </div>

        {/* Form container */}
        <div style={{
          width: '100%',
          maxWidth: '440px',
          animation: animationClass === 'form-enter' ? 'fadeSlideIn 0.3s ease-out' : 'fadeSlideOut 0.2s ease-in',
        }}>
          {/* Form card */}
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '40px 36px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(0, 0, 0, 0.04)',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#111b21',
                marginBottom: '8px',
              }}>
                {formState === 'login' && 'Welcome Back'}
                {formState === 'register' && 'Create Account'}
                {formState === 'forgot-password' && 'Reset Password'}
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#667781',
                lineHeight: 1.5,
              }}>
                {formState === 'login' && 'Sign in to your WhatsApp Business Manager'}
                {formState === 'register' && 'Join WhatsApp Business Manager today'}
                {formState === 'forgot-password' && 'Enter your email to receive a reset link'}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <i className="fas fa-exclamation-circle" />
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#16a34a',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <i className="fas fa-check-circle" />
                {success}
              </div>
            )}

            {/* LOGIN FORM */}
            {formState === 'login' && (
              <form onSubmit={handleLogin}>
                {/* Email */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-envelope" style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '14px',
                    }} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-lock" style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '14px',
                    }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '44px' }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        padding: '4px',
                        fontSize: '14px',
                      }}
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                {/* Remember me & Forgot password */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#667781',
                  }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: '#00a884',
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => switchForm('forgot-password')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#00a884',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Login button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '10px',
                    border: 'none',
                    background: loading
                      ? '#b0b8c1'
                      : 'linear-gradient(135deg, #075e54, #00a884)',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: loading ? 'none' : '0 2px 8px rgba(0, 168, 132, 0.3)',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: '18px', height: '18px', borderTopColor: '#fff' }} />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt" />
                      Sign In
                    </>
                  )}
                </button>

                {/* Register link */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid #f0f2f5',
                }}>
                  <span style={{ fontSize: '13px', color: '#667781' }}>
                    Don&apos;t have an account?{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => switchForm('register')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#00a884',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Create one
                  </button>
                </div>
              </form>
            )}

            {/* REGISTER FORM */}
            {formState === 'register' && (
              <form onSubmit={handleRegister}>
                {/* Name */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-user" style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '14px',
                    }} />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-envelope" style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '14px',
                    }} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-lock" style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '14px',
                    }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '44px' }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        padding: '4px',
                        fontSize: '14px',
                      }}
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}>
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-lock" style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '14px',
                    }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '44px' }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        padding: '4px',
                        fontSize: '14px',
                      }}
                    >
                      <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                {/* Register button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '10px',
                    border: 'none',
                    background: loading
                      ? '#b0b8c1'
                      : 'linear-gradient(135deg, #075e54, #00a884)',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: loading ? 'none' : '0 2px 8px rgba(0, 168, 132, 0.3)',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: '18px', height: '18px', borderTopColor: '#fff' }} />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-plus" />
                      Create Account
                    </>
                  )}
                </button>

                {/* Login link */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid #f0f2f5',
                }}>
                  <span style={{ fontSize: '13px', color: '#667781' }}>
                    Already have an account?{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => switchForm('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#00a884',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Sign in
                  </button>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {formState === 'forgot-password' && (
              <form onSubmit={handleForgotPassword}>
                {/* Email */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-envelope" style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '14px',
                    }} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                  <p style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    marginTop: '8px',
                    lineHeight: 1.4,
                  }}>
                    We&apos;ll send a password reset link to your email address if an account exists.
                  </p>
                </div>

                {/* Send reset link button */}
                {!success ? (
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '13px',
                      borderRadius: '10px',
                      border: 'none',
                      background: loading
                        ? '#b0b8c1'
                        : 'linear-gradient(135deg, #075e54, #00a884)',
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: loading ? 'none' : '0 2px 8px rgba(0, 168, 132, 0.3)',
                    }}
                  >
                    {loading ? (
                      <>
                        <div className="spinner" style={{ width: '18px', height: '18px', borderTopColor: '#fff' }} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane" />
                        Send Reset Link
                      </>
                    )}
                  </button>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    borderRadius: '10px',
                    background: '#f0fdf4',
                  }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '32px', color: '#00a884', marginBottom: '8px' }} />
                    <p style={{ fontSize: '14px', color: '#374151' }}>Check your email for the reset link.</p>
                  </div>
                )}

                {/* Back to login link */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid #f0f2f5',
                }}>
                  <button
                    type="button"
                    onClick={() => switchForm('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#00a884',
                      fontWeight: 600,
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="fas fa-arrow-left" style={{ fontSize: '12px' }} />
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Keyframe styles */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeSlideOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-8px);
          }
        }
        .form-enter {
          animation: fadeSlideIn 0.3s ease-out;
        }
        .form-exit {
          animation: fadeSlideOut 0.2s ease-in;
        }
      `}</style>
    </div>
  );
}
