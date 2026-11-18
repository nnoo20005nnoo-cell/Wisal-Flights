// ==========================================
// 1. إعدادات قاعدة البيانات السحابية الدائمة (Firebase)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAaBoshKk2_-7n_Jvt1PWDCbkObE9_CBqpI",
    authDomain: "wisal-flights.firebaseapp.com",
    databaseURL: "https://wisal-flights-default-rtdb.firebaseio.com",
    projectId: "wisal-flights",
    storageBucket: "wisal-flights.firebasestorage.app",
    messagingSenderId: "1018982639164",
    appId: "1:1018982639164:web:fc084bf153143feacb8539",
    measurementId: "G-F7GZZP6QFC"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.error("خطأ في تهيئة Firebase:", e);
}

let bookings = [];
let notifiedIds = JSON.parse(localStorage.getItem('wisal_notified_ids')) || [];

const tripTypeLabels = {
    'one_way': 'ذهاب فقط',
    'round_fixed': 'ذهاب وعودة محدد',
    'go_fixed_return_open': 'ذهاب محدد وعودة مفتوح',
    'both_open': 'ذهاب مفتوح وعودة مفتوح'
};

// ==========================================
// 2. محرك الاتصال والمزامنة الدائمة مع السحابة وإصلاح الإحصائيات
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    addPassengerRow();
    fetchBookingsFromCloud();
});

function fetchBookingsFromCloud() {
    if (db) {
        db.ref('bookings').on('value', (snapshot) => {
            const rawData = snapshot.val();
            if (rawData) {
                let loadedArray = Array.isArray(rawData) ? rawData : Object.values(rawData);
                bookings = loadedArray.map(b => {
                    if (!b.passengers || !Array.isArray(b.passengers)) {
                        b.passengers = [{
                            name: b.passengerName || 'عميل غير مسجل',
                            passport: b.passportNumber || '---',
                            phone: b.phone || '000000000'
                        }];
                    }
                    return b;
                });
            } else {
                bookings = [];
            }
            renderTable();
            updateStatisticsEngine();
        }, (error) => {
            console.error("خطأ في جلب البيانات:", error);
            loadFromLocalStorageFallback();
        });
    } else {
        loadFromLocalStorageFallback();
    }
}

function loadFromLocalStorageFallback() {
    const localData = localStorage.getItem('wisal_flights_data');
    if (localData) {
        let loadedArray = JSON.parse(localData);
        bookings = loadedArray.map(b => {
            if (!b.passengers || !Array.isArray(b.passengers)) {
                b.passengers = [{
                    name: b.passengerName || 'عميل غير مسجل',
                    passport: b.passportNumber || '---',
                    phone: b.phone || '000000000'
                }];
            }
            return b;
        });
    } else {
        bookings = [];
    }
    renderTable();
    updateStatisticsEngine();
}

function saveToCloudAndLocal() {
    localStorage.setItem('wisal_flights_data', JSON.stringify(bookings));
    if (db) {
        db.ref('bookings').set(bookings).catch((err) => {
            console.error("فشل الحفظ السحابي:", err);
        });
    }
    renderTable();
    updateStatisticsEngine();
}

// ==========================================
// 3. إدارة صفوف المسافرين (أزرار متعددة)
// ==========================================
function addPassengerRow(name = '', passport = '', phone = '') {
    const container = document.getElementById('passengersListContainer');
    const rowId = 'pass_' + Date.now() + Math.random().toString(36).substr(2, 5);

    const div = document.createElement('div');
    div.className = 'passenger-item-card';
    div.id = rowId;
    div.innerHTML = `
        <div class="input-group">
            <label><i class="fa-solid fa-user"></i> اسم المسافر الكامل *</label>
            <input type="text" class="p-name" required value="${name}" placeholder="اسم المسافر كما في الجواز...">
        </div>
        <div class="input-group">
            <label><i class="fa-solid fa-passport"></i> رقم الجواز *</label>
            <input type="text" class="p-passport" required value="${passport}" placeholder="رقم الجواز...">
        </div>
        <div class="input-group">
            <label><i class="fa-solid fa-phone"></i> رقم جوال الواتساب *</label>
            <input type="tel" class="p-phone" required value="${phone}" placeholder="96777xxxxxxx">
        </div>
        <div>
            <button type="button" class="remove-passenger-btn" title="حذف هذا الشخص" onclick="removePassengerRow('${rowId}')">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
}

function removePassengerRow(rowId) {
    const container = document.getElementById('passengersListContainer');
    if (container.children.length <= 1) {
        alert("⚠️ يجب أن يحتوي الحجز على مسافر واحد على الأقل.");
        return;
    }
    const row = document.getElementById(rowId);
    if (row) row.remove();
}

// ==========================================
// 4. التحكم الذكي بأزرار الرحلات
// ==========================================
function selectTripType(type) {
    document.getElementById('tripType').value = type;
    
    document.querySelectorAll('.trip-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) btn.classList.add('active');
    });

    const goGroup = document.getElementById('goDateGroup');
    const returnGroup = document.getElementById('returnDateGroup');
    const goInput = document.getElementById('goDate');
    const returnInput = document.getElementById('returnDate');

    if (type === 'one_way') {
        goGroup.classList.remove('hidden');
        goInput.required = true;
        returnGroup.classList.add('hidden');
        returnInput.required = false;
        returnInput.value = '';
    } else if (type === 'round_fixed') {
        goGroup.classList.remove('hidden');
        goInput.required = true;
        returnGroup.classList.remove('hidden');
        returnInput.required = true;
    } else if (type === 'go_fixed_return_open') {
        goGroup.classList.remove('hidden');
        goInput.required = true;
        returnGroup.classList.add('hidden');
        returnInput.required = false;
        returnInput.value = '';
    } else if (type === 'both_open') {
        goGroup.classList.add('hidden');
        goInput.required = false;
        goInput.value = '';
        returnGroup.classList.add('hidden');
        returnInput.required = false;
        returnInput.value = '';
    }

    document.getElementById('previewTripStatus').innerText = `نوع الرحلة: ${tripTypeLabels[type]}`;
    updateSmartPreview();
}

function updateSmartPreview() {
    const type = document.getElementById('tripType').value;
    const goDateVal = document.getElementById('goDate').value;
    const previewEl = document.getElementById('previewAlertTime');

    if (type === 'both_open') {
        previewEl.innerText = "تذكرة مفتوحة بالكامل للمتابعة";
        return;
    }

    if (!goDateVal) {
        previewEl.innerText = "يرجى تحديد تاريخ الرحلة...";
        return;
    }

    const flightTime = new Date(goDateVal);
    const alertTime = new Date(flightTime.getTime() - (48 * 60 * 60 * 1000));
    previewEl.innerText = alertTime.toLocaleString('ar-YE', {
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// ==========================================
// 5. حفظ البيانات وتخزينها بأمان تام
// ==========================================
function saveBooking(e) {
    e.preventDefault();

    const passengerCards = document.querySelectorAll('.passenger-item-card');
    const passengersList = [];

    passengerCards.forEach(card => {
        const name = card.querySelector('.p-name').value.trim();
        const passport = card.querySelector('.p-passport').value.trim();
        const phone = card.querySelector('.p-phone').value.trim();
        if (name && passport && phone) {
            passengersList.push({ name, passport, phone });
        }
    });

    if (passengersList.length === 0) {
        alert("⚠️ يرجى التأكد من تعبئة حقول المسافر بشكل كامل وصحيح.");
        return;
    }

    const editId = document.getElementById('editId').value;
    const bookingData = {
        id: editId ? editId : 'FLT-' + Date.now(),
        passengers: passengersList,
        pnrCode: document.getElementById('pnrCode').value.trim().toUpperCase() || '---',
        airline: document.getElementById('airline').value.trim() || '---',
        route: document.getElementById('route').value.trim() || '---',
        tripType: document.getElementById('tripType').value,
        goDate: document.getElementById('goDate').value || '',
        returnDate: document.getElementById('returnDate').value || '',
        notes: document.getElementById('notes').value.trim() || '---',
        updatedAt: new Date().toISOString()
    };

    if (editId) {
        const index = bookings.findIndex(b => b.id === editId);
        if (index !== -1) bookings[index] = bookingData;
        document.getElementById('editId').value = '';
        document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ بيانات الحجز والمزامنة السحابية';
    } else {
        bookings.unshift(bookingData);
    }

    saveToCloudAndLocal();
    document.getElementById('flightForm').reset();
    document.getElementById('passengersListContainer').innerHTML = '';
    addPassengerRow();
    selectTripType('one_way');
    alert("✅ تم حفظ الحجز في قاعدة البيانات السحابية بنجاح ومحفوظ للأبد!");
}

// ==========================================
// 6. محرك الإحصائيات القوي والدقيق 100%
// ==========================================
function getFlightStatus(b) {
    if (b.tripType === 'both_open') {
        return { code: 'open', label: '⏳ مفتوحة بالكامل', badge: 'badge-open' };
    }

    const now = new Date();
    const goTime = b.goDate ? new Date(b.goDate) : null;
    const returnTime = b.returnDate ? new Date(b.returnDate) : null;

    if (goTime) {
        const diffHoursGo = (goTime - now) / (1000 * 60 * 60);
        if (diffHoursGo > 0 && diffHoursGo <= 48) {
            return { code: 'urgent', label: `⚠️ ذهاب خلال ${Math.ceil(diffHoursGo)} ساعة!`, badge: 'badge-urgent' };
        }
    }
    if (returnTime) {
        const diffHoursRet = (returnTime - now) / (1000 * 60 * 60);
        if (diffHoursRet > 0 && diffHoursRet <= 48) {
            return { code: 'urgent', label: `⚠️ عودة خلال ${Math.ceil(diffHoursRet)} ساعة!`, badge: 'badge-urgent' };
        }
    }

    if (b.tripType === 'go_fixed_return_open' && (!goTime || goTime > now)) {
        return { code: 'confirmed', label: '✅ رحلة مؤكدة (عودة مفتوحة)', badge: 'badge-ok' };
    }

    if (goTime && goTime > now) {
        return { code: 'confirmed', label: '✅ رحلة قادمة مؤكدة', badge: 'badge-ok' };
    }

    return { code: 'past', label: '✔️ تمت الرحلة', badge: 'badge-past' };
}

function updateStatisticsEngine() {
    let totalCount = bookings.length;
    let urgentCount = 0;
    let openCount = 0;
    let confirmedCount = 0;
    let urgentNames = [];

    bookings.forEach(b => {
        const status = getFlightStatus(b);
        if (status.code === 'urgent') {
            urgentCount++;
            const namesStr = b.passengers && Array.isArray(b.passengers) ? b.passengers.map(p => p.name).join('، ') : 'عميل';
            urgentNames.push(`${namesStr} (${status.label})`);
        } else if (status.code === 'open') {
            openCount++;
        } else if (status.code === 'confirmed' || status.code === 'past') {
            confirmedCount++;
        }
    });

    const statTotalEl = document.getElementById('statTotal');
    const statUrgentEl = document.getElementById('statUrgent');
    const statOpenEl = document.getElementById('statOpen');
    const statConfirmedEl = document.getElementById('statConfirmed');

    if (statTotalEl) statTotalEl.innerText = totalCount;
    if (statUrgentEl) statUrgentEl.innerText = urgentCount;
    if (statOpenEl) statOpenEl.innerText = openCount;
    if (statConfirmedEl) statConfirmedEl.innerText = confirmedCount;

    const banner = document.getElementById('urgentAlertBanner');
    if (urgentCount > 0) {
        if (banner) banner.classList.remove('hidden');
        const alertText = document.getElementById('urgentAlertText');
        if (alertText) {
            alertText.innerText = `⚠️ تنبيه عاجل: يوجد (${urgentCount}) حجوزات اقترب موعد رحلتهم خلال أقل من 48 ساعة! للمسافرين: [ ${urgentNames.join(' - ')} ]`;
        }
    } else {
        if (banner) banner.classList.add('hidden');
    }
}

// ==========================================
// 7. عرض الجدول والبحث وتصدير الـ PDF (بدون أيقونة الشخص)
// ==========================================
function renderTable() {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');

    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const filter = statusFilter ? statusFilter.value : 'all';

    tbody.innerHTML = '';

    bookings.forEach(b => {
        const status = getFlightStatus(b);
        if (filter !== 'all' && status.code !== filter) return;

        const passengersArr = b.passengers && Array.isArray(b.passengers) ? b.passengers : [];
        const allNames = passengersArr.map(p => `${p.name} ${p.passport} ${p.phone}`).join(' ');
        const matchText = `${allNames} ${b.pnrCode} ${b.route} ${b.airline}`.toLowerCase();
        if (!matchText.includes(search)) return;

        const goFormatted = b.goDate ? new Date(b.goDate).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' }) : 'مفتوح ⏳';
        const retFormatted = b.tripType === 'one_way' ? '---' : (b.returnDate ? new Date(b.returnDate).toLocaleString('ar-YE', { dateStyle: 'short', timeStyle: 'short' }) : 'مفتوح ⏳');

        // تم حذف أكونق الأيقونة البرتقالية/البنفسجية من هنا نهائياً
        let passengersHtml = passengersArr.map(p => `
            <div style="margin-bottom: 4px;">
                <strong>${p.name}</strong><br>
                <small style="color:var(--royal-teal);">جواز: ${p.passport} | جوال: ${p.phone}</small>
            </div>
        `).join('<hr style="border:0; border-top:1px dashed #cbd5e1; margin:4px 0;">');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${passengersHtml}</td>
            <td><span style="color:var(--royal-teal);font-weight:800;font-size:13px;">PNR: ${b.pnrCode}</span></td>
            <td>${b.airline}<br><small>${b.route}</small></td>
            <td>${tripTypeLabels[b.tripType]}</td>
            <td>ذهاب: ${goFormatted}<br>عودة: ${retFormatted}</td>
            <td><span class="badge ${status.badge}">${status.label}</span></td>
            <td class="no-print">
                <div class="action-btns">
                    <button class="btn-icon btn-wa" title="إرسال واتساب للمجموعة" onclick="sendWhatsAppGroup('${b.id}')"><i class="fa-brands fa-whatsapp"></i></button>
                    <button class="btn-icon btn-gcal" title="إضافة لتقويم جوجل" onclick="addToGoogleCalendar('${b.id}')"><i class="fa-solid fa-calendar-plus"></i></button>
                    <button class="btn-icon btn-edit" title="تعديل" onclick="editBooking('${b.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon btn-del" title="حذف" onclick="deleteBooking('${b.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTable(statusCode) {
    const select = document.getElementById('statusFilter');
    if (select) select.value = statusCode;
    renderTable();
}

function exportToPDF() {
    const element = document.getElementById('pdfExportArea');
    if (!element) return;
    const opt = {
        margin:       10,
        filename:     `تقرير_حجوزات_الوصال_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    document.querySelectorAll('.no-print').forEach(el => el.style.display = 'none');
    html2pdf().from(element).set(opt).save().then(() => {
        document.querySelectorAll('.no-print').forEach(el => el.style.display = '');
    });
}

function sendWhatsAppGroup(id) {
    const b = bookings.find(item => item.id === id);
    if (!b) return;
    const goText = b.goDate ? new Date(b.goDate).toLocaleString('ar-YE', { dateStyle: 'full', timeStyle: 'short' }) : 'تذكرة مفتوحة';
    const passengersArr = b.passengers && Array.isArray(b.passengers) ? b.passengers : [];
    const namesStr = passengersArr.map(p => p.name).join('، ');
    const msg = `مرحباً بك/م *${namesStr}* ✈️\nنود تذكيركم من *مكتب الوصال للطيران* باقتراب موعد رحلتكم:\n\n📍 *خط السير:* ${b.route}\n🛫 *الطيران:* ${b.airline}\n🔖 *رقم الحجز:* ${b.pnrCode}\n📅 *موعد الرحلة:* ${goText}`;
    const firstPhone = passengersArr.length > 0 ? passengersArr[0].phone.replace(/[^0-9]/g, '') : '';
    window.open(`https://wa.me/${firstPhone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function editBooking(id) {
    const b = bookings.find(item => item.id === id);
    if (!b) return;
    document.getElementById('editId').value = b.id;
    document.getElementById('pnrCode').value = b.pnrCode === '---' ? '' : b.pnrCode;
    document.getElementById('airline').value = b.airline === '---' ? '' : b.airline;
    document.getElementById('route').value = b.route === '---' ? '' : b.route;
    selectTripType(b.tripType);
    document.getElementById('goDate').value = b.goDate;
    document.getElementById('returnDate').value = b.returnDate;
    document.getElementById('notes').value = b.notes === '---' ? '' : b.notes;

    const container = document.getElementById('passengersListContainer');
    container.innerHTML = '';
    const passengersArr = b.passengers && Array.isArray(b.passengers) ? b.passengers : [];
    passengersArr.forEach(p => {
        addPassengerRow(p.name, p.passport, p.phone);
    });

    updateSmartPreview();
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-rotate"></i> تحديث بيانات الحجز الآن';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteBooking(id) {
    if (confirm("هل أنت متأكد من حذف هذا الحجز من السحابة؟")) {
        bookings = bookings.filter(b => b.id !== id);
        saveToCloudAndLocal();
    }
}

function addToGoogleCalendar(bookingId) {
    const b = bookings.find(item => item.id === bookingId);
    if (!b || !b.goDate) {
        alert("⚠️ لا يوجد تاريخ ذهاب محدد لهذه التذكرة.");
        return;
    }
    const passengersArr = b.passengers && Array.isArray(b.passengers) ? b.passengers : [];
    const passengersNames = passengersArr.map(p => p.name).join('، ');
    const startDate = new Date(b.goDate);
    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));
    const formatGCalDate = (date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const title = encodeURIComponent(`رحلة طيران: ${passengersNames} (${b.route})`);
    const details = encodeURIComponent(`شركة الطيران: ${b.airline}\nرقم الحجز: ${b.pnrCode}\nالمسافرين: ${passengersNames}`);
    const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGCalDate(startDate)}/${formatGCalDate(endDate)}&details=${details}`;
    window.open(gCalUrl, '_blank');
}

function installAppPrompt() {
    alert("📲 التطبيق جاهز! انقر على قائمة المتصفح (النقاط الثلاث) واختر 'تثبيت التطبيق' أو 'Add to Home screen'.");
}

function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then(perm => {
            if (perm === "granted") alert("✅ تم تفعيل الإشعارات بنجاح!");
        });
    }
}