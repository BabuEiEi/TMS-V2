// 🔥 URL API ของพี่บาบู
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ==========================================
// 1. ระบบนำทาง & เข้าสู่ระบบ
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

// ==========================================
// 2. ระบบลงเวลา (Attendance)
// ==========================================
async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  let container = document.getElementById("attendanceButtonsContainer");
  container.innerHTML = '<p class="text-center">กำลังตรวจสอบรอบ...</p>';

  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
    let result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = '';
      result.schedule.forEach(slot => {
        let logged = result.userLogs[slot.day_no + '_' + slot.slot_id];
        let btnClass = logged ? 'btn-secondary' : 'btn-success';
        container.innerHTML += `<button class="btn ${btnClass} w-100 mb-3 p-3 rounded-4 fw-bold" ${logged ? 'disabled' : ''} onclick="submitAttendance('${slot.day_no}', '${slot.slot_id}')">${logged ? '✔️ ลงเวลาแล้ว' : '📌 ลงเวลา: ' + slot.slot_label}</button>`;
      });
    }
  } catch (e) { container.innerHTML = 'เกิดข้อผิดพลาดในการโหลด'; }
}

async function submitAttendance(day, slot) {
  Swal.fire({ title: 'บันทึกเวลา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: localStorage.getItem("tms_personal_id"), day_no: day, time_slot: slot, note: '[ตรงเวลา]' } }) });
  let result = await res.json();
  if (result.status === 'success') Swal.fire('สำเร็จ', 'บันทึกเวลาเรียบร้อย', 'success').then(() => openAttendanceForm());
}

// ==========================================
// 3. ระบบสอบ (Exam) + Auto-Save + Anti-Cheat
// ==========================================
// (ส่วนสลับข้อสอบ, จับเวลา, และแจ้งเตือนเหมือนฉบับก่อนหน้า)
async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  let area = document.getElementById("examContentArea");
  area.innerHTML = '<p class="text-center">กำลังโหลดข้อสอบ...</p>';
  
  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getExamData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
  globalExamData = await res.json();
  if (globalExamData.status === 'success') { renderExamStart(); } else { area.innerHTML = `<div class="alert alert-info text-center">${globalExamData.message}</div>`; }
}

function renderExamStart() {
  let exam = globalExamData.activeExam;
  document.getElementById("examTitleLabel").innerText = exam.type;
  document.getElementById("examContentArea").innerHTML = `<div class="text-center p-5"><h4>แบบทดสอบ ${exam.type}</h4><button class="btn btn-success btn-lg rounded-pill mt-3" onclick="startExam()">เริ่มทำข้อสอบ</button></div>`;
}

function startExam() {
  isExamActive = true;
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
  renderQuestions();
  startTimer(30 * 60);
}

function renderQuestions() {
  let html = '';
  globalExamData.questions.forEach((q, i) => {
    html += `<div class="card mb-3 p-3 border-0 shadow-sm rounded-4 text-start">
      <p class="fw-bold">${i+1}. ${q.question}</p>
      ${['A','B','C','D'].map(opt => `<div class="form-check"><input class="form-check-input" type="radio" name="q_${q.id}" value="${opt}" onchange="saveDraft('${q.id}','${opt}')" id="q_${q.id}_${opt}"><label class="form-check-label" for="q_${q.id}_${opt}">${globalExamData.questions[i].options[opt]}</label></div>`).join('')}
    </div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function saveDraft(qId, val) { 
  let draft = JSON.parse(localStorage.getItem('tms_draft') || "{}");
  draft[qId] = val;
  localStorage.setItem('tms_draft', JSON.stringify(draft));
}

function startTimer(sec) {
  let display = document.getElementById("examTimeDisplay");
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60), s = sec % 60;
    display.innerText = `${m}:${s < 10 ? '0'+s : s}`;
    if (--sec < 0) { clearInterval(examCountdown); submitRealExam(); }
  }, 1000);
}

async function submitRealExam() {
  isExamActive = false;
  clearInterval(examCountdown);
  let score = 0;
  globalExamData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (sel && sel.value === q.answer) score += 2;
  });
  let payload = { personal_id: localStorage.getItem("tms_personal_id"), test_type: globalExamData.activeExam.type, score: score, max_score: globalExamData.questions.length * 2 };
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: payload }) });
  Swal.fire('ส่งข้อสอบเรียบร้อย', `คะแนนของคุณคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
}

// ==========================================
// 4. ระบบประเมิน (Survey) - Project & Speaker
// ==========================================
async function openSurveyForm(type) {
  currentSurveyType = type;
  selectedSpeakerId = null;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  
  let area = document.getElementById("surveyContentArea");
  let speakerArea = document.getElementById("speakerSelectionArea");
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินโครงการ' : 'ประเมินวิทยากร';
  area.innerHTML = '<p class="text-center">กำลังโหลดแบบประเมิน...</p>';

  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) });
  globalSurveyData = await res.json();

  if (type === 'SPEAKER_SURVEY') {
    renderSpeakerCards();
    area.innerHTML = '<p class="text-center text-muted">โปรดเลือกวิทยากรด้านบน</p>';
  } else {
    speakerArea.classList.add("d-none");
    renderSurveyQuestions();
    document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  }
}

function renderSpeakerCards() {
  let grid = document.getElementById("speakerButtonsGrid");
  grid.innerHTML = '';
  globalSurveyData.speakers.forEach(spk => {
    grid.innerHTML += `
      <div class="col-12 col-md-6">
        <div class="card p-3 border-2 rounded-4 shadow-sm speaker-card" id="spk_${spk.id}" onclick="selectSpeaker('${spk.id}')" style="cursor:pointer;">
          <h6 class="fw-bold mb-1">${spk.name}</h6>
          <small class="text-muted">${spk.topic}</small>
        </div>
      </div>`;
  });
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
}

function selectSpeaker(id) {
  selectedSpeakerId = id;
  document.querySelectorAll('.speaker-card').forEach(c => c.classList.remove('border-primary', 'bg-light'));
  document.getElementById(`spk_${id}`).classList.add('border-primary', 'bg-light');
  renderSurveyQuestions();
  document.getElementById("btnSubmitSurvey").classList.remove("d-none");
}

function renderSurveyQuestions() {
  let html = '';
  let grouped = {};
  globalSurveyData.questions.forEach(q => {
    if(!grouped[q.category]) grouped[q.category] = [];
    grouped[q.category].push(q);
  });

  Object.keys(grouped).forEach(cat => {
    html += `<h6 class="fw-bold text-primary mt-4 mb-3">${cat}</h6>`;
    grouped[cat].forEach(q => {
      let optsHtml = '';
      if (q.options[0] === 'TEXT') {
        optsHtml = `<textarea class="form-control" name="sq_${q.id}" rows="2"></textarea>`;
      } else {
        q.options.forEach(opt => {
          optsHtml += `<div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label" for="sq_${q.id}_${opt}">${opt}</label></div>`;
        });
      }
      html += `<div class="card p-3 mb-2 border-0 shadow-sm rounded-4"><p class="small fw-bold mb-2">${q.question}</p>${optsHtml}</div>`;
    });
  });
  document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
  let answers = {};
  globalSurveyData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || document.querySelector(`textarea[name="sq_${q.id}"]`);
    if(sel) answers[q.id] = sel.value;
  });

  let payload = { personal_id: localStorage.getItem("tms_personal_id"), answers: answers };
  if(currentSurveyType === 'SPEAKER_SURVEY') payload.target_id = selectedSpeakerId;

  let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
  Swal.fire('ขอบคุณครับ', 'บันทึกการประเมินเรียบร้อย', 'success').then(() => backToDashboard('surveySection'));
}