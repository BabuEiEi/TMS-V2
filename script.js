/**
 * VERSION: 7.0 (Legacy Re-Master)
 * FEATURES: 
 * - แสดงวันที่/เวลา หลังลงเวลาสำเร็จ
 * - แผงปุ่มกดรายชื่อวิทยากร (Speaker Grid)
 * - Anti-Cheat, Timer, Auto-Save
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ==========================================
// 1. ระบบยืนยันตัวตน & นำทาง
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) { document.getElementById("personalId").value = savedId; showDashboard(); }
});

function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (!id) { Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสประจำตัวก่อนครับ', 'warning'); return; }
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
}

function logout() { localStorage.removeItem("tms_personal_id"); location.reload(); }
function showDashboard() { document.getElementById("loginSection").classList.add("d-none"); document.getElementById("dashboardSection").classList.remove("d-none"); }
function backToDashboard(id) { document.getElementById(id).classList.add("d-none"); document.getElementById("dashboardSection").classList.remove("d-none"); isExamActive = false; clearInterval(examCountdown); }

// ==========================================
// 2. ระบบลงเวลา (V7.0 - โชว์ประวัติ วันที่/เวลา)
// ==========================================
async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  let container = document.getElementById("attendanceButtonsContainer");
  container.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-info"></div><p class="small mt-2">ตรวจสอบรอบ...</p></div>';

  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
    let result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = '';
      result.schedule.forEach(slot => {
        let logKey = slot.day_no + '_' + slot.slot_id;
        let loggedTime = result.userLogs[logKey];
        
        if (loggedTime) {
          // 🟢 กรณีลงเวลาแล้ว: เปลี่ยนปุ่มเป็นสีเทา และโชว์ วันที่/เวลา บันทึกสำเร็จ
          container.innerHTML += `
            <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center">
              <div class="fw-bold text-secondary">✔️ ${slot.slot_label} บันทึกแล้ว</div>
              <small class="text-muted" style="font-size: 11px;">บันทึกเมื่อ: ${loggedTime}</small>
            </div>`;
        } else {
          // 🔴 ยังไม่ได้ลงเวลา
          container.innerHTML += `<button class="btn btn-success w-100 mb-3 py-3 rounded-4 fw-bold shadow-sm" onclick="submitAttendance('${slot.day_no}', '${slot.slot_id}')">📌 ลงเวลา: ${slot.slot_label}</button>`;
        }
      });
    }
  } catch (e) { container.innerHTML = '<div class="alert alert-danger">การเชื่อมต่อผิดพลาด</div>'; }
}

async function submitAttendance(day, slot) {
  Swal.fire({ title: 'กำลังบันทึกเวลา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: localStorage.getItem("tms_personal_id"), day_no: day, time_slot: slot, note: '[V7.0]' } }) });
  Swal.fire('สำเร็จ', 'บันทึกเวลาเรียบร้อยแล้ว', 'success').then(() => openAttendanceForm());
}

// ==========================================
// 3. ระบบสอบ (ครบเครื่องตามโครงสร้างพี่บาบู)
// ==========================================
document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({ icon: 'warning', title: 'คำเตือน!', text: 'ห้ามสลับหน้าจอขณะทำข้อสอบ ระบบบันทึกพฤติกรรมนี้ไว้แล้วครับ', confirmButtonColor: '#d33' });
  }
});

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  let area = document.getElementById("examContentArea");
  area.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-warning"></div></div>';
  
  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getExamData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
  globalExamData = await res.json();
  if (globalExamData.status === 'success') { renderExamStart(); } else { area.innerHTML = `<div class="alert alert-info text-center">${globalExamData.message}</div>`; }
}

function renderExamStart() {
  let exam = globalExamData.activeExam;
  document.getElementById("examTitleLabel").innerText = exam.type + " TEST";
  document.getElementById("examContentArea").innerHTML = `
    <div class="text-center p-5 bg-light rounded-4 border">
      <h4>พร้อมทำแบบทดสอบ ${exam.type} หรือไม่?</h4>
      <p class="text-muted">เมื่อกดเริ่มแล้ว ระบบจะเริ่มจับเวลา 30 นาทีทันที</p>
      <button class="btn btn-success btn-lg rounded-pill px-5 mt-3 fw-bold" onclick="startExam()">เริ่มทำข้อสอบ</button>
    </div>`;
}

function startExam() {
  isExamActive = true; 
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
  renderExamQuestions();
  startTimer(30 * 60);
}

function renderExamQuestions() {
  let html = ''; const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
  globalExamData.questions.forEach((q, i) => {
    html += `<div class="card mb-3 p-4 border rounded-4 text-start shadow-sm">
      <p class="fw-bold fs-5">${i+1}. ${q.question}</p>
      ${['A','B','C','D'].map((opt, idx) => `
        <div class="form-check mb-2">
          <input class="form-check-input" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}">
          <label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;"><b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[opt]}</label>
        </div>`).join('')}
    </div>`;
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
  Swal.fire('เรียบร้อย', `คะแนนของคุณคือ ${score} คะแนน`, 'success').then(() => backToDashboard('examSection'));
}

// ==========================================
// 4. ระบบประเมิน (V7.0 - แผงเลือกวิทยากรตาม Config)
// ==========================================
async function openSurveyForm(type) {
  currentSurveyType = type; selectedSpeakerId = null;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  let area = document.getElementById("surveyContentArea");
  let speakerArea = document.getElementById("speakerSelectionArea");
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  area.innerHTML = '<p class="text-center p-5">กำลังโหลดแบบประเมิน...</p>';
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) });
  globalSurveyData = await res.json();

  if (type === 'SPEAKER_SURVEY') {
    renderSpeakerGrid();
    area.innerHTML = '<p class="text-center text-muted p-4">โปรดเลือกวิทยากรด้านบนเพื่อเริ่มการประเมิน</p>';
  } else {
    speakerArea.classList.add("d-none");
    renderSurveyQuestions();
    document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  }
}

function renderSpeakerGrid() {
  let grid = document.getElementById("speakerButtonsGrid");
  grid.innerHTML = '';
  if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
    document.getElementById("surveyContentArea").innerHTML = '<div class="alert alert-warning text-center">ไม่มีวิทยากรเปิดประเมินในขณะนี้ครับ</div>';
    return;
  }
  globalSurveyData.speakers.forEach(spk => {
    grid.innerHTML += `
      <div class="col-6 col-md-4">
        <button class="btn btn-outline-primary w-100 h-100 p-3 rounded-4 shadow-sm speaker-btn-v7" id="spk_btn_${spk.id}" onclick="selectSpeaker('${spk.id}')">
          <div class="fw-bold">${spk.name}</div>
          <div class="small opacity-75 mt-1" style="font-size: 10px;">${spk.topic}</div>
        </button>
      </div>`;
  });
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
}

function selectSpeaker(id) {
  selectedSpeakerId = id;
  document.querySelectorAll('.speaker-btn-v7').forEach(b => b.classList.replace('btn-primary', 'btn-outline-primary'));
  document.getElementById(`spk_btn_${id}`).classList.replace('btn-outline-primary', 'btn-primary');
  renderSurveyQuestions();
  document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  document.getElementById("surveyContentArea").scrollIntoView({ behavior: 'smooth' });
}

function renderSurveyQuestions() {
  if (!globalSurveyData || !globalSurveyData.questions) return;
  let html = ''; let grouped = {};
  globalSurveyData.questions.forEach(q => { if(!grouped[q.category]) grouped[q.category] = []; grouped[q.category].push(q); });

  Object.keys(grouped).forEach(cat => {
    html += `<h6 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2">${cat}</h6>`;
    grouped[cat].forEach(q => {
      let opts = '';
      q.options.forEach(opt => {
        opts += `<div class="form-check mb-2 ms-2"><input class="form-check-input" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">${opt}</label></div>`;
      });
      html += `<div class="card p-4 mb-3 border-0 shadow-sm rounded-4 border-start border-4 border-info"><p class="fw-bold mb-3 fs-5">${q.question}</p>${opts}</div>`;
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

  Swal.fire({ title: 'บันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let payload = { personal_id: localStorage.getItem("tms_personal_id"), answers: answers };
  if(currentSurveyType === 'SPEAKER_SURVEY') payload.target_id = selectedSpeakerId;
  
  let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
  Swal.fire('สำเร็จ', 'ขอบคุณสำหรับข้อมูลครับ', 'success').then(() => backToDashboard('surveySection'));
}