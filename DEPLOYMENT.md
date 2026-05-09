# WBMS - Deployment Guide (GitHub + Vercel + Supabase)
## دليل النشر خطوة بخطوة

---

## الخطوة 1: إنشاء مشروع Supabase (Database)

### 1.1 إنشاء حساب وقاعدة بيانات
1. اذهب إلى **https://supabase.com** واعمل حساب (او سجل دخول بـ GitHub)
2. اضغط **"New Project"**
3. اختار:
   - **Name**: `wbms-production`
   - **Database Password**: احفظها جيداً! (مثلاً: `WBMS-Secure-2024-Production!`)
   - **Region**: اختار اقرب منطقة ليك (مثلاً: `EU West (London)`)
4. اضغط **"Create new project"** وانتظر تخلص (دقيقتين)

### 1.2 نسخ Connection String
1. في Supabase Dashboard، اذهب لـ **Settings** → **Database**
2. تحت **Connection string**، اختار **URI**
3. انسخ الرابط - شكله هيكون كده:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
4. **استبدل `[password]** بكلمة السور اللي اخترتها** (مع الـ URL encoding لو فيها رموز خاصة)
5. احفظ الرابط ده — هنستخدمه في Vercel

### 1.3 تفعيل Connection Pooling (مهم للأداء)
1. اذهب لـ **Settings** → **Database** → **Connection pooling**
2. اتأكد إن **Transaction Mode** مفعّل (افتراضي)
3. الـ Port يكون **6543** (Transaction pooler) — ده الموجود في الرابط فوق

---

## الخطوة 2: إنشاء Repository على GitHub

### 2.1 إنشاء Repo جديد
1. اذهب إلى **https://github.com/new**
2. اختار:
   - **Repository name**: `wbms` (أو أي اسم يعجبك)
   - **Description**: `WhatsApp Business Management System`
   - **Visibility**: Private (افضل)
3. **مفيش** Initialize with README, .gitignore, أو license (لأن المشروع جاهز)
4. اضغط **"Create repository"**

### 2.2 رفع المشروع على GitHub
من الـ Terminal (على جهازك):

```bash
# 1. افتح مجلد المشروع
cd wbms

# 2. Initialize Git
git init

# 3. أضف جميع الملفات
git add .

# 4. اعمل اول Commit
git commit -m "Initial commit - WBMS v4.05 ready for deployment"

# 5. اربط بالـ Repository
git remote add origin https://github.com/YOUR-USERNAME/wbms.git

# 6. ارفع الكود
git push -u origin main
```

> **ملاحظة**: لو اسم الفرع مش `main`، استخدم `git branch -M main` قبله

---

## الخطوة 3: ربط المشروع بـ Vercel

### 3.1 إنشاء حساب Vercel
1. اذهب إلى **https://vercel.com** وسجل دخول بـ GitHub

### 3.2 Import المشروع
1. اضغط **"Add New"** → **"Project"**
2. اختار الـ Repository اللي عملته (`wbms`)
3. في صفحة **Configure Project**:

   **Framework Preset**: Next.js (يتعرف تلقائي)

   **Build Command**: `npx prisma generate && next build` (اتأكد ده موجود)

   **Output Directory**: `.next`

   **Install Command**: `npm install`

### 3.3 إضافة Environment Variables
اضغط **"Environment Variables"** وأضف التالي:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | الرابط اللي نسخته من Supabase (الخطوة 1.2) |
   | `JWT_SECRET` | اعمل واحد قوي: افتح terminal واكتب `openssl rand -base64 32` والصق الناتج هنا |
   | `NEXT_PUBLIC_APP_URL` | `https://wa.yasserabdallah.com` |

4. اضغط **"Deploy"**
5. انتظر الـ Build يخلص (3-5 دقائق أول مرة)

### 3.4 اختبار التشغيل
بعد ما الـ Deploy يخلص، Vercel هيعطيك رابط مؤقت مثل:
`https://wbms-xxx.vercel.app`

افتحه في المتصفح — لازم تشوف صفحة الـ Setup (لأن الداتا بيس فاضية)

---

## الخطوة 4: ضبط الدومين wa.yasserabdallah.com

### 4.1 إضافة الدومين في Vercel
1. في Vercel Dashboard، افتح المشروع
2. اذهب لـ **Settings** → **Domains**
3. اكتب: `wa.yasserabdallah.com`
4. اضغط **"Add"**
5. اختار **"Add wa.yasserabdallah.com and redirect yasserabdallah.com to it"**

### 4.2 إضافة DNS Records
Vercel هيعرضلك الـ DNS Records المطلوبة. اذهب إلى **الشركة اللي مشتري منها الدومين** (Godaddy, Namecheap, الخ) وعدل الـ DNS:

**لو استخدمت "Add wa.yasserabdallah.com":**
أضف Record نوع **CNAME**:
| Type | Name | Value |
|------|------|-------|
| CNAME | wa | cname.vercel-dns.com |

> **ملاحظة**: Vercel ممكن يطلب تحديد نوع SSL — اختار **"Automatic"**

### 4.3 انتظر الـ DNS
- DNS update بياخد من **5 دقائق لـ 48 ساعة** (غالباً خلال ساعة)
- في Vercel، لما الـ Status يكون **"Valid Configuration"** — يبقى كل شيء جاهز

---

## الخطوة 5: إعداد الداتابيز على Supabase (مهم!)

### 5.1 دفع الـ Schema للداتابيز
بعد ما المشروع يعمل على Vercel، ادخل على **https://wa.yasserabdallah.com** — هتظهر صفحة Setup الأولية.

عملياً، Vercel يعمل `prisma db push` تلقائي؟ لا — لازم تعملها يدوي:

**الطريقة 1: من Terminal على جهازك**
```bash
cd wbms

# عدل ملف .env ببيانات Supabase
# DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# ادفع الـ Schema
npx prisma db push
```

**الطريقة 2: من Supabase Dashboard**
1. اذهب لـ **SQL Editor** في Supabase
2. اعمل **New Query**
3. الصق الـ Schema اللي في ملف `prisma/schema.prisma` (كـ SQL)
4. أو ببساطة: افتح الموقع واعمل Setup من الواجهة — الـ Prisma db push هيشتغل

### 5.2 التأكد إن الداتا بيس شغالة
افتح **https://wa.yasserabdallah.com** — لو شفت صفحة Setup (اعمل حساب الأدمن)، يبقى كل شيء تمام!

---

## الخطوة 6: ربط WhatsApp Webhook (اختياري - للاستخدام الفعلي)

### 6.1 إعداد Webhook URL
1. في Meta Business Suite → WhatsApp Manager → Configuration
2. Webhook URL: `https://wa.yasserabdallah.com/api/whatsapp/webhook`
3. Verify Token: اعمل واحد قوي (مثلاً: `wbms_verify_token_2024_prod`)
4. في WBMS Settings، ضع نفس الـ Verify Token

### 6.2 تفعيل Web Events
فعّل: `messages`, `messaging_postbacks`, `message_status`

---

## ملخص المتغيرات البيئية

### في Vercel (Production)
| المتغير | الوصف | مثال |
|---------|-------|------|
| `DATABASE_URL` | رابط Supabase PostgreSQL | `postgresql://postgres.xxxx:password@...supabase.com:6543/postgres` |
| `JWT_SECRET` | مفتاح تشفير JWT | (اعمله بـ `openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | رابط الموقع | `https://wa.yasserabdallah.com` |

---

## استكشاف الأخطاء

### مشكلة: Build يفشل
```bash
# تأكد إن Prisma يعمل
npx prisma generate
npx prisma db push
```

### مشكلة: الدومين مش شغال
- تأكد إن DNS Records صح
- انتظر 24 ساعة كحد أقصى
- شيك إن SSL Certificate متفعّل في Vercel

### مشكلة: Database Connection Error
- تأكد إن `DATABASE_URL` في Vercel صح 100%
- تأكد إن الـ password URL-encoded (مثلاً: `@` → `%40`, `#` → `%23`)
- جرب Ping الداتابيز من Supabase Dashboard

### مشكلة: الـ Webhook مش بيشتغل
- تأكد إن الـ URL متاح: `https://wa.yasserabdallah.com/api/whatsapp/webhook`
- تأكد إن الـ Verify Token متطابق في الموقع وفي Meta

---

## تحديثات مستقبلية
كل ما تعمل Update على الكود:
```bash
git add .
git commit -m "Update description"
git push
```
Vercel هيعمل Deploy تلقائي!
