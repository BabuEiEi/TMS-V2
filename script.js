/**
 * PROJECT: TMS-V2
 * VERSION: 41.0 (UI Refinement & LMS Layout Update)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: รวมระบบลงเวลา ระบบข้อสอบ (ความกว้าง 520px) ระบบประเมิน และระบบส่งงาน
 * RULE: ปฏิบัติตามกฎเหล็ก 6 ข้ออย่างเคร่งครัด
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
// [#NAV_LOGIC]
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    let savedId = localStorage.getItem("tms_personal_id");
    if (savedId) {
        document.getElementById("personalId").value = savedId;
        showDashboard();
    }
});

function login() {
    let idInput = document.getElementById("personalId");
    let id = idInput.value.trim().toUpperCase();
    if (id === "") {
        Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกรหัสประจำตัวก่อนครับ' });
        return;
    }
    localStorage.setItem("tms_personal_id", id);
    showDashboard();
    Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ยินดีต้อนรับเข้าสู่ระบบ', timer: 1500, showConfirmButton: false });
}

function logout() {
    localStorage.removeItem("tms_personal_id");
    location.reload();
}

function showDashboard() {
    document.getElementById("loginSection").classList.add("d-none");
    document.getElementById("dashboardSection").classList.remove("d-none");
}

function backToDashboard(currentId) {
    document.getElementById(currentId).classList.add("d-none");
    document.getElementById("dashboardSection").classList.remove("d-none");
    isExamActive = false;
    clearInterval(examCountdown);
}

// ============================================================
// [#ATT_LOGIC]
// ============================================================

async function openAttendanceForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("attendanceSection").classList.remove("d-none");

    let btnContainer = document.getElementById("attendanceButtonsContainer");
    btnContainer.innerHTML = `<div class="text-center my-5"><div class="spinner-border text-info"></div></div>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } })
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

    if (!swalResult.isConfirmed) {
        return;
    }

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
// [#EXAM_LOGIC]
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
            contentArea.innerHTML = `<div class="alert alert-info text-center p-5"><h5 class="fw-bold">${result.message}</h5></div>`;
        }
    } catch (error) {
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

        if (sec === 300) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'เหลือเวลาอีก 5 นาทีสุดท้าย!', showConfirmButton: false, timer: 5000 });
        }

        if (--sec < 0) {
            clearInterval(examCountdown);
            Swal.fire({ title: 'หมดเวลา!', text: 'ส่งคำตอบอัตโนมัติ', icon: 'warning', allowOutsideClick: false }).then(() => { submitRealExam(true); });
        }
    }, 1000);
}

async function submitRealExam(isAuto = false) {
    if (!isAuto) {
        const confirm = await Swal.fire({ title: 'ยืนยันการส่งคำตอบ?', icon: 'question', showCancelButton: true });
        if (!confirm.isConfirmed) { return; }
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
// [#SURVEY_LOGIC]
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
            body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } })
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
    globalSurveyData.speakers.forEach(spk => {
        html += `
            <div class="col-md-6">
                <div class="card h-100 speaker-card" id="spk_card_${spk.id}" onclick="selectSpeaker('${spk.id}')">
                    <div class="card-body p-4">
                        <h5 class="fw-bold">🎤 ${spk.name}</h5>
                        <p class="small mb-0">หัวข้อ: ${spk.topic}</p>
                    </div>
                </div>
            </div>`;
    });
    html += `</div>`;
    selectionArea.innerHTML = html;
}

function selectSpeaker(spkId) {
    selectedSpeakerId = spkId;
    document.querySelectorAll('.speaker-card').forEach(card => {
        card.classList.remove('border-primary', 'bg-primary-subtle');
    });
    let selectedCard = document.getElementById('spk_card_' + spkId);
    if (selectedCard) {
        selectedCard.classList.add('border-primary', 'bg-primary-subtle');
    }
    let placeholder = document.getElementById("speakerPromptPlaceholder");
    if (placeholder) { placeholder.classList.add("d-none"); }

    renderSurveyQuestions();
    document.getElementById("btnSubmitSurvey").classList.remove("d-none");
}

function renderSurveyQuestions() {
    let html = '';
    let grouped = {};
    globalSurveyData.questions.forEach(q => {
        if (!grouped[q.category]) { grouped[q.category] = []; }
        grouped[q.category].push(q);
    });

    Object.keys(grouped).forEach(cat => {
        html += `<h4 class="category-header">${cat}</h4>`;
        grouped[cat].forEach(q => {
            let optionsHtml = '';
            let isNumericRating = q.options.every(opt => !isNaN(opt) && opt.trim() !== "");

            if (isNumericRating) {
                optionsHtml += `<div class="horizontal-rating-wrapper"><div class="horizontal-rating-container">`;
                [...q.options].sort((a, b) => { return b - a; }).forEach(opt => {
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
// [#ASSIGNMENT_LOGIC]: ระบบส่งงาน (LMS Features)
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

        // [จุดแก้ไขที่ 3: เพิ่ม pre-wrap ที่ div ของ description เพื่อให้ขึ้นบรรทัดใหม่ตาม Database]
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

        // [จุดแก้ไขที่ 2: เพิ่ม class align-top ที่แถวตาราง (tr) และปรับข้อความ taskInfo ให้ชิดซ้าย (text-start)]
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

    if (totalAssignments === 0) {
        tbodyHtml = `<tr><td colspan="5" class="text-center p-4 text-muted">ยังไม่มีภาระงานที่เปิดให้ส่งในขณะนี้</td></tr>`;
    }

    document.getElementById("assignmentTableBody").innerHTML = tbodyHtml;

    let progressPercent = totalAssignments > 0 ? Math.round((submittedCount / totalAssignments) * 100) : 0;

    // [จุดแก้ไขที่ 1: เปลี่ยนสีพื้นความก้าวหน้าจากการ์ดสีดำ เป็นสีกรมท่าอมเทา (#34495e) เพื่อความซอฟต์และสวยงาม]
    document.getElementById("assignmentDashboardSummary").innerHTML = `
        <div class="col-md-4">
            <div class="card bg-primary text-white border-0 rounded-4 shadow-sm p-3 h-100">
                <h6 class="fw-bold mb-1">ภาระงานทั้งหมด</h6>
                <h2 class="mb-0 fw-bold">${totalAssignments} <span class="fs-6 fw-normal">งาน</span></h2>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card bg-success text-white border-0 rounded-4 shadow-sm p-3 h-100">
                <h6 class="fw-bold mb-1">ส่งงานแล้ว</h6>
                <h2 class="mb-0 fw-bold">${submittedCount} <span class="fs-6 fw-normal">งาน</span></h2>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card text-white border-0 rounded-4 shadow-sm p-3 h-100" style="background-color: #34495e;">
                <h6 class="fw-bold mb-1">ความก้าวหน้า (Progress)</h6>
                <div class="d-flex align-items-center">
                    <h2 class="mb-0 fw-bold me-3">${progressPercent}%</h2>
                    <div class="progress flex-grow-1" style="height: 10px; background-color: rgba(255,255,255,0.2);">
                        <div class="progress-bar bg-info" role="progressbar" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// [วิ V42.3: Bypass SweetAlert File Object Serialization Issue]
async function promptSubmitAssignment(assignId, subType, isLate) {
    let asnConfig = globalAssignmentData.assignments.find(a => a.assign_id === assignId);
    let inputHtml = '';

    // 1. วิสร้างตัวแปรดักรอไฟล์และลิงก์ไว้ข้างนอก (รอดพ้นจากการบิดเบือนของ Pop-up)
    let fileToSubmit = null;
    let linkToSubmit = '';

    if (subType === 'LINK') {
        inputHtml = `
            <div class="text-start mt-3">
                <label class="form-label fw-bold text-primary">วางลิงก์ผลงานของท่าน (URL)</label>
                <input type="url" id="swal-input-link" class="form-control rounded-4 p-2" placeholder="https://...">
            </div>
        `;
    } else {
        inputHtml = `
            <div class="text-start mt-3">
                <label class="form-label fw-bold text-primary">เลือกไฟล์จากเครื่องของท่าน</label>
                <input type="file" id="swal-input-file" class="form-control rounded-4 p-2">
                <small class="text-danger mt-1 d-block">*ระบบแนะนำให้ส่งไฟล์ขนาดไม่เกิน 5MB</small>
            </div>
        `;
    }

    const { isConfirmed } = await Swal.fire({
        title: 'ส่งภาระงาน',
        html: `
            <div class="alert alert-light border text-start mb-0 shadow-sm">
                <p class="mb-1 fw-bold text-dark fs-6">📌 ชื่องาน: ${asnConfig.title}</p>
                <hr class="my-2 text-secondary">
                <div class="small text-muted" style="white-space: pre-wrap; word-break: break-word; max-height: 150px; overflow-y: auto; padding-right: 5px;">${asnConfig.description}</div>
            </div>
            ${inputHtml}
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'ถัดไป (Preview)',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            if (subType === 'LINK') {
                linkToSubmit = document.getElementById('swal-input-link').value;
                if (!linkToSubmit) { Swal.showValidationMessage('กรุณาวางลิงก์ผลงานครับ'); return false; }
                return true;
            } else {
                let fileInput = document.getElementById('swal-input-file');
                if (!fileInput.files.length) { Swal.showValidationMessage('กรุณาเลือกไฟล์ครับ'); return false; }
                // 2. ดักจับ Object ไฟล์ใส่ตัวแปรไว้ตรงนี้เลย
                fileToSubmit = fileInput.files[0];
                return true;
            }
        }
    });

    if (!isConfirmed) return;

    let previewDataHtml = '';

    if (subType === 'LINK') {
        let iframeUrl = linkToSubmit;
        if (linkToSubmit.includes('drive.google.com/file/d/')) {
            iframeUrl = linkToSubmit.replace(/\/view.*/, '/preview');
        }
        previewDataHtml = `
            <div class="mb-3 text-center border rounded-3 overflow-hidden shadow-sm bg-light" style="height: 250px; position: relative;">
                <iframe src="${iframeUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            <p class="text-primary text-break border p-2 rounded-3 bg-light small mb-0">🔗 ลิงก์: <a href="${linkToSubmit}" target="_blank">${linkToSubmit}</a></p>
        `;
    } else {
        // 3. ใช้ไฟล์ของจริงที่ถูกดักไว้มาทำงานต่อ
        let fileType = fileToSubmit.type || '';
        let fileName = fileToSubmit.name || 'ไม่ทราบชื่อไฟล์';
        let fileSize = fileToSubmit.size ? (fileToSubmit.size / 1024).toFixed(2) : '0.00';

        let fileUrl = URL.createObjectURL(fileToSubmit);
        let previewElement = '';

        if (fileType.startsWith('image/')) {
            previewElement = `<img src="${fileUrl}" style="max-height: 230px; max-width: 100%; object-fit: contain;" class="rounded">`;
        } else if (fileType === 'application/pdf') {
            previewElement = `<iframe src="${fileUrl}" style="width: 100%; height: 230px; border: none;"></iframe>`;
        } else {
            previewElement = `<div class="d-flex align-items-center justify-content-center" style="height: 230px;"><div class="text-muted"><h1 class="mb-0 text-secondary">📁</h1><p class="small mt-2">แนบไฟล์สำเร็จ (ไม่รองรับการพรีวิวสด)</p></div></div>`;
        }

        previewDataHtml = `
            <div class="mb-3 text-center border rounded-3 p-2 bg-light shadow-sm">
                ${previewElement}
            </div>
            <p class="text-primary border p-2 rounded-3 bg-light small mb-0">📄 ชื่อไฟล์: ${fileName} <br>ขนาด: ${fileSize} KB</p>
        `;
    }

    const confirmSubmit = await Swal.fire({
        icon: 'question',
        title: 'คุณยืนยันที่จะส่งงานนี้ใช่หรือไม่?',
        width: '600px',
        html: `
            <div class="text-start mt-2">
                <label class="fw-bold mb-2">ข้อมูลที่จะถูกส่งเข้าสู่ระบบ:</label>
                ${previewDataHtml}
                <div class="alert alert-danger mt-3 small">
                    <b>คำเตือน:</b> ท่านสามารถส่งงานได้เพียงครั้งเดียวเท่านั้น<br>
                    (ท่านสามารถกดยกเลิกเองได้ หาก Mentor ยังไม่ได้ลงคะแนน)
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'ยืนยันการส่งงาน',
        cancelButtonText: 'กลับไปแก้ไข',
        confirmButtonColor: '#198754'
    });

    if (!confirmSubmit.isConfirmed) return;

    Swal.fire({ title: 'กำลังอัปโหลดและบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    let payload = {
        personal_id: localStorage.getItem("tms_personal_id"),
        assign_id: assignId,
        submission_type: subType,
        target_folder_id: asnConfig.target_folder_id,
        is_late: isLate
    };

    if (subType === 'LINK') {
        payload.file_link = linkToSubmit;
        executeAssignmentSubmit(payload);
    } else {
        let reader = new FileReader();
        reader.readAsDataURL(fileToSubmit);
        reader.onload = function () {
            let base64Data = reader.result.split(',')[1];
            payload.base64Data = base64Data;
            payload.fileName = fileName;
            payload.mimeType = fileType;
            executeAssignmentSubmit(payload);
        };
        reader.onerror = function (error) {
            Swal.fire('ผิดพลาด', 'ไม่สามารถอ่านไฟล์ได้', 'error');
        };
    }
}

// [วิ V42.1: อัปเดตระบบตรวจสอบ Response และหน่วงเวลาแก้ปัญหา State Sync]
async function executeAssignmentSubmit(payload) {
    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'submitAssignment', payload: payload })
        });

        // 1. แกะกล่องเช็กคำตอบจาก Backend ว่าบันทึกสำเร็จจริงหรือไม่
        let result = await response.json();

        if (result.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'สำเร็จ',
                text: 'ส่งงานเรียบร้อยแล้ว สถานะกำลังอัปเดต...',
                timer: 1500,
                showConfirmButton: false
            });

            // 2. [จุดสำคัญ] หน่วงเวลา 1.5 วินาที ให้ Google Sheets บันทึกข้อมูลลงเซลล์ให้เสร็จ
            // ก่อนที่จะดึงข้อมูลใหม่มาวาดตาราง เพื่อป้องกันการดึงข้อมูลเก่า (Stale Data)
            setTimeout(() => {
                openAssignmentForm();
            }, 1500);

        } else {
            // กรณี Backend แจ้งว่าพัง (เช่น บันทึกไม่ได้)
            Swal.fire('ไม่สามารถส่งงานได้', result.message || 'เกิดข้อผิดพลาดจากระบบหลังบ้าน', 'error');
        }

    } catch (e) {
        // กรณี Network หลุด หรือ Backend คืนค่า Error กลับมาเพราะไฟล์ใหญ่เกินไป
        console.error("Submission Error:", e);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบหลังบ้านได้ (ไฟล์อาจมีขนาดใหญ่เกินไป)', 'error');
    }
}

async function cancelAssignment(assignId) {
    const confirm = await Swal.fire({
        icon: 'warning',
        title: 'ยืนยันการยกเลิก?',
        text: 'ท่านต้องการยกเลิกการส่งงานชิ้นนี้ใช่หรือไม่?',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ยกเลิกการส่ง',
        confirmButtonColor: '#dc3545'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังยกเลิก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        let res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'cancelAssignment',
                payload: { personal_id: localStorage.getItem("tms_personal_id"), assign_id: assignId }
            })
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