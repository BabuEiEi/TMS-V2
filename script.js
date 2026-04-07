/**
 * VERSION: 10.0 (Master Blueprint)
 * [COMMENT: TAGS FOR NAVIGATION: 
 * #AUTH, #ATTENDANCE, #EXAM, #SURVEY ]
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// [COMMENT: #AUTH - ระบบยืนยันตัวตน]
document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) { document.getElementById("personalId").value = savedId; showDashboard(); }
});

function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (!id) { Swal.fire('เตือน', 'กรุณากรอกรหัสประจำตัว', 'warning'); return; }
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
}

function logout() { localStorage.removeItem("tms_personal_id"); location.reload(); }
function showDashboard() { document.getElementById("loginSection").classList.add("d-none"); document.getElementById("dashboardSection").classList.remove("d-none"); }
function backToDashboard(id) { document.getElementById(id).classList.add("d-none"); document.getElementById("dashboardSection").classList.remove("d-none"); clearInterval(examCountdown); isExamActive = false; }

// [COMMENT: #ATTENDANCE - ระบบลงเวลาโชว์ประวัติย้อนหลัง]
async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  let container = document.getElementById("attendanceButtonsContainer");
  container.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-info"></div></div>';
  
  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
    let result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = '';
      const uiMap = { 'Morning': { c: 'morning', i: '🌅' }, 'Afternoon': { c: 'afternoon', i: '☀️' }, 'Evening': { c: 'evening', i: '🌙' } };

      result.schedule.forEach(slot => {
        let key = slot.day_no + '_' + slot.slot_id;
        let loggedTime = result.userLogs[key];
        let ui = uiMap[slot.slot_id] || { c: 'morning', i: '📌' };

        if (loggedTime) {
          // [COMMENT: ปุ่มเทาโชว์ประวัติ]
          container.innerHTML += `
            <div class="att-card opacity-75" style="background:#f8f9fa; border:1px solid #ddd; cursor:default;">
              <div class="att-bar bg-secondary"></div>
              <div class="att-content">
                <div class="fw-bold text-secondary">✔️ ลงเวลา${slot.slot_label}แล้ว</div>
                <small class="text-muted">บันทึกเมื่อ: ${loggedTime}</small>
              </div>
            </div>`;
        } else {
          // [COMMENT: ปุ่มสีตามรอบ]
          container.innerHTML += `
            <div class="att-card" onclick="submitAttendance('${slot.day_no}','${slot.slot_id}')">
              <div class="att-bar bg-${ui.c}"></div>
              <div class="att-content d-flex align-items-center">
                <div class="att-icon">${ui.i}</div>
                <div>
                  <div class="fw-bold text-${ui.c}">ลงเวลา: ${slot.slot_label}</div>
                  <small class="text-muted">${slot.start_time} - ${slot.end_time}</small>
                </div>
              </div>
            </div>`;
        }
      });
    }
  } catch (e) { container.innerHTML = 'ขาดการเชื่อมต่อข้อมูล'; }
}

async function submitAttendance(day, slot) {
  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: { personal_id: localStorage.getItem("tms_personal_id"), day_no: day, time_slot: slot, note: '[V10.0]' } }) });
  Swal.fire('สำเร็จ', 'บันทึกเวลาแล้ว', 'success').then(() => openAttendanceForm());
}

// [COMMENT: #EXAM - ระบบสอบป้องกันทุจริต]
document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({ icon: 'warning', title: 'ตรวจพบการสลับหน้าจอ!', text: 'ระบบกำลังบันทึกพฤติกรรมนี้ กรุณากลับมาทำข้อสอบทันที', confirmButtonColor: '#d33' });
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
    area.innerHTML = `<div class="text-center p-5 bg-light rounded-4"><h5>แบบทดสอบ ${globalExamData.activeExam.type}</h5><p class="small text-muted">เวลา 30 นาที | ห้ามสลับหน้าจอ</p><button class="btn btn-warning btn-lg rounded-pill px-5 mt-2 fw-bold shadow" onclick="startExam()">เริ่มทำข้อสอบ</button></div>`;
  } else { area.innerHTML = `<div class="alert alert-info text-center">${globalExamData.message}</div>`; }
}

function startExam() { isExamActive = true; renderExamQuestions(); startTimer(30 * 60); document.getElementById("btnSubmitExam").classList.remove("d-none"); document.getElementById("examTimerBadge").classList.remove("d-none"); }

function renderExamQuestions() {
  let html = ''; const lbl = ['ก.', 'ข.', 'ค.', 'ง.'];
  globalExamData.questions.forEach((q, i) => {
    html += `<div class="card mb-3 p-4 border-0 shadow-sm rounded-4"><p class="fw-bold">${i+1}. ${q.question}</p>`;
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `<div class="form-check mb-2"><input class="form-check-input" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}"><label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;"><b class="text-primary">${lbl[idx]}</b> ${globalExamData.questions[i].options[opt]}</label></div>`;
    });
    html += `</div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60), s = sec % 60;
    document.getElementById("examTimeDisplay").innerText = `${m}:${s < 10 ? '0'+s : s}`;
    if (sec === 300) { Swal.fire({ toast: true, position: 'top', icon: 'warning', title: 'เหลือเวลา 5 นาที!', showConfirmButton: false, timer: 4000 }); }
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
  Swal.fire({ title: 'บันทึกคะแนน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: { personal_id: localStorage.getItem("tms_personal_id"), test_type: globalExamData.activeExam.type, score: score, max_score: globalExamData.questions.length * 2 } }) });
  Swal.fire('สำเร็จ', `คะแนนของคุณคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
}

// [COMMENT: #SURVEY - ระบบประเมินวิทยากรดึงข้อมูลตามเวลาจริง]
async function openSurveyForm(type) {
  currentSurveyType = type; selectedSpeakerId = null;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  document.getElementById("surveyContentArea").innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div></div>';
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) });
  globalSurveyData = await res.json();
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';

  if (type === 'SPEAKER_SURVEY') {
    renderSpeakerGrid();
    document.getElementById("surveyContentArea").innerHTML = '<p class="text-center text-muted p-5">โปรดเลือกวิทยากรเพื่อแสดงแบบประเมิน</p>';
  } else {
    document.getElementById("speakerSelectionArea").classList.add("d-none");
    renderSurveyQuestions();
    document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  }
}

function renderSpeakerGrid() {
  let grid = document.getElementById("speakerButtonsGrid"); grid.innerHTML = '';
  if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
    document.getElementById("surveyContentArea").innerHTML = '<div class="alert alert-warning text-center">ไม่มีวิทยากรเปิดประเมินตามวันและเวลาในขณะนี้</div>';
    return;
  }
  globalSurveyData.speakers.forEach(spk => {
    grid.innerHTML += `
      <div class="col-12 col-md-6">
        <div class="card p-3 shadow-sm rounded-4 spk-card h-100 text-center" id="spk_${spk.id}" onclick="selectSpeaker('${spk.id}')">
          <h6 class="fw-bold text-primary mb-1">${spk.name}</h6>
          <small class="text-muted small">${spk.topic}</small>
        </div>
      </div>`;
  });
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
}

function selectSpeaker(id) {
  selectedSpeakerId = id;
  document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`spk_${id}`).classList.add('active');
  renderSurveyQuestions();
  document.getElementById("btnSubmitSurvey").classList.remove("d-none");
}

function renderSurveyQuestions() {
  let html = ''; let grouped = {};
  globalSurveyData.questions.forEach(q => { if(!grouped[q.category]) grouped[q.category] = []; grouped[q.category].push(q); });
  Object.keys(grouped).forEach(cat => {
    html += `<h6 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2">${cat}</h6>`;
    grouped[cat].forEach(q => {
      let opts = '';
      q.options.forEach(opt => { opts += `<div class="form-check mb-2 ms-2"><input class="form-check-input" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">${opt}</label></div>`; });
      html += `<div class="card p-3 mb-2 border-0 shadow-sm rounded-4 border-start border-4 border-info"><p class="small fw-bold mb-2">${q.question}</p>${opts}</div>`;
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
  if(!complete) { Swal.fire('เตือน', 'ตอบให้ครบทุกข้อครับ', 'warning'); return; }
  let payload = { personal_id: localStorage.getItem("tms_personal_id"), answers: answers };
  if(currentSurveyType === 'SPEAKER_SURVEY') payload.target_id = selectedSpeakerId;
  let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
  Swal.fire('สำเร็จ', 'ขอบคุณสำหรับข้อมูลครับ', 'success').then(() => backToDashboard('surveySection'));
}