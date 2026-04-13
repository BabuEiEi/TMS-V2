/**
 * PROJECT: TMS-V2
 * VERSION: 66.0 (Clean Database - No Weight Column)
 * AUTHOR: วิ (AI Assistant)
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let globalAssignmentData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

function formatThaiDate(dateStr) {
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
        return dateStr;
    }
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear() + 543;
    return day + " " + month + " " + year;
}

// ============================================================
// [#NAV_LOGIC]: ระบบล็อกอินและนำทาง
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    let savedId = localStorage.getItem("tms_personal_id");
    if (savedId) {
        document.getElementById("personalId").value = savedId;
        renderUserInfo();
        showDashboard();
    }
});

function renderUserInfo() {
    let userDataStr = localStorage.getItem("tms_user_data");
    if (userDataStr) {
        let user = JSON.parse(userDataStr);
        document.getElementById("display-user-name").innerText = user.name || "ไม่ระบุชื่อ";
        document.getElementById("display-user-role").innerText = user.role || "-";
        document.getElementById("display-user-area").innerText = "📍 " + (user.area_service || "-");
        document.getElementById("display-user-group").innerText = "🎯 กลุ่มเป้าหมาย: " + (user.group_target || "-");
    }
}

async function login() {
    let idInput = document.getElementById("personalId");
    let id = idInput.value.trim(); 
    
    if (id === "") {
        Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกรหัสประจำตัวก่อนครับ' });
        return;
    }

    Swal.fire({ title: 'กำลังตรวจสอบข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUserProfile', payload: { personal_id: id } })
        });
        let result = await response.json();

        if (result.status === 'success') {
            localStorage.setItem("tms_personal_id", id);
            localStorage.setItem("tms_user_data", JSON.stringify(result.data));

            renderUserInfo();
            showDashboard();
            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ยินดีต้อนรับเข้าสู่ระบบ', timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: result.message });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'ระบบขัดข้อง', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
    }
}

function logout() {
    localStorage.removeItem("tms_personal_id");
    location.reload();
}

function showDashboard() {
    document.getElementById("loginSection").classList.add("d-none");
    document.getElementById("main-nav").style.display = "block";
    
    let footer = document.getElementById("main-footer");
    if(footer) footer.classList.remove("d-none");

    const userDataStr = localStorage.getItem("tms_user_data");
    if (userDataStr) {
        const user = JSON.parse(userDataStr);
        const role = user.role ? user.role.toUpperCase() : "";
        
        if (role === 'ADMIN') {
            renderAdminDashboard();
            return; 
        }
    }
    
    document.getElementById("dashboardSection").classList.remove("d-none");
}

function backToDashboard(currentId) {
    document.getElementById(currentId).classList.add("d-none");
    document.getElementById("dashboardSection").classList.remove("d-none");
    isExamActive = false;
    clearInterval(examCountdown);
}

// ============================================================
// [#ATT_LOGIC]: ระบบลงเวลา 
// ============================================================

async function openAttendanceForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("attendanceSection").classList.remove("d-none");

    let btnContainer = document.getElementById("attendanceButtonsContainer");
    btnContainer.innerHTML = `<div class="text-center my-5"><div class="spinner-border text-info"></div></div>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getAttendanceData',
                payload: { personal_id: localStorage.getItem("tms_personal_id") }
            })
        });
        let result = await response.json();

        if (result.status === 'success') {
            renderAttendanceButtons(result.schedule, result.userLogs);
        }
    } catch (error) {
        btnContainer.innerHTML = `<div class="alert alert-danger text-center">ไม่สามารถดึงข้อมูลได้</div>`;
    }
}

function renderAttendanceButtons(schedule, userLogs) {
    let btnContainer = document.getElementById("attendanceButtonsContainer");
    btnContainer.innerHTML = '';
    const now = new Date();

    if (!schedule || schedule.length === 0) {
        btnContainer.innerHTML = `<div class="alert alert-info text-center">ไม่มีรอบลงเวลา</div>`;
        return;
    }

    schedule.forEach(slot => {
        let key = slot.day_no + '_' + slot.slot_id;
        let loggedData = userLogs[key];
        let thaiDate = formatThaiDate(slot.date);
        let timeRange = "(" + slot.start_time + " - " + slot.end_time + ")";
        let baseDisplay = "วันที่ " + slot.day_no + " | " + thaiDate + " " + timeRange;
        let endDateTime = new Date(slot.date + "T" + slot.end_time + ":00");

        if (loggedData) {
            let logTime = new Date(loggedData);
            let logTimeString = logTime.getHours().toString().padStart(2, '0') + ':' + logTime.getMinutes().toString().padStart(2, '0');
            let isLogLate = logTime > endDateTime;
            let lateMark = isLogLate ? ' <span class="text-danger">(สาย)</span>' : '';

            btnContainer.innerHTML += `
                <div class="card mb-3 p-4 bg-light border-0 rounded-4 text-center shadow-sm opacity-75">
                    <div class="fw-bold text-secondary mb-2">✔️ ${slot.slot_label} บันทึกสำเร็จ</div>
                    <div class="text-dark fw-semibold">${baseDisplay} | <span class="text-primary">${logTimeString}</span>${lateMark}</div>
                </div>`;
        } else {
            let isCurrentlyLate = now > endDateTime;
            let btnClass = isCurrentlyLate ? 'btn-warning text-dark' : 'btn-success text-white';
            let statusSuffix = isCurrentlyLate ? ' (สาย)' : '';
            let currentStatus = isCurrentlyLate ? 'สาย' : 'ตรงเวลา';

            btnContainer.innerHTML += `
                <button class="btn ${btnClass} w-100 mb-3 p-4 fw-bold rounded-4 shadow" onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', '${currentStatus}')">
                    <span style="font-size: 1.2rem;">📌 ลงเวลา: ${slot.slot_label}${statusSuffix}</span><br>
                    <small class="fw-normal">${baseDisplay}</small>
                </button>`;
        }
    });
}

async function submitRealAttendance(day, slot, status) {
    const swalResult = await Swal.fire({
        title: 'หมายเหตุการลงเวลา',
        input: 'text',
        inputPlaceholder: 'เช่น ลากิจ, ลาป่วย (เว้นว่างได้)',
        showCancelButton: true,
        confirmButtonText: 'บันทึกเวลา',
        cancelButtonText: 'ยกเลิก'
    });

    if (!swalResult.isConfirmed) return;

    let userNote = swalResult.value ? swalResult.value.trim() : "";
    let finalNote = userNote !== "" ? "[" + status + "] " + userNote : "[" + status + "]";

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: localStorage.getItem("tms_personal_id"), day_no: day, time_slot: slot, note: finalNote } })
        });
        openAttendanceForm();
        Swal.close();
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ส่งข้อมูลไม่สำเร็จ', 'error');
    }
}

// ============================================================
// [#EXAM_LOGIC]: ระบบข้อสอบ
// ============================================================

document.addEventListener('visibilitychange', () => {
    if (isExamActive && document.visibilityState === 'hidden') {
        Swal.fire({ icon: 'warning', title: 'คำเตือน: ห้ามสลับหน้าจอ!', text: 'ระบบได้บันทึกพฤติกรรมไว้แล้ว', confirmButtonColor: '#d33' });
    }
});

function saveExamDraft(questionId, selectedValue) {
    let userId = localStorage.getItem("tms_personal_id");
    let draftKey = "tms_draft_" + userId + "_" + globalExamData.activeExam.type;
    let draftData = JSON.parse(localStorage.getItem(draftKey) || "{}");
    draftData[questionId] = selectedValue;
    localStorage.setItem(draftKey, JSON.stringify(draftData));
}

async function openExamForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("examSection").classList.remove("d-none");

    let contentArea = document.getElementById("examContentArea");
    document.getElementById("btnSubmitExam").classList.add("d-none");
    document.getElementById("examTimerBadge").classList.add("d-none");

    document.getElementById("examTitleLabel").innerText = "กำลังตรวจสอบแบบทดสอบ...";
    contentArea.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-warning"></div></div>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getExamData', payload: { personal_id: localStorage.getItem("tms_personal_id") } })
        });
        let result = await response.json();

        if (result.status === 'success') {
            globalExamData = result;
            let thaiTitle = result.activeExam.type === 'PRE' ? 'แบบทดสอบก่อนการอบรม (Pre-Test)' : result.activeExam.type === 'POST' ? 'แบบทดสอบหลังการอบรม (Post-Test)' : 'แบบทดสอบ ' + result.activeExam.type;
            document.getElementById("examTitleLabel").innerText = thaiTitle;
            renderExamStartScreen();
        } else {
            document.getElementById("examTitleLabel").innerText = "แบบทดสอบก่อน-หลังอบรม";
            contentArea.innerHTML = `<div class="alert alert-info text-center p-5"><h5 class="fw-bold">${result.message}</h5></div>`;
        }
    } catch (error) {
        document.getElementById("examTitleLabel").innerText = "ข้อผิดพลาด";
        contentArea.innerHTML = '<div class="alert alert-danger text-center">ดึงข้อมูลไม่สำเร็จ</div>';
    }
}

function renderExamStartScreen() {
    let contentArea = document.getElementById("examContentArea");
    let exam = globalExamData.activeExam;
    let qCount = globalExamData.questions.length;
    let attempts = globalExamData.attempts;
    let bestScore = globalExamData.best_score;

    let retakeMessage = '';
    let btnLabel = 'เริ่มทำแบบทดสอบ';
    let btnColor = 'btn-success';

    if (exam.type === 'PRE' && attempts >= 1) {
        contentArea.innerHTML = `<div class="alert alert-success text-center p-5 my-5"><h4 class="fw-bold mb-3">ท่านได้ทำแบบทดสอบ Pre-Test ไปแล้ว</h4><button class="btn btn-secondary px-4 rounded-pill" onclick="backToDashboard('examSection')">กลับเมนูหลัก</button></div>`;
        return;
    }

    if (exam.type === 'POST' && attempts >= 1) {
        let bestScorePercent = (bestScore / (qCount * 2)) * 100;
        if (bestScorePercent >= exam.passing_percent) {
            contentArea.innerHTML = `<div class="alert alert-success text-center p-5 my-5"><h4 class="fw-bold mb-3">ท่านสอบผ่าน Post-Test แล้ว 🎉</h4><p>คะแนน: <b class="text-success">${bestScore}</b> / ${qCount * 2}</p><button class="btn btn-secondary px-4 rounded-pill" onclick="backToDashboard('examSection')">กลับเมนูหลัก</button></div>`;
            return;
        } else if (attempts >= 2) {
            contentArea.innerHTML = `<div class="alert alert-danger text-center p-5 my-5"><h4 class="fw-bold mb-3">ท่านใช้สิทธิ์ครบ 2 ครั้งแล้ว</h4><p>คะแนน: <b class="text-danger">${bestScore}</b> / ${qCount * 2}</p><button class="btn btn-secondary px-4 rounded-pill" onclick="backToDashboard('examSection')">กลับเมนูหลัก</button></div>`;
            return;
        } else {
            retakeMessage = `<div class="alert alert-warning mb-4 text-start shadow-sm rounded-4">⚠️ ท่านยังไม่ผ่านเกณฑ์ (${exam.passing_percent}%) ระบบให้สิทธิ์สอบซ่อม (ครั้งที่ 2)</div>`;
            btnLabel = 'เริ่มสอบซ่อม (ครั้งที่ 2)';
            btnColor = 'btn-warning text-dark';
        }
    }

    contentArea.innerHTML = `
        <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
            <h4 class="text-primary fw-bold mb-3">คุณพร้อมหรือไม่?</h4>
            ${retakeMessage}
            <p class="text-muted fs-5">แบบทดสอบนี้มีทั้งหมด <b class="text-dark">${qCount}</b> ข้อ (ข้อละ 2 คะแนน)</p>
            
            <div class="alert alert-info text-start small mx-auto" style="max-width: 520px;">
                <ul class="mb-0">
                    <li>⏱️ ระบบจะเริ่มจับเวลา <b>30 นาที</b> ทันทีเมื่อกดปุ่ม<b> เริ่มทำแบบทดสอบ</b></li>
                    <li>💾 มีระบบ <b>Auto-Save</b> กันเน็ตหลุด</li>
                    <li>🚫 <b>ห้ามสลับแท็บหรือสลับหน้าจอ</b> ระบบจะแจ้งเตือน</li>
                </ul>
            </div>
            
            <button class="btn btn-lg ${btnColor} mt-3 fw-bold px-5 rounded-pill shadow-sm" onclick="startExamTimer()">
                ${btnLabel}
            </button>
        </div>
    `;
}

function startExamTimer() {
    isExamActive = true;
    renderExamQuestions();
    startTimer(30 * 60);
    document.getElementById("btnSubmitExam").classList.remove("d-none");
    document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderExamQuestions() {
    let html = '';
    const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
    let userId = localStorage.getItem("tms_personal_id");
    let draftKey = "tms_draft_" + userId + "_" + globalExamData.activeExam.type;
    let draftData = JSON.parse(localStorage.getItem(draftKey) || "{}");

    globalExamData.questions.sort(() => { return Math.random() - 0.5; });

    globalExamData.questions.forEach((q, i) => {
        html += `<div class="card mb-4 p-5 border-0 shadow-sm rounded-4 bg-white border-start border-5 border-warning fade-in"><p class="fw-bold fs-5 mb-4">${i + 1}. ${q.question}</p>`;

        let optionsKeys = ['A', 'B', 'C', 'D'];
        optionsKeys.sort(() => { return Math.random() - 0.5; });

        optionsKeys.forEach((optKey, idx) => {
            let isChecked = draftData[q.id] === optKey ? "checked" : "";
            html += `
                <div class="form-check mb-3">
                    <input class="form-check-input border-secondary" type="radio" name="q_${q.id}" value="${optKey}" id="q_${q.id}_${optKey}" ${isChecked} onchange="saveExamDraft('${q.id}', '${optKey}')">
                    <label class="form-check-label w-100 ms-2" for="q_${q.id}_${optKey}" style="cursor:pointer;"><b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[optKey]}</label>
                </div>`;
        });
        html += `</div>`;
    });
    document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
    let display = document.getElementById("examTimeDisplay");
    examCountdown = setInterval(() => {
        let m = Math.floor(sec / 60);
        let s = sec % 60;
        display.innerText = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);

        if (sec === 300) Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'เหลือเวลาอีก 5 นาทีสุดท้าย!', showConfirmButton: false, timer: 5000 });

        if (--sec < 0) {
            clearInterval(examCountdown);
            Swal.fire({ title: 'หมดเวลา!', text: 'ส่งคำตอบอัตโนมัติ', icon: 'warning', allowOutsideClick: false }).then(() => { submitRealExam(true); });
        }
    }, 1000);
}

async function submitRealExam(isAuto = false) {
    if (!isAuto) {
        const confirm = await Swal.fire({ title: 'ยืนยันการส่งคำตอบ?', icon: 'question', showCancelButton: true });
        if (!confirm.isConfirmed) return;
    }

    isExamActive = false;
    clearInterval(examCountdown);

    let score = 0;
    let maxScore = globalExamData.questions.length * 2;

    globalExamData.questions.forEach(q => {
        let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (sel && sel.value === q.answer) { score += 2; }
    });

    Swal.fire({ title: 'กำลังบันทึกคะแนน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'submitExam', payload: { personal_id: localStorage.getItem("tms_personal_id"), test_type: globalExamData.activeExam.type, score: score, max_score: maxScore } })
        });

        localStorage.removeItem("tms_draft_" + localStorage.getItem("tms_personal_id") + "_" + globalExamData.activeExam.type);

        let percentage = (score / maxScore) * 100;
        if (globalExamData.activeExam.type === 'PRE') {
            Swal.fire({ icon: 'info', title: 'บันทึกสำเร็จ!', text: `คะแนน ${score}`, confirmButtonColor: '#0dcaf0' }).then(() => { backToDashboard('examSection'); });
        } else {
            if (percentage >= globalExamData.activeExam.passing_percent) {
                Swal.fire({ icon: 'success', title: 'ผ่านเกณฑ์! 🎉', text: `คะแนน ${score}/${maxScore}`, confirmButtonColor: '#198754' }).then(() => { backToDashboard('examSection'); });
            } else {
                if (globalExamData.attempts + 1 < 2) {
                    Swal.fire({ icon: 'warning', title: 'ยังไม่ผ่านเกณฑ์', text: `คะแนน ${score}/${maxScore}\nสอบซ่อมได้อีก 1 ครั้ง` }).then(() => { backToDashboard('examSection'); });
                } else {
                    Swal.fire({ icon: 'error', title: 'ไม่ผ่านเกณฑ์ (ครบ 2 ครั้ง)', text: `คะแนน ${score}/${maxScore}` }).then(() => { backToDashboard('examSection'); });
                }
            }
        }
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ส่งคะแนนไม่สำเร็จ', 'error');
    }
}

// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน
// ============================================================

async function openSurveyForm(type) {
    currentSurveyType = type;
    selectedSpeakerId = null;
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("surveySection").classList.remove("d-none");

    let contentArea = document.getElementById("surveyContentArea");
    document.getElementById("surveyContentArea").innerHTML = '';
    document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
    document.getElementById("btnSubmitSurvey").classList.add("d-none");

    if (type === 'PROJECT_SURVEY') {
        document.getElementById("speakerSelectionArea").classList.add("d-none");
        contentArea.innerHTML = `<div class="text-center p-5 my-5"><div class="spinner-border text-success"></div></div>`;
    } else {
        let selectionArea = document.getElementById("speakerSelectionArea");
        selectionArea.classList.remove("d-none");
        selectionArea.innerHTML = `<div class="text-center p-4"><div class="spinner-border text-primary"></div></div>`;
    }

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getSurveyData',
                payload: { survey_type: type, personal_id: localStorage.getItem("tms_personal_id") }
            })
        });
        globalSurveyData = await response.json();

        if (type === 'SPEAKER_SURVEY') {
            renderSpeakerCards();
            contentArea.innerHTML = `<div id="speakerPromptPlaceholder" class="text-center p-5 fade-in">กรุณาเลือกวิทยากร</div>`;
        } else {
            renderSurveyQuestions();
            document.getElementById("btnSubmitSurvey").classList.remove("d-none");
        }
    } catch (e) {
        contentArea.innerHTML = '<div class="alert alert-danger text-center">ดาวน์โหลดข้อมูลล้มเหลว</div>';
    }
}

function renderSpeakerCards() {
    let selectionArea = document.getElementById("speakerSelectionArea");
    if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
        selectionArea.innerHTML = `<div class="alert alert-warning text-center">ไม่มีวิทยากร</div>`;
        return;
    }

    let html = `<label class="form-label fw-bold">คลิกเลือกวิทยากร:</label><div class="row g-3">`;
    let speakerHtml = '';
    globalSurveyData.speakers.forEach(spk => {
        if (spk.is_evaluated) {
            speakerHtml += `
            <div class="card mb-3 border-secondary shadow-sm" style="background-color: #f8f9fa;">
                <div class="card-body text-start">
                    <h6 class="text-secondary mb-1 fw-bold">วิทยากร: ${spk.name}</h6>
                    <p class="small text-muted mb-3">หัวข้อ: ${spk.topic}</p>
                    <button class="btn btn-secondary w-100 rounded-pill" disabled style="opacity: 0.8;">
                        <i class="bi bi-check-circle-fill"></i> ท่านได้ประเมินวิทยากรท่านนี้แล้ว
                    </button>
                </div>
            </div>`;
        } else {
            speakerHtml += `
            <div class="card mb-3 border-primary shadow-sm" id="spk_card_${spk.id}">
                <div class="card-body text-start">
                    <h6 class="text-primary mb-1 fw-bold">วิทยากร: ${spk.name}</h6>
                    <p class="small text-muted mb-3">หัวข้อ: ${spk.topic}</p>
                    <button class="btn btn-primary w-100 rounded-pill" onclick="selectSpeaker('${spk.id}')">
                        ⭐ คลิกเพื่อประเมิน
                    </button>
                </div>
            </div>`;
        }
    });
    html += speakerHtml + `</div>`;
    selectionArea.innerHTML = html;
}

function selectSpeaker(spkId) {
    selectedSpeakerId = spkId;
    document.querySelectorAll('.speaker-card, .border-primary.bg-primary-subtle').forEach(card => {
        card.classList.remove('border-primary', 'bg-primary-subtle');
    });
    let selectedCard = document.getElementById('spk_card_' + spkId);
    if (selectedCard) selectedCard.classList.add('border-primary', 'bg-primary-subtle');
    let placeholder = document.getElementById("speakerPromptPlaceholder");
    if (placeholder) placeholder.classList.add("d-none");

    renderSurveyQuestions();
    document.getElementById("btnSubmitSurvey").classList.remove("d-none");
}

function renderSurveyQuestions() {
    let html = '';
    let grouped = {};
    globalSurveyData.questions.forEach(q => {
        if (!grouped[q.category]) grouped[q.category] = [];
        grouped[q.category].push(q);
    });

    Object.keys(grouped).forEach(cat => {
        html += `<h4 class="category-header">${cat}</h4>`;
        grouped[cat].forEach(q => {
            let optionsHtml = '';
            let isNumericRating = q.options.every(opt => !isNaN(opt) && opt.trim() !== "");

            if (isNumericRating) {
                optionsHtml += `<div class="horizontal-rating-wrapper"><div class="horizontal-rating-container">`;
                [...q.options].sort((a, b) => b - a).forEach(opt => {
                    optionsHtml += `
                        <div class="rating-btn-item">
                            <input type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
                            <label class="rating-btn-label shadow-sm" for="sq_${q.id}_${opt}">${opt}</label>
                        </div>`;
                });
                optionsHtml += `</div><div class="rating-desc-text"><span>มาก (5)</span><span>น้อย (1)</span></div></div>`;
            } else if (q.options[0] === 'TEXT') {
                optionsHtml = `<textarea class="form-control rounded-4 shadow-sm" name="sq_${q.id}" rows="3"></textarea>`;
            } else {
                q.options.forEach(opt => {
                    optionsHtml += `<div class="form-check vertical-form-check"><input class="form-check-input" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label w-100" for="sq_${q.id}_${opt}">${opt}</label></div>`;
                });
            }
            html += `<div class="survey-card fade-in"><div class="question-heading">${q.question}</div><div class="options-area">${optionsHtml}</div></div>`;
        });
    });
    document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
    let answers = {};
    let complete = true;
    globalSurveyData.questions.forEach(q => {
        let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || document.querySelector(`textarea[name="sq_${q.id}"]`);
        if (sel && sel.value.trim() !== "") { answers[q.id] = sel.value; } else { complete = false; }
    });

    if (!complete) { Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ' }); return; }

    let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : selectedSpeakerId;
    if (currentSurveyType === 'SPEAKER_SURVEY' && !target) { Swal.fire({ icon: 'warning', title: 'ยังไม่ได้เลือกวิทยากร' }); return; }

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval', payload: { personal_id: localStorage.getItem("tms_personal_id"), answers: answers, target_id: target } })
        });
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ' }).then(() => { backToDashboard('surveySection'); });
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบได้', 'error');
    }
}

// ============================================================
// [#ASSIGNMENT_LOGIC]: ระบบส่งงาน
// ============================================================

async function openAssignmentForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("assignmentSection").classList.remove("d-none");

    let tbody = document.getElementById("assignmentTableBody");
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-5"><div class="spinner-border text-dark"></div><p class="mt-2 text-muted">กำลังดึงข้อมูลภาระงาน...</p></td></tr>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getAssignmentData',
                payload: { personal_id: localStorage.getItem("tms_personal_id") }
            })
        });
        let result = await response.json();

        if (result.status === 'success') {
            globalAssignmentData = result;
            renderAssignmentDashboard();
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">${result.message}</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">ไม่สามารถดึงข้อมูลได้ กรุณาตรวจสอบอินเทอร์เน็ต</td></tr>`;
    }
}

function renderAssignmentDashboard() {
    let assignments = globalAssignmentData.assignments;
    let submissions = globalAssignmentData.userSubmissions;

    let totalAssignments = assignments.length;
    let submittedCount = 0;
    let tbodyHtml = '';
    const now = new Date();

    assignments.forEach((asn, index) => {
        let sub = submissions[asn.assign_id];
        let isSubmitted = sub && (sub.status === 'รอตรวจ' || sub.status === 'ตรวจแล้ว' || sub.status === 'แก้ไข');
        if (isSubmitted) submittedCount++;

        let endDate = new Date(asn.end_datetime);
        let isLateDeadline = now > endDate;
        let showLateWarning = sub ? (sub.is_late === 'TRUE' || sub.is_late === true) : isLateDeadline;
        let lateBadge = showLateWarning ? `<span class="badge bg-danger ms-2">ส่งงานช้า</span>` : '';

        let taskInfo = `
            <div class="fw-bold text-dark fs-6">${asn.title} ${lateBadge}</div>
            <div class="text-muted small my-1" style="white-space: pre-wrap; word-break: break-word;">${asn.description}</div>
            <div class="text-danger fw-bold small mt-2">⏰ กำหนดส่ง: ${formatThaiDate(asn.end_datetime)} เวลา ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')} น.</div>
        `;

        let statusBadge = '';
        let actionBtn = '';
        let feedbackText = sub && sub.feedback ? sub.feedback : '-';

        if (!isSubmitted || (sub && sub.status === 'ยกเลิก')) {
            statusBadge = `<span class="badge bg-secondary">ยังไม่ส่งงาน</span>`;
            actionBtn = `<button class="btn btn-sm btn-primary w-100 rounded-pill shadow-sm" onclick="promptSubmitAssignment('${asn.assign_id}', '${asn.submission_type}', ${isLateDeadline})">ส่งงาน (${asn.submission_type})</button>`;
        }
        else if (sub.status === 'รอตรวจ') {
            statusBadge = `<span class="badge bg-warning text-dark">รอตรวจ</span>`;
            actionBtn = `
                <a href="${sub.file_link}" target="_blank" class="btn btn-sm btn-outline-info w-100 rounded-pill mb-2">ดูงานที่ส่ง</a>
                <button class="btn btn-sm btn-danger w-100 rounded-pill shadow-sm" onclick="cancelAssignment('${asn.assign_id}')">ยกเลิกการส่ง</button>
            `;
        }
        else if (sub.status === 'แก้ไข') {
            statusBadge = `<span class="badge bg-danger">แก้ไขงาน</span>`;
            actionBtn = `<button class="btn btn-sm btn-warning text-dark w-100 rounded-pill shadow-sm mb-2" onclick="promptSubmitAssignment('${asn.assign_id}', '${asn.submission_type}', ${isLateDeadline})">ส่งงานใหม่</button>`;
        }
        else if (sub.status === 'ตรวจแล้ว') {
            statusBadge = `<span class="badge bg-success">ตรวจแล้ว / ผ่าน</span>`;
            actionBtn = `<a href="${sub.file_link}" target="_blank" class="btn btn-sm btn-outline-success w-100 rounded-pill">ดูงานที่ส่ง</a>`;
        }

        tbodyHtml += `
            <tr class="align-top">
                <td class="text-center fw-bold">${index + 1}</td>
                <td class="text-start">${taskInfo}</td>
                <td class="text-center">${actionBtn}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-muted small text-start">${feedbackText}</td>
            </tr>
        `;
    });

    if (totalAssignments === 0) tbodyHtml = `<tr><td colspan="5" class="text-center p-4 text-muted">ยังไม่มีภาระงานที่เปิดให้ส่งในขณะนี้</td></tr>`;
    document.getElementById("assignmentTableBody").innerHTML = tbodyHtml;

    let progressPercent = totalAssignments > 0 ? Math.round((submittedCount / totalAssignments) * 100) : 0;
    document.getElementById("assignmentDashboardSummary").innerHTML = `
        <div class="col-md-4">
            <div class="card text-white border-0 rounded-4 shadow-sm p-3 h-100 text-center" style="background-color: #1132ec;">
                <h6 class="fw-bold mb-1">📁 ภาระงานทั้งหมด</h6>
                <h2 class="mb-0 fw-bold">${totalAssignments} <span class="fs-6 fw-normal">งาน</span></h2>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card bg-success text-white border-0 rounded-4 shadow-sm p-3 h-100 text-center">
                <h6 class="fw-bold mb-1">✅ ส่งงานแล้ว</h6>
                <h2 class="mb-0 fw-bold">${submittedCount} <span class="fs-6 fw-normal">งาน</span></h2>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card text-white border-0 rounded-4 shadow-sm p-3 h-100 text-center" style="background-color: #e06309;">
                <h6 class="fw-bold mb-1">📈 ความก้าวหน้า (Progress)</h6>
                <div class="d-flex align-items-center justify-content-center mt-2">
                    <h2 class="mb-0 fw-bold me-3">${progressPercent}%</h2>
                    <div class="progress flex-grow-1" style="height: 10px; background-color: rgba(255,255,255,0.2); max-width: 150px;">
                        <div class="progress-bar bg-info" role="progressbar" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function promptSubmitAssignment(assignId, subType, isLate) {
    let asnConfig = globalAssignmentData.assignments.find(a => a.assign_id === assignId);
    let inputHtml = '', fileToSubmit = null, linkToSubmit = '';

    if (subType === 'LINK') {
        inputHtml = `<div class="text-start mt-3"><label class="form-label fw-bold text-primary">วางลิงก์ผลงานของท่าน (URL)</label><input type="url" id="swal-input-link" class="form-control rounded-4 p-2" placeholder="https://..."></div>`;
    } else {
        inputHtml = `<div class="text-start mt-3"><label class="form-label fw-bold text-primary">เลือกไฟล์จากเครื่องของท่าน</label><input type="file" id="swal-input-file" class="form-control rounded-4 p-2"><small class="text-danger mt-1 d-block">*ระบบแนะนำให้ส่งไฟล์ขนาดไม่เกิน 5MB</small></div>`;
    }

    const { isConfirmed } = await Swal.fire({
        title: 'ส่งภาระงาน',
        html: `<div class="alert alert-light border text-start mb-0 shadow-sm"><p class="mb-1 fw-bold text-dark fs-6">📌 ชื่องาน: ${asnConfig.title}</p><hr class="my-2 text-secondary"><div class="small text-muted" style="white-space: pre-wrap; word-break: break-word; max-height: 150px; overflow-y: auto; padding-right: 5px;">${asnConfig.description}</div></div>${inputHtml}`,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'ถัดไป (Preview)', cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            if (subType === 'LINK') {
                linkToSubmit = document.getElementById('swal-input-link').value;
                if (!linkToSubmit) { Swal.showValidationMessage('กรุณาวางลิงก์ผลงานครับ'); return false; }
                return true;
            } else {
                let fileInput = document.getElementById('swal-input-file');
                if (!fileInput.files.length) { Swal.showValidationMessage('กรุณาเลือกไฟล์ครับ'); return false; }
                fileToSubmit = fileInput.files[0];
                return true;
            }
        }
    });

    if (!isConfirmed) return;

    let previewDataHtml = '';
    if (subType === 'LINK') {
        let iframeUrl = linkToSubmit.includes('drive.google.com/file/d/') ? linkToSubmit.replace(/\/view.*/, '/preview') : linkToSubmit;
        previewDataHtml = `<div class="mb-3 text-center border rounded-3 overflow-hidden shadow-sm bg-light" style="height: 250px; position: relative;"><iframe src="${iframeUrl}" style="width: 100%; height: 100%; border: none;"></iframe></div><p class="text-primary text-break border p-2 rounded-3 bg-light small mb-0">🔗 ลิงก์: <a href="${linkToSubmit}" target="_blank">${linkToSubmit}</a></p>`;
    } else {
        let fileType = fileToSubmit.type || '', fileName = fileToSubmit.name || 'ไม่ทราบชื่อไฟล์', fileSize = fileToSubmit.size ? (fileToSubmit.size / 1024).toFixed(2) : '0.00';
        let fileUrl = URL.createObjectURL(fileToSubmit), previewElement = '';
        if (fileType.startsWith('image/')) previewElement = `<img src="${fileUrl}" style="max-height: 230px; max-width: 100%; object-fit: contain;" class="rounded">`;
        else if (fileType === 'application/pdf') previewElement = `<iframe src="${fileUrl}" style="width: 100%; height: 230px; border: none;"></iframe>`;
        else previewElement = `<div class="d-flex align-items-center justify-content-center" style="height: 230px;"><div class="text-muted"><h1 class="mb-0 text-secondary">📁</h1><p class="small mt-2">แนบไฟล์สำเร็จ (ไม่รองรับการพรีวิวสด)</p></div></div>`;
        previewDataHtml = `<div class="mb-3 text-center border rounded-3 p-2 bg-light shadow-sm">${previewElement}</div><p class="text-primary border p-2 rounded-3 bg-light small mb-0">📄 ชื่อไฟล์: ${fileName} <br>ขนาด: ${fileSize} KB</p>`;
    }

    const confirmSubmit = await Swal.fire({
        icon: 'question', title: 'ยืนยันที่จะส่งงานนี้ใช่หรือไม่?', width: '600px',
        html: `<div class="text-start mt-2"><label class="fw-bold mb-2">ข้อมูลที่จะถูกส่งเข้าสู่ระบบ:</label>${previewDataHtml}</div>`,
        showCancelButton: true, confirmButtonText: 'ยืนยันการส่งงาน', confirmButtonColor: '#198754'
    });

    if (!confirmSubmit.isConfirmed) return;

    let payload = { personal_id: localStorage.getItem("tms_personal_id"), assign_id: assignId, submission_type: subType, target_folder_id: asnConfig.target_folder_id, is_late: isLate };
    executeAssignmentSubmit(payload, subType === 'LINK' ? linkToSubmit : fileToSubmit);
}

async function executeAssignmentSubmit(payload, fileObj = null) {
    Swal.fire({ title: 'กำลังเตรียมข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    if (payload.submission_type === 'FILE' && fileObj) {
        const reader = new FileReader();
        reader.readAsDataURL(fileObj);
        reader.onload = async () => {
            payload.base64Data = reader.result.split(',')[1];
            payload.fileName = fileObj.name;
            payload.mimeType = fileObj.type;
            await sendToGAS(payload);
        };
    } else {
        await sendToGAS(payload);
    }
}

async function sendToGAS(payload) {
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({ action: 'submitAssignment', payload: payload })
        });
        const result = await response.json();
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'อัปโหลดสำเร็จ!', timer: 2000, showConfirmButton: false });
            setTimeout(() => openAssignmentForm(), 2000);
        } else {
            Swal.fire('ล้มเหลว', result.message, 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'ไม่สามารถส่งข้อมูลได้ (เน็ตหลุด หรือไฟล์มีขนาดใหญ่เกิน 5MB จนโดนบล็อก)', 'error');
    }
}

async function cancelAssignment(assignId) {
    const confirm = await Swal.fire({
        icon: 'warning', title: 'ยืนยันการยกเลิก?', text: 'ท่านต้องการยกเลิกการส่งงานชิ้นนี้ใช่หรือไม่?',
        showCancelButton: true, confirmButtonText: 'ใช่, ยกเลิกการส่ง', confirmButtonColor: '#dc3545'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังยกเลิก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        let res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'cancelAssignment', payload: { personal_id: localStorage.getItem("tms_personal_id"), assign_id: assignId } })
        });
        let result = await res.json();
        if (result.status === 'success') {
            Swal.fire('ยกเลิกสำเร็จ', 'ท่านสามารถส่งงานชิ้นนี้ใหม่ได้อีกครั้ง', 'success');
            openAssignmentForm();
        } else {
            Swal.fire('ไม่สามารถยกเลิกได้', result.message, 'error');
        }
    } catch (e) {
        Swal.fire('ผิดพลาด', 'เชื่อมต่อระบบล้มเหลว', 'error');
    }
}

// ============================================================
// 🛡️ ADMIN SYSTEM FUNCTIONS (Database CRUD & Smart Forms)
// ============================================================

let adminCurrentConfigSheet = "Attendance_Config";
let adminConfigHeaders = [];
let adminConfigRows = [];

// 🌟 แปลงหัวตารางให้เป็นภาษาไทยที่เข้าใจง่าย (Header Mapping) ตอนนี้เหลือ 11 คอลัมน์แล้ว
const CUSTOM_HEADERS = {
    'Users': ['รหัสประจำตัว', 'ชื่อ-นามสกุล', 'บทบาท', 'สังกัด/หน่วยงาน', 'Cluster', 'กลุ่มเป้าหมาย'],
    'Attendance_Config': ['รหัส', 'วันที่', 'ว/ด/ป', 'รหัสรอบ', 'ชื่อรอบ', 'เวลาเริ่มต้น', 'เวลาสิ้นสุด', 'เปิดใช้'],
    'Exam_Config': ['ประเภทการสอบ', 'วัน เวลาเริ่มต้น', 'วัน เวลาสิ้นสุด', 'เปิดใช้', 'เกณฑ์การผ่าน'],
    'Speakers_Config': ['รหัส', 'ชื่อวิทยากร', 'หัวข้อบรรยาย', 'วัน เวลาเริ่มต้น', 'วัน เวลาสิ้นสุด', 'เปิดใช้'],
    'Assignment_Config': ['รหัส', 'ชื่อภาระงาน', 'คำอธิบาย', 'รูปแบบ', 'ID Folder', 'วัน เวลาเริ่มต้น', 'วัน เวลาสิ้นสุด', 'เปิดใช้', 'กลุ่มเป้าหมาย', 'คะแนนเต็ม', 'รูบริค'],
    'Questions_Bank': ['รหัสคำถาม', 'ประเภท (Pre/Post/Survey)', 'หมวดหมู่', 'คำถาม', 'ตัวเลือก A', 'ตัวเลือก B', 'ตัวเลือก C', 'ตัวเลือก D', 'ตัวเลือก E', 'เฉลย']
};

function renderAdminDashboard() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("adminSection").classList.remove("d-none");
    loadAdminConfig('Attendance_Config');
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.add('d-none'));
    document.querySelectorAll('.list-group-item').forEach(btn => btn.classList.remove('active', 'fw-bold'));
    document.getElementById('adminTab_' + tabName).classList.remove('d-none');
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active', 'fw-bold');

    // 🌟 1. เพิ่ม Logic โหลดข้อมูลอัตโนมัติเมื่อสลับ Tab
    if (tabName === 'userManage') {
        loadAdminConfig('Users');
    } else if (tabName === 'systemControl') {
        loadAdminConfig('Attendance_Config');
    }
}

// ฟังก์ชันสำหรับ ย่อ/ขยาย Sidebar
function toggleAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

// 1. ดึงข้อมูลจาก Sheets มาสร้างตาราง
async function loadAdminConfig(sheetName) {
    adminCurrentConfigSheet = sheetName;
    
    // เลือก Container ให้ถูกตัว (ถ้าเป็น Users ให้ลง userTableContainer ถ้าเป็น Config อื่นๆ ให้ลงตัวเดิม)
    let containerId = (sheetName === 'Users') ? "userTableContainer" : "configTableContainer";
    let container = document.getElementById(containerId);
    
    // ... (ส่วนการสลับสีปุ่มเมนูคงเดิม) ...

    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">กำลังดึงข้อมูลจากฐานข้อมูล...</p></div>`;

    try {
        let res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'manageConfig', payload: { action: 'GET', sheetName: sheetName } })
        });
        let result = await res.json();
        
        if (result.status === 'success') {
            adminConfigHeaders = CUSTOM_HEADERS[sheetName] || result.headers;
            adminConfigRows = result.rows;
            
            // 🌟 2. ส่ง containerId ไปยังฟังก์ชันสร้างตารางด้วย
            renderAdminTable(containerId); 
        } else {
            container.innerHTML = `<div class="alert alert-danger text-center">${result.message}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger text-center">การเชื่อมต่อขัดข้อง</div>`;
    }
}

// 2. สร้างตารางแบบอัตโนมัติตามจำนวนคอลัมน์
function renderAdminTable(targetId = "configTableContainer") {
    let html = '<div class="table-responsive bg-white rounded-3"><table class="table table-hover align-middle small text-nowrap mb-0"><thead class="table-light"><tr>';
    
    // 🌟 สร้างหัวตาราง (ดักซ่อนคอลัมน์)
    adminConfigHeaders.forEach((h, i) => {
        if (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) return; // ข้ามคอลัมน์น้ำหนักคะแนน
        if (adminCurrentConfigSheet === 'Users' && i >= 6) return; // 🌟 ขยายให้โชว์ถึงคอลัมน์ F (Index 5) ซ่อนตั้งแต่ G (Index 6)
        
        html += `<th>${h}</th>`;
    });
    html += '<th class="text-center border-start bg-light" style="position: sticky; right: 0; z-index: 2;">จัดการ</th></tr></thead><tbody>';

    if (adminConfigRows.length === 0) {
        // ปรับ colspan ให้สอดคล้องกับคอลัมน์ที่โชว์
        let colSpan = adminConfigHeaders.length + 1;
        if (adminCurrentConfigSheet === 'Assignment_Config') colSpan -= 1;
        if (adminCurrentConfigSheet === 'Users') colSpan = 7; // โชว์ 6 คอลัมน์ (A-F) + 1 ปุ่มจัดการ
        
        html += `<tr><td colspan="${colSpan}" class="text-center py-5 text-muted">ยังไม่มีข้อมูลในระบบ</td></tr>`;
    } else {
        // 🌟 สร้างข้อมูลแต่ละแถว
        adminConfigRows.forEach(row => {
            html += '<tr>';
            row.forEach((cell, i) => {
                if (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) return; // ข้ามข้อมูลคอลัมน์น้ำหนักคะแนน
                if (adminCurrentConfigSheet === 'Users' && i >= 6) return; // 🌟 ขยายให้โชว์ข้อมูลถึงคอลัมน์ F 
                
                let displayCell = cell.length > 25 ? cell.substring(0, 25) + '...' : cell;
                
                // 🌟 (ลบโค้ดซ่อนดอกจันออกไปแล้ว ข้อมูล Cluster จะโชว์ปกติครับ)
                
                html += `<td>${displayCell}</td>`;
            });
            html += `<td class="text-center border-start bg-white" style="position: sticky; right: 0; z-index: 1;">
                <button class="btn btn-sm btn-warning text-dark me-1 shadow-sm" title="แก้ไข" onclick="openConfigForm('${row[0]}')"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-danger shadow-sm" title="ลบ" onclick="deleteConfigRow('${row[0]}')"><i class="bi bi-trash"></i></button>
            </td></tr>`;
        });
    }
    
    html += '</tbody></table></div>';
    document.getElementById(targetId).innerHTML = html;
}

// ============================================================
// 🛠️ HELPER FUNCTIONS: ตัวช่วยจัดการเวลา วันที่ และ รูบริค
// ============================================================
function parseDateTimeValue(val) {
    let now = new Date();
    let d = now.toISOString().split('T')[0]; 
    let h = String(now.getHours()).padStart(2, '0');
    let m = String(now.getMinutes()).padStart(2, '0');
    
    if (val && val.trim() !== '') {
        let parts = val.trim().split(' ');
        if(parts.length > 0) {
             let dPart = parts[0];
             if(dPart.includes('/')) {
                 let dp = dPart.split('/');
                 if(dp.length === 3) d = `${dp[2]}-${dp[1].padStart(2,'0')}-${dp[0].padStart(2,'0')}`; 
             } else if (dPart.includes('-')) {
                 d = dPart; 
             } else if (dPart.includes(':')) {
                 let tPart = dPart.split(':');
                 h = tPart[0] ? tPart[0].padStart(2,'0') : h;
                 m = tPart[1] ? tPart[1].padStart(2,'0') : m;
             }
        }
        if(parts.length > 1) {
             let tPart = parts[1].split(':');
             h = tPart[0] ? tPart[0].padStart(2,'0') : h;
             m = tPart[1] ? tPart[1].padStart(2,'0') : m;
        }
    }
    return { date: d, hh: h, mm: m };
}

// 🌟 สร้างแถวรูบริค
window.getRubricRowHtml = function(id, name, raw, weight) {
    return `
    <tr id="rubric_row_${id}" class="rubric-row">
        <td class="p-1"><input type="text" class="form-control rubric-name shadow-sm" placeholder="เช่น ความเป็นและความสำคัญ..." value="${name}" oninput="calcRubricTotal()"></td>
        <td class="p-1"><input type="number" class="form-control text-center rubric-raw text-primary fw-bold shadow-sm" min="0" value="${raw}" oninput="calcRubricTotal()"></td>
        <td class="p-1"><input type="number" class="form-control text-center rubric-weight text-success fw-bold shadow-sm" min="0" step="0.1" value="${weight}" oninput="calcRubricTotal()"></td>
        <td class="p-1 text-center"><button type="button" class="btn btn-danger shadow-sm" onclick="removeRubricRow(${id})"><i class="bi bi-trash"></i></button></td>
    </tr>
    `;
};

// 🌟 กดเพิ่มแถวรูบริค
window.addRubricRow = function() {
    window.rubricRowCount = (window.rubricRowCount || 0) + 1;
    let tbody = document.getElementById('rubricTbody');
    if(tbody) {
        tbody.insertAdjacentHTML('beforeend', window.getRubricRowHtml(window.rubricRowCount, '', 4, 1.5));
        window.calcRubricTotal();
    }
};

// 🌟 กดลบแถวรูบริค
window.removeRubricRow = function(id) {
    let row = document.getElementById(`rubric_row_${id}`);
    if(row) {
        row.remove();
        window.calcRubricTotal();
    }
};

// 🌟 คำนวณคะแนนรวม และเซฟเป็น JSON อัตโนมัติ
window.calcRubricTotal = function() {
    let rows = document.querySelectorAll('.rubric-row');
    let total = 0;
    let rubricArray = [];
    
    rows.forEach(r => {
        let name = r.querySelector('.rubric-name').value.trim();
        let raw = parseFloat(r.querySelector('.rubric-raw').value) || 0;
        let weight = parseFloat(r.querySelector('.rubric-weight').value) || 0;
        total += (raw * weight);
        if(name !== "") {
            rubricArray.push({name: name, raw: raw, weight: weight});
        }
    });
    
    let display = document.getElementById('rubricTotalDisplay');
    let finalTotal = total % 1 === 0 ? total : total.toFixed(2);
    if(display) display.innerText = finalTotal;
    
    // 🌟 แก้ไข: อัปเดตช่องซ่อนของรูบริค (ตอนนี้น้องขยับมาอยู่ index 10 แล้ว)
    let hiddenInput = document.getElementById('cfgInput_10'); 
    if(hiddenInput) hiddenInput.value = JSON.stringify(rubricArray);
    
    // 🪄 [เวทมนตร์] อัปเดตช่อง "คะแนนเต็ม" (อยู่ index 9 เหมือนเดิม)
    let totalScoreInput = document.getElementById('cfgInput_9');
    if(totalScoreInput) totalScoreInput.value = finalTotal;
};

// 🌟 ฟังก์ชันตัวช่วยสำหรับซ่อน/โชว์ Dropdown กลุ่มเป้าหมาย
window.handleUserRoleChange = function() {
    let roleDropdown = document.getElementById('cfgInput_2');
    if(!roleDropdown) return;
    
    let role = roleDropdown.value;
    let targetContainer = document.getElementById('container_cfgInput_5'); // กล่องครอบ Dropdown กลุ่มเป้าหมาย
    let targetInput = document.getElementById('cfgInput_5');
    
    // 🌟 อัปเดตใหม่: ถ้าเป็น Admin หรือ Staff ให้ซ่อนช่องกลุ่มเป้าหมายทิ้ง
    if (role === 'Admin' || role === 'Staff') {
        if(targetContainer) targetContainer.style.display = 'none';
        if(targetInput) targetInput.value = ''; // เคลียร์ค่าทิ้งด้วย
    } else {
        // 🌟 ส่วน Mentor และ Trainee จะเข้าเงื่อนไขนี้ (โชว์กล่องให้เลือก)
        if(targetContainer) targetContainer.style.display = 'block';
    }
};

// ============================================================
// 3. ฟอร์มเพิ่ม/แก้ไขข้อมูล (Smart Form Generator)
// ============================================================
function openConfigForm(id = null) {
    let isNew = !id;
    let rowData = isNew ? Array(adminConfigHeaders.length).fill('') : adminConfigRows.find(r => r[0] == id);
    if (!rowData) return;

    let html = '<div class="text-start" style="max-height: 70vh; overflow-y: auto; overflow-x: hidden; padding-right: 15px;">';
    
    adminConfigHeaders.forEach((h, i) => {
        let val = rowData[i] || '';
        let inputHtml = '';

        const makeAutoId = (prefix) => {
            let v = isNew ? `${prefix}-${new Date().getTime()}` : val;
            return `<input type="text" id="cfgInput_${i}" class="form-control bg-light text-secondary border-0 fw-bold" value="${v}" readonly>`;
        };

        const makeDropdown = (options) => {
            let opts = options.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('');
            return `<select id="cfgInput_${i}" class="form-select border-secondary shadow-sm">${opts}</select>`;
        };

        const makeDatePicker = () => {
            let parsed = parseDateTimeValue(val);
            return `<input type="date" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${parsed.date}">`;
        };

        const makeTimePicker = () => {
            let parsed = parseDateTimeValue(val);
            return `<input type="time" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${parsed.hh}:${parsed.mm}">`;
        };

        const makeDateTimePicker = () => {
            let parsed = parseDateTimeValue(val);
            let dtValue = `${parsed.date}T${parsed.hh}:${parsed.mm}`;
            return `<input type="datetime-local" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${dtValue}">`;
        };

        const makeRubricEditor = () => {
            let rubricData = [];
            if (val && val.trim().startsWith('[')) {
                try { rubricData = JSON.parse(val); } catch(e) {}
            }
            if(rubricData.length === 0) rubricData.push({name: 'ความครบถ้วนของเนื้อหา', raw: 4, weight: 1.5});

            window.rubricRowCount = 0;
            let rowsHtml = rubricData.map(r => {
                window.rubricRowCount++;
                return window.getRubricRowHtml(window.rubricRowCount, r.name, r.raw, r.weight);
            }).join('');

            return `
            <div class="card p-3 border-info shadow-sm rounded-4 mt-2" style="background-color: #f0fbff;">
                <h6 class="fw-bold text-primary mb-3"><i class="bi bi-ui-checks-grid"></i> กำหนดเกณฑ์ของภาระงาน</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-borderless align-middle mb-0">
                        <thead class="border-bottom border-secondary">
                            <tr class="text-secondary small">
                                <th class="text-start pb-2">ชื่อเกณฑ์/ประเด็นพิจารณา</th>
                                <th class="text-center pb-2" style="width: 100px;">คะแนนเต็ม</th>
                                <th class="text-center pb-2" style="width: 100px;">น้ำหนัก</th>
                                <th class="text-center pb-2" style="width: 50px;">ลบ</th>
                            </tr>
                        </thead>
                        <tbody id="rubricTbody">
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-3 border-top pt-3 border-info">
                    <button type="button" class="btn btn-sm btn-outline-success rounded-pill bg-white shadow-sm fw-bold" onclick="addRubricRow()">
                        <i class="bi bi-plus-circle"></i> เพิ่มประเด็นพิจารณา
                    </button>
                    <div class="fw-bold text-dark fs-6 bg-white px-3 py-1 rounded-pill shadow-sm">
                        คะแนนรวมสุทธิ: <span id="rubricTotalDisplay" class="fs-4 text-primary ms-2">0</span>
                    </div>
                </div>
                <input type="hidden" id="cfgInput_${i}" value='${val}'>
            </div>
            `;
        };

        const makeText = (isTextArea = false) => {
            if (isTextArea || val.length > 50) return `<textarea id="cfgInput_${i}" class="form-control border-secondary shadow-sm" rows="3">${val}</textarea>`;
            return `<input type="text" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${val}">`;
        };

        // 🧠 Logic แปลงเครื่องมือให้ตรงกับข้อมูล
        if (adminCurrentConfigSheet === 'Attendance_Config') {
            if (i === 0) inputHtml = makeAutoId('ATT');
            else if (i === 1) inputHtml = makeDropdown(["1", "2", "3", "4", "5", "6", "7"]);
            else if (i === 2) inputHtml = makeDatePicker();
            else if (i === 3) inputHtml = makeDropdown(["Morning", "Afternoon", "Evening"]);
            else if (i === 5 || i === 6) inputHtml = makeTimePicker(); 
            else if (i === 7) inputHtml = makeDropdown(["TRUE", "FALSE"]);
            else inputHtml = makeText();
        } 
        else if (adminCurrentConfigSheet === 'Exam_Config') {
            if (i === 0) inputHtml = makeDropdown(["PRE", "POST"]);
            else if (i === 1 || i === 2) inputHtml = makeDateTimePicker(); 
            else if (i === 3) inputHtml = makeDropdown(["TRUE", "FALSE"]);
            else inputHtml = makeText();
        } 
        else if (adminCurrentConfigSheet === 'Speakers_Config') {
            if (i === 0) inputHtml = makeAutoId('SPK');
            else if (i === 3 || i === 4) inputHtml = makeDateTimePicker(); 
            else if (i === 5) inputHtml = makeDropdown(["TRUE", "FALSE"]);
            else inputHtml = makeText();
        } 
        else if (adminCurrentConfigSheet === 'Assignment_Config') {
            if (i === 0) inputHtml = makeAutoId('ASN');
            else if (i === 3) inputHtml = makeDropdown(["LINK", "FILE"]);
            else if (i === 5 || i === 6) inputHtml = makeDateTimePicker(); 
            else if (i === 7) inputHtml = makeDropdown(["TRUE", "FALSE"]);
            else if (i === 8) inputHtml = makeDropdown(["ALL", "ศึกษานิเทศก์", "ผู้บริหาร", "ครู"]);
            else if (i === 9) inputHtml = `<input type="number" id="cfgInput_${i}" class="form-control bg-light text-primary fw-bold border-secondary shadow-sm" value="${val}" readonly>`;
            else if (i === 10) inputHtml = makeRubricEditor(); 
            else if (i === 2) inputHtml = makeText(true); 
            else inputHtml = makeText();
        } 
        else if (adminCurrentConfigSheet === 'Questions_Bank') {
            if (i === 1) inputHtml = makeDropdown(["PROJECT_SURVEY", "SPEAKER_SURVEY", "TEST", "PRE_TEST", "POST_TEST"]);
            else inputHtml = makeText();
        } 
        // 🌟 🌟 เพิ่ม Logic สำหรับชีต Users ตรงนี้ 🌟 🌟
        else if (adminCurrentConfigSheet === 'Users') {
            if (i === 2) {
                // บทบาท
                let opts = ["Admin", "Staff", "Mentor", "Trainee"].map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('');
                inputHtml = `<select id="cfgInput_${i}" class="form-select border-secondary shadow-sm" onchange="handleUserRoleChange()">${opts}</select>`;
            }
            else if (i === 5) {
                // กลุ่มเป้าหมาย
                let opts = ["", "ศึกษานิเทศก์", "ผู้บริหาร", "ครู"].map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt === "" ? "-- ไม่ระบุ --" : opt}</option>`).join('');
                inputHtml = `<select id="cfgInput_${i}" class="form-select border-secondary shadow-sm">${opts}</select>`;
            }
            else inputHtml = makeText();
        }
        else {
            inputHtml = makeText();
        }

        if (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) {
            html += inputHtml;
        } else {
            let labelHtml = (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) ? '' : `<label class="form-label fs-6 fw-bold text-primary mb-2">${h}</label>`;
            
            // 🌟 เพิ่ม id ให้กล่องครอบ เพื่อใช้ในการซ่อน/โชว์ด้วย handleUserRoleChange()
            html += `
                <div class="mb-4" id="container_cfgInput_${i}">
                    ${labelHtml}
                    ${inputHtml}
                </div>
            `;
        }
        
    });
    html += '</div>';

    Swal.fire({
        title: isNew ? '✨ เพิ่มข้อมูลใหม่' : '✏️ แก้ไขข้อมูล',
        html: html,
        width: '800px', 
        showCancelButton: true,
        confirmButtonText: '💾 บันทึกข้อมูล',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#198754',
        didOpen: () => {
            if (adminCurrentConfigSheet === 'Assignment_Config') window.calcRubricTotal();
            if (adminCurrentConfigSheet === 'Users') window.handleUserRoleChange(); // 🌟 รันฟังก์ชันเพื่อซ่อนกลุ่มเป้าหมายทันทีที่เปิดหน้าต่าง
        },
        preConfirm: () => {
            let newData = [];
            for(let i=0; i<adminConfigHeaders.length; i++) {
                let el = document.getElementById(`cfgInput_${i}`);
                let val = el.value.trim();
                
                if (el.type === 'datetime-local') val = val.replace('T', ' ');

                // ข้ามการตรวจค่าว่างถ้าเป็นช่องที่โดนซ่อน หรือช่องกลุ่มเป้าหมาย (เผื่อ Admin/Staff ไม่ต้องกรอก)
                let container = document.getElementById(`container_cfgInput_${i}`);
                let isHidden = container && container.style.display === 'none';
                
                if(i === 0 && val === '' && el.type !== 'hidden' && !isHidden) {
                    Swal.showValidationMessage(`กรุณากรอก [${adminConfigHeaders[0]}] ให้ครบถ้วน`);
                    return false;
                }
                newData.push(val);
            }
            return newData;
        }
    }).then((result) => {
        if(result.isConfirmed) saveConfigRow(result.value, isNew);
    });
}

// 4. สั่งบันทึกลงฐานข้อมูล
async function saveConfigRow(rowData, isNew) {
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        let res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'manageConfig', payload: { action: 'SAVE', sheetName: adminCurrentConfigSheet, rowData: rowData, isNew: isNew } })
        });
        let result = await res.json();
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
            loadAdminConfig(adminCurrentConfigSheet); 
        } else {
            Swal.fire('ผิดพลาด', result.message, 'error');
        }
    } catch (e) {
        Swal.fire('ขัดข้อง', 'ไม่สามารถบันทึกได้', 'error');
    }
}

// 5. สั่งลบข้อมูลจากฐานข้อมูล
async function deleteConfigRow(id) {
    const confirm = await Swal.fire({
        icon: 'warning', title: 'ยืนยันการลบ?', text: `ต้องการลบข้อมูลรหัส "${id}" ใช่หรือไม่? (ลบแล้วเรียกคืนไม่ได้)`,
        showCancelButton: true, confirmButtonText: 'ใช่, ลบทิ้งเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        let res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'manageConfig', payload: { action: 'DELETE', sheetName: adminCurrentConfigSheet, id: id } })
        });
        let result = await res.json();
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
            loadAdminConfig(adminCurrentConfigSheet); 
        } else {
            Swal.fire('ผิดพลาด', result.message, 'error');
        }
    } catch (e) {
        Swal.fire('ขัดข้อง', 'ไม่สามารถลบข้อมูลได้', 'error');
    }
}

// ============================================================
// 📊 ADMIN EXCEL IMPORT / EXPORT (Powered by SheetJS)
// ============================================================

function openExcelMenu() {
    Swal.fire({
        title: 'จัดการข้อมูล Excel',
        html: `เลือกการดำเนินการสำหรับตาราง <b>${document.getElementById('tab_' + adminCurrentConfigSheet).innerText}</b>`,
        icon: 'info',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="bi bi-file-earmark-arrow-down"></i> นำออก (Export)',
        denyButtonText: '<i class="bi bi-file-earmark-arrow-up"></i> นำเข้า (Import)',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#198754',
        denyButtonColor: '#0d6efd'
    }).then((result) => {
        if (result.isConfirmed) exportConfigToExcel();
        else if (result.isDenied) document.getElementById('excelFileInput').click();
    });
}

function exportConfigToExcel() {
    let rows = [adminConfigHeaders, ...adminConfigRows];
    
    // สร้าง Workbook และ Worksheet ด้วย SheetJS
    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(rows);
    
    XLSX.utils.book_append_sheet(wb, ws, adminCurrentConfigSheet);
    
    // สั่งดาวน์โหลดไฟล์ .xlsx
    XLSX.writeFile(wb, `${adminCurrentConfigSheet}_Export.xlsx`);
}

function handleExcelImport(event) {
    let file = event.target.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.onload = async function(e) {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, {type: 'array'});
        
        // ดึงข้อมูลจากชีตแรกสุดของไฟล์ Excel
        let firstSheetName = workbook.SheetNames[0];
        let worksheet = workbook.Sheets[firstSheetName];
        
        // แปลงข้อมูลเป็น Array 2 มิติ
        let rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
        
        // ถ้ารายการแรกเป็นหัวตาราง ให้ตัดทิ้ง
        if(rows.length > 0 && rows[0].length === adminConfigHeaders.length) rows.shift(); 

        // กรองแถวว่างทิ้ง
        rows = rows.filter(r => r.join('').trim() !== '');

        if(rows.length === 0) {
             Swal.fire('ผิดพลาด', 'ไม่พบข้อมูล หรือรูปแบบตารางไม่ถูกต้อง', 'error');
             event.target.value = ''; return;
        }

        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'ยืนยันการนำเข้า Excel?',
            html: `คำเตือน: การนำเข้าจะ<b>เขียนทับ (Overwrite)</b> ข้อมูลเดิมทั้งหมดในตารางนี้<br><br>พบข้อมูลใหม่จำนวน <b class="text-primary">${rows.length}</b> รายการ`,
            showCancelButton: true,
            confirmButtonText: 'ใช่, เขียนทับเลย',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc3545'
        });

        if(confirm.isConfirmed) uploadExcelToGAS(rows);
        event.target.value = ''; 
    };
    reader.readAsArrayBuffer(file); // อ่านไฟล์เป็น ArrayBuffer สำหรับ Excel
}

async function uploadExcelToGAS(rowsData) {
    Swal.fire({title: 'กำลังอัปเดตฐานข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        let res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'manageConfig', 
                payload: { action: 'IMPORT_EXCEL', sheetName: adminCurrentConfigSheet, excelData: rowsData } 
            })
        });
        let result = await res.json();
        if (result.status === 'success') {
            Swal.fire('สำเร็จ!', result.message, 'success');
            loadAdminConfig(adminCurrentConfigSheet);
        } else {
            Swal.fire('ผิดพลาด', result.message, 'error');
        }
    } catch (e) {
        Swal.fire('ขัดข้อง', 'การเชื่อมต่อล้มเหลว', 'error');
    }
}

// ============================================================
// 📊 REPORT & DASHBOARD LOGIC (Phase 1)
// ============================================================
let reportDataCache = null;
let examChartInstance = null;

// ฟังก์ชันคณิตศาสตร์: หาค่าเฉลี่ย และ SD
const calcMean = arr => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
const calcSD = (arr, mean) => arr.length <= 1 ? 0 : Math.sqrt(arr.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (arr.length - 1));

async function loadReportDashboard() {
    document.getElementById('reportLoading').classList.remove('d-none');
    document.getElementById('reportContent').classList.add('d-none');

    try {
        let res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getDashboardReport' })
        });
        reportDataCache = await res.json();
        
        if (reportDataCache.status === 'success') {
            processAndRenderReport();
        } else {
            Swal.fire('ผิดพลาด', reportDataCache.message, 'error');
        }
    } catch (e) {
        Swal.fire('ขัดข้อง', 'เชื่อมต่อระบบ Report ล้มเหลว', 'error');
    }
}

function processAndRenderReport() {
    let { users, attendance, exam, assignment, survey, examConfig, assignConfig } = reportDataCache;

    // 1. คัดเฉพาะคนที่บทบาทเป็น "Trainee" (ผู้อบรม)
    let trainees = users.filter(u => u['บทบาท'] === 'Trainee');
    let totalTrainee = trainees.length;
    
    document.getElementById('repTotalTrainee').innerText = totalTrainee;

    // 2. จัดกลุ่มข้อมูลแยกตามรายบุคคล (Data Joining)
    let userDataMap = {};
    trainees.forEach(u => {
        userDataMap[u['รหัสประจำตัว']] = {
            name: u['ชื่อ-นามสกุล'],
            org: u['สังกัด/หน่วยงาน'],
            attCount: 0, preScore: null, postScore: null, assignScore: 0,
            evalSpeaker: false, evalProject: false
        };
    });

    // ประมวลผลสอบ
    let preScores = [], postScores = [];
    let passPostCount = 0;
    
    // หาเกณฑ์ผ่านจาก Config (สมมติใช้แถวแรกของ POST)
    let postConfig = examConfig.find(c => c['ประเภทการสอบ'] === 'POST');
    let passingCriteria = postConfig ? parseFloat(postConfig['เกณฑ์การผ่าน']) : 60;

    exam.forEach(e => {
        let pid = e.personal_id;
        if(userDataMap[pid]) {
            let score = parseFloat(e.score) || 0;
            let percent = (score / (parseFloat(e.max_score) || 1)) * 100;
            
            if(e.test_type === 'PRE' && userDataMap[pid].preScore === null) {
                userDataMap[pid].preScore = score;
                preScores.push(score);
            }
            if(e.test_type === 'POST') {
                // เก็บแต้มที่ดีที่สุด
                if(userDataMap[pid].postScore === null || score > userDataMap[pid].postScore) {
                    userDataMap[pid].postScore = score;
                }
            }
        }
    });

    // สรุป Post-Test (อัปเดตแต้มที่ดีที่สุดลง Array และเช็กผ่าน)
    Object.values(userDataMap).forEach(u => {
        if(u.postScore !== null) {
            postScores.push(u.postScore);
            let pct = (u.postScore / (postConfig ? parseFloat(postConfig['คะแนนเต็ม'] || 100) : 100)) * 100; // สมมติ 100
            if(pct >= passingCriteria) passPostCount++;
        }
    });

    document.getElementById('repTotalPre').innerText = preScores.length;
    document.getElementById('repTotalPost').innerText = postScores.length;
    document.getElementById('repPassPost').innerText = passPostCount;

    // ประมวลผลเวลาเรียน, ส่งงาน, ประเมิน (คำนวณเบื้องต้น)
    attendance.forEach(a => { if(userDataMap[a.personal_id]) userDataMap[a.personal_id].attCount++; });
    assignment.forEach(a => { if(userDataMap[a.personal_id] && (a.status === 'ตรวจแล้ว' || a.status === 'รอตรวจ')) userDataMap[a.personal_id].assignScore += (parseFloat(a.score) || 0); });
    survey.forEach(s => { 
        if(userDataMap[s.personal_id]) {
            if(s.survey_type === 'PROJECT_SURVEY') userDataMap[s.personal_id].evalProject = true;
            if(s.survey_type === 'SPEAKER_SURVEY') userDataMap[s.personal_id].evalSpeaker = true;
        }
    });

    // 3. คำนวณสถิติ
    let preMean = calcMean(preScores), postMean = calcMean(postScores);
    let statHtml = `
        <tr><td>คะแนนเฉลี่ย (Mean)</td><td class="text-center fw-bold text-info">${preMean.toFixed(2)}</td><td class="text-center fw-bold text-success">${postMean.toFixed(2)}</td></tr>
        <tr><td>คะแนนสูงสุด (Max)</td><td class="text-center">${preScores.length ? Math.max(...preScores) : 0}</td><td class="text-center">${postScores.length ? Math.max(...postScores) : 0}</td></tr>
        <tr><td>คะแนนต่ำสุด (Min)</td><td class="text-center">${preScores.length ? Math.min(...preScores) : 0}</td><td class="text-center">${postScores.length ? Math.min(...postScores) : 0}</td></tr>
        <tr><td>ส่วนเบี่ยงเบนมาตรฐาน (SD)</td><td class="text-center text-muted">${calcSD(preScores, preMean).toFixed(2)}</td><td class="text-center text-muted">${calcSD(postScores, postMean).toFixed(2)}</td></tr>
    `;
    document.getElementById('statTableBody').innerHTML = statHtml;

    // 4. วาดกราฟเปรียบเทียบ
    let ctx = document.getElementById('examChart').getContext('2d');
    if(examChartInstance) examChartInstance.destroy();
    examChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['คะแนนเฉลี่ย', 'คะแนนสูงสุด', 'คะแนนต่ำสุด'],
            datasets: [
                { label: 'Pre-Test', data: [preMean.toFixed(2), preScores.length ? Math.max(...preScores) : 0, preScores.length ? Math.min(...preScores) : 0], backgroundColor: '#0dcaf0' },
                { label: 'Post-Test', data: [postMean.toFixed(2), postScores.length ? Math.max(...postScores) : 0, postScores.length ? Math.min(...postScores) : 0], backgroundColor: '#198754' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // 5. สร้างตารางรายบุคคล
    let tableHtml = '';
    Object.keys(userDataMap).forEach(pid => {
        let u = userDataMap[pid];
        let preBadge = u.preScore !== null ? `<span class="badge bg-info">${u.preScore}</span>` : '<span class="text-muted">-</span>';
        let postBadge = u.postScore !== null ? `<span class="badge bg-success">${u.postScore}</span>` : '<span class="text-muted">-</span>';
        let totalScore = (u.postScore || 0) + u.assignScore;
        
        let spkEval = u.evalSpeaker ? '✔️' : '❌';
        let prjEval = u.evalProject ? '✔️' : '❌';

        tableHtml += `
            <tr>
                <td class="text-center text-muted">${pid}</td>
                <td><div class="fw-bold text-primary">${u.name}</div><div class="small text-muted" style="font-size: 0.75rem;">${u.org}</div></td>
                <td class="text-center">${u.attCount} ครั้ง</td>
                <td class="text-center">${preBadge}</td>
                <td class="text-center">${postBadge}</td>
                <td class="text-center text-primary fw-bold">${u.assignScore}</td>
                <td class="text-center text-danger fw-bold fs-6">${totalScore}</td>
                <td class="text-center">${spkEval}</td>
                <td class="text-center">${prjEval}</td>
            </tr>
        `;
    });

    if(tableHtml === '') tableHtml = `<tr><td colspan="9" class="text-center py-4 text-muted">ยังไม่มีข้อมูลผู้อบรมในระบบ</td></tr>`;
    document.getElementById('repUserTableBody').innerHTML = tableHtml;

    // ปิด Loading
    document.getElementById('reportLoading').classList.add('d-none');
    document.getElementById('reportContent').classList.remove('d-none');
}

// 🌟 ผูกการโหลด Report เมื่อสลับแท็บ
const originalSwitchAdminTab = window.switchAdminTab;
window.switchAdminTab = function(tabName) {
    originalSwitchAdminTab(tabName); // เรียกฟังก์ชันเดิม
    if (tabName === 'reportManage' && !reportDataCache) {
        loadReportDashboard();
    }
};

// ============================================================
// 📋 PHASE 2: ระบบประมวลผลการประเมิน (Survey Analysis)
// ============================================================

// แปลผลค่าเฉลี่ย
function getRatingMeaning(mean) {
    if (mean >= 4.50) return "มากที่สุด";
    if (mean >= 3.50) return "มาก";
    if (mean >= 2.50) return "ปานกลาง";
    if (mean >= 1.50) return "น้อย";
    return "น้อยที่สุด";
}

function renderEvaluationReport() {
    if (!reportDataCache || !reportDataCache.survey) return;

    let evalType = document.getElementById('evalTypeSelector').value;
    let speakerSelect = document.getElementById('evalSpeakerSelector');
    let contentArea = document.getElementById('evalReportContent');
    
    // โชว์/ซ่อน Dropdown เลือกวิทยากร
    if (evalType === 'SPEAKER_SURVEY') {
        speakerSelect.classList.remove('d-none');
        if (speakerSelect.options.length === 0) {
            let spkHtml = '';
            reportDataCache.speakers.forEach(s => {
                spkHtml += `<option value="${s['รหัส']}">${s['ชื่อวิทยากร']}</option>`;
            });
            speakerSelect.innerHTML = spkHtml;
        }
    } else {
        speakerSelect.classList.add('d-none');
    }

    let targetId = evalType === 'PROJECT_SURVEY' ? 'PROJECT' : speakerSelect.value;
    
    // กรอง Log คำตอบที่ตรงกับเงื่อนไข
    let filteredLogs = reportDataCache.survey.filter(s => s.survey_type === evalType && s.target_id === targetId);
    let totalN = filteredLogs.length;

    if (totalN === 0) {
        contentArea.innerHTML = `<div class="alert alert-warning text-center py-4">ยังไม่มีผู้ตอบแบบประเมินในหัวข้อนี้</div>`;
        return;
    }

    // แปลง String JSON เป็น Object
    let answersList = filteredLogs.map(s => {
        try { return JSON.parse(s.answers); } catch(e) { return {}; }
    });

    // ดึงคำถามจากฐานข้อมูล
    let questions = reportDataCache.questions.filter(q => q['ประเภท (Pre/Post/Survey)'] === evalType);
    
    let html = `<div class="alert alert-info border-info text-dark shadow-sm mb-4"><i class="bi bi-people-fill me-2"></i>จำนวนผู้ตอบแบบประเมินทั้งหมด: <b>${totalN}</b> คน</div>`;
    
    // แบ่งคำถามเป็น 2 ส่วน: เชิงปริมาณ (ตัวเลข) และ เชิงคุณภาพ (ข้อความ)
    let quantHtml = `
    <h6 class="fw-bold text-dark mt-4 mb-3">1. ข้อมูลเชิงปริมาณ (ระดับความพึงพอใจ)</h6>
    <div class="table-responsive bg-white rounded-3 border mb-4">
        <table class="table table-hover table-bordered align-middle small mb-0" id="exportEvalTable">
            <thead class="table-light text-center">
                <tr>
                    <th style="width: 5%;">ข้อที่</th>
                    <th class="text-start" style="width: 55%;">รายการประเมิน</th>
                    <th style="width: 10%;">N</th>
                    <th style="width: 10%;">ค่าเฉลี่ย (x̄)</th>
                    <th style="width: 10%;">S.D.</th>
                    <th style="width: 10%;">แปลผล</th>
                </tr>
            </thead>
            <tbody>`;
            
    let qualHtml = `<h6 class="fw-bold text-dark mt-4 mb-3">2. ข้อมูลเชิงคุณภาพ (ข้อเสนอแนะ/ความคิดเห็น)</h6>`;
    let qIndex = 1;

    questions.forEach(q => {
        let qId = q['รหัสคำถาม'];
        let qText = q['คำถาม'];
        let isText = q['ตัวเลือก A'] === 'TEXT';
        
        let validAnswers = [];
        answersList.forEach(ans => {
            if (ans[qId] !== undefined && ans[qId] !== "") validAnswers.push(ans[qId]);
        });

        if (isText) {
            qualHtml += `<div class="card border-0 shadow-sm rounded-3 mb-3 bg-light"><div class="card-body py-3"><h6 class="fw-bold text-primary mb-2">${qText}</h6><ul class="mb-0 text-muted small ps-3">`;
            validAnswers.forEach(txt => { qualHtml += `<li class="mb-1">${txt}</li>`; });
            if (validAnswers.length === 0) qualHtml += `<li>- ไม่มีข้อเสนอแนะ -</li>`;
            qualHtml += `</ul></div></div>`;
        } else {
            // คำนวณ Mean, SD สำหรับตัวเลข
            let numAnswers = validAnswers.map(v => parseFloat(v)).filter(v => !isNaN(v));
            let n = numAnswers.length;
            let mean = calcMean(numAnswers);
            let sd = calcSD(numAnswers, mean);
            let meaning = getRatingMeaning(mean);

            quantHtml += `
                <tr>
                    <td class="text-center">${qIndex++}</td>
                    <td>${qText}</td>
                    <td class="text-center">${n}</td>
                    <td class="text-center fw-bold text-primary">${n > 0 ? mean.toFixed(2) : '-'}</td>
                    <td class="text-center text-muted">${n > 0 ? sd.toFixed(2) : '-'}</td>
                    <td class="text-center"><span class="badge ${mean >= 3.5 ? 'bg-success' : 'bg-warning text-dark'}">${n > 0 ? meaning : '-'}</span></td>
                </tr>`;
        }
    });

    quantHtml += `</tbody></table></div>`;
    contentArea.innerHTML = html + quantHtml + qualHtml;
}

// ผูกการทำงานเวลาโหลดข้อมูลหลักเสร็จ ให้เรนเดอร์แท็บนี้ด้วย
const originalProcessAndRenderReport = window.processAndRenderReport;
window.processAndRenderReport = function() {
    if(originalProcessAndRenderReport) originalProcessAndRenderReport();
    renderEvaluationReport();
};

// ============================================================
// 💾 EXPORT TO EXCEL LOGIC (รวมข้อมูลทั้งหมดลงไฟล์เดียว)
// ============================================================
function exportFullReportToExcel() {
    Swal.fire({title: 'กำลังสร้างไฟล์ Excel...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    
    setTimeout(() => {
        try {
            let wb = XLSX.utils.book_new();

            // 1. ชีต สถิติภาพรวม (ดึงจากตาราง HTML ที่แสดงผล)
            let statSheet = XLSX.utils.table_to_sheet(document.getElementById('exportStatTable'));
            XLSX.utils.book_append_sheet(wb, statSheet, "สถิติผลคะแนน");

            // 2. ชีต ข้อมูลรายบุคคล (ดึงจากตาราง HTML)
            let userSheet = XLSX.utils.table_to_sheet(document.getElementById('exportUserTable'));
            XLSX.utils.book_append_sheet(wb, userSheet, "ข้อมูลสรุปรายบุคคล");

            // 3. ชีต ประเมิน (ดึงตารางปัจจุบันที่โชว์อยู่)
            let evalTable = document.getElementById('exportEvalTable');
            if (evalTable) {
                let evalLabel = document.getElementById('evalTypeSelector').value === 'PROJECT_SURVEY' ? 'ประเมินโครงการ' : 'ประเมินวิทยากร';
                let evalSheet = XLSX.utils.table_to_sheet(evalTable);
                XLSX.utils.book_append_sheet(wb, evalSheet, evalLabel);
            }

            // สั่งดาวน์โหลด
            XLSX.writeFile(wb, `TMS_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            Swal.close();
            
        } catch (error) {
            Swal.fire('ผิดพลาด', 'ไม่สามารถสร้างไฟล์ Excel ได้: ' + error.message, 'error');
        }
    }, 1000);
}