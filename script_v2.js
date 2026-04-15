/**
 * PROJECT: TMS-V2
 * VERSION: 69.0 (Ultimate Edition - Pop-up Speaker Selection + Admin Report Fix)
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
    if (isNaN(dateObj.getTime())) { return dateStr; }
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear() + 543;
    return day + " " + month + " " + year;
}

document.addEventListener("DOMContentLoaded", () => {
    // ล้าง session ทุกครั้งที่โหลดหน้าใหม่ → บังคับ Login ใหม่เสมอ
    localStorage.removeItem("tms_personal_id");
    localStorage.removeItem("tms_user_data");
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
    if (id === "") { Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกรหัสประจำตัวก่อนครับ' }); return; }
    Swal.fire({ title: 'กำลังตรวจสอบข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'getUserProfile', payload: { personal_id: id } })
        });
        let result = await response.json();
        if (result.status === 'success') {
            localStorage.setItem("tms_personal_id", id);
            localStorage.setItem("tms_user_data", JSON.stringify(result.data));
            renderUserInfo(); showDashboard();
            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ยินดีต้อนรับเข้าสู่ระบบ', timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: result.message });
        }
    } catch (error) { Swal.fire({ icon: 'error', title: 'ระบบขัดข้อง', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }); }
}

function logout() { localStorage.removeItem("tms_personal_id"); location.reload(); }

function showDashboard() {
    document.getElementById("loginSection").classList.add("d-none");
    document.getElementById("main-nav").style.display = "block";
    let footer = document.getElementById("main-footer");
    if(footer) footer.classList.remove("d-none");

    const userDataStr = localStorage.getItem("tms_user_data");
    if (userDataStr) {
        const user = JSON.parse(userDataStr);
        const role = user.role ? user.role.toUpperCase() : "";
        if (role === 'ADMIN')  { renderAdminDashboard(); return; }
        if (role === 'STAFF')  { renderStaffDashboard(); return; }
        if (role === 'MENTOR') { renderMentorDashboard(); return; }
    }
    document.getElementById("dashboardSection").classList.remove("d-none");
}

function backToDashboard(currentId) {
    document.getElementById(currentId).classList.add("d-none");
    document.getElementById("dashboardSection").classList.remove("d-none");
    isExamActive = false; clearInterval(examCountdown);
}

// ============================================================
// [#ATT_LOGIC]: ระบบลงเวลา (อัปเกรดการจัดรูปแบบเวลาป้องกัน Error)
// ============================================================
async function openAttendanceForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("attendanceSection").classList.remove("d-none");
    let btnContainer = document.getElementById("attendanceButtonsContainer");
    btnContainer.innerHTML = `<div class="text-center my-5"><div class="spinner-border text-info"></div></div>`;
    
    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } })
        });
        let result = await response.json();
        
        if (result.status === 'success') { 
            renderAttendanceButtons(result.schedule, result.userLogs); 
        } else {
            // 🌟 ถ้าระบบหลังบ้านส่ง Error มา จะได้รู้สาเหตุชัดเจนครับ
            btnContainer.innerHTML = `<div class="alert alert-danger text-center shadow-sm"><b>เกิดข้อผิดพลาด:</b> ${result.message}</div>`;
        }
    } catch (error) { 
        btnContainer.innerHTML = `<div class="alert alert-danger text-center shadow-sm">ไม่สามารถดึงข้อมูลได้ (การเชื่อมต่อขัดข้อง)</div>`; 
    }
}

function renderAttendanceButtons(schedule, userLogs) {
    let btnContainer = document.getElementById("attendanceButtonsContainer");
    btnContainer.innerHTML = '';
    const now = new Date();
    
    if (!schedule || schedule.length === 0) { 
        btnContainer.innerHTML = `<div class="alert alert-info text-center shadow-sm rounded-4 py-4">ยังไม่มีรอบลงเวลาที่เปิดใช้งานในขณะนี้ครับ</div>`; 
        return; 
    }

    schedule.forEach(slot => {
        let key = slot.day_no + '_' + slot.slot_id;
        let loggedData = userLogs[key];
        let thaiDate = formatThaiDate(slot.date);
        let timeRange = "(" + slot.start_time + " - " + slot.end_time + ")";
        let baseDisplay = "วันที่ " + slot.day_no + " | " + thaiDate + " " + timeRange;
        
        // 🌟 FIX: เติมเลข 0 ด้านหน้าเวลาให้ครบ 5 หลัก (เช่น 9:49 -> 09:49) ป้องกัน Invalid Date Error
        let safeEndTime = slot.end_time.toString().trim();
        if (safeEndTime.length < 5) safeEndTime = safeEndTime.padStart(5, '0');
        let endDateTime = new Date(slot.date + "T" + safeEndTime + ":00");

        if (loggedData) {
            // loggedData format: "dd/MM/yyyy HH:mm:ss" → parse เอง ป้องกัน NaN
            let logTimeString = '--:--';
            let isLogLate = false;
            const tsParts = loggedData.toString().trim().match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
            let logTime = null;
            if (tsParts) {
                logTime = new Date(tsParts[3], tsParts[2] - 1, tsParts[1], tsParts[4], tsParts[5]);
                logTimeString = tsParts[4] + ':' + tsParts[5];
                isLogLate = logTime > endDateTime;
            } else {
                // fallback: ลอง parse ตรง
                logTime = new Date(loggedData);
                if (!isNaN(logTime.getTime())) {
                    logTimeString = logTime.getHours().toString().padStart(2,'0') + ':' + logTime.getMinutes().toString().padStart(2,'0');
                    isLogLate = logTime > endDateTime;
                }
            }
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
    const swalResult = await Swal.fire({ title: 'หมายเหตุการลงเวลา', input: 'text', inputPlaceholder: 'เช่น ลากิจ, ลาป่วย (เว้นว่างได้)', showCancelButton: true, confirmButtonText: 'บันทึกเวลา', cancelButtonText: 'ยกเลิก' });
    if (!swalResult.isConfirmed) return;
    let userNote = swalResult.value ? swalResult.value.trim() : "";
    let finalNote = userNote !== "" ? "[" + status + "] " + userNote : "[" + status + "]";
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: localStorage.getItem("tms_personal_id"), day_no: day, time_slot: slot, note: finalNote } }) });
        openAttendanceForm(); Swal.close();
    } catch (e) { Swal.fire('ผิดพลาด', 'ส่งข้อมูลไม่สำเร็จ', 'error'); }
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
        let response = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getExamData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
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
    let retakeMessage = ''; let btnLabel = 'เริ่มทำแบบทดสอบ'; let btnColor = 'btn-success';

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
            btnLabel = 'เริ่มสอบซ่อม (ครั้งที่ 2)'; btnColor = 'btn-warning text-dark';
        }
    }

    contentArea.innerHTML = `
        <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
            <h4 class="text-primary fw-bold mb-3">คุณพร้อมหรือไม่?</h4>
            ${retakeMessage}
            <p class="text-muted fs-5">แบบทดสอบนี้มีทั้งหมด <b class="text-dark">${qCount}</b> ข้อ (ข้อละ 2 คะแนน)</p>
            <div class="alert alert-info text-start small mx-auto" style="max-width: 520px;">
                <ul class="mb-0"><li>⏱️ ระบบจะเริ่มจับเวลา <b>30 นาที</b> ทันทีเมื่อกดปุ่ม<b> เริ่มทำแบบทดสอบ</b></li><li>💾 มีระบบ <b>Auto-Save</b> กันเน็ตหลุด</li><li>🚫 <b>ห้ามสลับแท็บหรือสลับหน้าจอ</b> ระบบจะแจ้งเตือน</li></ul>
            </div>
            <button class="btn btn-lg ${btnColor} mt-3 fw-bold px-5 rounded-pill shadow-sm" onclick="startExamTimer()">${btnLabel}</button>
        </div>
    `;
}

function startExamTimer() {
    isExamActive = true; renderExamQuestions(); startTimer(30 * 60);
    document.getElementById("btnSubmitExam").classList.remove("d-none");
    document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderExamQuestions() {
    let html = ''; const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
    let userId = localStorage.getItem("tms_personal_id");
    let draftKey = "tms_draft_" + userId + "_" + globalExamData.activeExam.type;
    let draftData = JSON.parse(localStorage.getItem(draftKey) || "{}");

    globalExamData.questions.sort(() => { return Math.random() - 0.5; });
    globalExamData.questions.forEach((q, i) => {
        html += `<div class="card mb-4 p-5 border-0 shadow-sm rounded-4 bg-white border-start border-5 border-warning fade-in"><p class="fw-bold fs-5 mb-4">${i + 1}. ${q.question}</p>`;
        let optionsKeys = ['A', 'B', 'C', 'D']; optionsKeys.sort(() => { return Math.random() - 0.5; });
        optionsKeys.forEach((optKey, idx) => {
            let isChecked = draftData[q.id] === optKey ? "checked" : "";
            html += `<div class="form-check mb-3"><input class="form-check-input border-secondary" type="radio" name="q_${q.id}" value="${optKey}" id="q_${q.id}_${optKey}" ${isChecked} onchange="saveExamDraft('${q.id}', '${optKey}')"><label class="form-check-label w-100 ms-2" for="q_${q.id}_${optKey}" style="cursor:pointer;"><b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[optKey]}</label></div>`;
        });
        html += `</div>`;
    });
    document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
    let display = document.getElementById("examTimeDisplay");
    examCountdown = setInterval(() => {
        let m = Math.floor(sec / 60); let s = sec % 60;
        display.innerText = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
        if (sec === 300) Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'เหลือเวลาอีก 5 นาทีสุดท้าย!', showConfirmButton: false, timer: 5000 });
        if (--sec < 0) { clearInterval(examCountdown); Swal.fire({ title: 'หมดเวลา!', text: 'ส่งคำตอบอัตโนมัติ', icon: 'warning', allowOutsideClick: false }).then(() => { submitRealExam(true); }); }
    }, 1000);
}

async function submitRealExam(isAuto = false) {
    if (!isAuto) { const confirm = await Swal.fire({ title: 'ยืนยันการส่งคำตอบ?', icon: 'question', showCancelButton: true }); if (!confirm.isConfirmed) return; }
    isExamActive = false; clearInterval(examCountdown);
    let score = 0; let maxScore = globalExamData.questions.length * 2;
    globalExamData.questions.forEach(q => { let sel = document.querySelector(`input[name="q_${q.id}"]:checked`); if (sel && sel.value === q.answer) { score += 2; } });

    Swal.fire({ title: 'กำลังบันทึกคะแนน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: { personal_id: localStorage.getItem("tms_personal_id"), test_type: globalExamData.activeExam.type, score: score, max_score: maxScore } }) });
        localStorage.removeItem("tms_draft_" + localStorage.getItem("tms_personal_id") + "_" + globalExamData.activeExam.type);
        let percentage = (score / maxScore) * 100;
        if (globalExamData.activeExam.type === 'PRE') {
            Swal.fire({ icon: 'info', title: 'บันทึกสำเร็จ!', text: `คะแนน ${score}`, confirmButtonColor: '#0dcaf0' }).then(() => { backToDashboard('examSection'); });
        } else {
            if (percentage >= globalExamData.activeExam.passing_percent) { Swal.fire({ icon: 'success', title: 'ผ่านเกณฑ์! 🎉', text: `คะแนน ${score}/${maxScore}`, confirmButtonColor: '#198754' }).then(() => { backToDashboard('examSection'); }); } 
            else {
                if (globalExamData.attempts + 1 < 2) { Swal.fire({ icon: 'warning', title: 'ยังไม่ผ่านเกณฑ์', text: `คะแนน ${score}/${maxScore}\nสอบซ่อมได้อีก 1 ครั้ง` }).then(() => { backToDashboard('examSection'); }); } 
                else { Swal.fire({ icon: 'error', title: 'ไม่ผ่านเกณฑ์ (ครบ 2 ครั้ง)', text: `คะแนน ${score}/${maxScore}` }).then(() => { backToDashboard('examSection'); }); }
            }
        }
    } catch (e) { Swal.fire('ผิดพลาด', 'ส่งคะแนนไม่สำเร็จ', 'error'); }
}

// ============================================================
// 🌟 [#SURVEY_LOGIC]: ระบบประเมิน (POP-UP สไตล์)
// ============================================================
async function openSurveyForm(type) {
    currentSurveyType = type;
    selectedSpeakerId = null;

    if (type === 'SPEAKER_SURVEY') {
        Swal.fire({ title: 'กำลังโหลดข้อมูลวิทยากร...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        
        try {
            let response = await fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type, personal_id: localStorage.getItem("tms_personal_id") } })
            });
            globalSurveyData = await response.json();
            Swal.close();

            if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
                Swal.fire('แจ้งเตือน', 'ยังไม่มีวิทยากรที่เปิดให้ประเมินในขณะนี้ครับ', 'warning');
                return;
            }

            let optionsHtml = '<option value="" disabled selected>-- กรุณาคลิกเลือกวิทยากรที่ต้องการประเมิน --</option>';
            let evaluatedCount = 0;

            globalSurveyData.speakers.forEach(spk => {
                let keys = Object.keys(spk);
                let spkId = spk.id || spk.spk_id || spk['รหัส'] || spk[keys[0]];
                let spkName = spk.name || spk.spk_name || spk['ชื่อวิทยากร'] || spk[keys[1]];
                let spkTopic = spk.topic || spk.spk_topic || spk['หัวข้อบรรยาย'] || spk[keys[2]];

                if (spkId && spkName) {
                    let displayText = spkTopic ? `${spkName} (${spkTopic})` : spkName;
                    if (spk.is_evaluated) {
                        optionsHtml += `<option value="${spkId}" disabled>✅ ประเมินแล้ว: ${displayText}</option>`;
                        evaluatedCount++;
                    } else {
                        optionsHtml += `<option value="${spkId}">🎤 ${displayText}</option>`;
                    }
                }
            });

            if (evaluatedCount === globalSurveyData.speakers.length && globalSurveyData.speakers.length > 0) {
                Swal.fire('เยี่ยมยอด!', 'ท่านได้ประเมินวิทยากรครบทุกท่านแล้วครับ 🎉', 'success');
                return;
            }

            let html = `
                <div class="text-start mt-2 mb-3">
                    <label class="fw-bold mb-2 text-secondary"><i class="bi bi-person-lines-fill"></i> รายชื่อวิทยากร (เฉพาะที่เปิดประเมินขณะนี้):</label>
                    <select id="swal-speaker-select" class="form-select form-select-lg shadow-sm border-warning fw-bold text-primary" style="cursor: pointer;">
                        ${optionsHtml}
                    </select>
                </div>
            `;

            const { value: selectedId } = await Swal.fire({
                title: 'ประเมินวิทยากร',
                html: html,
                showCancelButton: true,
                confirmButtonText: 'เริ่มทำแบบประเมิน <i class="bi bi-arrow-right-circle ms-1"></i>',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#198754',
                preConfirm: () => {
                    const spkId = document.getElementById('swal-speaker-select').value;
                    if (!spkId) {
                        Swal.showValidationMessage('⚠️ กรุณาคลิกเลือกวิทยากรจากเมนูก่อนครับ');
                        return false;
                    }
                    return spkId;
                }
            });

            if (selectedId) {
                selectedSpeakerId = selectedId;
                document.getElementById("dashboardSection").classList.add("d-none");
                document.getElementById("surveySection").classList.remove("d-none");
                
                let spkObj = globalSurveyData.speakers.find(s => {
                    let keys = Object.keys(s);
                    return (s.id || s.spk_id || s['รหัส'] || s[keys[0]]) === selectedId;
                });
                
                let spkName = spkObj ? (spkObj.name || spkObj.spk_name || spkObj['ชื่อวิทยากร'] || spkObj[Object.keys(spkObj)[1]]) : '';
                document.getElementById("surveyTitleLabel").innerText = `ประเมินวิทยากร: ${spkName}`;
                
                renderSurveyQuestions();
                document.getElementById("btnSubmitSurvey").classList.remove("d-none");
            }
        } catch (e) {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อข้อมูลได้', 'error');
        }

    } else {
        // สำหรับ PROJECT_SURVEY
        document.getElementById("dashboardSection").classList.add("d-none");
        document.getElementById("surveySection").classList.remove("d-none");
        let contentArea = document.getElementById("surveyContentArea");
        contentArea.innerHTML = `<div class="text-center p-5 my-5"><div class="spinner-border text-success"></div></div>`;
        document.getElementById("surveyTitleLabel").innerText = 'ประเมินภาพรวมโครงการ';
        document.getElementById("btnSubmitSurvey").classList.add("d-none");

        try {
            let response = await fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type, personal_id: localStorage.getItem("tms_personal_id") } })
            });
            globalSurveyData = await response.json();

            // บล็อกถ้าประเมินโครงการแล้ว
            if (globalSurveyData.project_evaluated) {
                document.getElementById("surveySection").classList.add("d-none");
                document.getElementById("dashboardSection").classList.remove("d-none");
                Swal.fire({
                    icon: 'info',
                    title: 'ประเมินแล้ว',
                    text: 'ท่านได้ทำการประเมินภาพรวมโครงการเรียบร้อยแล้ว ขอบคุณครับ 🎉',
                    confirmButtonColor: '#198754'
                });
                return;
            }

            renderSurveyQuestions();
            document.getElementById("btnSubmitSurvey").classList.remove("d-none");
        } catch (e) {
            contentArea.innerHTML = '<div class="alert alert-danger text-center">ดาวน์โหลดข้อมูลล้มเหลว</div>';
        }
    }
}

function renderSurveyQuestions() {
    let html = ''; let grouped = {};
    globalSurveyData.questions.forEach(q => { if (!grouped[q.category]) grouped[q.category] = []; grouped[q.category].push(q); });

    Object.keys(grouped).forEach(cat => {
        html += `<h4 class="category-header">${cat}</h4>`;
        grouped[cat].forEach(q => {
            let optionsHtml = '';
            let isNumericRating = q.options.every(opt => !isNaN(opt) && opt.trim() !== "");

            if (isNumericRating) {
                optionsHtml += `<div class="horizontal-rating-wrapper"><div class="horizontal-rating-container">`;
                [...q.options].sort((a, b) => b - a).forEach(opt => {
                    optionsHtml += `<div class="rating-btn-item"><input type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="rating-btn-label shadow-sm" for="sq_${q.id}_${opt}">${opt}</label></div>`;
                });
                optionsHtml += `</div><div class="rating-desc-text"><span>มากที่สุด (5)</span><span>น้อยที่สุด (1)</span></div></div>`;
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
    let answers = {}; let complete = true;
    globalSurveyData.questions.forEach(q => {
        let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || document.querySelector(`textarea[name="sq_${q.id}"]`);
        if (sel && sel.value.trim() !== "") { answers[q.id] = sel.value; } else { complete = false; }
    });

    if (!complete) { Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ' }); return; }

    let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : selectedSpeakerId;
    if (currentSurveyType === 'SPEAKER_SURVEY' && !target) { Swal.fire({ icon: 'warning', title: 'ยังไม่ได้เลือกวิทยากร' }); return; }

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        // 🌟 เพิ่มระบบอ่านการตอบกลับ (Response) จากเซิร์ฟเวอร์
        const response = await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval', 
                payload: { personal_id: localStorage.getItem("tms_personal_id"), answers: answers, target_id: target } 
            }) 
        });
        
        const result = await response.json();
        
        // 🌟 เช็คให้ชัวร์ว่าเซิร์ฟเวอร์ตอบกลับมาว่า success จริงๆ ค่อยเด้ง Pop-up เขียว
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ' }).then(() => { backToDashboard('surveySection'); });
        } else {
            Swal.fire('บันทึกไม่สำเร็จ', 'สาเหตุ: ' + result.message, 'error');
        }
    } catch (e) { 
        Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่', 'error'); 
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
        let response = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAssignmentData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
        let result = await response.json();
        if (result.status === 'success') { globalAssignmentData = result; renderAssignmentDashboard(); } 
        else { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">${result.message}</td></tr>`; }
    } catch (error) { tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">ไม่สามารถดึงข้อมูลได้ กรุณาตรวจสอบอินเทอร์เน็ต</td></tr>`; }
}

function renderAssignmentDashboard() {
    let assignments = globalAssignmentData.assignments;
    let submissions = globalAssignmentData.userSubmissions;
    let totalAssignments = assignments.length; let submittedCount = 0; let tbodyHtml = '';
    const now = new Date();

    assignments.forEach((asn, index) => {
        let sub = submissions[asn.assign_id];
        let isSubmitted = sub && (sub.status === 'รอตรวจ' || sub.status === 'ตรวจแล้ว' || sub.status === 'แก้ไข');
        if (isSubmitted) submittedCount++;

        let endDate = new Date(asn.end_datetime);
        let isLateDeadline = now > endDate;
        let showLateWarning = sub ? (sub.is_late === 'TRUE' || sub.is_late === true) : isLateDeadline;
        let lateBadge = showLateWarning ? `<span class="badge bg-danger ms-2">ส่งงานช้า</span>` : '';

        let taskInfo = `<div class="fw-bold text-dark fs-6">${asn.title} ${lateBadge}</div><div class="text-muted small my-1" style="word-break: break-word;">${asn.description}</div><div class="text-danger fw-bold small mt-2">⏰ กำหนดส่ง: ${formatThaiDate(asn.end_datetime)} เวลา ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')} น.</div>`;

        let statusBadge = ''; let actionBtn = ''; let feedbackText = sub && sub.feedback ? sub.feedback : '-';

        if (!isSubmitted || (sub && sub.status === 'ยกเลิก')) {
            statusBadge = `<span class="badge bg-secondary">ยังไม่ส่งงาน</span>`;
            actionBtn = `<button class="btn btn-sm btn-primary w-100 rounded-pill shadow-sm" onclick="promptSubmitAssignment('${asn.assign_id}', '${asn.submission_type}', ${isLateDeadline})">ส่งงาน (${asn.submission_type})</button>`;
        }
        else if (sub.status === 'รอตรวจ') {
            statusBadge = `<span class="badge bg-warning text-dark">รอตรวจ</span>`;
            actionBtn = `<a href="${sub.file_link}" target="_blank" class="btn btn-sm btn-outline-info w-100 rounded-pill mb-2">ดูงานที่ส่ง</a><button class="btn btn-sm btn-danger w-100 rounded-pill shadow-sm" onclick="cancelAssignment('${asn.assign_id}')">ยกเลิกการส่ง</button>`;
        }
        else if (sub.status === 'แก้ไข') {
            statusBadge = `<span class="badge bg-danger">แก้ไขงาน</span>`;
            actionBtn = `<button class="btn btn-sm btn-warning text-dark w-100 rounded-pill shadow-sm mb-2" onclick="promptSubmitAssignment('${asn.assign_id}', '${asn.submission_type}', ${isLateDeadline})">ส่งงานใหม่</button>`;
        }
        else if (sub.status === 'ตรวจแล้ว') {
            statusBadge = `<span class="badge bg-success">ตรวจแล้ว / ผ่าน</span>`;
            actionBtn = `<a href="${sub.file_link}" target="_blank" class="btn btn-sm btn-outline-success w-100 rounded-pill">ดูงานที่ส่ง</a>`;
        }

        tbodyHtml += `<tr class="align-top"><td class="text-center fw-bold">${index + 1}</td><td class="text-start">${taskInfo}</td><td class="text-center">${actionBtn}</td><td class="text-center">${statusBadge}</td><td class="text-muted small text-start">${feedbackText}</td></tr>`;
    });

    if (totalAssignments === 0) tbodyHtml = `<tr><td colspan="5" class="text-center p-4 text-muted">ยังไม่มีภาระงานที่เปิดให้ส่งในขณะนี้</td></tr>`;
    document.getElementById("assignmentTableBody").innerHTML = tbodyHtml;

    let progressPercent = totalAssignments > 0 ? Math.round((submittedCount / totalAssignments) * 100) : 0;
    document.getElementById("assignmentDashboardSummary").innerHTML = `
        <div class="col-md-4"><div class="card text-white border-0 rounded-4 shadow-sm p-3 h-100 text-center" style="background-color: #1132ec;"><h6 class="fw-bold mb-1">📁 ภาระงานทั้งหมด</h6><h2 class="mb-0 fw-bold">${totalAssignments} <span class="fs-6 fw-normal">งาน</span></h2></div></div>
        <div class="col-md-4"><div class="card bg-success text-white border-0 rounded-4 shadow-sm p-3 h-100 text-center"><h6 class="fw-bold mb-1">✅ ส่งงานแล้ว</h6><h2 class="mb-0 fw-bold">${submittedCount} <span class="fs-6 fw-normal">งาน</span></h2></div></div>
        <div class="col-md-4"><div class="card text-white border-0 rounded-4 shadow-sm p-3 h-100 text-center" style="background-color: #e06309;"><h6 class="fw-bold mb-1">📈 ความก้าวหน้า (Progress)</h6><div class="d-flex align-items-center justify-content-center mt-2"><h2 class="mb-0 fw-bold me-3">${progressPercent}%</h2><div class="progress flex-grow-1" style="height: 10px; background-color: rgba(255,255,255,0.2); max-width: 150px;"><div class="progress-bar bg-info" role="progressbar" style="width: ${progressPercent}%;"></div></div></div></div></div>
    `;
}

async function promptSubmitAssignment(assignId, subType, isLate) {
    let asnConfig = globalAssignmentData.assignments.find(a => a.assign_id === assignId);
    let inputHtml = '', fileToSubmit = null, linkToSubmit = '';

    if (subType === 'LINK') { inputHtml = `<div class="text-start mt-3"><label class="form-label fw-bold text-primary">วางลิงก์ผลงานของท่าน (URL)</label><input type="url" id="swal-input-link" class="form-control rounded-4 p-2" placeholder="https://..."></div>`; } 
    else { inputHtml = `<div class="text-start mt-3"><label class="form-label fw-bold text-primary">เลือกไฟล์จากเครื่องของท่าน</label><input type="file" id="swal-input-file" class="form-control rounded-4 p-2"><small class="text-danger mt-1 d-block">*ระบบแนะนำให้ส่งไฟล์ขนาดไม่เกิน 5MB</small></div>`; }

    const { isConfirmed } = await Swal.fire({
        title: 'ส่งภาระงาน',
        html: `<div class="alert alert-light border text-start mb-0 shadow-sm"><p class="mb-1 fw-bold text-dark fs-6">📌 ชื่องาน: ${asnConfig.title}</p><hr class="my-2 text-secondary"><div class="small text-muted" style="white-space: pre-wrap; word-break: break-word; max-height: 150px; overflow-y: auto; padding-right: 5px;">${asnConfig.description}</div></div>${inputHtml}`,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'ถัดไป (Preview)', cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            if (subType === 'LINK') { linkToSubmit = document.getElementById('swal-input-link').value; if (!linkToSubmit) { Swal.showValidationMessage('กรุณาวางลิงก์ผลงานครับ'); return false; } return true; } 
            else { let fileInput = document.getElementById('swal-input-file'); if (!fileInput.files.length) { Swal.showValidationMessage('กรุณาเลือกไฟล์ครับ'); return false; } fileToSubmit = fileInput.files[0]; return true; }
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

    const confirmSubmit = await Swal.fire({ icon: 'question', title: 'ยืนยันที่จะส่งงานนี้ใช่หรือไม่?', width: '600px', html: `<div class="text-start mt-2"><label class="fw-bold mb-2">ข้อมูลที่จะถูกส่งเข้าสู่ระบบ:</label>${previewDataHtml}</div>`, showCancelButton: true, confirmButtonText: 'ยืนยันการส่งงาน', confirmButtonColor: '#198754' });

    if (!confirmSubmit.isConfirmed) return;
    let payload = { personal_id: localStorage.getItem("tms_personal_id"), assign_id: assignId, submission_type: subType, target_folder_id: asnConfig.target_folder_id, is_late: isLate };
    executeAssignmentSubmit(payload, subType === 'LINK' ? linkToSubmit : fileToSubmit);
}

async function executeAssignmentSubmit(payload, fileObj = null) {
    Swal.fire({ title: 'กำลังเตรียมข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    if (payload.submission_type === 'FILE' && fileObj) {
        const reader = new FileReader(); reader.readAsDataURL(fileObj);
        reader.onload = async () => { payload.base64Data = reader.result.split(',')[1]; payload.fileName = fileObj.name; payload.mimeType = fileObj.type; await sendToGAS(payload); };
    } else { await sendToGAS(payload); }
}

async function sendToGAS(payload) {
    try {
        const response = await fetch(GAS_API_URL, { method: 'POST', mode: 'cors', body: JSON.stringify({ action: 'submitAssignment', payload: payload }) });
        const result = await response.json();
        if (result.status === 'success') { Swal.fire({ icon: 'success', title: 'อัปโหลดสำเร็จ!', timer: 2000, showConfirmButton: false }); setTimeout(() => openAssignmentForm(), 2000); } 
        else { Swal.fire('ล้มเหลว', result.message, 'error'); }
    } catch (e) { Swal.fire('Error', 'ไม่สามารถส่งข้อมูลได้', 'error'); }
}

async function cancelAssignment(assignId) {
    const confirm = await Swal.fire({ icon: 'warning', title: 'ยืนยันการยกเลิก?', text: 'ท่านต้องการยกเลิกการส่งงานชิ้นนี้ใช่หรือไม่?', showCancelButton: true, confirmButtonText: 'ใช่, ยกเลิกการส่ง', confirmButtonColor: '#dc3545' });
    if (!confirm.isConfirmed) return;
    Swal.fire({ title: 'กำลังยกเลิก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'cancelAssignment', payload: { personal_id: localStorage.getItem("tms_personal_id"), assign_id: assignId } }) });
        let result = await res.json();
        if (result.status === 'success') { Swal.fire('ยกเลิกสำเร็จ', 'ท่านสามารถส่งงานชิ้นนี้ใหม่ได้อีกครั้ง', 'success'); openAssignmentForm(); } 
        else { Swal.fire('ไม่สามารถยกเลิกได้', result.message, 'error'); }
    } catch (e) { Swal.fire('ผิดพลาด', 'เชื่อมต่อระบบล้มเหลว', 'error'); }
}

// ============================================================
// 🛡️ ADMIN SYSTEM FUNCTIONS (Database CRUD & Smart Forms)
// ============================================================
let adminCurrentConfigSheet = "Attendance_Config";
let adminConfigHeaders = [];
let adminConfigRows = [];

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
    restoreAdminSidebar(); // คืนสถานะ sidebar เต็มรูปแบบ (กรณีเปิดมาใหม่หลัง Staff)
    loadAdminConfig('Attendance_Config');
}

// ============================================================
// 👔 STAFF SYSTEM FUNCTIONS
// ============================================================
// ============================================================
// 🧑‍🏫 MENTOR SYSTEM FUNCTIONS
// ============================================================
let mentorDataCache = null;

async function renderMentorDashboard() {
    document.getElementById('dashboardSection').classList.add('d-none');
    document.getElementById('mentorSection').classList.remove('d-none');
    await loadMentorData();
}

async function loadMentorData() {
    const personalId = localStorage.getItem('tms_personal_id');
    try {
        const res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getMentorData', payload: { personal_id: personalId } }) });
        const result = await res.json();
        if (result.status !== 'success') { Swal.fire('ผิดพลาด', result.message, 'error'); return; }
        mentorDataCache = result;
        document.getElementById('mentorGroupLabel').textContent = result.mentorGroup;
        renderMentorTraineesTab();
    } catch(e) {
        Swal.fire('ขัดข้อง', 'ไม่สามารถโหลดข้อมูล Mentor ได้', 'error');
    }
}

function switchMentorTab(tab) {
    ['trainees','grade','eval'].forEach(t => {
        document.getElementById('mentorTab_' + t).classList.add('d-none');
        document.getElementById('mentorBtn' + t.charAt(0).toUpperCase() + t.slice(1)).classList.remove('active','fw-bold');
    });
    document.getElementById('mentorTab_' + tab).classList.remove('d-none');
    const btnMap = { trainees: 'mentorBtnTrainees', grade: 'mentorBtnGrade', eval: 'mentorBtnEval' };
    document.getElementById(btnMap[tab]).classList.add('active','fw-bold');
    if (tab === 'trainees') renderMentorTraineesTab();
    else if (tab === 'grade') renderMentorGradeTab();
    else if (tab === 'eval') renderMentorEvalTab();
}

function toggleMentorSidebar() {
    document.getElementById('mentorSidebar')?.classList.toggle('collapsed');
}

function renderMentorTraineesTab() {
    if (!mentorDataCache) return;
    const { trainees, attendance, attendanceConfig } = mentorDataCache;
    const el = document.getElementById('mentorTraineesContent');
    if (!trainees || !trainees.length) { el.innerHTML = '<p class="text-muted text-center py-4">ไม่มีผู้อบรมในกลุ่มนี้</p>'; return; }

    const keyword = (document.getElementById('mentorTraineeSearch')?.value || '').trim().toLowerCase();
    let filtered = trainees;
    if (keyword) {
        filtered = trainees.filter(t => [t.personal_id, t.name, t.cluster, t.group_target].some(v => v && String(v).toLowerCase().includes(keyword)));
    }

    // กรอง config ที่ is_active = TRUE
    const configs = (attendanceConfig || []).filter(c => String(c['is_active (เปิดใช้)'] || c['is_active'] || '').toUpperCase() === 'TRUE');

    // จัดกลุ่ม config ตาม day_no
    const dayMap = {};
    configs.forEach(c => {
        const dayNo = c['day_no (วันที่)'] || c['day_no'] || '';
        const date  = c['date (ว/ด/ป)'] || c['date'] || '';
        const slotId    = c['slot_id (รหัสรอบ)'] || c['slot_id'] || '';
        const slotLabel = c['slot_label (ชื่อรอบ)'] || c['slot_label'] || '';
        if (!dayMap[dayNo]) dayMap[dayNo] = { date, slots: [] };
        dayMap[dayNo].slots.push({ slotId, slotLabel });
    });
    const dayKeys = Object.keys(dayMap).sort((a, b) => parseInt(a) - parseInt(b));
    const totalSlots = configs.length;

    // build header 2 rows
    const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    let thRow1 = '<tr class="table-light text-center"><th rowspan="2" class="align-middle">รหัส</th><th rowspan="2" class="align-middle">ชื่อ-สกุล</th><th rowspan="2" class="align-middle">คลัสเตอร์</th><th rowspan="2" class="align-middle">กลุ่ม</th>';
    let thRow2 = '<tr class="table-primary text-center">';
    dayKeys.forEach(dayNo => {
        const d = dayMap[dayNo];
        let dateStr = d.date;
        try {
            const dt = new Date(dateStr);
            if (!isNaN(dt)) dateStr = dt.getDate() + ' ' + thaiMonths[dt.getMonth()] + ' ' + String(dt.getFullYear() + 543).slice(-2);
        } catch(e) {}
        thRow1 += `<th colspan="${d.slots.length}" class="align-middle text-center">วันที่ ${dayNo}<br><span class="small text-muted">(${dateStr})</span></th>`;
        d.slots.forEach(s => { thRow2 += `<th>${s.slotLabel.replace('รอบ','')}</th>`; });
    });
    thRow1 += '<th rowspan="2" class="align-middle text-center bg-primary text-white">รวม<br>(ครั้ง)</th>';
    thRow1 += '<th rowspan="2" class="align-middle text-center bg-primary text-white">ร้อยละ<br>(%)</th></tr>';
    thRow2 += '</tr>';

    // build attendance map
    const attMap = {};
    (attendance || []).forEach(a => {
        const keys = Object.keys(a);
        const pid  = a['personal_id'] || a[keys[1]] || '';
        const dNo  = a['day_no'] || a[keys[2]] || '';
        const slot = a['time_slot'] || a['slot_id'] || a[keys[3]] || '';
        const note = a['note'] || a[keys[5]] || '';
        const key  = String(dNo) + '_' + String(slot);
        if (!attMap[pid]) attMap[pid] = {};
        attMap[pid][key] = { note: String(note).trim() };
    });

    // build rows
    let tbHtml = '';
    filtered.forEach(t => {
        let count = 0;
        tbHtml += '<tr>';
        tbHtml += `<td class="text-center text-muted small">${t.personal_id}</td>`;
        tbHtml += `<td><div class="fw-bold text-primary">${t.name}</div><div class="small text-muted">${t.area_service||'-'}</div></td>`;
        tbHtml += `<td class="small">${t.cluster||'-'}</td>`;
        tbHtml += `<td class="small">${t.group_target||'-'}</td>`;
        dayKeys.forEach(dayNo => {
            dayMap[dayNo].slots.forEach(s => {
                const key = String(dayNo) + '_' + String(s.slotId);
                const rec = attMap[t.personal_id]?.[key];
                if (rec) {
                    const note = rec.note.toLowerCase();
                    if (note.includes('ลาป่วย') || note.includes('ลากิจ')) {
                        tbHtml += `<td class="text-center"><span class="badge bg-info text-dark" title="${rec.note}">ลา</span></td>`;
                    } else if (note.includes('[สาย]')) {
                        count++;
                        tbHtml += `<td class="text-center"><span class="text-warning fw-bold" title="${rec.note}">✔</span></td>`;
                    } else {
                        count++;
                        tbHtml += `<td class="text-center"><span class="text-success fw-bold">✔</span></td>`;
                    }
                } else {
                    tbHtml += `<td class="text-center text-muted">-</td>`;
                }
            });
        });
        const pct = totalSlots > 0 ? ((count / totalSlots) * 100).toFixed(1) : '0.0';
        tbHtml += `<td class="text-center fw-bold text-primary">${count}</td>`;
        tbHtml += `<td class="text-center fw-bold ${parseFloat(pct) >= 80 ? 'text-success' : 'text-danger'}">${pct}</td></tr>`;
    });

    el.innerHTML = `<div class="table-responsive"><table class="table table-hover align-middle small text-nowrap mb-0">
        <thead id="mentorTraineeThead">${thRow1}${thRow2}</thead>
        <tbody>${tbHtml || '<tr><td colspan="20" class="text-center py-4 text-muted">ไม่มีข้อมูล</td></tr>'}</tbody>
    </table></div>`;
}

function renderMentorGradeTab() {
    if (!mentorDataCache) return;
    const { trainees, assignConfigs, assignLogs } = mentorDataCache;
    const traineeIds = trainees.map(t => t.personal_id);

    // สร้าง map log ล่าสุดของแต่ละ personal_id + assign_id (ยกเว้น ยกเลิก)
    const latestLog = {};
    assignLogs.forEach(log => {
        if (!traineeIds.includes(log.personal_id)) return;
        if (log.status === 'ยกเลิก') return;
        const key = log.personal_id + '|' + log.assign_id;
        if (!latestLog[key] || log.timestamp > latestLog[key].timestamp) latestLog[key] = log;
    });

    const filteredTrainees = trainees;

    const statusBadge = (s) => {
        const map = {
            'รอตรวจ':   'bg-secondary',
            'ดีมาก':    'bg-success',
            'ดี':       'bg-primary',
            'พอใช้':    'bg-warning text-dark',
            'ปรับปรุง': 'bg-danger',
            'ยังไม่ส่ง':'bg-light text-muted border'
        };
        return `<span class="badge ${map[s] || 'bg-secondary'} text-nowrap">${s}</span>`;
    };

    if (!assignConfigs.length) {
        document.getElementById('mentorGradeContent').innerHTML = '<p class="text-muted text-center py-4">ไม่มีภาระงานในระบบ</p>';
        return;
    }

    // ===== Matrix Header =====
    let thCols = assignConfigs.map(cfg =>
        `<th class="text-center align-middle" style="min-width:160px;">
            <div class="fw-bold small">${cfg.title}</div>
            <div class="text-muted" style="font-size:0.7rem;">${cfg.assign_id} | เต็ม ${cfg.full_score}</div>
        </th>`
    ).join('');

    let html = `<div class="table-responsive">
    <table class="table table-hover table-bordered align-middle small mb-0">
        <thead class="table-light">
            <tr>
                <th class="align-middle" style="min-width:180px;">#&nbsp;&nbsp;ชื่อ-สกุล</th>
                ${thCols}
            </tr>
        </thead>
        <tbody>`;

    if (!filteredTrainees.length) {
        html += `<tr><td colspan="${assignConfigs.length + 1}" class="text-center py-4 text-muted">ไม่มีข้อมูล</td></tr>`;
    } else {
        filteredTrainees.forEach((t, idx) => {
            html += `<tr>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span class="text-muted small">${idx + 1}</span>
                        <div>
                            <div class="fw-bold text-primary">${t.name}</div>
                            <div class="text-danger small">${t.personal_id}</div>
                        </div>
                    </div>
                </td>`;

            assignConfigs.forEach(cfg => {
                const log = latestLog[t.personal_id + '|' + cfg.assign_id] || null;
                const status = log ? log.status : 'ยังไม่ส่ง';
                const canGrade = log && status === 'รอตรวจ';
                const hasGraded = log && log.score;
                const logJson = log ? encodeURIComponent(JSON.stringify(log)) : '';
                const cfgJson = encodeURIComponent(JSON.stringify(cfg));

                html += `<td class="text-center">
                    <div class="d-flex flex-column align-items-center gap-1">
                        ${statusBadge(status)}
                        ${log && log.score ? `<div class="small text-muted">${log.score}/${cfg.full_score}</div>` : ''}
                        <div class="d-flex gap-1 mt-1">
                            ${log && log.file_link ? `<a href="${log.file_link}" target="_blank" class="btn btn-xs btn-outline-info py-0 px-1" title="ดูงาน" style="font-size:0.7rem;"><i class="bi bi-eye"></i></a>` : ''}
                            ${log ? `<button class="btn btn-xs ${canGrade ? 'btn-warning' : 'btn-outline-secondary'} py-0 px-1" style="font-size:0.7rem;"
                                onclick="openGradeModal('${logJson}','${cfgJson}')" title="${canGrade ? 'ให้คะแนน' : 'แก้ไขคะแนน'}">
                                <i class="bi bi-${canGrade ? 'pencil-square' : 'pencil'}"></i>
                            </button>` : ''}
                        </div>
                    </div>
                </td>`;
            });

            html += '</tr>';
        });
    }

    html += '</tbody></table></div>';
    document.getElementById('mentorGradeContent').innerHTML = html;
}

async function openGradeModal(logJson, cfgJson) {
    const log = JSON.parse(decodeURIComponent(logJson));
    const cfg = JSON.parse(decodeURIComponent(cfgJson));
    const rubric = Array.isArray(cfg.rubric_criteria) ? cfg.rubric_criteria : [];

    // คะแนนรวมสูงสุด = sum(raw * weight)
    let totalMax = 0;
    rubric.forEach(r => { totalMax += parseFloat(r.raw) * parseFloat(r.weight); });

    // ค่าเริ่มต้น = raw (คะแนนเต็มของแต่ละประเด็น ก่อนคูณ weight)
    const rubricDefaults = rubric.map(r => parseInt(r.raw));

    // ฝั่งซ้าย: Preview งาน
    let previewHtml = '';
    if (log.file_link) {
        // แปลง Google Drive link เป็น embed preview
        let previewUrl = log.file_link;
        const driveMatch = log.file_link.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            previewUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
            previewHtml = `<iframe src="${previewUrl}" style="width:100%;height:100%;min-height:480px;border:none;border-radius:8px;" allowfullscreen></iframe>`;
        } else {
            previewHtml = `<div class="d-flex flex-column align-items-center justify-content-center h-100 gap-3">
                <i class="bi bi-link-45deg text-primary" style="font-size:3rem;"></i>
                <p class="text-muted small text-center">ไม่สามารถ Preview ได้</p>
                <a href="${log.file_link}" target="_blank" class="btn btn-primary rounded-pill px-4">
                    <i class="bi bi-box-arrow-up-right me-2"></i>เปิดลิงก์งาน
                </a>
            </div>`;
        }
    } else {
        previewHtml = `<div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted gap-2">
            <i class="bi bi-file-earmark-x" style="font-size:3rem;"></i>
            <p>ยังไม่มีงานที่ส่ง</p>
        </div>`;
    }

    // ฝั่งขวา: Rubric inputs
    let rubricHtml = rubric.map((r, i) => {
        const rawScore = parseFloat(r.raw);
        const weight = parseFloat(r.weight);
        const weightedMax = rawScore * weight;
        return `
        <div class="mb-2 p-2 bg-light rounded-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="fw-bold small mb-0">${i+1}. ${r.name}</label>
                <span class="text-muted small">เต็ม <strong>${rawScore}</strong> คะแนน <span class="text-secondary">(×${weight} = ${weightedMax})</span></span>
            </div>
            <div class="input-group input-group-sm">
                <input type="number" class="form-control text-center fw-bold"
                    id="rubric_${i}" min="0" max="${rawScore}" step="1"
                    data-weight="${weight}"
                    value="${rubricDefaults[i]}"
                    oninput="calcMentorTotal()">
                <span class="input-group-text">/ ${rawScore}</span>
            </div>
        </div>`;
    }).join('');

    const { value: formValues } = await Swal.fire({
        title: `📝 ให้คะแนน: ${cfg.title}`,
        width: '1100px',
        html: `
        <div class="d-flex gap-3 text-start" style="height:520px;">

            <!-- ฝั่งซ้าย: Preview -->
            <div class="flex-grow-1 border rounded-3 overflow-hidden bg-white" style="min-width:0;">
                <div class="bg-light border-bottom px-3 py-2 d-flex justify-content-between align-items-center">
                    <span class="fw-bold small"><i class="bi bi-eye me-1"></i>Preview งาน</span>
                    ${log.file_link ? `<a href="${log.file_link}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill">
                        <i class="bi bi-box-arrow-up-right me-1"></i>เปิดใหม่
                    </a>` : ''}
                </div>
                <div style="height:calc(100% - 44px);">${previewHtml}</div>
            </div>

            <!-- ฝั่งขวา: กรอกคะแนน -->
            <div style="width:340px;flex-shrink:0;overflow-y:auto;">
                <div class="alert alert-info small py-2 mb-2">
                    <i class="bi bi-person-fill me-1"></i><strong>${log.personal_id}</strong>
                    &nbsp;|&nbsp;<i class="bi bi-clock me-1"></i>${log.timestamp}
                    ${log.is_late === 'TRUE' ? ' <span class="badge bg-danger ms-1">ส่งช้า</span>' : ''}
                </div>

                <div class="mb-2">
                    <div class="small fw-bold text-muted mb-2">📋 เกณฑ์การให้คะแนน (Rubric)</div>
                    ${rubricHtml}
                </div>

                <div class="p-2 rounded-3 mb-3 d-flex justify-content-between align-items-center" style="background:#e8f4fd;">
                    <span class="fw-bold">คะแนนรวม</span>
                    <span class="fs-5 fw-bold text-primary">
                        <span id="mentorTotalScore">0</span> / ${cfg.full_score || totalMax}
                    </span>
                </div>

                <div class="mb-2">
                    <div class="small fw-bold text-muted mb-1">⭐ สถานะ</div>
                    <div class="d-flex gap-1 flex-wrap">
                        ${['ดีมาก','ดี','พอใช้','ปรับปรุง'].map(s =>
                            `<button type="button" class="btn btn-sm btn-outline-secondary status-btn px-3" data-status="${s}" onclick="selectMentorStatus(this)">${s}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="selectedStatus" value="">
                </div>

                <div>
                    <div class="small fw-bold text-muted mb-1">💬 Feedback ถึง Trainee</div>
                    <textarea id="mentorFeedback" class="form-control form-control-sm" rows="4"
                        placeholder="เขียนคำแนะนำ/ข้อเสนอแนะ...">${log.feedback||''}</textarea>
                </div>
            </div>
        </div>`,
        showCancelButton: true,
        confirmButtonText: '💾 บันทึกคะแนน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#198754',
        customClass: { popup: 'text-start' },
        didOpen: () => {
            calcMentorTotal();
            if (log.status && ['ดีมาก','ดี','พอใช้','ปรับปรุง'].includes(log.status)) {
                const btn = document.querySelector(`.status-btn[data-status="${log.status}"]`);
                if (btn) selectMentorStatus(btn);
            }
        },
        preConfirm: () => {
            const status = document.getElementById('selectedStatus').value;
            if (!status) { Swal.showValidationMessage('กรุณาเลือกสถานะ'); return false; }
            // validate แต่ละ rubric input ไม่เกิน max
            let valid = true;
            let total = 0;
            rubric.forEach((r, i) => {
                const rawScore = parseFloat(r.raw);
                const weight = parseFloat(r.weight);
                const inp = document.getElementById('rubric_' + i);
                const val = parseInt(inp?.value || 0);
                if (isNaN(val) || val < 0 || val > rawScore) { inp.classList.add('is-invalid'); valid = false; }
                else { inp?.classList.remove('is-invalid'); total += val * weight; }
            });
            if (!valid) { Swal.showValidationMessage('คะแนนบางรายการเกินค่าสูงสุด'); return false; }
            return { status, feedback: document.getElementById('mentorFeedback').value.trim(), score: total % 1 === 0 ? total.toString() : total.toFixed(1) };
        }
    });

    if (!formValues) return;
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'gradeAssignment', payload: { log_id: log.log_id, status: formValues.status, feedback: formValues.feedback, score: formValues.score } }) });
        const result = await res.json();
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
            await loadMentorData();
            renderMentorGradeTab();
        } else { Swal.fire('ผิดพลาด', result.message, 'error'); }
    } catch(e) { Swal.fire('ขัดข้อง', 'บันทึกไม่สำเร็จ', 'error'); }
}

window.calcMentorTotal = function() {
    const rubricInputs = document.querySelectorAll('[id^="rubric_"]');
    let total = 0;
    // คะแนนรวม = sum(value × weight) แต่ละประเด็น
    rubricInputs.forEach(inp => {
        const val = parseInt(inp.value || 0);
        const w = parseFloat(inp.dataset.weight || 1);
        total += val * w;
    });
    const el = document.getElementById('mentorTotalScore');
    if (el) el.textContent = total % 1 === 0 ? total.toString() : total.toFixed(1);
};

window.selectMentorStatus = function(btn) {
    document.querySelectorAll('.status-btn').forEach(b => {
        b.classList.remove('btn-success','btn-primary','btn-warning','btn-danger');
        b.classList.add('btn-outline-secondary');
    });
    const colorMap = { 'ดีมาก':'btn-success','ดี':'btn-primary','พอใช้':'btn-warning','ปรับปรุง':'btn-danger' };
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add(colorMap[btn.dataset.status] || 'btn-secondary');
    document.getElementById('selectedStatus').value = btn.dataset.status;
};

function renderMentorEvalTab() {
    if (!mentorDataCache) return;
    const { trainees, projectLogs, speakerLogs, speakerConfigs } = mentorDataCache;
    const traineeIds = trainees.map(t => t.personal_id);

    // project eval: ใครประเมินแล้ว
    const evalledProject = new Set((projectLogs || []).filter(r => {
        const pid = r.personal_id || r[Object.keys(r)[1]];
        return traineeIds.includes(pid);
    }).map(r => r.personal_id || r[Object.keys(r)[1]]));

    // speaker eval: ใครประเมิน speaker_id ไหนแล้ว
    const evalledSpeaker = {};
    (speakerLogs || []).forEach(r => {
        const pid = r.personal_id || r[Object.keys(r)[1]];
        const spk = r.target_id || r.speaker_id || r.spk_id || r[Object.keys(r)[2]] || '';
        if (!traineeIds.includes(pid)) return;
        if (!evalledSpeaker[pid]) evalledSpeaker[pid] = new Set();
        evalledSpeaker[pid].add(spk);
    });

    // speaker configs
    const speakers = speakerConfigs.slice ? speakerConfigs.slice(1).map(r => ({ spk_id: r[0], spk_name: r[1] })) : [];

    let html = `<div class="table-responsive"><table class="table table-hover align-middle small text-center mb-0">
        <thead class="table-light"><tr>
            <th class="text-start">Trainee</th>
            <th>ประเมินโครงการ</th>
            ${speakers.map(s => `<th title="${s.spk_name}">${s.spk_id}</th>`).join('')}
        </tr></thead><tbody>`;

    trainees.forEach(t => {
        const projDone = evalledProject.has(t.personal_id);
        html += `<tr>
            <td class="text-start"><div class="fw-bold">${t.name}</div><div class="text-muted small">${t.personal_id}</div></td>
            <td>${projDone ? '<span class="fs-5">✅</span>' : '<span class="text-danger">❌</span>'}</td>
            ${speakers.map(s => {
                const done = evalledSpeaker[t.personal_id]?.has(s.spk_id);
                return `<td>${done ? '<span class="fs-5">✅</span>' : '<span class="text-danger">❌</span>'}</td>`;
            }).join('')}
        </tr>`;
    });

    html += '</tbody></table></div>';
    document.getElementById('mentorEvalContent').innerHTML = html;
}

function renderStaffDashboard() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("adminSection").classList.remove("d-none");

    // ซ่อนเมนูที่ Staff ไม่มีสิทธิ์
    let btnSystem = document.getElementById('sidebarBtnSystem');
    let btnUser   = document.getElementById('sidebarBtnUser');
    let btnReport = document.getElementById('sidebarBtnReport');
    if (btnSystem) btnSystem.classList.add('d-none');
    if (btnUser)   btnUser.classList.add('d-none');

    // ไฮไลต์ปุ่มสรุปรายงานผล และเปลี่ยนสี border sidebar เป็น success
    if (btnReport) {
        btnReport.classList.add('active', 'fw-bold');
        btnReport.classList.remove('d-none');
    }
    let sidebar = document.querySelector('#adminSidebar .border-primary');
    if (sidebar) { sidebar.classList.replace('border-primary', 'border-success'); }
    let sidebarTitle = document.querySelector('#adminSidebar .text-primary');
    if (sidebarTitle) { sidebarTitle.classList.replace('text-primary', 'text-success'); }

    // เปิดแท็บสรุปรายงานผลทันที
    switchAdminTab('reportManage');
}

function restoreAdminSidebar() {
    let btnSystem = document.getElementById('sidebarBtnSystem');
    let btnUser   = document.getElementById('sidebarBtnUser');
    if (btnSystem) btnSystem.classList.remove('d-none');
    if (btnUser)   btnUser.classList.remove('d-none');
    let sidebar = document.querySelector('#adminSidebar .border-success');
    if (sidebar) { sidebar.classList.replace('border-success', 'border-primary'); }
    let sidebarTitle = document.querySelector('#adminSidebar .text-success');
    if (sidebarTitle) { sidebarTitle.classList.replace('text-success', 'text-primary'); }
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.add('d-none'));
    document.querySelectorAll('.list-group-item').forEach(btn => btn.classList.remove('active', 'fw-bold'));
    document.getElementById('adminTab_' + tabName).classList.remove('d-none');
    if(event && event.currentTarget) event.currentTarget.classList.add('active', 'fw-bold');

    if (tabName === 'userManage') { loadAdminConfig('Users'); } 
    else if (tabName === 'systemControl') { loadAdminConfig('Attendance_Config'); } 
    else if (tabName === 'reportManage' && !reportDataCache) { loadReportDashboard(); }
}

function toggleAdminSidebar() { const sidebar = document.getElementById('adminSidebar'); if (sidebar) { sidebar.classList.toggle('collapsed'); } }

async function loadAdminConfig(sheetName) {
    adminCurrentConfigSheet = sheetName;
    let containerId = (sheetName === 'Users') ? "userTableContainer" : "configTableContainer";
    let container = document.getElementById(containerId);

    document.querySelectorAll('.config-tab-btn').forEach(b => { b.classList.remove('btn-primary', 'text-white'); b.classList.add('btn-outline-primary'); });
    let activeTab = document.getElementById('tab_' + sheetName);
    if(activeTab) { activeTab.classList.remove('btn-outline-primary'); activeTab.classList.add('btn-primary', 'text-white'); }

    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">กำลังดึงข้อมูลจากฐานข้อมูล...</p></div>`;
    try {
        let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'manageConfig', payload: { action: 'GET', sheetName: sheetName } }) });
        let result = await res.json();
        if (result.status === 'success') { adminConfigHeaders = CUSTOM_HEADERS[sheetName] || result.headers; adminConfigRows = result.rows; renderAdminTable(containerId); } 
        else { container.innerHTML = `<div class="alert alert-danger text-center">${result.message}</div>`; }
    } catch (e) { container.innerHTML = `<div class="alert alert-danger text-center">การเชื่อมต่อขัดข้อง</div>`; }
}

function renderAdminTable(targetId = "configTableContainer") {
    let html = '<div class="table-responsive bg-white rounded-3"><table class="table table-hover align-middle small text-nowrap mb-0"><thead class="table-light"><tr>';
    adminConfigHeaders.forEach((h, i) => {
        if (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) return; 
        if (adminCurrentConfigSheet === 'Users' && i >= 6) return; 
        html += `<th>${h}</th>`;
    });
    html += '<th class="text-center border-start bg-light" style="position: sticky; right: 0; z-index: 2;">จัดการ</th></tr></thead><tbody>';

    if (adminConfigRows.length === 0) {
        let colSpan = adminConfigHeaders.length + 1;
        if (adminCurrentConfigSheet === 'Assignment_Config') colSpan -= 1;
        if (adminCurrentConfigSheet === 'Users') colSpan = 7; 
        html += `<tr><td colspan="${colSpan}" class="text-center py-5 text-muted">ยังไม่มีข้อมูลในระบบ</td></tr>`;
    } else {
        adminConfigRows.forEach(row => {
            html += '<tr>';
            row.forEach((cell, i) => {
                if (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) return; 
                if (adminCurrentConfigSheet === 'Users' && i >= 6) return; 
                // Strip HTML tags (e.g. from Quill editor) before displaying in table
                let plainCell = cell.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                let displayCell = plainCell.length > 30 ? plainCell.substring(0, 30) + '...' : plainCell;
                html += `<td>${displayCell}</td>`;
            });
            html += `<td class="text-center border-start bg-white" style="position: sticky; right: 0; z-index: 1;"><button class="btn btn-sm btn-warning text-dark me-1 shadow-sm" title="แก้ไข" onclick="openConfigForm('${row[0]}')"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm btn-danger shadow-sm" title="ลบ" onclick="deleteConfigRow('${row[0]}')"><i class="bi bi-trash"></i></button></td></tr>`;
        });
    }
    html += '</tbody></table></div>';
    document.getElementById(targetId).innerHTML = html;
}

function filterUserTable() {
    let keyword = document.getElementById('userSearchInput').value.trim().toLowerCase();
    if (!keyword) { renderAdminTable('userTableContainer'); return; }
    let filtered = adminConfigRows.filter(row => {
        // Search in personal_id(0), name(1), Area_Service(3), group_target(5)
        return [0, 1, 3, 5].some(i => row[i] && String(row[i]).toLowerCase().includes(keyword));
    });
    let backup = adminConfigRows;
    adminConfigRows = filtered;
    renderAdminTable('userTableContainer');
    adminConfigRows = backup;
}

function parseDateTimeValue(val) {
    let now = new Date(); let d = now.toISOString().split('T')[0]; let h = String(now.getHours()).padStart(2, '0'); let m = String(now.getMinutes()).padStart(2, '0');
    if (val && val.trim() !== '') {
        let parts = val.trim().split(' ');
        if(parts.length > 0) {
             let dPart = parts[0];
             if(dPart.includes('/')) { let dp = dPart.split('/'); if(dp.length === 3) d = `${dp[2]}-${dp[1].padStart(2,'0')}-${dp[0].padStart(2,'0')}`; } 
             else if (dPart.includes('-')) { d = dPart; } 
             else if (dPart.includes(':')) { let tPart = dPart.split(':'); h = tPart[0] ? tPart[0].padStart(2,'0') : h; m = tPart[1] ? tPart[1].padStart(2,'0') : m; }
        }
        if(parts.length > 1) { let tPart = parts[1].split(':'); h = tPart[0] ? tPart[0].padStart(2,'0') : h; m = tPart[1] ? tPart[1].padStart(2,'0') : m; }
    }
    return { date: d, hh: h, mm: m };
}

window.getRubricRowHtml = function(id, name, raw, weight) {
    return `<tr id="rubric_row_${id}" class="rubric-row"><td class="p-1"><input type="text" class="form-control rubric-name shadow-sm" placeholder="เช่น ความเป็นและความสำคัญ..." value="${name}" oninput="calcRubricTotal()"></td><td class="p-1"><input type="number" class="form-control text-center rubric-raw text-primary fw-bold shadow-sm" min="0" value="${raw}" oninput="calcRubricTotal()"></td><td class="p-1"><input type="number" class="form-control text-center rubric-weight text-success fw-bold shadow-sm" min="0" step="0.1" value="${weight}" oninput="calcRubricTotal()"></td><td class="p-1 text-center"><button type="button" class="btn btn-danger shadow-sm" onclick="removeRubricRow(${id})"><i class="bi bi-trash"></i></button></td></tr>`;
};

window.addRubricRow = function() { window.rubricRowCount = (window.rubricRowCount || 0) + 1; let tbody = document.getElementById('rubricTbody'); if(tbody) { tbody.insertAdjacentHTML('beforeend', window.getRubricRowHtml(window.rubricRowCount, '', 4, 1.5)); window.calcRubricTotal(); } };
window.removeRubricRow = function(id) { let row = document.getElementById(`rubric_row_${id}`); if(row) { row.remove(); window.calcRubricTotal(); } };

window.calcRubricTotal = function() {
    let rows = document.querySelectorAll('.rubric-row'); let total = 0; let rubricArray = [];
    rows.forEach(r => { let name = r.querySelector('.rubric-name').value.trim(); let raw = parseFloat(r.querySelector('.rubric-raw').value) || 0; let weight = parseFloat(r.querySelector('.rubric-weight').value) || 0; total += (raw * weight); if(name !== "") { rubricArray.push({name: name, raw: raw, weight: weight}); } });
    let display = document.getElementById('rubricTotalDisplay'); let finalTotal = total % 1 === 0 ? total : total.toFixed(2); if(display) display.innerText = finalTotal;
    let hiddenInput = document.getElementById('cfgInput_10'); if(hiddenInput) hiddenInput.value = JSON.stringify(rubricArray);
    let totalScoreInput = document.getElementById('cfgInput_9'); if(totalScoreInput) totalScoreInput.value = finalTotal;
};

window.handleUserRoleChange = function() {
    let roleDropdown = document.getElementById('cfgInput_2'); if(!roleDropdown) return;
    let role = roleDropdown.value; let targetContainer = document.getElementById('container_cfgInput_5'); let targetInput = document.getElementById('cfgInput_5');
    if (role === 'Admin' || role === 'Staff') { if(targetContainer) targetContainer.style.display = 'none'; if(targetInput) targetInput.value = ''; } 
    else { if(targetContainer) targetContainer.style.display = 'block'; }
};

function openConfigForm(id = null) {
    let isNew = !id; let rowData = isNew ? Array(adminConfigHeaders.length).fill('') : adminConfigRows.find(r => r[0] == id);
    if (!rowData) return;

    let html = '<div class="text-start" style="max-height: 70vh; overflow-y: auto; overflow-x: hidden; padding-right: 15px;">';
    adminConfigHeaders.forEach((h, i) => {
        let val = rowData[i] || ''; let inputHtml = '';
        const makeAutoId = (prefix) => `<input type="text" id="cfgInput_${i}" class="form-control bg-light text-secondary border-0 fw-bold" value="${isNew ? `${prefix}-${new Date().getTime()}` : val}" readonly>`;
        const makeDropdown = (options) => `<select id="cfgInput_${i}" class="form-select border-secondary shadow-sm">${options.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('')}</select>`;
        const makeDatePicker = () => `<input type="date" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${parseDateTimeValue(val).date}">`;
        const makeTimePicker = () => `<input type="time" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${parseDateTimeValue(val).hh}:${parseDateTimeValue(val).mm}">`;
        const makeDateTimePicker = () => `<input type="datetime-local" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${parseDateTimeValue(val).date}T${parseDateTimeValue(val).hh}:${parseDateTimeValue(val).mm}">`;
        const makeText = (isTextArea = false) => (isTextArea || val.length > 50) ? `<textarea id="cfgInput_${i}" class="form-control border-secondary shadow-sm" rows="3">${val}</textarea>` : `<input type="text" id="cfgInput_${i}" class="form-control border-secondary shadow-sm" value="${val}">`;

        const makeRubricEditor = () => {
            let rubricData = []; if (val && val.trim().startsWith('[')) { try { rubricData = JSON.parse(val); } catch(e) {} }
            if(rubricData.length === 0) rubricData.push({name: 'ความครบถ้วนของเนื้อหา', raw: 4, weight: 1.5});
            window.rubricRowCount = 0; let rowsHtml = rubricData.map(r => { window.rubricRowCount++; return window.getRubricRowHtml(window.rubricRowCount, r.name, r.raw, r.weight); }).join('');
            return `<div class="card p-3 border-info shadow-sm rounded-4 mt-2" style="background-color: #f0fbff;"><h6 class="fw-bold text-primary mb-3"><i class="bi bi-ui-checks-grid"></i> กำหนดเกณฑ์ของภาระงาน</h6><div class="table-responsive"><table class="table table-sm table-borderless align-middle mb-0"><thead class="border-bottom border-secondary"><tr class="text-secondary small"><th class="text-start pb-2">ชื่อเกณฑ์/ประเด็นพิจารณา</th><th class="text-center pb-2" style="width: 100px;">คะแนนเต็ม</th><th class="text-center pb-2" style="width: 100px;">น้ำหนัก</th><th class="text-center pb-2" style="width: 50px;">ลบ</th></tr></thead><tbody id="rubricTbody">${rowsHtml}</tbody></table></div><div class="d-flex justify-content-between align-items-center mt-3 border-top pt-3 border-info"><button type="button" class="btn btn-sm btn-outline-success rounded-pill bg-white shadow-sm fw-bold" onclick="addRubricRow()"><i class="bi bi-plus-circle"></i> เพิ่มประเด็นพิจารณา</button><div class="fw-bold text-dark fs-6 bg-white px-3 py-1 rounded-pill shadow-sm">คะแนนรวมสุทธิ: <span id="rubricTotalDisplay" class="fs-4 text-primary ms-2">0</span></div></div><input type="hidden" id="cfgInput_${i}" value='${val}'></div>`;
        };

        if (adminCurrentConfigSheet === 'Attendance_Config') {
            if (i === 0) inputHtml = makeAutoId('ATT'); else if (i === 1) inputHtml = makeDropdown(["1", "2", "3", "4", "5", "6", "7"]); else if (i === 2) inputHtml = makeDatePicker(); else if (i === 3) inputHtml = makeDropdown(["Morning", "Afternoon", "Evening"]); else if (i === 5 || i === 6) inputHtml = makeTimePicker(); else if (i === 7) inputHtml = makeDropdown(["TRUE", "FALSE"]); else inputHtml = makeText();
        } else if (adminCurrentConfigSheet === 'Exam_Config') {
            if (i === 0) inputHtml = makeDropdown(["PRE", "POST"]); else if (i === 1 || i === 2) inputHtml = makeDateTimePicker(); else if (i === 3) inputHtml = makeDropdown(["TRUE", "FALSE"]); else inputHtml = makeText();
        } else if (adminCurrentConfigSheet === 'Speakers_Config') {
            if (i === 0) inputHtml = makeAutoId('SPK'); else if (i === 3 || i === 4) inputHtml = makeDateTimePicker(); else if (i === 5) inputHtml = makeDropdown(["TRUE", "FALSE"]); else inputHtml = makeText();
        } else if (adminCurrentConfigSheet === 'Assignment_Config') {
            if (i === 0) inputHtml = makeAutoId('ASN'); else if (i === 3) inputHtml = makeDropdown(["LINK", "FILE"]); else if (i === 5 || i === 6) inputHtml = makeDateTimePicker(); else if (i === 7) inputHtml = makeDropdown(["TRUE", "FALSE"]); else if (i === 8) inputHtml = makeDropdown(["ALL", "ศึกษานิเทศก์", "ผู้บริหาร", "ครู"]); else if (i === 9) inputHtml = `<input type="number" id="cfgInput_${i}" class="form-control bg-light text-primary fw-bold border-secondary shadow-sm" value="${val}" readonly>`; else if (i === 10) inputHtml = makeRubricEditor(); else if (i === 2) inputHtml = `<div id="quillEditor" style="min-height:150px;">${val}</div><input type="hidden" id="cfgInput_${i}" value="">`; else inputHtml = makeText();
        } else if (adminCurrentConfigSheet === 'Questions_Bank') {
            if (i === 1) inputHtml = makeDropdown(["PROJECT_SURVEY", "SPEAKER_SURVEY", "TEST", "PRE_TEST", "POST_TEST"]); else inputHtml = makeText();
        } else if (adminCurrentConfigSheet === 'Users') {
            if (i === 2) { let opts = ["Admin", "Staff", "Mentor", "Trainee"].map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join(''); inputHtml = `<select id="cfgInput_${i}" class="form-select border-secondary shadow-sm" onchange="handleUserRoleChange()">${opts}</select>`; }
            else if (i === 5) { let opts = ["", "ศึกษานิเทศก์", "ผู้บริหาร", "ครู"].map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt === "" ? "-- ไม่ระบุ --" : opt}</option>`).join(''); inputHtml = `<select id="cfgInput_${i}" class="form-select border-secondary shadow-sm">${opts}</select>`; }
            else inputHtml = makeText();
        } else { inputHtml = makeText(); }

        if (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) { html += inputHtml; } 
        else { let labelHtml = (adminCurrentConfigSheet === 'Assignment_Config' && i === 10) ? '' : `<label class="form-label fs-6 fw-bold text-primary mb-2">${h}</label>`; html += `<div class="mb-4" id="container_cfgInput_${i}">${labelHtml}${inputHtml}</div>`; }
    });
    html += '</div>';

    Swal.fire({
        title: isNew ? '✨ เพิ่มข้อมูลใหม่' : '✏️ แก้ไขข้อมูล', html: html, width: '800px', showCancelButton: true, confirmButtonText: '💾 บันทึกข้อมูล', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#198754',
        didOpen: () => {
            if (adminCurrentConfigSheet === 'Assignment_Config') {
                window.calcRubricTotal();
                let editorEl = document.getElementById('quillEditor');
                if (editorEl) {
                    window.quillInstance = new Quill('#quillEditor', {
                        theme: 'snow',
                        modules: {
                            toolbar: [
                                [{ 'size': ['small', false, 'large', 'huge'] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'color': [] }, { 'background': [] }],
                                [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
                                [{ 'align': [] }],
                                ['link'],
                                ['clean']
                            ]
                        }
                    });
                }
            }
            if (adminCurrentConfigSheet === 'Users') window.handleUserRoleChange();
        },
        preConfirm: () => {
            // Sync Quill content to hidden input (Assignment_Config only)
            if (adminCurrentConfigSheet === 'Assignment_Config' && window.quillInstance && document.getElementById('cfgInput_2')) {
                document.getElementById('cfgInput_2').value = window.quillInstance.root.innerHTML;
            }
            let newData = [];
            for(let i=0; i<adminConfigHeaders.length; i++) {
                let el = document.getElementById(`cfgInput_${i}`); let val = el.value.trim();
                if (el.type === 'datetime-local') val = val.replace('T', ' ');
                let container = document.getElementById(`container_cfgInput_${i}`); let isHidden = container && container.style.display === 'none';
                if(i === 0 && val === '' && el.type !== 'hidden' && !isHidden) { Swal.showValidationMessage(`กรุณากรอก [${adminConfigHeaders[0]}] ให้ครบถ้วน`); return false; }
                newData.push(val);
            }
            return newData;
        }
    }).then((result) => { if(result.isConfirmed) saveConfigRow(result.value, isNew); });
}

async function saveConfigRow(rowData, isNew) {
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'manageConfig', payload: { action: 'SAVE', sheetName: adminCurrentConfigSheet, rowData: rowData, isNew: isNew } }) });
        let result = await res.json();
        if (result.status === 'success') { Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false }); loadAdminConfig(adminCurrentConfigSheet); } 
        else { Swal.fire('ผิดพลาด', result.message, 'error'); }
    } catch (e) { Swal.fire('ขัดข้อง', 'ไม่สามารถบันทึกได้', 'error'); }
}

async function deleteConfigRow(id) {
    const confirm = await Swal.fire({ icon: 'warning', title: 'ยืนยันการลบ?', text: `ต้องการลบข้อมูลรหัส "${id}" ใช่หรือไม่? (ลบแล้วเรียกคืนไม่ได้)`, showCancelButton: true, confirmButtonText: 'ใช่, ลบทิ้งเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545' });
    if (!confirm.isConfirmed) return;
    Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'manageConfig', payload: { action: 'DELETE', sheetName: adminCurrentConfigSheet, id: id } }) });
        let result = await res.json();
        if (result.status === 'success') { Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false }); loadAdminConfig(adminCurrentConfigSheet); } 
        else { Swal.fire('ผิดพลาด', result.message, 'error'); }
    } catch (e) { Swal.fire('ขัดข้อง', 'ไม่สามารถลบข้อมูลได้', 'error'); }
}

function openExcelMenu() {
    Swal.fire({ title: 'จัดการข้อมูล Excel', html: `เลือกการดำเนินการสำหรับตาราง <b>${document.getElementById('tab_' + adminCurrentConfigSheet).innerText}</b>`, icon: 'info', showCancelButton: true, showDenyButton: true, confirmButtonText: '<i class="bi bi-file-earmark-arrow-down"></i> นำออก (Export)', denyButtonText: '<i class="bi bi-file-earmark-arrow-up"></i> นำเข้า (Import)', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#198754', denyButtonColor: '#0d6efd' }).then((result) => {
        if (result.isConfirmed) exportConfigToExcel(); else if (result.isDenied) document.getElementById('excelFileInput').click();
    });
}

function exportConfigToExcel() {
    let rows = [adminConfigHeaders, ...adminConfigRows];
    let wb = XLSX.utils.book_new(); let ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, adminCurrentConfigSheet); XLSX.writeFile(wb, `${adminCurrentConfigSheet}_Export.xlsx`);
}

function handleExcelImport(event) {
    let file = event.target.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
        let data = new Uint8Array(e.target.result); let workbook = XLSX.read(data, {type: 'array'});
        let firstSheetName = workbook.SheetNames[0]; let worksheet = workbook.Sheets[firstSheetName];
        let rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
        if(rows.length > 0 && rows[0].length === adminConfigHeaders.length) rows.shift(); 
        rows = rows.filter(r => r.join('').trim() !== '');
        if(rows.length === 0) { Swal.fire('ผิดพลาด', 'ไม่พบข้อมูล หรือรูปแบบตารางไม่ถูกต้อง', 'error'); event.target.value = ''; return; }
        const confirm = await Swal.fire({ icon: 'warning', title: 'ยืนยันการนำเข้า Excel?', html: `คำเตือน: การนำเข้าจะ<b>เขียนทับ (Overwrite)</b> ข้อมูลเดิมทั้งหมดในตารางนี้<br><br>พบข้อมูลใหม่จำนวน <b class="text-primary">${rows.length}</b> รายการ`, showCancelButton: true, confirmButtonText: 'ใช่, เขียนทับเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545' });
        if(confirm.isConfirmed) uploadExcelToGAS(rows); event.target.value = ''; 
    };
    reader.readAsArrayBuffer(file); 
}

async function uploadExcelToGAS(rowsData) {
    Swal.fire({title: 'กำลังอัปเดตฐานข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'manageConfig', payload: { action: 'IMPORT_EXCEL', sheetName: adminCurrentConfigSheet, excelData: rowsData } }) });
        let result = await res.json();
        if (result.status === 'success') { Swal.fire('สำเร็จ!', result.message, 'success'); loadAdminConfig(adminCurrentConfigSheet); } 
        else { Swal.fire('ผิดพลาด', result.message, 'error'); }
    } catch (e) { Swal.fire('ขัดข้อง', 'การเชื่อมต่อล้มเหลว', 'error'); }
}

// ============================================================
// 📊 REPORT & DASHBOARD LOGIC (Phase 1)
// ============================================================
let reportDataCache = null;
let examChartInstance = null;

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

    let trainees = users.filter(u => String(u['role']).toUpperCase() === 'TRAINEE');
    let totalTrainee = trainees.length;
    document.getElementById('repTotalTrainee').innerText = totalTrainee;

    let userDataMap = {};
    trainees.forEach(u => {
        userDataMap[u['personal_id']] = { name: u['name'], area: u['Area_Service'], org: u['group_target'], attCount: 0, preScore: null, postScore: null, assignScore: 0, evalSpeaker: false, evalProject: false };
    });

    let preScores = [], postScores = [];
    let passPostCount = 0;
    let postConfig = examConfig.find(c => c['test_type'] === 'POST');
    let passingCriteria = postConfig ? parseFloat(postConfig['passing_percent']) : 60;

    exam.forEach(e => {
        let pid = e.personal_id;
        if(userDataMap[pid]) {
            let score = parseFloat(e.score) || 0;
            if(e.test_type === 'PRE' && userDataMap[pid].preScore === null) { userDataMap[pid].preScore = score; preScores.push(score); }
            if(e.test_type === 'POST') { if(userDataMap[pid].postScore === null || score > userDataMap[pid].postScore) { userDataMap[pid].postScore = score; } }
        }
    });

    Object.values(userDataMap).forEach(u => {
        if(u.postScore !== null) {
            postScores.push(u.postScore);
            let pct = (u.postScore / (postConfig ? parseFloat(postConfig['full_score'] || 100) : 100)) * 100;
            if(pct >= passingCriteria) passPostCount++;
        }
    });

    document.getElementById('repTotalPre').innerText = preScores.length;
    document.getElementById('repTotalPost').innerText = postScores.length;
    document.getElementById('repPassPost').innerText = passPostCount;

    attendance.forEach(a => {
        if(userDataMap[a.personal_id]) {
            let note = String(a.note || a[Object.keys(a)[5]] || '').toLowerCase();
            if (!note.includes('ลาป่วย') && !note.includes('ลากิจ')) {
                userDataMap[a.personal_id].attCount++;
            }
        }
    });
    assignment.forEach(a => { if(userDataMap[a.personal_id] && (a.status === 'ตรวจแล้ว' || a.status === 'รอตรวจ')) userDataMap[a.personal_id].assignScore += (parseFloat(a.score) || 0); });
    survey.forEach(s => {
        if(userDataMap[s.personal_id]) {
            if(s.survey_type === 'PROJECT_SURVEY') userDataMap[s.personal_id].evalProject = true;
            if(s.survey_type === 'SPEAKER_SURVEY') userDataMap[s.personal_id].evalSpeakerCount = (userDataMap[s.personal_id].evalSpeakerCount || 0) + 1;
        }
    });

    let preMean = calcMean(preScores), postMean = calcMean(postScores);
    let statHtml = `
        <tr><td>คะแนนเฉลี่ย (Mean)</td><td class="text-center fw-bold text-info">${preMean.toFixed(2)}</td><td class="text-center fw-bold text-success">${postMean.toFixed(2)}</td></tr>
        <tr><td>คะแนนสูงสุด (Max)</td><td class="text-center">${preScores.length ? Math.max(...preScores) : 0}</td><td class="text-center">${postScores.length ? Math.max(...postScores) : 0}</td></tr>
        <tr><td>คะแนนต่ำสุด (Min)</td><td class="text-center">${preScores.length ? Math.min(...preScores) : 0}</td><td class="text-center">${postScores.length ? Math.min(...postScores) : 0}</td></tr>
        <tr><td>ส่วนเบี่ยงเบนมาตรฐาน (SD)</td><td class="text-center text-muted">${calcSD(preScores, preMean).toFixed(2)}</td><td class="text-center text-muted">${calcSD(postScores, postMean).toFixed(2)}</td></tr>
    `;
    document.getElementById('statTableBody').innerHTML = statHtml;

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

    let tableHtml = '';
    Object.keys(userDataMap).forEach(pid => {
        let u = userDataMap[pid];
        let preBadge = u.preScore !== null ? `<span class="badge bg-info">${u.preScore}</span>` : '<span class="text-muted">-</span>';
        let postBadge = u.postScore !== null ? `<span class="badge bg-success">${u.postScore}</span>` : '<span class="text-muted">-</span>';
        let totalScore = (u.postScore || 0) + u.assignScore;
        let spkCount = u.evalSpeakerCount || 0;
        let spkEval = spkCount > 0 ? `<span class="badge bg-success">${spkCount}</span>` : '❌';
        let prjEval = u.evalProject ? '✔️' : '❌';

        tableHtml += `<tr><td class="text-center text-muted">${pid}</td><td><div class="fw-bold text-primary">${u.name}</div><div class="small text-muted" style="font-size: 0.75rem;">${u.area || '-'}</div></td><td class="small">${u.org || '-'}</td><td class="text-center">${u.attCount} ครั้ง</td><td class="text-center">${preBadge}</td><td class="text-center">${postBadge}</td><td class="text-center text-primary fw-bold">${u.assignScore}</td><td class="text-center text-danger fw-bold fs-6">${totalScore}</td><td class="text-center">${spkEval}</td><td class="text-center">${prjEval}</td></tr>`;
    });

    if(tableHtml === '') tableHtml = `<tr><td colspan="9" class="text-center py-4 text-muted">ยังไม่มีข้อมูลผู้อบรมในระบบ</td></tr>`;
    document.getElementById('repUserTableBody').innerHTML = tableHtml;

    document.getElementById('reportLoading').classList.add('d-none');
    document.getElementById('reportContent').classList.remove('d-none');
}

// ============================================================
// 🕐 สถิติการลงเวลา รายบุคคล
// ============================================================

function renderAttendanceTab() {
    if (!reportDataCache || reportDataCache.status !== 'success') return;
    let { users, attendance, attendanceConfig } = reportDataCache;

    let keyword = (document.getElementById('attSearchInput')?.value || '').trim().toLowerCase();
    let trainees = users.filter(u => String(u['role']).toUpperCase() === 'TRAINEE');
    if (keyword) {
        trainees = trainees.filter(u => [u['personal_id'], u['name'], u['Cluster'], u['group_target']].some(v => v && String(v).toLowerCase().includes(keyword)));
    }

    let configs = (attendanceConfig || []).filter(c => String(c['is_active (เปิดใช้)'] || c['is_active']).toUpperCase() === 'TRUE');

    // Group configs by day_no
    let dayMap = {};
    configs.forEach(c => {
        let dayNo = c['day_no (วันที่)'] || c['day_no'] || '';
        let date = c['date (ว/ด/ป)'] || c['date'] || '';
        let slotId = c['slot_id (รหัสรอบ)'] || c['slot_id'] || '';
        let slotLabel = c['slot_label (ชื่อรอบ)'] || c['slot_label'] || '';
        let endTime = c['end_time (สิ้นสุด)'] || c['end_time'] || '';
        if (!dayMap[dayNo]) dayMap[dayNo] = { date: date, slots: [] };
        dayMap[dayNo].slots.push({ slotId, slotLabel, endTime });
    });

    let dayKeys = Object.keys(dayMap).sort((a, b) => parseInt(a) - parseInt(b));
    let totalSlots = configs.length;

    // Build header - 2 rows
    let thRow1 = '<tr class="table-light text-center"><th rowspan="2" class="align-middle">รหัส</th><th rowspan="2" class="align-middle">ชื่อ-สกุล</th><th rowspan="2" class="align-middle">คลัสเตอร์</th><th rowspan="2" class="align-middle">กลุ่ม</th>';
    let thRow2 = '<tr class="table-primary text-center">';

    dayKeys.forEach(dayNo => {
        let d = dayMap[dayNo];
        let dateStr = d.date;
        try {
            let dt = new Date(dateStr);
            if (!isNaN(dt)) {
                let thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
                let buddhistYear = (dt.getFullYear() + 543).toString().slice(-2);
                dateStr = dt.getDate() + ' ' + thaiMonths[dt.getMonth()] + ' ' + buddhistYear;
            }
        } catch(e) {}
        thRow1 += `<th colspan="${d.slots.length}" class="align-middle text-center">วันที่ ${dayNo}<br><span class="small text-muted">(${dateStr})</span></th>`;
        d.slots.forEach(s => {
            let shortLabel = s.slotLabel.replace('รอบ', '');
            thRow2 += `<th>${shortLabel}</th>`;
        });
    });

    thRow1 += '<th rowspan="2" class="align-middle text-center bg-primary text-white">รวม<br>(ครั้ง)</th>';
    thRow1 += '<th rowspan="2" class="align-middle text-center bg-primary text-white">ร้อยละ<br>(%)</th>';
    thRow1 += '</tr>';
    thRow2 += '</tr>';

    document.getElementById('attThead').innerHTML = thRow1 + thRow2;

    // Build attendance lookup: personal_id -> "dayNo_slotId" -> { timestamp, note }
    let attMap = {};
    (attendance || []).forEach(a => {
        let keys = Object.keys(a);
        let pid = a['personal_id'] || a[keys[1]] || '';
        let dNo = a['day_no'] || a[keys[2]] || '';
        let slot = a['time_slot'] || a['slot_id'] || a[keys[3]] || '';
        let timestamp = a['timestamp'] || a[keys[4]] || '';
        let note = a['note'] || a[keys[5]] || '';
        let key = String(dNo) + '_' + String(slot);
        if (!attMap[pid]) attMap[pid] = {};
        attMap[pid][key] = { timestamp: String(timestamp), note: String(note).trim() };
    });

    // Build rows
    let tbHtml = '';
    trainees.forEach(u => {
        let pid = u['personal_id'];
        let count = 0;
        tbHtml += '<tr>';
        tbHtml += `<td class="text-center text-muted">${pid}</td>`;
        tbHtml += `<td><div class="fw-bold text-primary">${u['name']}</div><div class="small text-muted" style="font-size:0.75rem;">${u['Area_Service'] || '-'}</div></td>`;
        tbHtml += `<td class="small">${u['Cluster'] || '-'}</td>`;
        tbHtml += `<td class="small">${u['group_target'] || '-'}</td>`;

        dayKeys.forEach(dayNo => {
            dayMap[dayNo].slots.forEach(s => {
                let key = String(dayNo) + '_' + String(s.slotId);
                let record = attMap[pid] && attMap[pid][key];
                if (record) {
                    let note = record.note.toLowerCase();
                    if (note.includes('ลาป่วย') || note.includes('ลากิจ')) {
                        // มีหมายเหตุลา - ไม่นับจำนวนครั้ง
                        tbHtml += `<td class="text-center"><span class="badge bg-info text-dark" title="${record.note}">ลา</span></td>`;
                    } else if (note.includes('[สาย]')) {
                        // สาย - นับครั้ง
                        count++;
                        tbHtml += `<td class="text-center"><span class="text-warning fw-bold" title="${record.note}">✔</span></td>`;
                    } else {
                        // ตรงเวลา - นับครั้ง
                        count++;
                        tbHtml += `<td class="text-center"><span class="text-success fw-bold">✔</span></td>`;
                    }
                } else {
                    tbHtml += `<td class="text-center"><span class="text-muted">-</span></td>`;
                }
            });
        });

        let pct = totalSlots > 0 ? ((count / totalSlots) * 100).toFixed(1) : '0.0';
        tbHtml += `<td class="text-center fw-bold text-primary">${count}</td>`;
        tbHtml += `<td class="text-center fw-bold ${parseFloat(pct) >= 80 ? 'text-success' : 'text-danger'}">${pct}</td>`;
        tbHtml += '</tr>';
    });

    if (tbHtml === '') {
        let colSpan = 4 + totalSlots + 2;
        tbHtml = `<tr><td colspan="${colSpan}" class="text-center py-4 text-muted">ยังไม่มีข้อมูลผู้อบรมในระบบ</td></tr>`;
    }
    document.getElementById('attTbody').innerHTML = tbHtml;
}

// ============================================================
// 📝 ภาระงานและประเมินวิทยากร รายบุคคล
// ============================================================

function renderTaskEvalTab() {
    if (!reportDataCache || reportDataCache.status !== 'success') return;
    let { users, assignment, survey, assignConfig, speakers } = reportDataCache;

    let keyword = (document.getElementById('taskEvalSearchInput')?.value || '').trim().toLowerCase();
    let trainees = users.filter(u => String(u['role']).toUpperCase() === 'TRAINEE');
    if (keyword) {
        trainees = trainees.filter(u => [u['personal_id'], u['name'], u['Area_Service'], u['group_target']].some(v => v && String(v).toLowerCase().includes(keyword)));
    }
    let assignments = assignConfig || [];
    let speakerList = (speakers || []).filter(s => s['spk_id']);

    // Build header
    let thHtml = '<tr><th>รหัสประจำตัว</th><th class="text-start">ชื่อ-นามสกุล</th><th class="text-start">กลุ่มเป้าหมาย</th>';
    assignments.forEach(a => {
        thHtml += `<th class="text-center"><div>${a['assign_id']}</div><div class="small text-muted" style="font-size:0.65rem; white-space:normal; max-width:100px;">${a['assign_title'] || ''}</div></th>`;
    });
    speakerList.forEach(s => {
        thHtml += `<th class="text-center"><div>${s['spk_id']}</div><div class="small text-muted" style="font-size:0.65rem; white-space:normal; max-width:100px;">${s['spk_name'] || ''}</div></th>`;
    });
    thHtml += '</tr>';
    document.getElementById('taskEvalThead').innerHTML = thHtml;

    // Build assignment lookup: personal_id -> assign_id -> { score, status }
    let assignMap = {};
    (assignment || []).forEach(a => {
        let pid = a['personal_id'];
        let aid = a['assign_id'];
        if (!assignMap[pid]) assignMap[pid] = {};
        assignMap[pid][aid] = { score: parseFloat(a['score']) || 0, status: a['status'] || '' };
    });

    // Build survey lookup: personal_id -> spk_id -> true
    let surveyMap = {};
    (survey || []).forEach(s => {
        if (s['survey_type'] === 'SPEAKER_SURVEY') {
            let pid = s['personal_id'];
            let sid = s['speaker_id'] || s['spk_id'] || '';
            if (!surveyMap[pid]) surveyMap[pid] = {};
            surveyMap[pid][sid] = true;
        }
    });

    // Build rows
    let tbHtml = '';
    trainees.forEach(u => {
        let pid = u['personal_id'];
        tbHtml += `<tr>`;
        tbHtml += `<td class="text-center text-muted">${pid}</td>`;
        tbHtml += `<td><div class="fw-bold text-primary">${u['name']}</div><div class="small text-muted" style="font-size:0.75rem;">${u['Area_Service'] || '-'}</div></td>`;
        tbHtml += `<td class="small">${u['group_target'] || '-'}</td>`;

        assignments.forEach(a => {
            let aid = a['assign_id'];
            let data = assignMap[pid] && assignMap[pid][aid];
            if (data) {
                let badge = data.status === 'ตรวจแล้ว' ? 'bg-success' : data.status === 'รอตรวจ' ? 'bg-warning text-dark' : 'bg-secondary';
                tbHtml += `<td class="text-center"><span class="badge ${badge}">${data.score}</span><div class="small text-muted" style="font-size:0.6rem;">${data.status}</div></td>`;
            } else {
                tbHtml += `<td class="text-center text-muted">-</td>`;
            }
        });

        speakerList.forEach(s => {
            let sid = s['spk_id'];
            let done = surveyMap[pid] && surveyMap[pid][sid];
            tbHtml += `<td class="text-center">${done ? '<span class="text-success fw-bold fs-5">✔️</span>' : '❌'}</td>`;
        });

        tbHtml += `</tr>`;
    });

    if (tbHtml === '') {
        let colSpan = 3 + assignments.length + speakerList.length;
        tbHtml = `<tr><td colspan="${colSpan}" class="text-center py-4 text-muted">ยังไม่มีข้อมูลผู้อบรมในระบบ</td></tr>`;
    }
    document.getElementById('taskEvalTbody').innerHTML = tbHtml;
}

// ============================================================
// 📋 PHASE 2: ระบบประมวลผลการประเมิน (Survey Analysis) - ULTIMATE FIX
// ============================================================

let globalEvalData = null;

function getRatingMeaning(mean) {
    if (mean >= 4.50) return "มากที่สุด";
    if (mean >= 3.50) return "มาก";
    if (mean >= 2.50) return "ปานกลาง";
    if (mean >= 1.50) return "น้อย";
    return "น้อยที่สุด";
}

// 🌟 ฟังก์ชันดึงข้อมูลหลัก (ถูกเรียกเมื่อสลับแท็บ หรือเมื่อเปลี่ยน Dropdown)
async function fetchEvaluationSummary() {
    const container = document.getElementById('evalReportContent');
    // ถ้ามีข้อมูลแล้ว ไม่ต้องโหลดซ้ำ (ป้องกันการกระตุก)
    if (globalEvalData) {
        renderEvaluationReport();
        return;
    }
    
    if (container) container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success"></div><div class="mt-2 text-muted">กำลังดึงข้อมูลประเมินจากฐานข้อมูล...</div></div>';
    
    try {
        const res = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getEvaluationDashboardData' })
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            globalEvalData = result; 
            renderEvaluationReport(); // วาดหน้าจอทันทีเมื่อโหลดเสร็จ
        } else {
            if (container) container.innerHTML = `<div class="text-danger text-center py-5">เกิดข้อผิดพลาด: ${result.message}</div>`;
        }
    } catch(e) {
        if (container) container.innerHTML = `<div class="text-danger text-center py-5">การเชื่อมต่อขัดข้อง กรุณาลองรีเฟรชหน้าเว็บ</div>`;
    }
}

// 🌟 ฟังก์ชันวาดตารางและคำนวณสถิติ
function renderEvaluationReport() {
    if (!globalEvalData) return;

    let evalType = document.getElementById('evalTypeSelector').value;
    let speakerSelect = document.getElementById('evalSpeakerSelector');
    let contentArea = document.getElementById('evalReportContent');
    
    // --- 1. จัดการ Dropdown วิทยากร ---
    if (evalType === 'SPEAKER_SURVEY') {
        speakerSelect.classList.remove('d-none');
        let currentSpkVal = speakerSelect.value;
        
        let spkHtml = '';
        globalEvalData.speakers.forEach(spk => {
            let keys = Object.keys(spk);
            let spkId = spk.id || spk.spk_id || spk['รหัส'] || spk[keys[0]];
            let spkName = spk.name || spk.spk_name || spk['ชื่อวิทยากร'] || spk[keys[1]];
            let spkTopic = spk.topic || spk.spk_topic || spk['หัวข้อบรรยาย'] || spk[keys[2]];
            
            if (spkId && spkName) {
                let displayText = spkTopic ? `${spkName} (${spkTopic})` : spkName;
                spkHtml += `<option value="${spkId}">🎤 ${displayText}</option>`;
            }
        });
        speakerSelect.innerHTML = spkHtml || `<option value="">ไม่มีข้อมูลวิทยากร</option>`;
        
        if (currentSpkVal && speakerSelect.querySelector(`option[value="${currentSpkVal}"]`)) {
            speakerSelect.value = currentSpkVal;
        }
    } else {
        speakerSelect.classList.add('d-none');
    }

    // --- 2. กรองข้อมูลตามที่เลือก ---
    let targetId = evalType === 'PROJECT_SURVEY' ? 'PROJECT' : speakerSelect.value;
    const targetSurveys = globalEvalData.surveys ? globalEvalData.surveys.filter(s => s.targetId === targetId || s.target_id === targetId) : [];
    const totalN = targetSurveys.length;

    if(totalN === 0) {
        contentArea.innerHTML = `<div class="alert alert-warning text-center py-4 shadow-sm border-0"><i class="bi bi-info-circle"></i> ยังไม่มีผู้ตอบแบบประเมินในหัวข้อนี้ครับ</div>`;
        return;
    }

    // แปลง String เป็น JSON Object
    let parsedSurveys = targetSurveys.map(s => {
       let ansObj = {};
       if (s.answers && typeof s.answers === 'object') ansObj = s.answers;
       else if (s.answers && typeof s.answers === 'string') { try { ansObj = JSON.parse(s.answers); } catch(e){} }
       else if (s.answers_json) { try { ansObj = JSON.parse(s.answers_json); } catch(e){} }
       return { ...s, parsedAnswers: ansObj };
    });

    // --- 3. ดึงและกรองคำถาม ---
    let targetQuestions = [];
    for (let qId in globalEvalData.questions) { 
        let qData = globalEvalData.questions[qId];
        let qType = qData.type || qData.q_type || qData['ประเภท (Pre/Post/Survey)'];
        
        if (qType === evalType) {
            let cat = qData.category || qData.q_category || qData['หมวดหมู่'];
            let txt = qData.text || qData.question || qData['คำถาม'];
            let opts = [qData.opt_a || qData['ตัวเลือก A'], qData.opt_b || qData['ตัวเลือก B'], qData.opt_c || qData['ตัวเลือก C'], qData.opt_d || qData['ตัวเลือก D'], qData.opt_e || qData['ตัวเลือก E']].filter(o=>o);
            
            let inputType = qData.inputType || qData.input_type || 'CHOICE';
            if(!qData.inputType && !qData.input_type) {
                if(opts[0] === 'TEXT') inputType = 'TEXT';
                else if(opts.length > 0 && opts.every(o => !isNaN(o))) inputType = 'RATING';
            }
            let options = qData.options || opts.filter(o => o !== 'TEXT');
            targetQuestions.push({ q_id: qId, category: cat, text: txt, inputType: inputType, options: options }); 
        }
    }

    let categories = [...new Set(targetQuestions.map(q => q.category))];
    let html = `<div class="alert alert-info border-info text-dark shadow-sm mb-4"><i class="bi bi-people-fill me-2"></i>จำนวนผู้ตอบแบบประเมินทั้งหมด: <b>${totalN}</b> คน</div>`;

    // =====================================
    // ตอนที่ 1: ข้อมูลพื้นฐาน (CHOICE)
    // =====================================
    let choiceCategories = categories.filter(cat => targetQuestions.some(q => q.category === cat && q.inputType === 'CHOICE'));
    if (choiceCategories.length > 0) {
        html += `<h6 class="fw-bold text-dark mt-4 mb-3">1. ข้อมูลทั่วไป (ข้อมูลพื้นฐาน)</h6>`;
        choiceCategories.forEach(cat => {
            let choiceQs = targetQuestions.filter(q => q.category === cat && q.inputType === 'CHOICE');
            html += `<div class="table-responsive bg-white rounded-3 border mb-4">
                <table class="table table-bordered align-middle small mb-0">
                    <thead class="table-light text-center">
                        <tr><th class="text-start ps-4">รายการประเมิน</th><th style="width: 15%;">จำนวน (คน)</th><th style="width: 15%;">ร้อยละ (%)</th></tr>
                    </thead><tbody>`;
            
            choiceQs.forEach(q => {
                html += `<tr class="table-secondary"><td colspan="3" class="fw-bold text-primary ps-4">${q.text}</td></tr>`;
                let counts = {}; 
                if(q.options) q.options.forEach(opt => counts[opt] = 0);
                
                parsedSurveys.forEach(s => { 
                    const ans = s.parsedAnswers[q.q_id]; 
                    if (ans) counts[ans] = (counts[ans] || 0) + 1; 
                });
                
                if(q.options) {
                    q.options.forEach(opt => {
                        let c = counts[opt] || 0; 
                        let pct = totalN > 0 ? ((c / totalN) * 100).toFixed(2) : 0;
                        html += `<tr><td class="ps-5 text-muted"><i class="bi bi-caret-right-fill text-secondary" style="font-size:0.7rem;"></i> ${opt}</td><td class="text-center fw-bold">${c}</td><td class="text-center">${pct}%</td></tr>`;
                    });
                }
            });
            html += `</tbody></table></div>`;
        });
    }

    // =====================================
    // ตอนที่ 2: ความพึงพอใจ (RATING) - สถิติ x̄ และ S.D.
    // =====================================
    let ratingCategories = categories.filter(cat => targetQuestions.some(q => q.category === cat && q.inputType === 'RATING'));
    if (ratingCategories.length > 0) {
        html += `<h6 class="fw-bold text-dark mt-4 mb-3">2. ข้อมูลความพึงพอใจ (เชิงปริมาณ)</h6>`;
        html += `<div class="table-responsive bg-white rounded-3 border mb-4">
            <table class="table table-hover table-bordered align-middle small mb-0" id="exportEvalTable">
                <thead class="table-light text-center">
                    <tr><th style="width: 5%;">ข้อที่</th><th class="text-start" style="width: 55%;">รายการประเมิน</th><th style="width: 10%;">ค่าเฉลี่ย (x̄)</th><th style="width: 10%;">S.D.</th><th style="width: 20%;">แปลผล</th></tr>
                </thead><tbody>`;
        
        let allRatingScores = [];
        ratingCategories.forEach(cat => {
            let ratingQs = targetQuestions.filter(q => q.category === cat && q.inputType === 'RATING');
            html += `<tr class="table-secondary"><td colspan="5" class="fw-bold text-success text-start ps-3"><i class="bi bi-folder2-open"></i> ${cat}</td></tr>`;
            
            let catScores = [];
            ratingQs.forEach((q, idx) => {
                let scores = [];
                parsedSurveys.forEach(s => { 
                    let val = parseFloat(s.parsedAnswers[q.q_id]); 
                    if(!isNaN(val)) { scores.push(val); catScores.push(val); allRatingScores.push(val); } 
                });
                
                let mean = 0, sd = 0; const count = scores.length;
                if(count > 0) { 
                    mean = scores.reduce((a,b)=>a+b, 0) / count; 
                    let variance = 0; 
                    if(count > 1) variance = scores.reduce((a,b)=>a+Math.pow(b-mean, 2), 0) / (count-1); 
                    sd = Math.sqrt(variance); 
                }

                html += `<tr>
                    <td class="text-center">${idx + 1}</td>
                    <td class="text-start ps-4">${q.text}</td>
                    <td class="text-center fw-bold text-primary">${count > 0 ? mean.toFixed(2) : '-'}</td>
                    <td class="text-center text-muted">${count > 0 ? sd.toFixed(2) : '-'}</td>
                    <td class="text-center"><span class="badge ${mean >= 3.5 ? 'bg-success' : 'bg-warning text-dark'}">${count > 0 ? getRatingMeaning(mean) : '-'}</span></td>
                </tr>`;
            });
            
            const catCount = catScores.length; let catMean = 0, catSd = 0;
            if(catCount > 0) { 
                catMean = catScores.reduce((a,b)=>a+b, 0) / catCount; 
                let catVariance = 0; 
                if(catCount > 1) catVariance = catScores.reduce((a,b)=>a+Math.pow(b-catMean, 2), 0) / (catCount-1); 
                catSd = Math.sqrt(catVariance); 
            }
            html += `<tr class="table-info fw-bold">
                <td colspan="2" class="text-end pe-4 text-info-emphasis">สรุปผล ${cat}</td>
                <td class="text-center text-primary">${catCount > 0 ? catMean.toFixed(2) : '-'}</td>
                <td class="text-center text-muted">${catCount > 0 ? catSd.toFixed(2) : '-'}</td>
                <td class="text-center"><span class="badge ${catMean >= 3.5 ? 'bg-info text-dark' : 'bg-warning text-dark'} shadow-sm">${catCount > 0 ? getRatingMeaning(catMean) : '-'}</span></td>
            </tr>`;
        });
        
        const allCount = allRatingScores.length; let allMean = 0, allSd = 0;
        if(allCount > 0) { 
            allMean = allRatingScores.reduce((a,b)=>a+b, 0) / allCount; 
            let allVariance = 0; 
            if(allCount > 1) allVariance = allRatingScores.reduce((a,b)=>a+Math.pow(b-allMean, 2), 0) / (allCount-1); 
            allSd = Math.sqrt(allVariance); 
        }
        html += `<tr class="table-primary fw-bold" style="border-top: 2px solid #0d6efd;">
            <td colspan="2" class="text-end pe-4 text-primary">สรุปรวมทุกด้าน</td>
            <td class="text-center text-primary fs-6">${allCount > 0 ? allMean.toFixed(2) : '-'}</td>
            <td class="text-center text-muted fs-6">${allCount > 0 ? allSd.toFixed(2) : '-'}</td>
            <td class="text-center"><span class="badge ${allMean >= 3.5 ? 'bg-primary' : 'bg-warning text-dark'} fs-6 shadow-sm">${allCount > 0 ? getRatingMeaning(allMean) : '-'}</span></td>
        </tr>`;
        html += `</tbody></table></div>`;
    }

    // =====================================
    // ตอนที่ 3: ข้อเสนอแนะปลายเปิด (TEXT)
    // =====================================
    let textCategories = categories.filter(cat => targetQuestions.some(q => q.category === cat && q.inputType === 'TEXT'));
    if (textCategories.length > 0) {
        html += `<h6 class="fw-bold text-dark mt-4 mb-3">3. ข้อมูลเชิงคุณภาพ (ข้อเสนอแนะปลายเปิด)</h6>`;
        let textResponses = [];
        textCategories.forEach(cat => {
            let textQs = targetQuestions.filter(q => q.category === cat && q.inputType === 'TEXT');
            textQs.forEach(q => {
                let texts = []; 
                parsedSurveys.forEach(s => { 
                    const ans = s.parsedAnswers[q.q_id]; 
                    if(ans && ans.trim() !== '') texts.push(ans.trim()); 
                });
                textResponses.push({ question: q.text, answers: texts });
            });
        });
        
        html += `<div class="accordion" id="textAccordion">`;
        textResponses.forEach((tr, i) => {
            const collapseId = `collapse-text-${i}`;
            html += `<div class="accordion-item border-0 shadow-sm rounded-4 mb-3 overflow-hidden"><h2 class="accordion-header" id="heading-${collapseId}"><button class="accordion-button bg-light fw-bold text-dark" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="true" aria-controls="${collapseId}">${i+1}. ${tr.question}</button></h2><div id="${collapseId}" class="accordion-collapse collapse show" aria-labelledby="heading-${collapseId}"><div class="accordion-body p-0"><ul class="list-group list-group-flush">`;
            if(tr.answers.length === 0) { html += `<li class="list-group-item text-muted text-center small py-3">- ไม่มีผู้ให้ข้อเสนอแนะ -</li>`; } 
            else { tr.answers.forEach(ans => { html += `<li class="list-group-item small px-4"><i class="bi bi-arrow-right-short text-success fs-5"></i> ${ans}</li>`; }); }
            html += `</ul></div></div></div>`;
        });
        html += `</div>`;
    }

    contentArea.innerHTML = html;
}

// 🌟🌟 ระบบดักจับการคลิกแท็บแบบครอบจักรวาล (ULTIMATE TAB LISTENER) 🌟🌟
// ไม่ว่าปุ่มแท็บของพี่จะใช้ ID หรือ Class อะไร ถ้ามันคลิกแล้วโชว์ตารางประเมิน มันจะโหลดข้อมูลทันที!
document.addEventListener('DOMContentLoaded', () => {
    // ดักจับการคลิกทุกอย่างในหน้าเว็บ
    document.body.addEventListener('click', function(e) {
        // เช็คว่าปุ่มที่กด เกี่ยวข้องกับคำว่า "ประเมิน" (evaluation) หรือไม่
        if (e.target.closest('[data-bs-target="#evaluation"]') || 
            e.target.closest('#evaluation-tab') || 
            (e.target.innerText && e.target.innerText.includes('ผลประเมินวิทยากร/โครงการ'))) {
            
            // ถ้ายังไม่มีข้อมูล หรือข้อมูลว่างเปล่า ให้โหลดใหม่
            if (!globalEvalData) {
                fetchEvaluationSummary();
            } else {
                // ถ้ามีข้อมูลอยู่แล้ว ก็แค่วาดหน้าจอใหม่ (เพื่อความรวดเร็ว)
                renderEvaluationReport();
            }
        }
    });

    // ดักจับเพิ่มเติม: กรณีที่หน้าโหลดมาแล้ว แท็บนี้ถูกเปิดอยู่ก่อนแล้ว (เช่น กดรีเฟรชหน้า)
    let evalTab = document.getElementById('evaluation');
    if (evalTab && evalTab.classList.contains('active')) {
        fetchEvaluationSummary();
    }
});

// ============================================================
// 💾 EXPORT TO EXCEL (แยกชีตตามหมวดหมู่และชื่อวิทยากร)
// ============================================================
// ============================================================
// Export แยกตามประเภทรายงาน
// ============================================================
function exportReportSheet(type) {
    let today = new Date().toISOString().split('T')[0];
    try {
        let wb = XLSX.utils.book_new();

        if (type === 'summary') {
            // สถิติผลคะแนน
            let statTable = document.getElementById('exportStatTable');
            if (statTable) { XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(statTable), "สถิติผลคะแนน"); }
            // ข้อมูลสรุปรายบุคคล
            let userTable = document.getElementById('exportUserTable');
            if (userTable) { XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(userTable), "ข้อมูลสรุปรายบุคคล"); }
            if (wb.SheetNames.length === 0) { Swal.fire('ไม่มีข้อมูล', 'กรุณาโหลดรายงานก่อน Export', 'warning'); return; }
            XLSX.writeFile(wb, `TMS_สถิติ_${today}.xlsx`);

        } else if (type === 'attendance') {
            let attTable = document.getElementById('exportAttendanceTable');
            if (!attTable || attTable.querySelector('tbody').children.length === 0) { Swal.fire('ไม่มีข้อมูล', 'กรุณาเปิดแท็บ สถิติการลงเวลา ก่อน', 'warning'); return; }
            let attSearch = document.getElementById('attSearchInput');
            let prev = attSearch ? attSearch.value : '';
            if (attSearch) { attSearch.value = ''; renderAttendanceTab(); }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(document.getElementById('exportAttendanceTable')), "สถิติการลงเวลา");
            if (attSearch) { attSearch.value = prev; renderAttendanceTab(); }
            XLSX.writeFile(wb, `TMS_ลงเวลา_${today}.xlsx`);

        } else if (type === 'taskeval') {
            let taskTable = document.getElementById('exportTaskEvalTable');
            if (!taskTable || taskTable.querySelector('tbody').children.length === 0) { Swal.fire('ไม่มีข้อมูล', 'กรุณาเปิดแท็บ ภาระงานและประเมิน ก่อน', 'warning'); return; }
            let searchInput = document.getElementById('taskEvalSearchInput');
            let prev = searchInput ? searchInput.value : '';
            if (searchInput) { searchInput.value = ''; renderTaskEvalTab(); }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(document.getElementById('exportTaskEvalTable')), "ภาระงานและประเมิน");
            if (searchInput) { searchInput.value = prev; renderTaskEvalTab(); }
            XLSX.writeFile(wb, `TMS_ภาระงาน_${today}.xlsx`);

        } else if (type === 'eval') {
            let evalTypeObj = document.getElementById('evalTypeSelector');
            let speakerObj = document.getElementById('evalSpeakerSelector');
            let sheetName = "ประเมินวิทยากร";
            if (evalTypeObj && evalTypeObj.value === 'PROJECT_SURVEY') {
                sheetName = "ประเมินโครงการ";
            } else if (speakerObj && !speakerObj.classList.contains('d-none')) {
                sheetName = speakerObj.options[speakerObj.selectedIndex].text.replace("🎤 ", "").substring(0, 31);
            }
            let contentArea = document.getElementById('evalReportContent');
            if (!contentArea || contentArea.querySelectorAll('table').length === 0) { Swal.fire('ไม่มีข้อมูล', 'กรุณาเลือกรายงานประเมินก่อน', 'warning'); return; }

            let ws = XLSX.utils.aoa_to_sheet([[`สรุปผล${sheetName}`], []]);
            contentArea.querySelectorAll('table').forEach(table => {
                let data = XLSX.utils.sheet_to_json(XLSX.utils.table_to_sheet(table), {header: 1});
                XLSX.utils.sheet_add_aoa(ws, data, {origin: -1});
                XLSX.utils.sheet_add_aoa(ws, [[]], {origin: -1});
            });
            let accordionEl = contentArea.querySelector('#textAccordion');
            if (accordionEl) {
                XLSX.utils.sheet_add_aoa(ws, [['3. ข้อมูลเชิงคุณภาพ (ข้อเสนอแนะปลายเปิด)']], {origin: -1});
                XLSX.utils.sheet_add_aoa(ws, [[]], {origin: -1});
                accordionEl.querySelectorAll('.accordion-item').forEach((item, idx) => {
                    let q = item.querySelector('.accordion-button');
                    XLSX.utils.sheet_add_aoa(ws, [[q ? q.innerText.trim() : `คำถาม ${idx+1}`]], {origin: -1});
                    let answers = item.querySelectorAll('.list-group-item:not(.text-muted)');
                    if (answers.length === 0) { XLSX.utils.sheet_add_aoa(ws, [['  - ไม่มีผู้ให้ข้อเสนอแนะ']], {origin: -1}); }
                    else { answers.forEach((ans, ai) => { XLSX.utils.sheet_add_aoa(ws, [[`  ${ai+1}. ${ans.innerText.replace(/^[▶→➤]\s*/, '').trim()}`]], {origin: -1}); }); }
                    XLSX.utils.sheet_add_aoa(ws, [[]], {origin: -1});
                });
            }
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `TMS_ประเมิน_${sheetName}_${today}.xlsx`);
        }

        Swal.fire({ icon: 'success', title: 'Export สำเร็จ', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error(e);
        Swal.fire('ผิดพลาด', 'ไม่สามารถสร้างไฟล์ได้: ' + e.message, 'error');
    }
}

function exportFullReportToExcel() {
    Swal.fire({
        title: 'กำลังสร้างไฟล์ Excel...',
        text: 'ระบบกำลังจัดระเบียบข้อมูลแยกตามชีต',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
    
    setTimeout(() => {
        try {
            // 1. สร้างสมุดงานใหม่ (Workbook)
            let wb = XLSX.utils.book_new();

            // --- ชีตที่ 1: สถิติผลคะแนน ---
            let statTable = document.getElementById('exportStatTable');
            if (statTable) {
                let ws1 = XLSX.utils.table_to_sheet(statTable);
                XLSX.utils.book_append_sheet(wb, ws1, "สถิติผลคะแนน");
            }

            // --- ชีตที่ 2: ข้อมูลสรุปรายบุคคล ---
            let userTable = document.getElementById('exportUserTable');
            if (userTable) {
                let ws2 = XLSX.utils.table_to_sheet(userTable);
                XLSX.utils.book_append_sheet(wb, ws2, "ข้อมูลสรุปรายบุคคล");
            }

            // --- ชีตที่ 3: รายงานความพึงพอใจ (ตั้งชื่อตามวิทยากร/โครงการ) ---
            let evalTypeObj = document.getElementById('evalTypeSelector');
            let speakerObj = document.getElementById('evalSpeakerSelector');
            let dynamicSheetName = "รายงานความพึงพอใจ"; // ชื่อเริ่มต้น
            
            if (evalTypeObj && evalTypeObj.value === 'PROJECT_SURVEY') {
                dynamicSheetName = "ประเมินโครงการ";
            } else if (speakerObj && !speakerObj.classList.contains('d-none')) {
                // ดึงชื่อวิทยากรมาตั้งชื่อชีต และตัดเครื่องหมาย 🎤 ออก
                // หมายเหตุ: Excel จำกัดชื่อชีตไม่เกิน 31 ตัวอักษร
                dynamicSheetName = speakerObj.options[speakerObj.selectedIndex].text
                                   .replace("🎤 ", "")
                                   .substring(0, 31); 
            }

            let contentArea = document.getElementById('evalReportContent');
            if (contentArea) {
                let tables = contentArea.querySelectorAll('table');
                let ws3 = XLSX.utils.aoa_to_sheet([[`สรุปผล${dynamicSheetName}`], []]);
                let hasData = false;

                // ตอนที่ 1 และ 2: ตาราง Rating
                if (tables.length > 0) {
                    tables.forEach(table => {
                        let tempSheet = XLSX.utils.table_to_sheet(table);
                        let tableData = XLSX.utils.sheet_to_json(tempSheet, {header: 1});
                        XLSX.utils.sheet_add_aoa(ws3, tableData, {origin: -1});
                        XLSX.utils.sheet_add_aoa(ws3, [[]], {origin: -1});
                    });
                    hasData = true;
                }

                // ตอนที่ 3: ข้อมูลเชิงคุณภาพ (ข้อเสนอแนะปลายเปิด) จาก accordion/list
                let accordionEl = contentArea.querySelector('#textAccordion');
                if (accordionEl) {
                    XLSX.utils.sheet_add_aoa(ws3, [['3. ข้อมูลเชิงคุณภาพ (ข้อเสนอแนะปลายเปิด)']], {origin: -1});
                    XLSX.utils.sheet_add_aoa(ws3, [[]], {origin: -1});
                    let items = accordionEl.querySelectorAll('.accordion-item');
                    items.forEach((item, idx) => {
                        let questionEl = item.querySelector('.accordion-button');
                        let question = questionEl ? questionEl.innerText.trim() : `คำถาม ${idx+1}`;
                        XLSX.utils.sheet_add_aoa(ws3, [[question]], {origin: -1});
                        let answers = item.querySelectorAll('.list-group-item:not(.text-muted)');
                        if (answers.length === 0) {
                            XLSX.utils.sheet_add_aoa(ws3, [['  - ไม่มีผู้ให้ข้อเสนอแนะ']], {origin: -1});
                        } else {
                            answers.forEach((ans, aIdx) => {
                                // ลบ icon ออก ดึงเฉพาะข้อความ
                                let text = ans.innerText.replace(/^[▶→➤]\s*/, '').trim();
                                XLSX.utils.sheet_add_aoa(ws3, [[`  ${aIdx+1}. ${text}`]], {origin: -1});
                            });
                        }
                        XLSX.utils.sheet_add_aoa(ws3, [[]], {origin: -1});
                    });
                    hasData = true;
                }

                if (hasData) {
                    XLSX.utils.book_append_sheet(wb, ws3, dynamicSheetName);
                }
            }

            // --- ชีตที่ 4: สถิติการลงเวลา ---
            let attTable = document.getElementById('exportAttendanceTable');
            if (attTable && attTable.querySelector('tbody').children.length > 0) {
                let attSearch = document.getElementById('attSearchInput');
                let prevAttSearch = attSearch ? attSearch.value : '';
                if (attSearch) { attSearch.value = ''; renderAttendanceTab(); }
                let wsAtt = XLSX.utils.table_to_sheet(document.getElementById('exportAttendanceTable'));
                XLSX.utils.book_append_sheet(wb, wsAtt, "สถิติการลงเวลา");
                if (attSearch) { attSearch.value = prevAttSearch; renderAttendanceTab(); }
            }

            // --- ชีตที่ 5: ภาระงานและประเมินวิทยากร ---
            let taskEvalTable = document.getElementById('exportTaskEvalTable');
            if (taskEvalTable && taskEvalTable.querySelector('tbody').children.length > 0) {
                // เคลียร์ค้นหาก่อน export เพื่อให้ได้ข้อมูลครบ
                let searchInput = document.getElementById('taskEvalSearchInput');
                let prevSearch = searchInput ? searchInput.value : '';
                if (searchInput) { searchInput.value = ''; renderTaskEvalTab(); }
                let ws4 = XLSX.utils.table_to_sheet(document.getElementById('exportTaskEvalTable'));
                XLSX.utils.book_append_sheet(wb, ws4, "ภาระงานและประเมิน");
                if (searchInput) { searchInput.value = prevSearch; renderTaskEvalTab(); }
            }

            // 2. สั่งบันทึกไฟล์ (ระบุชื่อไฟล์ตามวันที่ปัจจุบัน)
            let today = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `TMS_Report_Full_${today}.xlsx`);
            
            Swal.fire({
                icon: 'success',
                title: 'ส่งออกข้อมูลสำเร็จ',
                text: 'ไฟล์รายงานถูกแยกชีตเรียบร้อยแล้วครับ',
                timer: 2000,
                showConfirmButton: false
            });
            
        } catch (error) {
            console.error(error);
            Swal.fire('ผิดพลาด', 'ไม่สามารถสร้างไฟล์ Excel ได้: ' + error.message, 'error');
        }
    }, 1000);
}