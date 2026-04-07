/**
 * PROJECT: TMS-V2 (ศึกษานิเทศก์เชิงรุก)
 * VERSION: 5.0 (Ultimate Edition)
 * FEATURES: Time Log Display, Speaker Grid, Anti-Cheat, Auto-Save
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ==========================================
// 1. ระบบยืนยันตัวตน & นำทาง (Auth V5.0)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) { 
    document.getElementById("personalId").value = savedId; 
    document.getElementById("displayUser").innerText = savedId;
    showDashboard(); 
  }
});

function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (!id) { Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสประจำตัวครับ', 'warning'); return; }
  localStorage.setItem("tms_personal_id", id);
  document.getElementById("displayUser").innerText = id;
  showDashboard();
}

function logout() { localStorage.removeItem("tms_personal_id"); location.reload(); }
function showDashboard() { document.getElementById("loginSection").classList.add("d-none"); document.getElementById("dashboardSection").classList.remove("d-none"); }
function backToDashboard(id) { 
  document.getElementById(id).classList.add("d-none"); 
  document.getElementById("dashboardSection").classList.remove("d-none"); 
  clearInterval(examCountdown); 
  isExamActive = false; 
}

// ==========================================
// 2. ระบบลงเวลา (Attendance V5.0 - Show History)
// ==========================================
async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  let container = document.getElementById("attendanceButtonsContainer");
  container.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-info"></div></div>';
  
  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
    let result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = '';
      if (result.schedule.length === 0) { container.innerHTML = '<div class="alert alert-warning">ไม่มีรอบลงเวลา</div>'; return; }
      
      result.schedule.forEach(slot => {
        let logKey = slot.day_no + '_' + slot.slot_id;
        let loggedTime = result.userLogs[logKey]; // ดึงเวลาที่เคยบันทึกไว้
        
        let btnHtml = '';
        if (loggedTime) {
          // 🟢 กรณีลงเวลาแล้ว: แสดงปุ่มสีเทา พร้อมวันที่และเวลา (ฟีเจอร์ที่กู้คืน)
          btnHtml = `
            <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center opacity-75">
              <div class="fw-bold text-secondary">✔️ ${slot.slot_label} บันทึกสำเร็จ</div>
              <small class="text-muted">บันทึกเมื่อ: ${loggedTime}</small>
            </div>`;
        } else {
          // 🔴 กรณีรอบที่ยังไม่ได้ลง
          btnHtml = `<button class="btn btn-success w-100 mb-3 p-3 rounded-4 fw-bold shadow-sm" onclick="submitAttendance('${slot.day_no}','${slot.slot_id}')">📌 ลงเวลา: ${slot.slot_label}</button>`;
        }
        container.innerHTML += btnHtml;
      });
    }
  } catch (e) { container.innerHTML = '<div class="alert alert-danger">การเชื่อมต่อผิดพลาด</div>'; }
}

async function submitAttendance(day, slot) {
  Swal.fire({ title: 'กำลังบันทึกเวลา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: localStorage.getItem("tms_personal_id"), day_no: day, time_slot: slot, note: '[V5.0 Check-in]' } }) });
  Swal.fire('สำเร็จ', 'บันทึกเวลาเรียบร้อยแล้ว', 'success').then(() => openAttendanceForm());
}

// ==========================================
// 3. ระบบสอบ (Exam V5.0 - Full Features)
// ==========================================
document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({ icon: 'warning', title: 'คำเตือน: ห้ามสลับหน้าจอ!', text: 'ระบบตรวจพบการออกจากหน้าทำข้อสอบ', confirmButtonColor: '#d33' });
  }
});

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  let area = document.getElementById("examContentArea");
  area.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-warning"></div></div>';
  
  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getExamData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
  globalExamData = await res.json();
  
  if (globalExamData.status === 'success') {
    document.getElementById("examTitleLabel").innerText = globalExamData.activeExam.type + " TEST";
    area.innerHTML = `
      <div class="text-center p-5 border rounded-4 bg-light">
        <h4>แบบทดสอบ ${globalExamData.activeExam.type}</h4>
        <p class="text-muted">ระบบจะจับเวลา 30 นาที และป้องกันการสลับหน้าจอ</p>
        <button class="btn btn-warning btn-lg rounded-pill px-5 mt-3 fw-bold" onclick="startExam()">เริ่มทำข้อสอบ</button>
      </div>`;
  } else { area.innerHTML = `<div class="alert alert-info text-center rounded-4">${globalExamData.message}</div>`; }
}

function startExam() {
  isExamActive = true; 
  renderExamQuestions(); 
  startTimer(30 * 60); 
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderExamQuestions() {
  let html = ''; const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
  globalExamData.questions.forEach((q, i) => {
    html += `<div class="card mb-4 p-4 border-0 shadow-sm rounded-4 exam-question-card">
      <p class="fw-bold fs-5">${i+1}. ${q.question}</p>`;
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `<div class="form-check mb-2"><input class="form-check-input" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}"><label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;"><b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[opt]}</label></div>`;
    });
    html += `</div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60), s = sec % 60;
    document.getElementById("examTimeDisplay").innerText = `${m}:${s < 10 ? '0'+s : s}`;
    if (sec === 300) { Swal.fire({ toast: true, position: 'top', icon: 'warning', title: 'เหลือเวลา 5 นาที!', showConfirmButton: false, timer: 5000 }); }
    if (--sec < 0) { clearInterval(examCountdown); submitRealExam(); }
  }, 1000);
}

async function submitRealExam() {
  clearInterval(examCountdown); isExamActive = false;
  let score = 0;
  globalExamData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (sel && sel.value === q.answer) score += 2;
  });
  Swal.fire({ title: 'กำลังบันทึกคะแนน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: { personal_id: localStorage.getItem("tms_personal_id"), test_type: globalExamData.activeExam.type, score: score, max_score: globalExamData.questions.length * 2 } }) });
  Swal.fire('เรียบร้อย', `การสอบเสร็จสิ้น คะแนนของคุณคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
}

// ==========================================
// 4. ระบบประเมิน (Survey V5.0 - Speaker Cards)
// ==========================================
async function openSurveyForm(type) {
  currentSurveyType = type; selectedSpeakerId = null;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  document.getElementById("surveyContentArea").innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div></div>';
  document.getElementById("btnSubmitSurvey").classList.add("d-none");
  
  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) });
  globalSurveyData = await res.json();
  
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  renderSurveyScreen(type);
}

function renderSurveyScreen(type) {
  let grid = document.getElementById("speakerButtonsGrid");
  let speakerArea = document.getElementById("speakerSelectionArea");
  let contentArea = document.getElementById("surveyContentArea");

  if (type === 'SPEAKER_SURVEY') {
    speakerArea.classList.remove("d-none");
    grid.innerHTML = '';
    if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
      contentArea.innerHTML = '<div class="alert alert-warning text-center rounded-4">ขณะนี้ไม่มีรายชื่อวิทยากรที่เปิดให้ประเมินตามตารางเวลาครับ</div>';
      return;
    }
    globalSurveyData.speakers.forEach(spk => {
      grid.innerHTML += `
        <div class="col-12 col-md-6">
          <div class="card p-3 shadow-sm rounded-4 speaker-card h-100" id="spk_btn_${spk.id}" onclick="selectSpeaker('${spk.id}')">
            <h6 class="fw-bold text-primary mb-1">${spk.name}</h6>
            <small class="text-muted d-block" style="font-size: 11px;">${spk.topic}</small>
          </div>
        </div>`;
    });
    contentArea.innerHTML = '<p class="text-center text-muted p-5 bg-white rounded-4 border mt-3">โปรดเลือกวิทยากรด้านบน</p>';
  } else {
    speakerArea.classList.add("d-none");
    renderSurveyQuestions();
    document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  }
}

function selectSpeaker(id) {
  selectedSpeakerId = id;
  document.querySelectorAll('.speaker-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`spk_btn_${id}`).classList.add('active');
  renderSurveyQuestions();
  document.getElementById("btnSubmitSurvey").classList.remove("d-none");
}

function renderSurveyQuestions() {
  if (!globalSurveyData || !globalSurveyData.questions) return;
  let html = ''; let grouped = {};
  globalSurveyData.questions.forEach(q => { if(!grouped[q.category]) grouped[q.category] = []; grouped[q.category].push(q); });

  Object.keys(grouped).forEach(cat => {
    html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2 border-3">${cat}</h5>`;
    grouped[cat].forEach(q => {
      let opts = '';
      q.options.forEach(opt => {
        opts += `<div class="form-check mb-2 ms-2"><input class="form-check-input border-secondary" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">${opt}</label></div>`;
      });
      html += `<div class="card mb-3 p-4 border-0 shadow-sm rounded-4 border-start border-4 border-info"><p class="fw-bold mb-3 fs-5">${q.question}</p>${opts}</div>`;
    });
  });
  document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
  let answers = {}; let complete = true;
  globalSurveyData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`);
    if(sel) answers[q.id] = sel.value; else complete = false;
  });
  if(!complete) { Swal.fire('แจ้งเตือน', 'กรุณาตอบให้ครบทุกข้อครับ', 'warning'); return; }

  Swal.fire({ title: 'กำลังบันทึกผลประเมิน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let payload = { personal_id: localStorage.getItem("tms_personal_id"), answers: answers };
  if(currentSurveyType === 'SPEAKER_SURVEY') payload.target_id = selectedSpeakerId;
  
  let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
  Swal.fire('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้วครับ', 'success').then(() => backToDashboard('surveySection'));
}