'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ============================================================
// Types
// ============================================================
type Language = 'en' | 'ar';

interface Translations {
  nav: {
    dashboard: string;
    inbox: string;
    contacts: string;
    campaigns: string;
    automation: string;
    templates: string;
    users: string;
    settings: string;
    logout: string;
    system: string;
    main: string;
    marketing: string;
    collapse: string;
  };
  dashboard: {
    title: string;
    overview: string;
    messagesSent: string;
    responseRate: string;
    avgResponseTime: string;
    customerSatisfaction: string;
    openConversations: string;
    totalContacts: string;
    messagesToday: string;
    activeCampaigns: string;
    automationRules: string;
    quickActions: string;
    newConversation: string;
    quickTemplate: string;
    newCampaign: string;
    addContact: string;
    recentConversations: string;
    campaignStatus: string;
    sent: string;
    read: string;
  };
  inbox: {
    title: string;
    searchPlaceholder: string;
    all: string;
    open: string;
    pending: string;
    closed: string;
    selectConversation: string;
    selectConversationDesc: string;
    typeMessage: string;
    send: string;
    noConversations: string;
    assignTo: string;
    status: string;
    sendTemplate: string;
    phoneNumber: string;
    chooseConversation: string;
  };
  contacts: {
    title: string;
    searchPlaceholder: string;
    addContact: string;
    name: string;
    phone: string;
    email: string;
    city: string;
    tags: string;
    notes: string;
    status: string;
    active: string;
    inactive: string;
    totalMessages: string;
    lastMessage: string;
    actions: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    contactInfo: string;
    lastSeen: string;
    source: string;
    createdOn: string;
  };
  templates: {
    title: string;
    searchPlaceholder: string;
    all: string;
    approved: string;
    pending: string;
    rejected: string;
    name: string;
    language: string;
    category: string;
    body: string;
    components: string;
    status: string;
    actions: string;
    use: string;
    header: string;
    footer: string;
    buttons: string;
    templateInfo: string;
  };
  campaigns: {
    title: string;
    create: string;
    name: string;
    template: string;
    status: string;
    draft: string;
    active: string;
    completed: string;
    paused: string;
    recipients: string;
    sent: string;
    delivered: string;
    read: string;
    replied: string;
    scheduledAt: string;
    createdOn: string;
    campaignDetails: string;
    type: string;
    performance: string;
    noCampaigns: string;
  };
  automation: {
    title: string;
    create: string;
    ruleName: string;
    trigger: string;
    condition: string;
    action: string;
    priority: string;
    enabled: string;
    disabled: string;
    status: string;
    rules: string;
    noRules: string;
    parameters: string;
    createdOn: string;
  };
  users: {
    title: string;
    addUser: string;
    name: string;
    email: string;
    role: string;
    status: string;
    active: string;
    inactive: string;
    createdAt: string;
    lastLogin: string;
    actions: string;
    edit: string;
    delete: string;
    admin: string;
    agent: string;
    viewer: string;
    permissions: string;
    save: string;
    cancel: string;
    confirmPassword: string;
    password: string;
    changePassword: string;
    removeUser: string;
    removeConfirm: string;
    userAdded: string;
    userUpdated: string;
    userDeleted: string;
    userActivated: string;
    userDeactivated: string;
    searchPlaceholder: string;
    userInfo: string;
    editUser: string;
    dangerZone: string;
    deactivateUser: string;
    rolePermissions: string;
    allRoles: string;
    allStatuses: string;
    noUsers: string;
    selectUser: string;
    selectUserDesc: string;
    manageUsers: string;
  };
  settings: {
    title: string;
    whatsapp: string;
    webhook: string;
    security: string;
    system: string;
    save: string;
    cancel: string;
    language: string;
    general: string;
    notifications: string;
    appearance: string;
    phoneSetup: string;
    apiConfig: string;
  };
  auth: {
    login: string;
    register: string;
    forgotPassword: string;
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    rememberMe: string;
    forgotPasswordQ: string;
    noAccount: string;
    hasAccount: string;
    createAccount: string;
    signIn: string;
    signingIn: string;
    creatingAccount: string;
    sendResetLink: string;
    backToSignIn: string;
    resetDescription: string;
    resetSuccess: string;
    welcomeBack: string;
    createAccountTitle: string;
    resetTitle: string;
    loginSubtitle: string;
    registerSubtitle: string;
    resetSubtitle: string;
    emailAddress: string;
    enterPassword: string;
    confirmPasswordPlaceholder: string;
    fullNamePlaceholder: string;
    emailPlaceholder: string;
    resetSent: string;
    sending: string;
    managementSystem: string;
    manageConversations: string;
    organizeContacts: string;
    runCampaigns: string;
    automateWorkflows: string;
    businessManager: string;
    noAccountText: string;
    hasAccountText: string;
  };
  common: {
    search: string;
    filter: string;
    sort: string;
    actions: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    close: string;
    confirm: string;
    loading: string;
    noData: string;
    error: string;
    success: string;
    view: string;
    back: string;
    next: string;
    previous: string;
    yes: string;
    no: string;
    or: string;
    on: string;
    off: string;
    enabled: string;
    disabled: string;
  };
}

// ============================================================
// English Translations
// ============================================================
const en: Translations = {
  nav: {
    dashboard: 'Dashboard',
    inbox: 'Inbox',
    contacts: 'Contacts',
    campaigns: 'Campaigns',
    automation: 'Automation',
    templates: 'Templates',
    users: 'Users',
    settings: 'Settings',
    logout: 'Sign out',
    system: 'SYSTEM',
    main: 'MAIN',
    marketing: 'MARKETING',
    collapse: 'Collapse',
  },
  dashboard: {
    title: 'Dashboard',
    overview: 'Dashboard Overview',
    messagesSent: 'Messages Sent',
    responseRate: 'Response Rate',
    avgResponseTime: 'Avg Response Time',
    customerSatisfaction: 'Customer Satisfaction',
    openConversations: 'Open Conversations',
    totalContacts: 'Total Contacts',
    messagesToday: 'Messages Today',
    activeCampaigns: 'Active Campaigns',
    automationRules: 'Automation Rules',
    quickActions: 'Quick Actions',
    newConversation: 'New Conversation',
    quickTemplate: 'Quick Template',
    newCampaign: 'New Campaign',
    addContact: 'Add Contact',
    recentConversations: 'Recent Conversations',
    campaignStatus: 'Campaign Status',
    sent: 'Sent',
    read: 'Read',
  },
  inbox: {
    title: 'Inbox',
    searchPlaceholder: 'Search conversations...',
    all: 'All',
    open: 'Open',
    pending: 'Pending',
    closed: 'Closed',
    selectConversation: 'Select a conversation',
    selectConversationDesc: 'Choose from your existing conversations to start chatting',
    typeMessage: 'Type a message',
    send: 'Send',
    noConversations: 'No conversations found',
    assignTo: 'Assign to',
    status: 'Status',
    sendTemplate: 'Send Template',
    phoneNumber: 'Phone Number',
    chooseConversation: 'Choose a conversation from the left panel',
  },
  contacts: {
    title: 'Contacts',
    searchPlaceholder: 'Search contacts...',
    addContact: 'Add Contact',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    city: 'City',
    tags: 'Tags',
    notes: 'Notes',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    totalMessages: 'Total Messages',
    lastMessage: 'Last Message',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    contactInfo: 'Contact Information',
    lastSeen: 'Last Seen',
    source: 'Source',
    createdOn: 'Created On',
  },
  templates: {
    title: 'Templates',
    searchPlaceholder: 'Search templates...',
    all: 'All',
    approved: 'Approved',
    pending: 'Pending',
    rejected: 'Rejected',
    name: 'Name',
    language: 'Language',
    category: 'Category',
    body: 'Body',
    components: 'Components',
    status: 'Status',
    actions: 'Actions',
    use: 'Use',
    header: 'Header',
    footer: 'Footer',
    buttons: 'Buttons',
    templateInfo: 'Template Information',
  },
  campaigns: {
    title: 'Campaigns',
    create: 'Create Campaign',
    name: 'Name',
    template: 'Template',
    status: 'Status',
    draft: 'Draft',
    active: 'Active',
    completed: 'Completed',
    paused: 'Paused',
    recipients: 'Recipients',
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    replied: 'Replied',
    scheduledAt: 'Scheduled At',
    createdOn: 'Created On',
    campaignDetails: 'Campaign Details',
    type: 'Type',
    performance: 'Performance',
    noCampaigns: 'No campaigns yet',
  },
  automation: {
    title: 'Automation',
    create: 'Create Rule',
    ruleName: 'Rule Name',
    trigger: 'Trigger',
    condition: 'Condition',
    action: 'Action',
    priority: 'Priority',
    enabled: 'Enabled',
    disabled: 'Disabled',
    status: 'Status',
    rules: 'Rules',
    noRules: 'No automation rules yet',
    parameters: 'Parameters',
    createdOn: 'Created On',
  },
  users: {
    title: 'Users',
    addUser: 'Add User',
    name: 'Name',
    email: 'Email',
    role: 'Role',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    createdAt: 'Created At',
    lastLogin: 'Last Login',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    admin: 'Administrator',
    agent: 'Agent',
    viewer: 'Viewer',
    permissions: 'Permissions',
    save: 'Save',
    cancel: 'Cancel',
    confirmPassword: 'Confirm Password',
    password: 'Password',
    changePassword: 'Change Password',
    removeUser: 'Remove User',
    removeConfirm: 'Are you sure you want to remove this user?',
    userAdded: 'User added successfully',
    userUpdated: 'User updated successfully',
    userDeleted: 'User deleted successfully',
    userActivated: 'User activated successfully',
    userDeactivated: 'User deactivated successfully',
    searchPlaceholder: 'Search users...',
    userInfo: 'User Information',
    editUser: 'Edit User',
    dangerZone: 'Danger Zone',
    deactivateUser: 'Deactivate User',
    rolePermissions: 'Role Permissions',
    allRoles: 'All Roles',
    allStatuses: 'All Statuses',
    noUsers: 'No users found',
    selectUser: 'Select a user',
    selectUserDesc: 'Choose a user from the list to view their details',
    manageUsers: 'Manage Users',
  },
  settings: {
    title: 'Settings',
    whatsapp: 'WhatsApp',
    webhook: 'Webhook',
    security: 'Security',
    system: 'System',
    save: 'Save',
    cancel: 'Cancel',
    language: 'Language',
    general: 'General',
    notifications: 'Notifications',
    appearance: 'Appearance',
    phoneSetup: 'Phone Setup',
    apiConfig: 'API Configuration',
  },
  auth: {
    login: 'Login',
    register: 'Register',
    forgotPassword: 'Forgot Password',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    fullName: 'Full Name',
    rememberMe: 'Remember me',
    forgotPasswordQ: 'Forgot Password?',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    createAccount: 'Create Account',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    creatingAccount: 'Creating account...',
    sendResetLink: 'Send Reset Link',
    backToSignIn: 'Back to Sign In',
    resetDescription: 'Enter your email to receive a reset link',
    resetSuccess: 'Check your email for the reset link.',
    welcomeBack: 'Welcome Back',
    createAccountTitle: 'Create Account',
    resetTitle: 'Reset Password',
    loginSubtitle: 'Sign in to your WhatsApp Business Manager',
    registerSubtitle: 'Join WhatsApp Business Manager today',
    resetSubtitle: 'Enter your email to receive a reset link',
    emailAddress: 'Email Address',
    enterPassword: 'Enter your password',
    confirmPasswordPlaceholder: 'Confirm your password',
    fullNamePlaceholder: 'John Doe',
    emailPlaceholder: 'you@example.com',
    resetSent: 'We\'ll send a password reset link to your email address if an account exists.',
    sending: 'Sending...',
    managementSystem: 'Management System',
    manageConversations: 'Manage conversations efficiently',
    organizeContacts: 'Organize your contacts and leads',
    runCampaigns: 'Run targeted campaigns',
    automateWorkflows: 'Automate workflows with smart rules',
    businessManager: 'Business Manager',
    noAccountText: "Don't have an account?",
    hasAccountText: 'Already have an account?',
  },
  common: {
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    actions: 'Actions',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    confirm: 'Confirm',
    loading: 'Loading...',
    noData: 'No data found',
    error: 'Error',
    success: 'Success',
    view: 'View',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    on: 'On',
    off: 'Off',
    enabled: 'Enabled',
    disabled: 'Disabled',
  },
};

// ============================================================
// Arabic Translations (Egyptian Arabic)
// ============================================================
const ar: Translations = {
  nav: {
    dashboard: 'لوحة التحكم',
    inbox: 'الصندوق الوارد',
    contacts: 'جهات الاتصال',
    campaigns: 'الحملات',
    automation: 'الأتمتة',
    templates: 'القوالب',
    users: 'المستخدمين',
    settings: 'الإعدادات',
    logout: 'تسجيل الخروج',
    system: 'النظام',
    main: 'الرئيسي',
    marketing: 'التسويق',
    collapse: 'طي',
  },
  dashboard: {
    title: 'لوحة التحكم',
    overview: 'نظرة عامة',
    messagesSent: 'الرسائل المرسلة',
    responseRate: 'معدل الاستجابة',
    avgResponseTime: 'متوسط وقت الاستجابة',
    customerSatisfaction: 'رضا العملاء',
    openConversations: 'المحادثات المفتوحة',
    totalContacts: 'إجمالي جهات الاتصال',
    messagesToday: 'رسائل اليوم',
    activeCampaigns: 'الحملات النشطة',
    automationRules: 'قواعد الأتمتة',
    quickActions: 'إجراءات سريعة',
    newConversation: 'محادثة جديدة',
    quickTemplate: 'قالب سريع',
    newCampaign: 'حملة جديدة',
    addContact: 'إضافة جهة اتصال',
    recentConversations: 'المحادثات الأخيرة',
    campaignStatus: 'حالة الحملات',
    sent: 'تم الإرسال',
    read: 'تم القراءة',
  },
  inbox: {
    title: 'الصندوق الوارد',
    searchPlaceholder: 'ابحث في المحادثات...',
    all: 'الكل',
    open: 'مفتوح',
    pending: 'معلق',
    closed: 'مقفل',
    selectConversation: 'اختر محادثة',
    selectConversationDesc: 'اختر محادثة من محادثاتك الحالية لبدء الدردشة',
    typeMessage: 'اكتب رسالة',
    send: 'إرسال',
    noConversations: 'لم يتم العثور على محادثات',
    assignTo: 'تعيين إلى',
    status: 'الحالة',
    sendTemplate: 'إرسال قالب',
    phoneNumber: 'رقم الهاتف',
    chooseConversation: 'اختر محادثة من القائمة على اليسار',
  },
  contacts: {
    title: 'جهات الاتصال',
    searchPlaceholder: 'ابحث في جهات الاتصال...',
    addContact: 'إضافة جهة اتصال',
    name: 'الاسم',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    city: 'المدينة',
    tags: 'العلامات',
    notes: 'ملاحظات',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    totalMessages: 'إجمالي الرسائل',
    lastMessage: 'آخر رسالة',
    actions: 'الإجراءات',
    edit: 'تعديل',
    delete: 'حذف',
    save: 'حفظ',
    cancel: 'إلغاء',
    contactInfo: 'معلومات جهة الاتصال',
    lastSeen: 'آخر ظهور',
    source: 'المصدر',
    createdOn: 'تاريخ الإنشاء',
  },
  templates: {
    title: 'القوالب',
    searchPlaceholder: 'ابحث في القوالب...',
    all: 'الكل',
    approved: 'موافق عليه',
    pending: 'قيد الانتظار',
    rejected: 'مرفوض',
    name: 'الاسم',
    language: 'اللغة',
    category: 'الفئة',
    body: 'المحتوى',
    components: 'المكونات',
    status: 'الحالة',
    actions: 'الإجراءات',
    use: 'استخدام',
    header: 'الترويسة',
    footer: 'التذييل',
    buttons: 'الأزرار',
    templateInfo: 'معلومات القالب',
  },
  campaigns: {
    title: 'الحملات',
    create: 'إنشاء حملة',
    name: 'الاسم',
    template: 'القالب',
    status: 'الحالة',
    draft: 'مسودة',
    active: 'نشطة',
    completed: 'مكتملة',
    paused: 'متوقفة',
    recipients: 'المستلمون',
    sent: 'تم الإرسال',
    delivered: 'تم التسليم',
    read: 'تم القراءة',
    replied: 'تم الرد',
    scheduledAt: 'مجدول في',
    createdOn: 'تاريخ الإنشاء',
    campaignDetails: 'تفاصيل الحملة',
    type: 'النوع',
    performance: 'الأداء',
    noCampaigns: 'لا توجد حملات بعد',
  },
  automation: {
    title: 'الأتمتة',
    create: 'إنشاء قاعدة',
    ruleName: 'اسم القاعدة',
    trigger: 'المحفز',
    condition: 'الشرط',
    action: 'الإجراء',
    priority: 'الأولوية',
    enabled: 'مفعل',
    disabled: 'معطل',
    status: 'الحالة',
    rules: 'القواعد',
    noRules: 'لا توجد قواعد أتمتة بعد',
    parameters: 'المعلمات',
    createdOn: 'تاريخ الإنشاء',
  },
  users: {
    title: 'المستخدمين',
    addUser: 'إضافة مستخدم',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    role: 'الدور',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    createdAt: 'تاريخ الإنشاء',
    lastLogin: 'آخر دخول',
    actions: 'الإجراءات',
    edit: 'تعديل',
    delete: 'حذف',
    admin: 'مسؤول النظام',
    agent: 'وكيل',
    viewer: 'مشاهد',
    permissions: 'الصلاحيات',
    save: 'حفظ',
    cancel: 'إلغاء',
    confirmPassword: 'تأكيد كلمة المرور',
    password: 'كلمة المرور',
    changePassword: 'تغيير كلمة المرور',
    removeUser: 'حذف المستخدم',
    removeConfirm: 'هل أنت متأكد أنك تريد حذف هذا المستخدم؟',
    userAdded: 'تم إضافة المستخدم بنجاح',
    userUpdated: 'تم تحديث المستخدم بنجاح',
    userDeleted: 'تم حذف المستخدم بنجاح',
    userActivated: 'تم تفعيل المستخدم بنجاح',
    userDeactivated: 'تم تعطيل المستخدم بنجاح',
    searchPlaceholder: 'ابحث عن مستخدم...',
    userInfo: 'معلومات المستخدم',
    editUser: 'تعديل المستخدم',
    dangerZone: 'منطقة الخطر',
    deactivateUser: 'تعطيل المستخدم',
    rolePermissions: 'صلاحيات الأدوار',
    allRoles: 'كل الأدوار',
    allStatuses: 'كل الحالات',
    noUsers: 'لم يتم العثور على مستخدمين',
    selectUser: 'اختر مستخدم',
    selectUserDesc: 'اختر مستخدم من القائمة لعرض تفاصيله',
    manageUsers: 'إدارة المستخدمين',
  },
  settings: {
    title: 'الإعدادات',
    whatsapp: 'واتساب',
    webhook: 'ويب هوك',
    security: 'الأمان',
    system: 'النظام',
    save: 'حفظ',
    cancel: 'إلغاء',
    language: 'اللغة',
    general: 'عام',
    notifications: 'الإشعارات',
    appearance: 'المظهر',
    phoneSetup: 'إعداد الهاتف',
    apiConfig: 'إعداد الـ API',
  },
  auth: {
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    forgotPassword: 'نسيت كلمة المرور',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    fullName: 'الاسم الكامل',
    rememberMe: 'تذكرني',
    forgotPasswordQ: 'نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟',
    hasAccount: 'لديك حساب بالفعل؟',
    createAccount: 'إنشاء حساب',
    signIn: 'تسجيل الدخول',
    signingIn: 'جاري تسجيل الدخول...',
    creatingAccount: 'جاري إنشاء الحساب...',
    sendResetLink: 'إرسال رابط الاستعادة',
    backToSignIn: 'العودة لتسجيل الدخول',
    resetDescription: 'أدخل بريدك الإلكتروني لاستلام رابط الاستعادة',
    resetSuccess: 'تحقق من بريدك الإلكتروني للحصول على رابط الاستعادة.',
    welcomeBack: 'مرحبًا بعودتك',
    createAccountTitle: 'إنشاء حساب',
    resetTitle: 'استعادة كلمة المرور',
    loginSubtitle: 'سجل دخولك في مدير واتساب بزنس',
    registerSubtitle: 'انضم إلى مدير واتساب بزنس اليوم',
    resetSubtitle: 'أدخل بريدك الإلكتروني لاستلام رابط الاستعادة',
    emailAddress: 'البريد الإلكتروني',
    enterPassword: 'أدخل كلمة المرور',
    confirmPasswordPlaceholder: 'أكد كلمة المرور',
    fullNamePlaceholder: 'محمد أحمد',
    emailPlaceholder: 'example@email.com',
    resetSent: 'هنبعتلك رابط استعادة على الإيميل لو ليك حساب.',
    sending: 'جاري الإرسال...',
    managementSystem: 'نظام الإدارة',
    manageConversations: 'إدارة المحادثات بكفاءة',
    organizeContacts: 'تنظيم جهات الاتصال والعملاء المحتملين',
    runCampaigns: 'تنفيذ حملات مستهدفة',
    automateWorkflows: 'أتمتة سير العمل بقواعد ذكية',
    businessManager: 'مدير الأعمال',
    noAccountText: 'ليس لديك حساب؟',
    hasAccountText: 'لديك حساب بالفعل؟',
  },
  common: {
    search: 'بحث',
    filter: 'تصفية',
    sort: 'ترتيب',
    actions: 'الإجراءات',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    close: 'إغلاق',
    confirm: 'تأكيد',
    loading: 'جاري التحميل...',
    noData: 'لا توجد بيانات',
    error: 'خطأ',
    success: 'نجاح',
    view: 'عرض',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    yes: 'نعم',
    no: 'لا',
    or: 'أو',
    on: 'تشغيل',
    off: 'إيقاف',
    enabled: 'مفعل',
    disabled: 'معطل',
  },
};

// ============================================================
// Translations Map
// ============================================================
const translations: Record<Language, Translations> = { en, ar };

// ============================================================
// Context & Hook
// ============================================================
interface I18nContextType {
  t: Translations;
  lang: Language;
  setLang: (lang: Language) => void;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType>({
  t: ar,
  lang: 'ar',
  setLang: () => {},
  isRTL: true,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar'); // Default Arabic

  useEffect(() => {
    const saved = localStorage.getItem('wbms_lang') as Language | null;
    if (saved && (saved === 'en' || saved === 'ar')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('wbms_lang', newLang);
    // Update document direction
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  }, []);

  // Apply dir/lang on mount and lang change
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const value: I18nContextType = {
    t: translations[lang],
    lang,
    setLang,
    isRTL: lang === 'ar',
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
