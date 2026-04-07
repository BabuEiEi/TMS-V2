/**
 * PROJECT: TMS-V2
 * VERSION: 24.1 (Complete & Smart Time Edition)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: รวมฟีเจอร์ Smart Time (เช็คสาย) โดยรักษาบรรทัดเดิมของ Exam และ Survey ไว้ครบ 100%
 * RULE: ปฏิบัติตามกฎเหล็ก 6 ข้อ (ห้ามยุบย่อ ห้ามลดบรรทัด)
 * [COMMENT: TAGS FOR SEARCH: #NAV_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC]
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// [COMMENT: ฟังก์ชันช่วยแปลงวันที่เป็นรูปแบบไทย สำหรับระบบลงเวลา]
function formatThaiDate(dateStr) {
    const months = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", 
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    const dateObj = new Date(dateStr);
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear() + 543;
    
    return day + " " + month + " " + year;
}

// ============================================================
// [#NAV_LOGIC]: การจัดการนำทางและสถานะระบบ (คงเดิมทุกบรรทัด)
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
        title: 'เข้าสู่ระบบสำเร็จ', 
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
// [#ATT_LOGIC]: ระบบลงเวลาอัจฉริยะ (Update V24.1: ระบุวันที่/เวลา/เช็คสาย)
// ============================================================

async function openAttendanceForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("attendanceSection").classList.remove("d-none");
    
    let userId = localStorage.getItem("tms_personal_id");
    let btnContainer = document.getElementById("attendanceButtonsContainer");
    
    btnContainer.innerHTML = `
        <div class="text-center my-4">
            <div class="spinner-border text-info"></div>
            <p class="mt-2 text-muted">กำลังตรวจสอบสถานะการลงเวลา...</p>
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
        btnContainer.innerHTML = '<div class="alert alert-danger text-center">ขาดการเชื่อมต่อ</div>';
    }
}

function renderAttendanceButtons(schedule, userLogs) {
    let btnContainer = document.getElementById("attendanceButtonsContainer");
    btnContainer.innerHTML = ''; 
    const now = new Date();

    schedule.forEach(slot => {
        let key = slot.day_no + '_' + slot.slot_id;
        let loggedData = userLogs[key]; // Timestamp จาก DB
        
        let thaiDate = formatThaiDate(slot.date);
        let timeRange = "(" + slot.start_time + " - " + slot.end_time + ")";
        let baseDisplay = "วันที่ " + slot.day_no + " | " + thaiDate + " " + timeRange;
        
        // ตรวจสอบเวลาสิ้นสุดเพื่อเช็ค "สาย"
        let endDateTime = new Date(slot.date + "T" + slot.end_time + ":00");

        if (loggedData) {
            // 🟢 กรณีที่ 1: ลงเวลาแล้ว (แสดงสีเทาพรีเมียมตาม V20)
            let logTime = new Date(loggedData);
            let logTimeString = logTime.getHours().toString().padStart(2, '0') + ':' + logTime.getMinutes().toString().padStart(2, '0');
            
            // เช็คว่าตอนที่ลงจริงนั้น "สาย" หรือไม่
            let isLogLate = logTime > endDateTime;
            let lateStatus = isLogLate ? ' <span class="text-danger">(สาย)</span>' : '';

            btnContainer.innerHTML += `
                <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center shadow-sm opacity-75">
                    <div class="fw-bold text-secondary">
                        ${baseDisplay} | ${logTimeString}${lateStatus}
                    </div>
                    <small class="text-muted">บันทึกข้อมูลเรียบร้อยแล้ว</small>
                </div>`;
        } else {
            // 🟡 กรณีที่ 2: ยังไม่ได้ลงเวลา (เช็คสีปุ่มปัจจุบัน เขียว/เหลือง)
            let isCurrentlyLate = now > endDateTime;
            let btnClass = isCurrentlyLate ? 'btn-warning text-dark' : 'btn-success';
            let lateLabel = isCurrentlyLate ? ' (สาย)' : '';

            btnContainer.innerHTML += `
                <button class="btn ${btnClass} w-100 mb-3 py-3 fw-bold rounded-4 shadow-sm" 
                        onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', '${isCurrentlyLate ? 'สาย' : 'ตรงเวลา'}')">
                    📌 ลงเวลา: ${slot.slot_label}${lateLabel}<br>
                    <small class="fw-normal opacity-75">${baseDisplay}</small>
                </button>`;
        }
    });
}

async function submitRealAttendance(day, slot, status) {
    Swal.fire({ 
        title: 'กำลังบันทึกเวลา...', 
        allowOutsideClick: false, 
        didOpen: () => { 
            Swal.showLoading(); 
        } 
    });

    let payload = {
        personal_id: localStorage.getItem("tms_personal_id"),
        day_no: day,
        time_slot: slot,
        note: "[" + status + "]"
    };

    try {
        await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'submitAttendance', payload: payload }) 
        });
        
        openAttendanceForm();
        Swal.close();
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกได้', 'error');
    }
}


// ============================================================
// [#EXAM_LOGIC]: ระบบข้อสอบและหน้าเตรียมพร้อม (คงเดิมทุกบรรทัดจาก V20)
// ============================================================

async function openExamForm() {
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("examSection").classList.remove("d-none");
    
    let contentArea = document.getElementById("examContentArea");
    contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-warning"></div></div>';

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
            document.getElementById("examTitleLabel").innerText = result.activeExam.type + " TEST";
            renderExamStartScreen();
        } else {
            contentArea.innerHTML = `<div class="alert alert-info text-center rounded-4 p-5">${result.message}</div>`;
        }
    } catch (error) {
        contentArea.innerHTML = '<div class="alert alert-danger text-center">โหลดไม่สำเร็จ</div>';
    }
}

function renderExamStartScreen() {
    let qCount = globalExamData.questions.length;
    
    document.getElementById("examContentArea").innerHTML = `
        <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
            <h4 class="text-primary fw-bold mb-3">คุณพร้อมที่จะทำแบบทดสอบหรือไม่?</h4>
            <p class="text-muted fs-5">จำนวนข้อสอบทั้งหมด <b class="text-dark">${qCount}</b> ข้อ</p>
            <button class="btn btn-lg btn-success mt-3 fw-bold px-5 rounded-pill shadow-sm" 
                    onclick="startExamTimer()">
                เริ่มทำแบบทดสอบเดี๋ยวนี้
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
    
    globalExamData.questions.forEach((q, i) => {
        html += `
            <div class="card mb-4 p-4 border rounded-4 bg-white shadow-sm">
                <p class="fw-bold fs-5 mb-3">${i + 1}. ${q.question}</p>`;
        
        ['A','B','C','D'].forEach((opt, idx) => {
            html += `
                <div class="form-check mb-2">
                    <input class="form-check-input border-secondary" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}">
                    <label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;">
                        <b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[opt]}
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
        
        if (--sec < 0) { 
            clearInterval(examCountdown); 
            submitRealExam(true);
        }
    }, 1000);
}

async function submitRealExam(isAuto = false) {
    if (!isAuto) {
        const confirm = await Swal.fire({ title: 'ยืนยันการส่งคำตอบ?', icon: 'question', showCancelButton: true });
        if (!confirm.isConfirmed) {
            return;
        }
    }

    isExamActive = false; 
    clearInterval(examCountdown);
    
    let score = 0;
    globalExamData.questions.forEach(q => {
        let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (sel && sel.value === q.answer) {
            score += 2;
        }
    });

    let payload = {
        personal_id: localStorage.getItem("tms_personal_id"),
        test_type: globalExamData.activeExam.type,
        score: score,
        max_score: globalExamData.questions.length * 2
    };

    try {
        await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: payload }) });
        Swal.fire('สำเร็จ', `คะแนนคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ส่งไม่ได้', 'error');
    }
}


// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน (คงเดิมทุกบรรทัดจาก V20)
// ============================================================

async function openSurveyForm(type) {
    currentSurveyType = type;
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("surveySection").classList.remove("d-none");
    
    let contentArea = document.getElementById("surveyContentArea");
    document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
    
    contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div></div>';
    document.getElementById("btnSubmitSurvey").classList.add("d-none");

    try {
        let response = await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) 
        });
        globalSurveyData = await response.json();
        
        if (type === 'SPEAKER_SURVEY') { 
            renderSpeakerSelect(); 
        } else { 
            document.getElementById("speakerSelectionArea").classList.add("d-none");
            renderSurveyQuestions(); 
            document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
        }
    } catch (e) {
        contentArea.innerHTML = '<div class="alert alert-danger text-center">โหลดไม่สำเร็จ</div>';
    }
}

function renderSpeakerSelect() {
    let select = document.getElementById("speakerSelect");
    select.innerHTML = '<option value="" disabled selected>-- คลิกเพื่อเลือกวิทยากร --</option>';
    
    globalSurveyData.speakers.forEach(spk => {
        select.innerHTML += `<option value="${spk.id}">${spk.name}</option>`;
    });
    
    document.getElementById("speakerSelectionArea").classList.remove("d-none");
    select.onchange = () => { 
        renderSurveyQuestions(); 
        document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
    };
}

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
        html += `<h6 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2 border-3">${cat}</h6>`;
            
        grouped[cat].forEach(q => {
            let optsHtml = '';
            
            if (q.options[0] === 'TEXT') {
                optsHtml = `<textarea class="form-control" name="sq_${q.id}" rows="3" placeholder="ระบุความคิดเห็น..."></textarea>`;
            } 
            else {
                optsHtml += `
                    <div class="horizontal-rating-wrapper">
                        <div class="horizontal-rating-container">`;
                        
                q.options.forEach(opt => {
                    optsHtml += `
                        <div class="rating-btn-item">
                            <input type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
                            <label class="rating-btn-label shadow-sm" for="sq_${q.id}_${opt}">
                                ${opt}
                            </label>
                        </div>`;
                });
                
                optsHtml += `
                        </div>
                        <div class="rating-desc-text">
                            <span>มากที่สุด (5)</span>
                            <span>น้อยที่สุด (1)</span>
                        </div>
                    </div>`;
            }
            
            html += `
                <div class="card p-4 mb-3 border-0 shadow-sm rounded-4 border-start border-4 border-info fade-in">
                    <p class="fw-bold mb-2 fs-5 text-dark">${q.question}</p>
                    ${optsHtml}
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
        if (sel && sel.value !== "") {
            answers[q.id] = sel.value;
        } else {
            complete = false;
        }
    });

    if (!complete) { 
        Swal.fire('แจ้งเตือน', 'กรุณาประเมินให้ครบทุกข้อครับ', 'warning'); 
        return; 
    }
    
    let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : document.getElementById("speakerSelect").value;
    
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    
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
            Swal.fire('สำเร็จ', 'บันทึกเรียบร้อย', 'success').then(() => {
                backToDashboard('surveySection');
            });
        }
    } catch (e) {
        Swal.fire('ผิดพลาด', 'เชื่อมต่อไม่ได้', 'error');
    }
}