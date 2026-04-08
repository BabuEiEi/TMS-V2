/**
 * PROJECT: TMS-V2
 * VERSION: 31.0 (Trainee View & Smart Survey Edition)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: เพิ่ม Smart Rendering Logic เพื่อวาดประเมินวิทยากรและโครงการได้อย่างแม่นยำ
 * RULE: ปฏิบัติตามกฎเหล็ก 6 ข้ออย่างเคร่งครัด (ห้ามยุบย่อ ห้ามลดบรรทัด)
 * [COMMENT: TAGS: #NAV_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC]
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// [COMMENT: ฟังก์ชันช่วยแปลงวันที่เป็นรูปแบบไทย]
function formatThaiDate(dateStr) {
    const months = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", 
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
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
// [#NAV_LOGIC]: การจัดการนำทางและสถานะ
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
        Swal.fire({
            icon: 'warning',
            title: 'แจ้งเตือน',
            text: 'กรุณากรอกรหัสประจำตัวก่อนครับ'
        });
        return;
    }
    
    localStorage.setItem("tms_personal_id", id);
    showDashboard();
    
    Swal.fire({ 
        icon: 'success', 
        title: 'สำเร็จ', 
        text: 'ยินดีต้อนรับเข้าสู่ระบบผู้เข้ารับการอบรม',
        timer: 1500, 
        showConfirmButton: false 
    });
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
// [#ATT_LOGIC]: ระบบลงเวลาอัจฉริยะ 
// ============================================================

async function openAttendanceForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("attendanceSection").classList.remove("d-none");
    
    let userId = localStorage.getItem("tms_personal_id");
    let btnContainer = document.getElementById("attendanceButtonsContainer");
    
    btnContainer.innerHTML = `
        <div class="text-center my-5">
            <div class="spinner-border text-info"></div>
            <p class="mt-2 text-muted">กำลังตรวจสอบสถานะรอบเวลาจากฐานข้อมูล...</p>
        </div>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'getAttendanceData', 
                payload: { personal_id: userId } 
            })
        });
        let result = await response.json();

        if (result.status === 'success') {
            renderAttendanceButtons(result.schedule, result.userLogs);
        }
    } catch (error) {
        btnContainer.innerHTML = `
            <div class="alert alert-danger text-center rounded-4 p-4 shadow-sm">
                ไม่สามารถดึงตารางเวลาได้ กรุณาตรวจสอบอินเทอร์เน็ตครับ
            </div>`;
    }
}

function renderAttendanceButtons(schedule, userLogs) {
    let btnContainer = document.getElementById("attendanceButtonsContainer");
    btnContainer.innerHTML = ''; 
    const now = new Date();

    if (!schedule || schedule.length === 0) {
        btnContainer.innerHTML = `
            <div class="alert alert-info text-center rounded-4 shadow-sm p-4">
                ไม่มีรอบการลงเวลาที่เปิดใช้งานในขณะนี้ครับ
            </div>`;
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
            let logTimeString = logTime.getHours().toString().padStart(2, '0') + ':' + 
                               logTime.getMinutes().toString().padStart(2, '0');
            
            let isLogLate = logTime > endDateTime;
            let lateMark = isLogLate ? ' <span class="text-danger">(สาย)</span>' : '';

            btnContainer.innerHTML += `
                <div class="card mb-3 p-4 bg-light border-0 rounded-4 text-center shadow-sm opacity-75">
                    <div class="fw-bold text-secondary mb-2" style="font-size: 1.1rem;">
                        ✔️ ${slot.slot_label} บันทึกสำเร็จ
                    </div>
                    <div class="text-dark fw-semibold">
                        ${baseDisplay} | <span class="text-primary">${logTimeString}</span>${lateMark}
                    </div>
                </div>`;
        } else {
            let isCurrentlyLate = now > endDateTime;
            let btnClass = isCurrentlyLate ? 'btn-warning text-dark' : 'btn-success text-white';
            let statusSuffix = isCurrentlyLate ? ' (สาย)' : '';
            let currentStatus = isCurrentlyLate ? 'สาย' : 'ตรงเวลา';

            btnContainer.innerHTML += `
                <button class="btn ${btnClass} w-100 mb-3 p-4 fw-bold rounded-4 shadow shadow-sm" 
                        onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', '${currentStatus}')">
                    <span style="font-size: 1.2rem;">📌 ลงเวลา: ${slot.slot_label}${statusSuffix}</span><br>
                    <small class="fw-normal" style="font-size: 0.95rem; opacity: 0.9;">${baseDisplay}</small>
                </button>`;
        }
    });
}

async function submitRealAttendance(day, slot, status) {
    const swalResult = await Swal.fire({
        title: 'หมายเหตุการลงเวลา',
        text: 'ระบุหมายเหตุเพิ่มเติม (ถ้ามี)',
        icon: 'question',
        input: 'text',
        inputPlaceholder: 'เช่น ลากิจ, ลาป่วย (เว้นว่างได้)',
        showCancelButton: true,
        confirmButtonText: 'บันทึกเวลา',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0dcaf0',
        cancelButtonColor: '#6c757d'
    });

    if (!swalResult.isConfirmed) {
        return;
    }

    let userNote = swalResult.value ? swalResult.value.trim() : "";
    let finalNote = userNote !== "" ? "[" + status + "] " + userNote : "[" + status + "]";

    Swal.fire({ 
        title: 'กำลังบันทึก...', 
        allowOutsideClick: false, 
        didOpen: () => { 
            Swal.showLoading(); 
        } 
    });

    let payload = {
        personal_id: localStorage.getItem("tms_personal_id"),
        day_no: day,
        time_slot: slot,
        note: finalNote
    };

    try {
        await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'submitAttendance', payload: payload }) 
        });
        
        openAttendanceForm();
        Swal.close();
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้งครับ', 'error');
    }
}


// ============================================================
// [#EXAM_LOGIC]: ระบบข้อสอบ
// ============================================================

document.addEventListener('visibilitychange', () => {
    if (isExamActive && document.visibilityState === 'hidden') {
        Swal.fire({
            icon: 'warning',
            title: 'คำเตือน: ห้ามสลับหน้าจอ!',
            text: 'ระบบได้บันทึกพฤติกรรมของท่านไว้แล้ว กรุณากลับมาทำข้อสอบให้เสร็จสิ้นครับ',
            confirmButtonColor: '#d33'
        });
    }
});

function saveExamDraft(questionId, selectedValue) {
    let userId = localStorage.getItem("tms_personal_id");
    let testType = globalExamData.activeExam.type;
    let draftKey = "tms_draft_" + userId + "_" + testType;
    
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

    contentArea.innerHTML = `
        <div class="text-center p-5">
            <div class="spinner-border text-warning"></div>
            <p class="mt-2 text-muted">กำลังเตรียมชุดข้อสอบล่าสุด...</p>
        </div>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'getExamData', 
                payload: { personal_id: localStorage.getItem("tms_personal_id") } 
            })
        });
        let result = await response.json();

        if (result.status === 'success') {
            globalExamData = result;
            
            // [อัปเดตภาษาไทย]
            let thaiTitle = '';
            if (result.activeExam.type === 'PRE') {
                thaiTitle = 'แบบทดสอบก่อนการอบรม (Pre-Test)';
            } else if (result.activeExam.type === 'POST') {
                thaiTitle = 'แบบทดสอบหลังการอบรม (Post-Test)';
            } else {
                thaiTitle = 'แบบทดสอบ ' + result.activeExam.type;
            }
            
            document.getElementById("examTitleLabel").innerText = thaiTitle;
            renderExamStartScreen(); 
        } else {
            contentArea.innerHTML = `
                <div class="alert alert-info text-center rounded-5 p-5 shadow-sm">
                    <h5 class="fw-bold">${result.message}</h5>
                    <p class="mb-0 text-muted small">โปรดรอการเปิดระบบจากผู้จัดอบรม</p>
                </div>`;
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
        contentArea.innerHTML = `
            <div class="alert alert-success text-center p-5 rounded-4 shadow-sm my-5">
                <h4 class="fw-bold mb-3">ท่านได้ทำแบบทดสอบ Pre-Test ไปแล้ว</h4>
                <button class="btn btn-secondary px-4 rounded-pill" onclick="backToDashboard('examSection')">กลับเมนูหลัก</button>
            </div>`;
        return;
    }

    if (exam.type === 'POST' && attempts >= 1) {
        let bestScorePercent = (bestScore / (qCount * 2)) * 100;
        
        if (bestScorePercent >= exam.passing_percent) {
            contentArea.innerHTML = `
                <div class="alert alert-success text-center p-5 rounded-4 shadow-sm my-5">
                    <h4 class="fw-bold mb-3">ท่านสอบผ่าน Post-Test แล้ว 🎉</h4>
                    <p class="fs-5">คะแนนสูงสุดที่ทำได้: <b class="text-success">${bestScore}</b> / ${qCount * 2} คะแนน</p>
                    <button class="btn btn-secondary px-4 rounded-pill mt-3" onclick="backToDashboard('examSection')">กลับเมนูหลัก</button>
                </div>`;
            return;
        } 
        else if (attempts >= 2) {
            contentArea.innerHTML = `
                <div class="alert alert-danger text-center p-5 rounded-4 shadow-sm my-5">
                    <h4 class="fw-bold mb-3">ท่านใช้สิทธิ์สอบ Post-Test ครบ 2 ครั้งแล้ว</h4>
                    <p class="fs-5">คะแนนสูงสุดที่ทำได้: <b class="text-danger">${bestScore}</b> / ${qCount * 2} คะแนน</p>
                    <button class="btn btn-secondary px-4 rounded-pill mt-3" onclick="backToDashboard('examSection')">กลับเมนูหลัก</button>
                </div>`;
            return;
        } 
        else {
            retakeMessage = `
                <div class="alert alert-warning mb-4 text-start shadow-sm rounded-4">
                    ⚠️ ท่านยังไม่ผ่านเกณฑ์ (${exam.passing_percent}%) ระบบให้สิทธิ์สอบซ่อม (ครั้งที่ 2)
                </div>`;
            btnLabel = 'เริ่มสอบซ่อม (ครั้งที่ 2)';
            btnColor = 'btn-warning text-dark';
        }
    }

    contentArea.innerHTML = `
        <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
            <h4 class="text-primary fw-bold mb-3">คุณพร้อมหรือไม่?</h4>
            ${retakeMessage}
            <p class="text-muted fs-5">แบบทดสอบนี้มีทั้งหมด <b class="text-dark">${qCount}</b> ข้อ (ข้อละ 2 คะแนน)</p>
            
            <div class="alert alert-info text-start small mx-auto" style="max-width: 450px;">
                <ul class="mb-0">
                    <li>⏱️ ระบบจะเริ่มจับเวลาทันทีที่กดปุ่ม</li>
                    <li>💾 มีระบบ <b>Auto-Save</b> กันเน็ตหลุด</li>
                    <li>🚫 <b>ห้ามสลับแท็บหรือสลับหน้าจอ</b> ระบบจะแจ้งเตือน</li>
                </ul>
            </div>
            
            <button class="btn btn-lg ${btnColor} mt-3 fw-bold px-5 rounded-pill shadow-sm" 
                    onclick="startExamTimer()">
                ${btnLabel}
            </button>
        </div>`;
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
    let testType = globalExamData.activeExam.type;
    let draftKey = "tms_draft_" + userId + "_" + testType;
    let draftData = JSON.parse(localStorage.getItem(draftKey) || "{}");
    
    globalExamData.questions.sort(() => {
        return Math.random() - 0.5;
    });

    globalExamData.questions.forEach((q, i) => {
        html += `
            <div class="card mb-4 p-5 border-0 shadow-sm rounded-4 bg-white border-start border-5 border-warning fade-in">
                <p class="fw-bold fs-5 mb-4">${i + 1}. ${q.question}</p>`;
        
        let optionsKeys = ['A', 'B', 'C', 'D'];
        optionsKeys.sort(() => {
            return Math.random() - 0.5;
        });

        optionsKeys.forEach((optKey, idx) => {
            let isChecked = draftData[q.id] === optKey ? "checked" : "";
            html += `
                <div class="form-check mb-3">
                    <input class="form-check-input border-secondary" type="radio" 
                           name="q_${q.id}" value="${optKey}" id="q_${q.id}_${optKey}" 
                           ${isChecked} 
                           onchange="saveExamDraft('${q.id}', '${optKey}')">
                    <label class="form-check-label w-100 ms-2" for="q_${q.id}_${optKey}" style="cursor:pointer;">
                        <b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[optKey]}
                    </label>
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
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'เหลือเวลาอีก 5 นาทีสุดท้าย!',
                showConfirmButton: false,
                timer: 5000
            });
        }
        
        if (--sec < 0) { 
            clearInterval(examCountdown); 
            Swal.fire({
                title: 'หมดเวลา!',
                text: 'ระบบกำลังดำเนินการส่งคำตอบให้อัตโนมัติ',
                icon: 'warning',
                allowOutsideClick: false
            }).then(() => {
                submitRealExam(true);
            }); 
        }
    }, 1000);
}

async function submitRealExam(isAuto = false) {
    if (!isAuto) {
        const confirm = await Swal.fire({ 
            title: 'ยืนยันการส่งคำตอบ?', 
            text: 'เมื่อส่งแล้วจะไม่สามารถแก้ไขได้อีกครับ',
            icon: 'question', 
            showCancelButton: true,
            confirmButtonText: 'ใช่, ส่งคำตอบ'
        });
        if (!confirm.isConfirmed) {
            return;
        }
    }

    isExamActive = false; 
    clearInterval(examCountdown);
    
    let score = 0;
    let maxScore = globalExamData.questions.length * 2; 

    globalExamData.questions.forEach(q => {
        let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (sel && sel.value === q.answer) {
            score += 2;
        }
    });

    Swal.fire({ title: 'กำลังบันทึกคะแนน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    let payload = {
        personal_id: localStorage.getItem("tms_personal_id"),
        test_type: globalExamData.activeExam.type,
        score: score,
        max_score: maxScore
    };

    try {
        await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'submitExam', payload: payload }) 
        });
        
        let userId = localStorage.getItem("tms_personal_id");
        localStorage.removeItem("tms_draft_" + userId + "_" + globalExamData.activeExam.type);
        
        let percentage = (score / maxScore) * 100;
        let passPercent = globalExamData.activeExam.passing_percent;
        
        if (globalExamData.activeExam.type === 'PRE') {
            Swal.fire({
                icon: 'info',
                title: 'บันทึกคะแนนพื้นฐานสำเร็จ!',
                text: `คุณทำคะแนนได้ ${score} คะแนน (ทดสอบก่อนเรียน)`,
                confirmButtonColor: '#0dcaf0'
            }).then(() => {
                backToDashboard('examSection');
            });
        } 
        else {
            if (percentage >= passPercent) {
                Swal.fire({
                    icon: 'success',
                    title: 'ผ่านเกณฑ์การประเมิน! 🎉',
                    text: `คุณทำได้ ${score}/${maxScore} คะแนน (${percentage.toFixed(2)}%)`,
                    confirmButtonColor: '#198754'
                }).then(() => {
                    backToDashboard('examSection');
                });
            } else {
                let currentAttempt = globalExamData.attempts + 1;
                if (currentAttempt < 2) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'ยังไม่ผ่านเกณฑ์',
                        text: `คุณทำได้ ${score}/${maxScore} คะแนน (${percentage.toFixed(2)}%)\n\nระบบให้สิทธิ์คุณสอบซ่อมได้อีก 1 ครั้งครับ`,
                        confirmButtonColor: '#ffc107'
                    }).then(() => {
                        backToDashboard('examSection');
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'ไม่ผ่านเกณฑ์ (ครบสิทธิ์ 2 ครั้ง)',
                        text: `คุณทำได้ ${score}/${maxScore} คะแนน (${percentage.toFixed(2)}%)`,
                        confirmButtonColor: '#dc3545'
                    }).then(() => {
                        backToDashboard('examSection');
                    });
                }
            }
        }
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ส่งคะแนนไม่สำเร็จ กรุณาแจ้งเจ้าหน้าที่', 'error');
    }
}


// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน (Smart Rendering Logic)
// ============================================================

async function openSurveyForm(type) {
    currentSurveyType = type;
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("surveySection").classList.remove("d-none");
    
    let contentArea = document.getElementById("surveyContentArea");
    
    // ตั้งชื่อให้ตรงกับเมนูที่กด
    document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
    
    contentArea.innerHTML = `
        <div class="text-center p-5 my-5">
            <div class="spinner-border text-success"></div>
            <p class="mt-2 text-muted">กำลังเตรียมข้อมูลแบบประเมิน...</p>
        </div>`;
    
    document.getElementById("btnSubmitSurvey").classList.add("d-none");

    try {
        let response = await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) 
        });
        globalSurveyData = await response.json();
        
        if (type === 'SPEAKER_SURVEY') { 
            renderSpeakerSelect(); 
            contentArea.innerHTML = `
                <div class="text-center text-muted p-5 bg-white rounded-5 border border-dashed shadow-sm">
                    กรุณาเลือกรายชื่อวิทยากรที่ช่องด้านบน เพื่อเริ่มทำแบบประเมินครับ
                </div>`;
        } else { 
            document.getElementById("speakerSelectionArea").classList.add("d-none");
            renderSurveyQuestions(); 
            document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
        }
    } catch (e) {
        contentArea.innerHTML = '<div class="alert alert-danger text-center">ดาวน์โหลดข้อมูลล้มเหลว</div>';
    }
}

// ดึงวิทยากรมาแสดงใน Dropdown (อิงจาก is_active = TRUE)
function renderSpeakerSelect() {
    let select = document.getElementById("speakerSelect");
    select.innerHTML = '<option value="" disabled selected>-- คลิกเพื่อเลือกวิทยากร --</option>';
    
    if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
        select.innerHTML = '<option value="" disabled selected>ไม่มีวิทยากรที่เปิดประเมินในขณะนี้</option>';
        return;
    }

    globalSurveyData.speakers.forEach(spk => {
        // นำหัวข้อ (topic) มาแสดงคู่กับชื่อ เพื่อให้คนประเมินเลือกง่ายขึ้น
        select.innerHTML += `<option value="${spk.id}">${spk.name} (หัวข้อ: ${spk.topic})</option>`;
    });
    
    document.getElementById("speakerSelectionArea").classList.remove("d-none");
    select.onchange = () => { 
        renderSurveyQuestions(); 
        document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
    };
}

// [COMMENT: UPDATE V31.0 - Smart Rendering ตรวจจับประเภทตัวเลือกอัตโนมัติ]
function renderSurveyQuestions() {
    let html = '';
    let grouped = {};
    
    globalSurveyData.questions.forEach(q => {
        if(!grouped[q.category]) {
            grouped[q.category] = [];
        }
        grouped[q.category].push(q);
    });

    Object.keys(grouped).forEach(cat => {
        html += `<h4 class="category-header">${cat}</h4>`;
            
        grouped[cat].forEach(q => {
            let optionsHtml = '';
            
            // เช็คว่าตัวเลือกทั้งหมดในข้อนี้ เป็นตัวเลข (เช่น 5, 4, 3, 2, 1) หรือไม่
            let isNumericRating = q.options.every(opt => !isNaN(opt) && opt.trim() !== "");
            
            // 🟢 แบบที่ 1: เป็นตัวเลข -> สร้างปุ่มวงกลมแนวนอน
            if (isNumericRating) {
                optionsHtml += `
                    <div class="horizontal-rating-wrapper">
                        <div class="horizontal-rating-container">`;
                
                // บังคับเรียงจาก 5 ไป 1 (มากไปน้อย)
                const sortedRatings = [...q.options].sort((a, b) => {
                    return b - a;
                });

                sortedRatings.forEach(opt => {
                    optionsHtml += `
                        <div class="rating-btn-item">
                            <input type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
                            <label class="rating-btn-label shadow-sm" for="sq_${q.id}_${opt}">
                                ${opt}
                            </label>
                        </div>`;
                });
                
                optionsHtml += `
                        </div>
                        <div class="rating-desc-text">
                            <span>มากที่สุด (5)</span>
                            <span>น้อยที่สุด (1)</span>
                        </div>
                    </div>`;
            } 
            // 🔵 แบบที่ 2: เป็นคำว่า TEXT -> สร้างกล่องข้อความ
            else if (q.options[0] === 'TEXT') {
                optionsHtml = `
                    <textarea class="form-control rounded-4 shadow-sm" 
                              name="sq_${q.id}" rows="3" 
                              placeholder="ระบุความคิดเห็นหรือข้อเสนอแนะเพิ่มเติม..."></textarea>`;
            }
            // 🟣 แบบที่ 3: เป็นข้อความทั่วไป (เช่น ชาย, หญิง) -> สร้าง Radio แนวดิ่ง
            else {
                q.options.forEach(opt => {
                    optionsHtml += `
                        <div class="form-check vertical-form-check">
                            <input class="form-check-input border-secondary shadow-sm" type="radio" 
                                   name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
                            <label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">
                                ${opt}
                            </label>
                        </div>`;
                });
            }

            html += `
                <div class="survey-card fade-in">
                    <div class="question-heading">${q.question}</div>
                    <div class="options-area">
                        ${optionsHtml}
                    </div>
                </div>`;
        });
    });
    document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
    let answers = {};
    let complete = true;
    
    globalSurveyData.questions.forEach(q => {
        let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || 
                  document.querySelector(`textarea[name="sq_${q.id}"]`);
        if (sel && sel.value.trim() !== "") {
            answers[q.id] = sel.value;
        } else {
            complete = false;
        }
    });

    if (!complete) { 
        Swal.fire({
            icon: 'warning',
            title: 'ข้อมูลไม่ครบ',
            text: 'กรุณาตอบแบบประเมินให้ครบทุกข้อก่อนส่งข้อมูลครับ'
        }); 
        return; 
    }
    
    let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : document.getElementById("speakerSelect").value;
    
    Swal.fire({ 
        title: 'กำลังบันทึกผล...', 
        allowOutsideClick: false, 
        didOpen: () => { 
            Swal.showLoading(); 
        }
    });
    
    try {
        let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
        
        let res = await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: action, 
                payload: { 
                    personal_id: localStorage.getItem("tms_personal_id"), 
                    answers: answers, 
                    target_id: target 
                } 
            }) 
        });
        let result = await res.json();
        
        if (result.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'บันทึกสำเร็จ',
                text: 'ขอบคุณสำหรับข้อมูลประเมินที่มีคุณค่าครับ'
            }).then(() => {
                backToDashboard('surveySection');
            });
        }
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อระบบได้ในขณะนี้', 'error');
    }
}