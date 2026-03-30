import type { SupportedLanguage } from '../features/settings/language';
import { duplicateVoucherCodeErrorMessage } from '../features/vouchers/errors';
import type { VoucherCategory } from '../features/vouchers/categories';
import type { VoucherStatus, VoucherType } from '../types/domain';

export type AppCopy = {
  navigation: {
    wallet: string;
    details: string;
    voucher: string;
    settings: string;
    access: string;
  };
  common: {
    all: string;
    cancel: string;
    close: string;
    save: string;
    saving: string;
    delete: string;
    deleting: string;
    update: string;
    updating: string;
    open: string;
    notSet: string;
    none: string;
    noMerchant: string;
    noValue: string;
    other: string;
    noNotesYet: string;
    noAttachments: string;
    unknownType: string;
    today: string;
    expired: string;
    invalidAmountTitle: string;
    invalidAmountMessage: string;
    updatedTitle: string;
    updateFailedTitle: string;
    deleteFailedTitle: string;
    saveFailedTitle: string;
    loadFailedTitle: string;
    notFoundTitle: string;
    notFoundMessage: string;
    clearFilters: string;
    resetSearchAndFilters: string;
    showFilters: string;
    hideFilters: string;
  };
  language: {
    label: string;
    english: string;
    hebrew: string;
    switchToEnglish: string;
    switchToHebrew: string;
  };
  menu: {
    overview: string;
    settings: string;
    signOut: string;
    openMenu: string;
    languageUpdateFailedTitle: string;
    languageUpdateFailedMessage: string;
    signOutFailedTitle: string;
    signOutFailedMessage: string;
  };
  auth: {
    email: string;
    password: string;
    displayName: string;
    signIn: string;
    createAccount: string;
    needAccount: string;
    alreadyHaveAccount: string;
    signInLink: string;
    createAccountLink: string;
    minimumPassword: string;
    optional: string;
    incorrectCredentials: string;
    emailConfirmationRequired: string;
    unableToSignIn: string;
    invalidLoginDetails: string;
    alreadyRegistered: string;
    accountCreated: string;
    accountCreatedButWalletIncomplete: string;
    invalidRegistrationDetails: string;
    unableToCreateAccount: string;
    unableToCreateAccountPrefix: string;
    couldNotReachAuthServer: string;
    supabaseCredentialsInvalid: string;
    supabaseEnvMissing: string;
  };
  settings: {
    notificationsEnabled: string;
    defaultReminderOffsets: string;
    registerPushToken: string;
    language: string;
    languageHelp: string;
    defaultCurrency: string;
    saveSettings: string;
    logOut: string;
    settingsSavedTitle: string;
    settingsSavedMessage: string;
    saveFailedTitle: string;
    saveFailedMessage: string;
    pushRegistrationFailed: string;
    signOutFailedTitle: string;
    signOutFailedMessage: string;
  };
  home: {
    myWallet: string;
    addVoucher: string;
    searchPlaceholder: string;
    sort: string;
    category: string;
    brand: string;
    sortVouchers: string;
    filterByCategory: string;
    filterByBrand: string;
    oldToNew: string;
    newToOld: string;
    expiringSoon: string;
    active: string;
    redeemed: string;
    expiredSection: string;
    voucherLoadingFailed: string;
    noVouchersYetTitle: string;
    noVouchersYetMessage: string;
    noVouchersYetButton: string;
    noMatchingVouchersTitle: string;
    noMatchingVouchersMessage: string;
    redeemVoucherTitle: string;
    redeemVoucherMessage: string;
    updateUsageTitle: string;
    updateUsageMessage: string;
    redeem: string;
    redeeming: string;
    updateUsage: string;
    updating: string;
    remainingPrefix: string;
    expiresPrefix: string;
    redeemedModalMessagePrefix: string;
  };
  voucherEntry: {
    title: string;
    subtitle: string;
    uploadFromFile: string;
    uploadFromFileHint: string;
    createManually: string;
    createManuallyHint: string;
    chooseTypeTitle: string;
    chooseTypeHint: string;
    continueButton: string;
  };
  voucherDetails: {
    unableToLoadDetails: string;
    notFoundTitle: string;
    notFoundMessage: string;
    category: string;
    expiry: string;
    merchant: string;
    totalValue: string;
    usedValue: string;
    remainingValue: string;
    product: string;
    attachment: string;
    code: string;
    status: string;
    redeemedAt: string;
    notes: string;
    editVoucher: string;
    markAsRedeemed: string;
    updateUsage: string;
    deleteVoucher: string;
    deleteVoucherTitle: string;
    deleteVoucherMessage: string;
    markRedeemedTitle: string;
    markRedeemedMessage: string;
    usageUpdatedMessage: string;
    noAttachments: string;
    openAttachment: string;
    updateUsageModalTitle: string;
    updateUsageModalMessage: string;
    attachmentFailedTitle: string;
    attachmentFailedMessage: string;
  };
  voucherForm: {
    type: string;
    money: string;
    product: string;
    category: string;
    productName: string;
    merchantName: string;
    faceValue: string;
    usedValue: string;
    currency: string;
    expiryDate: string;
    code: string;
    notes: string;
    productNamePlaceholder: string;
    merchantNamePlaceholder: string;
    faceValuePlaceholder: string;
    usedValuePlaceholder: string;
    currencyPlaceholder: string;
    expiryDatePlaceholder: string;
    codePlaceholder: string;
    notesPlaceholder: string;
    pickImageOrPdf: string;
    saveVoucher: string;
    reviewHighlightedFields: string;
    formIncompleteTitle: string;
    voucherSavedTitle: string;
    voucherSavedMessage: string;
    unableToSaveVoucherTitle: string;
    unableToSaveVoucherMessage: string;
    attachmentFailedTitle: string;
    attachmentFailedMessage: string;
    extractingDetails: string;
    attachmentAddedManualMode: string;
    autoFillReviewNotice: string;
    autoFillNoDetailsFound: string;
    extractionFailedMessage: string;
  };
  validation: {
    email: string;
    passwordTooShort: string;
    invalidNumber: string;
    currencyCodeLength: string;
    dateFormat: string;
    expiryDateRequired: string;
    merchantNameRequired: string;
    faceValueRequired: string;
    productNameRequired: string;
    reminderOffsetsWholeNumbers: string;
    reminderOffsetsAtLeastOne: string;
    reminderOffsetsCommaSeparated: string;
    currencyThreeLetters: string;
  };
  categories: Record<VoucherCategory, string>;
  voucherTypes: Record<VoucherType, string>;
  voucherStatuses: Record<VoucherStatus, string>;
};

const englishCopy: AppCopy = {
  navigation: {
    wallet: 'Wallet',
    details: 'Details',
    voucher: 'Voucher',
    settings: 'Settings',
    access: 'Access',
  },
  common: {
    all: 'All',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    saving: 'Saving...',
    delete: 'Delete',
    deleting: 'Deleting...',
    update: 'Update',
    updating: 'Updating...',
    open: 'Open',
    notSet: 'Not set',
    none: 'None',
    noMerchant: 'No merchant',
    noValue: 'No value',
    other: 'Other',
    noNotesYet: 'No notes yet.',
    noAttachments: 'No attachments.',
    unknownType: 'Unknown type',
    today: 'Today',
    expired: 'Expired',
    invalidAmountTitle: 'Invalid amount',
    invalidAmountMessage: 'Enter a usage amount greater than zero.',
    updatedTitle: 'Updated',
    updateFailedTitle: 'Update failed',
    deleteFailedTitle: 'Delete failed',
    saveFailedTitle: 'Save failed',
    loadFailedTitle: 'Load failed',
    notFoundTitle: 'Not found',
    notFoundMessage: 'The requested item is not available in the current wallet context.',
    clearFilters: 'Clear filters',
    resetSearchAndFilters: 'Reset search and filters',
    showFilters: 'Show filters',
    hideFilters: 'Hide filters',
  },
  language: {
    label: 'Language',
    english: 'English',
    hebrew: 'Hebrew',
    switchToEnglish: 'Switch language to English',
    switchToHebrew: 'Switch language to Hebrew',
  },
  menu: {
    overview: 'Overview',
    settings: 'Settings',
    signOut: 'Sign out',
    openMenu: 'Open menu',
    languageUpdateFailedTitle: 'Language update failed',
    languageUpdateFailedMessage: 'Unable to save the selected language right now.',
    signOutFailedTitle: 'Sign out failed',
    signOutFailedMessage: 'Unable to sign out right now.',
  },
  auth: {
    email: 'Email',
    password: 'Password',
    displayName: 'Display name',
    signIn: 'Sign in',
    createAccount: 'Create account',
    needAccount: 'Need an account?',
    alreadyHaveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    createAccountLink: 'Create account',
    minimumPassword: 'Minimum 6 characters',
    optional: 'Optional',
    incorrectCredentials: 'Incorrect email or password.',
    emailConfirmationRequired: 'Email confirmation required.',
    unableToSignIn: 'Unable to sign in right now.',
    invalidLoginDetails: 'Invalid login details.',
    alreadyRegistered: 'This email is already registered. Try signing in instead.',
    accountCreated: 'Account created.',
    accountCreatedButWalletIncomplete: 'Account created, but personal wallet setup is incomplete.',
    invalidRegistrationDetails: 'Invalid registration details.',
    unableToCreateAccount: 'Unable to create account right now.',
    unableToCreateAccountPrefix: 'Unable to create account:',
    couldNotReachAuthServer: 'Could not reach the auth server.',
    supabaseCredentialsInvalid: 'Supabase credentials are invalid.',
    supabaseEnvMissing: 'Supabase environment variables are missing.',
  },
  settings: {
    notificationsEnabled: 'Notifications enabled',
    defaultReminderOffsets: 'Default reminder offsets',
    registerPushToken: 'Register Expo push token',
    language: 'Language',
    languageHelp: 'Slide between English and Hebrew.',
    defaultCurrency: 'Default currency',
    saveSettings: 'Save settings',
    logOut: 'Log out',
    settingsSavedTitle: 'Settings saved',
    settingsSavedMessage: 'Your defaults have been updated.',
    saveFailedTitle: 'Save failed',
    saveFailedMessage: 'Unable to save settings.',
    pushRegistrationFailed: 'Push registration failed.',
    signOutFailedTitle: 'Sign out failed',
    signOutFailedMessage: 'Unable to sign out right now.',
  },
  home: {
    myWallet: 'My Wallet',
    addVoucher: 'Add voucher',
    searchPlaceholder: 'Search in all voucher fields',
    sort: 'Sort',
    category: 'Category',
    brand: 'Brand',
    sortVouchers: 'Sort vouchers',
    filterByCategory: 'Filter by category',
    filterByBrand: 'Filter by brand',
    oldToNew: 'Soonest expiry',
    newToOld: 'Latest expiry',
    expiringSoon: 'Expiring soon',
    active: 'Active',
    redeemed: 'Redeemed',
    expiredSection: 'Expired',
    voucherLoadingFailed: 'Voucher loading failed.',
    noVouchersYetTitle: 'No vouchers yet',
    noVouchersYetMessage: 'Create your first voucher to start tracking balances, products, and expiry reminders.',
    noVouchersYetButton: 'Create voucher',
    noMatchingVouchersTitle: 'No matching vouchers',
    noMatchingVouchersMessage: 'Try a different term or adjust category and brand filters.',
    redeemVoucherTitle: 'Redeem voucher',
    redeemVoucherMessage: 'This voucher will move to redeemed.',
    updateUsageTitle: 'Update usage',
    updateUsageMessage: 'Enter how much value was used now.',
    redeem: 'Redeem',
    redeeming: 'Redeeming...',
    updateUsage: 'Update usage',
    updating: 'Updating...',
    remainingPrefix: 'Remaining',
    expiresPrefix: 'Expires',
    redeemedModalMessagePrefix: 'will move to redeemed.',
  },
  voucherEntry: {
    title: 'Create voucher',
    subtitle: 'Choose how you want to start.',
    uploadFromFile: 'Upload from file',
    uploadFromFileHint: 'Pick image/PDF, then we will suggest fields for review.',
    createManually: 'Create manually',
    createManuallyHint: 'Open an empty form. You can still attach a file without auto-extraction.',
    chooseTypeTitle: 'Choose voucher type before upload',
    chooseTypeHint: 'Select voucher type to continue.',
    continueButton: 'Continue',
  },
  voucherDetails: {
    unableToLoadDetails: 'Unable to load voucher details right now.',
    notFoundTitle: 'Voucher not found',
    notFoundMessage: 'The requested voucher is not available in the current wallet context.',
    category: 'Category',
    expiry: 'Expiry',
    merchant: 'Merchant',
    totalValue: 'Total value',
    usedValue: 'Used value',
    remainingValue: 'Remaining value',
    product: 'Product',
    attachment: 'Attachment',
    code: 'Code',
    status: 'Status',
    redeemedAt: 'Redeemed at',
    notes: 'Notes',
    editVoucher: 'Edit voucher',
    markAsRedeemed: 'Mark as redeemed',
    updateUsage: 'Update usage',
    deleteVoucher: 'Delete voucher',
    deleteVoucherTitle: 'Delete voucher',
    deleteVoucherMessage: 'This action cannot be undone.',
    markRedeemedTitle: 'Mark as redeemed',
    markRedeemedMessage: 'This voucher will move to redeemed status.',
    usageUpdatedMessage: 'Voucher usage was updated successfully.',
    noAttachments: 'No attachments.',
    openAttachment: 'Open',
    updateUsageModalTitle: 'Update usage',
    updateUsageModalMessage: 'Enter how much value was used now.',
    attachmentFailedTitle: 'Attachment failed',
    attachmentFailedMessage: 'Unable to open attachment.',
  },
  voucherForm: {
    type: 'Type',
    money: 'Money',
    product: 'Product',
    category: 'Category',
    productName: 'Product name',
    merchantName: 'Merchant name',
    faceValue: 'Face value',
    usedValue: 'Used value',
    currency: 'Currency',
    expiryDate: 'Expiry date',
    code: 'Code',
    notes: 'Notes',
    productNamePlaceholder: 'Spa package, coffee machine, etc.',
    merchantNamePlaceholder: 'Merchant or brand',
    faceValuePlaceholder: '0.00',
    usedValuePlaceholder: '0.00',
    currencyPlaceholder: 'USD',
    expiryDatePlaceholder: 'YYYY-MM-DD',
    codePlaceholder: 'Optional redemption code',
    notesPlaceholder: 'Terms, constraints, gift details...',
    pickImageOrPdf: 'Pick image or PDF',
    saveVoucher: 'Save voucher',
    reviewHighlightedFields: 'Review the highlighted fields.',
    formIncompleteTitle: 'Form incomplete',
    voucherSavedTitle: 'Voucher saved',
    voucherSavedMessage: 'Your voucher was saved successfully.',
    unableToSaveVoucherTitle: 'Unable to save voucher',
    unableToSaveVoucherMessage: 'Review your values.',
    attachmentFailedTitle: 'Attachment failed',
    attachmentFailedMessage: 'Unable to pick this file.',
    extractingDetails: 'Extracting voucher details...',
    attachmentAddedManualMode: 'File attached. Manual mode does not auto-extract fields.',
    autoFillReviewNotice: 'We filled some fields automatically. Please review before saving.',
    autoFillNoDetailsFound: 'No clear voucher details were found. You can fill the form manually.',
    extractionFailedMessage: 'Couldn\'t extract details automatically. You can still fill them manually.',
  },
  validation: {
    email: 'Enter a valid email address.',
    passwordTooShort: 'Password must be at least 6 characters.',
    invalidNumber: 'Enter a valid number.',
    currencyCodeLength: 'Currency code must be 3 letters.',
    dateFormat: 'Date must use YYYY-MM-DD.',
    expiryDateRequired: 'Expiry date is required.',
    merchantNameRequired: 'Merchant name is required.',
    faceValueRequired: 'Face value is required for a monetary voucher.',
    productNameRequired: 'Product name is required for a product voucher.',
    reminderOffsetsWholeNumbers: 'Reminder offsets must be whole numbers between 0 and 365.',
    reminderOffsetsAtLeastOne: 'Reminder offsets must contain at least one whole number between 0 and 365.',
    reminderOffsetsCommaSeparated: 'Reminder offsets must be comma-separated whole numbers between 0 and 365.',
    currencyThreeLetters: 'Currency must be a 3-letter code like ILS or USD.',
  },
  categories: {
    Groceries: 'Groceries',
    Dining: 'Dining',
    Shopping: 'Shopping',
    Travel: 'Travel',
    Entertainment: 'Entertainment',
    'Health & Beauty': 'Health & Beauty',
    Electronics: 'Electronics',
    'Home & Garden': 'Home & Garden',
    Other: 'Other',
  },
  voucherTypes: {
    monetary: 'Money',
    product: 'Product',
  },
  voucherStatuses: {
    active: 'Active',
    redeemed: 'Redeemed',
    expired: 'Expired',
    archived: 'Archived',
  },
};

const hebrewCopy: AppCopy = {
  navigation: {
    wallet: 'ארנק',
    details: 'פרטים',
    voucher: 'שובר',
    settings: 'הגדרות',
    access: 'כניסה',
  },
  common: {
    all: 'הכל',
    cancel: 'בטל',
    close: 'סגור',
    save: 'שמור',
    saving: 'שומר...',
    delete: 'מחק',
    deleting: 'מוחק...',
    update: 'עדכן',
    updating: 'מעדכן...',
    open: 'פתח',
    notSet: 'לא הוגדר',
    none: 'אין',
    noMerchant: 'ללא סוחר',
    noValue: 'ללא ערך',
    other: 'אחר',
    noNotesYet: 'אין הערות עדיין.',
    noAttachments: 'אין קבצים מצורפים.',
    unknownType: 'סוג לא ידוע',
    today: 'היום',
    expired: 'פג תוקף',
    invalidAmountTitle: 'כמות לא תקינה',
    invalidAmountMessage: 'הזן סכום שימוש גדול מאפס.',
    updatedTitle: 'עודכן',
    updateFailedTitle: 'העדכון נכשל',
    deleteFailedTitle: 'המחיקה נכשלה',
    saveFailedTitle: 'השמירה נכשלה',
    loadFailedTitle: 'הטעינה נכשלה',
    notFoundTitle: 'לא נמצא',
    notFoundMessage: 'הפריט המבוקש אינו זמין בהקשר הארנק הנוכחי.',
    clearFilters: 'ניקוי מסננים',
    resetSearchAndFilters: 'איפוס חיפוש ומסננים',
    showFilters: 'הצג מסננים',
    hideFilters: 'הסתר מסננים',
  },
  language: {
    label: 'שפה',
    english: 'אנגלית',
    hebrew: 'עברית',
    switchToEnglish: 'העבר לאנגלית',
    switchToHebrew: 'העבר לעברית',
  },
  menu: {
    overview: 'סקירה כללית',
    settings: 'הגדרות',
    signOut: 'התנתק',
    openMenu: 'פתח תפריט',
    languageUpdateFailedTitle: 'עדכון השפה נכשל',
    languageUpdateFailedMessage: 'לא ניתן לשמור את השפה שנבחרה כרגע.',
    signOutFailedTitle: 'התנתקות נכשלה',
    signOutFailedMessage: 'לא ניתן להתנתק כרגע.',
  },
  auth: {
    email: 'אימייל',
    password: 'סיסמה',
    displayName: 'שם תצוגה',
    signIn: 'התחבר',
    createAccount: 'צור חשבון',
    needAccount: 'אין לך חשבון?',
    alreadyHaveAccount: 'כבר יש לך חשבון?',
    signInLink: 'התחבר',
    createAccountLink: 'צור חשבון',
    minimumPassword: 'לפחות 6 תווים',
    optional: 'אופציונלי',
    incorrectCredentials: 'אימייל או סיסמה שגויים.',
    emailConfirmationRequired: 'נדרש אישור אימייל.',
    unableToSignIn: 'לא ניתן להתחבר כרגע.',
    invalidLoginDetails: 'פרטי התחברות לא תקינים.',
    alreadyRegistered: 'האימייל הזה כבר רשום. נסה להתחבר במקום.',
    accountCreated: 'החשבון נוצר.',
    accountCreatedButWalletIncomplete: 'החשבון נוצר, אבל הגדרת הארנק האישי אינה מלאה.',
    invalidRegistrationDetails: 'פרטי הרשמה לא תקינים.',
    unableToCreateAccount: 'לא ניתן ליצור חשבון כרגע.',
    unableToCreateAccountPrefix: 'לא ניתן ליצור חשבון:',
    couldNotReachAuthServer: 'לא ניתן להגיע לשרת ההתחברות.',
    supabaseCredentialsInvalid: 'פרטי Supabase אינם תקינים.',
    supabaseEnvMissing: 'משתני הסביבה של Supabase חסרים.',
  },
  settings: {
    notificationsEnabled: 'התראות פעילות',
    defaultReminderOffsets: 'הפרשי תזכורת ברירת מחדל',
    registerPushToken: 'רשום טוקן Expo Push',
    language: 'שפה',
    languageHelp: 'החלף בין אנגלית לעברית.',
    defaultCurrency: 'מטבע ברירת מחדל',
    saveSettings: 'שמור הגדרות',
    logOut: 'התנתק',
    settingsSavedTitle: 'ההגדרות נשמרו',
    settingsSavedMessage: 'ברירות המחדל שלך עודכנו.',
    saveFailedTitle: 'שמירה נכשלה',
    saveFailedMessage: 'לא ניתן לשמור את ההגדרות.',
    pushRegistrationFailed: 'רישום ה-Push נכשל.',
    signOutFailedTitle: 'התנתקות נכשלה',
    signOutFailedMessage: 'לא ניתן להתנתק כרגע.',
  },
  home: {
    myWallet: 'הארנק שלי',
    addVoucher: 'הוסף שובר',
    searchPlaceholder: 'חיפוש בכל שדות השובר',
    sort: 'מיון',
    category: 'קטגוריה',
    brand: 'מותג',
    sortVouchers: 'מיון שוברים',
    filterByCategory: 'סינון לפי קטגוריה',
    filterByBrand: 'סינון לפי מותג',
    oldToNew: 'תפוגה קרובה',
    newToOld: 'תפוגה רחוקה',
    expiringSoon: 'פג תוקף בקרוב',
    active: 'פעילים',
    redeemed: 'נפדו',
    expiredSection: 'פג תוקף',
    voucherLoadingFailed: 'טעינת השוברים נכשלה.',
    noVouchersYetTitle: 'אין שוברים עדיין',
    noVouchersYetMessage: 'צור את השובר הראשון כדי להתחיל לעקוב אחר יתרות, מוצרים ותזכורות תפוגה.',
    noVouchersYetButton: 'צור שובר',
    noMatchingVouchersTitle: 'אין שוברים תואמים',
    noMatchingVouchersMessage: 'נסה מונח אחר או התאם את מסנני הקטגוריה והמותג.',
    redeemVoucherTitle: 'פדיון שובר',
    redeemVoucherMessage: 'השובר הזה יעבור למצב נפדה.',
    updateUsageTitle: 'עדכון שימוש',
    updateUsageMessage: 'הזן כמה ערך נוצל כעת.',
    redeem: 'פדה',
    redeeming: 'פודה...',
    updateUsage: 'עדכן שימוש',
    updating: 'מעדכן...',
    remainingPrefix: 'נותרו',
    expiresPrefix: 'בתוקף עד',
    redeemedModalMessagePrefix: 'יעבור למצב נפדה.',
  },
  voucherEntry: {
    title: 'יצירת שובר',
    subtitle: 'בחר איך להתחיל.',
    uploadFromFile: 'העלאה מתוך קובץ',
    uploadFromFileHint: 'בחר תמונה או PDF, ואז נמלא הצעות לבדיקה.',
    createManually: 'יצירה ידנית',
    createManuallyHint: 'נפתח טופס ריק. אפשר עדיין לצרף קובץ בלי חילוץ אוטומטי.',
    chooseTypeTitle: 'בחר סוג שובר לפני ההעלאה',
    chooseTypeHint: 'בחר סוג שובר כדי להמשיך.',
    continueButton: 'המשך',
  },
  voucherDetails: {
    unableToLoadDetails: 'לא ניתן לטעון את פרטי השובר כרגע.',
    notFoundTitle: 'השובר לא נמצא',
    notFoundMessage: 'השובר המבוקש אינו זמין בהקשר הארנק הנוכחי.',
    category: 'קטגוריה',
    expiry: 'תפוגה',
    merchant: 'סוחר',
    totalValue: 'ערך כולל',
    usedValue: 'ערך שנוצל',
    remainingValue: 'ערך שנותר',
    product: 'מוצר',
    attachment: 'קובץ מצורף',
    code: 'קוד',
    status: 'סטטוס',
    redeemedAt: 'נפדה ב',
    notes: 'הערות',
    editVoucher: 'ערוך שובר',
    markAsRedeemed: 'סמן כפדוי',
    updateUsage: 'עדכן שימוש',
    deleteVoucher: 'מחק שובר',
    deleteVoucherTitle: 'מחיקת שובר',
    deleteVoucherMessage: 'הפעולה הזו אינה ניתנת לביטול.',
    markRedeemedTitle: 'סימון כפדוי',
    markRedeemedMessage: 'השובר יעבור למצב נפדה.',
    usageUpdatedMessage: 'שימוש בשובר עודכן בהצלחה.',
    noAttachments: 'אין קבצים מצורפים.',
    openAttachment: 'פתח',
    updateUsageModalTitle: 'עדכון שימוש',
    updateUsageModalMessage: 'הזן כמה ערך נוצל כעת.',
    attachmentFailedTitle: 'הקובץ נכשל',
    attachmentFailedMessage: 'לא ניתן לפתוח את הקובץ המצורף.',
  },
  voucherForm: {
    type: 'סוג',
    money: 'כספי',
    product: 'מוצר',
    category: 'קטגוריה',
    productName: 'שם המוצר',
    merchantName: 'שם הסוחר',
    faceValue: 'ערך נקוב',
    usedValue: 'ערך שנוצל',
    currency: 'מטבע',
    expiryDate: 'תאריך תפוגה',
    code: 'קוד',
    notes: 'הערות',
    productNamePlaceholder: 'חבילת ספא, מכונת קפה וכו׳',
    merchantNamePlaceholder: 'סוחר או מותג',
    faceValuePlaceholder: '0.00',
    usedValuePlaceholder: '0.00',
    currencyPlaceholder: 'USD',
    expiryDatePlaceholder: 'YYYY-MM-DD',
    codePlaceholder: 'קוד מימוש אופציונלי',
    notesPlaceholder: 'תנאים, הגבלות, פרטי מתנה...',
    pickImageOrPdf: 'בחר תמונה או PDF',
    saveVoucher: 'שמור שובר',
    reviewHighlightedFields: 'בדוק את השדות המסומנים.',
    formIncompleteTitle: 'הטופס לא הושלם',
    voucherSavedTitle: 'השובר נשמר',
    voucherSavedMessage: 'השובר נשמר בהצלחה.',
    unableToSaveVoucherTitle: 'לא ניתן לשמור את השובר',
    unableToSaveVoucherMessage: 'בדוק את הערכים שלך.',
    attachmentFailedTitle: 'הקובץ נכשל',
    attachmentFailedMessage: 'לא ניתן לבחור קובץ זה.',
    extractingDetails: 'מחלץ פרטי שובר...',
    attachmentAddedManualMode: 'הקובץ צורף. במצב ידני אין חילוץ שדות אוטומטי.',
    autoFillReviewNotice: 'מילאנו חלק מהשדות אוטומטית. נא לבדוק לפני השמירה.',
    autoFillNoDetailsFound: 'לא נמצאו פרטי שובר ברורים. אפשר למלא ידנית.',
    extractionFailedMessage: 'לא הצלחנו לחלץ פרטים אוטומטית. אפשר להמשיך ולמלא ידנית.',
  },
  validation: {
    email: 'הזן כתובת אימייל תקינה.',
    passwordTooShort: 'הסיסמה חייבת להכיל לפחות 6 תווים.',
    invalidNumber: 'הזן מספר תקין.',
    currencyCodeLength: 'קוד המטבע חייב להכיל 3 אותיות.',
    dateFormat: 'התאריך חייב להיות בפורמט YYYY-MM-DD.',
    expiryDateRequired: 'נדרש תאריך תפוגה.',
    merchantNameRequired: 'נדרש שם סוחר.',
    faceValueRequired: 'נדרש ערך נקוב לשובר כספי.',
    productNameRequired: 'נדרש שם מוצר לשובר מוצר.',
    reminderOffsetsWholeNumbers: 'הפרשי תזכורת חייבים להיות מספרים שלמים בין 0 ל-365.',
    reminderOffsetsAtLeastOne: 'הפרשי תזכורת חייבים להכיל לפחות מספר שלם אחד בין 0 ל-365.',
    reminderOffsetsCommaSeparated: 'הפרשי תזכורת חייבים להיות מספרים שלמים מופרדים בפסיקים בין 0 ל-365.',
    currencyThreeLetters: 'המטבע חייב להיות קוד בן 3 אותיות כמו ILS או USD.',
  },
  categories: {
    Groceries: 'מכולת',
    Dining: 'מסעדות',
    Shopping: 'קניות',
    Travel: 'נסיעות',
    Entertainment: 'בילוי',
    'Health & Beauty': 'בריאות ויופי',
    Electronics: 'אלקטרוניקה',
    'Home & Garden': 'בית וגן',
    Other: 'אחר',
  },
  voucherTypes: {
    monetary: 'כספי',
    product: 'מוצר',
  },
  voucherStatuses: {
    active: 'פעיל',
    redeemed: 'נפדה',
    expired: 'פג תוקף',
    archived: 'בארכיון',
  },
};

export const translations = {
  en: englishCopy,
  he: hebrewCopy,
} as const;

export function getCopy(language: SupportedLanguage): AppCopy {
  return translations[language];
}

export function getLocaleForLanguage(language: SupportedLanguage): string {
  return language === 'he' ? 'he-IL' : 'en-US';
}

export function getCategoryLabel(category: VoucherCategory | string, language: SupportedLanguage): string {
  return translations[language].categories[category as VoucherCategory] ?? category;
}

export function getVoucherTypeLabel(type: VoucherType, language: SupportedLanguage): string {
  return translations[language].voucherTypes[type];
}

export function getVoucherStatusLabel(status: VoucherStatus | string, language: SupportedLanguage): string {
  return translations[language].voucherStatuses[status as VoucherStatus] ?? status;
}

export function getDaysLeftLabel(days: number, language: SupportedLanguage): string {
  if (language === 'he') {
    if (days === 0) {
      return translations.he.common.today;
    }

    if (days === 1) {
      return 'יום אחד נותר';
    }

    return `${days} ימים נותרו`;
  }

  if (days === 0) {
    return translations.en.common.today;
  }

  if (days === 1) {
    return '1 day left';
  }

  return `${days} days left`;
}

export function formatRemainingValueLabel(valueLabel: string, language: SupportedLanguage): string {
  return language === 'he' ? `${translations.he.home.remainingPrefix} ${valueLabel}` : `${translations.en.home.remainingPrefix} ${valueLabel}`;
}

export function formatExpiresLabel(valueLabel: string, language: SupportedLanguage): string {
  return language === 'he' ? `${translations.he.home.expiresPrefix} ${valueLabel}` : `${translations.en.home.expiresPrefix} ${valueLabel}`;
}

const hebrewMessageTranslations: Record<string, string> = {
  'Enter a valid email address.': translations.he.validation.email,
  'Password must be at least 6 characters.': translations.he.validation.passwordTooShort,
  'Enter a valid number.': translations.he.validation.invalidNumber,
  'Currency code must be 3 letters.': translations.he.validation.currencyCodeLength,
  'Date must use YYYY-MM-DD.': translations.he.validation.dateFormat,
  'Expiry date is required.': translations.he.validation.expiryDateRequired,
  'Merchant name is required.': translations.he.validation.merchantNameRequired,
  'Face value is required for a monetary voucher.': translations.he.validation.faceValueRequired,
  'Product name is required for a product voucher.': translations.he.validation.productNameRequired,
  'Reminder offsets must be whole numbers between 0 and 365.': translations.he.validation.reminderOffsetsWholeNumbers,
  'Reminder offsets must contain at least one whole number between 0 and 365.': translations.he.validation.reminderOffsetsAtLeastOne,
  'Reminder offsets must be comma-separated whole numbers between 0 and 365.': translations.he.validation.reminderOffsetsCommaSeparated,
  'Currency must be a 3-letter code like ILS or USD.': translations.he.validation.currencyThreeLetters,
  'Incorrect email or password.': translations.he.auth.incorrectCredentials,
  'Email confirmation required.': translations.he.auth.emailConfirmationRequired,
  'Unable to sign in right now.': translations.he.auth.unableToSignIn,
  'Invalid login details.': translations.he.auth.invalidLoginDetails,
  'This email is already registered. Try signing in instead.': translations.he.auth.alreadyRegistered,
  'Account created.': translations.he.auth.accountCreated,
  'Account created, but personal wallet setup is incomplete.': translations.he.auth.accountCreatedButWalletIncomplete,
  'Invalid registration details.': translations.he.auth.invalidRegistrationDetails,
  'Unable to create account right now.': translations.he.auth.unableToCreateAccount,
  'Could not reach the auth server.': translations.he.auth.couldNotReachAuthServer,
  'Supabase credentials are invalid.': translations.he.auth.supabaseCredentialsInvalid,
  'Supabase environment variables are missing.': translations.he.auth.supabaseEnvMissing,
  'Notification permission was not granted.': 'הרשאת ההתראות לא ניתנה.',
  'Push token registration requires a physical device.': 'רישום טוקן Push דורש מכשיר פיזי.',
  'EAS project ID is not available. Build credentials are required before registering Expo push tokens.':
    'מזהה פרויקט EAS אינו זמין. נדרשות הרשאות build לפני רישום טוקני Expo Push.',
  'Push token captured and ready for server-side reminder scheduling.': 'טוקן ה-Push נשמר ומוכן לתזמון תזכורות בצד השרת.',
  'Unable to pick this file.': translations.he.voucherForm.attachmentFailedMessage,
  'Unable to save settings.': translations.he.settings.saveFailedMessage,
  'Unable to sign out right now.': translations.he.settings.signOutFailedMessage,
  'Unable to save voucher.': translations.he.voucherForm.unableToSaveVoucherMessage,
  'Review the highlighted fields.': translations.he.voucherForm.reviewHighlightedFields,
  [duplicateVoucherCodeErrorMessage]: 'כבר קיים בארנק קופון עם הקוד הזה.',
  'Enter a usage amount greater than zero.': translations.he.common.invalidAmountMessage,
  'Voucher usage was updated successfully.': translations.he.voucherDetails.usageUpdatedMessage,
  'This action cannot be undone.': translations.he.voucherDetails.deleteVoucherMessage,
  'This voucher will move to redeemed status.': translations.he.voucherDetails.markRedeemedMessage,
  'This voucher will move to redeemed.': translations.he.home.redeemVoucherMessage,
  'Unable to open attachment.': translations.he.voucherDetails.attachmentFailedMessage,
  'You must be signed in to extract voucher details.': translations.he.voucherForm.extractionFailedMessage,
  'Couldn\'t extract details automatically. You can still fill them manually.': translations.he.voucherForm.extractionFailedMessage,
  'Unable to load voucher details right now.': translations.he.voucherDetails.unableToLoadDetails,
  'The requested voucher is not available in the current wallet context.': translations.he.voucherDetails.notFoundMessage,
  'Review your values.': translations.he.voucherForm.unableToSaveVoucherMessage,
  'Search in all voucher fields': translations.he.home.searchPlaceholder,
};

export function translateKnownMessage(message: string, language: SupportedLanguage): string {
  if (language !== 'he') {
    return message;
  }

  return hebrewMessageTranslations[message] ?? message;
}
