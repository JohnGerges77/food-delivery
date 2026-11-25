// Static Owner interface copy. Restaurant and product names are never translated here.
const ar: Record<string, string> = {
  'Manage Orders': 'إدارة الطلبات', 'Update Menu Items': 'تحديث المنيو', 'Track Restaurant Activity': 'متابعة نشاط المطعم',
  'Orders Processed': 'طلبات تمت معالجتها', 'Menu Items': 'أصناف المنيو', 'Restaurant Rating': 'تقييم المطعم',
  'Savora Admin Portal': 'بوابة إدارة Savora', 'Restaurant operations, refined': 'إدارة مطعمك بسهولة',
  'Manage Your Restaurant': 'أدر مطعمك', 'With Confidence': 'بكل ثقة',
  'Monitor orders, manage products, update menus, and keep your restaurant running smoothly from one powerful dashboard.': 'تابع الطلبات وأدر المنتجات وحدّث المنيو من لوحة تحكم واحدة.',
  'Secure Access': 'دخول آمن', 'Welcome Back': 'أهلًا بعودتك',
  'Sign in to access your restaurant dashboard.': 'سجّل الدخول للوصول إلى لوحة تحكم مطعمك.',
  Email: 'البريد الإلكتروني', Password: 'كلمة المرور', 'Enter your password': 'أدخل كلمة المرور',
  'Hide password': 'إخفاء كلمة المرور', 'Show password': 'إظهار كلمة المرور',
  'Signing in…': 'جارٍ تسجيل الدخول…', Login: 'تسجيل الدخول',
  'Protected by Savora secure administration services.': 'محمي بواسطة خدمات إدارة Savora الآمنة.',
  'Enter a valid email and password.': 'أدخل بريدًا إلكترونيًا وكلمة مرور صحيحين.',
  'Too many attempts. Please try again later.': 'محاولات كثيرة جدًا. حاول مرة أخرى لاحقًا.',
  'Cannot reach the server. Please try again.': 'تعذر الاتصال بالخادم. حاول مرة أخرى.',
  'Unable to sign in. Check your credentials and try again.': 'تعذر تسجيل الدخول. تحقق من بياناتك وحاول مرة أخرى.',
  'Switch to dark mode': 'التبديل إلى المظهر الداكن', 'Switch to light mode': 'التبديل إلى المظهر الفاتح',
  'Dismiss notification': 'إغلاق التنبيه', 'Top product count': 'عدد أفضل المنتجات',
  Image: 'الصورة', Delete: 'حذف', 'Retry Categories': 'إعادة تحميل الأقسام',
  'Create a Category before adding Products.': 'أضف قسمًا قبل إضافة المنتجات.',
  'Go to Categories': 'الذهاب إلى الأقسام', 'Filter by category': 'تصفية حسب القسم',
  'All categories': 'كل الأقسام', 'Filter by availability': 'تصفية حسب التوفر',
  'Any availability': 'كل حالات التوفر', Available: 'متاح', Unavailable: 'غير متاح',
  'Filter by featured': 'تصفية حسب المنتجات المميزة', 'Any featured': 'كل المنتجات',
  Featured: 'مميز', 'Not featured': 'غير مميز', 'Product sort': 'ترتيب المنتجات',
  Newest: 'الأحدث', Oldest: 'الأقدم', 'Name A–Z': 'الاسم تصاعديًا', 'Name Z–A': 'الاسم تنازليًا',
  'Price low–high': 'السعر من الأقل للأعلى', 'Price high–low': 'السعر من الأعلى للأقل',
  'Loading products': 'جارٍ تحميل المنتجات', Retry: 'إعادة المحاولة',
  'No products found': 'لا توجد منتجات', 'Try another filter or add a Product to a Category.': 'جرّب تصفية أخرى أو أضف منتجًا إلى قسم.',
  'No products match on this page.': 'لا توجد منتجات مطابقة في هذه الصفحة.',
  Product: 'المنتج', Category: 'القسم', Price: 'السعر', Status: 'الحالة', Actions: 'الإجراءات',
  'Inactive category · hidden publicly': 'قسم غير نشط · لا يظهر للعملاء',
  'Inactive category · hidden from public menu': 'قسم غير نشط · لا يظهر في المنيو',
  Previous: 'السابق', Page: 'صفحة', of: 'من', Next: 'التالي', Cancel: 'إلغاء',
  'Delete Product': 'حذف المنتج', '? This cannot be undone.': '؟ لا يمكن التراجع عن الحذف.',
  'Products used by historical Orders cannot be permanently deleted.': 'لا يمكن حذف منتج موجود في طلبات سابقة نهائيًا.',
  'This product has 10 additional images. Remove one before uploading another.': 'لديك 10 صور إضافية لهذا المنتج. احذف صورة قبل إضافة أخرى.',
  'Additional images': 'الصور الإضافية', 'Remove image': 'حذف الصورة',
  'Loading restaurant settings': 'جارٍ تحميل إعدادات المطعم', 'Restaurant Profile': 'بيانات المطعم',
  'Storefront slug:': 'رابط المطعم:', 'Opening Hours': 'ساعات العمل',
  'Display text for your storefront.': 'النص الذي يظهر في واجهة المطعم.', 'Social Links': 'روابط التواصل',
  'Hero Product': 'المنتج الرئيسي', 'Choose an available product for your storefront Hero. Its own image appears when available.': 'اختر منتجًا متاحًا ليظهر في واجهة المطعم الرئيسية مع صورته إن وُجدت.',
  'Featured Hero product': 'المنتج الرئيسي المختار', 'Automatic selection / graphic fallback': 'اختيار تلقائي / صورة بديلة',
  'Previously selected product (unavailable or not loaded)': 'المنتج المختار سابقًا غير متاح أو لم يُحمّل',
  'Load more products': 'تحميل المزيد من المنتجات', 'Delivery Settings': 'إعدادات التوصيل',
  'Delivery Available': 'التوصيل متاح', 'Allow delivery orders.': 'السماح بطلبات التوصيل.',
  Appearance: 'المظهر', 'Brand preview': 'معاينة العلامة', 'Color preview': 'معاينة اللون',
  'JPEG, PNG, or WebP · up to 4 MB. A clear image at least 16 × 16 pixels.': 'JPEG أو PNG أو WebP، بحد أقصى 4 ميجابايت، وأبعاد لا تقل عن 16 × 16 بكسل.',
  Uploading: 'جارٍ الرفع', 'Remove uploaded image': 'حذف الصورة المرفوعة',
  'Opening…': 'جارٍ الفتح…', Edit: 'تعديل', 'Make unavailable': 'إيقاف التوفر', 'Make available': 'إتاحة المنتج',
  Unfeature: 'إلغاء التمييز', Feature: 'تمييز المنتج', 'No description': 'لا يوجد وصف',
  'Category unavailable': 'القسم غير متاح', Yes: 'نعم', No: 'لا',
  ' (inactive)': ' (غير نشط)', ' (inactive — hidden publicly)': ' (غير نشط — لا يظهر للعملاء)',
  'Edit Product': 'تعديل المنتج', 'Add Product': 'إضافة منتج', 'Save Product': 'حفظ المنتج',
  'Saving…': 'جارٍ الحفظ…', 'Deleting…': 'جارٍ الحذف…', 'Mark Unavailable': 'إيقاف التوفر',
  Description: 'الوصف', 'Primary Image URL': 'رابط الصورة الرئيسية',
  'Additional Image URLs — one per line': 'روابط الصور الإضافية — رابط في كل سطر',
  'Preparation Time (minutes)': 'وقت التحضير (بالدقائق)', Calories: 'السعرات الحرارية',
  'Image preview': 'معاينة الصورة', 'No image; storefront graphic will appear': 'لا توجد صورة؛ سيظهر التصميم البديل',
  'Orders performance chart': 'رسم أداء الطلبات', 'Delivered order value chart': 'رسم قيمة الطلبات المسلّمة',
  'Product images': 'صور المنتج', 'Restaurant logo': 'شعار المطعم',
  'Additional product image': 'صورة إضافية للمنتج', 'Product image': 'صورة المنتج',
  'Replace image': 'استبدال الصورة', 'Upload image': 'رفع الصورة',
  'Selected image preview': 'معاينة الصورة المختارة', 'Current image': 'الصورة الحالية',
  'Could not load categories. Retry to select a real category.': 'تعذر تحميل الأقسام. أعد المحاولة لاختيار قسم.',
  'Could not load categories. Retry when the connection is available.': 'تعذر تحميل الأقسام. تحقق من الاتصال وأعد المحاولة.',
  'Could not open this category. Retry.': 'تعذر فتح القسم. أعد المحاولة.',
  'Could not update category status.': 'تعذر تغيير حالة القسم.',
  'Image upload failed.': 'تعذر رفع الصورة. تحقق من الملف وحاول مرة أخرى.',
  'Could not remove image.': 'تعذر حذف الصورة. حاول مرة أخرى.',
  'Could not load products. Retry when the connection is available.': 'تعذر تحميل المنتجات. تحقق من الاتصال وأعد المحاولة.',
  'Could not open this product. Retry.': 'تعذر فتح المنتج. أعد المحاولة.',
  'Could not confirm the save. Retry or refresh to check current data.': 'تعذر تأكيد الحفظ. أعد المحاولة أو حدّث الصفحة للتحقق من البيانات.',
  'Could not update this product.': 'تعذر تعديل المنتج.',
  'This Product appears in a historical Order and cannot be deleted. Mark it unavailable instead.': 'المنتج موجود في طلب سابق ولا يمكن حذفه. يمكنك إيقاف توفره.',
  'Could not confirm deletion. Refresh to check current data.': 'تعذر تأكيد الحذف. حدّث الصفحة للتحقق من البيانات.',
  'Could not make this product unavailable.': 'تعذر إيقاف توفر المنتج.',
  'Request rejected. Check trusted Origin and CSRF settings, then retry.': 'تعذر تنفيذ الطلب. حاول مرة أخرى.',
  'The server rejected these values. Review the form and retry.': 'تعذر حفظ القيم. راجع النموذج وحاول مرة أخرى.',
  'This record or its category is no longer available. Refresh and retry.': 'المنتج أو القسم غير متاح. حدّث الصفحة وحاول مرة أخرى.',
  'This slug is already used. Choose another slug.': 'تعذر حفظ البيانات بسبب تعارض. حدّث الصفحة وحاول مرة أخرى.',
  'Enter a name of 1–120 characters.': 'اكتب اسمًا من 1 إلى 120 حرفًا.',
  'Select a current category.': 'اختر قسمًا متاحًا.',
  'Use 2048 characters or fewer.': 'استخدم 2048 حرفًا أو أقل.',
  'Enter a root-relative path or HTTP(S) URL.': 'أدخل مسارًا يبدأ بـ / أو رابط HTTP(S) صحيحًا.',
  'Use at most 10 valid image paths or URLs, one per line.': 'أدخل حتى 10 روابط أو مسارات صحيحة للصور، رابطًا في كل سطر.',
  'Enter a whole number from 0 to 10,080.': 'أدخل عددًا صحيحًا من 0 إلى 10,080.',
  'Enter a number from 0 to 100,000.': 'أدخل رقمًا من 0 إلى 100,000.',
  'Restaurant name is required.': 'اسم المطعم مطلوب.', 'Select a valid product.': 'اختر منتجًا صحيحًا.',
  'Enter a valid email address.': 'أدخل بريدًا إلكترونيًا صحيحًا.',
  'Enter a WhatsApp number with its country code.': 'أدخل رقم واتساب مع رمز الدولة.',
  'Enter a valid HTTP or HTTPS URL without credentials.': 'أدخل رابط HTTP أو HTTPS صحيحًا بدون بيانات دخول.',
  'Use a hex color such as #ff7a00.': 'أدخل لونًا بصيغة hex مثل #ff7a00.',
  'This amount cannot be cleared by the current API.': 'لا يمكن ترك هذا المبلغ فارغًا.',
  'Enter a non-negative amount with up to 2 decimal places.': 'أدخل مبلغًا غير سالب برقمين عشريين كحد أقصى.',
  'Could not load eligible categories. Retry to choose a Hero product.': 'تعذر تحميل الأقسام. أعد المحاولة لاختيار المنتج الرئيسي.',
  'Could not load products. Retry to choose a Hero product.': 'تعذر تحميل المنتجات. أعد المحاولة لاختيار المنتج الرئيسي.',
  'Request rejected. Check the trusted Origin and CSRF configuration, then retry.': 'تعذر تنفيذ الطلب. حاول مرة أخرى.',
  'The server rejected these values. Review the fields and retry.': 'تعذر حفظ القيم. راجع الحقول وحاول مرة أخرى.',
  'Restaurant settings are unavailable for this owner.': 'إعدادات المطعم غير متاحة لهذا الحساب.',
  'Could not load restaurant settings. Check your connection and retry.': 'تعذر تحميل إعدادات المطعم. تحقق من الاتصال وحاول مرة أخرى.',
  'Could not confirm the save. Retry or reload to check current settings.': 'تعذر تأكيد الحفظ. أعد المحاولة أو حدّث الصفحة للتحقق من الإعدادات.',
};

export function ownerText(locale: string, text: string) {
  if (locale !== 'ar') return text;
  const price = /^Enter 0–1,000,000 with up to (\d+) decimal places\.$/.exec(text);
  if (price) return `أدخل سعرًا من 0 إلى 1,000,000 بما لا يزيد على ${price[1]} رقم عشري.`;
  return ar[text] ?? text;
}

export function productFeedback(locale: string, name: string, action: 'created' | 'updated' | 'deleted' | 'unavailable') {
  const arAction = { created: 'إضافة', updated: 'تعديل', deleted: 'حذف' };
  if (locale === 'ar') return action === 'unavailable' ? `المنتج ${name} غير متاح الآن.` : `تم ${arAction[action]} ${name}.`;
  return action === 'unavailable' ? `${name} is now unavailable.` : `${name} ${action}.`;
}

export function productImagesTitle(locale: string, name: string) {
  return locale === 'ar' ? `صور ${name}` : `Images: ${name}`;
}

export function productImageLabel(locale: string, name: string, index: number) {
  return locale === 'ar' ? `صورة ${name} ${index}` : `${name} image ${index}`;
}

export function missingImageLabel(locale: string, label: string) {
  return locale === 'ar' ? `${label}: لا توجد صورة` : `${label}: no image`;
}

export function chartSummary(locale: string, count: number, granularity: 'day' | 'week' | 'month', series: string) {
  const interval = { day: 'يومية', week: 'أسبوعية', month: 'شهرية' };
  return locale === 'ar' ? `${count} فترات ${interval[granularity]} بتوقيت UTC. ${series}` : `${count} UTC ${granularity} buckets. ${series}`;
}

export function chartTotalOrders(locale: string, count: string) {
  return locale === 'ar' ? `إجمالي الطلبات: ${count}` : `${count} total orders`;
}
