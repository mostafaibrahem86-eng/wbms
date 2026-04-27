import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - WhatsApp Business Manager',
  description: 'Sign in to your WhatsApp Business Management System',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    }>
      {children}
    </Suspense>
  );
}
