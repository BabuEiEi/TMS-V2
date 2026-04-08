/**
 * PROJECT: TMS-V2
 * VERSION: 28.0 (The Exam Fix Edition)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: กู้คืนลอจิก "ตรวจสอบการสอบซ่อม" ในหน้าพร้อมสอบให้กลับมาสมบูรณ์
 * RULE: ปฏิบัติตามกฎเหล็ก 6 ข้ออย่างเคร่งครัด (ห้ามยุบย่อ ห้ามลดบรรทัด)
 * [COMMENT: TAGS FOR SEARCH: #NAV_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC]
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
        text: 'เข้าสู่ระบบ TMS เรียบร้อยแล้ว',
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
// [#ATT_LOGIC]: ระบบลงเวลาอัจฉริยะ (เช็คสาย/ระบุวันที่/เวลา)
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
                    <div class="fw-bold text-secondary fs-5">
                        ${baseDisplay} | ${logTimeString}${lateMark}
                    </div>
                    <small class="text-muted">บันทึกข้อมูลเข้าระบบเรียบร้อยแล้วครับ</small>
                </div>`;
        } else {
            let isCurrentlyLate = now > endDateTime;
            let btnClass = isCurrentlyLate ? 'btn-warning text-dark' : 'btn-success';
            let statusSuffix = isCurrentlyLate ? ' (สาย)' : '';

            btnContainer.innerHTML += `
                <button class="btn ${btnClass} w-100 mb-3 p-4 fw-bold rounded-4 shadow shadow-sm" 
                        style="font-size: 1.15rem;"
                        onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', '${isCurrentlyLate ? 'สาย' : 'ตรงเวลา'}')">
                    📌 ลงเวลา: ${slot.slot_label}${statusSuffix}<br>
                    <small class="fw-normal opacity-75">${baseDisplay}</small>
                </button>`;
        }
    });
}

async function submitRealAttendance(day, slot, status) {
    const swalResult = await Swal.fire({
        title: 'ยืนยันการลงเวลา',
        text: 'ท่านสามารถระบุหมายเหตุเพิ่มเติมได้ (ถ้ามี)',
        icon: 'question',
        input: 'text',
        inputPlaceholder: 'เช่น ลากิจ, ลาป่วย (เว้นว่างได้)',
        showCancelButton: true,
        confirmButtonText: 'บันทึกเวลา',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0dcaf0'
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
// [#EXAM_LOGIC]: ระบบข้อสอบและหน้าเตรียมพร้อม 
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
            document.getElementById("examTitleLabel").innerText = result.activeExam.type + " TEST";
            renderExamStartScreen(); 
        } else {
            contentArea.innerHTML = `
                <div class="alert alert-info text-center rounded-5 p-5 shadow-sm">
                    <h5 class="fw-bold">${result.message}</h5>
                    <p class="mb-0 text-muted small">โปรดรอการเปิดระบบจากฝ่ายทะเบียน</p>
                </div>`;
        }
    } catch (error) {
        contentArea.innerHTML = '<div class="alert alert-danger text-center">โหลดไม่สำเร็จ</div>';
    }
}

// [COMMENT: UPDATE V28.0 - กู้คืนลอจิกแจ้งเตือนสถานะการ "สอบซ่อม"]
function renderExamStartScreen() {
    let contentArea = document.getElementById("examContentArea");
    let exam = globalExamData.activeExam;
    let qCount = globalExamData.questions.length;
    
    let retakeMessage = '';
    let btnLabel = 'เริ่มทำแบบทดสอบเดี๋ยวนี้';
    let btnColor = 'btn-success';

    // เช็คว่าเคยสอบไปแล้วหรือไม่ (อิงตัวแปร attempts จากหลังบ้าน)
    if (globalExamData.attempts > 0 && exam.type === 'POST') {
        retakeMessage = `
            <div class="alert alert-warning mb-4 text-start shadow-sm rounded-4">
                ⚠️ ท่านเคยทำแบบทดสอบนี้แล้ว ระบบให้สิทธิ์สอบซ่อม (ครั้งที่ 2) ได้อีกหนึ่งครั้งครับ
            </div>`;
        btnLabel = 'เริ่มสอบซ่อม (ครั้งที่ 2)';
        btnColor = 'btn-warning text-dark';
    }
    
    contentArea.innerHTML = `
        <div class="text-center my-5 p-5 bg-light rounded-5 border shadow-sm fade-in">
            <h4 class="text-primary fw-bold mb-3">คุณพร้อมที่จะทำแบบทดสอบหรือไม่?</h4>
            <p class="text-muted fs-5">จำนวนข้อสอบทั้งหมด <b class="text-dark">${qCount}</b> ข้อ</p>
            
            ${retakeMessage}
            
            <div class="alert alert-info text-start small mx-auto mt-4" style="max-width: 520px;">
                <p class="fw-bold mb-2">📋 ข้อตกลงการทดสอบ:</p>
                <ul class="mb-0">
                    <li>⏱️ ระบบเริ่มจับเวลา 30 นาทีทันทีหลังกดเริ่ม</li>
                    <li>💾 มีระบบ Auto-Save คำตอบแบบเรียลไทม์</li>
                    <li>🚫 ห้ามสลับหน้าจอขณะทำข้อสอบ ระบบจะแจ้งเตือน</li>
                </ul>
            </div>
            
            <button class="btn btn-lg ${btnColor} mt-4 fw-bold px-5 rounded-pill shadow-lg" 
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
    
    globalExamData.questions.sort(() => {
        return Math.random() - 0.5;
    });

    globalExamData.questions.forEach((q, i) => {
        html += `
            <div class="card mb-4 p-5 border-0 shadow-sm rounded-4 bg-white border-start border-5 border-warning fade-in">
                <p class="fw-bold fs-5 mb-4">${i + 1}. ${q.question}</p>`;
        
        ['A','B','C','D'].forEach((opt, idx) => {
            html += `
                <div class="form-check mb-3">
                    <input class="form-check-input border-secondary" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}">
                    <label class="form-check-label w-100 ms-2" for="q_${q.id}_${opt}" style="cursor:pointer;">
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
            Swal.fire({
                title: 'หมดเวลา!',
                text: 'ระบบกำลังดำเนินการส่งคำตอบให้อัตโนมัติครับ',
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
    globalExamData.questions.forEach(q => {
        let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (sel && sel.value === q.answer) {
            score += 2;
        }
    });

    Swal.fire({ title: 'กำลังประมวลผลคะแนน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    let payload = {
        personal_id: localStorage.getItem("tms_personal_id"),
        test_type: globalExamData.activeExam.type,
        score: score,
        max_score: globalExamData.questions.length * 2
    };

    try {
        await fetch(GAS_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'submitExam', payload: payload }) 
        });
        
        Swal.fire({
            icon: 'success',
            title: 'ส่งสำเร็จ',
            text: `คุณทำคะแนนได้ ${score} คะแนน`
        }).then(() => {
            backToDashboard('examSection');
        });
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ส่งคะแนนไม่สำเร็จ', 'error');
    }
}


// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน (แยกตอน 1 ดิ่ง / ตอน 2 นอน)
// ============================================================

async function openSurveyForm(type) {
    currentSurveyType = type;
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("surveySection").classList.remove("d-none");
    
    let contentArea = document.getElementById("surveyContentArea");
    document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
    
    contentArea.innerHTML = `
        <div class="text-center p-5 my-5">
            <div class="spinner-border text-success"></div>
            <p class="mt-2 text-muted">กำลังเตรียมข้อมูลแบบประเมินพรีเมียม...</p>
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
        html += `<h4 class="category-header">${cat}</h4>`;
            
        grouped[cat].forEach(q => {
            let optionsHtml = '';
            
            if (cat.includes("ตอนที่ 2")) {
                optionsHtml += `
                    <div class="horizontal-rating-wrapper">
                        <div class="horizontal-rating-container">`;
                
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
            else if (cat.includes("ตอนที่ 1")) {
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
            else if (q.options[0] === 'TEXT') {
                optionsHtml = `
                    <textarea class="form-control rounded-4 shadow-sm" 
                              name="sq_${q.id}" rows="3" 
                              placeholder="ระบุข้อเสนอแนะเพิ่มเติมของท่าน..."></textarea>`;
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
        Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณาตอบให้ครบทุกข้อก่อนครับ' }); 
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
                payload: { personal_id: localStorage.getItem("tms_personal_id"), answers: answers, target_id: target } 
            }) 
        });
        
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'ขอบคุณสำหรับข้อมูลครับ' }).then(() => {
            backToDashboard('surveySection');
        });
    } catch (e) {
        Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกได้', 'error');
    }
}