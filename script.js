const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ==========================================
// 1. ระบบนำทาง & Auth
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) { document.getElementById("personalId").value = savedId; showDashboard(); }
});

function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (!id) { Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสประจำตัว', 'warning'); return; }
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
}

function logout() { localStorage.removeItem("tms_personal_id"); location.reload(); }
function showDashboard() { document.getElementById("loginSection").classList.add("d-none"); document.getElementById("dashboardSection").classList.remove("d-none"); }
function backToDashboard(id) { document.getElementById(id).classList.add("d-none"); document.getElementById("dashboardSection").classList.remove("d-none"); clearInterval(examCountdown); isExamActive = false; }

// ==========================================
// 2. ระบบลงเวลา
// ==========================================
async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  let container = document.getElementById("attendanceButtonsContainer");
  container.innerHTML = '<div class="text-center"><div class="spinner-border text-info"></div></div>';
  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
    let result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = '';
      if (result.schedule.length === 0) { container.innerHTML = '<div class="alert alert-warning">ไม่มีรอบลงเวลา</div>'; return; }
      result.schedule.forEach(slot => {
        let key = slot.day_no + '_' + slot.slot_id;
        let logged = result.userLogs[key];
        container.innerHTML += `<button class="btn ${logged ? 'btn-secondary' : 'btn-success'} w-100 mb-3 p-3 rounded-4 fw-bold" ${logged ? 'disabled' : ''} onclick="submitAttendance('${slot.day_no}','${slot.slot_id}')">${logged ? '✔️ ลงเวลาแล้ว' : '📌 ลงเวลา: '+slot.slot_label}</button>`;
      });
    }
  } catch (e) { container.innerHTML = 'ขาดการเชื่อมต่อ'; }
}

async function submitAttendance(day, slot) {
  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: localStorage.getItem("tms_personal_id"), day_no: day, time_slot: slot, note: '[ตรงเวลา]' } }) });
  Swal.fire('สำเร็จ', 'บันทึกเวลาแล้ว', 'success').then(() => openAttendanceForm());
}

// ==========================================
// 3. ระบบสอบ (Exam)
// ==========================================
async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  document.getElementById("examContentArea").innerHTML = '<div class="text-center"><div class="spinner-border text-warning"></div></div>';
  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getExamData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
  globalExamData = await res.json();
  if (globalExamData.status === 'success') {
    document.getElementById("examTitleLabel").innerText = globalExamData.activeExam.type + " TEST";
    document.getElementById("examContentArea").innerHTML = `<div class="text-center p-5"><h4>แบบทดสอบ ${globalExamData.activeExam.type}</h4><button class="btn btn-warning btn-lg rounded-pill px-5 mt-3 fw-bold" onclick="startExam()">เริ่มทำข้อสอบ</button></div>`;
  } else { document.getElementById("examContentArea").innerHTML = `<div class="alert alert-info text-center">${globalExamData.message}</div>`; }
}

function startExam() {
  isExamActive = true; renderExamQuestions(); startTimer(30 * 60);
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderExamQuestions() {
  let html = ''; const choices = ['ก.', 'ข.', 'ค.', 'ง.'];
  globalExamData.questions.forEach((q, i) => {
    html += `<div class="card mb-3 p-4 border-0 shadow-sm rounded-4 text-start border-start border-4 border-warning">
      <p class="fw-bold fs-5">${i+1}. ${q.question}</p>
      ${['A','B','C','D'].map((opt, idx) => `<div class="form-check mb-2"><input class="form-check-input" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}"><label class="form-check-label w-100" for="q_${q.id}_${opt}"><b class="text-primary">${choices[idx]}</b> ${globalExamData.questions[i].options[opt]}</label></div>`).join('')}
    </div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60), s = sec % 60;
    document.getElementById("examTimeDisplay").innerText = `${m}:${s < 10 ? '0'+s : s}`;
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
  Swal.fire({ title: 'กำลังส่ง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: { personal_id: localStorage.getItem("tms_personal_id"), test_type: globalExamData.activeExam.type, score: score, max_score: globalExamData.questions.length * 2 } }) });
  Swal.fire('เรียบร้อย', `คะแนนของคุณคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
}

// ==========================================
// 4. ระบบประเมิน (Survey) - Project & Speaker Cards
// ==========================================
async function openSurveyForm(type) {
  currentSurveyType = type; selectedSpeakerId = null;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  document.getElementById("surveyContentArea").innerHTML = '<div class="text-center"><div class="spinner-border text-success"></div></div>';
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) });
  globalSurveyData = await res.json();
  
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  
  if (type === 'SPEAKER_SURVEY') {
    renderSpeakerCards();
    document.getElementById("surveyContentArea").innerHTML = '<p class="text-center text-muted my-4">โปรดเลือกวิทยากรด้านบน</p>';
  } else {
    document.getElementById("speakerSelectionArea").classList.add("d-none");
    renderSurveyQuestions();
    document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  }
}

function renderSpeakerCards() {
  let grid = document.getElementById("speakerButtonsGrid");
  grid.innerHTML = '';
  if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
    document.getElementById("surveyContentArea").innerHTML = '<div class="alert alert-warning">ไม่พบวิทยากรที่เปิดให้ประเมิน</div>';
    return;
  }
  globalSurveyData.speakers.forEach(spk => {
    grid.innerHTML += `
      <div class="col-12 col-md-6">
        <button class="btn btn-outline-primary w-100 p-3 rounded-4 shadow-sm speaker-btn-card text-start" id="btn_spk_${spk.id}" onclick="selectSpeaker('${spk.id}')">
          <div class="fw-bold fs-5">${spk.name}</div>
          <div class="small opacity-75">${spk.topic}</div>
        </button>
      </div>`;
  });
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
}

function selectSpeaker(id) {
  selectedSpeakerId = id;
  document.querySelectorAll('.speaker-btn-card').forEach(b => b.classList.replace('btn-primary', 'btn-outline-primary'));
  document.getElementById(`btn_spk_${id}`).classList.replace('btn-outline-primary', 'btn-primary');
  renderSurveyQuestions();
  document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  document.getElementById("surveyContentArea").scrollIntoView({ behavior: 'smooth' });
}

function renderSurveyQuestions() {
  if (!globalSurveyData || !globalSurveyData.questions) return;
  let html = ''; let grouped = {};
  globalSurveyData.questions.forEach(q => { if(!grouped[q.category]) grouped[q.category] = []; grouped[q.category].push(q); });

  Object.keys(grouped).forEach(cat => {
    html += `<h5 class="fw-bold mt-4 mb-3 text-primary border-bottom pb-2 border-3">${cat}</h5>`;
    grouped[cat].forEach(q => {
      let opts = '';
      q.options.forEach(opt => {
        opts += `<div class="form-check mb-2 ms-2"><input class="form-check-input" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">${opt}</label></div>`;
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
  if(!complete) { Swal.fire('เตือน', 'กรุณาตอบให้ครบทุกข้อ', 'warning'); return; }
  
  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let payload = { personal_id: localStorage.getItem("tms_personal_id"), answers: answers };
  if(currentSurveyType === 'SPEAKER_SURVEY') payload.target_id = selectedSpeakerId;
  
  let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
  Swal.fire('สำเร็จ', 'ขอบคุณสำหรับข้อมูลครับ', 'success').then(() => backToDashboard('surveySection'));
}