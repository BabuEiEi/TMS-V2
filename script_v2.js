// ==========================================
// ⚙️ 1. SYSTEM SETTINGS & VARIABLES
// ==========================================
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwOa-l7a9ePoxP0v_s21uW9-4A_oGvA_xXvA1N_/exec"; // อย่าลืมแก้เป็น URL ของพี่นะครับ

let currentExamType = "";
let currentSurveyType = "";
let currentSpeakerId = "";
let timerInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    let savedId = localStorage.getItem("tms_personal_id");
    if (savedId) {
        document.getElementById("personalId").value = savedId;
        renderUserInfo();
        showDashboard();
    }
});

// ==========================================
// 🔓 2. AUTHENTICATION & ROUTING
// ==========================================
async function login() {
    let idInput = document.getElementById("personalId");
    let id = idInput.value.trim().toUpperCase();
    if (id === "") { Swal.fire({ icon: 'warning', title: 'กรุณากรอกรหัสประจำตัว' }); return; }

    Swal.fire({ title: 'กำลังเข้าระบบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

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
            Swal.close();
        } else {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: result.message });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'ระบบขัดข้อง', text: 'เชื่อมต่อฐานข้อมูลไม่ได้' });
    }
}

function showDashboard() {
    document.getElementById("loginSection").classList.add("d-none");
    document.getElementById("main-nav").style.display = "block";
    document.getElementById("main-footer").classList.remove("d-none");

    const userDataStr = localStorage.getItem("tms_user_data");
    if (!userDataStr) { location.reload(); return; }

    const user = JSON.parse(userDataStr);
    const role = user.role.toUpperCase();

    // ซ่อนทุกหน้าก่อน
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('d-none'));

    // ระบบ Router สับราง
    if (role === 'ADMIN') {
        renderAdminDashboard();
    } else {
        // Trainee, Mentor, Staff ให้เห็นหน้า Dashboard หลักไปก่อนในเฟสนี้
        document.getElementById("dashboardSection").classList.remove("d-none");
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderUserInfo() {
    const data = localStorage.getItem("tms_user_data");
    if (data) {
        const user = JSON.parse(data);
        document.getElementById("display-user-name").innerText = user.name || "ไม่ระบุชื่อ";
        document.getElementById("display-user-role").innerText = user.role || "-";
        document.getElementById("display-user-area").innerText = "📍 " + (user.area_service || "-");
        document.getElementById("display-user-group").innerText = "🎯 กลุ่ม: " + (user.group_target || "-");
    }
}

function logout() {
    localStorage.clear();
    location.reload();
}

function backToDashboard(currentSectionId) {
    document.getElementById(currentSectionId).classList.add("d-none");
    document.getElementById("dashboardSection").classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 🛡️ 3. ADMIN DASHBOARD (Phase 2)
// ==========================================
function renderAdminDashboard() {
    document.getElementById("adminSection").classList.remove("d-none");
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.add('d-none'));
    document.querySelectorAll('.list-group-item').forEach(btn => btn.classList.remove('active', 'fw-bold'));
    document.getElementById('adminTab_' + tabName).classList.remove('d-none');
    if(event && event.currentTarget) event.currentTarget.classList.add('active', 'fw-bold');
}

function toggleSystem(systemName, isChecked) {
    Swal.fire({ title: 'กำลังอัปเดตคำสั่ง...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    setTimeout(() => {
        let statusText = isChecked ? 'เปิดระบบ' : 'ปิดระบบ';
        Swal.fire({ icon: 'success', title: 'อัปเดตสำเร็จ!', text: `${statusText} ${systemName} เรียบร้อยแล้ว`, timer: 1500, showConfirmButton: false });
    }, 800);
}

// ==========================================
// 🕒 4. ATTENDANCE SYSTEM
// ==========================================
async function openAttendanceForm() {
    let id = localStorage.getItem("tms_personal_id");
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("attendanceSection").classList.remove("d-none");
    
    let container = document.getElementById("attendanceButtonsContainer");
    container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-info" role="status"></div><p>กำลังตรวจสอบรอบการลงเวลา...</p></div>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: id } })
        });
        let result = await response.json();
        if (result.status === 'success') {
            // (ถ้ามีโค้ด Render ปุ่มลงเวลาของเดิม ให้แทรกตรงนี้)
            container.innerHTML = `<button class="btn btn-info btn-lg w-100 rounded-pill shadow fw-bold text-white py-3" onclick="submitAttendance()">กดเพื่อลงเวลาตอนนี้</button>`;
        } else {
            container.innerHTML = `<div class="alert alert-warning">${result.message}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<button class="btn btn-info btn-lg w-100 rounded-pill shadow fw-bold text-white py-3" onclick="submitAttendance()">กดเพื่อลงเวลาตอนนี้</button>`;
    }
}

async function submitAttendance() {
    let id = localStorage.getItem("tms_personal_id");
    Swal.fire({ title: 'กำลังบันทึกเวลา...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: id } })
        });
        let result = await response.json();
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'บันทึกเวลาสำเร็จ!', text: result.message }).then(()=> backToDashboard('attendanceSection'));
        } else {
            Swal.fire({ icon: 'error', title: 'ไม่สามารถบันทึกได้', text: result.message });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'ระบบขัดข้อง', text: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' });
    }
}

// ==========================================
// 📝 5. EXAM SYSTEM
// ==========================================
async function openExamForm() {
    let id = localStorage.getItem("tms_personal_id");
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("examSection").classList.remove("d-none");
    
    let contentArea = document.getElementById("examContentArea");
    contentArea.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-warning" role="status"></div><p class="mt-3">กำลังโหลดข้อสอบ...</p></div>`;
    document.getElementById("btnSubmitExam").classList.add("d-none");
    document.getElementById("examTimerBadge").classList.add("d-none");
    clearInterval(timerInterval);

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'getExamData', payload: { personal_id: id } })
        });
        let result = await response.json();
        
        if (result.status === 'success') {
            currentExamType = result.exam_type;
            document.getElementById("examTitleLabel").innerText = `แบบทดสอบ ${currentExamType}`;
            renderExamContent(result.data);
            document.getElementById("btnSubmitExam").classList.remove("d-none");
            startExamTimer(30);
        } else {
            contentArea.innerHTML = `<div class="alert alert-warning text-center">${result.message}</div>`;
        }
    } catch (error) {
        contentArea.innerHTML = `<div class="alert alert-danger text-center">เกิดข้อผิดพลาดในการโหลดข้อสอบ</div>`;
    }
}

function renderExamContent(questions) {
    let html = "";
    questions.forEach((q, index) => {
        html += `<div class="mb-4 p-4 border rounded-4 bg-light exam-question shadow-sm" data-qid="${q.q_id}">
            <h6 class="fw-bold mb-3">${index + 1}. ${q.question}</h6>`;
        ['A', 'B', 'C', 'D'].forEach(opt => {
            let optKey = `opt_${opt.toLowerCase()}`;
            if (q[optKey]) {
                html += `
                <div class="form-check mb-2">
                    <input class="form-check-input" type="radio" name="ans_${q.q_id}" value="${opt}" id="ans_${q.q_id}_${opt}">
                    <label class="form-check-label" for="ans_${q.q_id}_${opt}">${q[optKey]}</label>
                </div>`;
            }
        });
        html += `</div>`;
    });
    document.getElementById("examContentArea").innerHTML = html;
}

function startExamTimer(minutes) {
    let timeRemaining = minutes * 60;
    let display = document.getElementById("examTimeDisplay");
    document.getElementById("examTimerBadge").classList.remove("d-none");
    
    timerInterval = setInterval(() => {
        let m = Math.floor(timeRemaining / 60);
        let s = timeRemaining % 60;
        display.innerText = `${m < 10 ? '0':''}${m}:${s < 10 ? '0':''}${s}`;
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            Swal.fire({ icon: 'warning', title: 'หมดเวลา!', text: 'ระบบจะส่งคำตอบอัตโนมัติ' }).then(() => { submitRealExam(); });
        }
        timeRemaining--;
    }, 1000);
}

async function submitRealExam() {
    let id = localStorage.getItem("tms_personal_id");
    let answers = {};
    let allAnswered = true;
    
    document.querySelectorAll(".exam-question").forEach(div => {
        let qid = div.getAttribute("data-qid");
        let selected = document.querySelector(`input[name="ans_${qid}"]:checked`);
        if (selected) { answers[qid] = selected.value; } 
        else { allAnswered = false; }
    });

    if (!allAnswered) { Swal.fire({ icon: 'warning', title: 'ยังทำไม่ครบ', text: 'กรุณาตอบคำถามให้ครบทุกข้อ' }); return; }

    clearInterval(timerInterval);
    Swal.fire({ title: 'กำลังส่งคำตอบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: { personal_id: id, exam_type: currentExamType, answers: JSON.stringify(answers) } })
        });
        let result = await response.json();
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'ส่งสำเร็จ', text: `ได้คะแนน ${result.score} คะแนน` }).then(() => { backToDashboard('examSection'); });
        } else {
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: result.message });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'ขัดข้อง', text: 'ส่งข้อมูลไม่สำเร็จ' });
    }
}

// ==========================================
// 📊 6. SURVEY SYSTEM
// ==========================================
async function openSurveyForm(type) {
    let id = localStorage.getItem("tms_personal_id");
    currentSurveyType = type;
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("surveySection").classList.remove("d-none");
    document.getElementById("btnSubmitSurvey").classList.add("d-none");
    document.getElementById("speakerSelectionArea").classList.add("d-none");
    
    let title = type === 'PROJECT' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
    document.getElementById("surveyTitleLabel").innerText = title;
    
    let contentArea = document.getElementById("surveyContentArea");
    contentArea.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-success" role="status"></div><p>กำลังโหลดแบบประเมิน...</p></div>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { personal_id: id, survey_type: type } })
        });
        let result = await response.json();
        
        if (result.status === 'success') {
            if (type === 'SPEAKER' && result.speakers) renderSpeakerSelection(result.speakers);
            renderSurveyContent(result.data);
            document.getElementById("btnSubmitSurvey").classList.remove("d-none");
        } else {
            contentArea.innerHTML = `<div class="alert alert-warning text-center">${result.message}</div>`;
        }
    } catch (error) {
        contentArea.innerHTML = `<div class="alert alert-danger text-center">โหลดแบบประเมินไม่สำเร็จ</div>`;
    }
}

function renderSpeakerSelection(speakers) {
    let area = document.getElementById("speakerSelectionArea");
    area.classList.remove("d-none");
    let html = `<label class="fw-bold mb-2">กรุณาเลือกวิทยากรที่ต้องการประเมิน:</label><select id="speakerSelect" class="form-select form-select-lg">`;
    html += `<option value="">-- เลือกวิทยากร --</option>`;
    speakers.forEach(spk => { html += `<option value="${spk.spk_id}">${spk.spk_name} (${spk.spk_topic})</option>`; });
    html += `</select>`;
    area.innerHTML = html;
}

function renderSurveyContent(questions) {
    let html = "";
    questions.forEach((q, index) => {
        html += `<div class="mb-4 p-4 border rounded-4 bg-light survey-question shadow-sm" data-qid="${q.q_id}">
                 <h6 class="fw-bold">${index + 1}. ${q.question}</h6>`;
        
        if (q.q_category.includes("ข้อเสนอแนะ")) {
            html += `<textarea class="form-control mt-3" name="ans_${q.q_id}" rows="3" placeholder="พิมพ์ข้อเสนอแนะ..."></textarea>`;
        } else {
            html += `<div class="d-flex justify-content-between px-2 px-md-5 mt-4">`;
            for(let i=5; i>=1; i--) {
                html += `<div class="form-check form-check-inline text-center mx-1">
                            <input class="form-check-input" type="radio" name="ans_${q.q_id}" value="${i}" id="ans_${q.q_id}_${i}">
                            <label class="form-check-label d-block mt-1 small fw-bold" for="ans_${q.q_id}_${i}">${i}</label>
                         </div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    });
    document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
    if (currentSurveyType === 'SPEAKER') {
        let spkSelect = document.getElementById("speakerSelect");
        if (!spkSelect || spkSelect.value === "") { Swal.fire({ icon: 'warning', title: 'ยังไม่ได้เลือก', text: 'กรุณาเลือกวิทยากร' }); return; }
        currentSpeakerId = spkSelect.value;
    }

    let id = localStorage.getItem("tms_personal_id");
    let answers = {};
    
    document.querySelectorAll(".survey-question").forEach(div => {
        let qid = div.getAttribute("data-qid");
        let radio = document.querySelector(`input[name="ans_${qid}"]:checked`);
        let text = document.querySelector(`textarea[name="ans_${qid}"]`);
        
        if (radio) answers[qid] = radio.value;
        else if (text) answers[qid] = text.value.trim();
        else answers[qid] = "";
    });

    Swal.fire({ title: 'กำลังส่งผลประเมิน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'submitSurvey', payload: { personal_id: id, survey_type: currentSurveyType, speaker_id: currentSpeakerId, answers: JSON.stringify(answers) } })
        });
        let result = await response.json();
        
        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'ขอบคุณครับ', text: 'บันทึกผลประเมินเรียบร้อย' }).then(() => backToDashboard('surveySection'));
        } else {
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: result.message });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'ขัดข้อง', text: 'ส่งข้อมูลไม่สำเร็จ' });
    }
}

// ==========================================
// 📁 7. ASSIGNMENT SYSTEM (ระบบส่งงาน)
// ==========================================
async function openAssignmentForm() {
    let id = localStorage.getItem("tms_personal_id");
    document.getElementById("dashboardSection").classList.add("d-none");
    document.getElementById("assignmentSection").classList.remove("d-none");
    
    let tableBody = document.getElementById("assignmentTableBody");
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">กำลังโหลดข้อมูลภาระงาน...</p></td></tr>`;

    try {
        let response = await fetch(GAS_API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'getAssignmentData', payload: { personal_id: id } })
        });
        let result = await response.json();
        if (result.status === 'success') {
            // (ถ้ามีโค้ด Render ตารางส่งงาน ให้แทรกตรงนี้)
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">พร้อมใช้งานระบบส่งงานในอัปเดตถัดไป</td></tr>`;
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-warning">${result.message}</td></tr>`;
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">ไม่สามารถโหลดข้อมูลได้</td></tr>`;
    }
}